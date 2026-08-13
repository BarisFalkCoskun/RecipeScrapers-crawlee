export interface BoundedDiagnostic {
  event: string;
  data: Record<string, unknown>;
}

export function createBudgetedDiagnosticSink(options: {
  sink: (diagnostic: BoundedDiagnostic) => void;
  maxEvents?: number;
}): (diagnostic: BoundedDiagnostic) => void {
  const maxEvents = options.maxEvents ?? 1_000;
  let emitted = 0;
  let truncationReported = false;
  return (diagnostic) => {
    if (emitted < maxEvents) {
      emitted += 1;
      options.sink(diagnostic);
      return;
    }
    if (!truncationReported) {
      truncationReported = true;
      options.sink(
        createBoundedDiagnostic("diagnostic-budget-exhausted", { maxEvents })
      );
    }
  };
}

const MAX_STRING_LENGTH = 512;
const MAX_ARRAY_ITEMS = 10;
const MAX_OBJECT_KEYS = 25;
const MAX_DEPTH = 4;
const REDACTED = "[redacted]";
const PROXY_URL_REDACTED = "[proxy-url-redacted]";
const SENSITIVE_KEY = /authorization|cookie|credential|password|proxy|secret|token/i;

export function createBoundedDiagnostic(
  event: string,
  data: Record<string, unknown>
): BoundedDiagnostic {
  return {
    event: boundString(event),
    data: sanitizeRecord(data, 0),
  };
}

export function inspectJsonLdShape(value: unknown): {
  wrapperKinds: string[];
  nodeTypes: string[];
  fieldNames: string[];
  leafShapes: Record<string, number>;
  nodeCount: number;
} {
  const wrapperKinds = new Set<string>();
  const nodeTypes = new Set<string>();
  const fieldNames = new Set<string>();
  const leafShapes: Record<string, number> = {};
  let nodeCount = 0;

  const recordShape = (kind: string) => {
    leafShapes[kind] = (leafShapes[kind] ?? 0) + 1;
  };
  const visit = (current: unknown, depth: number) => {
    if (depth > 12) return;
    if (Array.isArray(current)) {
      recordShape("array");
      for (const item of current.slice(0, 100)) visit(item, depth + 1);
      return;
    }
    if (current !== null && typeof current === "object") {
      recordShape("object");
      nodeCount += 1;
      const record = current as Record<string, unknown>;
      if ("@graph" in record) wrapperKinds.add("@graph");
      if ("@type" in record && "@graph" in record) wrapperKinds.add("typed-wrapper");
      for (const [key, nested] of Object.entries(record).slice(0, 100)) {
        fieldNames.add(key);
        if (key === "@type") {
          for (const type of toStrings(nested)) nodeTypes.add(type);
        }
        visit(nested, depth + 1);
      }
      return;
    }
    recordShape(current === null ? "null" : typeof current);
  };

  visit(value, 0);
  return {
    wrapperKinds: [...wrapperKinds].sort(),
    nodeTypes: [...nodeTypes].sort(),
    fieldNames: [...fieldNames].sort(),
    leafShapes,
    nodeCount,
  };
}

function sanitizeRecord(
  value: Record<string, unknown>,
  depth: number
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const entries = Object.entries(value);
  for (const [key, nested] of entries.slice(0, MAX_OBJECT_KEYS)) {
    sanitized[boundString(key)] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : sanitizeValue(nested, depth + 1);
  }
  if (entries.length > MAX_OBJECT_KEYS) {
    sanitized["_truncatedKeys"] = entries.length - MAX_OBJECT_KEYS;
  }
  return sanitized;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[max-depth]";
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const bounded = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      bounded.push(`[${value.length - MAX_ARRAY_ITEMS} more items]`);
    }
    return bounded;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (isProxyProvenanceRecord(record)) return PROXY_URL_REDACTED;
    return sanitizeRecord(record, depth);
  }
  return boundString(String(value));
}

function sanitizeString(value: string): string {
  const embeddedUrlsRedacted = value.replace(
    /https?:\/\/[^\s"'<>]+/giu,
    (match, offset: number) => sanitizeEmbeddedUrl(
      match,
      hasProxyContext(value, offset)
    )
  );
  const headersRedacted = embeddedUrlsRedacted
    .replace(
      /\bAuthorization\s*:\s*(?:Bearer\s+)?[^\s,;]+/giu,
      "Authorization: [redacted]"
    )
    .replace(/\bBearer\s+[^\s,;]+/giu, "Bearer [redacted]")
    .replace(
      /\b(?:Set-)?Cookie\s*:\s*[^\r\n]+/giu,
      "Cookie: [redacted]"
    );
  const assignmentsRedacted = headersRedacted.replace(
    /\b(token|secret|password|api[_-]?key|access[_-]?key|session(?:id)?|sid)\s*=\s*[^&\s,;]+/giu,
    "$1=[redacted]"
  );
  try {
    return boundString(sanitizeUrl(assignmentsRedacted));
  } catch {
    return boundString(assignmentsRedacted);
  }
}

function sanitizeEmbeddedUrl(value: string, proxyContext: boolean): string {
  try {
    const url = new URL(value);
    if (
      proxyContext ||
      url.username ||
      url.password ||
      /(?:^|\.)proxy(?:\.|$)/iu.test(url.hostname)
    ) {
      return PROXY_URL_REDACTED;
    }
    return sanitizeUrl(value);
  } catch {
    return REDACTED;
  }
}

function hasProxyContext(value: string, urlOffset: number): boolean {
  const prefix = value.slice(Math.max(0, urlOffset - 96), urlOffset);
  return (
    /\bproxy(?:\s+(?:url|endpoint|server|via|at|through|using))*\s*[:=]?\s*$/iu
      .test(prefix) ||
    /\bconnect\s+(?:E[A-Z0-9_]*|connection\s+refused)\s*$/iu.test(prefix)
  );
}

function isProxyProvenanceRecord(value: Record<string, unknown>): boolean {
  return Object.entries(value).some(
    ([key, nested]) =>
      /provenance|transport|kind|type|source/iu.test(key) &&
      typeof nested === "string" &&
      /\bproxy\b/iu.test(nested)
  );
}

function sanitizeUrl(value: string): string {
  const url = new URL(value);
  if (url.username || url.password) {
    url.username = "";
    url.password = "";
  }
  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_KEY.test(key) || /api[_-]?key|access[_-]?key/i.test(key)) {
      url.searchParams.set(key, REDACTED);
    }
  }
  return url.toString();
}

function boundString(value: string): string {
  return value.length <= MAX_STRING_LENGTH
    ? value
    : `${value.slice(0, MAX_STRING_LENGTH - 15)}...[truncated]`;
}

function toStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}
