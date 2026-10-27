import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { clearChunkRecoveryFlag } from "@/lib/lazyWithRetry";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    if (import.meta.env.DEV) console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    clearChunkRecoveryFlag();
    this.setState({ hasError: false, error: undefined });
    window.location.href = "/login";
  };

  retry = () => {
    clearChunkRecoveryFlag();
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">We couldn’t load this page.</h1>
          <p className="text-sm text-muted-foreground">
            Please retry this page. If the problem continues, refresh the application.
          </p>
          {import.meta.env.DEV && this.state.error?.message && (
            <pre className="max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-xs whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={this.retry} variant="outline">Retry</Button>
            <Button onClick={this.reset}>Go home</Button>
            <Button onClick={() => { clearChunkRecoveryFlag(); window.location.reload(); }} variant="secondary">
              Refresh application
            </Button>
          </div>
        </div>
      </div>
    );
  }
}