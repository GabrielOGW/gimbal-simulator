import { describe, expect, it } from "vitest";
import type { Equipment } from "@/lib/equipment/types";
import type { ResolvedItem } from "@/lib/setup/types";
import {
  calculateCenterOfMass,
  calculateTotalMass,
  InvalidMassError,
  itemCenterOfMass,
  itemUsesGeometricCenter,
  toMassPoints,
} from "./centerOfMass";

const box = (over: Partial<Equipment> = {}): Equipment => ({
  id: "box",
  name: "Box",
  category: "other",
  weight: 100,
  dimensions: { width: 100, height: 100, depth: 100 },
  source: { kind: "user" },
  ...over,
});
const item = (e: Equipment, position = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0 }): ResolvedItem => ({
  instanceId: "i",
  equipmentId: e.id,
  equipment: e,
  position,
  rotation,
});

describe("calculateTotalMass", () => {
  it("soma as massas", () => {
    expect(
      calculateTotalMass([
        { mass: 640, position: { x: 0, y: 0, z: 0 } },
        { mass: 695, position: { x: 0, y: 100, z: 0 } },
      ]),
    ).toBe(1335);
  });
  it("setup vazio pesa zero", () => expect(calculateTotalMass([])).toBe(0));
  it("rejeita massa negativa ou não finita", () => {
    expect(() => calculateTotalMass([{ mass: -1, position: { x: 0, y: 0, z: 0 } }])).toThrow(InvalidMassError);
    expect(() => calculateTotalMass([{ mass: NaN, position: { x: 0, y: 0, z: 0 } }])).toThrow(InvalidMassError);
    expect(() => calculateTotalMass([{ mass: Infinity, position: { x: 0, y: 0, z: 0 } }])).toThrow(InvalidMassError);
  });
});

describe("calculateCenterOfMass", () => {
  it("exemplo da especificação: 1000 g na origem + 500 g em x=100 → x = 33.33 mm", () => {
    const com = calculateCenterOfMass([
      { mass: 1000, position: { x: 0, y: 0, z: 0 } },
      { mass: 500, position: { x: 100, y: 0, z: 0 } },
    ]);
    expect(com!.x).toBeCloseTo(33.333, 2);
    expect(com!.y).toBe(0);
    expect(com!.z).toBe(0);
  });
  it("pondera nos três eixos", () => {
    const com = calculateCenterOfMass([
      { mass: 300, position: { x: 10, y: -20, z: 30 } },
      { mass: 100, position: { x: -30, y: 60, z: -10 } },
    ])!;
    expect(com.x).toBeCloseTo(0);
    expect(com.y).toBeCloseTo(0);
    expect(com.z).toBeCloseTo(20);
  });
  it("retorna null para setup vazio", () => expect(calculateCenterOfMass([])).toBeNull());
  it("retorna null quando toda a massa é zero", () =>
    expect(calculateCenterOfMass([{ mass: 0, position: { x: 5, y: 5, z: 5 } }])).toBeNull());
  it("rejeita posição inválida", () =>
    expect(() => calculateCenterOfMass([{ mass: 10, position: { x: NaN, y: 0, z: 0 } }])).toThrow(InvalidMassError));
});

describe("CM por item", () => {
  it("sem CM informado usa o centro geométrico", () => {
    const it1 = item(box(), { x: 10, y: 20, z: 30 });
    expect(itemCenterOfMass(it1)).toEqual({ x: 10, y: 20, z: 30 });
    expect(itemUsesGeometricCenter(it1)).toBe(true);
  });
  it("CM personalizado é somado à posição", () => {
    const it1 = item(box({ centerOfMass: { x: 0, y: -12, z: 5 } }), { x: 10, y: 20, z: 30 });
    expect(itemCenterOfMass(it1)).toEqual({ x: 10, y: 8, z: 35 });
    expect(itemUsesGeometricCenter(it1)).toBe(false);
  });
  it("CM personalizado acompanha a rotação do item", () => {
    // Lente com CM 10 mm para trás, girada 90° em Z: o "trás" vira +X
    const it1 = item(box({ centerOfMass: { x: 0, y: -10, z: 0 } }), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 90 });
    const c = itemCenterOfMass(it1);
    expect(c.x).toBeCloseTo(10);
    expect(c.y).toBeCloseTo(0);
  });
  it("toMassPoints usa o peso do equipamento", () => {
    expect(toMassPoints([item(box({ weight: 250 }))])[0]!.mass).toBe(250);
  });
});
