# Pi Must Win

Pi Must Win is a branding and attribution extension for the Pi coding agent. It adds durable Pi
credit to commits created through Pi, giving the project the same compounding visibility that larger
coding-agent products build into their workflows.

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

## Install

Install the repository as a Pi package:

```bash
pi install git:github.com/osolmaz/pi-must-win
```

Run `/reload` in an existing Pi session. New Pi sessions load it automatically.

## Scope

Pi Must Win is an umbrella package for truthful Pi branding. New branding features can live beside
commit attribution while keeping repository contents clean and preserving the user's existing tools.

## License

[MIT](LICENSE)
