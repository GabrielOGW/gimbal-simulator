import type { SetupFile } from "./serialization";

/**
 * Compartilhamento sem servidor: o arquivo de setup (o mesmo do Exportar)
 * é comprimido (deflate) e codificado em base64url no fragmento da URL
 * (#s=...). O fragmento não é enviado ao servidor.
 */
export const SHARE_PARAM = "s";

const toBase64Url = (bytes: Uint8Array) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeShareToken(file: SetupFile): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(file));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

/** Devolve o JSON do setup, ou lança erro se o token estiver corrompido. */
export async function decodeShareToken(token: string): Promise<string> {
  const bytes = await pipe(fromBase64Url(token), new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(bytes);
}

/** Extrai o token de um fragmento como "#s=abc". */
export function tokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const t = params.get(SHARE_PARAM);
  return t && /^[A-Za-z0-9_-]+$/.test(t) ? t : null;
}
