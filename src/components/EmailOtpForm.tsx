import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "./OtpInput";
import { Loader2, ArrowLeft, Mail, CheckCircle2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EmailOtpFormProps {
  onBack: () => void;
  onSuccess: () => void;
  initialEmail?: string;
}

export const EmailOtpForm = ({ onBack, onSuccess, initialEmail = "" }: EmailOtpFormProps) => {
  const [step, setStep] = useState<"email" | "otp" | "success">("email");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const { toast } = useToast();

  const withRetry = async <T,>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> => {
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        const msg = err?.message || "";
        if ((msg === "Failed to fetch" || msg.includes("NetworkError")) && i < retries) {
          await new Promise(r => setTimeout(r, delay * (i + 1)));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Unable to connect. Please check your internet and try again.");
  };

  const getFriendlyError = (error: any): string => {
    const msg = error?.message || String(error);
    if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
      return "Unable to connect to the server. Please check your internet connection.";
    }
    return msg;
  };

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await withRetry(() =>
        supabase.auth.signInWithOtp({
          email: email,
          options: { shouldCreateUser: true },
        })
      );

      if (error) throw error;

      setStep("otp");
      setResendCountdown(30);
      
      toast({
        title: "OTP Sent!",
        description: "Check your email for the verification code.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: getFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    
    if (otpString.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the complete 6-digit OTP.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await withRetry(() =>
        supabase.auth.verifyOtp({
          email: email,
          token: otpString,
          type: "email",
        })
      );

      if (error) throw error;

      if (data.user) {
        setStep("success");
        toast({
          title: "Email Verified!",
          description: "Your email has been verified successfully.",
        });
        
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: getFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await withRetry(() =>
        supabase.auth.signInWithOtp({
          email: email,
          options: { shouldCreateUser: true },
        })
      );

      if (error) throw error;

      setResendCountdown(30);
      setOtp(Array(6).fill(""));
      
      toast({
        title: "OTP Resent",
        description: "A new verification code has been sent to your email.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: getFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const maskedEmail = email ? email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : "";

  if (step === "success") {
    return (
      <div className="text-center py-8 animate-in fade-in duration-500">
        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#046A38] to-[#046A38]/80 flex items-center justify-center mb-6 shadow-lg shadow-[#046A38]/30">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-xl font-bold text-[#004687] mb-2">Email Verified!</h3>
        <p className="text-[#004687]/70 mb-4">You have been signed in successfully.</p>
        <p className="text-sm text-[#004687]/50">Redirecting...</p>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <button
          type="button"
          onClick={() => setStep("email")}
          className="flex items-center text-sm text-[#004687]/70 hover:text-[#004687] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>

        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#046A38] to-[#046A38]/80 flex items-center justify-center mb-4 shadow-lg">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-[#004687] mb-2">Verify Your Email</h3>
          <p className="text-sm text-[#004687]/70">
            We've sent a 6-digit code to<br />
            <strong>{maskedEmail}</strong>
          </p>
        </div>

        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <div className="space-y-3">
            <Label className="text-[#004687] font-medium text-center block">Enter OTP</Label>
            <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-[#046A38] to-[#046A38]/90 hover:from-[#046A38]/90 hover:to-[#046A38] text-white shadow-lg shadow-[#046A38]/20"
            disabled={isLoading || otp.join("").length !== 6}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Verify OTP
              </>
            )}
          </Button>

          <div className="text-center">
            {resendCountdown > 0 ? (
              <p className="text-sm text-[#004687]/50">
                Resend OTP in <span className="font-semibold text-[#FF9933]">{resendCountdown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isLoading}
                className="text-sm text-[#FF9933] hover:text-[#FF9933]/80 hover:underline transition-colors disabled:opacity-50"
              >
                Resend OTP
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center text-sm text-[#004687]/70 hover:text-[#004687] transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to login options
      </button>

      <div className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#004687] to-[#004687]/80 flex items-center justify-center mb-4 shadow-lg ring-4 ring-[#FF9933]/20">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-[#004687] mb-1">Sign In with Email</h3>
        <p className="text-sm text-[#004687]/70">We'll send you a verification code</p>
      </div>

      <form onSubmit={handleSendOtp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email-otp" className="text-[#004687] font-medium">Email Address</Label>
          <Input
            id="email-otp"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white border-[#004687]/20 focus:border-[#004687] focus:ring-[#004687]/20"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-[#FF9933] to-[#FF9933]/90 hover:from-[#FF9933]/90 hover:to-[#FF9933] text-white shadow-lg shadow-[#FF9933]/20"
          disabled={isLoading || !email}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending OTP...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send OTP
            </>
          )}
        </Button>
      </form>
    </div>
  );
};
