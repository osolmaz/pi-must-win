import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, VERSION } from "@earendil-works/pi-coding-agent";
import { CommitAttributionSession } from "./commit-attribution.ts";
import { disabledEntriesForEnv, type RepoDisableOptions } from "./repo-disable.ts";

/**
 * Register commit attribution. When the caller provides a `session`, `repoDisable` is ignored:
 * a custom session must be constructed with `disabledEntriesForEnv` itself, or the hook-time
 * repository disable matcher receives no entries and never runs.
 */
export function registerCommitAttribution(
  pi: ExtensionAPI,
  session?: CommitAttributionSession,
  repoDisable: RepoDisableOptions = {},
): void {
  const attribution =
    session ?? new CommitAttributionSession(disabledEntriesForEnv(repoDisable.configPath));

  pi.on("session_start", () => {
    attribution.start();
  });

  pi.on("session_shutdown", () => {
    attribution.stop();
  });

  pi.on("tool_call", (event, context) => {
    if (!isToolCallEventType("bash", event)) return;

    const model = context.model;
    const modelName = model ? model.name || `${model.provider}/${model.id}` : "unknown";
    event.input.command = attribution.wrap(event.input.command, modelName, VERSION);
  });
}
