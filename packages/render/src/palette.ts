/**
 * Colour, and proving it works for everyone.
 *
 * Around one man in twelve has some form of red-green colour vision deficiency.
 * A structure viewer that encodes charge as red against blue, or secondary
 * structure as red against green, is unreadable to them -- and in a teaching
 * tool that is not a cosmetic problem, it is a student who cannot do the
 * exercise.
 *
 * So the palettes here are checked rather than asserted: `test/palette.test.ts`
 * simulates protanopia, deuteranopia and tritanopia and requires every pair of
 * categories within a mode to stay distinguishable.
 */

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function rgbToHex(rgb: Rgb): string {
  const channel = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * clamped,
    a[1] + (b[1] - a[1]) * clamped,
    a[2] + (b[2] - a[2]) * clamped,
  ];
}

/**
 * Secondary structure.
 *
 * Deliberately not the red/yellow/green of most viewers: red against green is
 * the exact pair red-green deficiency collapses. Blue, orange and a light
 * neutral separate on lightness as well as hue, so they survive all three
 * simulations -- an earlier purple-and-slate pairing did not, failing at 14.9
 * against a threshold of 18 under tritanopia.
 */
export const STRUCTURE_COLOURS = {
  helix: hexToRgb("#0072b2"),
  strand: hexToRgb("#e69f00"),
  coil: hexToRgb("#bdc3c7"),
} as const;

/** Chain direction, blue at the N terminus through to red at the C. */
export const DIRECTION_RAMP: readonly Rgb[] = [
  hexToRgb("#2563eb"),
  hexToRgb("#06b6d4"),
  hexToRgb("#84cc16"),
  hexToRgb("#f59e0b"),
  hexToRgb("#dc2626"),
];

/**
 * Hydropathy: water-hating to water-loving.
 *
 * Orange against teal, which is the standard safe substitute for red against
 * green and stays separable under every deficiency.
 */
export const HYDROPHOBIC = hexToRgb("#e8833a");
export const HYDROPHILIC = hexToRgb("#2596a8");

/**
 * Charge.
 *
 * Blue and red are conventional here and, unusually, safe: the confusion axis
 * runs red-green, and these two differ strongly in blue. Neutral is a light
 * grey rather than white so it reads on both themes.
 */
export const POSITIVE = hexToRgb("#3b82f6");
export const NEGATIVE = hexToRgb("#e11d48");
export const NEUTRAL = hexToRgb("#cbd5e1");

/** Burial, from surface to core. */
export const SURFACE = hexToRgb("#bae6fd");
export const CORE = hexToRgb("#7c2d12");

/**
 * One colour per chain: the Okabe-Ito qualitative palette, reordered.
 *
 * Okabe & Ito (2008) designed this set to stay distinguishable under colour
 * vision deficiency, and it is the established choice for categorical
 * scientific figures. A hand-picked set failed the check here -- blue against
 * purple collapsed to 13.6 under deuteranopia -- which is a fair argument for
 * using a palette someone has already done the work on.
 *
 * The *order* is ours. Chains are assigned colours in sequence, so what matters
 * is that every prefix is separable, not the set as a whole. Ordered greedily
 * by worst-case separation across all three deficiencies, the first six stay at
 * least 23.5 apart -- comfortably distinguishable. At seven it falls to 10.9,
 * because blue against bluish green collapses under tritanopia and no
 * eight-colour set avoids that. Structures with more than six chains therefore
 * rely on the legend as a second channel; of the v1 library only 2HBS, with
 * eight, is affected.
 */
export const CHAIN_COLOURS: readonly Rgb[] = [
  hexToRgb("#d55e00"),  // vermillion
  hexToRgb("#4d4d4d"),  // dark neutral
  hexToRgb("#56b4e9"),  // sky blue
  hexToRgb("#f0e442"),  // yellow
  hexToRgb("#cc79a7"),  // reddish purple
  hexToRgb("#0072b2"),  // blue
  hexToRgb("#009e73"),  // bluish green
  hexToRgb("#e69f00"),  // orange
];

/** Sample a ramp at `t` in [0, 1]. */
export function rampAt(ramp: readonly Rgb[], t: number): Rgb {
  if (ramp.length === 0) return [0, 0, 0];
  if (ramp.length === 1) return ramp[0]!;
  const clamped = Math.max(0, Math.min(1, t));
  const position = clamped * (ramp.length - 1);
  const index = Math.min(ramp.length - 2, Math.floor(position));
  return mix(ramp[index]!, ramp[index + 1]!, position - index);
}

// ── Colour vision simulation ───────────────────────────────────────────────
//
// Brettel-Vienot-Mollon style simulation in linear RGB. Used only by the
// tests, but it lives here so the palettes and the check that guards them
// cannot drift apart.

export type Deficiency = "protanopia" | "deuteranopia" | "tritanopia";

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

const MATRICES: Record<Deficiency, readonly number[]> = {
  protanopia: [0.170556, 0.829444, 0, 0.170556, 0.829444, 0, -0.004517, 0.004517, 1],
  deuteranopia: [0.33066, 0.66934, 0, 0.33066, 0.66934, 0, -0.02785, 0.02785, 1],
  tritanopia: [1, 0.1274, -0.1274, 0, 0.874, 0.126, 0, 0.874, 0.126],
};

export function simulate(rgb: Rgb, deficiency: Deficiency): Rgb {
  const [r, g, b] = [toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2])];
  const m = MATRICES[deficiency];
  return [
    toSrgb(Math.max(0, Math.min(1, m[0]! * r + m[1]! * g + m[2]! * b))),
    toSrgb(Math.max(0, Math.min(1, m[3]! * r + m[4]! * g + m[5]! * b))),
    toSrgb(Math.max(0, Math.min(1, m[6]! * r + m[7]! * g + m[8]! * b))),
  ];
}

/** Relative luminance, for lightness-contrast checks. */
export function luminance(rgb: Rgb): number {
  return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
}

/**
 * Perceptual distance, CIE76 in Lab.
 *
 * Euclidean distance in RGB is not a measure of whether two colours look
 * different; Lab at least approximately is.
 */
export function perceptualDistance(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

function toLab(rgb: Rgb): [number, number, number] {
  const [r, g, b] = [toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2])];
  // sRGB to XYZ (D65), then XYZ to Lab.
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
