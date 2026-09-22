/** Opt-in, loopback-only transport and browser identity audit. No source crawling. */
import { createServer } from "node:http";
import { once } from "node:events";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { Impit } from "impit";
import * as factories from "../danish-jsonld/crawler-factories.js";
import { DANISH_JSONLD_SOURCES } from "../danish-jsonld/source-registry.js";

interface BrowserSnapshot {
  userAgent: string;
  platform: string;
  brands: Array<{ brand: string; version: string }>;
  clientHintPlatform: string;
  webgl: Record<string, unknown>;
  webgl2: Record<string, unknown>;
}

const pickIdentity = (headers: Record<string, unknown>) => Object.fromEntries(
  Object.entries(headers).filter(([key]) => /^(user-agent|sec-ch-ua.*|accept-language)$/iu.test(key))
);
const captures: Array<Record<string, unknown>> = [];
const server = createServer((request, response) => {
  captures.push({ path: request.url, ...pickIdentity(request.headers) });
  response.setHeader("Content-Type", "text/html");
  response.end("<!doctype html><title>Local identity diagnostic</title>");
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("No local address");
const origin = `http://127.0.0.1:${address.port}`;

const snapshot = `(() => {
  const inspect = (name, Constructor) => {
    const gl = document.createElement('canvas').getContext(name);
    if (!gl || !Constructor) return { available: false };
    const fn = Constructor.prototype.getParameter;
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    let illegalReceiver;
    try { illegalReceiver = { returned: fn.call({}, 0x9246) }; }
    catch (error) { illegalReceiver = { error: error.name }; }
    return {
      available: true,
      functionName: fn.name,
      functionSource: Function.prototype.toString.call(fn),
      illegalReceiver,
      vendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
      renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    };
  };
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    brands: navigator.userAgentData?.brands,
    clientHintPlatform: navigator.userAgentData?.platform,
    webgl: inspect('webgl', window.WebGLRenderingContext),
    webgl2: inspect('webgl2', window.WebGL2RenderingContext),
  };
})()`;

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  for (const profile of ["chrome", "chrome151"] as const) {
    await (await new Impit({ browser: profile }).fetch(`${origin}/${profile}`)).text();
  }
  const generated = Array.from({ length: 20 }, () => factories.createDanishJsonLdBrowserIdentity());
  await (await new Impit({ browser: "chrome" }).fetch(`${origin}/generated`, { headers: generated[0] })).text();

  const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "arla")!;
  const diagnosticSource = { ...source, requestSettings: { ...source.requestSettings, delaySeconds: 0 } };
  const crawler = factories.createDanishJsonLdCheerioCrawler({ source: diagnosticSource, requestHandler: async () => undefined }) as unknown as {
    httpClient: { impitOptions?: { browser?: string }; sendRequest: (request: unknown) => Promise<unknown> };
    preNavigationHooks: Array<(context: unknown, options: { headers?: Record<string, unknown> }) => Promise<void>>;
  };
  const request = { url: `${origin}/factory`, headers: { "User-Agent": "Contradictory/1", "Sec-CH-UA": '"Firefox";v="1"', "X-Source": "preserved" } };
  const requestOptions: { headers?: Record<string, unknown> } = { headers: { ...request.headers } };
  for (const hook of crawler.preNavigationHooks) await hook({ request }, requestOptions);
  await crawler.httpClient.sendRequest({ url: request.url, method: "GET", responseType: "text", headers: requestOptions.headers });

  browser = await chromium.launch({ channel: "chromium", headless: true });
  const nativeContext = await browser.newContext();
  const nativePage = await nativeContext.newPage();
  await nativePage.goto(`${origin}/browser-native`);
  const native = await nativePage.evaluate<BrowserSnapshot>(snapshot);

  const browserCrawler = factories.createDanishJsonLdPlaywrightCrawler({ source: diagnosticSource, requestHandler: async () => undefined }) as unknown as {
    preNavigationHooks: Array<(context: unknown) => Promise<void>>;
    launchContext: { launchOptions: NonNullable<Parameters<typeof chromium.launch>[0]> & NonNullable<Parameters<typeof browser.newContext>[0]> };
  };
  await browser.close();
  const { locale, timezoneId, screen, viewport, ...launchOptions } = browserCrawler.launchContext.launchOptions;
  browser = await chromium.launch({ ...launchOptions, headless: true });
  const factoryContext = await browser.newContext({ locale, timezoneId, screen, viewport });
  const factoryPage = await factoryContext.newPage();
  for (const hook of browserCrawler.preNavigationHooks) await hook({ page: factoryPage, request: { url: `${origin}/browser-factory` } });
  await factoryPage.goto(`${origin}/browser-factory`);
  const factoryBrowser = await factoryPage.evaluate<BrowserSnapshot>(snapshot);

  const patchedPage = await factoryContext.newPage();
  // Retained only for comparison with the old override, never enabled by this audit in a crawler.
  await patchedPage.addInitScript(factories.DANISH_JSONLD_WEBGL_INIT_SCRIPT);
  await patchedPage.goto(`${origin}/browser-legacy-webgl`);
  const legacyWebgl = await patchedPage.evaluate<BrowserSnapshot>(snapshot);
  console.log(JSON.stringify({
    scope: "Loopback HTTP headers and browser JavaScript only; no TLS fingerprint or external block-rate measurement",
    configuredImpitProfile: crawler.httpClient.impitOptions?.browser,
    bundledBrowserVersion: browser.version(),
    generatedMajors: [...new Set(generated.map((headers) => headers["user-agent"]?.match(/Chrome\/(\d+)/u)?.[1]))],
    captures,
    native,
    factoryBrowser,
    legacyWebgl,
  }, null, 2));
  if (process.argv.includes("--verify")) {
    const profile = captures.find((entry) => entry.path === "/chrome151");
    const effective = captures.find((entry) => entry.path === "/factory");
    assert.ok(profile && effective, "Profile and factory requests must reach loopback");
    assert.equal(crawler.httpClient.impitOptions?.browser, "chrome151");
    for (const header of ["user-agent", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform"]) {
      assert.equal(effective[header], profile[header], `Effective ${header} must match the transport profile`);
    }
    assert.equal(factoryBrowser.userAgent, factories.DANISH_JSONLD_BROWSER_USER_AGENT);
    assert.equal(factoryBrowser.userAgent.match(/Chrome\/(\d+)/u)?.[1], browser.version().split(".")[0]);
    assert.equal(factoryBrowser.clientHintPlatform, process.platform === "darwin" ? "macOS" : process.platform === "win32" ? "Windows" : "Linux");
    assert.deepEqual(factoryBrowser.brands, native.brands);
    assert.deepEqual(factoryBrowser.webgl, native.webgl);
    assert.deepEqual(factoryBrowser.webgl2, native.webgl2);
    console.error("Identity and native WebGL verification passed.");
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
