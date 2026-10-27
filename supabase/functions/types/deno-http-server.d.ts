export function serve(
  handler: (req: Request) => Promise<Response> | Response
): void;
