// Optional Mullvad SOCKS5 exit rotation. OFF unless MULLVAD_SOCKS is set.
//
// Off by default on purpose: this host happens to run Mullvad, but nothing in
// the migration may assume that, and a tool that fails when the VPN is down is
// worse than one that never used it.
//
// Support is not uniform and was measured rather than assumed on 2026-09-08:
//   got-scraping (Crawlee's Cheerio path)  rejects socks5: outright --
//     "Proxy URL protocol socks5: is not supported. Please use HTTP or HTTPS."
//   Playwright                             supports socks5:// natively
//   node https + socks-proxy-agent         works (verified against a Dallas exit)
//   Scrapy                                 no native SOCKS support
// So this module serves the Node-side tools only. Crawlee's HTTP crawls would
// need an HTTP-to-SOCKS bridge, which is not built here.
//
// Worth knowing before reaching for it: on 2026-09-08 no current blocker was
// IP-based. justonecookbook's page=3 answered 403 from Sweden and from four US
// exits alike; thatskinnychickcanbake and joythebaker answered 200 from every
// exit; kikkoman answered 503 from every exit. Two sources were actively worse
// through the US -- klinksgaard and starbucksathome answer 200 from the Swedish
// exit and 403 from Dallas. Rotation is a tool for rate limits spread across
// many requests, not a way past a challenge.
const https = require("https");

const RELAY_API = "https://api-www.mullvad.net/www/relays/all/";

function enabled() {
  return process.env.MULLVAD_SOCKS === "1";
}

async function relays(countryCode) {
  const body = await new Promise((resolve, reject) => {
    https.get(RELAY_API, { timeout: 20_000 }, (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => resolve(d));
    }).on("error", reject);
  });
  const all = JSON.parse(body);
  return all.filter(
    (r) =>
      r.active &&
      r.socks_name &&
      r.socks_port &&
      (!countryCode || r.country_code === countryCode)
  );
}

// Returns an https.Agent bound to one exit, or null when disabled or
// unavailable. Never throws: a tool that can run direct should run direct.
async function agent() {
  if (!enabled()) return null;
  let SocksProxyAgent;
  try {
    ({ SocksProxyAgent } = require("socks-proxy-agent"));
  } catch {
    console.error("mullvad: socks-proxy-agent is not installed, going direct");
    return null;
  }
  try {
    const pool = await relays(process.env.MULLVAD_COUNTRY || undefined);
    if (pool.length === 0) {
      console.error("mullvad: no active SOCKS relay matched, going direct");
      return null;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    console.error(
      `mullvad: routing through ${pick.socks_name} (${pick.city_name}, ${pick.country_code})`
    );
    return new SocksProxyAgent(`socks5://${pick.socks_name}:${pick.socks_port}`);
  } catch (error) {
    console.error(`mullvad: ${error.message}; going direct`);
    return null;
  }
}

// fetch() is undici and ignores an http.Agent, so a proxied request goes
// through node https instead. The direct path stays on fetch so that turning
// this off leaves every tool byte-identical to how it behaved before.
function get(url, headers, proxyAgent, timeoutMs = 90_000) {
  if (!proxyAgent) {
    return fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  }
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { agent: proxyAgent, headers, timeout: timeoutMs },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () =>
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: { get: (k) => res.headers[String(k).toLowerCase()] },
            text: async () => body,
            json: async () => JSON.parse(body),
          })
        );
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

module.exports = { enabled, relays, agent, get };
