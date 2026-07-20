# Agent attribution in other coding tools

This note records attribution features shipped by other coding-agent products. It keeps the
motivation for Pi Must Win tied to inspectable behavior and avoids guesses about a company's intent.
The source calls these features attribution. Pi Must Win treats their distribution effect as a growth
loop.

The observations below were checked on July 20, 2026. Bundled product code can change between
releases, so version numbers and source revisions are included where possible.

## Claude Code

Claude Code 2.1.214 builds separate default attribution strings for commits and pull requests. Its
commit string is:

```text
Co-Authored-By: <Claude model name> <noreply@anthropic.com>
```

Its pull-request string is:

```text
🤖 Generated with [Claude Code](https://claude.ai/code)
```

The distributed bundle resolves these values through an attribution configuration object. Users can
override the commit and pull-request strings, and the older `includeCoAuthoredBy` setting can disable
the default commit trailer. Deliberate product code produces the attribution each time a commit is
written.

Anthropic publishes the official Claude Code repository at
[`anthropics/claude-code`](https://github.com/anthropics/claude-code). The executable bundle contains
the attribution implementation. The public repository provides plugins and documentation alongside
release materials. The complete CLI source is absent.

## Cursor Agent

Cursor Agent 2026.07.16-899851b ships commit and pull-request attribution as enabled defaults:

```text
attribution.attributeCommitsToAgent = true
attribution.attributePRsToAgent = true
```

The CLI settings screen exposes both switches under an `Attribution` group. Request-context code
passes `commitAttributionMessage: "enabled"` and `prAttributionMessage: "enabled"` into an agent run
when those switches are active.

The bundled JavaScript retains the original module name
`src/components/ai-attribution-tool-ui.tsx`. It also contains an `ai_attribution_tool` feature flag,
several `ai_code_tracking_*` flags, and developer commands that score commits for AI-generated code
attribution. Cursor-generated commit commands use this trailer:

```text
Co-authored-by: Cursor <cursoragent@cursor.com>
```

Cursor therefore gives attribution its own configuration, request fields, tool protocol, UI, code
tracking, and commit metadata.

## Codex

OpenAI introduced a dedicated `codex-git-attribution` extension crate in Codex commit
[`569ff6a`](https://github.com/openai/codex/commit/569ff6a1c400bd514ff79f5f1050a684dc3afde3).
The extension contributed a developer-policy prompt that required this trailer:

```text
Co-authored-by: Codex <noreply@openai.com>
```

The implementation lived at
[`codex-rs/ext/git-attribution/src/lib.rs`](https://github.com/openai/codex/blob/569ff6a1c400bd514ff79f5f1050a684dc3afde3/codex-rs/ext/git-attribution/src/lib.rs).
OpenAI later removed that user-commit feature in
[`d18a7c9`](https://github.com/openai/codex/commit/d18a7c982e4abad5bf549cda6f4b61a18c10702e),
so it should not be described as a current Codex default.

Current Codex source still gives internal Git baseline commits a Codex author identity and the same
co-author trailer in
[`codex-rs/git-utils/src/baseline.rs`](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/git-utils/src/baseline.rs).
That code is limited to Codex-managed baseline repositories.

## Product effect

These implementations differ in reach and have changed over time. The recurring product decision is
to spend engineering effort on attribution through commit metadata, pull-request copy, settings,
protocol fields, and UI backed by tests. That attribution carries the product name into repositories where
other developers can encounter it. Pi Must Win applies the same mechanism to Pi with a small,
inspectable extension that users choose to install.
