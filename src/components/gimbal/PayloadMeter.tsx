import type { PayloadEvaluation } from "@/lib/simulation/payload";
import { formatMass, formatPercent } from "@/lib/format";
import { StatusPill, cx, type Tone } from "@/components/ui/controls";

const STATUS: Record<PayloadEvaluation["status"], { tone: Tone; label: string }> = {
  empty: { tone: "muted", label: "Sem carga" },
  below_minimum: { tone: "amber", label: "Abaixo do mínimo" },
  ok: { tone: "go", label: "Compatível" },
  above_margin: { tone: "amber", label: "Atenção" },
  over_capacity: { tone: "stop", label: "Acima da capacidade" },
};

export function PayloadMeter({ p }: { p: PayloadEvaluation }) {
  const s = STATUS[p.status];
  const fill = Math.min(1, p.ratio);
  const effPos = p.effectiveCapacity / p.maximum;
  const bar = { go: "bg-go", amber: "bg-amber", stop: "bg-stop", muted: "bg-ink-500", info: "bg-info" }[s.tone];

  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="num text-2xl font-semibold leading-none tracking-tight">
            {formatMass(p.total, { forceKg: true })}
            <span className="text-sm font-normal text-ink-400"> / {formatMass(p.maximum, { forceKg: true })}</span>
          </div>
          <div className="num mt-1 text-[11px] text-ink-300">{formatPercent(p.ratio)} da carga nominal</div>
        </div>
        <StatusPill tone={s.tone}>{s.label}</StatusPill>
      </div>

      <div className="relative h-3 overflow-hidden rounded-sm bg-ink-800" role="meter" aria-valuemin={0} aria-valuemax={p.maximum} aria-valuenow={p.total} aria-label="Carga do gimbal">
        <div className={cx("h-full transition-[width] duration-300", bar)} style={{ width: `${fill * 100}%` }} />
        {/* marcação da capacidade efetiva (margem de segurança) */}
        {p.safetyMargin > 0 && (
          <div className="absolute inset-y-0 w-px bg-ink-100/80" style={{ left: `${effPos * 100}%` }} title="Capacidade efetiva (com margem)" />
        )}
        {/* hachura da zona da margem */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0"
          style={{
            width: `${(1 - effPos) * 100}%`,
            background: "repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0 3px, transparent 3px 6px)",
          }}
        />
      </div>

      <dl className="num grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-ink-400">Margem</dt>
        <dd className="text-right">{formatPercent(p.safetyMargin, 0)}</dd>
        <dt className="text-ink-400">Capacidade efetiva</dt>
        <dd className="text-right">{formatMass(p.effectiveCapacity, { forceKg: true })}</dd>
        {p.status === "over_capacity" && (
          <>
            <dt className="text-stop">Excesso</dt>
            <dd className="text-right text-stop">+{formatMass(p.excess)}</dd>
          </>
        )}
        {p.status === "above_margin" && (
          <>
            <dt className="text-amber">Acima da margem</dt>
            <dd className="text-right text-amber">+{formatMass(p.marginExcess)}</dd>
          </>
        )}
        {(p.status === "ok" || p.status === "below_minimum") && (
          <>
            <dt className="text-ink-400">Folga</dt>
            <dd className="text-right text-go">{formatMass(p.headroom)}</dd>
          </>
        )}
      </dl>
      {p.status === "above_margin" && (
        <p className="text-[11px] leading-snug text-amber">Dentro da capacidade nominal, porém acima da margem recomendada.</p>
      )}
      {p.status === "below_minimum" && (
        <p className="text-[11px] leading-snug text-amber">Abaixo da carga mínima indicada — os motores podem oscilar.</p>
      )}
    </div>
  );
}
