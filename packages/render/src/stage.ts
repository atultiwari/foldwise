/**
 * The three.js binding.
 *
 * Deliberately thin. All the geometry and colour decisions live in modules
 * that know nothing about three.js and are tested without a graphics context;
 * this file only owns the scene graph, the lights, and the render loop.
 */

import {
  AmbientLight, BufferAttribute, BufferGeometry, Color, DirectionalLight, Group,
  Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from "three";

import { boundingSphere, damp, fitDistance } from "./camera.js";
import { colorVertices } from "./colorModes.js";
import { buildRibbon, updateRibbon, type RibbonGeometry } from "./ribbon.js";

export interface ChainView {
  readonly ca: ArrayLike<number>;
  readonly secondaryStructure: string;
}

export interface StageOptions {
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
  secondaryStructure: string;
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
  private readonly observer: ResizeObserver;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: StageOptions = {},
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio ?? 1));
    this.scene.background = new Color(options.background ?? "#101418");

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
      this.pivot.add(mesh);
      this.chains.push({
        geometry, bufferGeometry, mesh,
        secondaryStructure: chain.secondaryStructure,
      });
    }
    this.frameAll();
  }

  /** Rewrite positions for a new conformation. Allocates nothing per frame. */
  setConformation(perChainCa: readonly ArrayLike<number>[]): void {
    this.chains.forEach((chain, index) => {
      const ca = perChainCa[index];
      if (ca === undefined) return;
      updateRibbon(chain.geometry, ca, chain.secondaryStructure);
      chain.bufferGeometry.getAttribute("position").needsUpdate = true;
      chain.bufferGeometry.getAttribute("normal").needsUpdate = true;
    });
  }

  /** Apply per-residue colours, one array per chain. */
  setColors(perChainColors: readonly ArrayLike<number>[]): void {
    this.chains.forEach((chain, index) => {
      const colors = perChainColors[index];
      if (colors === undefined) return;
      const attribute = chain.bufferGeometry.getAttribute("color") as BufferAttribute;
      attribute.array.set(colorVertices(colors, chain.geometry.residueOf));
      attribute.needsUpdate = true;
    });
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
      this.pivot.remove(chain.mesh);
      chain.bufferGeometry.dispose();
      (chain.mesh.material as MeshStandardMaterial).dispose();
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
