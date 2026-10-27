import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, TrendingDown, Minus, Clock, Building } from "lucide-react";

interface AnalysisResult {
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

interface AnalysisComparisonViewProps {
  previousResult: AnalysisResult;
  currentResult: AnalysisResult;
  onDismiss: () => void;
}

export const AnalysisComparisonView = ({
  previousResult,
  currentResult,
  onDismiss,
}: AnalysisComparisonViewProps) => {
  const getChangeIndicator = (prev: string, curr: string) => {
    if (prev === curr) return <Minus className="w-4 h-4 text-muted-foreground" />;
    return <ArrowRight className="w-4 h-4 text-primary" />;
  };

  const getConfidenceChange = (prev: number, curr: number) => {
    const diff = curr - prev;
    if (diff > 0) {
      return (
        <span className="text-green-600 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          +{(diff * 100).toFixed(0)}%
        </span>
      );
    } else if (diff < 0) {
      return (
        <span className="text-red-600 flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />
          {(diff * 100).toFixed(0)}%
        </span>
      );
    }
    return <span className="text-muted-foreground">No change</span>;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "moderate":
        return "default";
      case "minor":
        return "secondary";
      default:
        return "default";
    }
  };

  const hasChanges =
    previousResult.issue_category !== currentResult.issue_category ||
    previousResult.severity !== currentResult.severity ||
    previousResult.priority_level !== currentResult.priority_level ||
    previousResult.suggested_department !== currentResult.suggested_department ||
    previousResult.short_description !== currentResult.short_description ||
    previousResult.ai_confidence_score !== currentResult.ai_confidence_score;

  return (
    <Card className="border-2 border-accent/30 bg-accent/5 mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-accent" />
            Analysis Comparison
          </CardTitle>
          <button
            onClick={onDismiss}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
        {!hasChanges && (
          <p className="text-sm text-muted-foreground">
            No significant changes detected in the re-analysis.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confidence Score Change */}
        <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
          <span className="text-sm font-medium">AI Confidence</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {Math.round(previousResult.ai_confidence_score * 100)}%
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {Math.round(currentResult.ai_confidence_score * 100)}%
            </span>
            {getConfidenceChange(
              previousResult.ai_confidence_score,
              currentResult.ai_confidence_score
            )}
          </div>
        </div>

        {/* Category Comparison */}
        {previousResult.issue_category !== currentResult.issue_category && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
              <p className="text-xs text-muted-foreground mb-1">Previous Category</p>
              <p className="font-medium capitalize line-through text-muted-foreground">
                {previousResult.issue_category}
              </p>
            </div>
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">New Category</p>
              <p className="font-medium capitalize text-primary">
                {currentResult.issue_category}
              </p>
            </div>
          </div>
        )}

        {/* Severity Comparison */}
        {previousResult.severity !== currentResult.severity && (
          <div className="flex items-center gap-4 p-3 bg-background rounded-lg border">
            <span className="text-sm font-medium">Severity:</span>
            <Badge variant={getSeverityColor(previousResult.severity)} className="opacity-50 line-through">
              {previousResult.severity}
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={getSeverityColor(currentResult.severity)}>
              {currentResult.severity}
            </Badge>
          </div>
        )}

        {/* Priority Comparison */}
        {previousResult.priority_level !== currentResult.priority_level && (
          <div className="flex items-center gap-4 p-3 bg-background rounded-lg border">
            <span className="text-sm font-medium">Priority:</span>
            <span className="text-sm text-muted-foreground line-through">
              {previousResult.priority_level}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-primary">
              {currentResult.priority_level}
            </span>
          </div>
        )}

        {/* Department Comparison */}
        {previousResult.suggested_department !== currentResult.suggested_department && (
          <div className="p-3 bg-background rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Building className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Department Change</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground line-through">
                {previousResult.suggested_department}
              </div>
              <div className="text-primary font-medium">
                {currentResult.suggested_department}
              </div>
            </div>
          </div>
        )}

        {/* Description Comparison */}
        {previousResult.short_description !== currentResult.short_description && (
          <div className="p-3 bg-background rounded-lg border">
            <p className="text-sm font-medium mb-2">Description Updated</p>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground line-through">
                {previousResult.short_description}
              </p>
              <p className="text-foreground">
                {currentResult.short_description}
              </p>
            </div>
          </div>
        )}

        {/* Resolution Time Comparison */}
        {previousResult.estimated_resolution_time !== currentResult.estimated_resolution_time && (
          <div className="flex items-center gap-4 p-3 bg-background rounded-lg border">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Est. Resolution:</span>
            <span className="text-sm text-muted-foreground line-through">
              {previousResult.estimated_resolution_time}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {currentResult.estimated_resolution_time}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
