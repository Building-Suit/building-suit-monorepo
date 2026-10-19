// Minimal host interface for checking the portable Edge Function from Node CI.
// Actual runtime loading is checked separately by the disposable provider job.
declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): unknown
}
