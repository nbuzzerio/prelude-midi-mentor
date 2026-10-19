import { execFileSync } from "node:child_process";

export function resolveBuildRevision(expected: string | undefined, readGit: (args: readonly string[]) => string = args => execFileSync("git", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).toString().trim()) {
  const valid = (value: string) => /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i.test(value);
  if (expected && !valid(expected)) throw Error("PRELUDE_BUILD_REVISION must be a full Git revision.");
  let revision: string;
  try { revision = readGit(["rev-parse", "--verify", "HEAD"]).trim(); }
  catch { if (expected) throw Error("Cannot verify the requested build revision against the checkout."); return { revision: null, dirty: null }; }
  if (!valid(revision)) { if (expected) throw Error("The checkout revision is unavailable."); return { revision: null, dirty: null }; }
  revision = revision.toLowerCase();
  if (expected && expected.toLowerCase() !== revision) throw Error("Build revision does not match the checked-out source.");
  let dirty: boolean | null = null;
  try { dirty = readGit(["status", "--porcelain", "--untracked-files=normal"]).trim().length > 0; } catch { /* The revision is known; worktree cleanliness is not. */ }
  if (expected && dirty !== false) throw Error("CI build identity requires a verified clean checkout.");
  return { revision, dirty };
}
