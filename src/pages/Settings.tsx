import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/hooks/use-translation";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  Bell, Mail, Loader2, Settings as SettingsIcon, Moon, Sun, Globe,
  Shield, User, Fingerprint, Lock, Trash2, LogOut, ChevronRight, Smartphone, Eye, EyeOff,
  Lock as PrivacyIcon, Camera, Mic, MapPin, HardDrive, HelpCircle, LifeBuoy, Bug,
  FileText, Info, Download, Volume2, Vibrate, LogOutIcon, ExternalLink
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const PushNotificationToggle = () => {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const { toast } = useToast();

  if (!isSupported) return null;

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast({ title: "Push Enabled", description: "You'll receive browser notifications for report updates." });
    } else {
      toast({ title: "Permission Denied", description: "Please enable notifications in your browser settings.", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
          <Bell className="w-4 h-4 text-primary" />
        </div>
        <div>
          <Label className="text-sm font-medium">Push Notifications</Label>
          <p className="text-xs text-muted-foreground">Get browser alerts even when the tab is hidden</p>
        </div>
      </div>
      {permission === "granted" ? (
        <span className="text-xs text-accent font-medium px-2 py-1 bg-accent/10 rounded-full">Enabled</span>
      ) : (
        <Button variant="outline" size="sm" onClick={handleEnable}>
          Enable
        </Button>
      )}
    </div>
  );
};

const Settings = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();

  // Notification prefs
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // Biometric devices
  const [devices, setDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      // Fetch notification prefs
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prefs) {
        setInApp(prefs.in_app);
        setEmail(prefs.email);
      }

      // Fetch biometric devices
      const { data: creds } = await supabase
        .from("webauthn_credentials")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setDevices(creds || []);
      setLoadingDevices(false);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const saveNotificationPrefs = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("notification_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("notification_preferences").update({ in_app: inApp, email }).eq("user_id", user.id);
      } else {
        await supabase.from("notification_preferences").insert({ user_id: user.id, in_app: inApp, email });
      }
      toast({ title: "Saved", description: "Notification preferences updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save preferences.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Weak password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message || "Could not update password.", variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const removeDevice = async (id: string) => {
    const { error } = await supabase.from("webauthn_credentials").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to remove device.", variant: "destructive" });
    } else {
      setDevices(devices.filter(d => d.id !== id));
      toast({ title: "Removed", description: "Biometric device removed." });
    }
  };

  const handleDeleteAccount = async () => {
    toast({ title: "Account Deletion", description: "Please contact support to delete your account.", variant: "destructive" });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("settingsTitle")}</h1>
            <p className="text-sm text-muted-foreground">Manage your account, preferences, and security</p>
          </div>
        </div>

        {/* ── Account Info ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Account</CardTitle>
            </div>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-sm text-muted-foreground">{user?.email || "Not set"}</p>
              </div>
              <Badge variant="secondary">Verified</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Phone</p>
                <p className="text-sm text-muted-foreground">{user?.phone || "Not linked"}</p>
              </div>
              {!user?.phone && <Badge variant="outline">Optional</Badge>}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Member since</p>
                <p className="text-sm text-muted-foreground">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Appearance ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              {isDark ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
              <CardTitle className="text-lg">Appearance</CardTitle>
            </div>
            <CardDescription>Customize how the app looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                  {isDark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                </div>
                <div>
                  <Label className="text-sm font-medium">Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">Toggle dark/light theme</p>
                </div>
              </div>
              <Switch checked={isDark} onCheckedChange={toggleTheme} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Language</Label>
                  <p className="text-xs text-muted-foreground">Choose your preferred language</p>
                </div>
              </div>
              <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">हिन्दी</SelectItem>
                  <SelectItem value="ta">தமிழ்</SelectItem>
                  <SelectItem value="te">తెలుగు</SelectItem>
                  <SelectItem value="kn">ಕನ್ನಡ</SelectItem>
                  <SelectItem value="ml">മലയാളം</SelectItem>
                  <SelectItem value="bn">বাংলা</SelectItem>
                  <SelectItem value="mr">मराठी</SelectItem>
                  <SelectItem value="gu">ગુજરાતી</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── Notifications ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{t("notificationPreferences")}</CardTitle>
            </div>
            <CardDescription>{t("chooseNotification")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <Label htmlFor="in-app" className="text-sm font-medium">{t("inAppNotifications")}</Label>
                  <p className="text-xs text-muted-foreground">{t("seeNotificationsInBell")}</p>
                </div>
              </div>
              <Switch id="in-app" checked={inApp} onCheckedChange={setInApp} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <Label htmlFor="email-notif" className="text-sm font-medium">{t("emailNotifications")}</Label>
                  <p className="text-xs text-muted-foreground">{t("receiveEmailOnStatus")}</p>
                </div>
              </div>
              <Switch id="email-notif" checked={email} onCheckedChange={setEmail} />
            </div>
            <Separator />
            {/* Push Notifications */}
            <PushNotificationToggle />
            <Button onClick={saveNotificationPrefs} disabled={saving} className="w-full mt-2">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Notification Preferences"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Security ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Security</CardTitle>
            </div>
            <CardDescription>Manage your password and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Change Password */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Change Password</Label>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    placeholder="New password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Input
                  type={showPasswords ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  variant="outline"
                  className="w-full"
                >
                  {changingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : "Update Password"}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Biometric Devices */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Biometric Devices</Label>
                </div>
                <Link to="/auth">
                  <Button variant="outline" size="sm">
                    <Fingerprint className="w-3 h-3 mr-1" />
                    Register New
                  </Button>
                </Link>
              </div>

              {loadingDevices ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground bg-muted/50 rounded-lg">
                  <Smartphone className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  No biometric devices registered yet
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map(device => (
                    <div key={device.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{device.device_name || "Unknown Device"}</p>
                          <p className="text-xs text-muted-foreground">
                            Added {new Date(device.created_at).toLocaleDateString("en-IN")}
                            {device.last_used_at && ` · Last used ${new Date(device.last_used_at).toLocaleDateString("en-IN")}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => removeDevice(device.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Danger Zone ── */}
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>Irreversible actions on your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Sign out everywhere</p>
                <p className="text-xs text-muted-foreground">Sign out from all devices</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-3 h-3 mr-1" />
                Sign Out
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Delete account</p>
                <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All your reports, notifications, and account data will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* ── Privacy Permissions ── */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <PrivacyIcon className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Privacy Permissions</CardTitle>
            </div>
            <CardDescription>Browser-level permissions used by this app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: Camera, label: "Camera", desc: "For capturing report photos", perm: "camera" as PermissionName },
              { icon: MapPin, label: "Location", desc: "For attaching your GPS to reports", perm: "geolocation" as PermissionName },
              { icon: Mic, label: "Microphone", desc: "For voice input while reporting", perm: "microphone" as PermissionName },
              { icon: Bell, label: "Notifications", desc: "For alerts about report updates", perm: "notifications" as PermissionName },
            ].map(({ icon: Icon, label, desc, perm }) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <p className="text-xs text-muted-foreground truncate">{desc}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={async () => {
                  try {
                    if (perm === "geolocation") navigator.geolocation.getCurrentPosition(() => toast({ title: `${label} granted` }), () => toast({ title: `${label} denied`, variant: "destructive" }));
                    else if (perm === "notifications") { const r = await Notification.requestPermission(); toast({ title: `Notifications: ${r}` }); }
                    else if (perm === "camera" || perm === "microphone") { await navigator.mediaDevices.getUserMedia(perm === "camera" ? { video: true } : { audio: true }); toast({ title: `${label} granted` }); }
                  } catch { toast({ title: `${label} denied`, variant: "destructive" }); }
                }}>Request</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Data & Storage ── */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Data & Storage</CardTitle>
            </div>
            <CardDescription>Manage your local data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-between" onClick={async () => {
              if (!user) return;
              const { data } = await supabase.from("civic_reports").select("*").eq("user_id", user.id);
              const blob = new Blob([JSON.stringify(data || [], null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `my-reports-${Date.now()}.json`; a.click();
              URL.revokeObjectURL(url);
              toast({ title: "Download started" });
            }}>
              <span className="flex items-center gap-2"><Download className="w-4 h-4" /> Download My Data</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={() => {
              try {
                Object.keys(localStorage).filter(k => k.startsWith("civic_") || k.startsWith("offline_")).forEach(k => localStorage.removeItem(k));
                toast({ title: "Cache cleared" });
              } catch { toast({ title: "Could not clear cache", variant: "destructive" }); }
            }}>
              <span className="flex items-center gap-2"><Trash2 className="w-4 h-4" /> Clear Cache</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-xs text-muted-foreground pt-1 flex items-center justify-between">
              <span>Storage used (local)</span>
              <span className="font-mono">{Math.round((JSON.stringify(localStorage).length / 1024))} KB</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Help & Support ── */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Help & Support</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {[
              { to: "/help", icon: HelpCircle, label: "FAQ & Help Center" },
              { to: "/help", icon: LifeBuoy, label: "Contact Support" },
              { to: "/help", icon: Bug, label: "Report a Bug" },
              { to: "/privacy", icon: Shield, label: "Privacy Policy" },
              { to: "/terms", icon: FileText, label: "Terms & Conditions" },
              { to: "/how-it-works", icon: Info, label: "About CivicAI" },
            ].map((l) => (
              <Link key={l.label} to={l.to} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <l.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{l.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
            <div className="px-3 pt-3 text-xs text-muted-foreground">Version 1.0.0</div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
