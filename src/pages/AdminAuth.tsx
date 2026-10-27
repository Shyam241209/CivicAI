import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { LanguageSelector } from "@/components/LanguageSelector";
import { OtpInput } from "@/components/OtpInput";
import { useTranslation } from "@/hooks/use-translation";
import { Loader2, ArrowLeft, ShieldCheck, Lock, ChevronRight, Mail, ArrowRight, KeyRound, UserPlus, LogIn, Settings, HelpCircle, Phone } from "lucide-react";
import authBg from "@/assets/auth-professional-bg.jpg";
import accentTreatment from "@/assets/accent-bg.jpg";
import { AppFooter } from "@/components/AppFooter";
import { destinationForRole } from "@/lib/authRouting";

const DEFAULT_ACCESS_CODE = "2412";

const AdminAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  
  const [codeVerified, setCodeVerified] = useState(false);
  const [accessCode, setAccessCode] = useState(["", "", "", ""]);
  const [storedCode, setStoredCode] = useState(() => localStorage.getItem("admin_access_code") || DEFAULT_ACCESS_CODE);
  
  const [showChangeCode, setShowChangeCode] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  
  const [showForgotCode, setShowForgotCode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotMethod, setForgotMethod] = useState<"email" | "phone">("email");
  const [codeVerifiedByEmail, setCodeVerifiedByEmail] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotNewCode, setForgotNewCode] = useState("");

  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && user && role) {
      navigate(destinationForRole(role, "/admin"), { replace: true });
    }
  }, [user, role, loading, navigate]);

  const getFriendlyError = (error: any): string => {
    if (!error) return "An unknown error occurred.";
    const msg = error.message || String(error);
    if (msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("network"))
      return "Unable to connect. Check your internet connection.";
    if (msg.includes("Invalid login credentials"))
      return "Invalid email or password.";
    if (msg.includes("Email not confirmed"))
      return "Please verify your email before accessing the Admin Portal.";
    if (msg.includes("banned") || msg.includes("suspend"))
      return "Your administrator account has been suspended.";
    if (msg.includes("rate limit") || msg.includes("429"))
      return "Too many attempts. Please wait a moment.";
    if (msg.includes("already registered") || msg.includes("already been registered"))
      return "This email is already registered. Please login instead.";
    return "Unable to connect to the server. Please try again.";
  };

  const withRetry = async <T,>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> => {
    for (let i = 0; i <= retries; i++) {
      try { return await fn(); }
      catch (err: any) {
        const msg = err?.message || "";
        if ((msg === "Failed to fetch" || msg.includes("NetworkError")) && i < retries) {
          await new Promise(r => setTimeout(r, delay * (i + 1)));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Unable to connect. Please try again.");
  };

  const handleVerifyCode = () => {
    const entered = accessCode.join("");
    if (entered === storedCode) {
      setCodeVerified(true);
      toast({ title: t("accessGranted"), description: t("welcomeAdminPortal") });
    } else {
      toast({ title: t("invalidCode"), description: t("invalidCodeDesc"), variant: "destructive" });
      setAccessCode(["", "", "", ""]);
    }
  };

  const handleChangeCode = () => {
    if (currentCode !== storedCode) {
      toast({ title: t("invalidCode"), description: t("invalidCodeDesc"), variant: "destructive" });
      return;
    }
    if (newCode.length !== 4 || !/^\d{4}$/.test(newCode)) {
      toast({ title: t("invalidCode"), variant: "destructive" });
      return;
    }
    localStorage.setItem("admin_access_code", newCode);
    setStoredCode(newCode);
    setShowChangeCode(false);
    setCurrentCode("");
    setNewCode("");
    toast({ title: t("success") });
  };

  const handleForgotCode = async () => {
    if (forgotMethod === "email" && !forgotEmail.trim()) {
      toast({ title: t("error"), variant: "destructive" });
      return;
    }
    if (forgotMethod === "phone" && !forgotPhone.trim()) {
      toast({ title: t("error"), variant: "destructive" });
      return;
    }
    setIsForgotLoading(true);
    try {
      if (forgotMethod === "email") {
        const { data, error } = await supabase.functions.invoke("manage-admins", {
          body: { action: "verify_admin_email", email: forgotEmail.trim() },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setCodeVerifiedByEmail(true);
        toast({ title: t("success") });
      } else {
        if (!/^[6-9]\d{9}$/.test(forgotPhone.replace(/\s/g, ""))) {
          toast({ title: t("error"), variant: "destructive" });
          return;
        }
        setCodeVerifiedByEmail(true);
        toast({ title: t("success") });
      }
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleForgotCodeReset = () => {
    if (forgotNewCode.length !== 4 || !/^\d{4}$/.test(forgotNewCode)) {
      toast({ title: t("invalidCode"), variant: "destructive" });
      return;
    }
    localStorage.setItem("admin_access_code", forgotNewCode);
    setStoredCode(forgotNewCode);
    setShowForgotCode(false);
    setCodeVerifiedByEmail(false);
    setForgotEmail("");
    setForgotPhone("");
    setForgotNewCode("");
    toast({ title: t("success") });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: t("error"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await withRetry(() =>
        supabase.auth.signInWithPassword({ email, password })
      );
      if (error) throw error;

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        toast({
          title: "Email not verified",
          description: "Please verify your email before accessing the Admin Portal.",
          variant: "destructive",
        });
        return;
      }

      const { data: roleValue, error: roleError } = await supabase.rpc("get_user_role", {
        _user_id: data.user.id,
      });

      if (roleError) {
        await supabase.auth.signOut();
        toast({
          title: "Unable to verify access",
          description: "Unable to connect to the server. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (roleValue !== "admin") {
        await supabase.auth.signOut();
        toast({
          title: "Access Denied",
          description: "Your account is not authorized to access the Admin Portal.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("success") });
      navigate("/admin", { replace: true });
    } catch (error: any) {
      toast({ title: t("error"), description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      toast({ title: t("error"), variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: t("error"), variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: t("error"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await withRetry(() =>
        supabase.auth.signUp({ email, password, options: { data: { role: "admin" } } })
      );
      if (error) throw error;
      toast({ title: t("success") });
      setActiveTab("login");
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ title: t("error"), description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: t("error"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await withRetry(() =>
        supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin-login` })
      );
      if (error) throw error;
      setResetEmailSent(true);
      toast({ title: t("success") });
    } catch (error: any) {
      toast({ title: t("error"), description: getFriendlyError(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── CODE GATE SCREEN ───
  if (!codeVerified) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${authBg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-cover bg-center opacity-[0.18] mix-blend-soft-light" style={{ backgroundImage: `url(${accentTreatment})` }} aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 z-[2] bg-white/40 backdrop-blur-[1px]" aria-hidden="true" />

        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <div className="backdrop-blur-xl bg-white/10 rounded-xl border border-white/15 p-1">
            <LanguageSelector />
          </div>
        </div>

        <div className="relative z-10 min-h-screen py-10 px-4 flex flex-col items-center justify-center">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="ghost" asChild className="mb-4 text-white/90 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/20">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />{t("backToHome")}</Link>
            </Button>
          </motion.div>

          <div className="w-full max-w-[420px]">
            <motion.div className="text-center mb-6" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <motion.div
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/15 backdrop-blur-md border border-red-400/25 shadow-xl mb-4"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.25 }}
              >
                <KeyRound className="w-8 h-8 text-red-400" />
              </motion.div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {showChangeCode ? t("changeAccessCode") : t("enterAccessCode")}
              </h1>
              <p className="text-sm text-white/60 mt-1">
                {showChangeCode ? t("updateAccessCodeDesc") : t("enterAccessCodeDesc")}
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.35 }}>
              <Card className="backdrop-blur-xl bg-card/[0.97] border-0 shadow-2xl shadow-black/30 overflow-hidden w-full rounded-2xl">
                <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
                <CardContent className="p-6 pt-5">
                  <AnimatePresence mode="wait">
                    {showForgotCode ? (
                      <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                        {!codeVerifiedByEmail ? (
                          <>
                            <p className="text-sm text-muted-foreground text-center">{t("verifyIdentityDesc")}</p>
                            <div className="flex gap-2 mb-2">
                              <Button type="button" variant={forgotMethod === "email" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setForgotMethod("email")}>
                                <Mail className="w-3.5 h-3.5 mr-1.5" />{t("email")}
                              </Button>
                              <Button type="button" variant={forgotMethod === "phone" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setForgotMethod("phone")}>
                                <Phone className="w-3.5 h-3.5 mr-1.5" />{t("registeredMobile")}
                              </Button>
                            </div>
                            {forgotMethod === "email" ? (
                              <div className="space-y-1.5">
                                <Label className="text-foreground font-medium text-sm">{t("registeredAdminEmail")}</Label>
                                <Input type="email" placeholder="admin@example.com" value={forgotEmail}
                                  onChange={(e) => setForgotEmail(e.target.value)} className="h-11 bg-muted/30 border-border/60" />
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <Label className="text-foreground font-medium text-sm">{t("registeredMobile")}</Label>
                                <Input type="tel" placeholder="9876543210" maxLength={10} inputMode="numeric" value={forgotPhone}
                                  onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="h-11 bg-muted/30 border-border/60" />
                              </div>
                            )}
                            <Button onClick={handleForgotCode} disabled={isForgotLoading} className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold">
                              {isForgotLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                              {t("verifyIdentity")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-success text-center font-medium">{t("identityVerified")}</p>
                            <div className="space-y-1.5">
                              <Label className="text-foreground font-medium text-sm">{t("setNewAccessCode")}</Label>
                              <Input type="text" maxLength={4} inputMode="numeric" value={forgotNewCode}
                                onChange={(e) => setForgotNewCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                className="h-11 bg-muted/30 border-border/60 text-center text-lg tracking-[0.5em] font-mono" />
                            </div>
                            <Button onClick={handleForgotCodeReset} className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold" disabled={forgotNewCode.length !== 4}>
                              {t("resetAccessCode")}
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" onClick={() => { setShowForgotCode(false); setCodeVerifiedByEmail(false); setForgotEmail(""); setForgotPhone(""); setForgotNewCode(""); }} className="w-full text-muted-foreground">
                          <ArrowLeft className="w-4 h-4 mr-2" />{t("back")}
                        </Button>
                      </motion.div>
                    ) : showChangeCode ? (
                      <motion.div key="change" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-foreground font-medium text-sm">{t("currentCode")}</Label>
                          <Input type="password" maxLength={4} placeholder="••••" value={currentCode}
                            onChange={(e) => setCurrentCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="h-11 bg-muted/30 border-border/60 text-center text-lg tracking-[0.5em] font-mono" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground font-medium text-sm">{t("newCodeDigits")}</Label>
                          <Input type="text" maxLength={4} inputMode="numeric" value={newCode}
                            onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="h-11 bg-muted/30 border-border/60 text-center text-lg tracking-[0.5em] font-mono" />
                        </div>
                        <Button onClick={handleChangeCode} className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold">
                          {t("updateCode")}
                        </Button>
                        <Button variant="ghost" onClick={() => { setShowChangeCode(false); setCurrentCode(""); setNewCode(""); }} className="w-full text-muted-foreground">
                          <ArrowLeft className="w-4 h-4 mr-2" />{t("back")}
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div key="enter" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-5">
                        <OtpInput value={accessCode} onChange={setAccessCode} length={4} />
                        <Button onClick={handleVerifyCode} className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md" disabled={accessCode.join("").length < 4}>
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          {t("verifyAndEnter")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                        <div className="flex items-center justify-center gap-4">
                          <button type="button" onClick={() => setShowChangeCode(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <Settings className="w-3 h-3" />
                            {t("changeCode")}
                          </button>
                          <span className="text-muted-foreground/40">|</span>
                          <button type="button" onClick={() => setShowForgotCode(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <HelpCircle className="w-3 h-3" />
                            {t("forgotCode")}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div className="mt-5 text-center space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
              <Link to="/auth" className="text-xs text-white/50 hover:text-white/80 transition-colors underline underline-offset-2">
                {t("citizenLoginLink")}
              </Link>
              <AppFooter variant="dark" />
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // ─── ADMIN LOGIN / SIGNUP ───
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${authBg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-cover bg-center opacity-[0.18] mix-blend-soft-light" style={{ backgroundImage: `url(${accentTreatment})` }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-white/40 backdrop-blur-[1px]" aria-hidden="true" />
      <div className="absolute inset-0 z-[3] opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <div className="backdrop-blur-xl bg-white/10 rounded-xl border border-white/15 p-1">
          <LanguageSelector />
        </div>
      </div>

      <div className="relative z-10 min-h-screen py-10 px-4 flex flex-col items-center justify-between">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" onClick={() => setCodeVerified(false)} className="mb-4 text-white/90 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/20">
            <ArrowLeft className="w-4 h-4 mr-2" />{t("back")}
          </Button>
        </motion.div>

        <div className="w-full max-w-[420px]">
          <motion.div className="text-center mb-6" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/15 backdrop-blur-md border border-red-400/25 shadow-xl mb-4"
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.25 }}
            >
              <ShieldCheck className="w-8 h-8 text-red-400" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {showForgotPassword ? t("resetPasswordTitle") : t("adminPortal")}
            </h1>
            <p className="text-sm text-white/60 mt-1">
              {showForgotPassword ? t("resetPasswordDesc") : t("adminPortalDesc")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.35 }}
          >
            <Card className="backdrop-blur-xl bg-card/[0.97] border-0 shadow-2xl shadow-black/30 overflow-hidden w-full rounded-2xl">
              <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
              <CardContent className="p-6 pt-5">
                {showForgotPassword ? (
                  resetEmailSent ? (
                    <div className="text-center py-6">
                      <div className="mx-auto w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                        <Mail className="w-7 h-7 text-accent" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{t("authCheckEmail")}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{t("authResetSentTo")} <strong className="text-foreground">{email}</strong></p>
                      <Button variant="outline" onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }} className="border-border/60">
                        <ArrowLeft className="w-4 h-4 mr-2" />{t("authBackToLogin")}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="reset-email" className="text-foreground font-medium text-sm">{t("authEmailAddress")}</Label>
                        <Input id="reset-email" type="email" placeholder="admin@municipal.gov.in" value={email}
                          onChange={(e) => setEmail(e.target.value)} required
                          className="h-11 bg-muted/30 border-border/60 focus:border-primary" />
                      </div>
                      <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {t("authSendResetLink")} <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }} className="w-full text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-4 h-4 mr-2" />{t("authBackToLogin")}
                      </Button>
                    </form>
                  )
                ) : (
                  <>
                    <div className="flex mb-5 bg-muted/30 rounded-xl p-1 gap-1">
                      <button type="button" onClick={() => setActiveTab("login")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          activeTab === "login" ? "bg-red-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}>
                        <LogIn className="w-3.5 h-3.5" />{t("login")}
                      </button>
                      <button type="button" onClick={() => setActiveTab("signup")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          activeTab === "signup" ? "bg-red-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}>
                        <UserPlus className="w-3.5 h-3.5" />{t("signUp")}
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      {activeTab === "login" ? (
                        <motion.form key="login" onSubmit={handleSignIn} className="space-y-4"
                          initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }}>
                          <div className="space-y-1.5">
                            <Label htmlFor="admin-email" className="text-foreground font-medium text-sm">{t("officialEmail")}</Label>
                            <Input id="admin-email" type="email" placeholder="admin@municipal.gov.in" value={email}
                              onChange={(e) => setEmail(e.target.value)} required
                              className="h-11 bg-muted/30 border-border/60 focus:border-primary" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <Label htmlFor="admin-password" className="text-foreground font-medium text-sm">{t("password")}</Label>
                              <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-primary hover:text-primary/80 font-medium">{t("forgotPassword")}</button>
                            </div>
                            <Input id="admin-password" type="password" value={password}
                              onChange={(e) => setPassword(e.target.value)} required
                              className="h-11 bg-muted/30 border-border/60 focus:border-primary" />
                          </div>
                          <Button type="submit" className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-600/20" disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                            {t("adminLogin")} <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </motion.form>
                      ) : (
                        <motion.form key="signup" onSubmit={handleSignUp} className="space-y-4"
                          initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-email" className="text-foreground font-medium text-sm">{t("officialEmail")}</Label>
                            <Input id="signup-email" type="email" placeholder="admin@municipal.gov.in" value={email}
                              onChange={(e) => setEmail(e.target.value)} required
                              className="h-11 bg-muted/30 border-border/60 focus:border-primary" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-password" className="text-foreground font-medium text-sm">{t("password")}</Label>
                            <Input id="signup-password" type="password" value={password}
                              onChange={(e) => setPassword(e.target.value)} required
                              className="h-11 bg-muted/30 border-border/60 focus:border-primary" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-confirm" className="text-foreground font-medium text-sm">{t("confirmPassword")}</Label>
                            <Input id="signup-confirm" type="password" value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)} required
                              className="h-11 bg-muted/30 border-border/60 focus:border-primary" />
                          </div>
                          <Button type="submit" className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-600/20" disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                            {t("createAdminAccount")} <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </motion.form>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center justify-center gap-1 pt-3 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" />
                      <span>{t("secureGovAuth")}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div className="mt-5 text-center space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            <Link to="/auth" className="text-xs text-white/50 hover:text-white/80 transition-colors underline underline-offset-2">
              {t("citizenLoginLink")}
            </Link>
            <AppFooter variant="dark" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
