"use client";

import { useMemo, useState } from "react";
import { CATEGORY_CODES, CATEGORY_LABELS } from "@/lib/equipment/categories";
import { searchEquipment } from "@/lib/equipment/search";
import { EQUIPMENT_CATEGORIES, type Equipment, type EquipmentCategory } from "@/lib/equipment/types";
import { formatMass } from "@/lib/format";
import { Button, SourceBadge, cx } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";

export function EquipmentPicker({
  equipment,
  initialCategory,
  onPick,
  onCreateCustom,
}: {
  equipment: Equipment[];
  initialCategory: EquipmentCategory | null;
  onPick: (e: Equipment) => void;
  onCreateCustom: (category: EquipmentCategory | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EquipmentCategory | null>(initialCategory);
  const results = useMemo(() => searchEquipment(equipment, query, category), [equipment, query, category]);
  const counts = useMemo(() => {
    const m = new Map<EquipmentCategory, number>();
    for (const e of equipment) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, [equipment]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-2.5 focus-within:border-amber">
        <Icon name="search" className="text-ink-400" />
        <input
          autoFocus
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder="Buscar: fx3, 24-70, v-mount, ninja…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) onPick(results[0]);
          }}
        />
      </div>
      <div className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        <Chip active={category === null} onClick={() => setCategory(null)}>
          Todos
        </Chip>
        {EQUIPMENT_CATEGORIES.filter((c) => counts.get(c)).map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>

      <ul className="scrollbar-thin -mx-1 max-h-[46dvh] space-y-1 overflow-y-auto px-1">
        {results.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e)}
              className="group flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left hover:border-ink-600 hover:bg-ink-800"
            >
              <span className="num w-9 shrink-0 rounded bg-ink-800 py-1 text-center text-[10px] font-bold text-amber group-hover:bg-ink-700">
                {CATEGORY_CODES[e.category]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{e.name}</span>
                <span className="num block text-[10px] text-ink-400">
                  {e.dimensions.width}×{e.dimensions.height}×{e.dimensions.depth} mm
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="num text-sm">{formatMass(e.weight)}</span>
                <SourceBadge source={e.source} compact />
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="py-6 text-center text-sm text-ink-400">Nada encontrado para “{query}”.</li>}
      </ul>

      <div className="flex items-center justify-between gap-2 border-t border-ink-700 pt-3">
        <span className="text-[11px] text-ink-400">Não achou? Cadastre com as medidas do seu equipamento.</span>
        <Button variant="outline" size="sm" icon="plus" onClick={() => onCreateCustom(category)}>
          Personalizado
        </Button>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "h-7 shrink-0 rounded-full border px-2.5 text-xs transition-colors",
        active ? "border-amber bg-amber/15 text-amber" : "border-ink-600 text-ink-300 hover:text-ink-100",
      )}
    >
      {children}
    </button>
  );
}
