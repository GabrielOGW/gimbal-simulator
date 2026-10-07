import accessories from "@/data/equipment/accessories.json";
import batteries from "@/data/equipment/batteries.json";
import cages from "@/data/equipment/cages.json";
import cameras from "@/data/equipment/cameras.json";
import filters from "@/data/equipment/filters.json";
import followFocus from "@/data/equipment/follow-focus.json";
import handles from "@/data/equipment/handles.json";
import lenses from "@/data/equipment/lenses.json";
import matteBoxes from "@/data/equipment/matte-boxes.json";
import microphones from "@/data/equipment/microphones.json";
import monitors from "@/data/equipment/monitors.json";
import plates from "@/data/equipment/plates.json";
import transmitters from "@/data/equipment/transmitters.json";
import gimbalData from "@/data/gimbals/gimbals.json";
import type { Gimbal } from "@/lib/gimbal/types";
import type { Equipment } from "./types";
import { validateEquipment, validateGimbal, type ValidationResult } from "./validation";

/**
 * Fonte do catálogo. Hoje lê JSON estático; para migrar para Postgres/Neon
 * basta criar outra implementação desta interface (ex.: `dbCatalog`) e
 * trocá-la em `getCatalogRepository()`. A UI só recebe `Catalog`.
 */
export interface CatalogRepository {
  listEquipment(): Promise<Equipment[]>;
  listGimbals(): Promise<Gimbal[]>;
}

export type Catalog = { equipment: Equipment[]; gimbals: Gimbal[] };

export const RAW_EQUIPMENT: unknown[] = [
  ...cameras,
  ...lenses,
  ...batteries,
  ...cages,
  ...monitors,
  ...transmitters,
  ...followFocus,
  ...matteBoxes,
  ...filters,
  ...microphones,
  ...handles,
  ...plates,
  ...accessories,
];
export const RAW_GIMBALS: unknown[] = gimbalData;

function parseAll<T>(raw: unknown[], validate: (v: unknown) => ValidationResult<T>, label: string): T[] {
  return raw.map((item, i) => {
    const r = validate(item);
    if (!r.ok) throw new Error(`Catálogo inválido (${label} #${i}): ${r.errors.join("; ")}`);
    return r.value;
  });
}

export const staticCatalog: CatalogRepository = {
  async listEquipment() {
    return parseAll(RAW_EQUIPMENT, validateEquipment, "equipamento");
  },
  async listGimbals() {
    return parseAll(RAW_GIMBALS, validateGimbal, "gimbal");
  },
};

export const getCatalogRepository = (): CatalogRepository => staticCatalog;

export async function getCatalog(): Promise<Catalog> {
  const repo = getCatalogRepository();
  const [equipment, gimbals] = await Promise.all([repo.listEquipment(), repo.listGimbals()]);
  return { equipment, gimbals };
}
