import { describe, expect, it } from "vitest";
import type { GimbalAdjustments } from "@/lib/gimbal/types";
import { evaluateBalance, toPivotFrame } from "./balance";

const gimbal = {
  adjustmentRanges: {
    plate: { min: -50, max: 50 },
    height: { min: 10, max: 100 },
    roll: { min: -40, max: 40 },
    pan: { min: -30, max: 30 },
  },
};
const adj = (o: Partial<GimbalAdjustments> = {}): GimbalAdjustments => ({ plate: 0, height: 40, roll: 0, pan: 0, ...o });

describe("toPivotFrame", () => {
  it("posiciona a carga em (roll, plate, −height)", () => {
    expect(toPivotFrame({ x: 1, y: 2, z: 3 }, adj({ roll: 10, plate: 20, height: 30 }))).toEqual({ x: 11, y: 22, z: -27 });
  });
});

describe("evaluateBalance", () => {
  it("CM sobre os eixos → todos OK", () => {
    const r = evaluateBalance({ x: 0, y: 0, z: 40 }, 1500, adj(), gimbal, 2);
    expect(r.axes.tilt.status).toBe("ok");
    expect(r.axes.roll.status).toBe("ok");
    expect(r.axes.pan.status).toBe("ok");
    expect(r.axes.tilt.worstCaseTorque).toBe(0);
  });

  it("tilt: CM à frente e acima → recomenda recuar a placa e subir a altura", () => {
    const r = evaluateBalance({ x: 0, y: 18, z: 52 }, 2000, adj(), gimbal, 2);
    const tilt = r.axes.tilt;
    expect(tilt.status).toBe("adjust");
    expect(tilt.offset).toEqual({ y: 18, z: 12 });
    const plate = tilt.corrections.find((c) => c.key === "plate")!;
    const height = tilt.corrections.find((c) => c.key === "height")!;
    expect(plate.delta).toBe(-18);
    expect(height.recommended).toBe(52);
    expect(height.delta).toBe(12);
    expect(tilt.residualAfter).toBe(0);
    // torque = m·g·d = 2 kg · 9.80665 · hypot(18,12) mm
    expect(tilt.worstCaseTorque).toBeCloseTo(2 * 9.80665 * Math.hypot(0.018, 0.012), 6);
  });

  it("roll: desvio lateral → deslocamento recomendado com sinal oposto", () => {
    const r = evaluateBalance({ x: -18, y: 0, z: 40 }, 1000, adj(), gimbal, 2);
    expect(r.axes.roll.status).toBe("adjust");
    expect(r.axes.roll.corrections[0]!.delta).toBe(18);
    expect(r.axes.roll.residualAfter).toBe(0);
  });

  it("pan: com tilt balanceado, eixo pan deve passar pelo CM", () => {
    const r = evaluateBalance({ x: 0, y: 0, z: 40 }, 1000, adj({ pan: 12 }), gimbal, 2);
    expect(r.axes.pan.status).toBe("adjust");
    expect(r.axes.pan.corrections[0]!.recommended).toBe(0);
    expect(r.axes.pan.corrections[0]!.delta).toBe(-12);
  });

  it("dentro da tolerância conta como OK", () => {
    const r = evaluateBalance({ x: 1.5, y: 0, z: 40 }, 1000, adj(), gimbal, 2);
    expect(r.axes.roll.status).toBe("ok");
    expect(evaluateBalance({ x: 2.5, y: 0, z: 40 }, 1000, adj(), gimbal, 2).axes.roll.status).toBe("adjust");
  });

  it("fora do curso: recomenda o limite e sinaliza out_of_range", () => {
    // Lente longa: CM 80 mm à frente, placa só recua 50 mm
    const r = evaluateBalance({ x: 0, y: 80, z: 40 }, 2500, adj(), gimbal, 2);
    const plate = r.axes.tilt.corrections.find((c) => c.key === "plate")!;
    expect(r.axes.tilt.status).toBe("out_of_range");
    expect(plate.ideal).toBe(-80);
    expect(plate.recommended).toBe(-50);
    expect(plate.withinRange).toBe(false);
    expect(r.axes.tilt.residualAfter).toBe(30);
    // pan compensa o que o tilt não conseguiu (até o curso do pan)
    expect(r.recommendedAdjustments.pan).toBe(-30);
  });

  it("aplicar as recomendações zera o desvio quando tudo está dentro do curso", () => {
    const com = { x: 7, y: -11, z: 63 };
    const first = evaluateBalance(com, 1800, adj({ pan: 5 }), gimbal, 1);
    const second = evaluateBalance(com, 1800, first.recommendedAdjustments, gimbal, 1);
    expect(second.axes.tilt.status).toBe("ok");
    expect(second.axes.roll.status).toBe("ok");
    expect(second.axes.pan.status).toBe("ok");
  });

  it("rejeita tolerância inválida", () => {
    expect(() => evaluateBalance({ x: 0, y: 0, z: 0 }, 1, adj(), gimbal, -1)).toThrow(RangeError);
  });
});
