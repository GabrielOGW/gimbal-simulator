"use client";

import { Html, Line } from "@react-three/drei";
import type { ReactNode } from "react";
import type { Gimbal, GimbalAdjustments } from "@/lib/gimbal/types";
import type { BalanceResult } from "@/lib/simulation/balance";
import type { GimbalPose } from "@/lib/setup/types";
import type { Range } from "@/types/geometry";
import { AXIS_COLORS, GIMBAL_ARM_COLOR, GIMBAL_COLOR, STATUS_COLORS } from "./palette";

const DEG = Math.PI / 180;
type V3 = [number, number, number];

/** Barra retangular entre dois pontos alinhados a um eixo (mm). */
function Bar({ from, to, t = 10, color = GIMBAL_ARM_COLOR }: { from: V3; to: V3; t?: number; color?: string }) {
  const size: V3 = [Math.abs(to[0] - from[0]) || t, Math.abs(to[1] - from[1]) || t, Math.abs(to[2] - from[2]) || t];
  const center: V3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  return (
    <mesh position={center}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
    </mesh>
  );
}

/** Motor cilíndrico alinhado a X, Y ou Z. */
function Motor({ at, axis, r, len }: { at: V3; axis: "x" | "y" | "z"; r: number; len: number }) {
  const rot: V3 = axis === "x" ? [0, 0, Math.PI / 2] : axis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return (
    <group position={at} rotation={rot}>
      <mesh>
        <cylinderGeometry args={[r, r, len, 40]} />
        <meshStandardMaterial color={GIMBAL_COLOR} roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[r * 0.55, r * 0.55, len + 1.5, 32]} />
        <meshStandardMaterial color="#3a3f48" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

function AxisLine({ from, to, color, label }: { from: V3; to: V3; color: string; label: string }) {
  return (
    <group>
      <Line points={[from, to]} color={color} lineWidth={1.5} dashed dashSize={6} gapSize={4} transparent opacity={0.9} />
      <Html position={to} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div className="num rounded px-1 text-[9px] font-bold tracking-widest" style={{ color, background: "rgba(8,9,11,.75)" }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

/** Arco de limite mecânico em torno de um eixo. `plane` define a orientação. */
function LimitArc({ range, r, plane, color, center = [0, 0, 0] }: { range: Range; r: number; plane: "tilt" | "roll"; color: string; center?: V3 }) {
  const pts: V3[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = (range.min + ((range.max - range.min) * i) / steps) * DEG;
    // tilt: gira em X, 0° aponta para +Y (frente); roll: gira em Y, 0° aponta para +Z (cima)
    pts.push(
      plane === "tilt"
        ? [center[0], center[1] + r * Math.cos(a), center[2] + r * Math.sin(a)]
        : [center[0] + r * Math.sin(a), center[1], center[2] + r * Math.cos(a)],
    );
  }
  return <Line points={pts} color={color} lineWidth={1} transparent opacity={0.35} />;
}

/** Seta indicando a correção recomendada (mm). */
export function CorrectionArrow({ at, dir, delta, color }: { at: V3; dir: "x" | "y" | "z"; delta: number; color: string }) {
  const len = Math.min(70, Math.max(18, Math.abs(delta) * 1.6));
  const s = Math.sign(delta);
  const v: V3 = dir === "x" ? [s * len, 0, 0] : dir === "y" ? [0, s * len, 0] : [0, 0, s * len];
  const tip: V3 = [at[0] + v[0], at[1] + v[1], at[2] + v[2]];
  // Cone aponta para +Y por padrão
  const rot: V3 =
    dir === "y" ? (s > 0 ? [0, 0, 0] : [0, 0, Math.PI]) : dir === "x" ? [0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2] : [s > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0];
  return (
    <group>
      <Line points={[at, tip]} color={color} lineWidth={3} />
      <mesh position={tip} rotation={rot}>
        <coneGeometry args={[5, 12, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

type Props = {
  gimbal: Gimbal;
  adjustments: GimbalAdjustments;
  pose: GimbalPose;
  balance: BalanceResult | null;
  tolerance: number;
  /** Conteúdo no referencial do tilt (carga + CM) */
  children: ReactNode;
  showLimits: boolean;
};

/**
 * Gimbal estilizado de 3 eixos (layout tipo RS/Crane): punho → motor pan →
 * braço vertical → motor roll atrás da carga → braço horizontal → motor tilt
 * à esquerda → braço em L até a placa. Origem = cruzamento tilt × roll.
 */
export function GimbalRig({ gimbal, adjustments: adj, pose, balance, tolerance, children, showLimits }: Props) {
  const scale = Math.cbrt(gimbal.payload.maximum / 3000);
  const r = 20 * scale;
  const len = 34 * scale;
  const t = 10 * scale;
  const g = gimbal.geometry;

  const tiltX = -(g.tiltArmInnerX + len / 2); // motor tilt (referencial do tilt)
  const plateZ = -adj.height;
  const clampZ = plateZ - 10;
  const rollY = -(g.rearClearance + len / 2);
  const panZ = -(gimbal.adjustmentRanges.height.max + 40 * scale);
  const panY = -adj.pan;
  const reach = g.tiltArmInnerX + 70;

  const status = (axis: "tilt" | "roll" | "pan") => (balance ? STATUS_COLORS[balance.axes[axis].status] : "#8b919d");
  const corr = (axis: "tilt" | "roll" | "pan", key: string) => {
    const c = balance?.axes[axis].corrections.find((x) => x.key === key);
    return c && Math.abs(c.delta) > tolerance ? c : null;
  };
  const cPlate = corr("tilt", "plate");
  const cHeight = corr("tilt", "height");
  const cRoll = corr("roll", "roll");
  const cPan = corr("pan", "pan");

  return (
    <group>
      {/* Punho + estator do pan (não giram) */}
      <Motor at={[0, panY, panZ]} axis="z" r={r * 1.05} len={len} />
      <mesh position={[0, panY, panZ - len / 2 - 85 * scale]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[17 * scale, 19 * scale, 160 * scale, 32]} />
        <meshStandardMaterial color="#101215" roughness={0.85} />
      </mesh>
      <AxisLine from={[0, panY, panZ - len]} to={[0, panY, 140]} color={AXIS_COLORS.z} label="PAN" />
      {cPan && <CorrectionArrow at={[0, panY, panZ + len]} dir="y" delta={cPan.delta} color={STATUS_COLORS[balance!.axes.pan.status]} />}

      {/* Tudo que gira no pan */}
      <group position={[0, panY, 0]} rotation={[0, 0, pose.pan * DEG]}>
        <group position={[0, -panY, 0]}>
          <Bar from={[0, panY, panZ + len / 2]} to={[0, rollY - len / 2 - t, panZ + len / 2]} t={t * 1.4} />
          <Bar from={[0, rollY - len / 2 - t / 2, panZ + len / 2]} to={[0, rollY - len / 2 - t / 2, 0]} t={t * 1.4} />
          <Motor at={[0, rollY, 0]} axis="y" r={r} len={len} />
          <AxisLine from={[0, rollY - len, 0]} to={[0, 170, 0]} color={AXIS_COLORS.y} label="ROLL" />
          {showLimits && gimbal.axes.roll.rotationLimitDeg && (
            <LimitArc range={gimbal.axes.roll.rotationLimitDeg} r={r * 1.6} plane="roll" color={AXIS_COLORS.y} center={[0, rollY, 0]} />
          )}

          {/* Tudo que gira no roll */}
          <group rotation={[0, pose.roll * DEG, 0]}>
            <Bar from={[0, rollY, 0]} to={[adj.roll + tiltX, rollY, 0]} t={t} />
            <Bar from={[adj.roll + tiltX, rollY, 0]} to={[adj.roll + tiltX, -len / 2, 0]} t={t} />
            <Motor at={[adj.roll + tiltX, 0, 0]} axis="x" r={r} len={len} />
            {cRoll && (
              <CorrectionArrow at={[adj.roll + tiltX / 2, rollY, 0]} dir="x" delta={cRoll.delta} color={STATUS_COLORS[balance!.axes.roll.status]} />
            )}

            {/* Tudo que gira no tilt (inclui a carga) */}
            <group position={[adj.roll, 0, 0]} rotation={[pose.tilt * DEG, 0, 0]}>
              <AxisLine from={[tiltX - len, 0, 0]} to={[reach, 0, 0]} color={AXIS_COLORS.x} label="TILT" />
              {showLimits && gimbal.axes.tilt.rotationLimitDeg && (
                <LimitArc range={gimbal.axes.tilt.rotationLimitDeg} r={r * 1.6} plane="tilt" color={AXIS_COLORS.x} center={[tiltX, 0, 0]} />
              )}
              {/* braço em L: desce do motor tilt até a base da placa */}
              <Bar from={[tiltX, 0, -r * 0.6]} to={[tiltX, 0, clampZ]} t={t} />
              <Bar from={[tiltX, 0, clampZ]} to={[0, 0, clampZ]} t={t} />
              {/* morsa (fixa) + placa de engate rápido (desliza em Y) */}
              <mesh position={[0, 0, plateZ - 7]}>
                <boxGeometry args={[46, g.plateLength * 0.55, 9]} />
                <meshStandardMaterial color="#1a1d22" metalness={0.6} roughness={0.4} />
              </mesh>
              <mesh position={[0, adj.plate, plateZ - 2]}>
                <boxGeometry args={[38, g.plateLength, 4]} />
                <meshStandardMaterial color="#5b6270" metalness={0.7} roughness={0.35} />
              </mesh>
              {cPlate && (
                <CorrectionArrow at={[24, adj.plate, plateZ - 2]} dir="y" delta={cPlate.delta} color={status("tilt")} />
              )}
              {cHeight && <CorrectionArrow at={[tiltX - t, 0, clampZ / 2]} dir="z" delta={cHeight.delta} color={status("tilt")} />}

              {children}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export const rigFloorZ = (gimbal: Gimbal) => {
  const scale = Math.cbrt(gimbal.payload.maximum / 3000);
  return -(gimbal.adjustmentRanges.height.max + 40 * scale) - 34 * scale - 170 * scale;
};
