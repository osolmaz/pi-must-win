import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkDisabledPath } from "./git-commit-trailers.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { force: true, recursive: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-must-win-check-test-"));
  tempDirs.push(dir);
  return dir;
}

function initRepo(remote?: string): string {
  const dir = tempDir();
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  if (remote !== undefined) {
    execFileSync("git", ["remote", "add", "origin", remote], { cwd: dir });
  }
  return dir;
}

function runCheck(cwd: string, urls: string[], paths: string[]): number {
  const result = spawnSync(process.execPath, [checkDisabledPath()], {
    cwd,
    env: {
      PATH: process.env["PATH"] ?? "",
      PI_MUST_WIN_DISABLED_URLS: JSON.stringify(urls),
      PI_MUST_WIN_DISABLED_PATHS: JSON.stringify(paths),
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.status === null) throw new Error("matcher was terminated by a signal");
  return result.status;
}

describe("check-disabled matcher", () => {
  it("exits 0 for a disabled URL key, exactly or as an org prefix", () => {
    const repo = initRepo("git@github.com:OpenClaw/OpenClaw.git");
    expect(runCheck(repo, ["github.com/openclaw/openclaw"], [])).toBe(0);
    expect(runCheck(repo, ["github.com/openclaw"], [])).toBe(0);
  });

  it("exits 1 for non-matching entries and for an empty config", () => {
    const repo = initRepo("git@github.com:OpenClaw/OpenClaw.git");
    expect(runCheck(repo, ["github.com/otherorg"], [])).toBe(1);
    expect(runCheck(repo, [], [])).toBe(1);
  });

  it("exits 0 for a realpath-resolved clone path match", () => {
    const repo = initRepo();
    expect(runCheck(repo, [], [realpathSync(repo)])).toBe(0);
    expect(runCheck(repo, [], [join(realpathSync(repo), "nested")])).toBe(1);
  });

  it("exits 1 outside a Git repository and on malformed entry JSON", () => {
    const plain = tempDir();
    expect(runCheck(plain, ["github.com/openclaw"], [])).toBe(1);
    const repo = initRepo("https://github.com/openclaw/openclaw.git");
    const result = spawnSync(process.execPath, [checkDisabledPath()], {
      cwd: repo,
      env: {
        PATH: process.env["PATH"] ?? "",
        PI_MUST_WIN_DISABLED_URLS: "not json",
        PI_MUST_WIN_DISABLED_PATHS: '{"a": 1}',
      },
      stdio: ["ignore", "ignore", "ignore"],
    });
    expect(result.status).toBe(1);
  });

  it("exits 0 from a linked worktree through the main clone path", () => {
    const repo = initRepo("https://github.com/openclaw/openclaw.git");
    execFileSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--allow-empty", "-qm", "init"],
      { cwd: repo },
    );
    const linked = join(tempDir(), "linked");
    execFileSync("git", ["worktree", "add", "-q", linked], { cwd: repo });
    expect(runCheck(linked, ["github.com/openclaw"], [])).toBe(0);
    expect(runCheck(linked, [], [realpathSync(repo)])).toBe(0);
    expect(runCheck(linked, [], [realpathSync(linked)])).toBe(1);
  });
});
