import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Building2, Mail, Phone, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  officer_name: string | null;
  contact_email: string | null;
  phone: string | null;
  description: string | null;
  max_active_complaints: number;
}

interface DepartmentAssignmentRow {
  assigned_department_id: string | null;
  status: string;
}

const empty: Omit<Department, "id"> = { name: "", officer_name: "", contact_email: "", phone: "", description: "", max_active_complaints: 50 };

const AdminDepartmentsPanel = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<Omit<Department, "id">>(empty);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDepartments = async () => {
      const [{ data, error }, countsRes] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase
          .from("civic_reports")
          .select("assigned_department_id, status")
          .not("assigned_department_id", "is", null)
          .neq("status", "resolved")
          .neq("status", "rejected"),
      ]);
      const countsError = countsRes?.error;
      if (error || countsError) {
        const err = error || countsError;
        toast({ title: "Error", description: err?.message ?? "Failed to load department data.", variant: "destructive" });
        setLoading(false);
        return;
      }

      setDepartments((data as Department[]) || []);
      const counts: Record<string, number> = {};
      ((countsRes.data as DepartmentAssignmentRow[]) || []).forEach((r) => {
        if (!r.assigned_department_id) return;
        counts[r.assigned_department_id] = (counts[r.assigned_department_id] || 0) + 1;
      });
      setActiveCounts(counts);
      setLoading(false);
    };

    fetchDepartments();
  }, [toast]);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (d: Department) => {
    setEditing(d);
    setForm({
      name: d.name,
      officer_name: d.officer_name || "",
      contact_email: d.contact_email || "",
      phone: d.phone || "",
      description: d.description || "",
      max_active_complaints: d.max_active_complaints ?? 50,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const payload = {
      name: form.name.trim(),
      officer_name: form.officer_name?.trim() || null,
      contact_email: form.contact_email?.trim() || null,
      phone: form.phone?.trim() || null,
      description: form.description?.trim() || null,
      max_active_complaints: Math.max(1, Number(form.max_active_complaints) || 50),
    };
    const { error } = editing
      ? await supabase.from("departments").update(payload).eq("id", editing.id)
      : await supabase.from("departments").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Department updated" : "Department added" });
    setOpen(false);
    fetchDepartments();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this department?")) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Department deleted" });
    fetchDepartments();
  };

  return (
    <Card className="border-2 bg-card/95 backdrop-blur-sm">
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold">Departments</h2>
            <p className="text-sm text-muted-foreground">Manage departments that can be assigned to complaints.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={startNew}><Plus className="w-4 h-4 mr-2" />Add Department</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Department" : "New Department"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Officer Name</Label><Input value={form.officer_name || ""} onChange={(e) => setForm({ ...form, officer_name: e.target.value })} /></div>
                <div><Label>Contact Email</Label><Input type="email" value={form.contact_email || ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div>
                  <Label>Capacity (max active complaints)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.max_active_complaints ?? 50}
                    onChange={(e) => setForm({ ...form, max_active_complaints: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">When the active workload reaches this limit, admins will be warned before new assignments.</p>
                </div>
                <div><Label>Description</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>{editing ? "Save Changes" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && departments.length === 0 && <p className="text-sm text-muted-foreground">No departments yet. Click "Add Department" to create one.</p>}
          {departments.map((d) => {
            const active = activeCounts[d.id] || 0;
            const cap = d.max_active_complaints || 50;
            const pct = Math.min(100, Math.round((active / cap) * 100));
            const over = active >= cap;
            const near = !over && pct >= 80;
            return (
              <Card key={d.id} className="rounded-2xl border-2">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <h3 className="font-semibold">{d.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(d)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                  {d.description && <p className="text-sm text-muted-foreground mb-3">{d.description}</p>}
                  <div className="space-y-1 text-sm">
                    {d.officer_name && <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-muted-foreground" />{d.officer_name}</div>}
                    {d.contact_email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{d.contact_email}</div>}
                    {d.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{d.phone}</div>}
                  </div>
                  <div className="mt-4 pt-3 border-t">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Workload</span>
                      <span className={over ? "text-destructive font-semibold" : near ? "text-warning font-semibold" : "text-foreground font-medium"}>
                        {active} / {cap} active
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${over ? "bg-destructive" : near ? "bg-warning" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminDepartmentsPanel;