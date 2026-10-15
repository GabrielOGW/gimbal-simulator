import { describe, expect, it } from "vitest";
import { torqueAtPose } from "./statics";

describe("torqueAtPose", () => {
  const level = { pan: 0, tilt: 0, roll: 0 };
  it("CM no pivô não gera torque", () => {
    const t = torqueAtPose({ x: 0, y: 0, z: 0 }, 2000, level);
    expect(t.tilt).toBe(0);
    expect(t.roll).toBe(0);
  });
  it("CM 10 mm à frente com 1 kg → ~0.098 N·m no tilt (nariz para baixo)", () => {
    const t = torqueAtPose({ x: 0, y: 10, z: 0 }, 1000, level);
    expect(Math.abs(t.tilt)).toBeCloseTo(0.0980665, 6);
    expect(t.tilt).toBeLessThan(0);
    expect(t.roll).toBe(0);
  });
  it("CM acima do eixo: sem torque nivelado, mas aparece ao inclinar", () => {
    expect(torqueAtPose({ x: 0, y: 0, z: 20 }, 1000, level).tilt).toBe(0);
    const tilted = torqueAtPose({ x: 0, y: 0, z: 20 }, 1000, { pan: 0, tilt: 90, roll: 0 });
    expect(Math.abs(tilted.tilt)).toBeCloseTo(0.196133, 5);
  });
  it("desvio lateral gera torque no roll", () => {
    const t = torqueAtPose({ x: 10, y: 0, z: 0 }, 1000, level);
    expect(Math.abs(t.roll)).toBeCloseTo(0.0980665, 6);
  });
  it("pan não sofre torque com a base na vertical", () => {
    expect(torqueAtPose({ x: 30, y: 30, z: 0 }, 1000, { pan: 45, tilt: 10, roll: 5 }).pan).toBe(0);
  });
});

describe("torqueAtPose com massas do gimbal", () => {
  const level = { pan: 0, tilt: 0, roll: 0 };
  it("conjunto tilt entra no tilt e no roll; conjunto roll só no roll", () => {
    const t = torqueAtPose({ x: 0, y: 0, z: 0 }, 1000, level, {
      tilt: { mass: 1000, at: { x: 0, y: 10, z: 0 } },
      roll: { mass: 1000, at: { x: 10, y: 0, z: 0 } },
    });
    expect(Math.abs(t.tilt)).toBeCloseTo(0.0980665, 6);
    expect(Math.abs(t.roll)).toBeCloseTo(0.0980665, 6);
  });
  it("conjunto roll não gera torque no tilt mesmo fora do eixo", () => {
    const t = torqueAtPose({ x: 0, y: 0, z: 0 }, 1000, level, { roll: { mass: 500, at: { x: 0, y: -80, z: 0 } } });
    expect(t.tilt).toBe(0);
  });
  it("sem massas do gimbal é igual ao cálculo antigo", () => {
    const pose = { pan: 30, tilt: 20, roll: -10 };
    expect(torqueAtPose({ x: 5, y: 12, z: -3 }, 1500, pose, null)).toEqual(torqueAtPose({ x: 5, y: 12, z: -3 }, 1500, pose));
  });
});
