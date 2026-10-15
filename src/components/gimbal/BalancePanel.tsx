import type { AxisName } from "@/lib/gimbal/types";
import type { AxisBalance, BalanceResult } from "@/lib/simulation/balance";
import { formatSignedMm, formatTorque } from "@/lib/format";
import { Button, StatusPill, type Tone } from "@/components/ui/controls";
import { AXIS_HINT, AXIS_LABEL, correctionText } from "./copy";

const STATUS: Record<AxisBalance["status"], { tone: Tone; label: string }> = {
  ok: { tone: "go", label: "OK" },
  adjust: { tone: "amber", label: "Ajustar" },
  out_of_range: { tone: "stop", label: "Fora do curso" },
  no_data: { tone: "muted", label: "—" },
};
const AXIS_COLOR: Record<AxisName, string> = { tilt: "var(--color-ax-x)", roll: "var(--color-ax-y)", pan: "var(--color-ax-z)" };

function AxisCard({ a, tolerance }: { a: AxisBalance; tolerance: number }) {
  const s = STATUS[a.status];
  const actionable = a.corrections.filter((c) => Math.abs(c.delta) > tolerance || !c.withinRange);
  return (
    <div className="rounded-md border border-ink-700 bg-ink-850 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-1 rounded-full" style={{ background: AXIS_COLOR[a.axis] }} />
          <span className="text-sm font-semibold">{AXIS_LABEL[a.axis]}</span>
          <span className="num text-[11px] text-ink-400">desvio {a.residual.toFixed(1)} mm</span>
        </div>
        <StatusPill tone={s.tone}>{s.label}</StatusPill>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-ink-400">{AXIS_HINT[a.axis]}</p>

      {a.status !== "ok" && actionable.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {actionable.map((c) => (
            <li key={c.key} className="text-[12px] leading-snug">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-100">{correctionText(c.key, c.ideal - c.current)}</span>
                <span className="num shrink-0 font-semibold text-amber">{formatSignedMm(c.ideal - c.current)}</span>
              </div>
              {!c.withinRange && (
                <div className="mt-0.5 text-[11px] text-stop">
                  Excede o curso ({c.range.min}…{c.range.max} mm). No limite sobram {formatSignedMm(c.ideal - c.recommended)} —
                  considere contrapeso, extensão de placa ou reposicionar acessórios.
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {a.axis === "roll" && a.offset.z !== undefined && Math.abs(a.offset.z) > tolerance && (
        <p className="mt-1.5 text-[10px] text-ink-400">O desvio vertical ({formatSignedMm(a.offset.z)}) também afeta o roll — é corrigido na altura do tilt.</p>
      )}
      <div className="num mt-1.5 text-[10px] text-ink-400">Torque estático máx. estimado: {formatTorque(a.worstCaseTorque)}</div>
    </div>
  );
}

export function BalancePanel({ balance, tolerance, onApply }: { balance: BalanceResult; tolerance: number; onApply: () => void }) {
  const allOk = (["tilt", "roll", "pan"] as const).every((k) => balance.axes[k].status === "ok");
  return (
    <div className="space-y-2">
      {balance.includesGimbalMasses && (
        <p className="rounded border border-amber/30 bg-amber/5 px-2 py-1.5 text-[10px] leading-snug text-amber">
          Inclui a massa <b>estimada</b> das partes móveis do gimbal (braços e motores). O fabricante não publica esses valores — o
          ajuste de pan vem principalmente delas.
        </p>
      )}
      {(["tilt", "roll", "pan"] as const).map((k) => (
        <AxisCard key={k} a={balance.axes[k]} tolerance={tolerance} />
      ))}
      <Button variant={allOk ? "outline" : "primary"} icon="wand" className="w-full" onClick={onApply} disabled={allOk}>
        {allOk ? "Balanceado (dentro da tolerância)" : "Aplicar ajustes recomendados"}
      </Button>
    </div>
  );
}
