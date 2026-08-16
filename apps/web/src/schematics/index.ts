/**
 * The schematic registry.
 *
 * A mechanism stage names a schematic by string; this is where that string
 * becomes a drawing. Keeping it a lookup rather than a switch means the
 * content package never imports React, and a missing drawing is a test
 * failure rather than a blank panel.
 */

import type { ComponentType } from "react";

import { Airway, Gate, Trafficking } from "./cftr.js";
import { Course, Lock, Polyprotein, Signal } from "./drug.js";
import { Codon, Fibre, RedCell, Vessel } from "./sickle.js";
import type { SchematicProps } from "./frame.js";

export const SCHEMATICS: Readonly<Record<string, ComponentType<SchematicProps>>> = {
  codon: Codon,
  fibre: Fibre,
  redcell: RedCell,
  vessel: Vessel,
  trafficking: Trafficking,
  gate: Gate,
  airway: Airway,
  lock: Lock,
  signal: Signal,
  polyprotein: Polyprotein,
  course: Course,
};

export function schematic(id: string): ComponentType<SchematicProps> | undefined {
  return SCHEMATICS[id];
}

export type { SchematicProps };
