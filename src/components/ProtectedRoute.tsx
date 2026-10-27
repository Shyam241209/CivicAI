import { Navigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/PageSkeleton";
import { homeForRole } from "@/lib/authRouting";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageSkeleton message="Checking your session…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !role) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={homeForRole(role)} replace />;
  }

  return <>{children}</>;
};
