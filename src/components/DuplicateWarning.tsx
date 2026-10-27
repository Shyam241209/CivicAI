import React from "react";
import { AlertCircle, Search, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DuplicateMatch } from "@/lib/duplicateDetection";

interface DuplicateWarningProps {
  matches: DuplicateMatch[];
  confidence: number;
  explanation: string;
  onViewReport?: (reportId: string) => void;
}

export const DuplicateWarning: React.FC<DuplicateWarningProps> = ({
  matches,
  confidence,
  explanation,
  onViewReport,
}) => {
  if (!matches || matches.length === 0) {
    return (
      <Card className="p-4 bg-green-50 border-green-200">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-green-900">No Duplicates Found</h4>
            <p className="text-sm text-green-700">
              Your report appears to be unique. Good to submit!
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const maxConfidence = confidence * 100;
  const severityColor =
    maxConfidence >= 85
      ? "bg-red-50 border-red-200"
      : maxConfidence >= 70
        ? "bg-orange-50 border-orange-200"
        : "bg-yellow-50 border-yellow-200";

  return (
    <Card className={`p-4 border ${severityColor}`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Search className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium text-amber-900">Similar Issue Found</h4>
              <Badge variant="outline" className="text-xs">
                {Math.round(maxConfidence)}% similar
              </Badge>
            </div>
            <p className="text-sm text-amber-700">{explanation}</p>
          </div>
        </div>

        {/* Matches List */}
        <div className="space-y-2 ml-8">
          {matches.map((match, index) => (
            <div
              key={index}
              className="p-3 bg-white rounded border border-amber-100 text-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {match.category}
                  </p>
                  <p className="text-gray-600 text-xs line-clamp-2">
                    {match.description}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
                <div>
                  <span className="text-gray-400">Distance:</span>
                  <p className="font-medium text-gray-900">
                    {match.distance_km < 0.1
                      ? `${(match.distance_km * 1000).toFixed(0)}m`
                      : `${match.distance_km.toFixed(2)}km`}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Days ago:</span>
                  <p className="font-medium text-gray-900">
                    {match.daysSinceReport === 0
                      ? "Today"
                      : `${match.daysSinceReport}d ago`}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Similarity:</span>
                  <p className="font-medium text-gray-900">
                    {Math.round(match.similarity_score * 100)}%
                  </p>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Status: {match.status}
                </span>
                {onViewReport && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onViewReport(match.reportId)}
                  >
                    View Report
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action */}
        <div className="ml-8 p-3 bg-white rounded border border-amber-100">
          <p className="text-sm text-amber-900 mb-2">
            <strong>Note:</strong> Submitting anyway? Your report will still be processed. You can also verify and confirm the existing issue instead.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default DuplicateWarning;
