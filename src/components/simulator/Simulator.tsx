"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Catalog } from "@/lib/equipment/catalog";
import type { Equipment, EquipmentCategory } from "@/lib/equipment/types";
import type { Gimbal } from "@/lib/gimbal/types";
import { analyzeSetup, type SetupAnalysis } from "@/lib/simulation/analyze";
import { setupNotices } from "@/lib/setup/compatibility";
import { resolveItems } from "@/lib/setup/factory";
import { exportSetup, importSetup } from "@/lib/setup/serialization";
import { decodeShareToken, encodeShareToken, SHARE_PARAM, tokenFromHash } from "@/lib/setup/share";
import { downloadJSON, loadJSON, saveJSON, STORAGE_KEYS } from "@/lib/storage/local";
import { CustomEquipmentForm } from "@/components/equipment/CustomEquipmentForm";
import { EquipmentPicker } from "@/components/equipment/EquipmentPicker";
import { ItemInspector } from "@/components/equipment/ItemInspector";
import { SetupList } from "@/components/equipment/SetupList";
import { AdjustmentsPanel } from "@/components/gimbal/AdjustmentsPanel";
import { BalancePanel } from "@/components/gimbal/BalancePanel";
import { CustomGimbalForm } from "@/components/gimbal/CustomGimbalForm";
import { PayloadMeter } from "@/components/gimbal/PayloadMeter";
import { PosePanel } from "@/components/gimbal/PosePanel";
import { Button, IconButton, Modal, Section, SourceBadge, cx } from "@/components/ui/controls";
import { UnitsContext } from "@/components/ui/units";
import { clearanceText } from "@/components/gimbal/copy";
import { formatMass, formatMm } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { PresetsPanel } from "./PresetsPanel";
import { allGimbals, createReducer, equipmentIndex, initialState, type SimState } from "./state";
import { Viewport } from "./Viewport";

type ModalState =
  | { kind: "picker"; category: EquipmentCategory | null }
  | { kind: "custom"; initial?: Equipment; category?: EquipmentCategory | null; replaceInstance?: string }
  | { kind: "gimbal"; initial?: Gimbal }
  | { kind: "presets" }
  | { kind: "about" }
  | { kind: "menu" }
  | null;

type MenuAction = "presets" | "import" | "export" | "new" | "about";
const MENU_ACTIONS: [MenuAction, "folder" | "upload" | "download" | "new" | "info", string][] = [
  ["presets", "folder", "Presets"],
  ["import", "upload", "Importar arquivo"],
  ["export", "download", "Exportar arquivo"],
  ["new", "new", "Novo setup"],
  ["about", "info", "Como o cálculo funciona"],
];

/** Abas do celular: o desktop mostra tudo lado a lado. */
type MobileTab = "balance" | "equip" | "adjust" | "settings";
const MOBILE_QUERY = "(max-width: 1023.98px)";
const isMobile = () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;

type Toast = { tone: "info" | "warning" | "error"; lines: string[] } | null;

export function Simulator({ catalog }: { catalog: Catalog }) {
  const reducer = useMemo(() => createReducer(catalog), [catalog]);
  const [state, dispatch] = useReducer(reducer, catalog, initialState);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [tab, setTab] = useState<MobileTab>("balance");
  // Troca de aba no celular volta ao topo: o conteúdo novo começa logo abaixo da cena 3D.
  const goTab = useCallback((t: MobileTab) => {
    setTab(t);
    if (isMobile()) window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const hydrated = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Persistência local (carrega uma vez, salva com debounce). Um link
  // compartilhado (#s=...) tem prioridade sobre o setup salvo.
  useEffect(() => {
    const saved = loadJSON<Partial<SimState>>(STORAGE_KEYS.state);
    if (saved?.setup) dispatch({ type: "hydrate", state: saved });
    hydrated.current = true;
    const token = tokenFromHash(window.location.hash);
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    decodeShareToken(token)
      .then((text) => {
        const r = importSetup(text, new Set(equipmentIndex(catalog, saved?.customEquipment ?? []).keys()), new Set(allGimbals(catalog, saved?.customGimbals ?? []).map((g) => g.id)));
        if (!r.ok) return setToast({ tone: "error", lines: ["Link compartilhado inválido:", ...r.errors] });
        dispatch({ type: "load_setup", setup: r.setup, customEquipment: r.customEquipment, customGimbal: r.customGimbal });
        setToast({ tone: r.warnings.length ? "warning" : "info", lines: [`Setup compartilhado “${r.setup.name}” aberto.`, ...r.warnings] });
      })
      .catch(() => setToast({ tone: "error", lines: ["Link compartilhado corrompido ou incompleto."] }));
  }, [catalog]);
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      const { setup, customEquipment, customGimbals, settings, presets } = state;
      saveJSON(STORAGE_KEYS.state, { setup, customEquipment, customGimbals, settings, presets });
    }, 400);
    return () => clearTimeout(t);
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === "info" ? 3500 : 9000);
    return () => clearTimeout(t);
  }, [toast]);

  const { setup, settings } = state;
  const u = settings.units;
  const byId = useMemo(() => equipmentIndex(catalog, state.customEquipment), [catalog, state.customEquipment]);
  const gimbals = useMemo(() => allGimbals(catalog, state.customGimbals), [catalog, state.customGimbals]);
  const gimbal = gimbals.find((g) => g.id === setup.gimbalId) ?? null;
  const { resolved, missing } = useMemo(() => resolveItems(setup.items, byId), [setup.items, byId]);
  const selected = resolved.find((i) => i.instanceId === state.selectedId) ?? null;
  const allEquipment = useMemo(() => [...state.customEquipment, ...catalog.equipment], [catalog.equipment, state.customEquipment]);

  const { analysis, error } = useMemo((): { analysis: SetupAnalysis | null; error: string | null } => {
    try {
      return { analysis: analyzeSetup(resolved, gimbal, setup.adjustments, setup.pose, settings), error: null };
    } catch (e) {
      return { analysis: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [resolved, gimbal, setup.adjustments, setup.pose, settings]);
  const notices = useMemo(() => setupNotices(resolved), [resolved]);

  // Atalhos: desfazer/refazer, remover item, limpar seleção. Ignorados ao digitar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && key === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (key === "delete" || key === "backspace") {
        e.preventDefault();
        dispatch({ type: "remove_selected" });
      } else if (key === "escape") {
        dispatch({ type: "select", instanceId: null });
      }
    };
    // Soltar o mouse encerra um gesto contínuo (arraste/slider) → próximo passo vira novo "desfazer"
    const onUp = () => dispatch({ type: "end_gesture" });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const onSelect = useCallback(
    (id: string | null) => {
      dispatch({ type: "select", instanceId: id });
      // No celular, tocar num item abre a aba onde ficam posição e rotação.
      if (id && isMobile()) goTab("equip");
    },
    [goTab],
  );
  const onMove = useCallback(
    (id: string, change: { position?: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number } }) =>
      dispatch({ type: "move", instanceId: id, ...change }),
    [],
  );

  const doExport = () => {
    const file = exportSetup(setup, byId, gimbal);
    const slug = setup.name.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "setup";
    downloadJSON(`${slug}.gimbal.json`, file);
    setToast({ tone: "info", lines: ["Setup exportado em JSON."] });
  };
  const doShare = async () => {
    try {
      const token = await encodeShareToken(exportSetup(setup, byId, gimbal));
      const url = `${window.location.origin}${window.location.pathname}#${SHARE_PARAM}=${token}`;
      try {
        await navigator.clipboard.writeText(url);
        setToast({ tone: "info", lines: ["Link do setup copiado.", "Quem abrir verá este setup, incluindo equipamentos personalizados."] });
      } catch {
        window.prompt("Copie o link do setup:", url);
      }
    } catch {
      setToast({ tone: "error", lines: ["Este navegador não suporta a geração do link. Use Exportar."] });
    }
  };
  const doImport = async (f: File) => {
    const text = await f.text();
    const r = importSetup(text, new Set(byId.keys()), new Set(gimbals.map((g) => g.id)));
    if (!r.ok) return setToast({ tone: "error", lines: r.errors });
    dispatch({ type: "load_setup", setup: r.setup, customEquipment: r.customEquipment, customGimbal: r.customGimbal });
    setToast(r.warnings.length ? { tone: "warning", lines: [`“${r.setup.name}” importado com avisos:`, ...r.warnings] } : { tone: "info", lines: [`“${r.setup.name}” importado.`] });
  };

  const runMenuAction = (action: MenuAction) => {
    if (action === "presets" || action === "about") return setModal({ kind: action });
    setModal(null);
    if (action === "import") fileInput.current?.click();
    else if (action === "export") doExport();
    else dispatch({ type: "new_setup" });
  };

  const balanceSection = (
    <>
      <Section
        title="Gimbal"
        right={
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setModal({ kind: "gimbal" })}>
            Personalizado
          </Button>
        }
      >
        <select
          className="h-9 w-full rounded-md border border-ink-600 bg-ink-950 px-2 text-sm"
          value={setup.gimbalId ?? ""}
          onChange={(e) => dispatch({ type: "set_gimbal", gimbalId: e.target.value || null })}
          aria-label="Modelo do gimbal"
        >
          <option value="">— Selecione o gimbal —</option>
          <optgroup label="Catálogo">
            {catalog.gimbals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · {formatMass(g.payload.maximum, { forceKg: true }, u)}
              </option>
            ))}
          </optgroup>
          {state.customGimbals.length > 0 && (
            <optgroup label="Personalizados">
              {state.customGimbals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {formatMass(g.payload.maximum, { forceKg: true }, u)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {gimbal && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-ink-400">
            <span className="flex items-center gap-1">
              Carga <SourceBadge source={gimbal.payloadSource} compact />
            </span>
            <span className="flex items-center gap-1">
              Geometria <SourceBadge source={gimbal.geometrySource} compact />
            </span>
            {gimbal.custom && (
              <button type="button" className="text-amber hover:underline" onClick={() => setModal({ kind: "gimbal", initial: gimbal })}>
                editar
              </button>
            )}
          </div>
        )}
      </Section>

      {gimbal && analysis?.payload && (
        <Section title="Payload">
          <PayloadMeter p={analysis.payload} />
        </Section>
      )}

      {gimbal && analysis?.balance && (
        <Section title="Balanceamento">
          <BalancePanel balance={analysis.balance} tolerance={settings.balanceTolerance} onApply={() => dispatch({ type: "apply_recommended" })} />
        </Section>
      )}

      {gimbal && analysis && analysis.clearance.length > 0 && (
        <Section title="Interferência física (estimada)">
          <ul className="space-y-1 text-[12px] text-amber">
            {analysis.clearance.map((c) => (
              <li key={c.id} className="flex gap-1.5">
                <Icon name="alert" size={14} className="mt-px shrink-0" /> {clearanceText(c, u)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!gimbal && (
        <div className="panel border-dashed p-4 text-center text-sm text-ink-300">Selecione um gimbal para ver capacidade e balanceamento.</div>
      )}
    </>
  );

  const adjustSection = gimbal && (
    <>
      <Section title="Ajustes mecânicos">
        <AdjustmentsPanel
          gimbal={gimbal}
          adjustments={setup.adjustments}
          balance={analysis?.balance ?? null}
          onChange={(key, value) => dispatch({ type: "set_adjustment", key, value })}
        />
      </Section>
      <Section title="Simular pose">
        <PosePanel
          gimbal={gimbal}
          pose={setup.pose}
          torque={analysis?.poseTorque ?? null}
          onChange={(axis, value) => dispatch({ type: "set_pose", axis, value })}
          onReset={() => dispatch({ type: "reset_pose" })}
        />
      </Section>
    </>
  );

  const settingsSection = (
    <Section title="Critérios">
      <div className="space-y-3 text-[12px]">
        <label className="block">
          <span className="flex justify-between">
            <span className="text-ink-200">Margem de segurança da carga</span>
            <span className="num">{Math.round(settings.safetyMargin * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={Math.round(settings.safetyMargin * 100)}
            onChange={(e) => dispatch({ type: "settings", settings: { safetyMargin: Number(e.target.value) / 100 } })}
            className="w-full"
          />
        </label>
        <label className="block">
          <span className="flex justify-between">
            <span className="text-ink-200">Tolerância de balanceamento</span>
            <span className="num">{formatMm(settings.balanceTolerance, 1, u)}</span>
          </span>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={settings.balanceTolerance}
            onChange={(e) => dispatch({ type: "settings", settings: { balanceTolerance: Number(e.target.value) } })}
            className="w-full"
          />
        </label>
        <UnitToggle
          label="Massa"
          value={u.mass}
          options={[
            ["g", "g / kg"],
            ["lb", "lb / oz"],
          ]}
          onChange={(mass) => dispatch({ type: "settings", settings: { units: { ...u, mass } } })}
        />
        <UnitToggle
          label="Distância"
          value={u.length}
          options={[
            ["mm", "mm"],
            ["in", "pol (in)"],
          ]}
          onChange={(length) => dispatch({ type: "settings", settings: { units: { ...u, length } } })}
        />
        <p className="text-[10px] leading-snug text-ink-400">Só muda a exibição. Arquivos exportados e links continuam em g e mm.</p>
      </div>
    </Section>
  );

  const disclaimer = (
    <div className="rounded-[10px] border border-ink-700 p-3 text-[11px] leading-relaxed text-ink-400">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink-200">
        <Icon name="info" size={14} /> Estimativa geométrica
      </p>
      Resultados calculados a partir de peso, dimensões e centro de massa informados — não são certificação de compatibilidade nem simulação
      física completa. A massa dos braços/motores do gimbal entra como estimativa; inércia e efeitos dinâmicos não são considerados. Sempre faça o balanceamento real no
      equipamento.
      {analysis && (analysis.estimatedComCount > 0 || analysis.nonOfficialCount > 0) && (
        <span className="mt-1.5 block text-amber">
          Neste setup: {analysis.estimatedComCount} item(ns) com CM pelo centro geométrico, {analysis.nonOfficialCount} com dados não
          oficiais.
        </span>
      )}
    </div>
  );

  return (
    <UnitsContext.Provider value={u}>
      <div className="flex min-h-dvh flex-col lg:h-dvh">
        {/* Faixa da barra de status (notch/Dynamic Island): a cena fixa no topo rola por baixo dela */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[var(--sa-top)] bg-ink-950 lg:hidden" />

        {/* Cabeçalho */}
        <header className="flex h-[calc(3rem+var(--sa-top))] shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-950 pt-[var(--sa-top)] pl-[max(0.75rem,var(--sa-left))] pr-[max(0.75rem,var(--sa-right))] lg:px-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-6 w-6 items-center justify-center rounded border border-ink-500">
              <span className="h-2 w-2 rounded-full bg-tally" />
            </span>
            <span className="hidden whitespace-nowrap text-[13px] font-black tracking-[0.2em] lg:inline">GIMBAL SIMULATOR</span>
          </div>
          <span className="hidden h-5 w-px bg-ink-700 lg:block" />
          <input
            value={setup.name}
            onChange={(e) => dispatch({ type: "rename", name: e.target.value })}
            className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm font-medium outline-none hover:bg-ink-850 focus:bg-ink-850 sm:max-w-sm"
            aria-label="Nome do setup"
          />
          <nav className="ml-auto flex items-center gap-0.5">
            <IconButton icon="undo" label="Desfazer (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })} />
            <IconButton icon="redo" label="Refazer (Ctrl+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })} />
            <span className="mx-1 hidden h-5 w-px bg-ink-700 sm:block" />
            <HeaderBtn icon="link" label="Compartilhar" onClick={() => void doShare()} />
            {/* No celular em pé, as ações menos usadas vão para o menu */}
            <div className="hidden items-center gap-0.5 sm:flex">
              <HeaderBtn icon="folder" label="Presets" onClick={() => setModal({ kind: "presets" })} />
              <HeaderBtn icon="upload" label="Importar" onClick={() => fileInput.current?.click()} />
              <HeaderBtn icon="download" label="Exportar" onClick={doExport} />
              <HeaderBtn icon="new" label="Novo" onClick={() => dispatch({ type: "new_setup" })} />
              <IconButton icon="info" label="Sobre o modelo" onClick={() => setModal({ kind: "about" })} />
            </div>
            <IconButton icon="menu" label="Mais ações" className="sm:hidden" onClick={() => setModal({ kind: "menu" })} />
          </nav>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = "";
            }}
          />
        </header>

        {error && <div className="bg-stop/15 px-4 py-2 text-sm text-stop">Erro no cálculo: {error}. Revise os dados dos equipamentos.</div>}

        {/* Layout: mobile = 3D → balanceamento → equipamentos → detalhes; desktop = 3 colunas */}
        {/* Celular em pé: cena 3D fixa no topo + uma aba por vez. Celular deitado: cena à esquerda, aba à direita.
            svh (e não dvh) para a cena não mudar de tamanho quando a barra do navegador some ao rolar. */}
        <main
          className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-2 p-2 pb-[calc(var(--tabbar-h)+var(--sa-bottom)+0.5rem)] pl-[max(0.5rem,var(--sa-left))] pr-[max(0.5rem,var(--sa-right))] [grid-template-areas:'view'_'balance'_'details'_'equip'] phone-landscape:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] phone-landscape:[grid-template-areas:'view_balance'_'view_details'_'view_equip'] lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)_auto] lg:content-stretch lg:p-2 lg:[grid-template-areas:'equip_view_balance'_'details_view_balance']"
        >
          <div className="sticky top-[var(--sa-top)] z-20 h-[42svh] [grid-area:view] phone-landscape:top-2 phone-landscape:h-[calc(100svh-3rem-var(--sa-top)-var(--tabbar-h)-var(--sa-bottom)-1rem)] phone-landscape:self-start lg:static lg:h-auto">
            <Viewport
              items={resolved}
              gimbal={gimbal}
              adjustments={setup.adjustments}
              pose={setup.pose}
              analysis={analysis}
              tolerance={settings.balanceTolerance}
              selectedId={state.selectedId}
              onSelect={onSelect}
              onMove={onMove}
            />
          </div>

          <aside className={cx("scrollbar-thin space-y-2 [grid-area:balance] lg:min-h-0 lg:overflow-y-auto", tab !== "balance" && "max-lg:hidden")}>
            {balanceSection}
            <div className="hidden space-y-2 lg:block">
              {adjustSection}
              {settingsSection}
              {disclaimer}
            </div>
          </aside>

          <aside className={cx("scrollbar-thin space-y-2 [grid-area:equip] lg:min-h-0 lg:overflow-y-auto", tab !== "equip" && "max-lg:hidden")}>
            <Section title="Equipamentos">
              <SetupList
                items={resolved}
                missing={missing}
                totalMass={analysis?.totalMass ?? 0}
                selectedId={state.selectedId}
                onSelect={onSelect}
                onAdd={(category) => setModal({ kind: "picker", category })}
                onRemove={(id) => dispatch({ type: "remove", instanceId: id })}
                onDuplicate={(id) => dispatch({ type: "duplicate", instanceId: id })}
              />
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="ghost" icon="center" onClick={() => dispatch({ type: "center" })} disabled={!resolved.length}>
                  Centralizar setup
                </Button>
              </div>
              {notices.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {notices.map((n) => (
                    <li key={n.id} className={n.level === "warning" ? "text-[11px] text-amber" : "text-[11px] text-ink-400"}>
                      • {n.message}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </aside>

          <aside className="space-y-2 [grid-area:details] lg:max-h-[46dvh] lg:min-h-0 lg:overflow-y-auto scrollbar-thin">
            {/* No celular, os detalhes aparecem na aba Equipamentos, acima da lista, quando há item selecionado */}
            <Section title="Detalhes" className={cx((tab !== "equip" || !selected) && "max-lg:hidden")}>
              {selected ? (
                <ItemInspector
                  item={selected}
                  onMove={(change) => onMove(selected.instanceId, change)}
                  onReset={() => dispatch({ type: "reset_item", instanceId: selected.instanceId })}
                  onEdit={() => setModal({ kind: "custom", initial: selected.equipment, replaceInstance: selected.instanceId })}
                  onRemove={() => dispatch({ type: "remove", instanceId: selected.instanceId })}
                />
              ) : (
                <p className="text-[12px] text-ink-400">Selecione um equipamento na lista ou na cena para editar posição e rotação.</p>
              )}
            </Section>
            <div className={cx("space-y-2 lg:hidden", tab !== "adjust" && "hidden")}>
              {adjustSection || (
                <Section title="Ajustes mecânicos">
                  <p className="text-[12px] text-ink-400">Escolha um gimbal na aba Balanço para ver os ajustes.</p>
                </Section>
              )}
            </div>
            <div className={cx("space-y-2 lg:hidden", tab !== "settings" && "hidden")}>
              {settingsSection}
              {disclaimer}
            </div>
          </aside>
        </main>

        {/* Modais */}
        <Modal open={modal?.kind === "picker"} onClose={() => setModal(null)} title="Adicionar equipamento" wide>
          {modal?.kind === "picker" && (
            <EquipmentPicker
              equipment={allEquipment}
              initialCategory={modal.category}
              onPick={(e) => {
                dispatch({ type: "add", equipment: e });
                setModal(null);
              }}
              onCreateCustom={(category) => setModal({ kind: "custom", category })}
            />
          )}
        </Modal>
        <Modal
          open={modal?.kind === "custom"}
          onClose={() => setModal(null)}
          title={modal?.kind === "custom" && modal.initial?.custom ? "Editar equipamento" : "Equipamento personalizado"}
        >
          {modal?.kind === "custom" && (
            <CustomEquipmentForm
              initial={modal.initial}
              defaultCategory={modal.category ?? undefined}
              onCancel={() => setModal(null)}
              onSave={(e) => {
                const wasCustom = modal.initial?.custom === true;
                dispatch({ type: "upsert_custom_equipment", equipment: e });
                if (!wasCustom) {
                  // Cópia editável de um item já montado: mantém posição e rotação
                  if (modal.replaceInstance) dispatch({ type: "replace_equipment", instanceId: modal.replaceInstance, equipment: e });
                  else dispatch({ type: "add", equipment: e });
                }
                setModal(null);
                setToast({ tone: "info", lines: [wasCustom ? `“${e.name}” atualizado.` : modal.replaceInstance ? `“${e.name}” criado no lugar do original.` : `“${e.name}” cadastrado e adicionado.`] });
              }}
            />
          )}
        </Modal>
        <Modal open={modal?.kind === "gimbal"} onClose={() => setModal(null)} title="Gimbal personalizado">
          {modal?.kind === "gimbal" && (
            <CustomGimbalForm
              templates={catalog.gimbals}
              initial={modal.initial}
              onCancel={() => setModal(null)}
              onSave={(g) => {
                dispatch({ type: "upsert_custom_gimbal", gimbal: g });
                setModal(null);
              }}
            />
          )}
        </Modal>
        <Modal open={modal?.kind === "presets"} onClose={() => setModal(null)} title="Presets">
          {modal?.kind === "presets" && (
            <PresetsPanel
              currentName={setup.name}
              presets={state.presets}
              onSave={(name) => {
                dispatch({ type: "save_preset", name });
                setToast({ tone: "info", lines: [`Preset “${name}” salvo.`] });
              }}
              onLoad={(p) => {
                dispatch({ type: "load_setup", setup: { ...p, updatedAt: new Date().toISOString() } });
                setModal(null);
              }}
              onLoadBuiltin={(id) => {
                dispatch({ type: "load_builtin", presetId: id });
                setModal(null);
              }}
              onDelete={(id) => dispatch({ type: "delete_preset", id })}
            />
          )}
        </Modal>
        <Modal open={modal?.kind === "menu"} onClose={() => setModal(null)} title="Setup">
          <div className="grid gap-1.5">
            {MENU_ACTIONS.map(([action, icon, label]) => (
              <button
                key={action}
                type="button"
                onClick={() => runMenuAction(action)}
                className="flex h-12 items-center gap-3 rounded-md border border-ink-700 px-3 text-left text-sm text-ink-100 active:bg-ink-800"
              >
                <Icon name={icon} size={18} className="text-ink-300" />
                {label}
              </button>
            ))}
          </div>
        </Modal>
        <Modal open={modal?.kind === "about"} onClose={() => setModal(null)} title="Como o cálculo funciona" wide>
          <AboutModel gimbalMasses={!!gimbal?.movingMasses} />
        </Modal>

        {toast && (
          <div
            role="status"
            className={
              "fixed bottom-[calc(var(--tabbar-h)+var(--sa-bottom)+0.75rem)] left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-md border px-3 py-2 text-[12px] shadow-xl backdrop-blur lg:bottom-4 " +
              (toast.tone === "error"
                ? "border-stop/50 bg-ink-950/95 text-stop"
                : toast.tone === "warning"
                  ? "border-amber/50 bg-ink-950/95 text-amber"
                  : "border-ink-600 bg-ink-950/95 text-ink-100")
            }
            onClick={() => setToast(null)}
          >
            {toast.lines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        )}
        <MobileTabs
          tab={tab}
          onChange={goTab}
          balanceTone={balanceTone(analysis)}
          itemCount={resolved.length}
        />
      </div>
    </UnitsContext.Provider>
  );
}

/** Cor do indicador da aba Balanço: o pior entre payload e eixos. */
function balanceTone(a: SetupAnalysis | null): "go" | "amber" | "stop" | null {
  if (!a?.payload || !a.balance) return null;
  const axes = Object.values(a.balance.axes).map((x) => x.status);
  if (a.payload.status === "over_capacity" || axes.includes("out_of_range")) return "stop";
  if (a.payload.status !== "ok" || axes.includes("adjust")) return "amber";
  return "go";
}

const TABS: { id: MobileTab; label: string; icon: "gimbal" | "camera" | "sliders" | "gear" }[] = [
  { id: "balance", label: "Balanço", icon: "gimbal" },
  { id: "equip", label: "Equipamentos", icon: "camera" },
  { id: "adjust", label: "Ajustes", icon: "sliders" },
  { id: "settings", label: "Critérios", icon: "gear" },
];

/** Barra de abas do celular, presa embaixo e acima do home indicator. */
function MobileTabs({
  tab,
  onChange,
  balanceTone,
  itemCount,
}: {
  tab: MobileTab;
  onChange: (t: MobileTab) => void;
  balanceTone: "go" | "amber" | "stop" | null;
  itemCount: number;
}) {
  const dot = { go: "bg-go", amber: "bg-amber", stop: "bg-stop" };
  return (
    <nav
      aria-label="Seções"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-950/95 pb-[var(--sa-bottom)] pl-[var(--sa-left)] pr-[var(--sa-right)] backdrop-blur lg:hidden"
    >
      <div role="tablist" className="mx-auto grid h-[var(--tabbar-h)] max-w-xl grid-cols-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onChange(t.id)}
            className={cx(
              "relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium phone-landscape:flex-row phone-landscape:gap-1.5 phone-landscape:text-[11px]",
              tab === t.id ? "text-amber" : "text-ink-300 active:text-ink-100",
            )}
          >
            <span className="relative">
              <Icon name={t.icon} size={20} />
              {t.id === "balance" && balanceTone && (
                <span className={cx("absolute -right-1 -top-0.5 h-2 w-2 rounded-full ring-2 ring-ink-950", dot[balanceTone])} />
              )}
              {t.id === "equip" && itemCount > 0 && (
                <span className="num absolute -right-2.5 -top-1 min-w-4 rounded-full bg-ink-600 px-1 text-center text-[9px] leading-4 text-ink-100">
                  {itemCount}
                </span>
              )}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function UnitToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-200">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex overflow-hidden rounded-md border border-ink-600">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={"num px-2 py-1 text-[11px] pointer-coarse:px-3 pointer-coarse:py-2 " + (value === v ? "bg-amber text-ink-950" : "text-ink-200 hover:bg-ink-800")}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function HeaderBtn({ icon, label, onClick }: { icon: "folder" | "upload" | "download" | "new" | "link"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-ink-200 hover:bg-ink-800 hover:text-ink-100"
    >
      <Icon name={icon} />
      <span className="hidden whitespace-nowrap lg:inline">{label}</span>
    </button>
  );
}

function AboutModel({ gimbalMasses }: { gimbalMasses: boolean }) {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-ink-200">
      <p>
        <b>Referencial:</b> X = esquerda/direita, Y = trás/frente (a lente aponta para +Y), Z = baixo/cima. Origem no centro da base da câmera,
        sobre a placa. Internamente, massa em gramas e distâncias em milímetros; a unidade exibida se escolhe em Critérios.
      </p>
      <p>
        <b>Centro de massa:</b> média ponderada dos centros de massa dos itens, CM = Σ(mᵢ·pᵢ)/Σmᵢ. Sem CM informado, usamos o centro
        geométrico da caixa do item.
      </p>
      <p>
        <b>Balanceamento:</b> os eixos tilt (X) e roll (Y) se cruzam no pivô; o pan é vertical. A carga fica em (roll, placa, −altura) em
        relação ao pivô. Um eixo está balanceado quando o CM está sobre ele: tilt pede Y = 0 e Z = 0 (placa e altura), roll pede X = 0
        (braço horizontal), pan pede o CM sobre o eixo vertical (braço vertical). As recomendações seguem a ordem real: tilt → roll → pan,
        respeitando o curso de cada ajuste.
      </p>
      <p>
        <b>Massa do gimbal:</b> cada eixo equilibra também as partes do gimbal que giram com ele. O tilt leva a morsa e o braço em L; o roll
        soma o motor tilt e o braço horizontal; o pan soma ainda o motor roll e o braço vertical, que ficam atrás da carga. Por isso o pan
        pede ajuste mesmo com o tilt balanceado.{" "}
        <span className="text-amber">
          {gimbalMasses
            ? "Essas massas são estimadas: os fabricantes não as publicam."
            : "Este gimbal não tem massas cadastradas: o cálculo o trata como sem massa."}
        </span>
      </p>
      <p>
        <b>Torque:</b> m·g·d com o desvio atual — o pior caso estático. Na seção “Simular pose” calculamos o torque da gravidade com o
        gimbal girado, ignorando aceleração.
      </p>
      <p className="text-amber">
        <b>Limitações:</b> a massa das partes móveis do gimbal é estimada e tratada como pontos, e a inércia é ignorada; a geometria do gimbal e cursos de ajuste são
        estimados; dados de catálogo podem conter erros. Use como planejamento, não como garantia.
      </p>
    </div>
  );
}
