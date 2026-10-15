import type { GimbalPose } from "@/lib/setup/types";
import type { Vec3 } from "@/types/geometry";
import { cross, dot, rotateX, rotateY, rotateZ, vec } from "./geometry";
import { GRAVITY, type Body } from "./balance";

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
 *
 * `gimbal` (opcional) são os conjuntos móveis do gimbal no referencial do pivô
 * (ver `gimbalBodies`): o conjunto tilt gira com a carga e entra no torque do
 * tilt e do roll; o conjunto roll gira só no roll e entra apenas no torque do
 * roll. O conjunto pan não gira em nenhum dos dois. Ignora efeitos dinâmicos.
 */
export function torqueAtPose(
  comPivot: Vec3,
  massG: number,
  pose: GimbalPose,
  gimbal?: { tilt?: Body; roll?: Body } | null,
): PoseTorque {
  const afterRoll = (v: Vec3) => rotateZ(rotateY(v, pose.roll), pose.pan);
  const afterTilt = (v: Vec3) => afterRoll(rotateX(v, pose.tilt));
  const tauOf = (at: Vec3, mass: number, toWorld: (v: Vec3) => Vec3) =>
    cross(toWorld(vec(at.x / 1000, at.y / 1000, at.z / 1000)), vec(0, 0, -(mass / 1000) * GRAVITY));
  const tiltAxis = afterRoll(vec(1, 0, 0));
  const rollAxis = rotateZ(vec(0, 1, 0), pose.pan);

  const tilting = [{ at: comPivot, mass: massG }, ...(gimbal?.tilt ? [gimbal.tilt] : [])];
  let tilt = 0;
  let roll = 0;
  for (const b of tilting) {
    const tau = tauOf(b.at, b.mass, afterTilt);
    tilt += dot(tau, tiltAxis);
    roll += dot(tau, rollAxis);
  }
  if (gimbal?.roll) roll += dot(tauOf(gimbal.roll.at, gimbal.roll.mass, afterRoll), rollAxis);
  const clean = (n: number) => (Math.abs(n) < 1e-12 ? 0 : n);
  return { tilt: clean(tilt), roll: clean(roll), pan: 0 };
}
