import type { AdjustmentKey, Gimbal, GimbalAdjustments } from "@/lib/gimbal/types";
import type { BalanceResult } from "@/lib/simulation/balance";
import { formatMm } from "@/lib/format";
import { fromDisplayLength, lengthDigits, lengthStep, toDisplayLength } from "@/lib/units";
import { NumberField } from "@/components/ui/controls";
import { useUnits } from "@/components/ui/units";
import { ADJ_AXIS, ADJ_LABEL } from "./copy";

const AX_COLOR = { x: "var(--color-ax-x)", y: "var(--color-ax-y)", z: "var(--color-ax-z)" };

export function AdjustmentsPanel({
  gimbal,
  adjustments,
  balance,
  onChange,
}: {
  gimbal: Gimbal;
  adjustments: GimbalAdjustments;
  balance: BalanceResult | null;
  onChange: (key: AdjustmentKey, value: number) => void;
}) {
  const u = useUnits();
  const ideal: Partial<Record<AdjustmentKey, number>> = {};
  if (balance) {
    for (const a of Object.values(balance.axes)) for (const c of a.corrections) ideal[c.key] = c.ideal;
  }
  return (
    <div className="space-y-3">
      {(Object.keys(ADJ_LABEL) as AdjustmentKey[]).map((key) => {
        const r = gimbal.adjustmentRanges[key];
        const v = adjustments[key];
        const target = ideal[key];
        const pct = (n: number) => `${((Math.min(r.max, Math.max(r.min, n)) - r.min) / (r.max - r.min)) * 100}%`;
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-ink-200">{ADJ_LABEL[key]}</span>
              <span className="num text-[10px] text-ink-400">
                {formatMm(r.min, 0, u)} a {formatMm(r.max, 0, u)} · eixo {ADJ_AXIS[key].toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_150px] items-center gap-2">
              <div className="relative">
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={0.5}
                  value={v}
                  onChange={(e) => onChange(key, Number(e.target.value))}
                  className="w-full"
                  aria-label={ADJ_LABEL[key]}
                />
                {target !== undefined && (
                  <div
                    className="pointer-events-none absolute -bottom-1 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-go"
                    style={{ left: pct(target) }}
                    title={`Ideal: ${formatMm(target, 1, u)}`}
                  />
                )}
              </div>
              <NumberField
                label={ADJ_AXIS[key].toUpperCase()}
                accent={AX_COLOR[ADJ_AXIS[key]]}
                value={toDisplayLength(v, u)}
                unit={u.length}
                step={lengthStep(u)}
                digits={lengthDigits(u)}
                min={toDisplayLength(r.min, u)}
                max={toDisplayLength(r.max, u)}
                onChange={(n) => onChange(key, fromDisplayLength(n, u))}
                compact
              />
            </div>
          </div>
        );
      })}
      <p className="text-[10px] leading-snug text-ink-400">
        <span className="mr-1 inline-block h-1.5 w-1.5 rotate-45 bg-go align-middle" /> posição ideal estimada para cada ajuste.
      </p>
    </div>
  );
}
