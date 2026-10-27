import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Trash2, Shield, Mail } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in: string | null;
}

interface AdminsFunctionResponse {
  admins?: AdminUser[];
  error?: string;
  message?: string;
}

const AdminUserManagement = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAuthError = useCallback(async (error: unknown): Promise<boolean> => {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error || "");
    const msg = message.toLowerCase();
    if (msg.includes("401") || msg.includes("unauthorized")) {
      await supabase.auth.signOut();
      toast({
        title: "Session expired",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
      navigate("/admin-login");
      return true;
    }
    return false;
  }, [navigate, toast]);

  const fetchAdmins = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin-login");
        return;
      }
      const response = await supabase.functions.invoke("manage-admins", {
        body: { action: "list" },
      });
      if (response.error) throw response.error;
      const data = response.data as AdminsFunctionResponse | null;
      setAdmins(data?.admins || []);
    } catch (error: unknown) {
      if (await handleAuthError(error)) return;
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message)
          : String(error || "Failed to load admins");
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast, handleAuthError]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null && "message" in error) {
      return String((error as { message?: unknown }).message) || fallback;
    }
    return fallback;
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const response = await supabase.functions.invoke("manage-admins", {
        body: { action: "invite", email: inviteEmail.trim() },
      });
      if (response.error) throw response.error;
      const data = response.data as AdminsFunctionResponse | null;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Success", description: data?.message || "Admin invited." });
      setInviteEmail("");
      fetchAdmins();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to invite admin"),
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      const response = await supabase.functions.invoke("manage-admins", {
        body: { action: "remove", userId },
      });
      if (response.error) throw response.error;
      const data = response.data as AdminsFunctionResponse | null;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Success", description: data?.message || "Admin removed." });
      fetchAdmins();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to remove admin"),
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Admin */}
      <Card className="border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite New Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter email address..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
            <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
              {isInviting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            If the user already has an account, they'll be promoted to admin. Otherwise, an invitation email will be sent.
          </p>
        </CardContent>
      </Card>

      {/* Admin List */}
      <Card className="border-2 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Current Admins ({admins.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No admins found</p>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-4 rounded-xl border bg-background/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{admin.email}</p>
                      <Badge variant="secondary" className="text-xs">Admin</Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span>Added: {new Date(admin.created_at).toLocaleDateString()}</span>
                      {admin.last_sign_in && (
                        <span>Last login: {new Date(admin.last_sign_in).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Admin</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove admin access for{" "}
                          <strong>{admin.email}</strong>? They will no longer be able to access the admin dashboard.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemove(admin.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {removingId === admin.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserManagement;
