import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordRule {
  label: string;
  ok: boolean;
}

export const getPasswordRules = (pw: string): PasswordRule[] => [
  { label: "At least 8 characters", ok: pw.length >= 8 },
  { label: "One uppercase letter", ok: /[A-Z]/.test(pw) },
  { label: "One lowercase letter", ok: /[a-z]/.test(pw) },
  { label: "One number", ok: /\d/.test(pw) },
  { label: "One symbol", ok: /[^A-Za-z0-9]/.test(pw) },
];

export const getPasswordScore = (pw: string) =>
  getPasswordRules(pw).filter((r) => r.ok).length;

const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"];
const BARS = [
  "bg-destructive",
  "bg-destructive",
  "bg-[#FF9933]",
  "bg-[#FF9933]",
  "bg-[#046A38]",
  "bg-[#046A38]",
];

export const PasswordStrength = ({ password }: { password: string }) => {
  const rules = getPasswordRules(password);
  const score = rules.filter((r) => r.ok).length;
  if (!password) return null;

  return (
    <div className="space-y-2 pt-1" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1" role="presentation">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-full transition-colors duration-300",
                i < score ? BARS[score] : "bg-muted"
              )}
            />
          ))}
        </div>
        <span className="w-[70px] shrink-0 text-right text-[11px] font-medium text-muted-foreground">
          {LABELS[score]}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
        {rules.map((r) => (
          <li
            key={r.label}
            className={cn(
              "flex items-center gap-1.5 text-[11px]",
              r.ok ? "text-[#046A38]" : "text-muted-foreground"
            )}
          >
            {r.ok ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <X className="h-3 w-3 shrink-0 opacity-50" />
            )}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
