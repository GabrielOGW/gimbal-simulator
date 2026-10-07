import { describe, expect, it } from "vitest";
import { rotatedBoxBounds, rotateEuler, unionBounds } from "./geometry";

describe("geometry", () => {
  it("rotateEuler 90° em Z leva +Y para −X", () => {
    const v = rotateEuler({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 90 });
    expect(v.x).toBeCloseTo(-1);
    expect(v.y).toBeCloseTo(0);
  });
  it("rotateEuler 90° em X leva +Y para +Z (tilt para cima)", () => {
    const v = rotateEuler({ x: 0, y: 1, z: 0 }, { x: 90, y: 0, z: 0 });
    expect(v.z).toBeCloseTo(1);
  });
  it("caixa rotacionada troca largura e profundidade", () => {
    const b = rotatedBoxBounds({ x: 0, y: 0, z: 0 }, { width: 100, height: 20, depth: 40 }, { x: 0, y: 0, z: 90 });
    expect(b.max.x).toBeCloseTo(20);
    expect(b.max.y).toBeCloseTo(50);
  });
  it("união de caixas", () => {
    expect(unionBounds([])).toBeNull();
    const u = unionBounds([
      { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } },
      { min: { x: 0, y: 0, z: 0 }, max: { x: 5, y: 2, z: 3 } },
    ])!;
    expect(u.min).toEqual({ x: -1, y: -1, z: -1 });
    expect(u.max).toEqual({ x: 5, y: 2, z: 3 });
  });
});
