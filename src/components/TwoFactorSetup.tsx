import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OtpInput } from "./OtpInput";
import { Shield, Lock, Copy, CheckCircle2, ArrowLeft, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TwoFactorSetupProps {
  email: string;
  phone?: string;
  onBack: () => void;
  onSuccess: () => void;
  onShowBackupCodes?: () => void;
}

export const TwoFactorSetup = ({ email, phone, onBack, onSuccess, onShowBackupCodes }: TwoFactorSetupProps) => {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const { toast } = useToast();

  // Mock secret key (in production, this would come from backend)
  const secretKey = "JBSWY3DPEHPK3PXP";
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/CivicPortal:${encodeURIComponent(email)}?secret=${secretKey}&issuer=CivicPortal`;

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secretKey);
    setSecretCopied(true);
    toast({
      title: "Secret Copied",
      description: "Secret key copied to clipboard",
    });
    setTimeout(() => setSecretCopied(false), 3000);
  };

  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    
    // Simulate verification (in production, verify with backend)
    setTimeout(() => {
      setIsVerifying(false);
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled successfully",
      });
      // Show backup codes if handler provided, otherwise call onSuccess
      if (onShowBackupCodes) {
        onShowBackupCodes();
      } else {
        onSuccess();
      }
    }, 1500);
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, "$1***$3");
  const maskedPhone = phone ? `+91 ${phone.slice(0, 2)}****${phone.slice(-2)}` : null;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="text-[#004687] hover:text-[#004687]/80"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Login
      </Button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main 2FA Setup Card */}
        <Card className="lg:col-span-2 backdrop-blur-xl bg-white/95 border border-white/40 shadow-2xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#046A38]" />
          
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-[#004687] to-[#004687]/80 flex items-center justify-center shadow-lg ring-4 ring-[#FF9933]/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-[#004687]">
              Set up 2-Step Verification
            </CardTitle>
            <CardDescription className="text-base">
              Add an extra layer of security to your account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* QR Code Section */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-[#004687]/70 mb-2">
                <Smartphone className="w-4 h-4" />
                <span>Scan with Google Authenticator or Authy</span>
              </div>
              
              <div className="inline-block p-4 bg-white rounded-xl border-2 border-[#004687]/10 shadow-lg">
                <img 
                  src={qrCodeUrl} 
                  alt="2FA QR Code" 
                  className="w-48 h-48 mx-auto"
                />
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <Label className="text-xs text-[#004687]/60">Or enter this secret key manually:</Label>
                <div className="flex items-center justify-center gap-2">
                  <code className="bg-[#004687]/5 px-4 py-2 rounded-lg font-mono text-sm text-[#004687] tracking-wider">
                    {secretKey}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopySecret}
                    className="text-[#FF9933] hover:text-[#FF9933]/80"
                  >
                    {secretCopied ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#004687]/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-[#004687]/50">Enter verification code</span>
              </div>
            </div>

            {/* OTP Input */}
            <div className="space-y-4">
              <Label className="text-[#004687] font-medium text-center block">
                Enter 6-digit code from your app
              </Label>
              <OtpInput value={otp} onChange={setOtp} disabled={isVerifying} />
            </div>

            {/* Enable Button */}
            <Button
              onClick={handleVerify}
              disabled={isVerifying || otp.join("").length !== 6}
              className="w-full bg-gradient-to-r from-[#046A38] to-[#046A38]/90 text-white shadow-lg h-12"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Enable 2FA
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Summary Side Panel */}
        <Card className="backdrop-blur-xl bg-white/95 border border-white/40 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-[#004687]">Account Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-[#004687]/60">Email</Label>
              <p className="text-sm font-medium text-[#004687]">{maskedEmail}</p>
            </div>
            
            {maskedPhone && (
              <div className="space-y-2">
                <Label className="text-xs text-[#004687]/60">Phone</Label>
                <p className="text-sm font-medium text-[#004687]">{maskedPhone}</p>
              </div>
            )}

            <div className="pt-4 border-t border-[#004687]/10">
              <div className="flex items-start gap-3 p-3 bg-[#046A38]/5 rounded-lg">
                <Shield className="w-5 h-5 text-[#046A38] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#046A38]">Enhanced Security</p>
                  <p className="text-xs text-[#004687]/70 mt-1">
                    2FA protects your account even if your password is compromised
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#FF9933]/5 rounded-lg">
              <Lock className="w-5 h-5 text-[#FF9933] mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#FF9933]">Backup Codes</p>
                <p className="text-xs text-[#004687]/70 mt-1">
                  Save backup codes after enabling 2FA for account recovery
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
