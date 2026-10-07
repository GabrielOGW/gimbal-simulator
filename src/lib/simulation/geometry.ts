import type { Dimensions, EulerDeg, Vec3 } from "@/types/geometry";

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const isFiniteVec = (a: Vec3): boolean =>
  Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);

const DEG = Math.PI / 180;

export const rotateX = (v: Vec3, deg: number): Vec3 => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
};
export const rotateY = (v: Vec3, deg: number): Vec3 => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
};
export const rotateZ = (v: Vec3, deg: number): Vec3 => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
};

/**
 * Aplica uma rotação Euler intrínseca XYZ (convenção do Three.js):
 * M = Rx · Ry · Rz, logo v' = Rx(Ry(Rz(v))).
 */
export const rotateEuler = (v: Vec3, e: EulerDeg): Vec3 =>
  rotateX(rotateY(rotateZ(v, e.z), e.y), e.x);

export type Bounds = { min: Vec3; max: Vec3 };

/** Caixa alinhada aos eixos (AABB) de uma caixa rotacionada centrada em `center`. */
export function rotatedBoxBounds(center: Vec3, dims: Dimensions, rotation: EulerDeg): Bounds {
  const hx = dims.width / 2;
  const hy = dims.depth / 2;
  const hz = dims.height / 2;
  const min = vec(Infinity, Infinity, Infinity);
  const max = vec(-Infinity, -Infinity, -Infinity);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = add(center, rotateEuler(vec(sx * hx, sy * hy, sz * hz), rotation));
        min.x = Math.min(min.x, p.x);
        min.y = Math.min(min.y, p.y);
        min.z = Math.min(min.z, p.z);
        max.x = Math.max(max.x, p.x);
        max.y = Math.max(max.y, p.y);
        max.z = Math.max(max.z, p.z);
      }
    }
  }
  return { min, max };
}

export function unionBounds(list: Bounds[]): Bounds | null {
  if (list.length === 0) return null;
  const [first, ...rest] = list as [Bounds, ...Bounds[]];
  const out: Bounds = { min: { ...first.min }, max: { ...first.max } };
  for (const b of rest) {
    out.min.x = Math.min(out.min.x, b.min.x);
    out.min.y = Math.min(out.min.y, b.min.y);
    out.min.z = Math.min(out.min.z, b.min.z);
    out.max.x = Math.max(out.max.x, b.max.x);
    out.max.y = Math.max(out.max.y, b.max.y);
    out.max.z = Math.max(out.max.z, b.max.z);
  }
  return out;
}

export const translateBounds = (b: Bounds, t: Vec3): Bounds => ({
  min: add(b.min, t),
  max: add(b.max, t),
});
