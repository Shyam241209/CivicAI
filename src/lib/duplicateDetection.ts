/**
 * Duplicate Report Detection
 * Detects similar civic issues based on location, category, and description
 */

import { supabase } from "@/integrations/supabase/client";

export interface DuplicateMatch {
  reportId: string;
  category: string;
  distance_km: number;
  daysSinceReport: number;
  similarity_score: number;
  description: string;
  created_at: string;
  status: string;
}

export interface DuplicateCheckResult {
  hasPotentialDuplicates: boolean;
  matches: DuplicateMatch[];
  confidence: number; // 0-1
  explanation: string;
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein-inspired algorithm
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Check for exact substring matches
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Levenshtein distance
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return 1 - editDistance / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  
  return costs[s2.length];
}

/**
 * Calculate distance between two coordinates in kilometers
 */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Check for duplicate/similar reports
 * Searches within 500m radius and created in last 7 days
 */
export async function checkForDuplicates(
  category: string,
  description: string,
  latitude?: number,
  longitude?: number
): Promise<DuplicateCheckResult> {
  try {
    // Build query for recent reports
    let query = supabase
      .from("civic_reports")
      .select(
        `
        id,
        user_description,
        location_data,
        created_at,
        status,
        ai_category,
        ai_analysis
      `
      )
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .neq("status", "rejected")
      .neq("status", "duplicate");

    // Filter by category if available
    if (category && category !== "Other") {
      query = query.or(`ai_category.eq.${category},ai_category.ilike.%${category}%`);
    }

    const { data: recentReports, error } = await query.limit(50);

    if (error) {
      console.warn("Error checking duplicates:", error);
      return {
        hasPotentialDuplicates: false,
        matches: [],
        confidence: 0,
        explanation: "Could not check for duplicates at this time",
      };
    }

    const matches: DuplicateMatch[] = [];
    const now = new Date();

    // Analyze each report
    for (const report of recentReports || []) {
      // Skip if same as current description
      if (report.user_description === description) continue;

      let matchScore = 0;
      let distance_km = 5000; // Default large distance

      // Category match (40% weight)
      const categoryMatch = report.ai_category?.toLowerCase() === category?.toLowerCase() ? 0.4 : 0;
      matchScore += categoryMatch;

      // Description similarity (40% weight)
      const descriptionSimilarity = calculateStringSimilarity(
        description,
        report.user_description || ""
      );
      if (descriptionSimilarity > 0.7) {
        matchScore += descriptionSimilarity * 0.4;
      }

      // Distance-based match (20% weight)
      if (latitude !== undefined && longitude !== undefined && report.location_data) {
        const loc = report.location_data as Record<string, unknown>;
        const reportLat = loc.latitude;
        const reportLng = loc.longitude;

        if (typeof reportLat === "number" && typeof reportLng === "number") {
          distance_km = haversine(latitude, longitude, reportLat, reportLng);

          // Same location or very close = high weight
          if (distance_km < 0.05) {
            matchScore += 0.2;
          } else if (distance_km < 0.5) {
            matchScore += 0.2 * (1 - distance_km);
          }
        }
      }

      // Only include if reasonable match
      if (matchScore > 0.6) {
        const daysSince = Math.floor((now.getTime() - new Date(report.created_at).getTime()) / (24 * 60 * 60 * 1000));
        
        matches.push({
          reportId: report.id,
          category: report.ai_category || category,
          distance_km: Math.round(distance_km * 1000) / 1000,
          daysSinceReport: daysSince,
          similarity_score: Math.round(matchScore * 100) / 100,
          description: report.user_description || "No description",
          created_at: report.created_at,
          status: report.status,
        });
      }
    }

    // Sort by similarity score
    matches.sort((a, b) => b.similarity_score - a.similarity_score);
    const topMatches = matches.slice(0, 3);

    // Determine overall confidence
    let confidence = 0;
    let explanation = "";

    if (topMatches.length === 0) {
      confidence = 0;
      explanation = "No similar issues found in the area.";
    } else if (topMatches[0].similarity_score > 0.85) {
      confidence = 0.9;
      explanation = `Very similar to a report from ${topMatches[0].daysSinceReport} days ago at ${Math.round(topMatches[0].distance_km * 1000)}m distance.`;
    } else if (topMatches[0].similarity_score > 0.75) {
      confidence = 0.7;
      explanation = `Likely similar to a recent report in the area.`;
    } else {
      confidence = 0.5;
      explanation = "Possible similarity with existing reports.";
    }

    return {
      hasPotentialDuplicates: topMatches.length > 0,
      matches: topMatches,
      confidence,
      explanation,
    };
  } catch (error) {
    console.error("Error in duplicate detection:", error);
    return {
      hasPotentialDuplicates: false,
      matches: [],
      confidence: 0,
      explanation: "Duplicate check failed - continuing with report",
    };
  }
}

/**
 * Get a list of duplicates for a specific report
 */
export async function getDuplicatesForReport(reportId: string): Promise<DuplicateMatch[]> {
  try {
    const { data: mainReport } = await supabase
      .from("civic_reports")
      .select("ai_category, user_description, location_data, created_at")
      .eq("id", reportId)
      .single();

    if (!mainReport) return [];

    const result = await checkForDuplicates(
      mainReport.ai_category,
      mainReport.user_description || "",
      (mainReport.location_data as Record<string, unknown>)?.latitude as number | undefined,
      (mainReport.location_data as Record<string, unknown>)?.longitude as number | undefined
    );

    return result.matches.filter(m => m.reportId !== reportId);
  } catch (error) {
    console.error("Error getting duplicates:", error);
    return [];
  }
}
