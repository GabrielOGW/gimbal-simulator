import { describe, expect, it } from "vitest";
import { getCatalog } from "@/lib/equipment/catalog";
import type { Equipment } from "@/lib/equipment/types";
import { analyzeSetup } from "@/lib/simulation/analyze";
import { DEFAULT_SETTINGS } from "./types";
import { buildSetup, centerItemsLaterally, resolveItems } from "./factory";
import { setupNotices } from "./compatibility";
import { exportSetup, importSetup } from "./serialization";

describe("setup", async () => {
  const catalog = await getCatalog();
  const byId = new Map(catalog.equipment.map((e) => [e.id, e]));
  const rs4pro = catalog.gimbals.find((g) => g.id === "dji-rs4-pro")!;

  it("posicionamento automático: câmera apoiada na placa, lente encaixada na frente", () => {
    const s = buildSetup("t", ["sony-fx3", "sony-fe-24-70-gm2"], rs4pro, byId);
    const [cam, lens] = resolveItems(s.items, byId).resolved;
    expect(cam!.position.z).toBeCloseTo(cam!.equipment.dimensions.height / 2);
    const camFront = cam!.position.y + cam!.equipment.dimensions.depth / 2;
    const lensRear = lens!.position.y - lens!.equipment.dimensions.depth / 2;
    expect(lensRear).toBeCloseTo(camFront, 0);
  });

  it("auto-balanceamento de um setup típico deixa os 3 eixos OK", () => {
    const s = buildSetup("t", ["sony-fx3", "sony-np-fz100", "sony-fe-24-70-gm2", "atomos-ninja-v"], rs4pro, byId, {
      autoBalance: true,
    });
    const a = analyzeSetup(resolveItems(s.items, byId).resolved, rs4pro, s.adjustments, s.pose, DEFAULT_SETTINGS);
    expect(a.totalMass).toBe(640 + 83 + 695 + 360);
    expect(a.balance!.axes.tilt.status).toBe("ok");
    expect(a.balance!.axes.roll.status).toBe("ok");
    expect(a.balance!.axes.pan.status).toBe("ok");
    expect(a.payload!.status).toBe("ok");
  });

  it("análise de setup vazio não quebra", () => {
    const a = analyzeSetup([], rs4pro, { plate: 0, height: 40, roll: 0, pan: 0 }, { pan: 0, tilt: 0, roll: 0 }, DEFAULT_SETTINGS);
    expect(a.totalMass).toBe(0);
    expect(a.centerOfMass).toBeNull();
    expect(a.balance).toBeNull();
    expect(a.payload!.status).toBe("empty");
  });

  it("centralizar deixa a caixa envolvente simétrica em X", () => {
    const s = buildSetup("t", ["sony-fx3", "sony-fe-24-70-gm2", "dji-focus-pro-motor"], null, byId);
    const centered = centerItemsLaterally(resolveItems(s.items, byId).resolved);
    const r = resolveItems(centered, byId).resolved;
    const min = Math.min(...r.map((i) => i.position.x - i.equipment.dimensions.width / 2));
    const max = Math.max(...r.map((i) => i.position.x + i.equipment.dimensions.width / 2));
    expect(min + max).toBeCloseTo(0, 0);
  });

  it("avisa sobre lente de montagem diferente", () => {
    const s = buildSetup("t", ["sony-fx3", "canon-rf-24-70-f28"], null, byId);
    expect(setupNotices(resolveItems(s.items, byId).resolved).some((n) => n.id.startsWith("mount-"))).toBe(true);
  });

  it("exportar → importar preserva equipamentos, posições, gimbal e ajustes", () => {
    const s = buildSetup("FX3 Doc", ["sony-fx3", "sony-fe-24-70-gm2"], rs4pro, byId, { autoBalance: true });
    const file = exportSetup(s, byId, rs4pro);
    const r = importSetup(JSON.stringify(file), new Set(byId.keys()), new Set(catalog.gimbals.map((g) => g.id)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.setup.name).toBe("FX3 Doc");
    expect(r.setup.gimbalId).toBe("dji-rs4-pro");
    expect(r.setup.adjustments).toEqual(s.adjustments);
    expect(r.setup.items.map((i) => [i.equipmentId, i.position])).toEqual(s.items.map((i) => [i.equipmentId, i.position]));
    expect(r.warnings).toEqual([]);
  });

  it("equipamento personalizado viaja dentro do arquivo exportado", () => {
    const custom: Equipment = {
      id: "user-rig",
      name: "Rig caseiro",
      category: "accessory",
      weight: 123,
      dimensions: { width: 10, height: 10, depth: 10 },
      source: { kind: "user" },
      custom: true,
    };
    const map = new Map(byId).set(custom.id, custom);
    const s = buildSetup("c", ["sony-fx3", "user-rig"], null, map);
    const file = exportSetup(s, map, null);
    expect(file.customEquipment).toHaveLength(1);
    const r = importSetup(JSON.stringify(file), new Set(byId.keys()), new Set());
    expect(r.ok && r.setup.items.length).toBe(2);
    expect(r.ok && r.customEquipment[0]!.id).toBe("user-rig");
  });

  it("importa o formato mínimo do exemplo e avisa sobre itens desconhecidos", () => {
    const r = importSetup(
      JSON.stringify({
        name: "FX3 Documentary Setup",
        gimbal: "rs4-pro",
        equipment: [
          { id: "sony-fx3", position: { x: 0, y: 0, z: 0 } },
          { id: "camera-que-nao-existe", position: { x: 0, y: 0, z: 0 } },
        ],
      }),
      new Set(byId.keys()),
      new Set(catalog.gimbals.map((g) => g.id)),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.setup.items).toHaveLength(1);
    expect(r.setup.gimbalId).toBeNull();
    expect(r.warnings).toHaveLength(2);
  });

  it("rejeita JSON inválido e formato desconhecido", () => {
    expect(importSetup("{oops", new Set(), new Set()).ok).toBe(false);
    expect(importSetup(JSON.stringify({ format: "outra-coisa", equipment: [] }), new Set(), new Set()).ok).toBe(false);
    expect(importSetup(JSON.stringify({ name: "x" }), new Set(), new Set()).ok).toBe(false);
  });
});
