# pi-must-win

pi-must-win is a branding and attribution extension for the Pi coding agent. It adds durable Pi
credit to commits created through Pi and asks users to support Pi on GitHub, giving the project the
same compounding visibility that larger coding-agent products build into their workflows.

## Install

Install pi-must-win from npm:

```bash
pi install npm:pi-must-win
```

To install directly from the Git repository instead:

```bash
pi install git:github.com/osolmaz/pi-must-win
```

Run `/reload` in an existing Pi session. New Pi sessions load it automatically.

## Motivation

Anthropic puts the Claude Code brand into work produced by its agent. Anysphere and OpenAI do the
same with Cursor Agent and Codex. Their implementations include commit trailers, pull-request footers,
attribution settings, dedicated UI, and even standalone attribution modules. The
[agent attribution notes](docs/agent-attribution.md) record concrete examples from their distributed
code and public source.

Pi operates with a fraction of the money and staff behind those products, yet it can compete with
them. pi-must-win gives Pi the same kind of product growth loop. Each attributed commit can lead
another developer back to [pi.dev](https://pi.dev) without adding banners to source files or pull
request text.

If you want to support Pi in solidarity, install the extension and let Pi receive credit for the work
it helps produce. This is growth hacking for a small open-source project that has earned the right to
be seen.

## Commit attribution

When Pi creates a Git commit through its built-in `bash` tool, pi-must-win adds:

```text
Co-Authored-By: <model name> <noreply@pi.dev>
Generated-By: pi <version> (https://pi.dev)
```

The extension uses a temporary `prepare-commit-msg` hook for the active Pi session. Existing hooks
still run, including hooks configured through `core.hooksPath`, and their failures still stop the
commit. pi-must-win leaves no hook or Git configuration in the repository.

Commits entered through `!git commit` or another terminal are unchanged. Other command executors can add attribution without rewriting shell commands through the [child environment API](docs/command-executor-integration.md).

## Disabling per repository

pi-must-win skips the whole extension — commit attribution and the star prompt — for repositories
listed in a global config file at `$XDG_CONFIG_HOME/pi-must-win/config.json` (default
`~/.config/pi-must-win/config.json`):

```json
{ "disabledRepos": ["github.com/openclaw", "~/experiments/junk"] }
```

Entries are remote-URL keys or absolute local paths:

- URL entries accept any remote syntax (`git@github.com:owner/repo.git`, `https://...`, `ssh://...`,
  with or without a port) and normalize to a lowercase `host/path` key. An entry matches exactly or
  as a path-segment prefix, so `github.com/openclaw` disables the whole org while `github.com/open`
  does not match `github.com/openclaw`.
- Path entries (starting with `/` or `~`) match the main clone path exactly, with symlinks resolved.

Matching keys on repository identity, not the working directory: the extension resolves
`git remote get-url origin` and `git rev-parse --path-format=absolute --git-common-dir` at load
time, so every linked worktree of a disabled repo is covered without committing configuration into
the repository. A missing or malformed config file disables nothing, and an empty list skips the
Git subprocesses entirely. Note that matching uses the `origin` remote, so a personal fork needs
its own entry.

The check runs twice. When the extension loads, a session started inside a disabled repo skips
the whole extension. Independently, the temporary `prepare-commit-msg` hook re-checks the repo it
is actually committing to through a small matcher (`check-disabled.mjs`, run with the same Node
binary as Pi), so commits made into a disabled repo from any other session directory — through
`git -C`, `cd` chains, or child processes — are skipped too. Skipped commits still restore the
Git configuration and chain to the repo's own hooks. A missing matcher or matcher error fails
open and keeps the trailers.

## GitHub star prompt

On the first interactive startup, pi-must-win checks the authenticated GitHub CLI account. If that
account has not starred [`earendil-works/pi`](https://github.com/earendil-works/pi), it asks whether
to star the repository. Confirming stars Pi through the GitHub API. Choosing No or pressing Escape
skips the request.

A skipped prompt returns with increasing backoff after 2, 3, 5, and 7 more startups. pi-must-win asks
at most five times and stops as soon as it sees that the account has starred Pi. The prompt appears
only in the interactive TUI, and it stays hidden when `gh` or GitHub authentication is unavailable.
The state file records only the prompt cadence and whether a star was seen. It never stores the GitHub
login.

## Dark-side disclosure

A CLI asking for a GitHub star can look like a dark pattern. Herdr once shipped this feature and
[removed it after someone raised that concern](https://github.com/ogulcancelik/herdr/issues/339). That
is fair criticism, so pi-must-win keeps the prompt bounded and visible. It shows the GitHub account,
waits for confirmation, backs off after a skip, and gives up after five asks.

Still, the package is called pi-must-win. If one polite request puts me on the path to the dark side
but gives Pi a better chance against billion-dollar competitors, I am willing to join the Sith. You
can press No. No Force choke follows.

## Scope

pi-must-win is an umbrella package for truthful Pi branding. New branding features can live beside
commit attribution while keeping repository contents clean and preserving the user's existing tools.
The star prompt runs only at process startup. Session changes and reloads remain uninterrupted.

## License

[MIT](LICENSE)
