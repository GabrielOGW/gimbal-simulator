import { findMountingPoint } from "@/lib/equipment/mounting";
import type { Equipment } from "@/lib/equipment/types";
import { add, rotatedBoxBounds, rotateEuler, sub, unionBounds, vec, type Bounds } from "@/lib/simulation/geometry";
import type { EulerDeg, Vec3 } from "@/types/geometry";
import type { ResolvedItem } from "./types";

export type Placement = { position: Vec3; rotation: EulerDeg };

const NO_ROT: EulerDeg = { x: 0, y: 0, z: 0 };
const boundsOf = (i: ResolvedItem) => rotatedBoxBounds(i.position, i.equipment.dimensions, i.rotation);
const r1 = (v: number) => Math.round(v * 10) / 10;
const round = (p: Vec3): Vec3 => ({ x: r1(p.x) || 0, y: r1(p.y) || 0, z: r1(p.z) || 0 });

/**
 * Sugere uma posição inicial plausível para um equipamento recém-adicionado,
 * com base na categoria e no que já está montado. É só um ponto de partida:
 * o usuário ajusta depois.
 */
export function suggestPlacement(e: Equipment, existing: readonly ResolvedItem[]): Placement {
  const { width: w, height: h, depth: d } = e.dimensions;
  const camera = existing.find((i) => i.equipment.category === "camera");
  const lens = existing.find((i) => i.equipment.category === "lens");
  const body: Bounds | null = unionBounds(
    existing.filter((i) => ["camera", "cage", "handle"].includes(i.equipment.category)).map(boundsOf),
  );
  const all = unionBounds(existing.map(boundsOf));
  const ref = body ?? all;
  const top = ref ? ref.max.z : 0;
  const centerZ = ref ? (ref.min.z + ref.max.z) / 2 : h / 2;
  const at = (p: Vec3): Placement => ({ position: round(p), rotation: { ...NO_ROT } });

  switch (e.category) {
    case "camera": {
      // Rosca inferior da câmera na origem (topo da placa)
      const base = findMountingPoint(e, "base") ?? vec(0, 0, -h / 2);
      return at(sub(vec(), base));
    }
    case "lens": {
      const rear = findMountingPoint(e, "lens_rear") ?? vec(0, -d / 2, 0);
      if (camera) {
        const mount = findMountingPoint(camera.equipment, "lens_mount");
        if (mount) return at(sub(add(camera.position, rotateEuler(mount, camera.rotation)), rear));
      }
      return at(vec(0, ref ? ref.max.y + d / 2 : d / 2, h / 2));
    }
    case "battery": {
      if (e.metadata?.internal === true && camera) return at(camera.position);
      const rearY = all ? all.min.y : 0;
      return at(vec(0, rearY - d / 2, centerZ));
    }
    case "cage": {
      const c = camera?.position ?? vec(0, 0, h / 2);
      return at(vec(c.x, c.y, h / 2));
    }
    case "plate":
      return at(vec(0, 0, -h / 2));
    case "handle":
      return at(vec(0, camera?.position.y ?? 0, top + h / 2));
    case "monitor": {
      const y = ref ? ref.min.y + d / 2 : 0;
      return at(vec(0, y, top + h / 2));
    }
    case "microphone": {
      const y = ref ? ref.max.y - d / 2 + 20 : 0;
      return at(vec(ref ? ref.max.x - w / 2 : 0, y, top + h / 2));
    }
    case "transmitter": {
      const x = ref ? ref.max.x + w / 2 : 0;
      return at(vec(x, camera?.position.y ?? 0, centerZ));
    }
    case "follow_focus": {
      if (lens) {
        const lb = boundsOf(lens);
        return at(vec(lb.max.x + w / 2, lens.position.y, lens.position.z));
      }
      return at(vec(ref ? ref.max.x + w / 2 : 0, ref ? ref.max.y : 0, centerZ));
    }
    case "filter":
    case "matte_box": {
      const front = all ? all.max.y : 0;
      const z = lens ? lens.position.z : centerZ;
      return at(vec(0, front + d / 2, z));
    }
    case "accessory": {
      if (e.metadata?.role === "counterweight") {
        const front = ref ? ref.max.y : 0;
        return at(vec(0, front + d / 2, h / 2));
      }
      return at(vec(0, 0, (all ? all.max.z : 0) + h / 2));
    }
    default:
      return at(vec(0, 0, (all ? all.max.z : 0) + h / 2));
  }
}
