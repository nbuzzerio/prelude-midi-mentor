export type BuildIdentity = Readonly<{ revision: string | null; dirty: boolean | null; development: boolean }>;

export function describeBuild(identity: BuildIdentity) {
  if (!identity.revision || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i.test(identity.revision)) return {
    label: identity.development ? "local development" : "build revision unavailable",
    detail: "The running bundle has no verified Git revision. No network lookup is performed.",
  };
  const suffix = identity.dirty === true ? " · local changes" : identity.dirty === null ? " · worktree unverified" : "";
  return { label: `build ${identity.revision.slice(0, 8)}${suffix}`, detail: `Running bundle revision: ${identity.revision}${suffix}.` };
}

export const RUNNING_BUILD = describeBuild(__PRELUDE_BUILD__);
