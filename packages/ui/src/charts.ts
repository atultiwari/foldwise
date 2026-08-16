/**
 * SVG path arithmetic for the read-outs.
 *
 * Kept as pure functions returning path strings rather than as components, so
 * the geometry can be tested without rendering anything, and so the same
 * sparkline maths serves an inline chart, a legend swatch and an exported
 * figure.
 *
 * No chart library. These are four small shapes with exact requirements, and a
 * general-purpose library would be larger than all of them together while
 * fitting none of them properly.
 */

export interface Extent {
  readonly min: number;
  readonly max: number;
}

/** Range of a series, widened when flat so a constant line still draws. */
export function extentOf(values: ArrayLike<number>): Extent {
  if (values.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) return { min: min - 0.5, max: max + 0.5 };
  return { min, max };
}

export interface SparklineOptions {
  readonly width: number;
  readonly height: number;
  /** Room for the stroke, so the line is not clipped at the extremes. */
  readonly padding?: number;
  readonly extent?: Extent;
}

function points(
  values: ArrayLike<number>, options: SparklineOptions,
): Array<[number, number]> {
  const padding = options.padding ?? 1.5;
  const { min, max } = options.extent ?? extentOf(values);
  const span = max - min || 1;
  const usable = options.height - padding * 2;

  return Array.from({ length: values.length }, (_, i) => {
    const x = values.length > 1 ? (i / (values.length - 1)) * options.width : options.width / 2;
    const y = padding + (1 - (values[i]! - min) / span) * usable;
    return [x, y];
  });
}

/** An open polyline through a series. */
export function sparklinePath(values: ArrayLike<number>, options: SparklineOptions): string {
  if (values.length === 0) return "";
  return points(values, options)
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join("");
}

/** The same line, closed to the baseline, for a filled area. */
export function areaPath(values: ArrayLike<number>, options: SparklineOptions): string {
  if (values.length === 0) return "";
  const line = points(values, options);
  const first = line[0]!;
  const last = line.at(-1)!;
  return (
    line.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join("") +
    `L${last[0].toFixed(2)} ${options.height}L${first[0].toFixed(2)} ${options.height}Z`
  );
}

/**
 * An arc for a donut gauge, drawn clockwise from twelve o'clock.
 *
 * A full circle cannot be expressed as a single arc -- start and end coincide
 * and the renderer draws nothing -- so it is emitted as two half arcs.
 */
export function donutArc(
  cx: number, cy: number, radius: number, fraction: number,
): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped <= 0) return "";
  if (clamped >= 1) {
    return (
      `M${cx} ${cy - radius}` +
      `A${radius} ${radius} 0 1 1 ${cx} ${cy + radius}` +
      `A${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`
    );
  }
  const angle = clamped * Math.PI * 2 - Math.PI / 2;
  const endX = cx + Math.cos(angle) * radius;
  const endY = cy + Math.sin(angle) * radius;
  const largeArc = clamped > 0.5 ? 1 : 0;
  return `M${cx} ${cy - radius}A${radius} ${radius} 0 ${largeArc} 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`;
}

export interface Band {
  readonly start: number;
  readonly end: number;
  readonly value: string;
}

/**
 * Collapse a per-residue string into runs, for the sequence track.
 *
 * One rectangle per residue is thousands of DOM nodes for a large structure and
 * makes the panel the slowest thing on the page; one per run is a few dozen.
 */
export function runsOf(values: string): Band[] {
  if (values.length === 0) return [];
  const bands: Band[] = [];
  let start = 0;
  for (let i = 1; i <= values.length; i++) {
    if (i === values.length || values[i] !== values[start]) {
      bands.push({ start, end: i, value: values[start]! });
      start = i;
    }
  }
  return bands;
}

/** Round numbers inside a range, for axis labels. */
export function ticks(extent: Extent, count = 4): number[] {
  const span = extent.max - extent.min;
  if (span <= 0) return [extent.min];
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude * 10;

  const out: number[] = [];
  for (let value = Math.ceil(extent.min / step) * step; value <= extent.max + 1e-9; value += step) {
    out.push(Number(value.toFixed(10)));
  }
  return out;
}
