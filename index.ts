import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CommitAttributionSession } from "./features/commit-attribution.ts";
import { registerCommitAttribution } from "./features/register-commit-attribution.ts";
import { registerGithubStar } from "./features/register-github-star.ts";

export { CommitAttributionSession } from "./features/commit-attribution.ts";

export type PiMustWinOptions = Readonly<{
  commitAttributionSession?: CommitAttributionSession;
}>;

export default function piMustWin(pi: ExtensionAPI, options: PiMustWinOptions = {}): void {
  registerCommitAttribution(pi, options.commitAttributionSession);
  registerGithubStar(pi);
}
