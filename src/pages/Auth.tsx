import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeft, Shield, Mail, ArrowRight, Phone, Fingerprint,
  Lock, Eye, EyeOff, Key, ChevronRight, CheckCircle2, Cpu, Route, Radio, Users,
  User as UserIcon, AlertTriangle, BadgeCheck, ShieldCheck
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LanguageSelector } from "@/components/LanguageSelector";
import { EmailOtpForm } from "@/components/EmailOtpForm";
import { AadhaarAuthForm } from "@/components/AadhaarAuthForm";
import { OtpInput } from "@/components/OtpInput";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { BiometricLogin } from "@/components/BiometricLogin";
import { BackupCodes } from "@/components/BackupCodes";
import { useTranslation } from "@/hooks/use-translation";
import { AppFooter } from "@/components/AppFooter";
import { AuthBackground } from "@/components/AuthBackground";
import { PasswordStrength, getPasswordScore } from "@/components/PasswordStrength";
import { destinationForRole, type AuthRole } from "@/lib/authRouting";

type AuthView = "main" | "email-otp" | "aadhaar" | "2fa-setup" | "biometric" | "backup-codes";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [otpSent, setOtpSent] = useState(false);
  const [role] = useState<"user" | "admin">("user");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("main");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role: userRole, loading } = useAuth();
  const { t } = useTranslation();

  const redirectFrom = (location.state as { from?: { pathname?: string } })?.from?.pathname;

  useEffect(() => {
    if (!loading && user && userRole) {
      const destination = destinationForRole(userRole, redirectFrom);
      navigate(destination, { replace: true });
    }
  }, [user, userRole, loading, navigate, redirectFrom]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  useEffect(() => {
    const checkBiometric = async () => {
      if (window.PublicKeyCredential) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setBiometricAvailable(available);
        } catch {
          setBiometricAvailable(false);
        }
      }
    };
    checkBiometric();
  }, []);

  const getFriendlyError = (error: any): string => {
    if (!error) return "An unknown error occurred.";
    const msg = error.message || String(error);
    if (msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("network"))
      return "Unable to connect to the server. Please check your internet connection and try again.";
    if (msg.includes("Invalid login credentials"))
      return "Invalid email or password. Please check your credentials and try again.";
    if (msg.includes("Email not confirmed"))
      return "Please verify your email address before signing in. Check your inbox for a confirmation link.";
    if (msg.includes("User already registered"))
      return "An account with this email already exists. Please sign in instead.";
    if (msg.includes("Password should be at least"))
      return "Password must be at least 6 characters long.";
    if (msg.includes("rate limit") || msg.includes("429"))
      return "Too many attempts. Please wait a moment and try again.";
    if (msg.includes("phone_provider_disabled") || msg.includes("Unsupported phone provider"))
      return "Phone OTP is not yet configured. Please use Email OTP or Google sign-in instead.";
    return msg;
  };

  const withRetry = async <T,>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> => {
    for (let i = 0; i <= retries; i++) {
      try { return await fn(); }
      catch (err: any) {
        const msg = err?.message || "";
        const isNetworkError = msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("network");
        if (isNetworkError && i < retries) {
          await new Promise(r => setTimeout(r, delay * (i + 1)));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Unable to connect to the server. Please try again.");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Weak password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Please re-enter the same password in both fields.", variant: "destructive" });
      return;
    }
    if (!acceptedTerms) {
      toast({ title: "Consent required", description: "Please accept the Terms of Service and Privacy Policy.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await withRetry(() =>
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { role, full_name: fullName.trim(), phone: phone ? `+91${phone.replace(/\D/g, "")}` : null },
          },
        })
      );
      if (error) throw error;
      toast({ title: "Account Created!", description: "Please check your email to verify your account before signing in." });
    } catch (error: any) {
      toast({ title: "Sign Up Failed", description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Please enter both email and password.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await withRetry(() =>
        supabase.auth.signInWithPassword({ email, password })
      );
      if (error) throw error;
      const { data: roleValue, error: roleError } = await supabase.rpc("get_user_role", { _user_id: data.user.id });
      if (roleError) throw roleError;
      toast({ title: "Welcome back!", description: "Successfully signed in." });
      const destination = destinationForRole(roleValue as AuthRole, redirectFrom);
      navigate(destination, { replace: true });
    } catch (error: any) {
      toast({ title: "Sign In Failed", description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Google Sign In Failed", description: getFriendlyError(error), variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast({ title: "Invalid phone number", description: "Please enter a valid 10-digit phone number.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const phoneWithCode = phone.startsWith("+") ? phone : `+91${cleanPhone}`;
      const { error } = await withRetry(() => supabase.auth.signInWithOtp({ phone: phoneWithCode }));
      if (error) throw error;
      setOtpSent(true);
      setResendCountdown(30);
      toast({ title: "OTP Sent!", description: "Check your phone for the verification code." });
    } catch (error: any) {
      toast({ title: "OTP Failed", description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter a valid 6-digit OTP.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const phoneWithCode = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;
      const { data, error } = await withRetry(() =>
        supabase.auth.verifyOtp({ phone: phoneWithCode, token: otpString, type: "sms" })
      );
      if (error) throw error;
      if (data.user) {
        const { data: roleValue, error: roleError } = await supabase.rpc("get_user_role", { _user_id: data.user.id });
        if (roleError) throw roleError;
        toast({ title: "Welcome!", description: "Successfully signed in with phone." });
        const destination = destinationForRole(roleValue as AuthRole, redirectFrom);
        navigate(destination, { replace: true });
      }
    } catch (error: any) {
      toast({ title: "Verification Failed", description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await withRetry(() =>
        supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      );
      if (error) throw error;
      setResetEmailSent(true);
      toast({ title: "Reset email sent!", description: "Check your inbox for password reset instructions." });
    } catch (error: any) {
      toast({ title: "Reset Failed", description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    // AuthProvider resolves the Supabase role before the redirect effect runs.
  };

  // Sub-views
  if (authView === "email-otp") {
    return <AuthLayout><div className="w-full max-w-md"><EmailOtpForm onBack={() => setAuthView("main")} onSuccess={handleAuthSuccess} /></div></AuthLayout>;
  }
  if (authView === "aadhaar") {
    return <AuthLayout><div className="w-full max-w-md"><AadhaarAuthForm onBack={() => setAuthView("main")} onSuccess={handleAuthSuccess} /></div></AuthLayout>;
  }
  if (authView === "2fa-setup") {
    return <AuthLayout><div className="w-full max-w-md"><TwoFactorSetup email={email || "user@example.com"} phone={phone} onBack={() => setAuthView("main")} onSuccess={handleAuthSuccess} onShowBackupCodes={() => setAuthView("backup-codes")} /></div></AuthLayout>;
  }
  if (authView === "backup-codes") {
    return <AuthLayout><div className="w-full max-w-md"><BackupCodes onContinue={handleAuthSuccess} /></div></AuthLayout>;
  }
  if (authView === "biometric") {
    return <AuthLayout><div className="w-full max-w-md"><BiometricLogin onBack={() => setAuthView("main")} onSuccess={handleAuthSuccess} onFallback={() => setAuthView("main")} /></div></AuthLayout>;
  }

  const features = [
    { icon: <Cpu className="w-5 h-5" />, title: t("aiPoweredTitle"), desc: t("aiPoweredDesc") },
    { icon: <Route className="w-5 h-5" />, title: t("fastResolutionTitle"), desc: t("fastResolutionDesc") },
    { icon: <Radio className="w-5 h-5" />, title: t("realTimeTrackingTitle"), desc: t("realTimeTrackingDesc") },
    { icon: <Users className="w-5 h-5" />, title: t("communityFirstTitle"), desc: t("communityFirstDesc") },
  ];

  // Main view
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AuthBackground />

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ─── LEFT PANEL (40%) ─── */}
        <motion.aside
          className="relative hidden shrink-0 flex-col justify-between overflow-hidden p-8 xl:p-12 lg:flex lg:w-[38%] xl:w-[40%]"
          style={{
            background:
              "linear-gradient(160deg, hsl(217 91% 22%) 0%, hsl(217 91% 34%) 45%, hsl(217 91% 48%) 100%)",
          }}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* decorative */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <motion.div
            className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/5 blur-3xl"
            animate={{ y: [0, 24, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/5 blur-3xl"
            animate={{ y: [0, -24, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative z-10">
            {/* Brand */}
            <motion.div
              className="mb-10 flex items-start justify-between"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg shadow-black/10 backdrop-blur-sm">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="block text-xl font-bold tracking-tight text-white">CivicAI</span>
                  <span className="text-xs tracking-wide text-white/50">Government Portal</span>
                </div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-1 backdrop-blur-xl">
                <LanguageSelector />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-9"
            >
              <h1 className="mb-3 text-3xl font-bold leading-tight text-white xl:text-[2.15rem]">
                Welcome to CivicAI
              </h1>
              <p className="max-w-[360px] text-sm leading-relaxed text-white/60">
                AI-Powered Civic Issue Reporting Platform — report, track and resolve
                community issues with your local government.
              </p>
            </motion.div>

            {/* Feature cards */}
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  className="group rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.11]"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.09 }}
                >
                  <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                    <span className="text-white/85">{feature.icon}</span>
                  </div>
                  <h3 className="mb-0.5 text-sm font-semibold text-white">{feature.title}</h3>
                  <p className="text-[11px] leading-relaxed text-white/50">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Trust strip */}
          <motion.div
            className="relative z-10 mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/55">
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> 256-bit encrypted</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" /> Aadhaar-ready</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Privacy first</span>
            </div>

            <div className="mx-1 mt-5 flex h-0.5 gap-0.5 overflow-hidden rounded-full">
              <motion.div className="flex-1 rounded-full" style={{ background: "#FF9933" }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.0, duration: 0.5 }} />
              <motion.div className="flex-1 rounded-full bg-white/60" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.15, duration: 0.5 }} />
              <motion.div className="flex-1 rounded-full" style={{ background: "#046A38" }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.3, duration: 0.5 }} />
            </div>
            <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.25em] text-white/25">
              Digital India · Smart Cities · Jan Seva
            </p>
          </motion.div>
        </motion.aside>

        {/* ─── RIGHT PANEL (60%) ─── */}
        <div className="flex flex-1 flex-col">
          {/* Mobile / tablet header */}
          <div className="relative bg-primary px-6 py-8 text-center lg:hidden">
            <div className="absolute right-4 top-4">
              <div className="rounded-xl border border-white/15 bg-white/10 p-1 backdrop-blur-xl">
                <LanguageSelector />
              </div>
            </div>
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">CivicAI Portal</h1>
            <p className="mt-1 text-sm text-white/60">AI-Powered Civic Issue Reporting</p>
          </div>

          {/* Form area */}
          <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:py-10">
            <motion.div
              className="w-full max-w-[480px]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <Card className="overflow-hidden rounded-2xl border border-border/50 bg-card/90 shadow-xl shadow-black/5 backdrop-blur-xl">
                {/* Tricolor accent */}
                <div className="flex h-1 w-full">
                  <div className="flex-1 bg-[#FF9933]" />
                  <div className="flex-1 bg-white" />
                  <div className="flex-1 bg-[#046A38]" />
                </div>

                <CardContent className="p-6 sm:p-8">
                  {/* Card header */}
                  <motion.div
                    className="mb-6 hidden flex-col lg:flex"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-gradient-to-br from-primary/15 to-primary/5">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-bold leading-snug tracking-tight text-foreground">
                            {showForgotPassword ? t("resetPasswordTitle") : t("login")}
                          </h2>
                          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                            {showForgotPassword ? t("resetPasswordDesc") : t("signInDesc")}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" asChild size="sm" className="-mt-0.5 ml-3 shrink-0 text-muted-foreground hover:text-foreground">
                        <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />{t("backToHome")}</Link>
                      </Button>
                    </div>
                    <div className="mt-4 h-px w-full bg-gradient-to-r from-primary/20 via-border/40 to-transparent" />
                  </motion.div>

                  {showForgotPassword ? (
                    <ForgotPasswordForm
                      email={email} setEmail={setEmail} isLoading={isLoading}
                      resetEmailSent={resetEmailSent} onSubmit={handleForgotPassword}
                      onBack={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
                      t={t}
                    />
                  ) : (
                    <Tabs defaultValue="signin" className="w-full">
                      <TabsList className="mb-6 grid h-11 w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
                        <TabsTrigger value="signin" className="rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                          {t("login")}
                        </TabsTrigger>
                        <TabsTrigger value="signup" className="rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                          {t("signUp")}
                        </TabsTrigger>
                      </TabsList>

                      {/* ─── SIGN IN ─── */}
                      <TabsContent value="signin" className="mt-0 space-y-5">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}>
                          <Button
                            variant="outline"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="h-12 w-full justify-center gap-3 rounded-xl border-border/60 text-sm font-medium transition-all hover:scale-[1.01] hover:border-border hover:bg-muted/40 active:scale-[0.99]"
                          >
                            <GoogleIcon />
                            <span>{t("authGoogle")}</span>
                          </Button>
                        </motion.div>

                        {/* Alternative login methods */}
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { onClick: () => setAuthView("email-otp"), icon: <Mail className="h-4 w-4 text-primary" />, label: t("authEmailOtp"), shortLabel: "Email", extra: "" },
                            { onClick: () => setOtpSent(false), icon: <Phone className="h-4 w-4 text-[#FF9933]" />, label: t("authPhoneOtp"), shortLabel: "Phone", extra: otpSent ? "ring-2 ring-[#FF9933] ring-offset-1" : "" },
                            { onClick: () => setAuthView("aadhaar"), icon: <Fingerprint className="h-4 w-4 text-accent" />, label: t("authAadhaar"), shortLabel: "Aadhaar", extra: "" },
                          ].map((method, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08, duration: 0.3 }}>
                              <Button
                                variant="outline"
                                onClick={method.onClick}
                                className={`flex h-11 w-full flex-col gap-1.5 rounded-xl border-border/50 py-2 text-xs font-medium transition-all hover:scale-[1.03] hover:bg-muted/40 active:scale-[0.97] sm:flex-row sm:py-0 ${method.extra}`}
                              >
                                {method.icon}
                                <span className="hidden sm:inline">{method.label}</span>
                                <span className="text-[10px] sm:hidden">{method.shortLabel}</span>
                              </Button>
                            </motion.div>
                          ))}
                        </div>

                        <Divider text={t("authOrContinuePassword")} />

                        {otpSent ? (
                          <PhoneOtpVerification
                            phone={phone} otp={otp} setOtp={setOtp} isLoading={isLoading}
                            resendCountdown={resendCountdown} onVerify={handleVerifyPhoneOtp}
                            onResend={handleSendPhoneOtp} onChangeNumber={() => { setOtpSent(false); setOtp(Array(6).fill("")); }}
                            t={t}
                          />
                        ) : (
                          <form onSubmit={handleSignIn} className="space-y-4">
                            {/* Email */}
                            <div className="space-y-1.5">
                              <Label htmlFor="signin-email" className="text-sm font-medium text-foreground">{t("email")}</Label>
                              <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                                <Input
                                  id="signin-email" type="email" placeholder="your@email.com" value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  onBlur={() => setEmailTouched(true)}
                                  required
                                  aria-invalid={emailTouched && !!email && !EMAIL_RE.test(email)}
                                  className="h-12 rounded-xl border-border/50 bg-muted/20 pl-10 pr-10 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                                />
                                {!!email && (
                                  EMAIL_RE.test(email)
                                    ? <CheckCircle2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#046A38]" />
                                    : emailTouched && <AlertTriangle className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                                )}
                              </div>
                              {emailTouched && !!email && !EMAIL_RE.test(email) && (
                                <p className="text-[11px] text-destructive">Please enter a valid email address.</p>
                              )}
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="signin-password" className="text-sm font-medium text-foreground">{t("password")}</Label>
                                <button type="button" onClick={() => setShowForgotPassword(true)}
                                  className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
                                  {t("forgotPassword")}
                                </button>
                              </div>
                              <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                                <Input
                                  id="signin-password" type={showPassword ? "text" : "password"} value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock") ?? false)}
                                  required
                                  className="h-12 rounded-xl border-border/50 bg-muted/20 pl-10 pr-11 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  aria-label={showPassword ? "Hide password" : "Show password"}
                                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              <AnimatePresence>
                                {capsLockOn && (
                                  <motion.p
                                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#FF9933]"
                                  >
                                    <AlertTriangle className="h-3 w-3" /> Caps Lock is on
                                  </motion.p>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Remember me */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="remember-me" checked={rememberMe}
                                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                                  className="border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                                />
                                <Label htmlFor="remember-me" className="cursor-pointer text-xs font-normal text-muted-foreground">
                                  {t("authRememberMe")}
                                </Label>
                              </div>
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Lock className="h-3 w-3" /> Secure sign-in
                              </span>
                            </div>

                            <Button
                              type="submit"
                              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
                              disabled={isLoading}
                            >
                              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              {t("login")}
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>

                            {biometricAvailable && (
                              <>
                                <Divider text={t("authOrText")} />
                                <Button
                                  type="button" variant="outline"
                                  className="h-11 w-full gap-2 rounded-xl border-border/50 text-foreground hover:bg-muted/40"
                                  onClick={() => setAuthView("biometric")}
                                >
                                  <Fingerprint className="h-4 w-4 text-primary" />
                                  {t("authLoginWithBiometrics")}
                                </Button>
                              </>
                            )}
                          </form>
                        )}

                        {/* Quick phone login */}
                        {!otpSent && (
                          <div className="rounded-xl border border-border/40 bg-muted/30 p-4">
                            <Label className="mb-2.5 block text-xs font-medium uppercase tracking-wide text-foreground">{t("authQuickPhoneLogin")}</Label>
                            <div className="flex gap-2">
                              <div className="flex flex-1">
                                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-border/50 bg-muted/60 px-3 text-sm font-medium text-muted-foreground">+91</span>
                                <Input type="tel" placeholder="XXXXXXXXXX" value={phone}
                                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                  className="h-11 rounded-l-none rounded-r-xl border-border/50" />
                              </div>
                              <Button type="button" onClick={handleSendPhoneOtp} disabled={isLoading || phone.length < 10}
                                className="rounded-xl bg-[#FF9933] px-5 font-semibold text-white hover:bg-[#FF9933]/90">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("authSend")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      {/* ─── SIGN UP ─── */}
                      <TabsContent value="signup" className="mt-0">
                        <form onSubmit={handleSignUp} className="space-y-4">
                          {/* Full name */}
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-name" className="text-sm font-medium text-foreground">Full Name</Label>
                            <div className="relative">
                              <UserIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                              <Input
                                id="signup-name" type="text" placeholder="Your full name" value={fullName}
                                onChange={(e) => setFullName(e.target.value)} required
                                className="h-12 rounded-xl border-border/50 bg-muted/20 pl-10 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                              />
                            </div>
                          </div>

                          {/* Email */}
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-email" className="text-sm font-medium text-foreground">{t("email")}</Label>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                              <Input
                                id="signup-email" type="email" placeholder="your@email.com" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onBlur={() => setEmailTouched(true)}
                                required
                                aria-invalid={emailTouched && !!email && !EMAIL_RE.test(email)}
                                className="h-12 rounded-xl border-border/50 bg-muted/20 pl-10 pr-10 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                              />
                              {!!email && (
                                EMAIL_RE.test(email)
                                  ? <CheckCircle2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#046A38]" />
                                  : emailTouched && <AlertTriangle className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                              )}
                            </div>
                            {emailTouched && !!email && !EMAIL_RE.test(email) && (
                              <p className="text-[11px] text-destructive">Please enter a valid email address.</p>
                            )}
                          </div>

                          {/* Phone (optional) */}
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-phone" className="text-sm font-medium text-foreground">
                              Mobile Number <span className="font-normal text-muted-foreground">(optional)</span>
                            </Label>
                            <div className="flex">
                              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-border/50 bg-muted/60 px-3 text-sm font-medium text-muted-foreground">+91</span>
                              <Input
                                id="signup-phone" type="tel" placeholder="XXXXXXXXXX" value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                className="h-12 rounded-l-none rounded-r-xl border-border/50 bg-muted/20"
                              />
                            </div>
                          </div>

                          {/* Password */}
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-password" className="text-sm font-medium text-foreground">{t("password")}</Label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                              <Input
                                id="signup-password" type={showPassword ? "text" : "password"} value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock") ?? false)}
                                required minLength={6}
                                className="h-12 rounded-xl border-border/50 bg-muted/20 pl-10 pr-11 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                              />
                              <button
                                type="button" onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <PasswordStrength password={password} />
                            <AnimatePresence>
                              {capsLockOn && (
                                <motion.p
                                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                  className="flex items-center gap-1.5 text-[11px] font-medium text-[#FF9933]"
                                >
                                  <AlertTriangle className="h-3 w-3" /> Caps Lock is on
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Confirm password */}
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-confirm" className="text-sm font-medium text-foreground">Confirm Password</Label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                              <Input
                                id="signup-confirm" type={showConfirmPassword ? "text" : "password"} value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)} required
                                aria-invalid={!!confirmPassword && confirmPassword !== password}
                                className="h-12 rounded-xl border-border/50 bg-muted/20 pl-10 pr-11 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                              />
                              <button
                                type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                              >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {!!confirmPassword && (
                              confirmPassword === password ? (
                                <p className="flex items-center gap-1.5 text-[11px] text-[#046A38]">
                                  <CheckCircle2 className="h-3 w-3" /> Passwords match
                                </p>
                              ) : (
                                <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                                  <AlertTriangle className="h-3 w-3" /> Passwords do not match
                                </p>
                              )
                            )}
                          </div>

                          {/* Terms */}
                          <div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-muted/25 p-3.5">
                            <Checkbox
                              id="accept-terms" checked={acceptedTerms}
                              onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                              className="mt-0.5 border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                            <Label htmlFor="accept-terms" className="cursor-pointer text-xs font-normal leading-relaxed text-muted-foreground">
                              I agree to the{" "}
                              <Link to="/terms" className="font-medium text-primary hover:underline">Terms of Service</Link>{" "}
                              and{" "}
                              <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
                            </Label>
                          </div>

                          <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
                            <p className="text-center text-xs text-muted-foreground">
                              {t("authRegisterAsCitizen")} <strong className="text-foreground">{t("authCitizen")}</strong> — {t("authReportTrackIssues")}
                              <br />
                              <Link to="/admin-login" className="font-medium text-primary hover:underline">{t("authMunicipalStaff")}</Link>
                            </p>
                          </div>

                          <Button
                            type="submit"
                            className="h-12 w-full rounded-xl bg-accent text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:bg-accent/90"
                            disabled={
                              isLoading ||
                              !acceptedTerms ||
                              !fullName.trim() ||
                              !EMAIL_RE.test(email) ||
                              getPasswordScore(password) < 2 ||
                              password !== confirmPassword
                            }
                          >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {t("signUp")}
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  )}

                  {/* Footer links */}
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-border/30 pt-4">
                    <button onClick={() => setAuthView("2fa-setup")} className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                      <Key className="h-3.5 w-3.5" />
                      {t("auth2faSetup")}
                    </button>
                    {biometricAvailable && (
                      <>
                        <span className="h-3 w-px bg-border" />
                        <button onClick={() => setAuthView("biometric")} className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                          <Fingerprint className="h-3.5 w-3.5" />
                          {t("authBiometrics")}
                        </button>
                      </>
                    )}
                    <span className="h-3 w-px bg-border" />
                    <Link to="/admin-login" className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                      <Shield className="h-3.5 w-3.5" />
                      {t("authMunicipalStaffLogin")}
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Mobile back home */}
              <div className="mt-4 flex justify-center lg:hidden">
                <Button variant="ghost" asChild size="sm" className="text-muted-foreground hover:text-foreground">
                  <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />{t("backToHome")}</Link>
                </Button>
              </div>
            </motion.div>
          </div>

          <AppFooter />
        </div>
      </div>
    </div>
  );
};

/* ─── Layout for sub-views ─── */
const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="relative min-h-dvh flex items-center justify-center px-4 py-8">
    <AuthBackground />
    <div className="absolute top-4 right-4 z-20">
      <div className="backdrop-blur-xl bg-background/80 rounded-xl border border-border/40 p-1 shadow-sm">
        <LanguageSelector />
      </div>
    </div>
    {children}
  </div>
);

/* ─── Google Icon ─── */
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

/* ─── Divider ─── */
const Divider = ({ text }: { text: string }) => (
  <div className="relative my-1">
    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/40" /></div>
    <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground uppercase tracking-wider text-[10px] font-medium">{text}</span></div>
  </div>
);

/* ─── Phone OTP Verification ─── */
const PhoneOtpVerification = ({
  phone, otp, setOtp, isLoading, resendCountdown, onVerify, onResend, onChangeNumber, t,
}: {
  phone: string; otp: string[]; setOtp: (otp: string[]) => void; isLoading: boolean;
  resendCountdown: number; onVerify: (e: React.FormEvent) => void; onResend: () => void; onChangeNumber: () => void;
  t: (key: string) => string;
}) => {
  const maskedPhone = `+91 ${phone.slice(0, 2)}****${phone.slice(-2)}`;
  return (
    <form onSubmit={onVerify} className="space-y-4">
      <div className="text-center mb-2">
        <div className="mx-auto w-12 h-12 rounded-xl bg-[#FF9933]/10 flex items-center justify-center mb-3">
          <Phone className="w-5 h-5 text-[#FF9933]" />
        </div>
        <p className="text-sm text-muted-foreground">{t("authOtpSentTo")} <strong className="text-foreground">{maskedPhone}</strong></p>
        <button type="button" onClick={onChangeNumber} className="text-xs text-primary hover:underline mt-1">{t("authChangeNumber")}</button>
      </div>
      <div className="space-y-2">
        <Label className="text-foreground font-medium text-sm text-center block">{t("authEnterOtp")}</Label>
        <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
      </div>
      <Button type="submit" className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-xl shadow-md" disabled={isLoading || otp.join("").length !== 6}>
        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        {t("authVerifyLogin")}
      </Button>
      <div className="text-center">
        {resendCountdown > 0 ? (
          <p className="text-xs text-muted-foreground">{t("authResendIn")} <span className="font-semibold text-[#FF9933]">{resendCountdown}s</span></p>
        ) : (
          <button type="button" onClick={onResend} disabled={isLoading} className="text-xs text-primary hover:underline font-medium">{t("authResendOtp")}</button>
        )}
      </div>
    </form>
  );
};

/* ─── Forgot Password Form ─── */
const ForgotPasswordForm = ({
  email, setEmail, isLoading, resetEmailSent, onSubmit, onBack, t,
}: {
  email: string; setEmail: (email: string) => void; isLoading: boolean;
  resetEmailSent: boolean; onSubmit: (e: React.FormEvent) => void; onBack: () => void;
  t: (key: string) => string;
}) => {
  if (resetEmailSent) {
    return (
      <div className="text-center py-6">
        <div className="mx-auto w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
          <Mail className="w-7 h-7 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{t("authCheckEmail")}</h3>
        <p className="text-sm text-muted-foreground mb-4">{t("authResetSentTo")} <strong className="text-foreground">{email}</strong></p>
        <Button variant="outline" onClick={onBack} className="border-border/60 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("authBackToLogin")}
        </Button>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-email" className="text-foreground font-medium text-sm">{t("authEmailAddress")}</Label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <Input id="reset-email" type="email" placeholder="your@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="h-12 pl-10 bg-muted/20 border-border/50 rounded-xl focus:border-primary" />
        </div>
      </div>
      <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-md" disabled={isLoading}>
        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        {t("authSendResetLink")}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
      <Button type="button" variant="ghost" onClick={onBack} className="w-full text-muted-foreground hover:text-foreground rounded-xl">
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t("authBackToLogin")}
      </Button>
    </form>
  );
};

export default Auth;
