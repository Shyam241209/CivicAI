/**
 * Report Workflow Integration
 * 
 * Handles PHASE 1 (duplicates + priority) and PHASE 2 (routing) integration
 * into the report submission workflow.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  checkForDuplicates,
  DuplicateCheckResult,
  type DuplicateMatch,
} from "./duplicateDetection";
import {
  calculatePriorityScore,
  PriorityScoreDetails,
} from "./priorityScoring";

export interface AnalysisResult {
  is_valid_civic_issue: boolean;
  validation_message: string;
  issue_category: string;
  severity: string;
  priority_level: string;
  short_description: string;
  suggested_department: string;
  context_analysis: string;
  estimated_resolution_time: string;
  recommended_action: string;
  ai_confidence_score: number;
  detected_objects?: string[];
}

export interface EnhancedReportData {
  category: string;
  severity: string;
  description: string;
  location: string;
  locationCoords: { lat: number; lng: number } | null;
  images: string[]; // URLs after upload
  aiConfidence: number;
  suggestedDepartment: string;
}

export interface RoutingResult {
  success: boolean;
  departmentId: string | null;
  departmentName: string | null;
  method: "exact" | "fuzzy" | "admin_review";
  confidence: number;
  needsReview: boolean;
  message: string;
}

export interface RoutableReport {
  id: string;
  assigned_department_id?: string | null;
  issue_category?: string | null;
  suggested_department?: string | null;
  ai_confidence_score?: number | null;
  department_assignment_method?: string | null;
  auto_assign_match_method?: string | null;
}

/**
 * PHASE 1: Check for duplicate reports after AI analysis
 */
export async function checkDuplicatesForReport(
  category: string,
  description: string,
  lat?: number,
  lng?: number
): Promise<DuplicateCheckResult> {
  try {
    return await checkForDuplicates(category, description, lat, lng);
  } catch (error) {
    console.error("Error checking duplicates:", error);
    return {
      hasDuplicates: false,
      matches: [],
      confidence: 0,
      explanation: "Unable to check for duplicates",
    };
  }
}

/**
 * PHASE 2: Calculate priority score based on analysis + duplicates
 */
export async function calculateReportPriority(
  category: string,
  severity: string,
  aiConfidence: number,
  duplicateMatches?: DuplicateMatch[],
  locationPopularity?: number
): Promise<PriorityScoreDetails> {
  try {
    const communityConfirmations = duplicateMatches?.length ?? 0;
    const duplicateReports = communityConfirmations;

    return calculatePriorityScore(
      category,
      severity,
      aiConfidence,
      communityConfirmations,
      duplicateReports,
      locationPopularity
    );
  } catch (error) {
    console.error("Error calculating priority:", error);
    return {
      score: 50,
      level: "medium",
      factors: {
        severity: 0.5,
        category: 0.5,
        safety_impact: 0.5,
        community: 0,
        recurrence: 0,
      },
      explanation: "Priority calculated with defaults",
      estimated_resolution_days: 7,
    };
  }
}

/**
 * PHASE 2: Route report to department via backend
 */
export async function routeReportToDepartment(
  reportId: string,
  category: string,
  aiConfidence: number,
  suggestedDepartment: string
): Promise<RoutingResult> {
  try {
    const response = await supabase.functions.invoke("route-civic-report", {
      body: {
        reportId,
        category,
        aiConfidence,
        suggestedDepartment,
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.data as RoutingResult;
  } catch (error) {
    console.error("Error routing report:", error);
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

/** Route existing unassigned reports through the same authoritative router. */
export async function autoRouteUnassignedReports(reports: RoutableReport) {
  if (
    reports.assigned_department_id ||
    !reports.issue_category ||
    reports.department_assignment_method === "rejected" ||
    reports.department_assignment_method === "manual_override" ||
    reports.auto_assign_match_method === "rejected"
  ) {
    return null;
  }

  return routeReportToDepartment(
    reports.id,
    reports.issue_category,
    reports.ai_confidence_score ?? 0,
    reports.suggested_department || reports.issue_category,
  );
}

/**
 * PHASE 2: Get department details by ID
 */
export async function getDepartmentById(departmentId: string) {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, officer_name, contact_email, phone, description")
      .eq("id", departmentId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching department:", error);
    return null;
  }
}

/**
 * Determine if routing confidence is sufficient for auto-assignment
 */
export function shouldAutoAssign(
  confidence: number,
  threshold: number = 0.75
): boolean {
  return confidence >= threshold;
}

/**
 * Format routing message for display
 */
export function formatRoutingMessage(result: RoutingResult): string {
  if (result.needsReview) {
    return result.message.includes("confidence")
      ? `Low confidence (${(result.confidence * 100).toFixed(0)}%) - will be reviewed by admin`
      : "Department needs admin verification";
  }

  return `Routed to ${result.departmentName || "department"} ${
    result.method === "exact"
      ? "(exact match)"
      : `(${(result.confidence * 100).toFixed(0)}% confidence)`
  }`;
}
