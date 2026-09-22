import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import type { DanishJsonLdSource } from "./source-registry.js";

interface Owner { token: string; pid: number; hostname: string }

export function sourceWebsiteHosts(source: DanishJsonLdSource): string[] {
  return [...new Set([source.domain, ...source.allowedDomains, ...(source.listingDiscovery?.listingHosts ?? []),
    ...[...source.sitemapUrls, ...source.startUrls].map((url) => new URL(url).hostname)]
    .map((host) => host.toLowerCase().replace(/^www\./u, "")))].sort();
}

/** Atomic hard links publish fully written owners. A lock has no time-based
 * expiry: a slow or suspended live crawler must never lose its session lease.
 */
export async function tryWebsiteLock(directory: string, hosts: string[]): Promise<(() => Promise<void>) | undefined> {
  const root = join(directory, "website-locks");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const owner: Owner = { token: randomUUID(), pid: process.pid, hostname: hostname() };
  const owned: string[] = [];
  const release = async () => {
    for (const path of owned.splice(0).reverse()) {
      const current = await readOwner(path);
      if (current?.token === owner.token) await unlink(path).catch((e: NodeJS.ErrnoException) => {
        if (e.code !== "ENOENT") throw e;
      });
    }
  };
  try {
    for (const host of [...new Set(hosts)].sort()) {
      const path = join(root, `${createHash("sha256").update(host).digest("hex")}.lock`);
      const temporary = `${path}.${owner.token}.tmp`;
      await writeFile(temporary, JSON.stringify(owner), { flag: "wx", mode: 0o600 });
      try {
        let acquired = false;
        for (let attempt = 0; attempt < 3 && !acquired; attempt++) {
          try { await link(temporary, path); acquired = true; }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
            const previous = await readOwner(path);
            if (!previous) continue;
            if (!deadLocalOwner(previous)) break;
            // Only one reaper may remove this particular dead owner's lock.
            // Keep the tombstone: a delayed second reaper must not unlink a new owner.
            const tombstone = `${path}.retired-${previous.token}`;
            try { await link(path, tombstone); }
            catch (e) {
              if (["EEXIST", "ENOENT"].includes((e as NodeJS.ErrnoException).code ?? "")) continue;
              throw e;
            }
            const captured = await readOwner(tombstone);
            if (captured?.token === previous.token) await unlink(path).catch((e: NodeJS.ErrnoException) => {
              if (e.code !== "ENOENT") throw e;
            });
          }
        }
        if (!acquired) { await release(); return undefined; }
        owned.push(path);
      } finally { await rm(temporary, { force: true }); }
    }
    return release;
  } catch (error) { await release(); throw error; }
}

async function readOwner(path: string): Promise<Owner | undefined> {
  try {
    const owner = JSON.parse(await readFile(path, "utf8")) as Owner;
    if (!owner || typeof owner.token !== "string" || !/^[a-f0-9-]{36}$/u.test(owner.token)
      || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.hostname !== "string") {
      throw new Error("Invalid website lock owner; inspect website-locks before removing an abandoned lock");
    }
    return owner;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
function deadLocalOwner(owner: Owner): boolean {
  if (owner.hostname !== hostname()) return false;
  try { process.kill(owner.pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH"; }
}
