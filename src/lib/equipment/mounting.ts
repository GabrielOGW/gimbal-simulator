import type { Vec3 } from "@/types/geometry";
import type { Equipment, MountingPoint, MountingPointType } from "./types";

/**
 * Pontos de montagem do equipamento. Quando não informados no catálogo,
 * gera pontos padrão a partir da caixa envolvente.
 */
export function mountingPointsOf(e: Equipment): MountingPoint[] {
  if (e.mountingPoints?.length) return e.mountingPoints;
  const { height, depth } = e.dimensions;
  switch (e.category) {
    case "camera":
      return [
        { id: "base", label: "Rosca inferior", type: "base", position: { x: 0, y: 0, z: -height / 2 } },
        { id: "lens", label: "Encaixe da lente", type: "lens_mount", position: { x: 0, y: depth / 2, z: 0 } },
      ];
    case "lens":
      return [
        { id: "rear", label: "Baioneta", type: "lens_rear", position: { x: 0, y: -depth / 2, z: 0 } },
        { id: "front", label: "Frente", type: "lens_front", position: { x: 0, y: depth / 2, z: 0 } },
      ];
    default:
      return [{ id: "base", label: "Base", type: "base", position: { x: 0, y: 0, z: -height / 2 } }];
  }
}

export function findMountingPoint(e: Equipment, type: MountingPointType): Vec3 | null {
  return mountingPointsOf(e).find((m) => m.type === type)?.position ?? null;
}
