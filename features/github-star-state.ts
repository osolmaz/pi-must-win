import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const STAR_PROMPT_MAX_PROMPTS = 5;
export const STAR_PROMPT_INTERVAL_STARTUPS = [2, 3, 5, 7] as const;

export type PiStarPromptState = {
  knownStarred: boolean;
  promptsShown: number;
  startupsSincePrompt: number;
};

export type PiStarPromptStateStore = {
  load: () => Promise<PiStarPromptState>;
  save: (state: PiStarPromptState) => Promise<void>;
};

export function createDefaultPiStarPromptState(): PiStarPromptState {
  return { knownStarred: false, promptsShown: 0, startupsSincePrompt: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  // Stryker disable next-line all: Non-record JSON produces the same default field values.
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonNegativeInteger(value: unknown): number {
  // Stryker disable next-line EqualityOperator: Zero is returned by either branch at the boundary.
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function parsePiStarPromptState(content: string): PiStarPromptState {
  try {
    const value: unknown = JSON.parse(content);
    if (!isRecord(value)) return createDefaultPiStarPromptState();

    return {
      knownStarred: value["knownStarred"] === true,
      promptsShown: readNonNegativeInteger(value["promptsShown"]),
      startupsSincePrompt: readNonNegativeInteger(value["startupsSincePrompt"]),
    };
  } catch {
    return createDefaultPiStarPromptState();
  }
}

export function isPiStarPromptDue(state: PiStarPromptState): boolean {
  if (state.knownStarred) return false;
  if (state.promptsShown === 0) return true;

  const interval = STAR_PROMPT_INTERVAL_STARTUPS[state.promptsShown - 1];
  return interval !== undefined && state.startupsSincePrompt + 1 >= interval;
}

export function recordStartupWithoutPrompt(state: PiStarPromptState): PiStarPromptState {
  return {
    ...state,
    startupsSincePrompt: Math.min(Number.MAX_SAFE_INTEGER, state.startupsSincePrompt + 1),
  };
}

export function recordStarPromptShown(state: PiStarPromptState): PiStarPromptState {
  return {
    ...state,
    promptsShown: Math.min(STAR_PROMPT_MAX_PROMPTS, state.promptsShown + 1),
    startupsSincePrompt: 0,
  };
}

export function piStarPromptStatePath(): string {
  const configuredStateHome = process.env["XDG_STATE_HOME"]?.trim();
  let stateHome = join(homedir(), ".local", "state");
  if (configuredStateHome) stateHome = configuredStateHome;
  return join(stateHome, "pi-must-win", "github-star-prompt.json");
}

export function createPiStarPromptStateStore(
  path = piStarPromptStatePath(),
): PiStarPromptStateStore {
  return {
    async load() {
      try {
        return parsePiStarPromptState(await readFile(path, "utf8"));
      } catch {
        return createDefaultPiStarPromptState();
      }
    },
    async save(state) {
      const temporaryPath = `${path}.tmp-${String(process.pid)}-${randomUUID()}`;
      await mkdir(dirname(path), { recursive: true });
      await writeFile(temporaryPath, `${JSON.stringify(state, undefined, 2)}\n`, "utf8");
      try {
        await rename(temporaryPath, path);
      } catch (error) {
        await rm(temporaryPath);
        throw error;
      }
    },
  };
}
