---
title: Hook-time repository disable plan
author: Onur Solmaz <2453968+osolmaz@users.noreply.github.com>
date: 2026-08-06
---

# Hook-time repository disable plan

## Purpose

The per-repository disable gate resolves repo identity once at extension load from the session's
own working directory. Sessions launched from a non-repo directory (or any other repo) therefore
disable nothing, and commits the agent later makes inside a disabled repository — via `git -C`,
`cd` chains, subshells, or child processes — still get attribution trailers. The user hit exactly
this: commits in `openclaw` repos received trailers despite the org being listed in the config.

## Design

Evaluate the policy at the point of action. Git runs `prepare-commit-msg` with the working
directory inside the target repository, so the hook itself is the one place that always knows the
commit's true repo, regardless of how it was invoked.

1. At session start, the extension pre-normalizes the disabled entries with the existing tested
   code (`disabledEntriesForEnv`): URL entries become `host/path` keys, path entries become
   realpath-resolved absolute paths. No identity resolution happens here.
2. The attribution environment gains four variables: `PI_MUST_WIN_DISABLED_URLS` and
   `PI_MUST_WIN_DISABLED_PATHS` (JSON arrays), `PI_MUST_WIN_NODE` (`process.execPath`), and
   `PI_MUST_WIN_CHECK` (the package's `check-disabled.mjs` path).
3. The `prepare-commit-msg` hook first runs the matcher: `"$PI_MUST_WIN_NODE" "$PI_MUST_WIN_CHECK"`.
   On a match it skips the trailer edit but still restores the Git config and chains to any
   pre-existing repo hook. Missing node, missing matcher, or matcher error all fail open (trailers
   proceed), matching the config's fail-open philosophy.
4. `check-disabled.mjs` is a small plain-JS CLI so the hook needs no TypeScript loader. It exits
   early without Git subprocesses when both lists are empty, resolves the identity of the repo it
   runs in, and compares against the pre-normalized lists. It is the only hook-side logic; entry
   normalization stays in the tested TypeScript module.
5. The session-level gate stays as a fast path: a session started inside a disabled repo still
   skips wrapping and the star prompt entirely.

Rejected: parsing `git -C`/`cd` out of command strings at wrap time (fragile under quoting,
subshells, and chained commands), and re-implementing entry normalization in POSIX sh (a second
matcher that must forever agree with the first).

## Scope

- `check-disabled.mjs` (new), `disabledEntriesForEnv` in `features/repo-disable.ts`, environment
  and hook changes in `git-commit-trailers.ts`, session and registration wiring.
- README documentation and release `0.5.0`.

## Non-goals

- No retroactive cleanup of trailers already committed.
- No change to the config file format, matching semantics, or the session-level gate.
- The `.mjs` matcher is plain JavaScript by design (no TS loader in the hook); it is covered
  through the real-Git integration tests, not the TypeScript mutation targets.

## Acceptance criteria

- A session launched from a non-repo directory adds no trailers to a commit in a disabled repo,
  and still adds them in an enabled repo.
- A repo's own `prepare-commit-msg` hook still runs when trailers are skipped.
- Unified Exec child environments carry the same matcher env, so child commits are covered too.
- Existing behavior (trailers, chaining, config restore, session gate) is unchanged.

## Verification

- Real-Git integration tests for disabled URL/path match, non-match, empty lists, missing matcher,
  and hook chaining; unit tests for `disabledEntriesForEnv` and the matcher CLI exit codes.
- `npm run check`, `npm run mutate`, `npm run slophammer`, and `git diff --check`.
- Pi Reviewer against `main`, then CI, merge, and GitHub release `v0.5.0`.
