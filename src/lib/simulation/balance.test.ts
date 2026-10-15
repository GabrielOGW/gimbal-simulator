import { describe, expect, it } from "vitest";
import type { GimbalAdjustments } from "@/lib/gimbal/types";
import { evaluateBalance, gimbalBodies, toPivotFrame } from "./balance";

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

describe("evaluateBalance com massas móveis do gimbal", () => {
  const masses = (o: { tilt?: number; roll?: number; pan?: number; panY?: number } = {}) => ({
    ...gimbal,
    movingMasses: {
      tilt: { mass: o.tilt ?? 0, com: { x: -60, y: 0, z: 15 } },
      roll: { mass: o.roll ?? 0, com: { x: -90, y: -50, z: 0 } },
      pan: { mass: o.pan ?? 0, com: { x: 0, y: o.panY ?? -110, z: -60 } },
      source: { kind: "estimated" as const },
    },
  });
  const coms = [
    { x: 0, y: 0, z: 40 },
    { x: 0, y: 18, z: 52 },
    { x: 7, y: -11, z: 63 },
    { x: 0, y: 80, z: 40 },
  ];

  it("massas zero dão o mesmo resultado do modelo antigo", () => {
    for (const com of coms) {
      const a = adj({ pan: 5, roll: -3 });
      const old = evaluateBalance(com, 1800, a, gimbal, 2);
      const zero = evaluateBalance(com, 1800, a, masses(), 2);
      expect({ ...zero, includesGimbalMasses: false }).toEqual(old);
      expect(zero.includesGimbalMasses).toBe(true);
    }
  });

  it("conjunto pan pesado atrás → pan recomendado positivo (carga para a frente)", () => {
    const r = evaluateBalance({ x: 0, y: 0, z: 40 }, 1500, adj(), masses({ pan: 400 }), 1);
    const pan = r.recommendedAdjustments.pan;
    // CM total em y = 400·(−110)/1900 ≈ −23,2 mm → eixo pan precisa recuar até lá
    expect(pan).toBeCloseTo((400 * 110) / 1900, 1);
    expect(pan).toBeGreaterThan(0);
    expect(r.axes.pan.status).toBe("adjust");
    // o tilt não enxerga o conjunto pan
    expect(r.axes.tilt.status).toBe("ok");
  });

  it("conjunto tilt e roll entram no tilt e no roll", () => {
    const r = evaluateBalance({ x: 0, y: 0, z: 40 }, 1000, adj(), masses({ tilt: 200, roll: 300 }), 1);
    // altura* = (1000·40 + 200·15)/1200
    expect(r.recommendedAdjustments.height).toBeCloseTo(43000 / 1200, 2);
    // roll* = −(200·(−60) + 300·(−90))/1500 = +26 → carga desliza para a direita
    expect(r.recommendedAdjustments.roll).toBe(26);
  });

  it("aplicar as recomendações duas vezes converge para OK", () => {
    const g = masses({ tilt: 180, roll: 220, pan: 300 });
    const com = { x: 7, y: -11, z: 63 };
    const first = evaluateBalance(com, 1800, adj({ pan: 5 }), g, 1);
    const second = evaluateBalance(com, 1800, first.recommendedAdjustments, g, 1);
    const third = evaluateBalance(com, 1800, second.recommendedAdjustments, g, 1);
    for (const r of [second, third]) {
      expect(r.axes.tilt.status).toBe("ok");
      expect(r.axes.roll.status).toBe("ok");
      expect(r.axes.pan.status).toBe("ok");
    }
    expect(third.recommendedAdjustments).toEqual(second.recommendedAdjustments);
  });

  it("massas que nunca balanceiam dentro do curso → out_of_range", () => {
    const r = evaluateBalance({ x: 0, y: 0, z: 40 }, 800, adj(), masses({ pan: 2000, panY: -150 }), 2);
    expect(r.axes.pan.status).toBe("out_of_range");
    expect(r.axes.pan.corrections[0]!.withinRange).toBe(false);
    expect(r.recommendedAdjustments.pan).toBe(30);
    expect(r.axes.pan.residualAfter).toBeGreaterThan(2);
  });

  it("massa da carga zero é erro explícito", () => {
    expect(() => evaluateBalance({ x: 0, y: 0, z: 0 }, 0, adj(), gimbal, 2)).toThrow(RangeError);
  });
});

describe("gimbalBodies", () => {
  it("tilt anda com roll e altura (não com a placa); roll anda com roll; pan fica fixo", () => {
    const g = {
      movingMasses: {
        tilt: { mass: 1, com: { x: -60, y: 0, z: 15 } },
        roll: { mass: 2, com: { x: -90, y: -50, z: 0 } },
        pan: { mass: 3, com: { x: 0, y: -110, z: -60 } },
        source: { kind: "estimated" as const },
      },
    };
    const b = gimbalBodies(g, adj({ roll: 10, plate: 25, height: 40, pan: 7 }))!;
    expect(b.tilt.at).toEqual({ x: -50, y: 0, z: -25 });
    expect(b.roll.at).toEqual({ x: -80, y: -50, z: 0 });
    expect(b.pan.at).toEqual({ x: 0, y: -110, z: -60 });
    expect(gimbalBodies({}, adj())).toBeNull();
  });
});
