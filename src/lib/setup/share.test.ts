import { describe, expect, it } from "vitest";
import { getCatalog } from "@/lib/equipment/catalog";
import { buildSetup } from "./factory";
import { exportSetup, importSetup } from "./serialization";
import { decodeShareToken, encodeShareToken, tokenFromHash } from "./share";

describe("link compartilhado", async () => {
  const catalog = await getCatalog();
  const byId = new Map(catalog.equipment.map((e) => [e.id, e]));
  const gimbal = catalog.gimbals.find((g) => g.id === "dji-rs4-pro")!;

  it("ida e volta preserva o setup", async () => {
    const s = buildSetup("Doc FX3", ["sony-fx3", "sony-fe-24-70-gm2", "atomos-ninja-v"], gimbal, byId, { autoBalance: true });
    const token = await encodeShareToken(exportSetup(s, byId, gimbal));
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    const r = importSetup(await decodeShareToken(token), new Set(byId.keys()), new Set([gimbal.id]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.setup.name).toBe("Doc FX3");
    expect(r.setup.adjustments).toEqual(s.adjustments);
    expect(r.setup.items.map((i) => i.position)).toEqual(s.items.map((i) => i.position));
  });

  it("link é curto o bastante para compartilhar", async () => {
    const s = buildSetup("x", ["sony-fx6", "generic-cage-fx6", "sony-fe-24-105-g", "sony-bp-u70", "hollyland-mars-400s-pro-tx", "dji-rs-focus-motor-2022"], gimbal, byId);
    expect((await encodeShareToken(exportSetup(s, byId, gimbal))).length).toBeLessThan(2000);
  });

  it("token corrompido gera erro", async () => {
    await expect(decodeShareToken("isso-nao-e-deflate")).rejects.toThrow();
  });

  it("extrai o token do fragmento da URL", () => {
    expect(tokenFromHash("#s=abc_-1")).toBe("abc_-1");
    expect(tokenFromHash("#outra=1")).toBeNull();
    expect(tokenFromHash("#s=<script>")).toBeNull();
    expect(tokenFromHash("")).toBeNull();
  });
});
