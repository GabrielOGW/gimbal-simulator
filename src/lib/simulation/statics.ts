import type { GimbalPose } from "@/lib/setup/types";
import type { Vec3 } from "@/types/geometry";
import { cross, dot, rotateX, rotateY, rotateZ, vec } from "./geometry";
import { GRAVITY } from "./balance";

export type PoseTorque = {
  /** Torque gravitacional sobre cada eixo na pose informada (N·m). Sinal segue a regra da mão direita. */
  tilt: number;
  roll: number;
  /** Com a base na vertical, a gravidade é paralela ao eixo pan → torque nulo. */
  pan: number;
};

/**
 * Torque estático da gravidade sobre os eixos tilt e roll, com o gimbal
 * na pose indicada e a base na vertical. Cadeia: pan → roll → tilt → carga.
 * Ignora a massa das partes do gimbal e efeitos dinâmicos (aceleração).
 */
export function torqueAtPose(comPivot: Vec3, massG: number, pose: GimbalPose): PoseTorque {
  const toWorld = (v: Vec3) => rotateZ(rotateY(rotateX(v, pose.tilt), pose.roll), pose.pan);
  const r = vec(comPivot.x / 1000, comPivot.y / 1000, comPivot.z / 1000);
  const w = toWorld(r);
  const force = vec(0, 0, -(massG / 1000) * GRAVITY);
  const tau = cross(w, force);
  const tiltAxis = rotateZ(rotateY(vec(1, 0, 0), pose.roll), pose.pan);
  const rollAxis = rotateZ(vec(0, 1, 0), pose.pan);
  const clean = (n: number) => (Math.abs(n) < 1e-12 ? 0 : n);
  return { tilt: clean(dot(tau, tiltAxis)), roll: clean(dot(tau, rollAxis)), pan: 0 };
}
