import type { AxisName, Gimbal } from "@/lib/gimbal/types";
import type { GimbalPose } from "@/lib/setup/types";
import type { PoseTorque } from "@/lib/simulation/statics";
import { formatTorque } from "@/lib/format";
import { Button } from "@/components/ui/controls";
import { AXIS_LABEL } from "./copy";

export function PosePanel({
  gimbal,
  pose,
  torque,
  onChange,
  onReset,
}: {
  gimbal: Gimbal;
  pose: GimbalPose;
  torque: PoseTorque | null;
  onChange: (axis: AxisName, v: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-2.5">
      {(["tilt", "roll", "pan"] as const).map((axis) => {
        const lim = gimbal.axes[axis].rotationLimitDeg;
        const min = Math.max(-180, lim?.min ?? -180);
        const max = Math.min(180, lim?.max ?? 180);
        return (
          <div key={axis} className="grid grid-cols-[44px_1fr_52px] items-center gap-2">
            <span className="text-[11px] text-ink-200">{AXIS_LABEL[axis]}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={pose[axis]}
              onChange={(e) => onChange(axis, Number(e.target.value))}
              aria-label={`Ângulo ${AXIS_LABEL[axis]}`}
            />
            <span className="num text-right text-xs">{pose[axis]}°</span>
          </div>
        );
      })}
      {torque && (
        <div className="num grid grid-cols-2 gap-1 rounded-md bg-ink-850 p-2 text-[11px]">
          <span className="text-ink-400">Torque tilt</span>
          <span className="text-right">{formatTorque(Math.abs(torque.tilt))}</span>
          <span className="text-ink-400">Torque roll</span>
          <span className="text-right">{formatTorque(Math.abs(torque.roll))}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-snug text-ink-400">Torque da gravidade nesta pose, com motores desligados. Não inclui aceleração.</p>
        <Button size="sm" variant="ghost" icon="reset" onClick={onReset}>
          Nivelar
        </Button>
      </div>
    </div>
  );
}
