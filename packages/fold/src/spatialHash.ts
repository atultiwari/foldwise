/**
 * A uniform grid for "what is near this point".
 *
 * The coil generator and the declash pass both ask that question for every
 * residue against every other, which is quadratic done naively and fast enough
 * to be invisible done like this.
 */
export class SpatialHash {
  private readonly cells = new Map<number, number[]>();

  constructor(private readonly cellSize: number) {
    if (cellSize <= 0) throw new RangeError("cellSize must be positive");
  }

  private key(x: number, y: number, z: number): number {
    // Three interleaved coordinates packed into one integer. The multipliers
    // are large primes so distant cells rarely collide.
    const i = Math.floor(x / this.cellSize);
    const j = Math.floor(y / this.cellSize);
    const k = Math.floor(z / this.cellSize);
    return (Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791)) | 0;
  }

  insert(index: number, x: number, y: number, z: number): void {
    const key = this.key(x, y, z);
    const bucket = this.cells.get(key);
    if (bucket === undefined) this.cells.set(key, [index]);
    else bucket.push(index);
  }

  /** Visit every index in the 27 cells around a point. */
  near(x: number, y: number, z: number, visit: (index: number) => void): void {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = this.cells.get(
            this.key(
              x + dx * this.cellSize,
              y + dy * this.cellSize,
              z + dz * this.cellSize,
            ),
          );
          if (bucket === undefined) continue;
          for (const index of bucket) visit(index);
        }
      }
    }
  }

  clear(): void {
    this.cells.clear();
  }
}
