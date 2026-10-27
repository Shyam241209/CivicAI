/**
 * Route Civic Report to Department
 * 
 * Handles intelligent department routing with validation and fallback to admin review.
 * This function is the AUTHORITATIVE router - all routing decisions happen here server-side.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RoutingRequest {
  reportId: string;
  category: string;
  aiConfidence: number;
  suggestedDepartment: string;
}

interface RoutingResult {
  success: boolean;
  departmentId: string | null;
  departmentName: string | null;
  method: "exact" | "fuzzy" | "admin_review";
  confidence: number;
  needsReview: boolean;
  message: string;
}

// These aliases intentionally resolve against live department names, rather than UUIDs.
const CATEGORY_ALIASES: Record<string, string[]> = {
  "animal control": ["stray animal", "stray animals", "stray dog", "animal"],
  "building and town planning": ["building", "unsafe building", "construction", "town planning"],
  "drainage and stormwater": ["drainage", "drainage blockage", "blocked drain", "flooding", "water stagnation", "sewage", "sewer"],
  "environmental services": ["environmental", "air quality", "noise", "pollution"],
  "parks and public spaces": ["fallen tree", "tree fall", "park", "public space", "garden", "greenery", "horticulture"],
  "public health": ["public health", "sanitation hazard", "hygiene"],
  "street cleaning": ["street cleaning", "street sweeping", "road cleaning"],
  "traffic and transportation": ["traffic signal", "broken signal", "traffic", "road sign", "signage", "transport"],
  "waste management": ["garbage", "trash", "waste", "overflowing garbage bin", "overflowing bin", "illegal dumping", "solid waste", "dumping"],
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

/**
 * Normalize and fuzzy match department name
 */
function findDepartmentByName(
  targetName: string,
  availableDepartments: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  if (!targetName) return null;

  const normalized = (s: string) =>
    s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const targetNorm = normalized(targetName);

  // Exact match first
  for (const dept of availableDepartments) {
    if (normalized(dept.name) === targetNorm) {
      return dept;
    }
  }

  // Substring match
  for (const dept of availableDepartments) {
    const deptNorm = normalized(dept.name);
    if (
      deptNorm.includes(targetNorm) ||
      targetNorm.includes(deptNorm)
    ) {
      return dept;
    }
  }

  // No match
  return null;
}

function resolveDepartment(
  category: string,
  suggestedDepartment: string,
  availableDepartments: Array<{ id: string; name: string }>,
): { department: { id: string; name: string } | null; method: "exact" | "fuzzy" } {
  const normalizeText = (value: string) =>
    value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const normalizedCategory = normalizeText(category);
  const normalizedSuggestion = normalizeText(suggestedDepartment);

  for (const department of availableDepartments) {
    const name = normalizeText(department.name);
    if (name === normalizedSuggestion || name === normalizedCategory) {
      return { department, method: "exact" };
    }
  }

  for (const department of availableDepartments) {
    const key = normalizeText(department.name);
    const aliases = CATEGORY_ALIASES[key] || [];
    if (aliases.some((alias) => normalizedCategory === alias || normalizedCategory.includes(alias) || alias.includes(normalizedCategory))) {
      return { department, method: "exact" };
    }
  }

  const target = normalizedSuggestion || normalizedCategory;
  if (!target) return { department: null, method: "fuzzy" };
  const match = availableDepartments.find((department) => {
    const name = normalizeText(department.name);
    return name.includes(target) || target.includes(name);
  });
  return { department: match || null, method: "fuzzy" };
}

/**
 * Route report to appropriate department
 */
async function routeReport(req: RoutingRequest): Promise<RoutingResult> {
  try {
    const { data: currentReport, error: reportError } = await supabase
      .from("civic_reports")
      .select("assigned_department_id, is_auto_assigned, department_assignment_method")
      .eq("id", req.reportId)
      .maybeSingle();

    if (reportError) throw new Error(`Failed to fetch report: ${reportError.message}`);
    if (!currentReport) throw new Error("Report not found");

    if (currentReport.assigned_department_id) {
      const { data: assignedDepartment } = await supabase
        .from("departments")
        .select("id, name")
        .eq("id", currentReport.assigned_department_id)
        .maybeSingle();
      return {
        success: true,
        departmentId: currentReport.assigned_department_id,
        departmentName: assignedDepartment?.name || null,
        method: currentReport.is_auto_assigned ? "exact" : "admin_review",
        confidence: req.aiConfidence,
        needsReview: false,
        message: `Existing assignment kept${assignedDepartment ? `: ${assignedDepartment.name}` : ""}`,
      };
    }

    // Get all departments
    const { data: departments, error: deptError } = await supabase
      .from("departments")
      .select("id, name");

    if (deptError || !departments) {
      throw new Error(`Failed to fetch departments: ${deptError?.message}`);
    }

    // Determine target department
    const resolved = resolveDepartment(req.category, req.suggestedDepartment, departments);
    const targetDept = resolved.department || findDepartmentByName(req.suggestedDepartment, departments);

    // Determine confidence threshold (configurable)
    const CONFIDENCE_THRESHOLD = 0.75;
    const needsReview = req.aiConfidence < CONFIDENCE_THRESHOLD || !targetDept;

    let departmentId: string | null = null;
    let method: "exact" | "fuzzy" | "admin_review" = "admin_review";
    let confidence = 0;
    let message = "";

    if (targetDept) {
      departmentId = targetDept.id;
      method = resolved.method;
      confidence = req.aiConfidence;
      message = `Routed to ${targetDept.name}`;

      // Update report with assignment
      if (!needsReview) {
        const { error: updateError } = await supabase
          .from("civic_reports")
          .update({
            assigned_department_id: departmentId,
            is_auto_assigned: true,
            department_assignment_method: method,
            department_assignment_confidence: confidence,
            needs_admin_review: false,
          })
          .eq("id", req.reportId);

        if (updateError) {
          console.error("Failed to update report:", updateError);
          // Continue despite error - routing succeeded
        }

        // The civic_reports assignment trigger creates the assignment row. The
        // fallback keeps legacy reports idempotent if that row is absent.
        const { data: existingAssignment, error: assignmentReadError } = await supabase
          .from("report_assignments")
          .select("id")
          .eq("report_id", req.reportId)
          .eq("department_id", departmentId)
          .limit(1)
          .maybeSingle();
        if (assignmentReadError) {
          console.error("Failed to inspect assignment:", assignmentReadError);
        } else if (!existingAssignment) {
          const { error: assignError } = await supabase
            .from("report_assignments")
            .insert({
              report_id: req.reportId,
              department_id: departmentId,
              assignment_status: "assigned",
              assigned_by: null,
            });
          if (assignError) console.error("Failed to create assignment:", assignError);
        }

        // Add history
        const { error: historyError } = await supabase
          .from("report_history")
          .insert({
            report_id: req.reportId,
            action: "assigned",
            new_value: {
              department_id: departmentId,
              method,
              confidence,
            },
            actor_type: "system",
          });

        if (historyError) {
          console.error("Failed to add history:", historyError);
        }
      } else {
        message = `Low confidence (${(confidence * 100).toFixed(0)}%) - needs admin review`;
      }
    }

    // Mark for admin review if needed
    if (needsReview) {
      const { error: updateError } = await supabase
        .from("civic_reports")
        .update({
          needs_admin_review: true,
          department_assignment_method: "admin_review",
        })
        .eq("id", req.reportId);

      if (updateError) {
        console.error("Failed to mark for review:", updateError);
      }

      message = targetDept
        ? `Routed to ${targetDept.name} pending admin verification`
        : "Unable to determine department - needs admin review";
    }

    return {
      success: true,
      departmentId: departmentId || null,
      departmentName: targetDept?.name || null,
      method,
      confidence,
      needsReview,
      message,
    };
  } catch (error) {
    console.error("Routing error:", error);
    return {
      success: false,
      departmentId: null,
      departmentName: null,
      method: "admin_review",
      confidence: 0,
      needsReview: true,
      message: `Routing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as RoutingRequest;

    if (!body.reportId || !body.category) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: reportId, category",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await routeReport(body);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Handler error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
