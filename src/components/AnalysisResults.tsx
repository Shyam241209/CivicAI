import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Clock, TrendingUp, Building, CheckCircle, Pencil, Save, X } from "lucide-react";

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

interface AnalysisResultsProps {
  result: AnalysisResult;
  onUpdate?: (updated: AnalysisResult) => void;
}

const SEVERITY_OPTIONS = ["critical", "moderate", "minor"];
const PRIORITY_OPTIONS = ["high", "medium", "low"];
const CATEGORY_OPTIONS = [
  "pothole", "garbage", "streetlight", "water_leak", "road_damage",
  "drainage", "pollution", "encroachment", "traffic", "other"
];
const DEPARTMENT_OPTIONS = [
  "Public Works", "Sanitation", "Water Supply", "Electricity Board",
  "Traffic Police", "Municipal Corporation", "Environment", "Urban Planning", "Other"
];

export const AnalysisResults = ({ result, onUpdate }: AnalysisResultsProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<AnalysisResult>(result);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "moderate": return "default";
      case "minor": return "secondary";
      default: return "default";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const handleSave = () => {
    onUpdate?.(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(result);
    setIsEditing(false);
  };

  const displayData = isEditing ? editData : result;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">AI Analysis Results</CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4" />
              {Math.round(displayData.ai_confidence_score * 100)}% Confidence
            </div>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Category</div>
            {isEditing ? (
              <Select value={editData.issue_category} onValueChange={(v) => setEditData({ ...editData, issue_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span className="font-semibold capitalize">{displayData.issue_category}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Department</div>
            {isEditing ? (
              <Select value={editData.suggested_department} onValueChange={(v) => setEditData({ ...editData, suggested_department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-accent" />
                <span className="font-semibold">{displayData.suggested_department}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Severity</div>
            {isEditing ? (
              <Select value={editData.severity} onValueChange={(v) => setEditData({ ...editData, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant={getSeverityColor(displayData.severity)} className="capitalize">
                {displayData.severity}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Priority</div>
            {isEditing ? (
              <Select value={editData.priority_level} onValueChange={(v) => setEditData({ ...editData, priority_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant={getPriorityColor(displayData.priority_level)} className="capitalize">
                {displayData.priority_level} Priority
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Description</div>
          {isEditing ? (
            <Input
              value={editData.short_description}
              onChange={(e) => setEditData({ ...editData, short_description: e.target.value })}
            />
          ) : (
            <p className="text-base">{displayData.short_description}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Context Analysis</div>
          {isEditing ? (
            <Textarea
              value={editData.context_analysis}
              onChange={(e) => setEditData({ ...editData, context_analysis: e.target.value })}
              className="min-h-20"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{displayData.context_analysis}</p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="w-4 h-4" />
              Estimated Resolution Time
            </div>
            {isEditing ? (
              <Input
                value={editData.estimated_resolution_time}
                onChange={(e) => setEditData({ ...editData, estimated_resolution_time: e.target.value })}
              />
            ) : (
              <p className="font-semibold">{displayData.estimated_resolution_time}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              Recommended Action
            </div>
            {isEditing ? (
              <Input
                value={editData.recommended_action}
                onChange={(e) => setEditData({ ...editData, recommended_action: e.target.value })}
              />
            ) : (
              <p className="font-semibold">{displayData.recommended_action}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
