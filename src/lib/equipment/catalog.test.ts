import { describe, expect, it } from "vitest";
import { BUILTIN_PRESETS } from "@/lib/setup/presets";
import { getCatalog, RAW_EQUIPMENT, RAW_GIMBALS } from "./catalog";
import { searchEquipment } from "./search";
import { validateEquipment } from "./validation";

describe("catálogo inicial", async () => {
  const catalog = await getCatalog();

  it("todos os itens passam na validação", () => {
    expect(catalog.equipment).toHaveLength(RAW_EQUIPMENT.length);
    expect(catalog.gimbals).toHaveLength(RAW_GIMBALS.length);
  });
  it("ids são únicos", () => {
    const ids = catalog.equipment.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(catalog.gimbals.map((g) => g.id)).size).toBe(catalog.gimbals.length);
  });
  it("todo item declara a origem do dado", () => {
    for (const e of catalog.equipment) expect(["official", "estimated"]).toContain(e.source.kind);
  });
  it("official exige reference (URL da ficha) e checkedAt", () => {
    const sources = [
      ...catalog.equipment.map((e) => [e.id, e.source] as const),
      ...catalog.gimbals.flatMap((g) => [[`${g.id} (carga)`, g.payloadSource] as const, [`${g.id} (geometria)`, g.geometrySource] as const]),
    ];
    const official = sources.filter(([, s]) => s.kind === "official");
    expect(official.length).toBeGreaterThan(0);
    for (const [id, s] of official) {
      expect(s.reference, id).toMatch(/^https:\/\//);
      expect(s.checkedAt, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("itens genéricos nunca são official", () => {
    for (const e of catalog.equipment) if (e.id.startsWith("generic-")) expect(e.source.kind, e.id).toBe("estimated");
  });
  it("contém as câmeras pedidas", () => {
    for (const id of ["sony-fx3", "sony-fx6", "sony-fx9", "canon-c70", "canon-c300-mk3", "bmd-cinema-camera-6k", "red-komodo-6k"]) {
      expect(catalog.equipment.some((e) => e.id === id)).toBe(true);
    }
  });
  it("presets referenciam apenas itens existentes", () => {
    const eq = new Set(catalog.equipment.map((e) => e.id));
    const gb = new Set(catalog.gimbals.map((g) => g.id));
    for (const p of BUILTIN_PRESETS) {
      expect(gb.has(p.gimbal)).toBe(true);
      for (const id of p.equipment) expect(eq.has(id), id).toBe(true);
    }
  });
  it("busca por tokens, sem acento e com hífen", () => {
    expect(searchEquipment(catalog.equipment, "fx3").map((e) => e.id)).toContain("sony-fx3");
    expect(searchEquipment(catalog.equipment, "sony 24-70").map((e) => e.id)).toEqual(["sony-fe-24-70-gm2"]);
    expect(searchEquipment(catalog.equipment, "camera").length).toBeGreaterThanOrEqual(7);
    expect(searchEquipment(catalog.equipment, "v-mount", "battery").length).toBe(2);
    expect(searchEquipment(catalog.equipment, "", "lens").every((e) => e.category === "lens")).toBe(true);
  });
});

describe("validateEquipment", () => {
  const valid = {
    id: "x",
    name: "Meu monitor",
    category: "monitor",
    weight: 300,
    dimensions: { width: 150, height: 90, depth: 30 },
    source: { kind: "user" },
  };
  it("aceita equipamento mínimo (sem CM)", () => expect(validateEquipment(valid).ok).toBe(true));
  it("rejeita peso zero, negativo ou ausente", () => {
    expect(validateEquipment({ ...valid, weight: 0 }).ok).toBe(false);
    expect(validateEquipment({ ...valid, weight: -5 }).ok).toBe(false);
    expect(validateEquipment({ ...valid, weight: undefined }).ok).toBe(false);
  });
  it("rejeita dimensões inválidas e categoria desconhecida", () => {
    expect(validateEquipment({ ...valid, dimensions: { width: 0, height: 1, depth: 1 } }).ok).toBe(false);
    expect(validateEquipment({ ...valid, category: "drone" }).ok).toBe(false);
  });
  it("CM fora da caixa gera aviso, não erro", () => {
    const r = validateEquipment({ ...valid, centerOfMass: { x: 200, y: 0, z: 0 } });
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBe(1);
  });
  it("checkedAt precisa ser data ISO (AAAA-MM-DD)", () => {
    expect(validateEquipment({ ...valid, source: { kind: "official", checkedAt: "2026-10-14" } }).ok).toBe(true);
    expect(validateEquipment({ ...valid, source: { kind: "official", checkedAt: "14/10/2026" } }).ok).toBe(false);
    expect(validateEquipment({ ...valid, source: { kind: "official", checkedAt: "2026-13-40" } }).ok).toBe(false);
  });
  it("CM com valor não numérico é erro", () => {
    expect(validateEquipment({ ...valid, centerOfMass: { x: "a", y: 0, z: 0 } }).ok).toBe(false);
  });
});
