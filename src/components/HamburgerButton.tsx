import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Animated hamburger (☰ ↔ ✕). Drives the shadcn sidebar: collapses/expands on
 * desktop + tablet, opens/closes the drawer on mobile.
 */
export const HamburgerButton = ({ className }: { className?: string }) => {
  const { toggleSidebar, state, isMobile, openMobile } = useSidebar();
  const isOpen = isMobile ? openMobile : state === "expanded";

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={isOpen}
      aria-controls="app-sidebar"
      className={cn(
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
        "text-foreground transition-colors hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <span className="relative block h-4 w-5" aria-hidden="true">
        <span className="absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current" />
        <span className="absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 rounded-full bg-current" />
        <span className="absolute left-0 bottom-0 h-0.5 w-5 rounded-full bg-current" />
      </span>
    </button>
  );
};