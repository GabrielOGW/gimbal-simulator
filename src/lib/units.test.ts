import { describe, expect, it } from "vitest";
import { formatDims, formatMass, formatMm, formatSignedMm, formatTorque, formatXYZ } from "./format";
import {
  fromDisplayLength,
  fromDisplayMass,
  isDisplayUnits,
  lengthFieldText,
  massFieldText,
  METRIC,
  readField,
  toDisplayLength,
  type DisplayUnits,
} from "./units";

const IMP: DisplayUnits = { mass: "lb", length: "in" };

describe("conversões", () => {
  it("constantes exatas: 1 in = 25,4 mm; 1 lb = 453,59237 g", () => {
    expect(fromDisplayLength(1, IMP)).toBe(25.4);
    expect(fromDisplayMass(1, IMP)).toBe(453.59237);
  });
  it("métrico é identidade", () => {
    expect(toDisplayLength(37.5, METRIC)).toBe(37.5);
    expect(fromDisplayMass(640, METRIC)).toBe(640);
  });
  it("digitar 5 in, salvar e exibir dá 5 in", () => {
    const mm = readField("5", "", undefined, (v) => fromDisplayLength(v, IMP));
    expect(mm).toBe(127);
    expect(lengthFieldText(mm, IMP)).toBe("5");
    expect(formatMm(mm, 0, IMP)).toBe("5.00 in");
  });
  it("ida e volta repetida não acumula erro", () => {
    let mm = 129.7;
    for (let i = 0; i < 50; i++) {
      const text = lengthFieldText(mm, IMP);
      mm = readField(text, text, mm, (v) => fromDisplayLength(v, IMP));
    }
    expect(mm).toBe(129.7);
    // e quando o usuário digita, o valor exibido é o que ele digitou
    let g = readField("2.5", "", undefined, (v) => fromDisplayMass(v, IMP));
    for (let i = 0; i < 50; i++) g = readField(massFieldText(g, IMP), "", undefined, (v) => fromDisplayMass(v, IMP));
    expect(massFieldText(g, IMP)).toBe("2.5");
  });
  it("campo vazio vira NaN (a validação acusa) e aceita vírgula", () => {
    expect(readField("", "", undefined, (v) => v)).toBeNaN();
    expect(readField("1,5", "", undefined, (v) => fromDisplayLength(v, IMP))).toBeCloseTo(38.1, 10);
  });
  it("valida preferência salva", () => {
    expect(isDisplayUnits({ mass: "lb", length: "mm" })).toBe(true);
    expect(isDisplayUnits({ mass: "kg", length: "mm" })).toBe(false);
    expect(isDisplayUnits(undefined)).toBe(false);
  });
});

describe("formatação", () => {
  it("massa: kg/g e lb/oz", () => {
    expect(formatMass(2128, { forceKg: true })).toBe("2.13 kg");
    expect(formatMass(2128, { forceKg: true }, IMP)).toBe("4.69 lb");
    expect(formatMass(94, {}, IMP)).toBe("3.3 oz");
    expect(formatMass(640, {}, IMP)).toBe("1.41 lb");
  });
  it("distância com sinal, arredondamento e zero", () => {
    expect(formatSignedMm(-29, 0, IMP)).toBe("−1.14 in");
    expect(formatSignedMm(16, 0, IMP)).toBe("+0.63 in");
    expect(formatSignedMm(0.1, 0, IMP)).toBe("0 in");
    expect(formatSignedMm(-0.4)).toBe("0 mm");
    expect(formatSignedMm(-29)).toBe("−29 mm");
  });
  it("dimensões", () => {
    expect(formatDims({ width: 25.4, height: 50.8, depth: 127 }, IMP)).toBe("1.00 × 2.00 × 5.00 in");
    expect(formatDims({ width: 129.7, height: 77.8, depth: 84.5 })).toBe("129.7 × 77.8 × 84.5 mm");
  });
  it("posição compacta da lista", () => {
    expect(formatXYZ({ x: 0, y: 102, z: -38 })).toBe("X0 Y102 Z-38 mm");
    expect(formatXYZ({ x: 0, y: 102, z: -38 }, IMP)).toBe("X0.0 Y4.0 Z-1.5 in");
  });
  it("torque continua em N·m, com lb·in ao lado em imperial", () => {
    expect(formatTorque(0.35)).toBe("0.350 N·m");
    expect(formatTorque(1, IMP)).toBe("1.000 N·m (8.85 lb·in)");
  });
});
