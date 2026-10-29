import type { ImprovLoadedTake } from "../improv-library";
import { analyzeImprovTake, type ImprovMusicalInsights } from "./improv-musical-insights";

export type ImprovInsightsResponse = { status: "ready"; insights: ImprovMusicalInsights } | { status: "error" };

// One disposable worker per loaded take: no persistence, audio, or mutable capture access.
self.onmessage = (event: MessageEvent<ImprovLoadedTake>) => {
  let response: ImprovInsightsResponse;
  try { response = { status: "ready", insights: analyzeImprovTake(event.data) }; }
  catch { response = { status: "error" }; }
  self.postMessage(response);
};
