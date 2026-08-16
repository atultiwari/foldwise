/**
 * Pure biophysics maths. No DOM, no three.js, no I/O.
 *
 * Every quantity here is either exact or validated against an established
 * implementation -- see docs/VALIDATION.md for the numbers.
 */

export { assertSameLength, assertTriples, centroid, distance, distanceSquared, pointCount, translated } from "./vec3.js";
export type { Coords } from "./vec3.js";

export { denaturedRadiusOfGyration, radiusOfGyration } from "./rg.js";

export { applyTransform, kabsch } from "./kabsch.js";
export type { Superposition } from "./kabsch.js";

export { rmsd, superposedRmsd } from "./rmsd.js";

export { DEFAULT_CUTOFF, DEFAULT_MIN_SEPARATION, contactDensity, fractionFormed, nativeContacts } from "./contacts.js";
export type { Contact, ContactOptions } from "./contacts.js";

export { CONTACT_ORDER_OPTIONS, contactOrder, perResidueContactOrder, relativeContactOrder } from "./contactOrder.js";
export type { ContactOrder } from "./contactOrder.js";

export { DEFAULT_POINTS, PROBE_RADIUS, VDW_RADII, fibonacciSphere, perResidue, shrakeRupley, totalArea } from "./sasa.js";
export type { SasaOptions } from "./sasa.js";
