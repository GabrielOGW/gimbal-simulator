import type { Catalog } from "@/lib/equipment/catalog";
import type { Equipment } from "@/lib/equipment/types";
import type { AdjustmentKey, AxisName, Gimbal } from "@/lib/gimbal/types";
import {
  addEquipmentToItems,
  buildSetup,
  centerItemsLaterally,
  clampAdjustments,
  createEmptySetup,
  newId,
  recommendedAdjustments,
  resolveItems,
} from "@/lib/setup/factory";
import { suggestPlacement } from "@/lib/setup/placement";
import { BUILTIN_PRESETS } from "@/lib/setup/presets";
import { DEFAULT_SETTINGS, type Setup, type SimulationSettings } from "@/lib/setup/types";
import type { EulerDeg, Vec3 } from "@/types/geometry";

export type SavedPreset = Setup;

export type SimState = {
  setup: Setup;
  selectedId: string | null;
  customEquipment: Equipment[];
  customGimbals: Gimbal[];
  settings: SimulationSettings;
  presets: SavedPreset[];
  /** Histórico de desfazer/refazer (apenas em memória, não é persistido) */
  past: Setup[];
  future: Setup[];
  /** Chave do último passo agrupável (ex.: arrastar o mesmo item) */
  historyKey: string | null;
};

export const HISTORY_LIMIT = 50;

export type Action =
  | { type: "hydrate"; state: Partial<SimState> }
  | { type: "load_setup"; setup: Setup; customEquipment?: Equipment[]; customGimbal?: Gimbal | null }
  | { type: "load_builtin"; presetId: string }
  | { type: "new_setup" }
  | { type: "rename"; name: string }
  | { type: "add"; equipment: Equipment }
  | { type: "remove"; instanceId: string }
  | { type: "remove_selected" }
  | { type: "duplicate"; instanceId: string }
  | { type: "move"; instanceId: string; position?: Vec3; rotation?: EulerDeg }
  | { type: "reset_item"; instanceId: string }
  | { type: "center" }
  | { type: "select"; instanceId: string | null }
  | { type: "set_gimbal"; gimbalId: string | null }
  | { type: "set_adjustment"; key: AdjustmentKey; value: number }
  | { type: "apply_recommended" }
  | { type: "set_pose"; axis: AxisName; value: number }
  | { type: "reset_pose" }
  | { type: "upsert_custom_equipment"; equipment: Equipment }
  | { type: "delete_custom_equipment"; id: string }
  | { type: "upsert_custom_gimbal"; gimbal: Gimbal }
  | { type: "settings"; settings: Partial<SimulationSettings> }
  | { type: "save_preset"; name: string }
  | { type: "delete_preset"; id: string }
  | { type: "replace_equipment"; instanceId: string; equipment: Equipment }
  | { type: "undo" }
  | { type: "redo" }
  /** Fim de um gesto contínuo (soltar o mouse/slider): o próximo passo vira uma nova entrada no histórico */
  | { type: "end_gesture" };

export const equipmentIndex = (catalog: Catalog, custom: readonly Equipment[]) =>
  new Map<string, Equipment>([...catalog.equipment, ...custom].map((e) => [e.id, e]));

export const allGimbals = (catalog: Catalog, custom: readonly Gimbal[]) => [...catalog.gimbals, ...custom];

export function initialState(catalog: Catalog): SimState {
  const byId = equipmentIndex(catalog, []);
  const preset = BUILTIN_PRESETS[0];
  const gimbal = preset ? catalog.gimbals.find((g) => g.id === preset.gimbal) ?? null : null;
  const setup = preset
    ? buildSetup(preset.name, preset.equipment, gimbal, byId, { autoBalance: false })
    : createEmptySetup();
  // Começa propositalmente desbalanceado para mostrar o fluxo de ajuste.
  setup.id = "initial";
  setup.createdAt = setup.updatedAt = "2026-01-01T00:00:00.000Z";
  setup.items = setup.items.map((it, i) => ({ ...it, instanceId: `init_${i}` }));
  return {
    setup,
    selectedId: null,
    customEquipment: [],
    customGimbals: [],
    settings: DEFAULT_SETTINGS,
    presets: [],
    past: [],
    future: [],
    historyKey: null,
  };
}

/** Ações que alteram o setup e entram no desfazer. Pose e seleção ficam de fora. */
const UNDOABLE = new Set<Action["type"]>([
  "load_setup",
  "load_builtin",
  "new_setup",
  "rename",
  "add",
  "remove",
  "remove_selected",
  "duplicate",
  "move",
  "reset_item",
  "center",
  "set_gimbal",
  "set_adjustment",
  "apply_recommended",
  "delete_custom_equipment",
  "upsert_custom_gimbal",
  "replace_equipment",
]);

/** Passos consecutivos com a mesma chave viram uma única entrada (um arraste = um desfazer). */
function groupKey(action: Action): string | null {
  switch (action.type) {
    case "move":
      return `move:${action.instanceId}:${action.position ? "p" : ""}${action.rotation ? "r" : ""}`;
    case "set_adjustment":
      return `adj:${action.key}`;
    case "rename":
      return "rename";
    default:
      return null;
  }
}

export function createReducer(catalog: Catalog) {
  const base = createBaseReducer(catalog);
  return function reducer(state: SimState, action: Action): SimState {
    switch (action.type) {
      case "undo": {
        const prev = state.past[state.past.length - 1];
        if (!prev) return state;
        return { ...state, setup: prev, past: state.past.slice(0, -1), future: [state.setup, ...state.future], historyKey: null, selectedId: keepSelection(state.selectedId, prev) };
      }
      case "redo": {
        const [next, ...rest] = state.future;
        if (!next) return state;
        return { ...state, setup: next, past: [...state.past, state.setup], future: rest, historyKey: null, selectedId: keepSelection(state.selectedId, next) };
      }
      case "end_gesture":
      case "select":
        return { ...base(state, action), historyKey: null };
    }
    const next = base(state, action);
    if (next === state || next.setup === state.setup || !UNDOABLE.has(action.type)) return next;
    const key = groupKey(action);
    if (key && key === state.historyKey) return { ...next, historyKey: key };
    return { ...next, past: [...state.past, state.setup].slice(-HISTORY_LIMIT), future: [], historyKey: key };
  };
}

const keepSelection = (id: string | null, setup: Setup) => (id && setup.items.some((i) => i.instanceId === id) ? id : null);

function createBaseReducer(catalog: Catalog) {
  return function reducer(state: SimState, action: Action): SimState {
    const byId = equipmentIndex(catalog, state.customEquipment);
    const gimbals = allGimbals(catalog, state.customGimbals);
    const gimbalOf = (id: string | null) => gimbals.find((g) => g.id === id) ?? null;
    const touch = (setup: Setup): Setup => ({ ...setup, updatedAt: new Date().toISOString() });
    const withSetup = (setup: Setup, extra: Partial<SimState> = {}): SimState => ({ ...state, ...extra, setup: touch(setup) });

    switch (action.type) {
      case "hydrate":
        return { ...state, ...action.state, selectedId: null, past: [], future: [], historyKey: null };

      case "load_setup": {
        const customEquipment = [...state.customEquipment];
        for (const e of action.customEquipment ?? []) {
          const i = customEquipment.findIndex((c) => c.id === e.id);
          if (i >= 0) customEquipment[i] = e;
          else customEquipment.push(e);
        }
        const customGimbals = [...state.customGimbals];
        if (action.customGimbal && !customGimbals.some((g) => g.id === action.customGimbal!.id)) {
          customGimbals.push(action.customGimbal);
        }
        return { ...state, setup: action.setup, customEquipment, customGimbals, selectedId: null };
      }

      case "load_builtin": {
        const p = BUILTIN_PRESETS.find((x) => x.id === action.presetId);
        if (!p) return state;
        return { ...state, setup: buildSetup(p.name, p.equipment, gimbalOf(p.gimbal), byId), selectedId: null };
      }

      case "new_setup":
        return { ...state, setup: createEmptySetup("Novo setup", state.setup.gimbalId), selectedId: null };

      case "rename":
        return withSetup({ ...state.setup, name: action.name });

      case "add": {
        const items = addEquipmentToItems(state.setup.items, action.equipment, new Map(byId).set(action.equipment.id, action.equipment));
        return withSetup({ ...state.setup, items }, { selectedId: items[items.length - 1]!.instanceId });
      }

      case "remove":
        return withSetup(
          { ...state.setup, items: state.setup.items.filter((i) => i.instanceId !== action.instanceId) },
          { selectedId: state.selectedId === action.instanceId ? null : state.selectedId },
        );

      case "remove_selected":
        return state.selectedId ? reducer(state, { type: "remove", instanceId: state.selectedId }) : state;

      case "duplicate": {
        const src = state.setup.items.find((i) => i.instanceId === action.instanceId);
        if (!src) return state;
        const copy = { ...src, instanceId: newId(), position: { ...src.position, x: src.position.x + 20 } };
        return withSetup({ ...state.setup, items: [...state.setup.items, copy] }, { selectedId: copy.instanceId });
      }

      case "move":
        return withSetup({
          ...state.setup,
          items: state.setup.items.map((i) =>
            i.instanceId === action.instanceId
              ? { ...i, position: action.position ?? i.position, rotation: action.rotation ?? i.rotation }
              : i,
          ),
        });

      case "reset_item": {
        const target = state.setup.items.find((i) => i.instanceId === action.instanceId);
        const e = target && byId.get(target.equipmentId);
        if (!target || !e) return state;
        const others = resolveItems(
          state.setup.items.filter((i) => i.instanceId !== action.instanceId),
          byId,
        ).resolved;
        const placement = suggestPlacement(e, others);
        return withSetup({
          ...state.setup,
          items: state.setup.items.map((i) => (i.instanceId === action.instanceId ? { ...i, ...placement } : i)),
        });
      }

      case "center": {
        const { resolved, missing } = resolveItems(state.setup.items, byId);
        return withSetup({ ...state.setup, items: [...centerItemsLaterally(resolved), ...missing] });
      }

      case "select":
        return { ...state, selectedId: action.instanceId };

      case "set_gimbal": {
        const g = gimbalOf(action.gimbalId);
        return withSetup({
          ...state.setup,
          gimbalId: action.gimbalId,
          adjustments: g ? clampAdjustments(state.setup.adjustments, g) : state.setup.adjustments,
          pose: { pan: 0, tilt: 0, roll: 0 },
        });
      }

      case "set_adjustment":
        return withSetup({ ...state.setup, adjustments: { ...state.setup.adjustments, [action.key]: action.value } });

      case "apply_recommended": {
        const g = gimbalOf(state.setup.gimbalId);
        if (!g) return state;
        return withSetup({ ...state.setup, adjustments: recommendedAdjustments(state.setup, g, byId) });
      }

      case "set_pose":
        return { ...state, setup: { ...state.setup, pose: { ...state.setup.pose, [action.axis]: action.value } } };

      case "reset_pose":
        return { ...state, setup: { ...state.setup, pose: { pan: 0, tilt: 0, roll: 0 } } };

      case "upsert_custom_equipment": {
        const exists = state.customEquipment.some((e) => e.id === action.equipment.id);
        return {
          ...state,
          customEquipment: exists
            ? state.customEquipment.map((e) => (e.id === action.equipment.id ? action.equipment : e))
            : [...state.customEquipment, action.equipment],
        };
      }

      case "delete_custom_equipment":
        return {
          ...state,
          customEquipment: state.customEquipment.filter((e) => e.id !== action.id),
          setup: touch({ ...state.setup, items: state.setup.items.filter((i) => i.equipmentId !== action.id) }),
        };

      case "upsert_custom_gimbal": {
        const others = state.customGimbals.filter((g) => g.id !== action.gimbal.id);
        const customGimbals = [...others, action.gimbal];
        return {
          ...state,
          customGimbals,
          setup: touch({
            ...state.setup,
            gimbalId: action.gimbal.id,
            adjustments: clampAdjustments(state.setup.adjustments, action.gimbal),
          }),
        };
      }

      case "settings":
        return { ...state, settings: { ...state.settings, ...action.settings } };

      case "save_preset": {
        const now = new Date().toISOString();
        const existing = state.presets.find((p) => p.name === action.name);
        const snapshot: Setup = {
          ...state.setup,
          id: existing?.id ?? newId("p"),
          name: action.name,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        const presets = existing
          ? state.presets.map((p) => (p.id === existing.id ? snapshot : p))
          : [snapshot, ...state.presets];
        return { ...state, presets, setup: { ...state.setup, name: action.name } };
      }

      case "delete_preset":
        return { ...state, presets: state.presets.filter((p) => p.id !== action.id) };

      case "replace_equipment":
        // Troca o equipamento de um item mantendo posição e rotação (ex.: "cópia editável")
        return withSetup({
          ...state.setup,
          items: state.setup.items.map((i) =>
            i.instanceId === action.instanceId ? { ...i, equipmentId: action.equipment.id } : i,
          ),
        });

      case "undo":
      case "redo":
      case "end_gesture":
        return state;
    }
  };
}
