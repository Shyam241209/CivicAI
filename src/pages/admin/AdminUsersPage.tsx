import { AdminLayout } from "@/components/AdminLayout";
import AdminUserManagement from "@/components/AdminUserManagement";

const AdminUsersPage = () => (
  <AdminLayout title="Users & Admins">
    <AdminUserManagement />
  </AdminLayout>
);

export default AdminUsersPage;