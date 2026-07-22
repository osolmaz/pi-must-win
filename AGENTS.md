# Pi Must Win

- Read the installed Pi extension documentation before changing runtime behavior.
- Keep branding truthful, recognizable, and limited to work created through Pi.
- Preserve existing Git hooks and propagate their failures.
- Never persist Git hooks or repository configuration.
- Sanitize external values before writing them to commit messages or shell environments.
- Update `docs/agent-attribution.md` when claims about another coding agent change.
- Keep TypeScript strict. Do not use explicit `any`, unsafe casts, or unchecked external input.
- Add or update tests for every behavior change.
- Avoid runtime dependencies when the standard library or Pi APIs suffice.
- Before finishing, run `npm run check`, `npm run mutate`, `npm run slophammer`, and
  `git diff --check`.
- Slophammer guidance: https://github.com/osolmaz/slophammer/blob/main/docs/AGENT_ENTRYPOINT.md
