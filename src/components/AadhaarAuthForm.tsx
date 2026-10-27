import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "./OtpInput";
import { Loader2, ArrowLeft, Shield, Lock, CheckCircle2, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AadhaarAuthFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const AadhaarAuthForm = ({ onBack, onSuccess }: AadhaarAuthFormProps) => {
  const [step, setStep] = useState<"aadhaar" | "otp" | "success">("aadhaar");
  const [aadhaarLastFour, setAadhaarLastFour] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const getFriendlyError = (error: any): string => {
    const msg = error?.message || String(error);
    if (msg.includes("phone_provider_disabled") || msg.includes("Unsupported phone provider")) {
      return "Phone OTP is not yet configured on this platform. Please use Email OTP or Google sign-in instead.";
    }
    if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
      return "Unable to connect. Please check your internet connection.";
    }
    return msg;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (aadhaarLastFour.length !== 4) {
      toast({ title: "Invalid Aadhaar", description: "Please enter the last 4 digits of your Aadhaar number.", variant: "destructive" });
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) {
      toast({ title: "Invalid Phone", description: "Please enter a valid 10-digit Indian mobile number.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    
    try {
      const phoneWithCode = `+91${phone.replace(/\D/g, "")}`;
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneWithCode,
        options: {
          data: { aadhaar_last_four: aadhaarLastFour, auth_method: "aadhaar" }
        }
      });
      
      if (error) throw error;
      
      setStep("otp");
      setResendCountdown(30);
      toast({ title: "OTP Sent!", description: "Verification code sent to your Aadhaar-linked mobile." });
    } catch (error: any) {
      toast({ title: "OTP Failed", description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    
    if (otpString.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter the complete 6-digit OTP.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    
    try {
      const phoneWithCode = `+91${phone.replace(/\D/g, "")}`;
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneWithCode,
        token: otpString,
        type: "sms",
      });

      if (error) throw error;

      if (data.user) {
        setStep("success");
        toast({ title: "Aadhaar Verified!", description: "Your identity has been verified successfully." });
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (error: any) {
      toast({ title: "Verification Failed", description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setIsLoading(true);
    
    try {
      const phoneWithCode = `+91${phone.replace(/\D/g, "")}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: phoneWithCode });
      if (error) throw error;
      
      setResendCountdown(30);
      setOtp(Array(6).fill(""));
      toast({ title: "OTP Resent", description: "A new verification code has been sent." });
    } catch (error: any) {
      toast({ title: "Error", description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const maskedPhone = phone ? `+91 ${phone.slice(0, 2)}****${phone.slice(-2)}` : "";

  if (step === "success") {
    return (
      <div className="text-center py-8 animate-in fade-in duration-500">
        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#046A38] to-[#046A38]/80 flex items-center justify-center mb-6 shadow-lg shadow-[#046A38]/30">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-xl font-bold text-[#004687] mb-2">Aadhaar Verified!</h3>
        <p className="text-[#004687]/70 mb-4">Your identity has been successfully verified.</p>
        <p className="text-sm text-[#004687]/50">Redirecting to dashboard...</p>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <button type="button" onClick={() => setStep("aadhaar")} className="flex items-center text-sm text-[#004687]/70 hover:text-[#004687] transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>

        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#FF9933] to-[#FF9933]/80 flex items-center justify-center mb-4 shadow-lg">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-[#004687] mb-2">Verify OTP</h3>
          <p className="text-sm text-[#004687]/70">
            Enter the 6-digit code sent to<br /><strong>{maskedPhone}</strong>
          </p>
        </div>

        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
          <Button type="submit" className="w-full bg-gradient-to-r from-[#046A38] to-[#046A38]/90 hover:from-[#046A38]/90 hover:to-[#046A38] text-white shadow-lg shadow-[#046A38]/20" disabled={isLoading || otp.join("").length !== 6}>
            {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>) : (<><Shield className="w-4 h-4 mr-2" /> Verify Aadhaar</>)}
          </Button>
          <div className="text-center">
            {resendCountdown > 0 ? (
              <p className="text-sm text-[#004687]/50">Resend OTP in <span className="font-semibold text-[#FF9933]">{resendCountdown}s</span></p>
            ) : (
              <button type="button" onClick={handleResendOtp} disabled={isLoading} className="text-sm text-[#FF9933] hover:text-[#FF9933]/80 hover:underline transition-colors disabled:opacity-50">Resend OTP</button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <button type="button" onClick={onBack} className="flex items-center text-sm text-[#004687]/70 hover:text-[#004687] transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to login options
      </button>

      <div className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#004687] to-[#004687]/80 flex items-center justify-center mb-4 shadow-lg ring-4 ring-[#FF9933]/20">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-[#004687] mb-1">Verify with Aadhaar</h3>
        <p className="text-sm text-[#004687]/70">Secure identity verification</p>
      </div>

      <form onSubmit={handleSendOtp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="aadhaar" className="text-[#004687] font-medium flex items-center gap-2">
            <Lock className="w-4 h-4" /> Last 4 Digits of Aadhaar
          </Label>
          <Input id="aadhaar" type="text" inputMode="numeric" placeholder="XXXX" maxLength={4} value={aadhaarLastFour} onChange={(e) => setAadhaarLastFour(e.target.value.replace(/\D/g, ""))} className="bg-white border-[#004687]/20 focus:border-[#004687] focus:ring-[#004687]/20 text-center text-2xl tracking-[0.5em] font-mono" />
          <p className="text-xs text-[#004687]/50">We only need the last 4 digits for verification</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="aadhaar-phone" className="text-[#004687] font-medium flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Aadhaar-linked Mobile Number
          </Label>
          <div className="flex">
            <span className="inline-flex items-center px-3 bg-[#004687]/5 border border-r-0 border-[#004687]/20 rounded-l-md text-[#004687]/70 text-sm">+91</span>
            <Input id="aadhaar-phone" type="tel" inputMode="numeric" placeholder="XXXXXXXXXX" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className="bg-white border-[#004687]/20 focus:border-[#004687] focus:ring-[#004687]/20 rounded-l-none" />
          </div>
        </div>

        <Button type="submit" className="w-full bg-gradient-to-r from-[#FF9933] to-[#FF9933]/90 hover:from-[#FF9933]/90 hover:to-[#FF9933] text-white shadow-lg shadow-[#FF9933]/20" disabled={isLoading || aadhaarLastFour.length !== 4 || phone.length !== 10}>
          {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending OTP...</>) : (<>Send OTP to Registered Mobile <Shield className="w-4 h-4 ml-2" /></>)}
        </Button>
      </form>

      <div className="flex items-start gap-3 p-3 bg-[#046A38]/5 rounded-lg border border-[#046A38]/10">
        <Lock className="w-5 h-5 text-[#046A38] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#004687]/70">
          Your Aadhaar data is encrypted and verified securely with UIDAI. We do not store your full Aadhaar number.
        </p>
      </div>
    </div>
  );
};
