import {
  buildCommitAttributionEnvironment,
  createCommitHookDirectory,
  removeCommitHookDirectory,
  wrapBashWithCommitAttribution,
} from "../git-commit-trailers.ts";

export class CommitAttributionSession {
  private hooksDirectory: string | undefined;

  start(): string {
    this.hooksDirectory ??= createCommitHookDirectory();
    return this.hooksDirectory;
  }

  stop(): void {
    removeCommitHookDirectory(this.hooksDirectory);
    this.hooksDirectory = undefined;
  }

  environment(
    baseEnvironment: NodeJS.ProcessEnv,
    modelName: string,
    piVersion: string,
  ): NodeJS.ProcessEnv {
    return buildCommitAttributionEnvironment(baseEnvironment, this.start(), modelName, piVersion);
  }

  wrap(command: string, modelName: string, piVersion: string): string {
    return wrapBashWithCommitAttribution(command, this.start(), modelName, piVersion);
  }
}
