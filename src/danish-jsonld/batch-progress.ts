export interface BatchProgress {
  total: number;
  finished: number;
  active?: string;
  paused: number;
  waiting: number;
  notStarted: number;
  inserted: number;
  changed: number;
  pending: number;
}

export function formatBatchProgress(p: BatchProgress): string {
  return `Sites ${p.finished}/${p.total} finished | Active: ${p.active ?? "none"} | Paused: ${p.paused} | Waiting for lock: ${p.waiting} | New: ${p.inserted} | Changed: ${p.changed} | Pending requests: ${p.pending} | Not started: ${p.notStarted}`;
}

export async function waitForBatch(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const done = () => { clearTimeout(timer); signal?.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, Math.min(1000, Math.max(1, milliseconds)));
    signal?.addEventListener("abort", done, { once: true });
  });
}
