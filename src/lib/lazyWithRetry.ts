import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RECOVERY_KEY = "civicai:chunk-recovery";

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Failed to load module script|Importing a module script failed|Loading chunk .* failed/i.test(message);
}

/** Reloads once when a deployment replaces a chunk requested by an older tab. */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await importer();
      sessionStorage.removeItem(RECOVERY_KEY);
      return module;
    } catch (error) {
      if (isChunkLoadError(error) && sessionStorage.getItem(RECOVERY_KEY) !== "attempted") {
        sessionStorage.setItem(RECOVERY_KEY, "attempted");
        window.location.reload();
        return new Promise<never>(() => undefined);
      }
      throw error;
    }
  });
}

export function clearChunkRecoveryFlag() {
  sessionStorage.removeItem(RECOVERY_KEY);
}