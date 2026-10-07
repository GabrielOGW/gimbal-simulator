"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { SetupAnalysis } from "@/lib/simulation/analyze";
import type { Gimbal, GimbalAdjustments } from "@/lib/gimbal/types";
import type { GimbalPose, ResolvedItem } from "@/lib/setup/types";
import type { EulerDeg, Vec3 } from "@/types/geometry";
import { formatMass, formatSignedMm } from "@/lib/format";
import { cx } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import type { TransformMode, ViewName } from "@/components/scene/SceneCanvas";

const SceneCanvas = dynamic(() => import("@/components/scene/SceneCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <span className="num animate-pulse text-xs tracking-widest text-ink-400">CARREGANDO CENA 3D…</span>
    </div>
  ),
});

const VIEWS: { id: ViewName; label: string }[] = [
  { id: "3d", label: "3D" },
  { id: "front", label: "Frontal" },
  { id: "side", label: "Lateral" },
  { id: "top", label: "Superior" },
];

type Props = {
  items: ResolvedItem[];
  gimbal: Gimbal | null;
  adjustments: GimbalAdjustments;
  pose: GimbalPose;
  analysis: SetupAnalysis | null;
  tolerance: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, change: { position?: Vec3; rotation?: EulerDeg }) => void;
};

function Corner({ className }: { className: string }) {
  return <span className={cx("pointer-events-none absolute h-5 w-5 border-ink-400/70", className)} />;
}

export function Viewport(props: Props) {
  const [view, setView] = useState<ViewName>("3d");
  const [nonce, setNonce] = useState(0);
  const [mode, setMode] = useState<TransformMode>("translate");
  const [showLimits, setShowLimits] = useState(true);
  const { analysis, gimbal } = props;
  const com = analysis?.centerOfMass;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[10px] border border-ink-700 bg-[#090a0c]">
      <SceneCanvas {...props} view={view} resetNonce={nonce} mode={mode} showLimits={showLimits} />

      {/* moldura de visor */}
      <Corner className="left-3 top-3 border-l border-t" />
      <Corner className="right-3 top-3 border-r border-t" />
      <Corner className="bottom-3 left-3 border-b border-l" />
      <Corner className="bottom-3 right-3 border-b border-r" />

      {/* HUD superior esquerdo */}
      <div className="pointer-events-none absolute left-5 top-5 space-y-1">
        <div className="num flex items-center gap-2 text-[10px] tracking-widest text-ink-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-tally" />
          {gimbal ? gimbal.name.toUpperCase() : "SEM GIMBAL"}
        </div>
        <div className="num text-lg font-semibold leading-none">{formatMass(analysis?.totalMass ?? 0, { forceKg: true })}</div>
        {com && (
          <div className="num space-y-0.5 pt-1 text-[11px] leading-none">
            <div className="label !text-[9px]">Centro de massa</div>
            <div>
              <span className="text-ax-x">X</span> {formatSignedMm(com.x)}
            </div>
            <div>
              <span className="text-ax-y">Y</span> {formatSignedMm(com.y)}
            </div>
            <div>
              <span className="text-ax-z">Z</span> {formatSignedMm(com.z)}
            </div>
          </div>
        )}
      </div>

      {/* Vistas */}
      <div className="absolute right-5 top-5 flex overflow-hidden rounded-md border border-ink-600 bg-ink-950/80 backdrop-blur">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setView(v.id);
              setNonce((n) => n + 1);
            }}
            className={cx("h-7 px-2 text-[11px] font-medium", view === v.id ? "bg-amber text-ink-950" : "text-ink-300 hover:text-ink-100")}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Ferramentas */}
      <div className="absolute bottom-5 left-5 flex items-center gap-1 rounded-md border border-ink-600 bg-ink-950/80 p-0.5 backdrop-blur">
        <ToolBtn active={mode === "translate"} onClick={() => setMode("translate")} icon="move" label="Mover" disabled={!props.selectedId} />
        <ToolBtn active={mode === "rotate"} onClick={() => setMode("rotate")} icon="rotate" label="Girar" disabled={!props.selectedId} />
        <span className="mx-0.5 h-5 w-px bg-ink-600" />
        <ToolBtn active={false} onClick={() => setNonce((n) => n + 1)} icon="target" label="Resetar câmera" />
        <ToolBtn active={showLimits} onClick={() => setShowLimits((s) => !s)} icon="gimbal" label="Limites de movimento" />
      </div>

      {/* Legenda dos eixos */}
      <div className="num pointer-events-none absolute bottom-5 right-5 hidden space-y-0.5 text-right text-[10px] leading-tight text-ink-300 sm:block">
        <div>
          <b className="text-ax-x">X</b> esquerda − / + direita
        </div>
        <div>
          <b className="text-ax-y">Y</b> trás − / + frente
        </div>
        <div>
          <b className="text-ax-z">Z</b> baixo − / + cima
        </div>
      </div>

      {!props.selectedId && props.items.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 text-center text-[11px] text-ink-400">
          Toque em um equipamento para movê-lo
        </div>
      )}
    </div>
  );
}

function ToolBtn({ active, onClick, icon, label, disabled }: { active: boolean; onClick: () => void; icon: "move" | "rotate" | "target" | "gimbal"; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex h-7 items-center gap-1 rounded px-1.5 text-[11px] disabled:opacity-30",
        active ? "bg-ink-700 text-amber" : "text-ink-300 hover:text-ink-100",
      )}
    >
      <Icon name={icon} size={14} />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
