import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ServerCrash } from "lucide-react";

const ServerError = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-background">
    <div className="max-w-md text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
        <ServerCrash className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold">500 — Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        Our servers hit a snag. Please try again in a moment.
      </p>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        <Button asChild><Link to="/">Go home</Link></Button>
      </div>
    </div>
  </div>
);

export default ServerError;