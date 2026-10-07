import type { Equipment } from "@/lib/equipment/types";
import { validateEquipment, validateGimbal } from "@/lib/equipment/validation";
import type { Gimbal, GimbalAdjustments } from "@/lib/gimbal/types";
import type { EulerDeg, Vec3 } from "@/types/geometry";
import { DEFAULT_ADJUSTMENTS, newId } from "./factory";
import type { Setup } from "./types";

export const SETUP_FORMAT = "gimbal-simulator/setup";
export const SETUP_FORMAT_VERSION = 1;

/** Formato do arquivo exportado/importado (JSON). */
export type SetupFile = {
  format: typeof SETUP_FORMAT;
  version: number;
  name: string;
  gimbal: string | null;
  adjustments: GimbalAdjustments;
  equipment: { id: string; position: Vec3; rotation?: EulerDeg }[];
  /** Equipamentos/gimbal personalizados usados — viajam junto para quem importar. */
  customEquipment?: Equipment[];
  customGimbal?: Gimbal;
  createdAt?: string;
  updatedAt?: string;
};

export function exportSetup(
  setup: Setup,
  byId: ReadonlyMap<string, Equipment>,
  gimbal: Gimbal | null,
): SetupFile {
  const custom = new Map<string, Equipment>();
  for (const item of setup.items) {
    const e = byId.get(item.equipmentId);
    if (e?.custom) custom.set(e.id, e);
  }
  return {
    format: SETUP_FORMAT,
    version: SETUP_FORMAT_VERSION,
    name: setup.name,
    gimbal: setup.gimbalId,
    adjustments: { ...setup.adjustments },
    equipment: setup.items.map((i) => ({ id: i.equipmentId, position: { ...i.position }, rotation: { ...i.rotation } })),
    ...(custom.size ? { customEquipment: [...custom.values()] } : {}),
    ...(gimbal?.custom ? { customGimbal: gimbal } : {}),
    createdAt: setup.createdAt,
    updatedAt: setup.updatedAt,
  };
}

export type ImportResult =
  | {
      ok: true;
      setup: Setup;
      customEquipment: Equipment[];
      customGimbal: Gimbal | null;
      warnings: string[];
    }
  | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const toVec = (v: unknown): Vec3 | null =>
  isObj(v) && [v.x, v.y, v.z].every((n) => typeof n === "number" && Number.isFinite(n))
    ? { x: v.x as number, y: v.y as number, z: v.z as number }
    : null;

/**
 * Importa um setup. Equipamentos desconhecidos são ignorados com aviso
 * (a menos que venham definidos em `customEquipment`).
 */
export function importSetup(
  text: string,
  knownEquipment: ReadonlySet<string>,
  knownGimbals: ReadonlySet<string>,
): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Arquivo não é um JSON válido"] };
  }
  if (!isObj(data)) return { ok: false, errors: ["Formato de setup inválido"] };
  if (data.format !== undefined && data.format !== SETUP_FORMAT) {
    return { ok: false, errors: [`Formato desconhecido: ${String(data.format)}`] };
  }
  if (typeof data.version === "number" && data.version > SETUP_FORMAT_VERSION) {
    return { ok: false, errors: [`Versão ${data.version} não suportada (máx. ${SETUP_FORMAT_VERSION})`] };
  }
  if (!Array.isArray(data.equipment)) return { ok: false, errors: ["Campo 'equipment' ausente"] };

  const warnings: string[] = [];
  const customEquipment: Equipment[] = [];
  if (Array.isArray(data.customEquipment)) {
    for (const raw of data.customEquipment) {
      const r = validateEquipment(raw);
      if (r.ok) customEquipment.push({ ...r.value, custom: true, source: { ...r.value.source, kind: "user" } });
      else warnings.push(`Equipamento personalizado ignorado: ${r.errors.join(", ")}`);
    }
  }
  let customGimbal: Gimbal | null = null;
  if (data.customGimbal !== undefined) {
    const r = validateGimbal(data.customGimbal);
    if (r.ok) customGimbal = { ...r.value, custom: true };
    else warnings.push(`Gimbal personalizado ignorado: ${r.errors.join(", ")}`);
  }

  const available = new Set([...knownEquipment, ...customEquipment.map((e) => e.id)]);
  const items: Setup["items"] = [];
  data.equipment.forEach((raw, idx) => {
    if (!isObj(raw) || typeof raw.id !== "string") {
      warnings.push(`Item ${idx + 1} inválido — ignorado`);
      return;
    }
    if (!available.has(raw.id)) {
      warnings.push(`Equipamento "${raw.id}" não está no catálogo — ignorado`);
      return;
    }
    const position = toVec(raw.position);
    if (!position) warnings.push(`Posição inválida para "${raw.id}" — usando origem`);
    items.push({
      instanceId: newId(),
      equipmentId: raw.id,
      position: position ?? { x: 0, y: 0, z: 0 },
      rotation: toVec(raw.rotation) ?? { x: 0, y: 0, z: 0 },
    });
  });

  let gimbalId: string | null = typeof data.gimbal === "string" ? data.gimbal : null;
  if (gimbalId && !knownGimbals.has(gimbalId) && customGimbal?.id !== gimbalId) {
    warnings.push(`Gimbal "${gimbalId}" desconhecido — selecione outro`);
    gimbalId = null;
  }

  const adj = isObj(data.adjustments) ? data.adjustments : {};
  const now = new Date().toISOString();
  const setup: Setup = {
    id: newId("s"),
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Setup importado",
    gimbalId,
    items,
    adjustments: {
      plate: num(adj.plate, DEFAULT_ADJUSTMENTS.plate),
      height: num(adj.height, DEFAULT_ADJUSTMENTS.height),
      roll: num(adj.roll, DEFAULT_ADJUSTMENTS.roll),
      pan: num(adj.pan, DEFAULT_ADJUSTMENTS.pan),
    },
    pose: { pan: 0, tilt: 0, roll: 0 },
    createdAt: typeof data.createdAt === "string" ? data.createdAt : now,
    updatedAt: now,
  };
  return { ok: true, setup, customEquipment, customGimbal, warnings };
}
