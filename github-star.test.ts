import type { ExecOptions, ExecResult } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import {
  createDefaultPiStarPromptState,
  STAR_PROMPT_MAX_PROMPTS,
  type PiStarPromptState,
  type PiStarPromptStateStore,
} from "./features/github-star-state.ts";
import {
  inspectGithubViewer,
  offerPiStar,
  PI_GITHUB_REPOSITORY,
  shouldOfferPiStar,
} from "./features/github-star.ts";

type CommandRunner = (
  command: string,
  args: string[],
  options?: ExecOptions,
) => Promise<ExecResult>;

type MemoryStore = {
  current: () => PiStarPromptState;
  store: PiStarPromptStateStore;
};

function commandResult(stdout = "", code = 0): ExecResult {
  return { code, killed: false, stderr: "", stdout };
}

function createRunner(hasStarred: boolean, starCode = 0): CommandRunner {
  return vi.fn((_command: string, args: string[]) => {
    if (args.includes("user")) return Promise.resolve(commandResult("octocat\n"));
    if (args.includes("viewerHasStarred")) {
      return Promise.resolve(commandResult(`${String(hasStarred)}\n`));
    }
    if (args.includes("PUT")) return Promise.resolve(commandResult("", starCode));
    return Promise.resolve(commandResult("", 1));
  });
}

function createMemoryStore(initial = createDefaultPiStarPromptState()): MemoryStore {
  let state = { ...initial };
  return {
    current: () => ({ ...state }),
    store: {
      load: () => Promise.resolve({ ...state }),
      save: (nextState) => {
        state = { ...nextState };
        return Promise.resolve();
      },
    },
  };
}

function createUi(confirmed: boolean) {
  return {
    confirm: vi.fn(() => Promise.resolve(confirmed)),
    notify: vi.fn(),
  };
}

describe("Pi GitHub star offer", () => {
  it("targets the canonical Pi repository", () => {
    expect(PI_GITHUB_REPOSITORY).toBe("earendil-works/pi");
  });

  it("reads the authenticated account and current star status through gh", async () => {
    const run = createRunner(false);

    await expect(inspectGithubViewer(run)).resolves.toEqual({
      hasStarred: false,
      login: "octocat",
    });
    expect(run).toHaveBeenCalledWith("gh", ["api", "user", "--jq", ".login"], {
      timeout: 10_000,
    });
    expect(run).toHaveBeenCalledWith(
      "gh",
      [
        "repo",
        "view",
        PI_GITHUB_REPOSITORY,
        "--json",
        "viewerHasStarred",
        "--jq",
        ".viewerHasStarred",
      ],
      { timeout: 10_000 },
    );
  });

  it.each([
    ["invalid login", commandResult("bad\u001b[31mname\n"), commandResult("false\n")],
    ["failed login lookup", commandResult("octocat\n", 1), commandResult("false\n")],
    ["failed star lookup", commandResult("octocat\n"), commandResult("false\n", 1)],
    ["invalid star status", commandResult("octocat\n"), commandResult("maybe\n")],
  ])("does not prompt after %s", async (_name, loginResult, starResult) => {
    const run = vi.fn<CommandRunner>((_command, args) =>
      Promise.resolve(args.includes("user") ? loginResult : starResult),
    );
    const ui = createUi(true);

    await expect(offerPiStar(run, ui, createMemoryStore().store)).resolves.toBe("unavailable");
    expect(ui.confirm).not.toHaveBeenCalled();
  });

  it("does not prompt when the GitHub CLI cannot be executed", async () => {
    const run = vi.fn<CommandRunner>(() => Promise.reject(new Error("gh is unavailable")));
    const ui = createUi(true);

    await expect(offerPiStar(run, ui, createMemoryStore().store)).resolves.toBe("unavailable");
    expect(ui.confirm).not.toHaveBeenCalled();
  });

  it("remembers an account that already starred Pi", async () => {
    const run = createRunner(true);
    const ui = createUi(true);
    const memory = createMemoryStore();

    await expect(offerPiStar(run, ui, memory.store)).resolves.toBe("already-starred");
    expect(memory.current().knownStarred).toBe(true);
    expect(ui.confirm).not.toHaveBeenCalled();
  });

  it("uses increasing backoff after users skip", async () => {
    const run = createRunner(false);
    const ui = createUi(false);
    const memory = createMemoryStore();

    await expect(offerPiStar(run, ui, memory.store)).resolves.toBe("skipped");
    await expect(offerPiStar(run, ui, memory.store)).resolves.toBe("deferred");
    await expect(offerPiStar(run, ui, memory.store)).resolves.toBe("skipped");

    expect(ui.confirm).toHaveBeenCalledTimes(2);
    expect(ui.confirm).toHaveBeenLastCalledWith(
      "Support Pi",
      expect.stringContaining("Choose No or press Esc to skip."),
    );
    expect(memory.current()).toEqual({
      knownStarred: false,
      promptsShown: 2,
      startupsSincePrompt: 0,
    });
  });

  it("stars Pi through the GitHub API after confirmation", async () => {
    const run = createRunner(false);
    const ui = createUi(true);
    const memory = createMemoryStore();

    await expect(offerPiStar(run, ui, memory.store)).resolves.toBe("starred");
    expect(run).toHaveBeenCalledWith(
      "gh",
      ["api", "--method", "PUT", `/user/starred/${PI_GITHUB_REPOSITORY}`, "--silent"],
      { timeout: 10_000 },
    );
    expect(memory.current().knownStarred).toBe(true);
    expect(ui.notify).toHaveBeenCalledWith(
      `Starred ${PI_GITHUB_REPOSITORY}. Thank you for supporting Pi.`,
      "info",
    );
  });

  it("reports a failed star while preserving the remaining prompt schedule", async () => {
    const run = createRunner(false, 1);
    const ui = createUi(true);
    const memory = createMemoryStore();

    await expect(offerPiStar(run, ui, memory.store)).resolves.toBe("failed");
    expect(memory.current().promptsShown).toBe(1);
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Could not star"), "warning");
  });

  it("stops permanently after five prompts", async () => {
    const run = createRunner(false);
    const ui = createUi(true);
    const memory = createMemoryStore({
      knownStarred: false,
      promptsShown: STAR_PROMPT_MAX_PROMPTS,
      startupsSincePrompt: 99,
    });

    await expect(offerPiStar(run, ui, memory.store)).resolves.toBe("prompt-limit-reached");
    expect(run).not.toHaveBeenCalled();
    expect(ui.confirm).not.toHaveBeenCalled();
  });

  it("does not inspect GitHub after a star was recorded", async () => {
    const run = createRunner(false);
    const ui = createUi(true);
    const memory = createMemoryStore({
      knownStarred: true,
      promptsShown: 1,
      startupsSincePrompt: 0,
    });

    await expect(offerPiStar(run, ui, memory.store)).resolves.toBe("already-starred");
    expect(run).not.toHaveBeenCalled();
  });

  it("does not prompt when state cannot be loaded or saved", async () => {
    const ui = createUi(true);
    const loadFailure: PiStarPromptStateStore = {
      load: () => Promise.reject(new Error("load failed")),
      save: () => Promise.resolve(),
    };
    const promptSaveFailure: PiStarPromptStateStore = {
      load: () => Promise.resolve(createDefaultPiStarPromptState()),
      save: () => Promise.reject(new Error("save failed")),
    };
    const deferredSaveFailure: PiStarPromptStateStore = {
      load: () => Promise.resolve({ knownStarred: false, promptsShown: 1, startupsSincePrompt: 0 }),
      save: () => Promise.reject(new Error("save failed")),
    };
    const starredSaveFailure: PiStarPromptStateStore = {
      load: () => Promise.resolve(createDefaultPiStarPromptState()),
      save: () => Promise.reject(new Error("save failed")),
    };

    await expect(offerPiStar(createRunner(false), ui, loadFailure)).resolves.toBe("state-error");
    await expect(offerPiStar(createRunner(false), ui, promptSaveFailure)).resolves.toBe(
      "state-error",
    );
    await expect(offerPiStar(createRunner(false), ui, deferredSaveFailure)).resolves.toBe(
      "state-error",
    );
    await expect(offerPiStar(createRunner(true), ui, starredSaveFailure)).resolves.toBe(
      "state-error",
    );
    expect(ui.confirm).not.toHaveBeenCalled();
  });

  it("only offers the startup call to action in the interactive TUI", () => {
    expect(shouldOfferPiStar("startup", "tui")).toBe(true);
    expect(shouldOfferPiStar("reload", "tui")).toBe(false);
    expect(shouldOfferPiStar("new", "tui")).toBe(false);
    expect(shouldOfferPiStar("resume", "tui")).toBe(false);
    expect(shouldOfferPiStar("fork", "tui")).toBe(false);
    expect(shouldOfferPiStar("startup", "rpc")).toBe(false);
    expect(shouldOfferPiStar("startup", "json")).toBe(false);
    expect(shouldOfferPiStar("startup", "print")).toBe(false);
  });
});
