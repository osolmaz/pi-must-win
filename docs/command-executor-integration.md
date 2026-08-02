# Command executor integration

Pi Must Win can attribute commits created by a Pi command executor without knowing the executor's tool name or command schema. The executor or a composition package applies attribution to the child process environment immediately before spawn.

## Environment API

Create one `CommitAttributionSession` for the Pi session. Pass the child environment, active model name, and Pi version to `environment()`:

```ts
import { VERSION } from "@earendil-works/pi-coding-agent";
import piMustWin, { CommitAttributionSession } from "pi-must-win/index.ts";

const attribution = new CommitAttributionSession();

// Reuse the same session for Pi Must Win's built-in Bash integration.
piMustWin(pi, { commitAttributionSession: attribution });

const childEnvironment = attribution.environment({ ...process.env }, activeModelName, VERSION);

spawn(command, args, { env: childEnvironment });
```

Call `stop()` during `session_shutdown`:

```ts
pi.on("session_shutdown", () => {
  attribution.stop();
});
```

The returned object preserves the supplied environment and adds process-local Git configuration, trailer values, and the temporary `prepare-commit-msg` hook path. The input object is unchanged.

## Executor boundary

Apply the environment as late as possible, after the command, working directory, shell, and base environment are resolved but before the child starts. This keeps attribution independent of shell syntax and works with POSIX shells, PowerShell, and `cmd.exe`.

Do not persist the returned Git configuration in the repository or user Git config. Do not reuse the environment after `stop()` removes the temporary hook directory.

The temporary hook restores inherited `GIT_CONFIG_*` entries before it runs the user's existing `prepare-commit-msg` hook. Existing hook failures continue to stop the commit.
