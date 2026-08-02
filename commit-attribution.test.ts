import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { CommitAttributionSession } from "./features/commit-attribution.ts";

const sessions: CommitAttributionSession[] = [];

function createSession(): CommitAttributionSession {
  const session = new CommitAttributionSession();
  sessions.push(session);
  return session;
}

afterEach(() => {
  for (const session of sessions.splice(0)) session.stop();
});

describe("commit attribution session", () => {
  it("creates one hook directory per active session and removes it on stop", () => {
    const session = createSession();
    const firstDirectory = session.start();

    expect(existsSync(firstDirectory)).toBe(true);
    expect(session.start()).toBe(firstDirectory);

    session.stop();
    expect(existsSync(firstDirectory)).toBe(false);
    expect(() => {
      session.stop();
    }).not.toThrow();
  });

  it("starts lazily when wrapping a bash command and can start again after shutdown", () => {
    const session = createSession();
    const wrapped = session.wrap("git status", "Test Model", "0.80.10");

    expect(wrapped).toContain(
      "PI_MUST_WIN_CO_AUTHOR='Co-Authored-By: Test Model <noreply@pi.dev>'",
    );
    expect(wrapped).toContain(
      "PI_MUST_WIN_GENERATED_BY='Generated-By: pi 0.80.10 (https://pi.dev)'",
    );
    expect(wrapped).toMatch(/GIT_CONFIG_VALUE_.*pi-must-win-hooks-/);
    expect(wrapped.endsWith("\ngit status")).toBe(true);

    const firstDirectory = session.start();
    session.stop();
    const secondDirectory = session.start();
    expect(secondDirectory).not.toBe(firstDirectory);
  });

  it("builds an attributed child environment without changing the input", () => {
    const session = createSession();
    const baseEnvironment: NodeJS.ProcessEnv = {
      KEEP_ME: "yes",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "user.name",
      GIT_CONFIG_VALUE_0: "Tester",
    };

    const environment = session.environment(baseEnvironment, "Test Model", "0.80.10");

    expect(baseEnvironment).toEqual({
      KEEP_ME: "yes",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "user.name",
      GIT_CONFIG_VALUE_0: "Tester",
    });
    expect(environment).toMatchObject({
      KEEP_ME: "yes",
      GIT_CONFIG_COUNT: "2",
      GIT_CONFIG_KEY_0: "user.name",
      GIT_CONFIG_VALUE_0: "Tester",
      GIT_CONFIG_KEY_1: "core.hooksPath",
      PI_MUST_WIN_GIT_CONFIG_INDEX: "1",
      PI_MUST_WIN_CO_AUTHOR: "Co-Authored-By: Test Model <noreply@pi.dev>",
      PI_MUST_WIN_GENERATED_BY: "Generated-By: pi 0.80.10 (https://pi.dev)",
    });
    expect(environment["GIT_CONFIG_VALUE_1"]).toMatch(/pi-must-win-hooks-/u);
  });
});
