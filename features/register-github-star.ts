import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createPiStarPromptStateStore } from "./github-star-state.ts";
import { offerPiStar, shouldOfferPiStar } from "./github-star.ts";

export function registerGithubStar(pi: ExtensionAPI): void {
  const store = createPiStarPromptStateStore();
  pi.on("session_start", async (event, context) => {
    if (!shouldOfferPiStar(event.reason, context.mode)) return;

    await offerPiStar(
      (command, args, options) => pi.exec(command, args, options),
      context.ui,
      store,
    );
  });
}
