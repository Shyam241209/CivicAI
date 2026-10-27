declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Promise<Response> | Response
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare module "https://esm.sh/@supabase/supabase-js@2.80.0" {
  export * from "@supabase/supabase-js";
}

declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };
  function serve(
    handler: (req: Request) => Promise<Response> | Response
  ): void;
}
