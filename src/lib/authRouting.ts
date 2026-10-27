export type AuthRole = "user" | "admin" | "staff";

export const homeForRole = (role: AuthRole): "/admin" | "/home" =>
  role === "admin" ? "/admin" : "/home";

export const isAdminPath = (path?: string | null): boolean =>
  !!path && (path === "/admin" || path.startsWith("/admin/"));

export const isCitizenPath = (path?: string | null): boolean => {
  if (!path || isAdminPath(path)) return false;
  return ["/home", "/report", "/dashboard", "/track", "/user/", "/settings", "/profile", "/map"]
    .some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

export const destinationForRole = (role: AuthRole, requestedPath?: string | null): "/admin" | "/home" | string => {
  if (role === "admin") {
    return isAdminPath(requestedPath) ? requestedPath! : "/admin";
  }

  return requestedPath && isCitizenPath(requestedPath) ? requestedPath : "/home";
};
