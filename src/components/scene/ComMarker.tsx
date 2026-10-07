"use client";

import { Billboard, Html } from "@react-three/drei";
import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Vec3 } from "@/types/geometry";

/** Textura do símbolo clássico de centro de massa (quadrantes alternados). */
function useComTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const s = 128;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const g = c.getContext("2d")!;
    const r = s / 2 - 6;
    const quad = (start: number, color: string) => {
      g.beginPath();
      g.moveTo(s / 2, s / 2);
      g.arc(s / 2, s / 2, r, start, start + Math.PI / 2);
      g.closePath();
      g.fillStyle = color;
      g.fill();
    };
    quad(0, "#ffb020");
    quad(Math.PI / 2, "#0a0b0d");
    quad(Math.PI, "#ffb020");
    quad((3 * Math.PI) / 2, "#0a0b0d");
    g.lineWidth = 6;
    g.strokeStyle = "#ffb020";
    g.beginPath();
    g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    g.stroke();
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
}

export function ComMarker({ position, size = 22, label }: { position: Vec3; size?: number; label?: string }) {
  const tex = useComTexture();
  if (!tex) return null;
  return (
    <group position={[position.x, position.y, position.z]}>
      <Billboard>
        <mesh renderOrder={10}>
          <circleGeometry args={[size / 2, 48]} />
          <meshBasicMaterial map={tex} transparent depthTest={false} />
        </mesh>
      </Billboard>
      {label && (
        <Html position={[0, 0, size]} center style={{ pointerEvents: "none" }} zIndexRange={[15, 0]}>
          <div className="num whitespace-nowrap rounded bg-amber px-1 text-[9px] font-bold text-ink-950">{label}</div>
        </Html>
      )}
    </group>
  );
}
