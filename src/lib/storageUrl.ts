import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "civic-reports";
const SIGNED_TTL_SECONDS = 60 * 60;
const cache = new Map<string, { url: string; expiresAt: number }>();

/** Extract the object path inside the civic-reports bucket from a stored URL or raw path. */
export function toStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(value.slice(idx + marker.length).split("?")[0]);
}

export async function getSignedImageUrl(value: string | null | undefined): Promise<string | null> {
  const path = toStoragePath(value);
  if (!path) return value ?? null;

  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + (SIGNED_TTL_SECONDS - 60) * 1000 });
  return data.signedUrl;
}

/** Resolve a stored image URL/path into a short-lived signed URL. */
export function useSignedImageUrl(value: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!value) {
      setUrl(null);
      return;
    }
    getSignedImageUrl(value).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [value]);

  return url;
}
