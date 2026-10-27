import { useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";

interface OtpInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  length?: number;
  disabled?: boolean;
}

export const OtpInput = ({ value, onChange, length = 6, disabled = false }: OtpInputProps) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return; // Only allow digits

    const newValue = [...value];
    newValue[index] = char;
    onChange(newValue);

    // Auto-focus next input
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!value[index] && index > 0) {
        // If current input is empty, go back and clear previous
        const newValue = [...value];
        newValue[index - 1] = "";
        onChange(newValue);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newValue = [...value];
        newValue[index] = "";
        onChange(newValue);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    
    if (pastedData) {
      const newValue = [...value];
      for (let i = 0; i < length; i++) {
        newValue[i] = pastedData[i] || "";
      }
      onChange(newValue);
      
      // Focus last filled input or last input
      const lastIndex = Math.min(pastedData.length, length) - 1;
      inputRefs.current[lastIndex]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`
            w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold
            border-2 rounded-lg transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-[#004687]/30
            ${value[index] 
              ? "border-[#046A38] bg-[#046A38]/5 text-[#004687]" 
              : "border-[#004687]/20 bg-white text-[#004687]"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-[#004687]/40"}
            focus:border-[#004687] focus:bg-white
          `}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
};
