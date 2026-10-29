import { useEffect, useState } from "react";
import type { ImprovLoadedTake } from "../improv-library";
import type { ImprovMusicalInsights } from "../insights/improv-musical-insights";
import type { ImprovInsightsResponse } from "../insights/improv-insights.worker";

export type ImprovInsightsState = { status: "loading" | "error" | "unavailable" } | { status: "ready"; insights: ImprovMusicalInsights };

export function useImprovInsights(take: ImprovLoadedTake): ImprovInsightsState {
  const [result, setResult] = useState<{ take: ImprovLoadedTake; state: ImprovInsightsState } | null>(null);
  useEffect(() => {
    let active = true;
    let worker: Worker | undefined;
    const finish = (state: ImprovInsightsState) => {
      if (!active) return;
      active = false;
      setResult({ take, state });
      worker?.terminate();
    };
    if (typeof Worker === "undefined") finish({ status: "unavailable" });
    else {
      try {
        worker = new Worker(new URL("../insights/improv-insights.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<ImprovInsightsResponse>) => {
          const response = event.data;
          if (response?.status === "ready" && response.insights?.version === 1) finish(response);
          else finish({ status: "error" });
        };
        worker.onerror = () => finish({ status: "error" });
        worker.onmessageerror = () => finish({ status: "error" });
        worker.postMessage(take);
      } catch { finish({ status: "error" }); }
    }
    return () => { active = false; worker?.terminate(); };
  }, [take]);
  return result?.take === take ? result.state : { status: "loading" };
}
