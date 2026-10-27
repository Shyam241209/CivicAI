import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

const AdminNotificationsPage = () => (
  <AdminLayout title="Notifications">
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" /> Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Use the notification bell in the admin toolbar to review and mark notifications as read.
      </CardContent>
    </Card>
  </AdminLayout>
);

export default AdminNotificationsPage;
