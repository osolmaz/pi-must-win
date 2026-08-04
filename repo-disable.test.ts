import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";

import piMustWin from "./index.ts";
import {
  DEFAULT_CONFIG_PATH,
  defaultConfigPath,
  isRepoDisabled,
  isRepoDisabledForSession,
  loadConfig,
  normalizeRepoUrl,
  parseConfig,
  resolveRepoIdentity,
} from "./features/repo-disable.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { force: true, recursive: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-must-win-test-"));
  tempDirs.push(dir);
  return dir;
}

function tempConfig(text: string): string {
  const path = join(tempDir(), "config.json");
  writeFileSync(path, text);
  return path;
}

function missingConfigPath(): string {
  return join(tempDir(), "missing.json");
}

function git(args: string[], cwd: string): void {
  execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "ignore"] });
}

function initRepo(remote?: string): string {
  const dir = tempDir();
  git(["init", "-q", "."], dir);
  if (remote !== undefined) git(["remote", "add", "origin", remote], dir);
  return dir;
}

describe("parseConfig", () => {
  it("returns an empty list for malformed or wrongly shaped input", () => {
    expect(parseConfig("not json")).toEqual({ disabledRepos: [] });
    expect(parseConfig('"text"')).toEqual({ disabledRepos: [] });
    expect(parseConfig("null")).toEqual({ disabledRepos: [] });
    expect(parseConfig("{}")).toEqual({ disabledRepos: [] });
    expect(parseConfig('{"disabledRepos": "github.com/openclaw"}')).toEqual({ disabledRepos: [] });
  });

  it("keeps only string entries", () => {
    expect(parseConfig('{"disabledRepos": ["a", 1, "b", null]}')).toEqual({
      disabledRepos: ["a", "b"],
    });
  });
});

describe("loadConfig", () => {
  it("returns an empty list when the file is missing and parses a present file", () => {
    expect(loadConfig(missingConfigPath())).toEqual({ disabledRepos: [] });
    expect(loadConfig(tempConfig('{"disabledRepos": ["github.com/openclaw"]}'))).toEqual({
      disabledRepos: ["github.com/openclaw"],
    });
  });
});

describe("defaultConfigPath", () => {
  it("honors XDG_CONFIG_HOME and falls back to ~/.config", () => {
    const fallback = join(homedir(), ".config", "pi-must-win", "config.json");
    expect(defaultConfigPath({ XDG_CONFIG_HOME: "/custom" })).toBe(
      join("/custom", "pi-must-win", "config.json"),
    );
    expect(defaultConfigPath({})).toBe(fallback);
    expect(defaultConfigPath({ XDG_CONFIG_HOME: "   " })).toBe(fallback);
    expect(DEFAULT_CONFIG_PATH).toBe(defaultConfigPath());
  });
});

describe("normalizeRepoUrl", () => {
  it("normalizes common remote syntaxes to host/path keys", () => {
    expect(normalizeRepoUrl("git@github.com:OpenClaw/OpenClaw.git")).toBe(
      "github.com/openclaw/openclaw",
    );
    expect(normalizeRepoUrl("https://github.com/openclaw/openclaw/")).toBe(
      "github.com/openclaw/openclaw",
    );
    expect(normalizeRepoUrl("ssh://git@github.com/openclaw/openclaw.git")).toBe(
      "github.com/openclaw/openclaw",
    );
  });

  it("strips explicit ports from scheme URLs", () => {
    expect(normalizeRepoUrl("ssh://git@github.com:2222/OpenClaw/OpenClaw.git")).toBe(
      "github.com/openclaw/openclaw",
    );
    expect(normalizeRepoUrl("ssh://git@github.com:2222")).toBe("github.com");
  });

  it("only strips schemes, slashes, and .git at their anchored positions", () => {
    expect(normalizeRepoUrl("http://github.com/openclaw/openclaw")).toBe(
      "github.com/openclaw/openclaw",
    );
    expect(normalizeRepoUrl("xhttps://github.com/a/b")).toBe("xhttps///github.com/a/b");
    expect(normalizeRepoUrl("https://github.com/openclaw/openclaw//")).toBe(
      "github.com/openclaw/openclaw",
    );
    expect(normalizeRepoUrl("github.com/a.git.b")).toBe("github.com/a.git.b");
  });
});

describe("isRepoDisabled", () => {
  it("matches URL entries exactly and on segment prefixes", () => {
    const identity = { urlKey: "github.com/openclaw/clawhub", repoPath: undefined };
    expect(isRepoDisabled(identity, { disabledRepos: ["github.com/openclaw/clawhub"] })).toBe(true);
    expect(isRepoDisabled(identity, { disabledRepos: ["github.com/openclaw"] })).toBe(true);
    expect(
      isRepoDisabled(identity, { disabledRepos: ["git@github.com:openclaw/clawhub.git"] }),
    ).toBe(true);
    expect(isRepoDisabled(identity, { disabledRepos: ["github.com/open"] })).toBe(false);
    expect(isRepoDisabled(identity, { disabledRepos: ["github.com/otherorg"] })).toBe(false);
    expect(isRepoDisabled(identity, { disabledRepos: [".git"] })).toBe(false);
    expect(isRepoDisabled(identity, { disabledRepos: [" github.com/openclaw "] })).toBe(true);
    expect(isRepoDisabled({ urlKey: "", repoPath: undefined }, { disabledRepos: [".git"] })).toBe(
      false,
    );
  });

  it("matches path entries against the main clone path", () => {
    const identity = { urlKey: undefined, repoPath: join(homedir(), "repo") };
    expect(isRepoDisabled(identity, { disabledRepos: ["~/repo"] })).toBe(true);
    expect(isRepoDisabled(identity, { disabledRepos: [`${join(homedir(), "repo")}/`] })).toBe(true);
    expect(isRepoDisabled(identity, { disabledRepos: [`${join(homedir(), "repo")}//`] })).toBe(
      true,
    );
    expect(isRepoDisabled(identity, { disabledRepos: [join(homedir(), "repo", ".git")] })).toBe(
      true,
    );
    expect(isRepoDisabled(identity, { disabledRepos: [` ${join(homedir(), "repo")} `] })).toBe(
      true,
    );
    expect(
      isRepoDisabled(
        { urlKey: undefined, repoPath: join(homedir(), "repo.git", "repo") },
        { disabledRepos: [join(homedir(), "repo.git", "repo")] },
      ),
    ).toBe(true);
    expect(isRepoDisabled(identity, { disabledRepos: [join(homedir(), "other")] })).toBe(false);
    expect(
      isRepoDisabled(
        { urlKey: undefined, repoPath: "/missing/pi-must-win-test-path" },
        { disabledRepos: ["/missing/pi-must-win-test-path"] },
      ),
    ).toBe(true);
  });

  it("matches symlinked path entries against the physical clone path", () => {
    const dir = tempDir();
    const link = join(tempDir(), "link");
    symlinkSync(dir, link);
    const identity = { urlKey: undefined, repoPath: realpathSync(dir) };
    expect(isRepoDisabled(identity, { disabledRepos: [link] })).toBe(true);
  });

  it("ignores entries whose identity side is unknown", () => {
    expect(
      isRepoDisabled(
        { urlKey: undefined, repoPath: undefined },
        { disabledRepos: ["github.com/a", "/x"] },
      ),
    ).toBe(false);
    expect(
      isRepoDisabled({ urlKey: undefined, repoPath: "/x" }, { disabledRepos: ["github.com/a"] }),
    ).toBe(false);
  });
});

describe("resolveRepoIdentity", () => {
  it("returns undefined fields outside a Git repository", () => {
    expect(resolveRepoIdentity(tempDir())).toEqual({ urlKey: undefined, repoPath: undefined });
  });

  it("resolves the clone path without a remote", () => {
    const dir = initRepo();
    expect(resolveRepoIdentity(dir)).toEqual({ urlKey: undefined, repoPath: realpathSync(dir) });
  });

  it("normalizes the origin URL", () => {
    const dir = initRepo("git@github.com:OpenClaw/OpenClaw.git");
    expect(resolveRepoIdentity(dir)).toEqual({
      urlKey: "github.com/openclaw/openclaw",
      repoPath: realpathSync(dir),
    });
  });

  it("resolves a linked worktree to the main clone path", () => {
    const dir = initRepo("https://github.com/osolmaz/pi-must-win.git");
    git(
      ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--allow-empty", "-qm", "init"],
      dir,
    );
    const linked = join(tempDir(), "linked");
    git(["worktree", "add", "-q", linked], dir);
    const main = resolveRepoIdentity(dir);
    const fromWorktree = resolveRepoIdentity(linked);
    expect(fromWorktree.urlKey).toBe("github.com/osolmaz/pi-must-win");
    expect(fromWorktree.repoPath).toBe(main.repoPath);
    expect(fromWorktree.repoPath).not.toBe(linked);
  });
});

describe("isRepoDisabledForSession", () => {
  it("matches a disabled repository through the config file", () => {
    const configPath = tempConfig('{"disabledRepos": ["github.com/openclaw"]}');
    expect(
      isRepoDisabledForSession({
        configPath,
        identity: { urlKey: "github.com/openclaw/clawhub", repoPath: undefined },
      }),
    ).toBe(true);
  });

  it("skips repository checks when no repos are disabled", () => {
    expect(
      isRepoDisabledForSession({ configPath: tempConfig('{"disabledRepos": []}'), cwd: tempDir() }),
    ).toBe(false);
  });

  it("resolves identity from an explicit cwd and stays enabled outside Git", () => {
    const configPath = tempConfig('{"disabledRepos": ["github.com/otherorg"]}');
    expect(isRepoDisabledForSession({ configPath, cwd: tempDir() })).toBe(false);
  });

  it("resolves identity from the process cwd and the default config path", () => {
    const configPath = tempConfig('{"disabledRepos": ["github.com/otherorg"]}');
    expect(isRepoDisabledForSession({ configPath })).toBe(false);
    expect(isRepoDisabledForSession({ identity: { urlKey: undefined, repoPath: undefined } })).toBe(
      false,
    );
  });
});

describe("piMustWin gate", () => {
  /** Minimal typed seam of the ExtensionAPI members `piMustWin` actually calls. */
  type MockPi = {
    exec: () => Promise<{ stdout: string; stderr: string; code: number }>;
    on: (event: string, handler: (...args: unknown[]) => unknown) => void;
  };

  function createMockPi() {
    const handlers = new Map<string, ((...args: unknown[]) => unknown)[]>();
    const mock: MockPi = {
      exec: () => Promise.resolve({ stdout: "", stderr: "", code: 0 }),
      on: (event, handler) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      },
    };
    // Widening assertion from the checked minimal seam to the full interface.
    return { pi: mock as unknown as ExtensionAPI, handlers };
  }

  it("registers nothing when the repository is disabled", () => {
    const { pi, handlers } = createMockPi();
    const configPath = tempConfig('{"disabledRepos": ["github.com/openclaw"]}');
    piMustWin(pi, {
      repoDisable: {
        configPath,
        identity: { urlKey: "github.com/openclaw/clawhub", repoPath: undefined },
      },
    });
    expect(handlers.size).toBe(0);
  });

  it("registers commit attribution and the star prompt when enabled", () => {
    const { pi, handlers } = createMockPi();
    piMustWin(pi, {
      repoDisable: {
        configPath: missingConfigPath(),
        identity: { urlKey: undefined, repoPath: undefined },
      },
    });
    expect(handlers.has("tool_call")).toBe(true);
    expect(handlers.has("session_start")).toBe(true);
  });
});
