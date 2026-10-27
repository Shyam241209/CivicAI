import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

interface AppFooterProps {
  /** Use "dark" for dark-themed pages like admin auth */
  variant?: "default" | "dark";
  className?: string;
}

export const AppFooter = ({ variant = "default", className }: AppFooterProps) => {
  const { t } = useTranslation();

  const isDark = variant === "dark";

  return (
    <footer
      className={cn(
        "py-4 px-6 text-center space-y-1.5",
        isDark ? "" : "border-t border-border/30 bg-background/50",
        className
      )}
    >
      <p className={cn("text-xs", isDark ? "text-white/60" : "text-muted-foreground")}>
        © {new Date().getFullYear()} CivicAI — Government Civic Management Platform
      </p>
      <div
        className={cn(
          "flex items-center justify-center gap-3 text-xs",
          isDark ? "text-white/50" : "text-muted-foreground/60"
        )}
      >
        <Link
          to="/privacy"
          className={cn(
            "transition-colors",
            isDark ? "hover:text-white/80" : "hover:text-foreground"
          )}
        >
          {t("privacyPolicy")}
        </Link>
        <span className={cn("w-px h-3", isDark ? "bg-white/15" : "bg-border")} />
        <Link
          to="/terms"
          className={cn(
            "transition-colors",
            isDark ? "hover:text-white/80" : "hover:text-foreground"
          )}
        >
          {t("termsOfService")}
        </Link>
        <span className={cn("w-px h-3", isDark ? "bg-white/15" : "bg-border")} />
        <Link
          to="/help"
          className={cn(
            "transition-colors",
            isDark ? "hover:text-white/80" : "hover:text-foreground"
          )}
        >
          {t("helpLink")}
        </Link>
        <span className={cn("w-px h-3", isDark ? "bg-white/15" : "bg-border")} />
        <Link
          to="/settings"
          className={cn(
            "transition-colors",
            isDark ? "hover:text-white/80" : "hover:text-foreground"
          )}
        >
          Settings
        </Link>
      </div>
    </footer>
  );
};
