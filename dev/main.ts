/**
 * Visual harness for the renderer.
 *
 * Unit tests can prove the mesh is closed, that its normals are unit length and
 * that its vertices sit near the backbone. They cannot tell you it looks like a
 * protein. This exists to be looked at.
 */

import {
  COLOR_MODES, Stage, colorResidues, type ColorModeKey,
} from "../packages/render/src/index.js";

interface Chain {
  readonly id: string;
  readonly seq: string;
  readonly ss: string;
  readonly ca: number[];
  readonly bf: number[];
}

interface Structure {
  readonly id: string;
  readonly pdb_id: string;
  readonly title: string;
  readonly chains: Chain[];
}

const files = import.meta.glob<Structure>("../data/structures/*.json", { import: "default" });
const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));

const stage = new Stage(document.querySelector<HTMLElement>("#stage")!);
const picker = document.querySelector<HTMLSelectElement>("#structure")!;
const modePicker = document.querySelector<HTMLSelectElement>("#mode")!;
const stat = document.querySelector<HTMLElement>("#stat")!;

for (const [path] of entries) {
  picker.append(new Option(path.split("/").pop()!.replace(".json", ""), path));
}
for (const mode of COLOR_MODES) modePicker.append(new Option(mode.label, mode.key));

let current: Structure | null = null;

function paint(): void {
  if (current === null) return;
  const key = modePicker.value as ColorModeKey;
  stage.setColors(
    current.chains.map((chain, index) =>
      colorResidues(key, {
        sequence: chain.seq,
        secondaryStructure: chain.ss,
        bFactors: chain.bf,
        chainOf: Array.from({ length: chain.seq.length }, () => index),
      }),
    ),
  );
}

async function show(path: string): Promise<void> {
  current = await files[path]!();
  const started = performance.now();
  stage.load(current.chains.map((c) => ({ ca: c.ca, secondaryStructure: c.ss })));
  const build = performance.now() - started;
  paint();
  const residues = current.chains.reduce((total, c) => total + c.seq.length, 0);
  stat.textContent =
    `${current.pdb_id} · ${residues} res · ${current.chains.length} ch · mesh ${build.toFixed(0)} ms`;
}

picker.addEventListener("change", () => void show(picker.value));
modePicker.addEventListener("change", paint);

let spinning = false;
document.querySelector("#spin")!.addEventListener("click", () => {
  spinning = !spinning;
});
setInterval(() => {
  if (spinning) stage.orbit(0.02, 0);
}, 16);

let dragging = false;
const surface = document.querySelector("#stage")!;
surface.addEventListener("pointerdown", () => {
  dragging = true;
});
window.addEventListener("pointerup", () => {
  dragging = false;
});
window.addEventListener("pointermove", (event) => {
  if (dragging) stage.orbit(event.movementX * 0.006, event.movementY * 0.006);
});
surface.addEventListener("wheel", (event) => {
  stage.zoom(1 + (event as WheelEvent).deltaY * 0.001);
});

stage.start();
void show(entries[0]![0]);
