import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { NavigationProgress } from "./components/NavigationProgress";
import { PageSkeleton } from "./components/PageSkeleton";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { useAuth } from "./hooks/useAuth";
import { destinationForRole } from "./lib/authRouting";

// Lazy-loaded pages — each becomes its own bundle chunk for faster nav.
const Index = lazyWithRetry(() => import("./pages/Index"));
const AdminHome = lazyWithRetry(() => import("./pages/AdminHome"));
const Report = lazyWithRetry(() => import("./pages/Report"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const HowItWorks = lazyWithRetry(() => import("./pages/HowItWorks"));
const MapPage = lazyWithRetry(() => import("./pages/Map"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const AdminAuth = lazyWithRetry(() => import("./pages/AdminAuth"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const ReportDetail = lazyWithRetry(() => import("./pages/ReportDetail"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"));
const Help = lazyWithRetry(() => import("./pages/Help"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const Forbidden = lazyWithRetry(() => import("./pages/Forbidden"));
const ServerError = lazyWithRetry(() => import("./pages/ServerError"));
const AdminDashboardHome = lazyWithRetry(() => import("./pages/admin/AdminDashboardHome"));
const AdminComplaints = lazyWithRetry(() => import("./pages/admin/AdminComplaints"));
const AdminDepartments = lazyWithRetry(() => import("./pages/admin/AdminDepartments"));
const AdminUsersPage = lazyWithRetry(() => import("./pages/admin/AdminUsersPage"));
const AdminAnalyticsPage = lazyWithRetry(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminMapPage = lazyWithRetry(() => import("./pages/admin/AdminMapPage"));
const AdminSettingsPage = lazyWithRetry(() => import("./pages/admin/AdminSettingsPage"));
const AdminActivityPage = lazyWithRetry(() => import("./pages/admin/AdminActivityPage"));
const AdminScheduledPage = lazyWithRetry(() => import("./pages/admin/AdminScheduledPage"));
const AdminNotificationsPage = lazyWithRetry(() => import("./pages/admin/AdminNotificationsPage"));

const RootRoute = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <PageSkeleton message="Preparing your workspace…" />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!role) return <Navigate to="/login" replace />;
  return <Navigate to={destinationForRole(role!, "/")} replace />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, err: any) => {
        // Don't retry auth / permission errors
        const code = err?.status || err?.code;
        if (code === 401 || code === 403 || code === 404) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
    },
  },
});

const User = (el: JSX.Element) => (
  <ProtectedRoute allowedRoles={["user"]}>{el}</ProtectedRoute>
);
const Admin = (el: JSX.Element) => (
  <ProtectedRoute allowedRoles={["admin"]}>{el}</ProtectedRoute>
);
const AnyAuth = (el: JSX.Element) => <ProtectedRoute>{el}</ProtectedRoute>;

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <OfflineBanner />
              <NavigationProgress />
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  {/* Public */}
                  <Route path="/" element={<RootRoute />} />
                  <Route path="/home" element={User(<Index />)} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/register" element={<Auth />} />
                  <Route path="/signup" element={<Auth />} />
                  <Route path="/admin-login" element={<AdminAuth />} />
                  <Route path="/admin/login" element={<AdminAuth />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/403" element={<Forbidden />} />
                  <Route path="/500" element={<ServerError />} />

                  {/* User-only */}
                  <Route path="/report" element={User(<Report />)} />
                  <Route path="/user/report-issue" element={User(<Report />)} />
                  <Route path="/dashboard" element={User(<Dashboard />)} />
                  <Route path="/track" element={User(<Dashboard />)} />
                  <Route path="/user/dashboard" element={User(<Dashboard />)} />
                  <Route path="/user/my-complaints" element={User(<Dashboard />)} />
                  <Route path="/user/complaint/:id" element={User(<ReportDetail />)} />
                  <Route path="/user/profile" element={User(<Profile />)} />
                  <Route path="/settings" element={User(<Settings />)} />
                  <Route path="/profile" element={User(<Profile />)} />
                  <Route path="/report/:id" element={User(<ReportDetail />)} />

                  {/* Map — any authenticated user */}
                  <Route path="/map" element={AnyAuth(<MapPage />)} />

                  {/* Admin-only */}
                  <Route path="/admin" element={Admin(<AdminHome />)} />
                  <Route path="/admin/dashboard" element={Admin(<AdminDashboardHome />)} />
                  <Route path="/admin/complaints" element={Admin(<AdminComplaints />)} />
                  <Route path="/admin/reports" element={Admin(<AdminComplaints />)} />
                  <Route path="/admin/issues" element={Admin(<AdminComplaints />)} />
                  <Route path="/admin/complaints/:id" element={Admin(<ReportDetail />)} />
                  <Route path="/admin/users" element={Admin(<AdminUsersPage />)} />
                  <Route path="/admin/staff" element={Admin(<AdminUsersPage />)} />
                  <Route path="/admin/departments" element={Admin(<AdminDepartments />)} />
                  <Route path="/admin/activity" element={Admin(<AdminActivityPage />)} />
                  <Route path="/admin/scheduled" element={Admin(<AdminScheduledPage />)} />
                  <Route path="/admin/scheduled-reports" element={Admin(<AdminScheduledPage />)} />
                  <Route path="/admin/notifications" element={Admin(<AdminNotificationsPage />)} />
                  <Route path="/admin/analytics" element={Admin(<AdminAnalyticsPage />)} />
                  <Route path="/admin/settings" element={Admin(<AdminSettingsPage />)} />
                  <Route path="/admin/map" element={Admin(<AdminMapPage />)} />

                  {/* Catch-all → 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
