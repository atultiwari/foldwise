import { describe, expect, it } from "vitest";

import { handleRequest } from "../src/worker.js";
import { loadReference } from "../../core/test/fixtures/load.js";

const ubiquitin = loadReference().cases.find((c) => c.pdbId === "1UBI")!;

describe("worker protocol", () => {
  it("returns a trajectory and the buffers to hand over", () => {
    const { message, transfer } = handleRequest({
      type: "build",
      requestId: "r1",
      input: { id: "1UBI", native: ubiquitin.coords["ca"]!, secondaryStructure: ubiquitin.ss, frames: 8 },
    });

    expect(message.type).toBe("trajectory");
    if (message.type !== "trajectory") return;
    expect(message.requestId).toBe("r1");
    expect(message.residues).toBe(ubiquitin.seq.length);
    expect(message.positions.length).toBe(8 * ubiquitin.seq.length * 3);
    // Transferring rather than copying is the whole point of doing this here.
    expect(transfer).toHaveLength(3);
    expect(transfer).toContain(message.positions.buffer);
  });

  it("reports a bad request as an error rather than throwing", () => {
    // A worker that throws takes the whole thread down and the caller waits
    // forever, so failures have to come back as messages.
    const { message, transfer } = handleRequest({
      type: "build",
      requestId: "r2",
      input: { id: "x", native: [0, 0, 0], secondaryStructure: "CC" },
    });

    expect(message.type).toBe("error");
    if (message.type !== "error") return;
    expect(message.requestId).toBe("r2");
    expect(message.message).toMatch(/2 residues but 1/);
    expect(transfer).toHaveLength(0);
  });
});
