import { CATEGORY_LABELS } from "./categories";
import type { Equipment, EquipmentCategory } from "./types";

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Busca por tokens: todos os termos precisam aparecer em nome, marca,
 * categoria ou id. "fx3", "sony 24 70", "bateria v-mount" funcionam.
 */
export function searchEquipment(
  list: readonly Equipment[],
  query: string,
  category?: EquipmentCategory | null,
): Equipment[] {
  const tokens = normalize(query).split(/[\s/]+/).filter(Boolean);
  return list.filter((e) => {
    if (category && e.category !== category) return false;
    if (!tokens.length) return true;
    const hay = normalize(`${e.name} ${e.brand ?? ""} ${CATEGORY_LABELS[e.category]} ${e.category} ${e.id}`).replace(/-/g, " ");
    const compact = hay.replace(/\s+/g, "");
    return tokens.every((t) => hay.includes(t) || compact.includes(t.replace(/-/g, "")));
  });
}
