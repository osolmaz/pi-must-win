import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type DisabledEntries } from "./features/repo-disable.ts";

const CO_AUTHOR_TRAILER = "Co-Authored-By";
const GENERATED_BY_TRAILER = "Generated-By";
const PI_WEBSITE = "https://pi.dev";

export type CommitTrailers = {
  coAuthor: string;
  generatedBy: string;
};

export function buildCommitTrailers(modelName: string, piVersion: string): CommitTrailers {
  const safeModelName = sanitizeTrailerValue(modelName, "unknown");
  const safePiVersion = sanitizeTrailerValue(piVersion, "unknown");

  return {
    coAuthor: `${CO_AUTHOR_TRAILER}: ${safeModelName} <noreply@pi.dev>`,
    generatedBy: `${GENERATED_BY_TRAILER}: pi ${safePiVersion} (${PI_WEBSITE})`,
  };
}

/** Absolute path of the hook-time repository disable matcher. */
export function checkDisabledPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "check-disabled.mjs");
}

/** Add process-local Git hook configuration and Pi metadata to a child environment. */
export function buildCommitAttributionEnvironment(
  environment: NodeJS.ProcessEnv,
  hooksDirectory: string,
  modelName: string,
  piVersion: string,
  disabled?: DisabledEntries,
): NodeJS.ProcessEnv {
  const trailers = buildCommitTrailers(modelName, piVersion);
  const configIndex = parseGitConfigCount(environment["GIT_CONFIG_COUNT"]);
  return {
    ...environment,
    PI_MUST_WIN_GIT_CONFIG_INDEX: String(configIndex),
    PI_MUST_WIN_CO_AUTHOR: trailers.coAuthor,
    PI_MUST_WIN_GENERATED_BY: trailers.generatedBy,
    [`GIT_CONFIG_KEY_${String(configIndex)}`]: "core.hooksPath",
    [`GIT_CONFIG_VALUE_${String(configIndex)}`]: hooksDirectory,
    GIT_CONFIG_COUNT: String(configIndex + 1),
    ...disabledEnvironment(disabled),
  };
}

function disabledEnvironment(disabled: DisabledEntries | undefined): NodeJS.ProcessEnv {
  if (disabled === undefined) return {};
  return {
    PI_MUST_WIN_DISABLED_URLS: JSON.stringify(disabled.urls),
    PI_MUST_WIN_DISABLED_PATHS: JSON.stringify(disabled.paths),
    PI_MUST_WIN_NODE: process.execPath,
    PI_MUST_WIN_CHECK: checkDisabledPath(),
  };
}

/** Create a session-scoped Git hooks directory for Pi commit attribution. */
export function createCommitHookDirectory(): string {
  const hooksDirectory = mkdtempSync(join(tmpdir(), "pi-must-win-hooks-"));
  const hookPath = join(hooksDirectory, "prepare-commit-msg");
  writeFileSync(hookPath, buildPrepareCommitMessageHook());
  chmodSync(hookPath, 0o755);
  return hooksDirectory;
}

/** Remove a session-scoped Git hooks directory. */
export function removeCommitHookDirectory(hooksDirectory: string | undefined): void {
  if (hooksDirectory === undefined) return;
  rmSync(hooksDirectory, { force: true, recursive: true });
}

/** Add process-local Git hook configuration and Pi metadata to a bash command. */
export function wrapBashWithCommitAttribution(
  command: string,
  hooksDirectory: string,
  modelName: string,
  piVersion: string,
  disabled?: DisabledEntries,
): string {
  const trailers = buildCommitTrailers(modelName, piVersion);
  return `${buildEnvironmentPrefix(hooksDirectory, trailers, disabled)}\n${command}`;
}

function parseGitConfigCount(value: string | undefined): number {
  if (value === undefined || value === "") return 0;
  if (!/^(?:0|[1-9]\d*)$/u.test(value)) {
    throw new Error(`Invalid GIT_CONFIG_COUNT: ${value}`);
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count)) throw new Error(`GIT_CONFIG_COUNT is too large: ${value}`);
  return count;
}

function sanitizeTrailerValue(value: string, fallback: string): string {
  const sanitized = value
    .replaceAll("\u0000", " ")
    .replace(/[<>\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || fallback;
}

function buildEnvironmentPrefix(
  hooksDirectory: string,
  trailers: CommitTrailers,
  disabled: DisabledEntries | undefined,
): string {
  return `__pi_must_win_git_config_index="\${GIT_CONFIG_COUNT:-0}"
export PI_MUST_WIN_GIT_CONFIG_INDEX="$__pi_must_win_git_config_index"
export PI_MUST_WIN_CO_AUTHOR=${shellQuote(trailers.coAuthor)}
export PI_MUST_WIN_GENERATED_BY=${shellQuote(trailers.generatedBy)}
export "GIT_CONFIG_KEY_\${__pi_must_win_git_config_index}=core.hooksPath"
export "GIT_CONFIG_VALUE_\${__pi_must_win_git_config_index}=${escapeDoubleQuotedAssignmentValue(hooksDirectory)}"
export GIT_CONFIG_COUNT="$((__pi_must_win_git_config_index + 1))"
unset __pi_must_win_git_config_index${disabledPrefix(disabled)}`;
}

function disabledPrefix(disabled: DisabledEntries | undefined): string {
  if (disabled === undefined) return "";
  return `
export PI_MUST_WIN_DISABLED_URLS=${shellQuote(JSON.stringify(disabled.urls))}
export PI_MUST_WIN_DISABLED_PATHS=${shellQuote(JSON.stringify(disabled.paths))}
export PI_MUST_WIN_NODE=${shellQuote(process.execPath)}
export PI_MUST_WIN_CHECK=${shellQuote(checkDisabledPath())}`;
}

function buildPrepareCommitMessageHook(): string {
  return `#!/bin/sh
set -eu

message_file="$1"

skip_trailers=0
if [ -n "\${PI_MUST_WIN_CHECK:-}" ] && [ -f "$PI_MUST_WIN_CHECK" ]; then
  if "\${PI_MUST_WIN_NODE:-node}" "$PI_MUST_WIN_CHECK"; then
    skip_trailers=1
  fi
fi

if [ "$skip_trailers" != "1" ]; then
git \\
  -c trailer.co-authored-by.ifExists=addIfDifferent \\
  -c trailer.generated-by.ifExists=replace \\
  interpret-trailers \\
  --in-place \\
  --trailer "$PI_MUST_WIN_CO_AUTHOR" \\
  --trailer "$PI_MUST_WIN_GENERATED_BY" \\
  "$message_file"
fi

__pi_config_index="$PI_MUST_WIN_GIT_CONFIG_INDEX"
unset "GIT_CONFIG_KEY_$__pi_config_index"
unset "GIT_CONFIG_VALUE_$__pi_config_index"
export GIT_CONFIG_COUNT="$__pi_config_index"

original_hooks_path="$(git config --get core.hooksPath || true)"
if [ -n "$original_hooks_path" ]; then
  case "$original_hooks_path" in
    /*) original_hook="$original_hooks_path/prepare-commit-msg" ;;
    *) original_hook="$(git rev-parse --show-toplevel)/$original_hooks_path/prepare-commit-msg" ;;
  esac
else
  original_hook="$(git rev-parse --git-path hooks/prepare-commit-msg)"
fi

if [ -x "$original_hook" ] && [ "$original_hook" != "$0" ]; then
  "$original_hook" "$@"
fi
`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function escapeDoubleQuotedAssignmentValue(value: string): string {
  return value.replace(/[\\"$`]/g, "\\$&");
}
