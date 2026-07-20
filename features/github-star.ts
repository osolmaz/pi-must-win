import type {
  ExecOptions,
  ExecResult,
  ExtensionContext,
  SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import {
  isPiStarPromptDue,
  recordStartupWithoutPrompt,
  recordStarPromptShown,
  STAR_PROMPT_MAX_PROMPTS,
  type PiStarPromptState,
  type PiStarPromptStateStore,
} from "./github-star-state.ts";

export const PI_GITHUB_REPOSITORY = "earendil-works/pi";
const GH_TIMEOUT_MS = 10_000;
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

type GithubCommandRunner = (
  command: string,
  args: string[],
  options?: ExecOptions,
) => Promise<ExecResult>;

type StarPromptUi = Pick<ExtensionContext["ui"], "confirm" | "notify">;

type GithubViewer = {
  hasStarred: boolean;
  login: string;
};

export type PiStarOfferResult =
  | "already-starred"
  | "deferred"
  | "failed"
  | "prompt-limit-reached"
  | "skipped"
  | "starred"
  | "state-error"
  | "unavailable";

async function runGithubCommand(
  run: GithubCommandRunner,
  args: string[],
): Promise<ExecResult | undefined> {
  try {
    return await run("gh", args, { timeout: GH_TIMEOUT_MS });
  } catch {
    return undefined;
  }
}

function parseViewer(loginResult: ExecResult, starredResult: ExecResult): GithubViewer | undefined {
  if (loginResult.code !== 0 || starredResult.code !== 0) return undefined;

  const login = loginResult.stdout.trim();
  if (!GITHUB_LOGIN_PATTERN.test(login)) return undefined;

  const starred = starredResult.stdout.trim();
  if (starred !== "true" && starred !== "false") return undefined;

  return { hasStarred: starred === "true", login };
}

export async function inspectGithubViewer(
  run: GithubCommandRunner,
): Promise<GithubViewer | undefined> {
  const [loginResult, starredResult] = await Promise.all([
    runGithubCommand(run, ["api", "user", "--jq", ".login"]),
    runGithubCommand(run, [
      "repo",
      "view",
      PI_GITHUB_REPOSITORY,
      "--json",
      "viewerHasStarred",
      "--jq",
      ".viewerHasStarred",
    ]),
  ]);

  if (!loginResult || !starredResult) return undefined;
  return parseViewer(loginResult, starredResult);
}

async function starPiRepository(run: GithubCommandRunner): Promise<boolean> {
  const result = await runGithubCommand(run, [
    "api",
    "--method",
    "PUT",
    `/user/starred/${PI_GITHUB_REPOSITORY}`,
    "--silent",
  ]);
  return result?.code === 0;
}

async function saveState(
  store: PiStarPromptStateStore,
  state: PiStarPromptState,
): Promise<boolean> {
  try {
    await store.save(state);
    return true;
  } catch {
    return false;
  }
}

type StarOfferPreparation =
  | { ready: false; result: PiStarOfferResult }
  | { ready: true; state: PiStarPromptState };

async function prepareStarOffer(store: PiStarPromptStateStore): Promise<StarOfferPreparation> {
  let state: PiStarPromptState;
  try {
    state = await store.load();
  } catch {
    return { ready: false, result: "state-error" };
  }

  if (state.knownStarred) return { ready: false, result: "already-starred" };
  if (state.promptsShown >= STAR_PROMPT_MAX_PROMPTS) {
    return { ready: false, result: "prompt-limit-reached" };
  }
  if (isPiStarPromptDue(state)) return { ready: true, state };

  const saved = await saveState(store, recordStartupWithoutPrompt(state));
  return { ready: false, result: saved ? "deferred" : "state-error" };
}

async function promptForPiStar(
  run: GithubCommandRunner,
  ui: StarPromptUi,
  store: PiStarPromptStateStore,
  state: PiStarPromptState,
  login: string,
): Promise<PiStarOfferResult> {
  const promptedState = recordStarPromptShown(state);
  if (!(await saveState(store, promptedState))) return "state-error";

  const confirmed = await ui.confirm(
    "Support Pi",
    `If Pi has been useful, star ${PI_GITHUB_REPOSITORY} using GitHub account ${login}? Choose No or press Esc to skip.`,
  );
  if (!confirmed) return "skipped";

  if (!(await starPiRepository(run))) {
    ui.notify(
      `Could not star ${PI_GITHUB_REPOSITORY}. You can star it at https://github.com/${PI_GITHUB_REPOSITORY}.`,
      "warning",
    );
    return "failed";
  }

  await saveState(store, { ...promptedState, knownStarred: true });
  ui.notify(`Starred ${PI_GITHUB_REPOSITORY}. Thank you for supporting Pi.`, "info");
  return "starred";
}

export function shouldOfferPiStar(
  reason: SessionStartEvent["reason"],
  mode: ExtensionContext["mode"],
): boolean {
  return reason === "startup" && mode === "tui";
}

export async function offerPiStar(
  run: GithubCommandRunner,
  ui: StarPromptUi,
  store: PiStarPromptStateStore,
): Promise<PiStarOfferResult> {
  const preparation = await prepareStarOffer(store);
  if (!preparation.ready) return preparation.result;

  const viewer = await inspectGithubViewer(run);
  if (!viewer) return "unavailable";
  if (viewer.hasStarred) {
    const saved = await saveState(store, { ...preparation.state, knownStarred: true });
    return saved ? "already-starred" : "state-error";
  }

  return promptForPiStar(run, ui, store, preparation.state, viewer.login);
}
