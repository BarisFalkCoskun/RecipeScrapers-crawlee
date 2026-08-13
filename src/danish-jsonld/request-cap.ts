export interface SourceRequestBudgetSnapshot {
  handledRequests: number;
  maxRequests: number;
  capReached: boolean;
}

export interface SourceRequestBudget {
  handle<T>(
    requestKey: string,
    handler: () => Promise<T>
  ): Promise<
    | { handled: true; capReached: boolean; value: T }
    | { handled: false; capReached: true }
  >;
  snapshot(): SourceRequestBudgetSnapshot;
}

export function createSourceRequestBudget(maxRequests: number): SourceRequestBudget {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1) {
    throw new Error("Source request budget requires a positive safe integer");
  }
  let handledRequests = 0;
  let capReached = false;

  return {
    async handle<T>(requestKey: string, handler: () => Promise<T>) {
      void requestKey;
      if (handledRequests >= maxRequests) {
        capReached = true;
        return { handled: false as const, capReached: true as const };
      }
      handledRequests += 1;
      if (handledRequests >= maxRequests) capReached = true;
      return {
        handled: true as const,
        capReached,
        value: await handler(),
      };
    },
    snapshot() {
      return { handledRequests, maxRequests, capReached };
    },
  };
}
