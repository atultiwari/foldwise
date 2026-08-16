/**
 * A label pinned to the residue under discussion.
 *
 * Flying the camera in and fading everything else is most of the answer, but
 * not all of it: a reader who has never looked at a ribbon still cannot tell
 * which of the strands in front of them is β6. The marker names it, and stays
 * on it while the molecule is turned.
 *
 * Tracked on an animation frame rather than on React state, because the camera
 * eases toward its target over several hundred milliseconds and a marker that
 * only updates on re-render would lag behind the thing it is pointing at.
 */

import { useEffect, useRef } from "react";

import type { ResidueClaim } from "@foldwise/content";
import type { Stage } from "@foldwise/render";

interface ResidueMarkerProps {
  readonly renderer: Stage | null;
  readonly chain: number;
  readonly residue: number;
  readonly claim: ResidueClaim;
}

/** Three-letter codes, because that is how a clinical paper writes a residue. */
const THREE_LETTER: Readonly<Record<string, string>> = {
  A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly",
  H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met", F: "Phe", P: "Pro", S: "Ser",
  T: "Thr", W: "Trp", Y: "Tyr", V: "Val",
};

export function ResidueMarker({ renderer, chain, residue, claim }: ResidueMarkerProps) {
  const markerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (marker === null || renderer === null) return;

    let frame = 0;
    const follow = () => {
      frame = requestAnimationFrame(follow);
      const at = renderer.locate(chain, residue);
      if (at === null) {
        // Behind the molecule or off screen. Hiding beats drawing a label
        // over the wrong part of the protein.
        marker.style.opacity = "0";
        return;
      }
      marker.style.opacity = "1";
      marker.style.transform = `translate(${at.x}px, ${at.y}px)`;
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [renderer, chain, residue]);

  const name = THREE_LETTER[claim.code] ?? claim.code;
  return (
    <div ref={markerRef} className="residue-marker" aria-hidden="true">
      <span className="residue-marker__ring" />
      <span className="residue-marker__name">
        {name}{claim.resNum}
        <span className="residue-marker__chain">chain {claim.chain}</span>
      </span>
    </div>
  );
}
