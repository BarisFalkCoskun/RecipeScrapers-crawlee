import { Readable } from "node:stream";
import { ImpitHttpClient } from "@crawlee/impit-client";
import type { HttpRequest, RedirectHandler, StreamingHttpResponse } from "crawlee";

/** The installed Impit adapter classifies every 3xx (including 304) as a redirect.
 * Use its public, non-redirecting buffered API for conditional GETs and follow
 * only actual redirects. Keep ordinary streaming requests on the existing path.
 */
export class ConditionalImpitHttpClient extends ImpitHttpClient {
  private readonly conditionalClient: ImpitHttpClient;
  constructor(options: ConstructorParameters<typeof ImpitHttpClient>[0]) {
    super(options);
    this.conditionalClient = new ImpitHttpClient({ ...options, followRedirects: false });
  }
  override async stream(request: HttpRequest, onRedirect?: RedirectHandler): Promise<StreamingHttpResponse> {
    if (!Object.keys(request.headers ?? {}).some((name) => /^(if-none-match|if-modified-since)$/iu.test(name))) {
      return super.stream(request, onRedirect);
    }
    const redirectUrls: URL[] = [];
    let current = request;
    while (true) {
      const response = await this.conditionalClient.sendRequest({ ...current, responseType: "buffer" });
      if (![301, 302, 303, 307, 308].includes(response.statusCode)) {
        const body = Buffer.from(response.body);
        return { ...response, request,
          headers: response.statusCode === 304 ? { "content-type": "text/plain", ...response.headers } : response.headers,
          redirectUrls, stream: Readable.from(body.length ? [body] : []),
          downloadProgress: { percent: 100, transferred: body.length, total: body.length }, uploadProgress: { percent: 100, transferred: 0 } };
      }
      if (redirectUrls.length >= 10) throw new Error("Too many redirects, maximum is 10");
      const location = response.headers["location"];
      if (typeof location !== "string") throw new Error("Redirect response missing location header");
      const next = new URL(location, current.url);
      redirectUrls.push(next);
      const updated = { url: next.href as string | URL, headers: { ...current.headers } };
      onRedirect?.({ ...response, redirectUrls }, updated);
      if (new URL(updated.url).origin !== new URL(current.url).origin) {
        for (const name of Object.keys(updated.headers)) {
          if (/^(authorization|proxy-authorization|cookie|host|if-none-match|if-modified-since)$/iu.test(name)) delete updated.headers[name];
        }
      }
      current = { ...current, url: updated.url, headers: updated.headers };
    }
  }
}
