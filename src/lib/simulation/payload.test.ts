import { describe, expect, it } from "vitest";
import { evaluatePayload } from "./payload";

const cap = { minimum: 0, maximum: 3000 };

describe("evaluatePayload", () => {
  it("compatível quando abaixo da capacidade efetiva", () => {
    const r = evaluatePayload(2500, cap, 0.1);
    expect(r.status).toBe("ok");
    expect(r.effectiveCapacity).toBe(2700);
    expect(r.headroom).toBe(200);
    expect(r.excess).toBe(0);
  });
  it("atenção: dentro da nominal mas acima da margem (2.84 kg em gimbal de 3 kg, margem 10%)", () => {
    const r = evaluatePayload(2840, cap, 0.1);
    expect(r.status).toBe("above_margin");
    expect(r.ratio).toBeCloseTo(0.9467, 3);
    expect(r.marginExcess).toBeCloseTo(140);
    expect(r.excess).toBe(0);
  });
  it("acima da capacidade: 3.42 kg → excesso de 420 g", () => {
    const r = evaluatePayload(3420, cap, 0.1);
    expect(r.status).toBe("over_capacity");
    expect(r.excess).toBeCloseTo(420);
  });
  it("exatamente na capacidade nominal não é 'ideal' com margem > 0", () => {
    expect(evaluatePayload(3000, cap, 0.1).status).toBe("above_margin");
  });
  it("margem zero torna a capacidade efetiva igual à nominal", () => {
    const r = evaluatePayload(3000, cap, 0);
    expect(r.status).toBe("ok");
    expect(r.effectiveCapacity).toBe(3000);
  });
  it("margem é configurável", () => {
    expect(evaluatePayload(2500, cap, 0.2).status).toBe("above_margin");
    expect(evaluatePayload(2500, cap, 0.1).status).toBe("ok");
  });
  it("setup vazio", () => expect(evaluatePayload(0, cap, 0.1).status).toBe("empty"));
  it("abaixo do mínimo", () => expect(evaluatePayload(200, { minimum: 500, maximum: 3000 }, 0.1).status).toBe("below_minimum"));
  it("rejeita valores inválidos", () => {
    expect(() => evaluatePayload(-1, cap, 0.1)).toThrow(RangeError);
    expect(() => evaluatePayload(NaN, cap, 0.1)).toThrow(RangeError);
    expect(() => evaluatePayload(100, cap, -0.1)).toThrow(RangeError);
    expect(() => evaluatePayload(100, cap, 0.95)).toThrow(RangeError);
    expect(() => evaluatePayload(100, { minimum: 0, maximum: 0 }, 0.1)).toThrow(RangeError);
    expect(() => evaluatePayload(100, { minimum: 4000, maximum: 3000 }, 0.1)).toThrow(RangeError);
  });
});
