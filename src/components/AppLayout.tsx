import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Home, FileText, LayoutDashboard, Map as MapIcon, Info, ShieldCheck,
  User, Flag, Settings, HelpCircle, FileLock, ScrollText, Sparkles, LogOut,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import { LanguageSelector } from "./LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/translations";
import { useAuth } from "@/hooks/useAuth";
import { GovernmentBackground } from "./GovernmentBackground";
import { cn } from "@/lib/utils";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { HamburgerButton } from "./HamburgerButton";

interface AppLayoutProps {
  children: React.ReactNode;
  overlay?: "light" | "medium" | "dark";
}

interface NavItem { to: string; icon: React.ElementType; label: string }

const APP_VERSION = "1.0.0";
const SIDEBAR_KEY = "civicai:sidebar";

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Track Reports",
  "/report": "Report Issue",
  "/map": "Map View",
  "/profile": "Profile",
  "/settings": "Settings",
  "/admin": "Admin Dashboard",
  "/how-it-works": "How it Works",
  "/privacy": "Privacy Policy",
  "/terms": "Terms of Service",
  "/help": "Help & Support",
};

function usePageTitle() {
  const { pathname } = useLocation();
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const seg = pathname.split("/").filter(Boolean)[0] || "Home";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

function useNavItems(): NavItem[] {
  const { language } = useLanguage();
  const t = (k: string) => getTranslation(language, k);
  const { user, role } = useAuth();

  if (!user) return [
    { to: "/home", icon: Home, label: t("home") },
    { to: "/how-it-works", icon: Info, label: t("howItWorks") },
    { to: "/auth", icon: User, label: "Sign In" },
    { to: "/admin-login", icon: ShieldCheck, label: "Admin" },
  ];
  if (role === "admin") return [
    { to: "/admin", icon: ShieldCheck, label: "Dashboard" },
    { to: "/map", icon: MapIcon, label: t("mapView") },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];
  return [
    { to: "/home", icon: Home, label: t("home") },
    { to: "/report", icon: FileText, label: t("reportIssue") },
    { to: "/dashboard", icon: LayoutDashboard, label: "Track Reports" },
    { to: "/map", icon: MapIcon, label: t("mapView") },
    { to: "/profile", icon: User, label: "Profile" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];
}

function AppSidebar() {
  const { pathname } = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const items = useNavItems();
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.email || "U").slice(0, 2).toUpperCase();
  // Mobile: selecting any menu item closes the drawer.
  const closeOnMobile = () => { if (isMobile) setOpenMobile(false); };

  const handleLogout = async () => {
    closeOnMobile();
    await signOut();
    navigate("/login", { replace: true });
  };

  const footerLinks = [
    { to: "/privacy", label: "Privacy Policy", icon: FileLock },
    { to: "/terms", label: "Terms", icon: ScrollText },
    { to: "/how-it-works", label: "About App", icon: Sparkles },
    { to: "/help", label: "Help & Support", icon: HelpCircle },
  ];

  return (
      <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/home" onClick={closeOnMobile} className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shrink-0">
            <Flag className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-base">CivicAI</span>}
        </Link>
        {user && !collapsed && (
          <>
            <Separator className="my-1" />
            <Link
              to="/settings"
              onClick={closeOnMobile}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{user.email}</p>
                <p className="text-[10px] text-muted-foreground">{role === "admin" ? "Administrator" : "Citizen"}</p>
              </div>
            </Link>
          </>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.to;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <NavLink to={item.to} end onClick={closeOnMobile} className="transition-colors">
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {footerLinks.map((l) => (
            <SidebarMenuItem key={l.to}>
              <SidebarMenuButton asChild tooltip={l.label} size="sm">
                <NavLink to={l.to} onClick={closeOnMobile}>
                  <l.icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs">{l.label}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {user && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Logout"
                size="sm"
                onClick={handleLogout}
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="text-xs">Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        {!collapsed && (
          <div className="px-3 pt-2 pb-1 text-[10px] text-muted-foreground">
            Version {APP_VERSION}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export const AppLayout = ({ children, overlay = "medium" }: AppLayoutProps) => {
  const { user } = useAuth();
  const title = usePageTitle();

  // Restore persisted collapse state; shadcn Sidebar reads cookie `sidebar_state`,
  // but we also sync a localStorage key for cross-session recall.
  const [defaultOpen, setDefaultOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(SIDEBAR_KEY);
    return v === null ? true : v === "true";
  });
  // Persist the collapse state on unmount / tab hide instead of polling the
  // cookie every second (the old interval re-rendered every page once a second).
  useEffect(() => {
    const persist = () => {
      const match = document.cookie.match(/sidebar_state=(true|false)/);
      if (match) localStorage.setItem(SIDEBAR_KEY, match[1]);
    };
    document.addEventListener("visibilitychange", persist);
    window.addEventListener("pagehide", persist);
    return () => {
      persist();
      document.removeEventListener("visibilitychange", persist);
      window.removeEventListener("pagehide", persist);
    };
  }, []);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <GovernmentBackground overlay={overlay}>
        <div className="flex min-h-dvh w-full">
          <AppSidebar />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar: hamburger (mobile + collapse), brand spacer, language + bell */}
            <header
              className={cn(
                "sticky top-0 z-40 h-14 flex items-center gap-2 px-3 md:px-4",
                "bg-background/85 backdrop-blur-lg border-b border-border"
              )}
            >
              <HamburgerButton />
              <h1 className="text-sm md:text-base font-semibold truncate">{title}</h1>
              <div className="flex-1" />
              <LanguageSelector />
              {user && <NotificationBell />}
            </header>

            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </div>
      </GovernmentBackground>
    </SidebarProvider>
  );
};
