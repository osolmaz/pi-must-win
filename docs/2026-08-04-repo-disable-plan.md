---
title: Repository disable plan
author: Onur Solmaz <2453968+osolmaz@users.noreply.github.com>
date: 2026-08-04
---

# Repository disable plan

## Purpose

Pi Must Win adds attribution trailers to every commit Pi creates, with no way to turn it off per
repository. Users need to disable it for certain repos — including whole GitHub orgs — and they work
with Git worktrees, so config placed in a single checkout is not enough.

This feature was first built in the OnurPi wrapper package. It belongs here instead, so standalone
installations of Pi Must Win get the same behavior.

## Scope

- A new covered module `features/repo-disable.ts` with config parsing, repository identity
  resolution, and matching.
- A load-time gate in the default export of `index.ts`.
- An exported predicate so wrapper packages (OnurPi) can gate their own attribution plumbing.
- README documentation and release `0.4.0`.

## Non-goals

- No project-local `.pi` config. It only propagates to worktrees when committed, which pollutes
  shared repositories.
- No per-command re-checks; the decision is made once at extension load.
- No change to trailer content, hook behavior, or the star prompt cadence.

## Design

Config file at `$XDG_CONFIG_HOME/pi-must-win/config.json` (default `~/.config/pi-must-win/config.json`):

```json
{ "disabledRepos": ["github.com/openclaw", "~/experiments/junk"] }
```

- URL entries in any remote syntax normalize to a lowercase `host/path` key (ports stripped) and
  match exactly or on path-segment prefixes, so one entry can cover a repo, an org, or a host.
- Path entries (starting with `/` or `~`) match the main clone path exactly after `realpathSync`, so
  symlinked clone locations still match.
- Identity comes from `git remote get-url origin` and
  `git rev-parse --path-format=absolute --git-common-dir`, both identical across linked worktrees.
- A missing, unreadable, or malformed config disables nothing. An empty `disabledRepos` list skips
  the Git subprocesses entirely.

The default export returns early when the session repository is disabled, so neither commit
attribution nor the star prompt registers. The predicate is exported as
`isRepoDisabledForSession(options?)` with injectable `configPath`, `cwd`, and `identity` for tests
and wrappers.

## Acceptance criteria

- Disabled repo: no `tool_call` wrapping and no star prompt registration.
- Enabled repo: unchanged behavior.
- Identity resolution from a linked worktree returns the main clone path.
- Coverage stays above thresholds; mutation score stays acceptable.

## Verification

- `npm run check`, `npm run mutate`, `npm run slophammer`, and `git diff --check`.
- Pi Reviewer against `main`, then CI, merge, and GitHub release `v0.4.0` (publishes to npm).
