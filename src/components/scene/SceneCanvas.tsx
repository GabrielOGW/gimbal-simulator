"use client";

import { Grid, Html, Line, OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Group } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Gimbal, GimbalAdjustments } from "@/lib/gimbal/types";
import type { SetupAnalysis } from "@/lib/simulation/analyze";
import type { GimbalPose, ResolvedItem } from "@/lib/setup/types";
import type { EulerDeg, Vec3 } from "@/types/geometry";
import { ComMarker } from "./ComMarker";
import { EquipmentMesh } from "./EquipmentMesh";
import { GimbalRig, rigFloorZ } from "./GimbalRig";
import { AXIS_COLORS, STATUS_COLORS } from "./palette";

export type ViewName = "3d" | "front" | "side" | "top";
export type TransformMode = "translate" | "rotate";

const RAD = 180 / Math.PI;
const r1 = (n: number) => Math.round(n * 10) / 10 || 0;

/** Nosso referencial (Z para cima, mm) → Three.js (Y para cima, m). */
const toThree = (p: Vec3): [number, number, number] => [p.x / 1000, p.z / 1000, -p.y / 1000];

const VIEW_DIRECTIONS: Record<ViewName, Vec3> = {
  "3d": { x: -0.62, y: 0.68, z: 0.38 },
  front: { x: 0, y: 1, z: 0.0001 },
  side: { x: 1, y: 0, z: 0.0001 },
  top: { x: 0, y: -0.0001, z: 1 },
};

function CameraRig({ view, distance, target, nonce, controls }: { view: ViewName; distance: number; target: Vec3; nonce: number; controls: RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const d = VIEW_DIRECTIONS[view];
    const len = Math.hypot(d.x, d.y, d.z);
    const t = toThree(target);
    const dir = toThree({ x: (d.x / len) * distance * 1000, y: (d.y / len) * distance * 1000, z: (d.z / len) * distance * 1000 });
    camera.position.set(t[0] + dir[0], t[1] + dir[1], t[2] + dir[2]);
    camera.lookAt(t[0], t[1], t[2]);
    const c = controls.current;
    if (c) {
      c.target.set(t[0], t[1], t[2]);
      c.update();
    }
    invalidate();
    // nonce força o reset mesmo sem trocar de vista
  }, [view, distance, target, nonce, camera, controls, invalidate]);
  return null;
}

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
  view: ViewName;
  resetNonce: number;
  mode: TransformMode;
  showLimits: boolean;
};

function Payload({ items, selectedId, onSelect, analysis, adjustments, gimbal, setSelectedObj }: Props & { setSelectedObj: (g: Group | null) => void }) {
  const com = analysis?.centerOfMass ?? null;
  const balance = analysis?.balance ?? null;
  const origin: Vec3 = gimbal ? { x: 0, y: adjustments.plate, z: -adjustments.height } : { x: 0, y: 0, z: 0 };

  // CM no referencial do tilt (para traçar as distâncias até os eixos)
  const comTilt = com ? { x: com.x + origin.x, y: com.y + origin.y, z: com.z + origin.z } : null;

  return (
    <>
      <group position={[origin.x, origin.y, origin.z]}>
        {items.map((item) => (
          <EquipmentMesh
            key={item.instanceId}
            ref={item.instanceId === selectedId ? setSelectedObj : undefined}
            item={item}
            selected={item.instanceId === selectedId}
            onSelect={onSelect}
          />
        ))}
        {com && <ComMarker position={com} label="CM" />}
      </group>

      {comTilt && gimbal && balance && (
        <>
          {/* distância do CM ao eixo tilt (perpendicular, plano YZ) */}
          <Line
            points={[
              [comTilt.x, comTilt.y, comTilt.z],
              [comTilt.x, 0, 0],
            ]}
            color={STATUS_COLORS[balance.axes.tilt.status]}
            lineWidth={2}
          />
          {/* desvio lateral até o plano do eixo roll */}
          <Line
            points={[
              [comTilt.x, comTilt.y, comTilt.z],
              [-adjustments.roll, comTilt.y, comTilt.z],
            ]}
            color={STATUS_COLORS[balance.axes.roll.status]}
            lineWidth={2}
          />
        </>
      )}

    </>
  );
}

function CoordinateAxes({ size }: { size: number }) {
  const axes: { to: [number, number, number]; color: string; label: string }[] = [
    { to: [size, 0, 0], color: AXIS_COLORS.x, label: "X" },
    { to: [0, size, 0], color: AXIS_COLORS.y, label: "Y" },
    { to: [0, 0, size], color: AXIS_COLORS.z, label: "Z" },
  ];
  return (
    <group>
      {axes.map((a) => (
        <group key={a.label}>
          <Line points={[[0, 0, 0], a.to]} color={a.color} lineWidth={2.5} />
          <Html position={a.to} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
            <span className="num text-[11px] font-black" style={{ color: a.color }}>
              {a.label}+
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}

/**
 * Gizmo de arrastar. Fica na raiz da cena (fora do grupo escalado em mm),
 * senão o gizmo herdaria a escala 0.001 e ficaria invisível.
 */
function ItemGizmo({ selectedObj, selectedId, mode, onMove }: { selectedObj: Group | null; selectedId: string | null; mode: TransformMode; onMove: Props["onMove"] }) {
  return (
    <>
      {selectedObj && selectedId && (
        <TransformControls
          object={selectedObj}
          mode={mode}
          size={0.75}
          rotationSnap={Math.PI / 12}
          onObjectChange={() => {
            const p = selectedObj.position;
            const r = selectedObj.rotation;
            onMove(
              selectedId,
              mode === "translate"
                ? { position: { x: r1(p.x), y: r1(p.y), z: r1(p.z) } }
                : { rotation: { x: r1(r.x * RAD), y: r1(r.y * RAD), z: r1(r.z * RAD) } },
            );
          }}
        />
      )}
    </>
  );
}

export default function SceneCanvas(props: Props) {
  const [selectedObj, setSelectedObj] = useState<Group | null>(null);
  const { gimbal, adjustments, pose, analysis, tolerance, view, resetNonce, showLimits, onSelect } = props;
  const controls = useRef<OrbitControlsImpl | null>(null);
  const floorZ = gimbal ? rigFloorZ(gimbal) : -20;
  // Enquadra o conjunto inteiro (punho até o topo da carga); não depende dos ajustes
  // para a câmera não "pular" enquanto o usuário mexe nos sliders.
  const topZ = 170;
  const distance = ((topZ - floorZ) / 1000) * 2.3;
  const target = useMemo<Vec3>(() => ({ x: 0, y: 0, z: (topZ + floorZ) / 2 }), [floorZ]);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 32, near: 0.01, far: 30, position: [0.4, 0.3, 0.5] }}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#090a0c"]} />
      <fog attach="fog" args={["#090a0c", distance + 0.6, distance + 4]} />
      <hemisphereLight args={["#dfe6ff", "#2a2018", 1.1]} />
      <directionalLight position={[-1.2, 2, 1.5]} intensity={2.6} />
      <directionalLight position={[1.5, 0.8, -1.2]} intensity={1.4} color="#ffd9a0" />
      <directionalLight position={[0, -0.5, 2]} intensity={0.6} color="#9fc3ff" />
      <ambientLight intensity={0.35} />

      <Grid
        position={[0, floorZ / 1000, 0]}
        args={[4, 4]}
        cellSize={0.01}
        cellThickness={0.5}
        cellColor="#1b1e24"
        sectionSize={0.1}
        sectionThickness={1}
        sectionColor="#2a2f38"
        fadeDistance={2.2}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Raiz em mm, Z para cima */}
      <group rotation={[-Math.PI / 2, 0, 0]} scale={0.001}>
        <CoordinateAxes size={45} />
        {gimbal ? (
          <GimbalRig gimbal={gimbal} adjustments={adjustments} pose={pose} balance={analysis?.balance ?? null} tolerance={tolerance} showLimits={showLimits}>
            <Payload {...props} setSelectedObj={setSelectedObj} />
          </GimbalRig>
        ) : (
          <Payload {...props} setSelectedObj={setSelectedObj} />
        )}
      </group>

      <ItemGizmo selectedObj={selectedObj} selectedId={props.selectedId} mode={props.mode} onMove={props.onMove} />
      <OrbitControls ref={controls} makeDefault enableDamping={false} minDistance={0.12} maxDistance={5} />
      <CameraRig view={view} distance={distance} target={target} nonce={resetNonce} controls={controls} />
    </Canvas>
  );
}
