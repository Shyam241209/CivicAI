import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Fingerprint, Shield, Loader2, ArrowLeft, Smartphone, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BiometricLoginProps {
  onBack: () => void;
  onSuccess: () => void;
  onFallback: () => void;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const raw = atob(base64 + pad);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export const BiometricLogin = ({ onBack, onSuccess, onFallback }: BiometricLoginProps) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  // If user is already logged in, show register mode
  useEffect(() => {
    if (user) setMode("register");
  }, [user]);

  const handleRegister = async () => {
    if (!user) {
      toast({ title: "Sign in first", description: "You must be signed in to register biometrics.", variant: "destructive" });
      return;
    }

    if (!window.PublicKeyCredential) {
      toast({ title: "Not Supported", description: "WebAuthn is not supported on this browser.", variant: "destructive" });
      return;
    }

    setIsRegistering(true);
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        toast({ title: "Not Available", description: "Biometric authenticator not available on this device.", variant: "destructive" });
        return;
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(user.id);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "CivicAI", id: window.location.hostname },
          user: {
            id: userId,
            name: user.email || "CivicAI User",
            displayName: user.email || "CivicAI User",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },   // ES256
            { alg: -257, type: "public-key" },  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
          attestation: "none",
        },
      }) as PublicKeyCredential;

      if (!credential) throw new Error("Credential creation cancelled");

      const response = credential.response as AuthenticatorAttestationResponse;
      const credentialId = bufferToBase64url(credential.rawId);
      const publicKey = bufferToBase64url(response.getPublicKey?.() || response.attestationObject);

      // Store credential in database
      const { error } = await supabase.from("webauthn_credentials").insert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKey,
        device_name: navigator.userAgent.includes("iPhone") ? "iPhone" :
                     navigator.userAgent.includes("Android") ? "Android" :
                     navigator.userAgent.includes("Mac") ? "Mac" : "Device",
      });

      if (error) throw error;

      toast({ title: "Biometrics Registered!", description: "You can now sign in with Face ID / Touch ID." });
    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        toast({ title: "Registration Failed", description: err.message || "Could not register biometrics.", variant: "destructive" });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!window.PublicKeyCredential) {
      toast({ title: "Not Supported", description: "WebAuthn is not supported on this browser.", variant: "destructive" });
      return;
    }

    setIsAuthenticating(true);
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        toast({ title: "Not Available", description: "Biometric authentication not available on this device.", variant: "destructive" });
        return;
      }

      // Get challenge from edge function
      const { data: challengeData, error: challengeError } = await supabase.functions.invoke("webauthn-authenticate", {
        body: { action: "get-challenge", email },
      });

      if (challengeError) throw challengeError;

      const allowCredentials = (challengeData.allowCredentials || []).map((id: string) => ({
        id: base64urlToBuffer(id),
        type: "public-key" as const,
      }));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: base64urlToBuffer(challengeData.challenge),
          rpId: window.location.hostname,
          userVerification: "required",
          timeout: 60000,
          ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
        },
      }) as PublicKeyCredential;

      if (!assertion) throw new Error("Authentication cancelled");

      const credentialId = bufferToBase64url(assertion.rawId);

      // Verify with edge function
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("webauthn-authenticate", {
        body: { action: "verify", credentialId },
      });

      if (verifyError) throw verifyError;
      if (!verifyData?.success) throw new Error(verifyData?.error || "Verification failed");

      // Use the token to sign in
      if (verifyData.token_hash && verifyData.email) {
        const { error: signInError } = await supabase.auth.verifyOtp({
          email: verifyData.email,
          token_hash: verifyData.token_hash,
          type: "magiclink",
        });
        if (signInError) throw signInError;
      }

      toast({ title: "Authentication Successful", description: "Signed in with biometrics." });
      onSuccess();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast({ title: "Cancelled", description: "Biometric authentication was cancelled.", variant: "destructive" });
      } else {
        toast({ title: "Authentication Failed", description: err.message || "Please try again or use another method.", variant: "destructive" });
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="text-primary hover:text-primary/80">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <Card className="backdrop-blur-xl bg-card/95 border border-border shadow-2xl max-w-md mx-auto">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#046A38]" />

        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-6 w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl ring-4 ring-primary/20">
            <Fingerprint className="w-12 h-12 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            {mode === "register" ? "Register Biometrics" : "Login with Biometrics"}
          </CardTitle>
          <CardDescription className="text-base">
            {mode === "register"
              ? "Register your Face ID or Touch ID for future instant access"
              : "Use Face ID or Touch ID for secure, instant access"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-2 text-sm text-accent bg-accent/5 py-2 px-4 rounded-full mx-auto w-fit">
            <Smartphone className="w-4 h-4" />
            <span>Biometric login on this device</span>
          </div>

          {mode === "login" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="bio-email">Email (optional, for faster lookup)</Label>
                <Input
                  id="bio-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                onClick={handleBiometricLogin}
                disabled={isAuthenticating}
                className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl h-14 text-lg hover:scale-[1.02] transition-transform"
              >
                {isAuthenticating ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Authenticating...</>
                ) : (
                  <><Fingerprint className="w-5 h-5 mr-2" />Login with Face ID / Touch ID</>
                )}
              </Button>
            </div>
          )}

          {mode === "register" && (
            <Button
              onClick={handleRegister}
              disabled={isRegistering}
              className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl h-14 text-lg hover:scale-[1.02] transition-transform"
            >
              {isRegistering ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Registering...</>
              ) : (
                <><Plus className="w-5 h-5 mr-2" />Register Face ID / Touch ID</>
              )}
            </Button>
          )}

          {/* Toggle mode */}
          <div className="text-center space-y-2">
            {mode === "login" ? (
              <button onClick={() => setMode("register")} className="text-sm text-primary hover:underline">
                Register biometrics on this device
              </button>
            ) : (
              <button onClick={() => setMode("login")} className="text-sm text-primary hover:underline">
                Already registered? Login with biometrics
              </button>
            )}
            <div>
              <button onClick={onFallback} className="text-sm text-muted-foreground hover:underline">
                Use password or OTP instead
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 border-t border-border">
            <Shield className="w-4 h-4 text-accent" />
            <span>Powered by secure WebAuthn standard</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
