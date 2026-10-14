import { describe, expect, it } from "vitest";
import { getCatalog } from "@/lib/equipment/catalog";
import type { Equipment } from "@/lib/equipment/types";
import { createReducer, HISTORY_LIMIT, initialState, type Action, type SimState } from "./state";

describe("reducer do simulador", async () => {
  const catalog = await getCatalog();
  const reducer = createReducer(catalog);
  const run = (s: SimState, ...actions: Action[]) => actions.reduce(reducer, s);
  const start = initialState(catalog);
  const lens = catalog.equipment.find((e) => e.id === "sony-fe-50-f12-gm")!;

  it("estado inicial traz um setup de exemplo sem histórico", () => {
    expect(start.setup.items.length).toBeGreaterThan(0);
    expect(start.past).toEqual([]);
  });

  it("adicionar seleciona o item e pode ser desfeito/refeito", () => {
    const s1 = run(start, { type: "add", equipment: lens });
    expect(s1.setup.items).toHaveLength(start.setup.items.length + 1);
    expect(s1.selectedId).toBe(s1.setup.items.at(-1)!.instanceId);
    const s2 = run(s1, { type: "undo" });
    expect(s2.setup.items).toHaveLength(start.setup.items.length);
    expect(s2.selectedId).toBeNull();
    const s3 = run(s2, { type: "redo" });
    expect(s3.setup.items).toHaveLength(start.setup.items.length + 1);
  });

  it("um arraste contínuo vira um único passo de desfazer", () => {
    const id = start.setup.items[0]!.instanceId;
    const original = start.setup.items[0]!.position;
    let s = start;
    for (let z = 1; z <= 10; z++) s = run(s, { type: "move", instanceId: id, position: { ...original, z: original.z + z } });
    expect(s.past).toHaveLength(1);
    s = run(s, { type: "end_gesture" }, { type: "move", instanceId: id, position: { ...original, z: 999 } });
    expect(s.past).toHaveLength(2);
    s = run(s, { type: "undo" }, { type: "undo" });
    expect(s.setup.items[0]!.position).toEqual(original);
  });

  it("nova ação após desfazer descarta o refazer", () => {
    const s = run(start, { type: "add", equipment: lens }, { type: "undo" }, { type: "center" });
    expect(s.future).toEqual([]);
  });

  it("pose e seleção não entram no histórico", () => {
    const s = run(start, { type: "set_pose", axis: "tilt", value: 30 }, { type: "select", instanceId: start.setup.items[0]!.instanceId });
    expect(s.past).toEqual([]);
  });

  it("histórico é limitado", () => {
    let s = start;
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) s = run(s, { type: "end_gesture" }, { type: "set_adjustment", key: "plate", value: i % 2 ? 5 : -5 });
    expect(s.past).toHaveLength(HISTORY_LIMIT);
  });

  it("remove_selected remove o item selecionado e nada mais", () => {
    expect(run(start, { type: "remove_selected" })).toBe(start);
    const id = start.setup.items[1]!.instanceId;
    const s = run(start, { type: "select", instanceId: id }, { type: "remove_selected" });
    expect(s.setup.items.some((i) => i.instanceId === id)).toBe(false);
    expect(s.selectedId).toBeNull();
  });

  it("cópia editável mantém posição e rotação do item original", () => {
    const item = start.setup.items[0]!;
    const custom: Equipment = { ...catalog.equipment.find((e) => e.id === item.equipmentId)!, id: "user-x", custom: true, source: { kind: "user" }, weight: 999 };
    const s = run(start, { type: "upsert_custom_equipment", equipment: custom }, { type: "replace_equipment", instanceId: item.instanceId, equipment: custom });
    const replaced = s.setup.items.find((i) => i.instanceId === item.instanceId)!;
    expect(replaced.equipmentId).toBe("user-x");
    expect(replaced.position).toEqual(item.position);
    expect(replaced.rotation).toEqual(item.rotation);
  });

  it("aplicar recomendações limita ao curso do gimbal", () => {
    const s = run(start, { type: "apply_recommended" });
    const g = catalog.gimbals.find((x) => x.id === s.setup.gimbalId)!;
    for (const k of ["plate", "height", "roll", "pan"] as const) {
      expect(s.setup.adjustments[k]).toBeGreaterThanOrEqual(g.adjustmentRanges[k].min);
      expect(s.setup.adjustments[k]).toBeLessThanOrEqual(g.adjustmentRanges[k].max);
    }
  });

  it("hidratar limpa o histórico", () => {
    const s = run(start, { type: "add", equipment: lens }, { type: "hydrate", state: { setup: start.setup } });
    expect(s.past).toEqual([]);
  });
});
