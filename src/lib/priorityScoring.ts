/**
 * Priority Scoring Engine for Civic Issues
 * Calculates priority (0-100) based on multiple factors
 */

export type SeverityLevel = "Low" | "Medium" | "High" | "Critical";

export interface PriorityScoreDetails {
  score: number; // 0-100
  level: "Low" | "Medium" | "High" | "Critical";
  factors: {
    severity: number;
    safety_impact: number;
    category_weight: number;
    community_confirmations: number;
    recurrence: number;
    workload_impact: number;
  };
  explanation: string;
  estimated_resolution_days: number;
}

/**
 * Map of issue categories to base priority weights
 */
const CATEGORY_WEIGHTS: Record<string, { weight: number; description: string }> = {
  "Pothole": { weight: 0.85, description: "Road safety hazard" },
  "Damaged Road": { weight: 0.8, description: "Traffic hazard" },
  "Broken Streetlight": { weight: 0.7, description: "Public safety concern" },
  "Garbage": { weight: 0.6, description: "Sanitation issue" },
  "Overflowing Garbage Bin": { weight: 0.65, description: "Hygiene concern" },
  "Drainage": { weight: 0.75, description: "Water stagnation risk" },
  "Sewage": { weight: 0.9, description: "Health hazard" },
  "Water Leakage": { weight: 0.7, description: "Resource waste" },
  "Electrical": { weight: 0.85, description: "Safety hazard" },
  "Traffic Signal": { weight: 0.8, description: "Traffic safety" },
  "Fallen Tree": { weight: 0.85, description: "Public safety hazard" },
  "Illegal Dumping": { weight: 0.8, description: "Environmental hazard" },
  "Public Property Damage": { weight: 0.65, description: "Structural concern" },
  "Other": { weight: 0.5, description: "Miscellaneous issue" },
};

/**
 * Convert AI severity to numeric score (0-1)
 */
function getSeverityScore(severity: string): number {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "critical") return 1.0;
  if (normalized === "high") return 0.75;
  if (normalized === "medium") return 0.5;
  if (normalized === "low") return 0.25;
  return 0.5; // Default
}

/**
 * Convert numeric severity to level name
 */
function getSeverityLevel(severity: string): SeverityLevel {
  const normalized = severity.toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return "Medium"; // Default
}

/**
 * Estimate resolution time based on category and severity
 */
function estimateResolutionDays(category: string, severity: string): number {
  const severityScore = getSeverityScore(severity);
  const categoryWeight = CATEGORY_WEIGHTS[category]?.weight || 0.5;

  // Base estimate by category
  let baseDays = 7;
  if (category === "Pothole" || category === "Damaged Road") baseDays = 3;
  if (category === "Sewage" || category === "Electrical") baseDays = 2;
  if (category === "Garbage" || category === "Street Cleaning") baseDays = 1;
  if (category === "Water Leakage") baseDays = 2;
  if (category === "Drainage") baseDays = 3;

  // Adjust based on severity
  const severityMultiplier = severityScore > 0.75 ? 0.75 : 1;
  return Math.max(1, Math.round(baseDays * severityMultiplier));
}

/**
 * Calculate priority score (0-100) for a civic issue
 *
 * Formula considers:
 * - Severity (40%)
 * - Category importance (25%)
 * - Safety impact (20%)
 * - Community factors (15%)
 */
export function calculatePriorityScore(
  category: string,
  severity: string,
  aiConfidence: number = 0.8,
  communityConfirmations: number = 0,
  duplicateReports: number = 0,
  locationPopularity: number = 0 // 0-1, higher = more populated area
): PriorityScoreDetails {
  // Normalize inputs
  const severityScore = getSeverityScore(severity);
  const categoryWeight = CATEGORY_WEIGHTS[category]?.weight || 0.5;
  const confidenceMultiplier = Math.max(0.5, Math.min(1, aiConfidence));

  // Calculate factors
  const severityFactor = severityScore * 0.4 * confidenceMultiplier;
  const categoryFactor = categoryWeight * 0.25;
  
  // Safety impact increases with severity and certain categories
  const highRiskCategories = [
    "Pothole",
    "Damaged Road",
    "Sewage",
    "Electrical",
    "Fallen Tree",
  ];
  const safetyImpact = (
    highRiskCategories.includes(category) ? 0.15 : 0.08
  ) * severityScore * 0.2;

  // Community factors
  const communityFactor = Math.min(
    0.15,
    (communityConfirmations * 0.02 + duplicateReports * 0.01) * 0.15
  );

  // Workload impact: Higher in populated areas
  const workloadFactor = Math.min(0.1, locationPopularity * 0.1);

  // Total score
  const baseScore =
    severityFactor +
    categoryFactor +
    safetyImpact +
    communityFactor +
    workloadFactor;

  const score = Math.min(100, Math.max(0, Math.round(baseScore * 100)));

  // Determine level
  let level: SeverityLevel;
  if (score >= 80) level = "Critical";
  else if (score >= 60) level = "High";
  else if (score >= 40) level = "Medium";
  else level = "Low";

  // Generate explanation
  const explanationParts: string[] = [];
  if (severityScore >= 0.75) {
    explanationParts.push(`${severity} severity issue`);
  }
  if (highRiskCategories.includes(category)) {
    explanationParts.push("poses safety hazards");
  }
  if (communityConfirmations > 0) {
    explanationParts.push(`${communityConfirmations} confirmations from community`);
  }
  if (duplicateReports > 0) {
    explanationParts.push(`${duplicateReports} similar reports nearby`);
  }

  const explanation =
    explanationParts.length > 0
      ? explanationParts.join(", ") + "."
      : "Issue requires attention based on category and severity.";

  return {
    score,
    level,
    factors: {
      severity: Math.round(severityFactor * 100),
      safety_impact: Math.round(safetyImpact * 100),
      category_weight: Math.round(categoryFactor * 100),
      community_confirmations: Math.round(communityFactor * 100),
      recurrence: Math.round(duplicateReports * 2),
      workload_impact: Math.round(workloadFactor * 100),
    },
    explanation,
    estimated_resolution_days: estimateResolutionDays(category, severity),
  };
}

/**
 * Get color for priority level (for UI)
 */
export function getPriorityColor(level: SeverityLevel): string {
  switch (level) {
    case "Critical":
      return "bg-red-100 text-red-900 border-red-300";
    case "High":
      return "bg-orange-100 text-orange-900 border-orange-300";
    case "Medium":
      return "bg-yellow-100 text-yellow-900 border-yellow-300";
    case "Low":
      return "bg-green-100 text-green-900 border-green-300";
  }
}

/**
 * Get icon for priority level
 */
export function getPriorityIcon(level: SeverityLevel): string {
  switch (level) {
    case "Critical":
      return "🔴"; // Red circle
    case "High":
      return "🟠"; // Orange circle
    case "Medium":
      return "🟡"; // Yellow circle
    case "Low":
      return "🟢"; // Green circle
  }
}

/**
 * Format priority score as badge text
 */
export function formatPriorityScore(score: number): string {
  return `${score}/100`;
}

/**
 * Get brief description of priority factors
 */
export function getPriorityFactorsSummary(details: PriorityScoreDetails): string {
  const factors = [];

  if (details.factors.severity > 20)
    factors.push(`Severity: ${details.factors.severity}`);
  if (details.factors.safety_impact > 10)
    factors.push(`Safety: ${details.factors.safety_impact}`);
  if (details.factors.category_weight > 15)
    factors.push(`Category: ${details.factors.category_weight}`);
  if (details.factors.community_confirmations > 5)
    factors.push(`Community: ${details.factors.community_confirmations}`);
  if (details.factors.recurrence > 0)
    factors.push(`Recurrence: ${details.factors.recurrence}`);

  return factors.join(" • ");
}
