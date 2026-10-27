import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutDashboard, FileText, Users, Building2, BarChart3, Settings, LogOut, ShieldCheck, Map as MapIcon, Menu, Bell, UserCircle, Activity, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import adminBackground from "@/assets/admin.jpg";
import accentTreatment from "@/assets/accent-bg.jpg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { to: "/admin", label: "Home", icon: Home },
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/staff", label: "Staff & Admins", icon: Users },
  { to: "/admin/departments", label: "Departments", icon: Building2 },
  { to: "/admin/activity", label: "Activity Log", icon: Activity },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/scheduled-reports", label: "Scheduled Reports", icon: CalendarCheck },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/map", label: "Map View", icon: MapIcon },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const SidebarContent = ({
  onNavigate,
  onLogout,
  loggingOut,
  email,
  collapsed = false,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  email?: string;
  collapsed?: boolean;
}) => {
  const location = useLocation();
  const visibleItems = navItems;

  return (
    <div className="flex h-full flex-col bg-white text-slate-800">
      <div className={cn("border-b border-slate-200 py-5", collapsed ? "px-2" : "px-5")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-success border-2 border-background" />
          </div>
          <div className={cn("min-w-0", collapsed && "hidden")}>
            <p className="font-bold leading-tight tracking-tight">CivicAI Admin</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Tamil Nadu Civic Administration</p>
          </div>
        </div>
      </div>
      <div className={cn("pb-2 pt-5", collapsed ? "px-2" : "px-5")}>
        <p className={cn("text-[10px] font-semibold uppercase tracking-widest text-slate-500", collapsed && "sr-only")}>Admin Portal</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {visibleItems.map((item) => {
          const active = item.to === "/admin"
            ? location.pathname === "/admin"
            : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all relative",
                collapsed && "justify-center px-2",
                active
                  ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              )}
            >
              <Icon className={cn("w-4 h-4 transition-transform", !active && "group-hover:scale-110")} />
              <span className={cn(collapsed && "sr-only")}>{item.label}</span>
              {active && <span className={cn("h-1.5 w-1.5 rounded-full bg-primary-foreground", !collapsed && "ml-auto")} />}
            </Link>
          );
        })}
      </nav>
      <div className={cn("mx-3 mb-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3", collapsed && "hidden")}>
        <p className="truncate text-xs font-semibold text-slate-800">{email || "Administrator"}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Admin account</p>
      </div>
      <div className="border-t border-slate-200 p-3">
        <Button
          variant="ghost"
          title={collapsed ? "Logout" : undefined}
          className={cn("w-full rounded-xl text-sm text-destructive hover:bg-destructive/10 hover:text-destructive", collapsed ? "justify-center px-2" : "justify-start")}
          onClick={onLogout}
          disabled={loggingOut}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-3")} />
          <span className={cn(collapsed && "sr-only")}>{loggingOut ? "Logging out..." : "Logout"}</span>
        </Button>
      </div>
    </div>
  );
};

export const AdminLayout = ({
  children,
  title,
  primaryBackground = adminBackground,
}: {
  children: ReactNode;
  title?: string;
  primaryBackground?: string;
}) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Unable to sign out from the admin portal", error);
      toast({ title: "Logout failed", description: "Unable to sign out. Please try again.", variant: "destructive" });
      setLoggingOut(false);
    }
  };

  const email = user?.email;

  return (
    <div className="admin-portal relative isolate min-h-screen w-full overflow-x-hidden [&_.bg-card]:border-slate-200 [&_.bg-card]:bg-white [&_.bg-card]:backdrop-blur-none [&_.bg-card]:shadow-sm">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${primaryBackground})` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 z-10 bg-cover bg-center bg-no-repeat opacity-[0.05] mix-blend-soft-light"
        style={{ backgroundImage: `url(${accentTreatment})` }}
        aria-hidden="true"
      />
      <div className="pointer-events-none fixed inset-0 z-10 bg-white/75 backdrop-blur-[1px]" aria-hidden="true" />
      <div className="relative z-20 min-h-screen bg-transparent">
        <aside id="admin-desktop-sidebar" className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-300 ease-in-out lg:flex", sidebarCollapsed ? "w-16" : "w-64")}>
          <SidebarContent onLogout={() => void handleLogout()} loggingOut={loggingOut} email={email} collapsed={sidebarCollapsed} />
        </aside>

        <div className={cn("min-h-screen transition-[padding] duration-300 ease-in-out", sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")}>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 text-slate-900 shadow-sm backdrop-blur-md md:px-6">
            <Button
              size="icon"
              variant="outline"
              className="hidden h-10 min-h-10 w-10 min-w-10 cursor-pointer rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary lg:inline-flex"
              aria-label="Toggle admin sidebar"
              aria-expanded={!sidebarCollapsed}
              aria-controls="admin-desktop-sidebar"
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 min-h-10 w-10 min-w-10 cursor-pointer rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
                  aria-label="Open admin navigation"
                  aria-expanded={open}
                  aria-controls="admin-mobile-navigation"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent id="admin-mobile-navigation" side="left" className="w-[80vw] max-w-sm p-0">
                <SidebarContent
                  onNavigate={() => setOpen(false)}
                  onLogout={() => void handleLogout()}
                  loggingOut={loggingOut}
                  email={email}
                />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">CivicAI Admin</p>
              <h1 className="truncate text-lg font-bold leading-tight md:text-xl">{title || "Dashboard"}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="hidden gap-1.5 rounded-full border-success/30 bg-success/5 text-[11px] font-medium text-success sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live
              </Badge>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full text-slate-600 hover:bg-slate-100" aria-label="Open admin profile menu">
                    <UserCircle className="h-7 w-7" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem disabled className="cursor-default opacity-100">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span className="truncate">{email || "Admin profile"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void handleLogout()} disabled={loggingOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    {loggingOut ? "Logging out..." : "Logout"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1440px] p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};