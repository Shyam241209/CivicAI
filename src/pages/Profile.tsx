import { useSignedImageUrl } from "@/lib/storageUrl";
import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  User, Mail, Phone, Calendar, Shield, MapPin,
  Loader2, Camera, Trash2, Save, X,
} from "lucide-react";

interface ProfileRow {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  bio: string | null;
  address_line: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
}

const EMPTY: ProfileRow = {
  full_name: "", username: "", avatar_url: "", phone: "", date_of_birth: "",
  gender: "", bio: "", address_line: "", city: "", district: "",
  state: "", country: "India", pincode: "",
};

const Profile = () => {
  const { user, role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProfileRow>(EMPTY);
  const [initial, setInitial] = useState<ProfileRow>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        setLoadError(null);
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name,username,avatar_url,phone,date_of_birth,gender,bio,address_line,city,district,state,country,pincode")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        if (data) {
          const row: ProfileRow = { ...EMPTY, ...data };
          setForm(row);
          setInitial(row);
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Profile could not be loaded");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const initials = (form.full_name || user?.email || "U").slice(0, 2).toUpperCase();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const update = <K extends keyof ProfileRow>(k: K, v: ProfileRow[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const avatarSignedUrl = useSignedImageUrl(form.avatar_url);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { user_id: user.id, ...form, date_of_birth: form.date_of_birth || null };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error("Could not save profile", { description: error.message });
    setInitial(form);
    toast.success("Profile saved");
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/avatars/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error: upErr } = await supabase.storage.from("civic-reports").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error("Upload failed", { description: upErr.message }); }
    update("avatar_url", path);
    setUploading(false);
    toast.success("Photo uploaded — click Save to keep changes");
  };

  const handleRemovePhoto = () => update("avatar_url", "");

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading your profile…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-xl font-semibold">Profile unavailable</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your personal information</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setForm(initial)} disabled={!dirty || saving}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={!dirty || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile
            </Button>
          </div>
        </div>

        {/* Avatar + identity */}
        <Card className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="w-24 h-24 md:w-28 md:h-28 ring-2 ring-primary/20">
                {avatarSignedUrl ? <AvatarImage src={avatarSignedUrl} alt="Profile" /> : null}
                <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left space-y-2">
                <h2 className="text-xl font-semibold">{form.full_name || user?.email || "Unnamed User"}</h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <Badge variant="secondary" className="capitalize">{role || "citizen"}</Badge>
                  <Badge variant="outline" className="text-accent border-accent/30">
                    <Shield className="w-3 h-3 mr-1" /> Verified
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 pt-1 justify-center md:justify-start">
                  <input
                    ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                    {form.avatar_url ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {form.avatar_url && (
                    <Button size="sm" variant="ghost" onClick={handleRemovePhoto}>
                      <Trash2 className="w-4 h-4 mr-2" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal */}
        <Card className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <CardTitle>Personal Information</CardTitle>
            </div>
            <CardDescription>Your identity details</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={form.full_name || ""} onChange={(e) => update("full_name", e.target.value)} placeholder="Your full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={form.username || ""} onChange={(e) => update("username", e.target.value)} placeholder="username" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</Label>
              <Input value={user?.email || ""} readOnly disabled className="bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</Label>
              <Input value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date of Birth</Label>
              <Input type="date" value={form.date_of_birth || ""} onChange={(e) => update("date_of_birth", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender || ""} onValueChange={(v) => update("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Bio / About Me</Label>
              <Textarea rows={3} value={form.bio || ""} onChange={(e) => update("bio", e.target.value)} placeholder="A short bio about yourself" />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <CardTitle>Address</CardTitle>
            </div>
            <CardDescription>Where you're based</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Address Line</Label>
              <Input value={form.address_line || ""} onChange={(e) => update("address_line", e.target.value)} placeholder="House / Street" />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city || ""} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>District</Label>
              <Input value={form.district || ""} onChange={(e) => update("district", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={form.state || ""} onChange={(e) => update("state", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country || ""} onChange={(e) => update("country", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Pincode</Label>
              <Input value={form.pincode || ""} onChange={(e) => update("pincode", e.target.value)} placeholder="6-digit PIN" />
            </div>
          </CardContent>
        </Card>

        {/* Account meta */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>Account</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
            <div><span className="text-muted-foreground">User ID:</span> <span className="font-mono text-xs">{user?.id?.slice(0, 8)}…</span></div>
            <div><span className="text-muted-foreground">Role:</span> <span className="capitalize">{role || "user"}</span></div>
            <div><span className="text-muted-foreground">Member since:</span> {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "—"}</div>
            <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="text-accent border-accent/30">Active</Badge></div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Profile;
