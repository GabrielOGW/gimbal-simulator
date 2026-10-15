"use client";

import { CATEGORY_CODES, CATEGORY_LABELS } from "@/lib/equipment/categories";
import type { EquipmentCategory } from "@/lib/equipment/types";
import { formatMass, formatXYZ } from "@/lib/format";
import type { ResolvedItem, SetupItem } from "@/lib/setup/types";
import { IconButton, SourceBadge, cx } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import { useUnits } from "@/components/ui/units";

/** Slots do "configurador" — sempre visíveis, mesmo vazios. */
const SLOTS: EquipmentCategory[] = ["camera", "lens", "cage", "monitor", "battery", "follow_focus", "transmitter", "matte_box"];

export function SetupList({
  items,
  missing,
  totalMass,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  onDuplicate,
}: {
  items: ResolvedItem[];
  missing: SetupItem[];
  totalMass: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (category: EquipmentCategory | null) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const u = useUnits();
  const extras = [...new Set(items.map((i) => i.equipment.category))].filter((c) => !SLOTS.includes(c));
  const groups = [...SLOTS, ...extras];

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="label">Peso total</div>
          <div className="num text-xl font-semibold">{formatMass(totalMass, { forceKg: true }, u)}</div>
        </div>
        <div className="num text-right text-[11px] text-ink-400">{items.length} itens</div>
      </div>

      <div className="space-y-1">
        {groups.map((cat) => {
          const inCat = items.filter((i) => i.equipment.category === cat);
          return (
            <div key={cat} className="rounded-md">
              <div className="flex items-center justify-between px-1 pt-1.5">
                <span className="label !text-[9px]">{CATEGORY_LABELS[cat]}</span>
                {inCat.length > 0 && (
                  <button type="button" onClick={() => onAdd(cat)} className="text-[10px] text-ink-400 hover:text-amber pointer-coarse:-my-2 pointer-coarse:px-2 pointer-coarse:py-2.5 pointer-coarse:text-[11px]">
                    + adicionar
                  </button>
                )}
              </div>
              {inCat.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onAdd(cat)}
                  className="mt-1 flex h-9 w-full items-center gap-2 rounded-md border border-dashed border-ink-600 px-2 text-xs text-ink-400 hover:border-amber/60 hover:text-amber"
                >
                  <Icon name="plus" size={14} /> {CATEGORY_LABELS[cat]}
                </button>
              ) : (
                <ul className="mt-1 space-y-1">
                  {inCat.map((item) => (
                    <ItemRow
                      key={item.instanceId}
                      item={item}
                      selected={item.instanceId === selectedId}
                      onSelect={onSelect}
                      onRemove={onRemove}
                      onDuplicate={onDuplicate}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p className="mt-3 rounded-md border border-stop/30 bg-stop/10 p-2 text-[11px] text-stop">
          {missing.length} item(ns) referenciam equipamentos que não existem mais e foram ignorados no cálculo.
        </p>
      )}

      <button
        type="button"
        onClick={() => onAdd(null)}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-amber text-sm font-semibold text-ink-950 hover:bg-[#ffc24d]"
      >
        <Icon name="plus" /> Adicionar equipamento
      </button>
    </div>
  );
}

function ItemRow({
  item,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
}: {
  item: ResolvedItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const e = item.equipment;
  const p = item.position;
  const u = useUnits();
  return (
    <li
      className={cx(
        "group flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors",
        selected ? "border-amber/70 bg-amber/[0.07]" : "border-ink-700 bg-ink-850 hover:border-ink-500",
      )}
    >
      <button type="button" onClick={() => onSelect(item.instanceId)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={cx("num w-8 shrink-0 text-center text-[10px] font-bold", selected ? "text-amber" : "text-ink-300")}>
          {CATEGORY_CODES[e.category]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px]">{e.name}</span>
          </span>
          <span className="num block truncate text-[10px] text-ink-400">
            {formatXYZ(p, u)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="num text-xs">{formatMass(e.weight, {}, u)}</span>
          <span className="flex gap-1">
            {e.centerOfMass === undefined && (
              <span title="Centro de massa estimado pelo centro geométrico" className="num text-[9px] text-ink-400">
                CM≈
              </span>
            )}
            <SourceBadge source={e.source} compact />
          </span>
        </span>
      </button>
      <div className="flex shrink-0 opacity-60 group-hover:opacity-100">
        <IconButton icon="copy" label="Duplicar" className="h-7 w-7" onClick={() => onDuplicate(item.instanceId)} />
        <IconButton icon="trash" label="Remover" className="h-7 w-7 hover:text-stop" onClick={() => onRemove(item.instanceId)} />
      </div>
    </li>
  );
}
