import { describe, expect, it } from "vitest";
import { checkClearance } from "./clearance";

const gimbal = { geometry: { tiltArmInnerX: 100, rearClearance: 80, plateLength: 140 } };
const adj = { plate: 0, height: 40, roll: 0, pan: 0 };

describe("checkClearance", () => {
  it("sem carga, sem problemas", () => expect(checkClearance(null, adj, gimbal)).toEqual([]));
  it("carga larga invade o braço do tilt", () => {
    const issues = checkClearance({ min: { x: -120, y: -40, z: 0 }, max: { x: 60, y: 40, z: 80 } }, adj, gimbal);
    expect(issues.map((i) => i.id)).toEqual(["width"]);
    expect(issues[0]!.overlap).toBe(20);
  });
  it("bateria traseira invade o motor roll; avançar a placa resolve", () => {
    const b = { min: { x: -50, y: -110, z: 0 }, max: { x: 50, y: 60, z: 80 } };
    expect(checkClearance(b, adj, gimbal).map((i) => i.id)).toEqual(["rear"]);
    expect(checkClearance(b, { ...adj, plate: 40 }, gimbal)).toEqual([]);
  });
});
