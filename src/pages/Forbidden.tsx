import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";

const Forbidden = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-background">
    <div className="max-w-md text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
        <ShieldOff className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold">403 — Access denied</h1>
      <p className="text-sm text-muted-foreground">
        You don't have permission to view this page.
      </p>
      <Button asChild><Link to="/">Go home</Link></Button>
    </div>
  </div>
);

export default Forbidden;