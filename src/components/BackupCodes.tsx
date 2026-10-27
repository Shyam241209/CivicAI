import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Download, Copy, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BackupCodesProps {
  onContinue: () => void;
}

export const BackupCodes = ({ onContinue }: BackupCodesProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Generate mock backup codes (in production, these come from backend)
  const backupCodes = [
    "A1B2-C3D4-E5F6",
    "G7H8-I9J0-K1L2",
    "M3N4-O5P6-Q7R8",
    "S9T0-U1V2-W3X4",
    "Y5Z6-A7B8-C9D0",
    "E1F2-G3H4-I5J6",
    "K7L8-M9N0-O1P2",
    "Q3R4-S5T6-U7V8",
  ];

  const handleCopy = () => {
    const codesText = backupCodes.join("\n");
    navigator.clipboard.writeText(codesText);
    setCopied(true);
    toast({
      title: "Codes Copied",
      description: "Backup codes copied to clipboard",
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const codesText = `Civic Portal - 2FA Backup Codes
================================
Generated: ${new Date().toLocaleString()}

IMPORTANT: Store these codes in a safe place.
Each code can only be used once.

${backupCodes.map((code, i) => `${i + 1}. ${code}`).join("\n")}

================================
Do not share these codes with anyone.
`;
    
    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "civic-portal-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Codes Downloaded",
      description: "Backup codes saved as text file",
    });
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <Card className="backdrop-blur-xl bg-white/95 border border-white/40 shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#046A38]" />
        
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-[#046A38] to-[#046A38]/80 flex items-center justify-center shadow-lg ring-4 ring-[#FF9933]/20">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#046A38]">
            Two-Factor Authentication Enabled
          </CardTitle>
          <CardDescription className="text-base">
            Your account is now protected with 2FA
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-[#FF9933]/10 rounded-lg border border-[#FF9933]/20">
            <AlertTriangle className="w-5 h-5 text-[#FF9933] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#FF9933]">Store These Codes Safely</p>
              <p className="text-xs text-[#004687]/70 mt-1">
                Each backup code can be used once if you lose access to your authenticator app. 
                Keep them in a secure location.
              </p>
            </div>
          </div>

          {/* Backup Codes Box */}
          <div className="border-2 border-[#004687]/20 rounded-lg p-4 bg-[#004687]/5">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="font-mono text-sm text-[#004687] bg-white px-3 py-2 rounded border border-[#004687]/10 text-center"
                >
                  {code}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1 border-[#004687]/20 text-[#004687] hover:bg-[#004687]/5"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button
              onClick={handleCopy}
              variant="outline"
              className="flex-1 border-[#FF9933]/30 text-[#FF9933] hover:bg-[#FF9933]/5"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {/* Continue Button */}
          <Button
            onClick={onContinue}
            className="w-full bg-gradient-to-r from-[#046A38] to-[#046A38]/90 text-white shadow-lg h-12"
          >
            <Lock className="w-4 h-4 mr-2" />
            Continue to Portal
          </Button>

          {/* Security Note */}
          <div className="flex items-center justify-center gap-2 text-xs text-[#004687]/60 pt-2 border-t border-[#004687]/10">
            <Shield className="w-4 h-4 text-[#046A38]" />
            <span>Your account is now fully secured</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
