import type { Equipment } from "@/lib/equipment/types";
import type { Gimbal, GimbalAdjustments } from "@/lib/gimbal/types";
import { evaluateBalance } from "@/lib/simulation/balance";
import { calculateCenterOfMass, calculateTotalMass, toMassPoints } from "@/lib/simulation/centerOfMass";
import { suggestPlacement } from "./placement";
import type { ResolvedItem, Setup, SetupItem } from "./types";

let counter = 0;
export const newId = (prefix = "i") =>
  `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const DEFAULT_ADJUSTMENTS: GimbalAdjustments = { plate: 0, height: 40, roll: 0, pan: 0 };

export function createEmptySetup(name = "Novo setup", gimbalId: string | null = null): Setup {
  const now = new Date().toISOString();
  return {
    id: newId("s"),
    name,
    gimbalId,
    items: [],
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    pose: { pan: 0, tilt: 0, roll: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/** Junta itens do setup aos equipamentos. Itens sem equipamento conhecido são devolvidos à parte. */
export function resolveItems(
  items: readonly SetupItem[],
  byId: ReadonlyMap<string, Equipment>,
): { resolved: ResolvedItem[]; missing: SetupItem[] } {
  const resolved: ResolvedItem[] = [];
  const missing: SetupItem[] = [];
  for (const item of items) {
    const equipment = byId.get(item.equipmentId);
    if (equipment) resolved.push({ ...item, equipment });
    else missing.push(item);
  }
  return { resolved, missing };
}

export function addEquipmentToItems(
  items: readonly SetupItem[],
  equipment: Equipment,
  byId: ReadonlyMap<string, Equipment>,
): SetupItem[] {
  const { resolved } = resolveItems(items, byId);
  const placement = suggestPlacement(equipment, resolved);
  return [...items, { instanceId: newId(), equipmentId: equipment.id, ...placement }];
}

/** Monta um setup a partir de ids de equipamento, posicionando cada um em sequência. */
export function buildSetup(
  name: string,
  equipmentIds: readonly string[],
  gimbal: Gimbal | null,
  byId: ReadonlyMap<string, Equipment>,
  options: { autoBalance?: boolean } = {},
): Setup {
  const setup = createEmptySetup(name, gimbal?.id ?? null);
  let items: SetupItem[] = [];
  for (const id of equipmentIds) {
    const e = byId.get(id);
    if (e) items = addEquipmentToItems(items, e, byId);
  }
  setup.items = items;
  if (gimbal && options.autoBalance) setup.adjustments = recommendedAdjustments(setup, gimbal, byId);
  else if (gimbal) setup.adjustments = clampAdjustments(setup.adjustments, gimbal);
  return setup;
}

export function clampAdjustments(adj: GimbalAdjustments, gimbal: Gimbal): GimbalAdjustments {
  const out = { ...adj };
  for (const k of Object.keys(out) as (keyof GimbalAdjustments)[]) {
    const r = gimbal.adjustmentRanges[k];
    out[k] = Math.min(r.max, Math.max(r.min, out[k]));
  }
  return out;
}

export function recommendedAdjustments(
  setup: Setup,
  gimbal: Gimbal,
  byId: ReadonlyMap<string, Equipment>,
): GimbalAdjustments {
  const points = toMassPoints(resolveItems(setup.items, byId).resolved);
  const com = calculateCenterOfMass(points);
  if (!com) return clampAdjustments(setup.adjustments, gimbal);
  return evaluateBalance(com, calculateTotalMass(points), setup.adjustments, gimbal, 0).recommendedAdjustments;
}

/**
 * "Centralizar setup": translada todos os itens para que a caixa envolvente
 * fique centrada em X sobre a placa e a câmera continue apoiada (Z inalterado).
 */
export function centerItemsLaterally(items: readonly ResolvedItem[]): SetupItem[] {
  if (!items.length) return [];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const i of items) {
    minX = Math.min(minX, i.position.x - i.equipment.dimensions.width / 2);
    maxX = Math.max(maxX, i.position.x + i.equipment.dimensions.width / 2);
  }
  const dx = -(minX + maxX) / 2;
  return items.map(({ equipment: _e, ...item }) => {
    void _e;
    return { ...item, position: { ...item.position, x: Math.round((item.position.x + dx) * 10) / 10 } };
  });
}
