import { useState, useRef, useCallback } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const isMobile = useIsMobile();
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || refreshing) return;
    const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, [isMobile, refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - startY.current);
    // Dampen the pull distance
    setPullDistance(Math.min(diff * 0.5, 120));
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pulling, pullDistance, onRefresh]);

  if (!isMobile) return <>{children}</>;

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center transition-opacity duration-200",
          pullDistance > 10 ? "opacity-100" : "opacity-0"
        )}
        style={{ top: Math.max(pullDistance - 40, 0) }}
      >
        <div className={cn(
          "w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center backdrop-blur-sm",
          refreshing && "animate-pulse"
        )}>
          {refreshing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <ArrowDown
              className="w-5 h-5 text-primary transition-transform duration-200"
              style={{ transform: `rotate(${progress >= 1 ? 180 : 0}deg)` }}
            />
          )}
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{ transform: `translateY(${pullDistance}px)` }}
        className={cn(!pulling && !refreshing && "transition-transform duration-300")}
      >
        {children}
      </div>
    </div>
  );
};
