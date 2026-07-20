import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultPiStarPromptState,
  createPiStarPromptStateStore,
  isPiStarPromptDue,
  parsePiStarPromptState,
  piStarPromptStatePath,
  recordStartupWithoutPrompt,
  recordStarPromptShown,
  STAR_PROMPT_INTERVAL_STARTUPS,
  STAR_PROMPT_MAX_PROMPTS,
  type PiStarPromptState,
} from "./features/github-star-state.ts";

const temporaryDirectories: string[] = [];

async function temporaryStatePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pi-must-win-star-state-"));
  temporaryDirectories.push(directory);
  return join(directory, "nested", "deeper", "state.json");
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("Pi GitHub star prompt state", () => {
  it("uses the same bounded increasing cadence as the former Herdr prompt", () => {
    let state = createDefaultPiStarPromptState();
    expect(isPiStarPromptDue(state)).toBe(true);

    state = recordStarPromptShown(state);
    for (const interval of STAR_PROMPT_INTERVAL_STARTUPS) {
      for (let startup = 1; startup < interval; startup += 1) {
        expect(isPiStarPromptDue(state)).toBe(false);
        state = recordStartupWithoutPrompt(state);
      }
      expect(isPiStarPromptDue(state)).toBe(true);
      state = recordStarPromptShown(state);
    }

    expect(state.promptsShown).toBe(STAR_PROMPT_MAX_PROMPTS);
    expect(isPiStarPromptDue(state)).toBe(false);
  });

  it("never prompts after a recorded star", () => {
    const state: PiStarPromptState = {
      knownStarred: true,
      promptsShown: 1,
      startupsSincePrompt: Number.MAX_SAFE_INTEGER,
    };

    expect(isPiStarPromptDue(state)).toBe(false);
    expect(recordStartupWithoutPrompt(state).startupsSincePrompt).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("parses valid state and defaults malformed fields", () => {
    expect(
      parsePiStarPromptState(
        JSON.stringify({ knownStarred: true, promptsShown: 3, startupsSincePrompt: 4 }),
      ),
    ).toEqual({ knownStarred: true, promptsShown: 3, startupsSincePrompt: 4 });
    expect(parsePiStarPromptState("not json")).toEqual(createDefaultPiStarPromptState());
    expect(parsePiStarPromptState("[]")).toEqual(createDefaultPiStarPromptState());
    expect(
      parsePiStarPromptState(
        JSON.stringify({ knownStarred: "yes", promptsShown: -1, startupsSincePrompt: 1.5 }),
      ),
    ).toEqual(createDefaultPiStarPromptState());
  });

  it("uses XDG state storage with a home-directory fallback", () => {
    vi.stubEnv("XDG_STATE_HOME", " /tmp/custom-pi-state ");
    expect(piStarPromptStatePath()).toBe(
      join("/tmp/custom-pi-state", "pi-must-win", "github-star-prompt.json"),
    );

    vi.stubEnv("XDG_STATE_HOME", "   ");
    expect(piStarPromptStatePath()).toBe(
      join(homedir(), ".local", "state", "pi-must-win", "github-star-prompt.json"),
    );
  });

  it("round trips state through an atomically written file", async () => {
    const path = await temporaryStatePath();
    const store = createPiStarPromptStateStore(path);
    const state: PiStarPromptState = {
      knownStarred: false,
      promptsShown: 2,
      startupsSincePrompt: 1,
    };

    await expect(store.load()).resolves.toEqual(createDefaultPiStarPromptState());
    await store.save(state);

    await expect(store.load()).resolves.toEqual(state);
    await expect(readFile(path, "utf8")).resolves.toBe(`${JSON.stringify(state, undefined, 2)}\n`);
  });

  it("defaults a malformed state file", async () => {
    const path = await temporaryStatePath();
    const store = createPiStarPromptStateStore(path);
    await store.save({ knownStarred: false, promptsShown: 1, startupsSincePrompt: 0 });
    await writeFile(path, "{broken", "utf8");

    await expect(store.load()).resolves.toEqual(createDefaultPiStarPromptState());
  });

  it("removes the temporary file when the atomic rename fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pi-must-win-star-rename-"));
    temporaryDirectories.push(directory);
    const target = join(directory, "existing-directory");
    await mkdir(target);
    const store = createPiStarPromptStateStore(target);

    await expect(store.save(createDefaultPiStarPromptState())).rejects.toThrow();
    await expect(readdir(directory)).resolves.toEqual(["existing-directory"]);
  });
});
