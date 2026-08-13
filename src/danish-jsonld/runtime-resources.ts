import { Configuration } from "crawlee";
import { createBoundedDiagnostic } from "./diagnostics.js";

const DANISH_JSONLD_AVAILABLE_MEMORY_RATIO = 0.75;

export function configureDanishJsonLdRuntimeResources(options: {
  env?: NodeJS.ProcessEnv;
  configuration?: Configuration;
  hostMemoryMbytes: number;
}) {
  const env = options.env ?? process.env;
  const configuration = options.configuration ?? Configuration.getGlobalConfig();
  const explicitMemory = positiveNumber(env["CRAWLEE_MEMORY_MBYTES"]);
  const explicitRatio = ratio(env["CRAWLEE_AVAILABLE_MEMORY_RATIO"]);
  let budgetSource: string;
  let availableMemoryRatio: number | null;
  let effectiveMemoryMbytes: number;

  if (explicitMemory !== undefined) {
    budgetSource = "CRAWLEE_MEMORY_MBYTES";
    availableMemoryRatio = null;
    effectiveMemoryMbytes = Math.floor(explicitMemory);
  } else if (explicitRatio !== undefined) {
    budgetSource = "CRAWLEE_AVAILABLE_MEMORY_RATIO";
    availableMemoryRatio = explicitRatio;
    effectiveMemoryMbytes = Math.floor(options.hostMemoryMbytes * explicitRatio);
  } else {
    budgetSource = "danish-jsonld-default";
    availableMemoryRatio = DANISH_JSONLD_AVAILABLE_MEMORY_RATIO;
    configuration.set("availableMemoryRatio", availableMemoryRatio);
    effectiveMemoryMbytes = Math.floor(options.hostMemoryMbytes * availableMemoryRatio);
  }

  return createBoundedDiagnostic("runtime-resource-budget", {
    budgetSource,
    hostMemoryMbytes: Math.floor(options.hostMemoryMbytes),
    availableMemoryRatio,
    effectiveMemoryMbytes,
    playwrightBrowserPool: {
      maxOpenPagesPerBrowser: 1,
      retireInactiveBrowserAfterSecs: 5,
      closeInactiveBrowserAfterSecs: 10,
    },
  });
}

function positiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function ratio(value: string | undefined): number | undefined {
  const parsed = positiveNumber(value);
  return parsed !== undefined && parsed <= 1 ? parsed : undefined;
}
