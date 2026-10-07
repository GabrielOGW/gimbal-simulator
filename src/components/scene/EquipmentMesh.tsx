"use client";

import { Edges, Html, RoundedBox } from "@react-three/drei";
import { forwardRef, useState } from "react";
import type { Group } from "three";
import type { ResolvedItem } from "@/lib/setup/types";
import { CATEGORY_CODES } from "@/lib/equipment/categories";
import { CATEGORY_COLORS, SELECT_COLOR } from "./palette";

const DEG = Math.PI / 180;

type Props = {
  item: ResolvedItem;
  selected: boolean;
  onSelect: (id: string) => void;
};

function Material({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.55}
      metalness={0.35}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 1}
    />
  );
}

function Body({ item, edgeColor }: { item: ResolvedItem; edgeColor: string }) {
  const e = item.equipment;
  const { width: w, height: h, depth: d } = e.dimensions;
  const color = CATEGORY_COLORS[e.category];
  const radius = Math.max(0.5, Math.min(4, Math.min(w, h, d) / 6));

  switch (e.category) {
    case "lens":
    case "microphone":
    case "filter": {
      const r = Math.min(w, h) / 2;
      return (
        <group>
          <mesh>
            <cylinderGeometry args={[r, r, d, 40]} />
            <Material color={color} />
            <Edges color={edgeColor} threshold={30} />
          </mesh>
          {e.category === "lens" && (
            <>
              <mesh position={[0, d * 0.12, 0]}>
                <cylinderGeometry args={[r + 0.8, r + 0.8, d * 0.22, 40]} />
                <meshStandardMaterial color="#2f343c" roughness={0.9} />
              </mesh>
              <mesh position={[0, d / 2 + 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[r * 0.78, 40]} />
                <meshStandardMaterial color="#0e2235" metalness={0.9} roughness={0.15} emissive="#0a1a2a" />
              </mesh>
            </>
          )}
          {e.category === "filter" && (
            <mesh>
              <cylinderGeometry args={[r * 0.85, r * 0.85, d + 0.4, 40]} />
              <meshStandardMaterial color="#3d5f80" transparent opacity={0.45} />
            </mesh>
          )}
        </group>
      );
    }
    case "cage":
    case "matte_box":
      return (
        <mesh>
          <boxGeometry args={[w, d, h]} />
          <Material color={color} opacity={e.category === "cage" ? 0.06 : 0.55} />
          <Edges color={edgeColor === SELECT_COLOR ? SELECT_COLOR : "#7d8492"} />
        </mesh>
      );
    case "monitor":
      return (
        <group>
          <RoundedBox args={[w, d, h]} radius={radius} smoothness={3}>
            <Material color={color} />
            <Edges color={edgeColor} threshold={30} />
          </RoundedBox>
          <mesh position={[0, -d / 2 - 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w * 0.86, h * 0.8]} />
            <meshStandardMaterial color="#0b2033" emissive="#123a5c" emissiveIntensity={0.7} />
          </mesh>
        </group>
      );
    case "camera":
      return (
        <group>
          <RoundedBox args={[w, d, h]} radius={radius} smoothness={3}>
            <Material color={color} />
            <Edges color={edgeColor} threshold={30} />
          </RoundedBox>
          {/* Tally discreto no topo */}
          <mesh position={[w * 0.32, d * 0.3, h / 2 + 0.6]}>
            <boxGeometry args={[6, 3, 1]} />
            <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    case "battery":
      return (
        <group>
          <RoundedBox args={[w, d, h]} radius={radius} smoothness={2}>
            <Material color={color} />
            <Edges color={edgeColor} threshold={30} />
          </RoundedBox>
          <mesh position={[0, -d / 2 - 0.2, h * 0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w * 0.6, 3]} />
            <meshBasicMaterial color="#35d07f" />
          </mesh>
        </group>
      );
    default:
      return (
        <RoundedBox args={[w, d, h]} radius={radius} smoothness={2}>
          <Material color={color} />
          <Edges color={edgeColor} threshold={30} />
        </RoundedBox>
      );
  }
}

/** Equipamento na cena. Posição e dimensões em mm, referencial da carga. */
export const EquipmentMesh = forwardRef<Group, Props>(function EquipmentMesh({ item, selected, onSelect }, ref) {
  const [hover, setHover] = useState(false);
  const edgeColor = selected ? SELECT_COLOR : hover ? "#c9ced6" : "#3f4550";
  return (
    <group
      ref={ref}
      position={[item.position.x, item.position.y, item.position.z]}
      rotation={[item.rotation.x * DEG, item.rotation.y * DEG, item.rotation.z * DEG]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item.instanceId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      <Body item={item} edgeColor={edgeColor} />
      {(selected || hover) && (
        <Html
          position={[0, 0, item.equipment.dimensions.height / 2 + 8]}
          center
          style={{ pointerEvents: "none" }}
          zIndexRange={[20, 0]}
        >
          <div className="num whitespace-nowrap rounded border border-ink-600 bg-ink-950/90 px-1.5 py-0.5 text-[10px] text-ink-100 shadow">
            <span className="mr-1 text-amber">{CATEGORY_CODES[item.equipment.category]}</span>
            {item.equipment.name}
          </div>
        </Html>
      )}
    </group>
  );
});
