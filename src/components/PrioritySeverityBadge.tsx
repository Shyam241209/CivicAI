import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PriorityScoreDetails, getPriorityColor, getPriorityIcon } from "@/lib/priorityScoring";
import { TrendingUp, Clock, Zap } from "lucide-react";

interface PrioritySeverityBadgeProps {
  details: PriorityScoreDetails;
  showDetails?: boolean;
  showFactors?: boolean;
}

export const PrioritySeverityBadge: React.FC<PrioritySeverityBadgeProps> = ({
  details,
  showDetails = true,
  showFactors = false,
}) => {
  return (
    <div className="space-y-3">
      {/* Main Badge Row */}
      <div className="flex items-center gap-2">
        <Badge className={`${getPriorityColor(details.level)} text-sm font-semibold`}>
          {getPriorityIcon(details.level)} {details.level} Priority
        </Badge>
        <Badge variant="outline" className="font-mono font-bold">
          {details.score}/100
        </Badge>
      </div>

      {/* Explanation */}
      {showDetails && (
        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
          {details.explanation}
        </p>
      )}

      {/* Estimated Resolution */}
      {showDetails && (
        <div className="flex items-center gap-2 text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-200">
          <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>
            <strong>Expected Resolution:</strong> {details.estimated_resolution_days}-
            {details.estimated_resolution_days + 2} days
          </span>
        </div>
      )}

      {/* Factors Breakdown */}
      {showFactors && (
        <Card className="p-4 bg-gray-50">
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Priority Factors
          </h4>

          <div className="space-y-2">
            {/* Severity */}
            {details.factors.severity > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Issue Severity</span>
                <div className="flex items-center gap-1">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${details.factors.severity}%` }}
                    />
                  </div>
                  <span className="font-medium text-gray-900 w-8">
                    {details.factors.severity}%
                  </span>
                </div>
              </div>
            )}

            {/* Safety Impact */}
            {details.factors.safety_impact > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Safety Impact</span>
                <div className="flex items-center gap-1">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${details.factors.safety_impact}%` }}
                    />
                  </div>
                  <span className="font-medium text-gray-900 w-8">
                    {details.factors.safety_impact}%
                  </span>
                </div>
              </div>
            )}

            {/* Category Weight */}
            {details.factors.category_weight > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Issue Category</span>
                <div className="flex items-center gap-1">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${details.factors.category_weight}%` }}
                    />
                  </div>
                  <span className="font-medium text-gray-900 w-8">
                    {details.factors.category_weight}%
                  </span>
                </div>
              </div>
            )}

            {/* Community Confirmations */}
            {details.factors.community_confirmations > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Community</span>
                <div className="flex items-center gap-1">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{
                        width: `${Math.min(100, details.factors.community_confirmations)}%`,
                      }}
                    />
                  </div>
                  <span className="font-medium text-gray-900 w-8">
                    {details.factors.community_confirmations}%
                  </span>
                </div>
              </div>
            )}

            {/* Recurrence */}
            {details.factors.recurrence > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Recurrence</span>
                <div className="flex items-center gap-1">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500"
                      style={{
                        width: `${Math.min(100, details.factors.recurrence * 10)}%`,
                      }}
                    />
                  </div>
                  <span className="font-medium text-gray-900 w-8">
                    {details.factors.recurrence}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Info note */}
      <p className="text-xs text-gray-500 italic">
        Priority is calculated based on severity, category importance, safety impact, and community confirmations.
      </p>
    </div>
  );
};

/**
 * Simple severity badge only (no breakdown)
 */
export const SeverityBadgeOnly: React.FC<{ level: string; score: number }> = ({
  level,
  score,
}) => {
  const validLevel = (["Critical", "High", "Medium", "Low"].includes(level) 
    ? level 
    : "Medium") as "Critical" | "High" | "Medium" | "Low";
  
  return (
    <div className="flex items-center gap-2">
      <Badge
        className={`${getPriorityColor(validLevel)} text-xs font-semibold`}
      >
        {getPriorityIcon(validLevel)} {level}
      </Badge>
      <span className="text-xs text-gray-600">{score}/100</span>
    </div>
  );
};

export default PrioritySeverityBadge;
