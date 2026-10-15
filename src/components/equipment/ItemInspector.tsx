"use client";

import { CATEGORY_LABELS } from "@/lib/equipment/categories";
import { formatDay, formatDims, formatMass, formatVec } from "@/lib/format";
import { fromDisplayLength, lengthDigits, toDisplayLength } from "@/lib/units";
import { itemCenterOfMass } from "@/lib/simulation/centerOfMass";
import type { ResolvedItem } from "@/lib/setup/types";
import type { EulerDeg, Vec3 } from "@/types/geometry";
import { Button, NumberField, SourceBadge } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import { useUnits } from "@/components/ui/units";

const AX = { x: "var(--color-ax-x)", y: "var(--color-ax-y)", z: "var(--color-ax-z)" };

export function ItemInspector({
  item,
  onMove,
  onReset,
  onEdit,
  onRemove,
}: {
  item: ResolvedItem;
  onMove: (change: { position?: Vec3; rotation?: EulerDeg }) => void;
  onReset: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const e = item.equipment;
  const com = itemCenterOfMass(item);
  const u = useUnits();
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{e.name}</div>
            <div className="text-[11px] text-ink-400">
              {CATEGORY_LABELS[e.category]}
              {e.brand ? ` · ${e.brand}` : ""}
            </div>
          </div>
          <SourceBadge source={e.source} />
        </div>
        {(e.source.reference || e.source.note) && (
          <p className="mt-1.5 text-[10px] leading-snug text-ink-400">
            {e.source.reference && <span className="text-ink-300">Fonte: {e.source.reference}. </span>}
            {e.source.checkedAt && <span className="text-ink-300">Conferido em {formatDay(e.source.checkedAt)}. </span>}
            {e.source.note}
          </p>
        )}
      </div>

      <dl className="num grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-ink-400">Peso</dt>
        <dd className="text-right">{formatMass(e.weight, {}, u)}</dd>
        <dt className="text-ink-400">L × A × P</dt>
        <dd className="text-right">{formatDims(e.dimensions, u)}</dd>
        <dt className="text-ink-400">CM do item</dt>
        <dd className="text-right">{formatVec(com, 0, u)}</dd>
      </dl>
      {e.centerOfMass === undefined ? (
        <p className="flex gap-1.5 text-[11px] leading-snug text-amber">
          <Icon name="alert" size={14} className="mt-px shrink-0" />
          Centro de massa não informado. Utilizando o centro geométrico como estimativa.
        </p>
      ) : (
        e.centerOfMassSource && (
          <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
            CM local ({formatVec(e.centerOfMass, 1, u)}) <SourceBadge source={e.centerOfMassSource} compact />
          </p>
        )
      )}

      <div>
        <div className="label mb-1.5">Posição (centro do item)</div>
        <div className="space-y-1.5">
          {(["x", "y", "z"] as const).map((k) => (
            <NumberField
              key={k}
              label={k.toUpperCase()}
              accent={AX[k]}
              unit={u.length}
              step={u.length === "in" ? 0.25 : 5}
              digits={lengthDigits(u)}
              value={toDisplayLength(item.position[k], u)}
              onChange={(v) => onMove({ position: { ...item.position, [k]: fromDisplayLength(v, u) } })}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="label mb-1.5">Rotação</div>
        <div className="space-y-1.5">
          {(["x", "y", "z"] as const).map((k) => (
            <NumberField
              key={k}
              label={k.toUpperCase()}
              accent={AX[k]}
              unit="°"
              step={15}
              value={item.rotation[k]}
              onChange={(v) => onMove({ rotation: { ...item.rotation, [k]: v } })}

            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" icon="reset" onClick={onReset}>
          Resetar posição
        </Button>
        <Button size="sm" icon="edit" onClick={onEdit}>
          {e.custom ? "Editar dados" : "Cópia editável"}
        </Button>
        <Button size="sm" variant="danger" icon="trash" onClick={onRemove}>
          Remover
        </Button>
      </div>
    </div>
  );
}
