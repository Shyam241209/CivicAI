import { memo } from "react";
import { motion } from "framer-motion";

const PARTICLES = Array.from({ length: 18 }).map((_, i) => ({
  id: i,
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  size: 2 + (i % 3),
  duration: 12 + (i % 7) * 2,
  delay: (i % 5) * 1.2,
}));

/**
 * Animated government-style backdrop: soft gradient, floating blur circles,
 * drifting particles and a faint dotted grid. Purely decorative.
 */
export const AuthBackground = memo(() => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
    {/* Base gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/40 to-primary/5" />

    {/* Slowly shifting gradient wash */}
    <motion.div
      className="absolute inset-0 opacity-60"
      style={{
        background:
          "radial-gradient(60% 60% at 15% 20%, hsl(var(--primary) / 0.14), transparent 70%), radial-gradient(50% 50% at 85% 80%, hsl(var(--accent) / 0.12), transparent 70%)",
      }}
      animate={{ opacity: [0.45, 0.7, 0.45] }}
      transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* Floating blur circles */}
    <motion.div
      className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl"
      animate={{ y: [0, 30, 0], x: [0, 20, 0] }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute top-1/3 -right-28 h-96 w-96 rounded-full bg-accent/15 blur-3xl"
      animate={{ y: [0, -40, 0], x: [0, -20, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
    />
    <motion.div
      className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[#FF9933]/10 blur-3xl"
      animate={{ y: [0, -25, 0] }}
      transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 4 }}
    />

    {/* Dotted grid */}
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "34px 34px",
      }}
    />

    {/* Particles */}
    {PARTICLES.map((p) => (
      <motion.span
        key={p.id}
        className="absolute rounded-full bg-primary/30"
        style={{
          left: `${p.left}%`,
          top: `${p.top}%`,
          width: p.size,
          height: p.size,
        }}
        animate={{ y: [0, -60, 0], opacity: [0, 0.8, 0] }}
        transition={{
          duration: p.duration,
          repeat: Infinity,
          delay: p.delay,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
));

AuthBackground.displayName = "AuthBackground";
