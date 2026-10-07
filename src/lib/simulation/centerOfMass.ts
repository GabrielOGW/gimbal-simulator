import type { ResolvedItem } from "@/lib/setup/types";
import type { Vec3 } from "@/types/geometry";
import { add, isFiniteVec, rotateEuler, vec } from "./geometry";

export type MassPoint = { mass: number; position: Vec3 };

export class InvalidMassError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMassError";
  }
}

function assertValidPoint(p: MassPoint, index: number) {
  if (!Number.isFinite(p.mass) || p.mass < 0) {
    throw new InvalidMassError(`Massa inválida no item ${index}: ${p.mass}`);
  }
  if (!isFiniteVec(p.position)) {
    throw new InvalidMassError(`Posição inválida no item ${index}`);
  }
}

/** Σ massa (g). Lança InvalidMassError para massas negativas/não finitas. */
export function calculateTotalMass(points: readonly MassPoint[]): number {
  return points.reduce((sum, p, i) => {
    assertValidPoint(p, i);
    return sum + p.mass;
  }, 0);
}

/**
 * Centro de massa ponderado: Σ(mᵢ·pᵢ) / Σmᵢ.
 * Retorna null quando não há massa (setup vazio ou massa total zero).
 */
export function calculateCenterOfMass(points: readonly MassPoint[]): Vec3 | null {
  const total = calculateTotalMass(points);
  if (total === 0) return null;
  const acc = points.reduce(
    (a, p) => vec(a.x + p.mass * p.position.x, a.y + p.mass * p.position.y, a.z + p.mass * p.position.z),
    vec(),
  );
  return vec(acc.x / total, acc.y / total, acc.z / total);
}

/**
 * Centro de massa de um item no referencial da carga:
 * posição do centro geométrico + rotação aplicada ao deslocamento local do CM.
 * Sem CM informado, usa o centro geométrico (estimativa).
 */
export function itemCenterOfMass(item: ResolvedItem): Vec3 {
  const local = item.equipment.centerOfMass;
  if (!local) return { ...item.position };
  return add(item.position, rotateEuler(local, item.rotation));
}

export const itemUsesGeometricCenter = (item: ResolvedItem): boolean =>
  item.equipment.centerOfMass === undefined;

export function toMassPoints(items: readonly ResolvedItem[]): MassPoint[] {
  return items.map((item) => ({ mass: item.equipment.weight, position: itemCenterOfMass(item) }));
}
