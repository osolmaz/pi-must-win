# Pi Must Win

Pi Must Win is a branding and attribution extension for the Pi coding agent. It adds durable Pi
credit to commits created through Pi and asks users to support Pi on GitHub, giving the project the
same compounding visibility that larger coding-agent products build into their workflows.

## Install

Install Pi Must Win from npm:

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
them. Pi Must Win gives Pi the same kind of product growth loop. Each attributed commit can lead
another developer back to [pi.dev](https://pi.dev) without adding banners to source files or pull
request text.

If you want to support Pi in solidarity, install the extension and let Pi receive credit for the work
it helps produce. This is growth hacking for a small open-source project that has earned the right to
be seen.

## Commit attribution

When Pi creates a Git commit through its `bash` tool, Pi Must Win adds:

```text
Co-Authored-By: <model name> <noreply@pi.dev>
Generated-By: pi <version> (https://pi.dev)
```

The extension uses a temporary `prepare-commit-msg` hook for the active Pi session. Existing hooks
still run, including hooks configured through `core.hooksPath`, and their failures still stop the
commit. Pi Must Win leaves no hook or Git configuration in the repository.

Commits entered through `!git commit` or another terminal are unchanged.

## GitHub star prompt

On the first interactive startup, Pi Must Win checks the authenticated GitHub CLI account. If that
account has not starred [`earendil-works/pi`](https://github.com/earendil-works/pi), it asks whether
to star the repository. Confirming stars Pi through the GitHub API. Choosing No or pressing Escape
skips the request.

A skipped prompt returns with increasing backoff after 2, 3, 5, and 7 more startups. Pi Must Win asks
at most five times and stops as soon as it sees that the account has starred Pi. The prompt appears
only in the interactive TUI, and it stays hidden when `gh` or GitHub authentication is unavailable.
The state file records only the prompt cadence and whether a star was seen. It never stores the GitHub
login.

## Dark-side disclosure

A CLI asking for a GitHub star can look like a dark pattern. Herdr once shipped this feature and
[removed it after someone raised that concern](https://github.com/ogulcancelik/herdr/issues/339). That
is fair criticism, so Pi Must Win keeps the prompt bounded and visible. It shows the GitHub account,
waits for confirmation, backs off after a skip, and gives up after five asks.

Still, the package is called Pi Must Win. If one polite request puts me on the path to the dark side
but gives Pi a better chance against billion-dollar competitors, I am willing to join the Sith. You
can press No. No Force choke follows.

## Scope

Pi Must Win is an umbrella package for truthful Pi branding. New branding features can live beside
commit attribution while keeping repository contents clean and preserving the user's existing tools.
The star prompt runs only at process startup. Session changes and reloads remain uninterrupted.

## License

[MIT](LICENSE)
