import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CommitAttributionSession } from "./features/commit-attribution.ts";
import { registerCommitAttribution } from "./features/register-commit-attribution.ts";
import { registerGithubStar } from "./features/register-github-star.ts";
import { isRepoDisabledForSession, type RepoDisableOptions } from "./features/repo-disable.ts";

export { CommitAttributionSession } from "./features/commit-attribution.ts";
export {
  DEFAULT_CONFIG_PATH,
  defaultConfigPath,
  isRepoDisabled,
  isRepoDisabledForSession,
  loadConfig,
  normalizeRepoUrl,
  parseConfig,
  resolveRepoIdentity,
  type RepoDisableConfig,
  type RepoDisableOptions,
  type RepoIdentity,
} from "./features/repo-disable.ts";

export type PiMustWinOptions = Readonly<{
  commitAttributionSession?: CommitAttributionSession;
  /** Overrides for the repository disable check, used by tests and wrappers. */
  repoDisable?: RepoDisableOptions;
}>;

export default function piMustWin(pi: ExtensionAPI, options: PiMustWinOptions = {}): void {
  if (isRepoDisabledForSession(options.repoDisable)) return;
  registerCommitAttribution(pi, options.commitAttributionSession);
  registerGithubStar(pi);
}
