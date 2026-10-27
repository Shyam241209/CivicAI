export {};

declare global {
  const Deno: {
    env: {
      get(name: string): string | undefined;
    };
    serve(handler: (req: Request) => Promise<Response> | Response): void;
  };
}
