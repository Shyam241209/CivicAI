import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSignedImageUrl } from "@/lib/storageUrl";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Bell, FileText, Save, Loader2, Plus, Trash2, Pencil, X, Check,
  Mail, AlertTriangle, Sparkles, Camera, KeyRound
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

interface NotificationTemplate {
  id: string;
  template_key: string;
  title: string;
  body: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SystemSettingsRow {
  id: string;
  auto_assign_confidence_threshold: number | null;
  auto_create_missing_departments: boolean | null;
}

interface AdminProfile {
  user_id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  avatar_url: string | null;
}

const EMPTY_PROFILE: AdminProfile = {
  user_id: "",
  full_name: "",
  role: "",
  phone: "",
  avatar_url: "",
};

const AdminSettings = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", body: "", description: "" });

  // Auto-assignment system settings
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [autoThreshold, setAutoThreshold] = useState(0.75);
  const [autoCreateDepts, setAutoCreateDepts] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // New template dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    template_key: "",
    title: "",
    body: "",
    description: "",
  });
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const [profile, setProfile] = useState<AdminProfile>(EMPTY_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarSignedUrl = useSignedImageUrl(profile.avatar_url);

  const describeSupabaseError = (context: string, error: unknown) => {
    const details = error && typeof error === "object" ? error as { message?: string; code?: string; details?: string; hint?: string } : {};
    if (import.meta.env.DEV) {
      console.error(context, {
        message: details.message || String(error),
        code: details.code,
        details: details.details,
        hint: details.hint,
      });
    }
    return details.message || "Please check your connection and try again.";
  };

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const currentUser = userData.user;
      if (!currentUser) throw new Error("Admin session unavailable.");
      setAdminEmail(currentUser.email || "");

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,full_name,role,phone,avatar_url")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (error) throw error;
      setProfile({ ...EMPTY_PROFILE, user_id: currentUser.id, ...(data as Partial<AdminProfile> | null) });
    } catch (error) {
      const message = describeSupabaseError("Unable to load admin profile", error);
      setProfileError(message);
      toast({ title: "Unable to load profile", description: message, variant: "destructive" });
    } finally {
      setProfileLoading(false);
    }
  }, [toast]);

  const fetchSystemSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const settings = data as SystemSettingsRow;
        setSettingsId(settings.id);
        setAutoThreshold(Number(settings.auto_assign_confidence_threshold ?? 0.75));
        setAutoCreateDepts(!!settings.auto_create_missing_departments);
      }
    } catch (error) {
      setSettingsError(describeSupabaseError("Unable to load admin system settings", error));
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setTemplates((data as NotificationTemplate[]) || []);
    } catch (error) {
      setTemplatesError(describeSupabaseError("Unable to load admin notification templates", error));
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const retryLoading = () => {
    void fetchTemplates();
    void fetchSystemSettings();
  };

  const initializeSettings = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      const message = describeSupabaseError("Unable to restore admin session for settings", error);
      setProfileError(message);
      setTemplatesError(message);
      setSettingsError(message);
      setTemplatesLoading(false);
      setSettingsLoading(false);
      setProfileLoading(false);
      return;
    }
    if (!data.user) {
      const message = "Admin session unavailable. Please sign in again.";
      setProfileError(message);
      setTemplatesError(message);
      setSettingsError(message);
      setTemplatesLoading(false);
      setSettingsLoading(false);
      setProfileLoading(false);
      return;
    }
    void fetchTemplates();
    void fetchSystemSettings();
    void fetchProfile();
  }, [fetchProfile, fetchSystemSettings, fetchTemplates]);

  useEffect(() => {
    void initializeSettings();
  }, [initializeSettings]);

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const updateProfile = <K extends keyof AdminProfile>(key: K, value: AdminProfile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      toast({ title: "Upload failed", description: userError?.message || "Admin session unavailable.", variant: "destructive" });
      return;
    }
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setAvatarUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userData.user.id}/avatars/${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("civic-reports").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      updateProfile("avatar_url", path);
      toast({ title: "Avatar uploaded", description: "Click Save Profile to keep this change." });
    } catch (error) {
      URL.revokeObjectURL(preview);
      setAvatarPreview(null);
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile.full_name?.trim() || !profile.role?.trim()) {
      toast({ title: "Missing fields", description: "Full name and role are required.", variant: "destructive" });
      return;
    }
    setProfileSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const currentUser = userData.user;
      if (!currentUser) throw new Error("Admin session unavailable.");
      const { error } = await supabase.from("profiles").upsert({
        user_id: currentUser.id,
        full_name: profile.full_name.trim(),
        role: profile.role.trim(),
        phone: profile.phone?.trim() || null,
        avatar_url: profile.avatar_url || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      setProfile((current) => ({ ...current, user_id: currentUser.id, full_name: current.full_name?.trim() || "", role: current.role?.trim() || "", phone: current.phone?.trim() || "" }));
      toast({ title: "Profile updated successfully" });
    } catch (error) {
      toast({ title: "Profile update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      toast({ title: "Missing fields", description: "Complete all password fields.", variant: "destructive" });
      return;
    }
    if (passwordForm.next.length < 6) {
      toast({ title: "Weak password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast({ title: "Passwords do not match", description: "Enter the same new password twice.", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const email = userData.user?.email;
      if (!email) throw new Error("Admin email is unavailable.");
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: passwordForm.current });
      if (verifyError) throw new Error("Current password is incorrect.");
      const { data, error } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (error || !data.user) throw error || new Error("Password update failed.");
      toast({ title: "Password updated successfully" });
      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordDialogOpen(false);
    } catch (error) {
      toast({ title: "Password update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  };

  const saveSystemSettings = async () => {
    setSavingSettings(true);
    try {
      const payload = {
        auto_assign_confidence_threshold: autoThreshold,
        auto_create_missing_departments: autoCreateDepts,
        updated_at: new Date().toISOString(),
      };
      const { error } = settingsId
        ? await supabase.from("system_settings").update(payload).eq("id", settingsId)
        : await supabase.from("system_settings").insert(payload);
      if (error) throw error;
      toast({ title: "Saved", description: "Auto-assignment settings updated." });
      void fetchSystemSettings();
    } catch (error) {
      const message = describeSupabaseError("Unable to save admin system settings", error);
      toast({ title: "Unable to save system settings", description: message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };


  const startEditing = (template: NotificationTemplate) => {
    setEditingId(template.id);
    setEditForm({
      title: template.title,
      body: template.body,
      description: template.description || "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ title: "", body: "", description: "" });
  };

  const saveTemplate = async (id: string) => {
    setSaving(id);
    const { error } = await supabase
      .from("notification_templates")
      .update({
        title: editForm.title,
        body: editForm.body,
        description: editForm.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to save template.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Template updated successfully." });
      setEditingId(null);
      fetchTemplates();
    }
    setSaving(null);
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("notification_templates")
      .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to toggle template.", variant: "destructive" });
    } else {
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentActive } : t));
    }
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("notification_templates").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete template.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Template removed." });
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  const createTemplate = async () => {
    if (!newTemplate.template_key || !newTemplate.title || !newTemplate.body) {
      toast({ title: "Missing fields", description: "Key, title, and body are required.", variant: "destructive" });
      return;
    }
    setCreatingTemplate(true);
    const { error } = await supabase.from("notification_templates").insert({
      template_key: newTemplate.template_key,
      title: newTemplate.title,
      body: newTemplate.body,
      description: newTemplate.description || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Created", description: "New template added." });
      setNewTemplate({ template_key: "", title: "", body: "", description: "" });
      setShowNewDialog(false);
      fetchTemplates();
    }
    setCreatingTemplate(false);
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <Card className="min-w-0 border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Admin Profile</CardTitle>
          </div>
          <CardDescription>Manage the profile details shown for this administrator.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 [&_input]:min-h-11 [&_textarea]:min-h-11">
          {profileLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading profile...</div>
          ) : profileError ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div><p className="font-medium">Unable to load profile</p><p className="break-words text-sm text-muted-foreground">{profileError}</p></div></div>
              <Button variant="outline" className="min-h-11" onClick={() => void fetchProfile()}>Retry profile</Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                  {(avatarPreview || avatarSignedUrl) && <AvatarImage src={avatarPreview || avatarSignedUrl || undefined} alt="Admin avatar" />}
                  <AvatarFallback className="bg-primary text-xl text-primary-foreground">{(profile.full_name || adminEmail || "A").trim().slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAvatarUpload(file); event.target.value = ""; }} />
                  <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}>
                    {avatarUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />} Change avatar
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">Image files only. Save the profile after uploading.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="admin-full-name">Full Name</Label><Input id="admin-full-name" value={profile.full_name || ""} onChange={(event) => updateProfile("full_name", event.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" value={adminEmail} readOnly disabled className="bg-muted/40" /></div>
                <div className="space-y-1.5"><Label htmlFor="admin-role">Role / Designation</Label><Input id="admin-role" placeholder="Tamil Nadu Civic Administration" value={profile.role || ""} onChange={(event) => updateProfile("role", event.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="admin-phone">Phone Number</Label><Input id="admin-phone" type="tel" value={profile.phone || ""} onChange={(event) => updateProfile("phone", event.target.value)} /></div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button className="min-h-11 w-full sm:w-auto" onClick={() => void saveProfile()} disabled={profileLoading || profileSaving}>
                  {profileSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Profile
                </Button>
                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger asChild><Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto"><KeyRound className="mr-2 h-4 w-4" /> Change Password</Button></DialogTrigger>
                  <DialogContent className="max-h-[calc(100vh-24px)] w-[calc(100%-24px)] max-w-lg overflow-y-auto rounded-xl p-4 sm:p-6">
                    <DialogHeader><DialogTitle>Change Password</DialogTitle><DialogDescription>Confirm your current password before setting a new one.</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-1.5"><Label htmlFor="current-password">Current Password</Label><Input id="current-password" type="password" value={passwordForm.current} onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))} /></div>
                      <div className="space-y-1.5"><Label htmlFor="new-password">New Password</Label><Input id="new-password" type="password" value={passwordForm.next} onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))} /></div>
                      <div className="space-y-1.5"><Label htmlFor="confirm-password">Confirm New Password</Label><Input id="confirm-password" type="password" value={passwordForm.confirm} onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))} /></div>
                    </div>
                    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row"><Button className="min-h-11 w-full sm:w-auto" variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancel</Button><Button className="min-h-11 w-full sm:w-auto" onClick={() => void changePassword()} disabled={passwordSaving}>{passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update Password</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Auto-assignment configuration */}
      <Card className="min-w-0 border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">AI Department Auto-Assignment</CardTitle>
          </div>
          <CardDescription>
            Control how AI-suggested departments are routed when reports are submitted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:space-y-6 sm:p-6 [&_input]:min-h-11">
          {settingsError && <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div><p className="font-medium">Unable to load system settings</p><p className="break-words text-sm text-muted-foreground">{settingsError}</p></div></div><Button variant="outline" className="min-h-11" onClick={() => void fetchSystemSettings()}>Retry system settings</Button></div>}
          {settingsLoading && !settingsError && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading system settings...</div>}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Confidence threshold</Label>
              <Badge variant="outline" className="font-mono">{Math.round(autoThreshold * 100)}%</Badge>
            </div>
            <Slider
              min={0.3}
              max={1}
              step={0.05}
              value={[autoThreshold]}
              onValueChange={([v]) => setAutoThreshold(v)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Matches below this score are kept aside and require admin confirmation before being routed.
            </p>
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Label>Auto-create missing departments</Label>
              <p className="text-xs text-muted-foreground mt-1">
                When the AI suggests a department that doesn't match any existing one, automatically create it from the suggestion.
              </p>
            </div>
            <Switch checked={autoCreateDepts} onCheckedChange={setAutoCreateDepts} />
          </div>

          <div className="flex justify-end">
            <Button onClick={saveSystemSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Overview */}
      <Card className="border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">System Configuration</CardTitle>
          </div>
          <CardDescription>Platform-wide settings and notification templates</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {templatesLoading && <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading template summary...</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <Bell className="w-6 h-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-xs text-muted-foreground">Notification Templates</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <Check className="w-6 h-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold">{templates.filter(t => t.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Active Templates</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <AlertTriangle className="w-6 h-6 mx-auto text-warning mb-2" />
              <p className="text-2xl font-bold">{templates.filter(t => !t.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Disabled Templates</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Templates */}
      <Card className="min-w-0 border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Notification Templates</CardTitle>
            </div>
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="min-h-11 w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-1" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[calc(100vh-24px)] w-[calc(100%-24px)] max-w-lg overflow-y-auto rounded-xl p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Create Notification Template</DialogTitle>
                  <DialogDescription>
                    Add a new template for system notifications. Use {"{{variable}}"} for dynamic content.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Template Key</Label>
                    <Input
                      placeholder="e.g. status_escalated"
                      value={newTemplate.template_key}
                      onChange={e => setNewTemplate(p => ({ ...p, template_key: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Unique identifier used in code</p>
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input
                      placeholder="Notification title"
                      value={newTemplate.title}
                      onChange={e => setNewTemplate(p => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Body</Label>
                    <Textarea
                      placeholder='Use {{report_title}}, {{category}}, {{location}} as placeholders'
                      value={newTemplate.body}
                      onChange={e => setNewTemplate(p => ({ ...p, body: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Input
                      placeholder="When this template is used"
                      value={newTemplate.description}
                      onChange={e => setNewTemplate(p => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                  <Button className="min-h-11 w-full sm:w-auto" variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
                  <Button className="min-h-11 w-full sm:w-auto" onClick={createTemplate} disabled={creatingTemplate}>
                    {creatingTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Manage notification templates sent to users. Use {"{{report_title}}"}, {"{{category}}"}, {"{{location}}"}, {"{{status}}"} as dynamic placeholders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {templatesLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading notification templates...</div>
          ) : templatesError ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div><p className="font-medium">Unable to load notification templates</p><p className="break-words text-sm text-muted-foreground">{templatesError}</p></div></div><Button variant="outline" className="min-h-11" onClick={() => void fetchTemplates()}>Retry templates</Button></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No templates configured yet</p>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="p-4 rounded-lg border bg-background/50">
                {editingId === template.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={editForm.title}
                        onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Body</Label>
                      <Textarea
                        value={editForm.body}
                        onChange={e => setEditForm(p => ({ ...p, body: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={editForm.description}
                        onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveTemplate(template.id)} disabled={saving === template.id}>
                        {saving === template.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-foreground">{template.title}</h4>
                          <Badge variant="outline" className="text-[10px]">{template.template_key}</Badge>
                          {template.is_active ? (
                            <Badge className="text-[10px] bg-accent/10 text-accent border-accent/30">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{template.body}</p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground/70 mt-1 italic">{template.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={() => toggleActive(template.id, template.is_active)}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditing(template)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Template Variables Reference */}
      <Card className="border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Template Variables Reference</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { var: "{{report_title}}", desc: "Short description of the report" },
              { var: "{{category}}", desc: "Issue category (e.g. Pothole, Garbage)" },
              { var: "{{location}}", desc: "Report location address" },
              { var: "{{status}}", desc: "Current report status" },
              { var: "{{user_name}}", desc: "Name of the reporting citizen" },
              { var: "{{date}}", desc: "Date of the report or status change" },
            ].map((item) => (
              <div key={item.var} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                <code className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">{item.var}</code>
                <span className="text-xs text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
