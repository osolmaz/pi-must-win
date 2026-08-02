import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, VERSION } from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";
import { CommitAttributionSession } from "./commit-attribution.ts";

const POSIX_SHELLS = new Set(["bash", "dash", "ksh", "sh", "zsh"]);

function supportsAttributionPrefix(shell: unknown): boolean {
  if (shell === undefined) return process.platform !== "win32";
  if (typeof shell !== "string") return false;
  const name = basename(shell)
    .replace(/\.exe$/i, "")
    .toLowerCase();
  return POSIX_SHELLS.has(name);
}

export function wrapCommitToolCall(
  event: ToolCallEvent,
  session: CommitAttributionSession,
  modelName: string,
  piVersion: string,
): boolean {
  if (isToolCallEventType("bash", event)) {
    event.input.command = session.wrap(event.input.command, modelName, piVersion);
    return true;
  }

  if (event.toolName !== "exec_command") return false;
  const command = event.input["cmd"];
  if (typeof command !== "string" || !supportsAttributionPrefix(event.input["shell"])) return false;
  event.input["cmd"] = session.wrap(command, modelName, piVersion);
  return true;
}

export function registerCommitAttribution(pi: ExtensionAPI): void {
  const session = new CommitAttributionSession();

  pi.on("session_start", () => {
    session.start();
  });

  pi.on("session_shutdown", () => {
    session.stop();
  });

  pi.on("tool_call", (event, context) => {
    const model = context.model;
    const modelName = model ? model.name || `${model.provider}/${model.id}` : "unknown";
    wrapCommitToolCall(event, session, modelName, VERSION);
  });
}
