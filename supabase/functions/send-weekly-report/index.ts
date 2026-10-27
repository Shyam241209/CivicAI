import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active scheduled report configs that are due
    const { data: configs, error: configError } = await supabaseAdmin
      .from("scheduled_report_configs")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString());

    if (configError) throw configError;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: "No reports due" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const results = [];

    for (const config of configs) {
      // Calculate period based on frequency
      const periodEnd = now;
      const periodStart = new Date(now);
      if (config.frequency === "daily") {
        periodStart.setDate(periodStart.getDate() - 1);
      } else if (config.frequency === "weekly") {
        periodStart.setDate(periodStart.getDate() - 7);
      } else {
        periodStart.setMonth(periodStart.getMonth() - 1);
      }

      // Aggregate civic reports data for the period
      const { data: reports, error: reportsError } = await supabaseAdmin
        .from("civic_reports")
        .select("*")
        .gte("created_at", periodStart.toISOString())
        .lte("created_at", periodEnd.toISOString());

      if (reportsError) {
        console.error("Error fetching reports:", reportsError);
        continue;
      }

      const totalReports = reports?.length || 0;
      const statusCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      const severityCounts: Record<string, number> = {};

      for (const r of reports || []) {
        const status = r.status || "unknown";
        const category = r.issue_category || "uncategorized";
        const severity = r.severity || "unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        severityCounts[severity] = (severityCounts[severity] || 0) + 1;
      }

      const resolvedCount = statusCounts["resolved"] || 0;
      const resolutionRate = totalReports > 0 ? Math.round((resolvedCount / totalReports) * 100) : 0;

      // Generate an AI summary for the report
      const reportData = {
        totalReports,
        statusCounts,
        categoryCounts,
        severityCounts,
        resolutionRate,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      };
      const frequencyLabel = config.frequency.charAt(0).toUpperCase() + config.frequency.slice(1);
      const title = `${frequencyLabel} Analytics Report — ${periodStart.toLocaleDateString("en-IN")} to ${periodEnd.toLocaleDateString("en-IN")}`;

      // Generate AI summary using configured AI provider if available
      let summary = "";
      const aiApiUrl = Deno.env.get("AI_API_URL");
      const aiApiKey = Deno.env.get("AI_API_KEY");
      const aiModel = Deno.env.get("AI_MODEL");
      
      try {
        if (aiApiUrl && aiApiKey && aiModel) {
          const summaryPrompt = `Generate a concise executive analytics summary (3-4 paragraphs) for a government civic platform admin. Data for the period:\n- Total reports: ${totalReports}\n- Status breakdown: ${JSON.stringify(statusCounts)}\n- Category breakdown: ${JSON.stringify(categoryCounts)}\n- Severity breakdown: ${JSON.stringify(severityCounts)}\n- Resolution rate: ${resolutionRate}%\nInclude key insights, trends, and recommended actions.`;

          const aiResponse = await fetch(aiApiUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [
                {
                  role: "system",
                  content: "You are an analytics assistant for a civic issue reporting platform. Produce a short executive summary based on the provided report metrics.",
                },
                {
                  role: "user",
                  content: summaryPrompt,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            summary = aiData?.choices?.[0]?.message?.content || aiData?.choices?.[0]?.text || aiData?.analysis || aiData?.result || "";
          } else {
            const text = await aiResponse.text();
            console.error("AI provider returned error for summary generation:", aiResponse.status, text);
          }
        } else {
          console.log("AI provider not configured for scheduled report summary; using fallback summary.");
        }
      } catch (aiErr) {
        console.error("AI summary generation failed, using fallback:", aiErr);
      }

      // Fallback summary if AI fails
      if (!summary) {
        const topCategory = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)[0];
        const topSeverity = Object.entries(severityCounts).sort(([, a], [, b]) => b - a)[0];
        summary = `During this period, ${totalReports} civic reports were submitted. ` +
          `The resolution rate was ${resolutionRate}%. ` +
          (topCategory ? `Most common category: ${topCategory[0]} (${topCategory[1]} reports). ` : "") +
          (topSeverity ? `Most common severity: ${topSeverity[0]} (${topSeverity[1]} reports). ` : "") +
          `Status breakdown: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}.`;
      }

      // Store the generated report
      const { error: insertError } = await supabaseAdmin
        .from("generated_reports")
        .insert({
          admin_id: config.admin_id,
          title,
          summary,
          report_data: reportData,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
        });

      if (insertError) {
        console.error("Error inserting report:", insertError);
        continue;
      }

      // Create in-app notification
      await supabaseAdmin.from("notifications").insert({
        user_id: config.admin_id,
        title: `📊 ${frequencyLabel} Report Ready`,
        message: `Your ${config.frequency} analytics report for ${periodStart.toLocaleDateString("en-IN")} – ${periodEnd.toLocaleDateString("en-IN")} is ready. ${totalReports} reports analyzed, ${resolutionRate}% resolution rate.`,
        type: "report",
      });

      // Send email if RESEND_API_KEY is configured
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        try {
          // Get admin email
          const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(config.admin_id);
          const adminEmail = adminUser?.user?.email;

          if (adminEmail) {
            const statusRows = Object.entries(reportData.statusCounts)
              .map(([k, v]) => `<tr><td style="padding:8px 16px;border-bottom:1px solid #e2e8f0;">${k}</td><td style="padding:8px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${v}</td></tr>`)
              .join("");
            const categoryRows = Object.entries(reportData.categoryCounts)
              .map(([k, v]) => `<tr><td style="padding:8px 16px;border-bottom:1px solid #e2e8f0;">${k}</td><td style="padding:8px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${v}</td></tr>`)
              .join("");

            const emailHtml = `
              <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;">
                <div style="background:linear-gradient(135deg,hsl(217,91%,60%),hsl(142,76%,36%));padding:28px 24px;border-radius:12px;margin-bottom:24px;">
                  <h1 style="color:#fff;margin:0;font-size:22px;">🏛️ CivicAI ${frequencyLabel} Analytics Report</h1>
                  <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${periodStart.toLocaleDateString("en-IN")} — ${periodEnd.toLocaleDateString("en-IN")}</p>
                </div>
                <div style="display:flex;gap:12px;margin-bottom:24px;">
                  <div style="flex:1;background:#f0f9ff;padding:16px;border-radius:8px;text-align:center;">
                    <p style="margin:0;color:#64748b;font-size:12px;">Total Reports</p>
                    <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#1e293b;">${totalReports}</p>
                  </div>
                  <div style="flex:1;background:#f0fdf4;padding:16px;border-radius:8px;text-align:center;">
                    <p style="margin:0;color:#64748b;font-size:12px;">Resolution Rate</p>
                    <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#16a34a;">${resolutionRate}%</p>
                  </div>
                  <div style="flex:1;background:#fefce8;padding:16px;border-radius:8px;text-align:center;">
                    <p style="margin:0;color:#64748b;font-size:12px;">Resolved</p>
                    <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#ca8a04;">${resolvedCount}</p>
                  </div>
                </div>
                <div style="background:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:20px;">
                  <h2 style="margin:0 0 12px;font-size:16px;color:#334155;">📋 Executive Summary</h2>
                  <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">${summary}</p>
                </div>
                <div style="display:flex;gap:16px;margin-bottom:20px;">
                  <div style="flex:1;">
                    <h3 style="margin:0 0 8px;font-size:14px;color:#334155;">Status Breakdown</h3>
                    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
                      ${statusRows}
                    </table>
                  </div>
                  <div style="flex:1;">
                    <h3 style="margin:0 0 8px;font-size:14px;color:#334155;">Category Breakdown</h3>
                    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
                      ${categoryRows}
                    </table>
                  </div>
                </div>
                <a href="https://civicai.app/admin" style="display:inline-block;margin-top:8px;padding:12px 24px;background:hsl(217,91%,60%);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View Full Report in Dashboard</a>
                <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px;">This is an automated ${config.frequency} report from CivicAI. Manage your schedule in Admin Settings.</p>
              </div>
            `;

            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "CivicAI <onboarding@resend.dev>",
                to: [adminEmail],
                subject: `📊 ${title}`,
                html: emailHtml,
              }),
            });

            if (!emailRes.ok) {
              const errBody = await emailRes.text();
              console.error("Email send failed:", errBody);
            } else {
              console.log("Report email sent to", adminEmail);
            }
          }
        } catch (emailErr) {
          console.error("Email delivery error (non-fatal):", emailErr);
        }
      } else {
        console.log("RESEND_API_KEY not configured, skipping email delivery");
      }

      // Update next_run_at
      const nextRun = new Date(now);
      if (config.frequency === "daily") {
        nextRun.setDate(nextRun.getDate() + 1);
      } else if (config.frequency === "weekly") {
        nextRun.setDate(nextRun.getDate() + 7);
      } else {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }

      await supabaseAdmin
        .from("scheduled_report_configs")
        .update({
          last_sent_at: now.toISOString(),
          next_run_at: nextRun.toISOString(),
        })
        .eq("id", config.id);

      results.push({ configId: config.id, adminId: config.admin_id, totalReports, emailSent: !!RESEND_API_KEY });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in send-weekly-report:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
