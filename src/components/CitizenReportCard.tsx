import { StorageImage } from "@/components/StorageImage";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  Lightbulb, 
  Construction,
  CheckCircle2,
  Circle,
  Timer,
  Share2,
  Copy,
  Twitter,
  Facebook,
  Check,
  Building2,
  Sparkles
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface Report {
  id: string;
  image_url: string | null;
  user_description: string;
  issue_category: string;
  severity: string;
  priority_level: string;
  short_description: string;
  suggested_department: string;
  status: string;
  created_at: string;
  estimated_resolution_time: string | null;
  assigned_department_name?: string | null;
  auto_assign_confidence?: number | null;
  auto_assign_match_method?: string | null;
  auto_assign_pending_confirmation?: boolean | null;
  location_data: {
    lat?: number;
    lng?: number;
    address?: string;
  } | null;
}

interface CitizenReportCardProps {
  report: Report;
  isSelected?: boolean;
  onSelect?: (report: Report) => void;
}

const getCategoryIcon = (category: string) => {
  const lowerCategory = category?.toLowerCase() || "";
  if (lowerCategory.includes("pothole") || lowerCategory.includes("road")) {
    return <Construction className="w-5 h-5" />;
  }
  if (lowerCategory.includes("garbage") || lowerCategory.includes("waste")) {
    return <Trash2 className="w-5 h-5" />;
  }
  if (lowerCategory.includes("light") || lowerCategory.includes("street")) {
    return <Lightbulb className="w-5 h-5" />;
  }
  return <AlertTriangle className="w-5 h-5" />;
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case "pending":
      return { 
        label: "Submitted", 
        color: "bg-warning text-warning-foreground",
        progress: 25,
        step: 1
      };
    case "in_review":
      return { 
        label: "In Review", 
        color: "bg-primary text-primary-foreground",
        progress: 50,
        step: 2
      };
    case "in_progress":
      return { 
        label: "In Progress", 
        color: "bg-primary text-primary-foreground",
        progress: 75,
        step: 3
      };
    case "resolved":
      return { 
        label: "Resolved", 
        color: "bg-success text-success-foreground",
        progress: 100,
        step: 4
      };
    default:
      return { 
        label: status, 
        color: "bg-secondary text-secondary-foreground",
        progress: 0,
        step: 0
      };
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return "destructive";
    case "high":
      return "destructive";
    case "moderate":
      return "default";
    case "minor":
      return "secondary";
    default:
      return "secondary";
  }
};

const parseETA = (eta: string | null): string => {
  if (!eta) return "Calculating...";
  
  // Try to parse common formats
  const hoursMatch = eta.match(/(\d+)\s*(?:hours?|hrs?|h)/i);
  const daysMatch = eta.match(/(\d+)\s*(?:days?|d)/i);
  
  let result = "";
  if (daysMatch) {
    result += `${daysMatch[1]} day${parseInt(daysMatch[1]) > 1 ? 's' : ''} `;
  }
  if (hoursMatch) {
    result += `${hoursMatch[1]} hr${parseInt(hoursMatch[1]) > 1 ? 's' : ''}`;
  }
  
  return result.trim() || eta;
};

export const CitizenReportCard = ({ report, isSelected, onSelect }: CitizenReportCardProps) => {
  const statusConfig = getStatusConfig(report.status);
  const timelineSteps = ["Submitted", "In Review", "In Progress", "Resolved"];
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const shareText = `Civic Issue: ${report.issue_category} — ${report.short_description}${report.location_data?.address ? ` at ${report.location_data.address}` : ""}. Status: ${report.status}`;
  const shareUrl = `${window.location.origin}/report/${report.id}`;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    setCopied(true);
    toast({ title: "Copied!", description: "Report details copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const handleShareFacebook = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleShareWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, "_blank");
  };

  const handleNativeShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title: report.issue_category, text: shareText, url: shareUrl });
      } catch { /* user cancelled */ }
    }
  };

  return (
    <Card 
      className={`overflow-hidden transition-all duration-300 border-2 cursor-pointer hover:shadow-lg ${
        isSelected ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'hover:border-primary/30'
      }`}
      onClick={() => onSelect?.(report)}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Category Icon */}
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              report.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
              report.severity === 'moderate' ? 'bg-warning/10 text-warning' :
              'bg-primary/10 text-primary'
            }`}>
              {getCategoryIcon(report.issue_category)}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-semibold text-foreground truncate">
                  {report.issue_category}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {report.short_description}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant={getSeverityColor(report.severity)}>
                  {report.severity}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied!" : "Copy to clipboard"}
                    </DropdownMenuItem>
                    {typeof navigator.share === "function" && (
                      <DropdownMenuItem onClick={handleNativeShare} className="gap-2 cursor-pointer">
                        <Share2 className="w-4 h-4" />
                        Share via...
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2 cursor-pointer">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.613.613l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.4 0-4.636-.817-6.407-2.19l-.147-.117-3.054 1.024 1.024-3.054-.117-.147A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                      WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleShareTwitter} className="gap-2 cursor-pointer">
                      <Twitter className="w-4 h-4" />
                      Twitter / X
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleShareFacebook} className="gap-2 cursor-pointer">
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Location & Date */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
              {report.location_data && 
                typeof report.location_data.lat === "number" && 
                typeof report.location_data.lng === "number" && 
                Number.isFinite(report.location_data.lat) && 
                Number.isFinite(report.location_data.lng) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const loc = report.location_data!;
                    const query = loc.address
                      ? encodeURIComponent(loc.address)
                      : `${loc.lat},${loc.lng}`;
                    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
                  }}
                  className="flex items-center gap-1 text-primary hover:underline transition-colors"
                >
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[150px]">Location Available</span>
                </button>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(report.created_at), "MMM dd, yyyy")}</span>
              </div>
            </div>

            {/* Status Pill & ETA */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <Badge className={statusConfig.color}>
                {statusConfig.label}
              </Badge>
              {report.status !== "resolved" && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="w-3 h-3" />
                  <span>ETA: {parseETA(report.estimated_resolution_time)}</span>
                </div>
              )}
            </div>

            {/* Auto-assignment routing badge — consistent wording across pages */}
            {(report.assigned_department_name || report.auto_assign_pending_confirmation) && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                {report.assigned_department_name ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                    <Building2 className="w-3 h-3" />
                    Routed to {report.assigned_department_name}
                    {typeof report.auto_assign_confidence === "number" && (
                      <span className="opacity-70 ml-1">({Math.round(report.auto_assign_confidence * 100)}%)</span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning/10 text-warning font-medium">
                    <Sparkles className="w-3 h-3" /> Awaiting routing review
                  </span>
                )}
              </div>
            )}

            {/* Progress Timeline */}
            <div className="space-y-2">
              <Progress value={statusConfig.progress} className="h-1.5" />
              <div className="flex justify-between">
                {timelineSteps.map((step, index) => {
                  const stepNumber = index + 1;
                  const isCompleted = stepNumber <= statusConfig.step;
                  const isCurrent = stepNumber === statusConfig.step;
                  
                  return (
                    <div key={step} className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center mb-1 ${
                        isCompleted 
                          ? 'bg-success text-success-foreground' 
                          : 'bg-muted text-muted-foreground'
                      } ${isCurrent ? 'ring-2 ring-success/30' : ''}`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Circle className="w-3 h-3" />
                        )}
                      </div>
                      <span className={`text-[10px] ${
                        isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Image Preview */}
          {report.image_url && (
            <div className="hidden sm:block flex-shrink-0">
              <StorageImage
                path={report.image_url}
                alt="Report"
                className="w-20 h-20 object-cover rounded-lg"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
