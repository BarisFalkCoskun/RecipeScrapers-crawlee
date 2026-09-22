import "dotenv/config";
import { open, readFile, readdir, stat, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";

async function main() {
  const args = process.argv.slice(2);
  let prune = false;
  let days = 30;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prune-completed") prune = true;
    else if (args[i] === "--older-than-days") days = Number(args[++i]);
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  if (!Number.isFinite(days) || days < 1) throw new Error("--older-than-days must be at least 1");
  const directory = join(process.env["CRAWLEE_STORAGE_DIR"] ?? "storage", "checkpoints");
  const files = await readdir(directory).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return []; throw error; });
  for (const name of files.filter((file) => file.endsWith(".jsonl"))) {
    const path = join(directory, name);
    // The same exclusive lock as the crawler prevents pruning an active resume.
    let lock;
    try {
      lock = await open(`${path}.lock`, "wx", 0o600);
      await lock.writeFile(JSON.stringify({ pid: process.pid, hostname: hostname() }));
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") continue; throw error; }
    try {
      const info = await stat(path);
      const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
      const identity = JSON.parse(lines[0]);
      const last = JSON.parse(lines.at(-1)!);
      const complete = last.type === "stop" && last.complete === true;
      const expired = Date.now() - info.mtimeMs >= days * 86_400_000;
      if (prune && complete && expired) await unlink(path);
      console.log(JSON.stringify({ runId: identity.runId, sourceId: identity.sourceId, complete,
        bytes: info.size, updatedAt: info.mtime.toISOString(), pruned: prune && complete && expired }));
    } finally { await lock.close(); await unlink(`${path}.lock`); }
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
