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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { user_id, report_title, new_status, report_id } = await req.json();

    if (!user_id || !new_status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email from auth
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check user notification preferences
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("email")
      .eq("user_id", user_id)
      .maybeSingle();

    // If user hasn't opted in to email, skip
    if (!prefs?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: "email_not_enabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userError || !userData?.user?.email) {
      throw new Error("Could not retrieve user email");
    }

    const userEmail = userData.user.email;
    const title = report_title || "Untitled Report";
    const statusLabel = new_status.charAt(0).toUpperCase() + new_status.slice(1);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CivicAI <onboarding@resend.dev>",
        to: [userEmail],
        subject: `Report Update: ${title} — ${statusLabel}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, hsl(217,91%,60%), hsl(142,76%,36%)); padding: 24px; border-radius: 12px; margin-bottom: 24px;">
              <h1 style="color: #fff; margin: 0; font-size: 22px;">🏛️ CivicAI Report Update</h1>
            </div>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <p style="color: #334155; margin: 0 0 12px;">Your report <strong>"${title}"</strong> has been updated.</p>
              <div style="background: #fff; padding: 16px; border-radius: 8px; border-left: 4px solid hsl(217,91%,60%);">
                <p style="margin: 0; color: #64748b; font-size: 13px;">New Status</p>
                <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold; color: #1e293b;">${statusLabel}</p>
              </div>
                <a href="https://civicai.app/dashboard" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: hsl(217,91%,60%); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">View Dashboard</a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">You're receiving this because you enabled email notifications in CivicAI settings.</p>
          </div>
        `,
      }),
    });

    const emailData = await emailResponse.json();
    if (!emailResponse.ok) {
      throw new Error(`Resend API error [${emailResponse.status}]: ${JSON.stringify(emailData)}`);
    }

    return new Response(JSON.stringify({ success: true, id: emailData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending status email:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
