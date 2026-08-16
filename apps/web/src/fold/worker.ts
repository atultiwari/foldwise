/**
 * Worker entry point.
 *
 * The engine's `handleRequest` does the work and returns the buffers to hand
 * over; this file is only the postMessage plumbing.
 */

import { handleRequest, type BuildRequest } from "@foldwise/fold";

self.addEventListener("message", (event: MessageEvent<BuildRequest>) => {
  if (event.data?.type !== "build") return;
  const { message, transfer } = handleRequest(event.data);
  self.postMessage(message, { transfer });
});
