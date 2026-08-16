/**
 * The three.js binding.
 *
 * Deliberately thin. All the geometry and colour decisions live in modules
 * that know nothing about three.js and are tested without a graphics context;
 * this file only owns the scene graph, the lights, and the render loop.
 */

import {
  AmbientLight, BufferAttribute, BufferGeometry, Color, CylinderGeometry,
  DirectionalLight, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh,
  MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, Vector3,
  WebGLRenderer,
} from "three";

import { boundingSphere, damp, fitDistance } from "./camera.js";
import { colorVertices } from "./colorModes.js";
import { ATOM_RADIUS, BOND_RADIUS, atomMatrices, bondMatrices } from "./instanced.js";
import { pickResidue, project, type Viewport } from "./picking.js";
import { buildRibbon, updateRibbon, type RibbonGeometry } from "./ribbon.js";
import { buildSurface } from "./surface.js";

/** How the molecule is drawn. */
export type Representation = "cartoon" | "spacefill" | "sticks" | "surface";

/** Van der Waals radius used for the surface, per alpha carbon. */
const SURFACE_RADIUS = 3.2;

/**
 * The surface is rebuilt only once the user stops moving the timeline.
 *
 * Meshing a volume takes far longer than a frame, so rebuilding it on every
 * scrub step would drop the animation to a slideshow.
 */
const SURFACE_IDLE_MS = 220;

export interface ChainView {
  readonly ca: ArrayLike<number>;
  readonly secondaryStructure: string;
}

export interface StageOptions {
  /** A CSS colour, or "transparent" to let the page show through. */
  readonly background?: string;
  readonly fieldOfView?: number;
  /** Seconds for the camera to close most of a gap. */
  readonly cameraSmoothing?: number;
}

const DEFAULT_FOV = 42;
const DEFAULT_SMOOTHING = 0.25;

interface ChainState {
  readonly geometry: RibbonGeometry;
  readonly bufferGeometry: BufferGeometry;
  readonly mesh: Mesh;
  readonly atoms: InstancedMesh;
  readonly bonds: InstancedMesh;
  readonly surface: Mesh;
  secondaryStructure: string;
  ca: ArrayLike<number>;
  residueColors: Float32Array;
}

export class Stage {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  private readonly renderer: WebGLRenderer;
  /** Carries the user's rotation. */
  private readonly molecule = new Group();

  /**
   * Offsets the geometry so the molecule's centre sits on the rotation axis.
   *
   * three.js applies scale, then rotation, then position -- so putting the
   * offset on the same group as the rotation would swing the molecule around a
   * point outside itself instead of spinning it in place.
   */
  private readonly pivot = new Group();
  private readonly chains: ChainState[] = [];
  private readonly target = new Vector3();
  private distance = 60;
  private desiredDistance = 60;
  private frameHandle = 0;
  private lastTime = 0;
  private representation: Representation = "cartoon";
  private surfaceTimer: ReturnType<typeof setTimeout> | undefined;
  private surfaceStale = true;
  private readonly observer: ResizeObserver;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: StageOptions = {},
  ) {
    // "transparent" is not a colour three.js can parse -- it warns and leaves
    // the scene opaque white. A see-through canvas needs an alpha buffer and a
    // null background instead.
    const transparent = options.background === "transparent";
    this.renderer = new WebGLRenderer({ antialias: true, alpha: transparent });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio ?? 1));
    if (transparent) {
      this.renderer.setClearAlpha(0);
      this.scene.background = null;
    } else {
      this.scene.background = new Color(options.background ?? "#101418");
    }

    this.camera = new PerspectiveCamera(options.fieldOfView ?? DEFAULT_FOV, 1, 1, 4000);
    this.camera.position.set(0, 0, this.distance);

    // A key light and a much dimmer fill, so depth reads without the shadowed
    // side going black. Cartoon ribbons need shape, not drama.
    const key = new DirectionalLight(0xffffff, 2.1);
    key.position.set(1, 1.4, 1);
    const fill = new DirectionalLight(0xffffff, 0.6);
    fill.position.set(-1, -0.6, -0.8);
    this.molecule.add(this.pivot);
    this.scene.add(key, fill, new AmbientLight(0xffffff, 0.55), this.molecule);

    container.append(this.renderer.domElement);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  load(chains: readonly ChainView[]): void {
    this.clear();
    for (const chain of chains) {
      const geometry = buildRibbon(chain.ca, chain.secondaryStructure);
      const bufferGeometry = new BufferGeometry();
      bufferGeometry.setAttribute("position", new BufferAttribute(geometry.positions, 3));
      bufferGeometry.setAttribute("normal", new BufferAttribute(geometry.normals, 3));
      bufferGeometry.setAttribute(
        "color",
        new BufferAttribute(new Float32Array(geometry.vertexCount * 3), 3),
      );
      bufferGeometry.setIndex(new BufferAttribute(geometry.indices, 1));

      const mesh = new Mesh(
        bufferGeometry,
        new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.02 }),
      );
      mesh.frustumCulled = false;

      const residues = chain.secondaryStructure.length;
      const atoms = new InstancedMesh(
        new SphereGeometry(1, 16, 12),
        new MeshStandardMaterial({ roughness: 0.4, metalness: 0.05 }),
        residues,
      );
      atoms.instanceMatrix.setUsage(DynamicDrawUsage);
      atoms.frustumCulled = false;

      // Unit cylinder along +Y, centred: the convention bondMatrices assumes.
      const bonds = new InstancedMesh(
        new CylinderGeometry(1, 1, 1, 10, 1, true),
        new MeshStandardMaterial({ roughness: 0.45, metalness: 0.03 }),
        Math.max(1, residues - 1),
      );
      bonds.instanceMatrix.setUsage(DynamicDrawUsage);
      bonds.frustumCulled = false;

      const surface = new Mesh(
        new BufferGeometry(),
        // Opaque. A translucent closed surface needs its triangles depth-sorted
        // to composite correctly, and without that the far wall shows through
        // the near one and the molecule reads as a pile of interior fragments.
        new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 }),
      );
      surface.frustumCulled = false;

      this.pivot.add(mesh, atoms, bonds, surface);
      const state: ChainState = {
        geometry, bufferGeometry, mesh, atoms, bonds, surface,
        secondaryStructure: chain.secondaryStructure,
        ca: chain.ca,
        residueColors: new Float32Array(residues * 3).fill(1),
      };
      this.chains.push(state);
      // Instance matrices start as identity, so without this the atoms and
      // bonds sit in a heap at the origin until the first conformation change
      // -- and for a structure shown in its native state there is never one.
      this.updateInstances(state);
    }
    this.applyRepresentation();
    this.frameAll();
  }

  /** Rewrite positions for a new conformation. Allocates nothing per frame. */
  setConformation(perChainCa: readonly ArrayLike<number>[]): void {
    this.chains.forEach((chain, index) => {
      const ca = perChainCa[index];
      if (ca === undefined) return;
      chain.ca = ca;
      updateRibbon(chain.geometry, ca, chain.secondaryStructure);
      chain.bufferGeometry.getAttribute("position").needsUpdate = true;
      chain.bufferGeometry.getAttribute("normal").needsUpdate = true;
      this.updateInstances(chain);
    });

    // Re-fit. An unfolded coil is around three times the size of the folded
    // state, so framing once at load leaves most of the chain outside the
    // view for the first half of the animation. The camera's distance is
    // damped, so this reads as a slow zoom in as the protein collapses rather
    // than as a jump.
    this.frameAll();
    this.surfaceStale = true;
    this.scheduleSurface();
  }

  private updateInstances(chain: ChainState): void {
    const residues = chain.secondaryStructure.length;
    const scratch = new Matrix4();

    const atoms = atomMatrices(chain.ca, ATOM_RADIUS);
    for (let i = 0; i < residues; i++) {
      scratch.fromArray(atoms, i * 16);
      chain.atoms.setMatrixAt(i, scratch);
    }
    chain.atoms.count = residues;
    chain.atoms.instanceMatrix.needsUpdate = true;

    const bonds = bondMatrices(chain.ca, residues, BOND_RADIUS);
    for (let i = 0; i < bonds.count; i++) {
      scratch.fromArray(bonds.matrices, i * 16);
      chain.bonds.setMatrixAt(i, scratch);
    }
    chain.bonds.count = bonds.count;
    chain.bonds.instanceMatrix.needsUpdate = true;

    this.paintInstances(chain, bonds.residueOf, bonds.count);
  }

  private paintInstances(
    chain: ChainState, bondResidue: Uint32Array, bondCount: number,
  ): void {
    const colour = new Color();
    const residues = chain.secondaryStructure.length;
    for (let i = 0; i < residues; i++) {
      colour.setRGB(
        chain.residueColors[i * 3] ?? 1,
        chain.residueColors[i * 3 + 1] ?? 1,
        chain.residueColors[i * 3 + 2] ?? 1,
      );
      chain.atoms.setColorAt(i, colour);
    }
    if (chain.atoms.instanceColor !== null) chain.atoms.instanceColor.needsUpdate = true;

    for (let i = 0; i < bondCount; i++) {
      const residue = bondResidue[i]!;
      colour.setRGB(
        chain.residueColors[residue * 3] ?? 1,
        chain.residueColors[residue * 3 + 1] ?? 1,
        chain.residueColors[residue * 3 + 2] ?? 1,
      );
      chain.bonds.setColorAt(i, colour);
    }
    if (chain.bonds.instanceColor !== null) chain.bonds.instanceColor.needsUpdate = true;
  }

  /** Apply per-residue colours, one array per chain. */
  setColors(perChainColors: readonly ArrayLike<number>[]): void {
    this.chains.forEach((chain, index) => {
      const colors = perChainColors[index];
      if (colors === undefined) return;
      chain.residueColors = Float32Array.from(colors as ArrayLike<number>);
      const attribute = chain.bufferGeometry.getAttribute("color") as BufferAttribute;
      attribute.array.set(colorVertices(colors, chain.geometry.residueOf));
      attribute.needsUpdate = true;

      const bonds = bondMatrices(chain.ca, chain.secondaryStructure.length, BOND_RADIUS);
      this.paintInstances(chain, bonds.residueOf, bonds.count);
      this.paintSurface(chain);
    });
  }

  /** Choose how the molecule is drawn. */
  setRepresentation(representation: Representation): void {
    this.representation = representation;
    this.applyRepresentation();
    if (representation === "surface") this.scheduleSurface();
  }

  private applyRepresentation(): void {
    for (const chain of this.chains) {
      chain.mesh.visible = this.representation === "cartoon";
      chain.atoms.visible = this.representation === "spacefill";
      chain.bonds.visible = this.representation === "sticks";
      chain.surface.visible = this.representation === "surface";
    }
  }

  private scheduleSurface(): void {
    if (this.representation !== "surface" || !this.surfaceStale) return;
    if (this.surfaceTimer !== undefined) clearTimeout(this.surfaceTimer);
    this.surfaceTimer = setTimeout(() => {
      this.surfaceTimer = undefined;
      this.rebuildSurface();
    }, SURFACE_IDLE_MS);
  }

  /** Mesh the molecular surface. Expensive; call when the view is settled. */
  rebuildSurface(): void {
    for (const chain of this.chains) {
      const residues = chain.secondaryStructure.length;
      const mesh = buildSurface(
        chain.ca,
        new Float32Array(residues).fill(SURFACE_RADIUS),
        Uint32Array.from({ length: residues }, (_, i) => i),
        { probeRadius: 0 },
      );

      const geometry = chain.surface.geometry;
      geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
      geometry.setAttribute("normal", new BufferAttribute(mesh.normals, 3));
      geometry.setAttribute(
        "color", new BufferAttribute(new Float32Array(mesh.vertexCount * 3), 3),
      );
      geometry.setIndex(new BufferAttribute(mesh.indices, 1));
      geometry.userData["residueOf"] = mesh.residueOf;
      this.paintSurface(chain);
    }
    this.surfaceStale = false;
  }

  private paintSurface(chain: ChainState): void {
    const residueOf = chain.surface.geometry.userData["residueOf"] as Uint32Array | undefined;
    const attribute = chain.surface.geometry.getAttribute("color") as BufferAttribute | undefined;
    if (residueOf === undefined || attribute === undefined) return;
    attribute.array.set(colorVertices(chain.residueColors, residueOf));
    attribute.needsUpdate = true;
  }

  /**
   * Where a given residue currently sits on screen, in CSS pixels relative to
   * the container.
   *
   * The inverse of `pick`, and what lets a guided tour point at a residue in
   * the model rather than only at interface chrome. Returns null when the
   * residue is behind the camera or outside the frame, so a caller can fall
   * back rather than drawing a callout to nowhere.
   */
  locate(chainIndex: number, residueIndex: number): { x: number; y: number } | null {
    const chain = this.chains[chainIndex];
    if (chain === undefined) return null;
    const residues = chain.secondaryStructure.length;
    if (residueIndex < 0 || residueIndex >= residues) return null;

    this.camera.updateMatrixWorld();
    this.pivot.updateMatrixWorld(true);
    const matrix = new Matrix4()
      .multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
      .multiply(this.pivot.matrixWorld);

    const screen = project(
      matrix.elements,
      chain.ca[residueIndex * 3]!,
      chain.ca[residueIndex * 3 + 1]!,
      chain.ca[residueIndex * 3 + 2]!,
      { width: this.container.clientWidth, height: this.container.clientHeight },
    );
    return screen.visible ? { x: screen.x, y: screen.y } : null;
  }

  /**
   * The residue under a pointer position, in CSS pixels relative to the
   * container, or -1 if none is close enough.
   */
  pick(pointerX: number, pointerY: number): { chain: number; residue: number } | null {
    const viewport: Viewport = {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    };
    this.camera.updateMatrixWorld();
    this.pivot.updateMatrixWorld(true);

    for (let index = 0; index < this.chains.length; index++) {
      const chain = this.chains[index]!;
      // Fold the molecule's own transform into the view-projection, so picking
      // works after the user has rotated or the camera has moved.
      const matrix = new Matrix4()
        .multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
        .multiply(this.pivot.matrixWorld);
      const residue = pickResidue(chain.ca, matrix.elements, pointerX, pointerY, viewport);
      if (residue >= 0) return { chain: index, residue };
    }
    return null;
  }

  /** Fit the camera to everything currently loaded. */
  frameAll(): void {
    // Concatenated by copy, not by spreading into push(): a 550-residue chain
    // is around 80,000 floats and `push(...array)` at that size overflows the
    // call stack.
    let total = 0;
    for (const chain of this.chains) total += chain.geometry.positions.length;
    if (total === 0) return;

    const all = new Float32Array(total);
    let offset = 0;
    for (const chain of this.chains) {
      all.set(chain.geometry.positions, offset);
      offset += chain.geometry.positions.length;
    }

    const { centre, radius } = boundingSphere(all);
    this.target.set(centre[0], centre[1], centre[2]);
    this.desiredDistance = fitDistance(
      radius,
      this.camera.fov,
      Math.max(0.1, this.camera.aspect),
    );
  }

  orbit(deltaX: number, deltaY: number): void {
    this.molecule.rotation.y += deltaX;
    this.molecule.rotation.x += deltaY;
  }

  zoom(factor: number): void {
    this.desiredDistance = Math.max(5, Math.min(2000, this.desiredDistance * factor));
  }

  start(): void {
    if (this.frameHandle !== 0) return;
    const tick = (time: number) => {
      const delta = this.lastTime === 0 ? 1 / 60 : Math.min(0.1, (time - this.lastTime) / 1000);
      this.lastTime = time;
      this.update(delta);
      this.frameHandle = requestAnimationFrame(tick);
    };
    this.frameHandle = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.frameHandle !== 0) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.lastTime = 0;
  }

  update(deltaSeconds: number): void {
    this.distance = damp(
      this.distance,
      this.desiredDistance,
      this.options.cameraSmoothing ?? DEFAULT_SMOOTHING,
      deltaSeconds,
    );
    this.pivot.position.set(-this.target.x, -this.target.y, -this.target.z);
    this.camera.position.set(0, 0, this.distance);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return;
    // updateStyle must stay on. With it off, three.js sizes the drawing buffer
    // to width x pixelRatio but never sets the CSS size, so the canvas lays out
    // at its buffer size -- twice the container on a retina display, with the
    // molecule pushed off the edge.
    this.renderer.setSize(clientWidth, clientHeight, true);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.frameAll();
  }

  clear(): void {
    for (const chain of this.chains) {
      this.pivot.remove(chain.mesh, chain.atoms, chain.bonds, chain.surface);
      chain.bufferGeometry.dispose();
      chain.atoms.geometry.dispose();
      chain.bonds.geometry.dispose();
      chain.surface.geometry.dispose();
      (chain.mesh.material as MeshStandardMaterial).dispose();
      (chain.atoms.material as MeshStandardMaterial).dispose();
      (chain.bonds.material as MeshStandardMaterial).dispose();
      (chain.surface.material as MeshStandardMaterial).dispose();
    }
    this.chains.length = 0;
  }

  dispose(): void {
    this.stop();
    this.observer.disconnect();
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
