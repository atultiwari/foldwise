import { describe, expect, it } from "vitest";

import {
  DEFAULT_CUTOFF,
  contactDensity,
  fractionFormed,
  nativeContacts,
} from "../src/contacts.js";
import {
  CONTACT_ORDER_OPTIONS,
  contactOrder,
  perResidueContactOrder,
  relativeContactOrder,
} from "../src/contactOrder.js";
import { loadReference } from "./fixtures/load.js";

/** A straight chain at 3.8 A spacing -- no residue is near any non-neighbour. */
function extendedChain(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i * 3.8, 0, 0);
  return out;
}

/** A hairpin: two antiparallel strands 5 A apart, joined by a tight turn. */
function hairpin(armLength: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < armLength; i++) out.push(i * 3.8, 0, 0);
  for (let i = 0; i < armLength; i++) out.push((armLength - 1 - i) * 3.8, 5, 0);
  return out;
}

describe("nativeContacts", () => {
  it("finds nothing in a fully extended chain", () => {
    expect(nativeContacts(extendedChain(30))).toHaveLength(0);
  });

  it("pairs the two arms of a hairpin", () => {
    const contacts = nativeContacts(hairpin(10));
    expect(contacts.length).toBeGreaterThan(5);
    // Every contact should join one arm to the other.
    for (const { i, j } of contacts) {
      expect(i < 10 && j >= 10).toBe(true);
    }
  });

  it("excludes near neighbours by default", () => {
    const contacts = nativeContacts(extendedChain(10), { cutoff: 20 });
    for (const { i, j } of contacts) expect(j - i).toBeGreaterThanOrEqual(3);
  });

  it("honours a custom minimum separation", () => {
    const contacts = nativeContacts(extendedChain(10), { cutoff: 20, minSeparation: 1 });
    expect(contacts.some(({ i, j }) => j - i === 1)).toBe(true);
  });

  it("keeps inter-chain pairs regardless of index distance", () => {
    // Two residues adjacent in index but on different chains are a real contact.
    const coords = [0, 0, 0, 3, 0, 0];
    const contacts = nativeContacts(coords, { chainOf: [0, 1] });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]!.separation).toBe(0);
  });

  it("reports the native distance and separation", () => {
    const coords = [0, 0, 0, 100, 0, 0, 200, 0, 0, 5, 0, 0];
    const [contact] = nativeContacts(coords);
    expect(contact!.i).toBe(0);
    expect(contact!.j).toBe(3);
    expect(contact!.distance).toBeCloseTo(5, 12);
    expect(contact!.separation).toBe(3);
  });

  it("uses an 8 angstrom cutoff by default", () => {
    expect(DEFAULT_CUTOFF).toBe(8);
    const justInside = [0, 0, 0, 0, 0, 0, 0, 0, 0, 7.9, 0, 0];
    const justOutside = [0, 0, 0, 0, 0, 0, 0, 0, 0, 8.1, 0, 0];
    expect(nativeContacts(justInside)).toHaveLength(1);
    expect(nativeContacts(justOutside)).toHaveLength(0);
  });
});

describe("fractionFormed", () => {
  const native = hairpin(10);
  const contacts = nativeContacts(native);

  it("is 1 in the native state", () => {
    expect(fractionFormed(contacts, native)).toBe(1);
  });

  it("is 0 when the chain is pulled straight", () => {
    expect(fractionFormed(contacts, extendedChain(20))).toBe(0);
  });

  it("is 1 when there are no contacts to form", () => {
    expect(fractionFormed([], extendedChain(5))).toBe(1);
  });
});

describe("contactDensity", () => {
  it("counts both partners of every contact", () => {
    const density = contactDensity([{ i: 0, j: 4, distance: 5, separation: 4 }], 6);
    expect(Array.from(density)).toEqual([1, 0, 0, 0, 1, 0]);
  });
});

describe("contactOrder", () => {
  it("is low for a helix-like local structure and high for a hairpin", () => {
    // Every hairpin contact reaches most of the way across the chain; a local
    // structure's contacts stay within a few residues. This ordering is the
    // whole basis of the folding schedule.
    const local = nativeContacts(hairpin(3), CONTACT_ORDER_OPTIONS);
    const longRange = nativeContacts(hairpin(20), CONTACT_ORDER_OPTIONS);
    expect(contactOrder(local, 6).absolute).toBeLessThan(
      contactOrder(longRange, 40).absolute,
    );
  });

  it("is zero when every contact is between chains", () => {
    const contacts = [{ i: 0, j: 5, distance: 4, separation: 0 }];
    expect(contactOrder(contacts, 10)).toEqual({ absolute: 0, relative: 0 });
  });

  it("rejects a non-positive chain length", () => {
    expect(() => contactOrder([], 0)).toThrow(/must be positive/);
  });

  it("reproduces ubiquitin's published relative contact order", () => {
    // Plaxco, Simons & Baker (1998) put ubiquitin at roughly 15%. Their
    // criterion is all-heavy-atom within 6 A; ours approximates it on Ca,
    // which is why the tolerance is a couple of points rather than a decimal.
    const ubiquitin = loadReference().cases.find((c) => c.pdbId === "1UBI")!;
    const { relative } = relativeContactOrder(
      ubiquitin.coords["ca"]!,
      ubiquitin.seq.length,
    );
    expect(relative * 100).toBeGreaterThan(13);
    expect(relative * 100).toBeLessThan(18);
  });

  it("separates an all-alpha protein from a beta-rich one", () => {
    // Helices are local, sheets are not. Mpro (28% strand) must come out with
    // longer-reaching contacts than ubiquitin's compact beta-grasp does not
    // -- this is a sanity check that the measure tracks real topology.
    const cases = loadReference().cases;
    const mpro = cases.find((c) => c.pdbId === "7VH8")!;
    const ubiquitin = cases.find((c) => c.pdbId === "1UBI")!;
    const mproCo = relativeContactOrder(mpro.coords["ca"]!, mpro.seq.length);
    const ubiCo = relativeContactOrder(ubiquitin.coords["ca"]!, ubiquitin.seq.length);
    // Absolute reach grows with size; relative contact order falls, because a
    // large protein's contacts are local relative to its own length.
    expect(mproCo.absolute).toBeGreaterThan(ubiCo.absolute);
    expect(mproCo.relative).toBeLessThan(ubiCo.relative);
  });

  it("warns by construction against the Q convention", () => {
    // Documented trap: using Q's contact set roughly doubles the answer.
    const ubiquitin = loadReference().cases.find((c) => c.pdbId === "1UBI")!;
    const withQ = contactOrder(
      nativeContacts(ubiquitin.coords["ca"]!),
      ubiquitin.seq.length,
    );
    const proper = relativeContactOrder(ubiquitin.coords["ca"]!, ubiquitin.seq.length);
    expect(withQ.relative).toBeGreaterThan(proper.relative * 1.5);
  });
});

describe("perResidueContactOrder", () => {
  it("puts residues with no contacts at the midpoint, not at zero", () => {
    // No information is not the same as 'entirely local'.
    const scores = perResidueContactOrder([], 5);
    expect(Array.from(scores)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
  });

  it("scores a long-reaching residue above a local one", () => {
    const contacts = [
      { i: 0, j: 3, distance: 5, separation: 3 },
      { i: 5, j: 40, distance: 5, separation: 35 },
    ];
    const scores = perResidueContactOrder(contacts, 50);
    expect(scores[5]!).toBeGreaterThan(scores[0]!);
  });

  it("ignores inter-chain contacts", () => {
    const scores = perResidueContactOrder(
      [{ i: 1, j: 9, distance: 4, separation: 0 }],
      12,
    );
    expect(scores[1]!).toBe(0.5);
  });
});
