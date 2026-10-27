import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { languageOptions } from "@/lib/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-muted-foreground" />
      <Select value={language} onValueChange={setLanguage}>
        <SelectTrigger className="w-[140px] h-9 bg-background border-border/60">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px] bg-background border border-border shadow-xl z-50">
          {languageOptions.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.nativeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
