import { useEffect, useState } from "react";
import { Sparkles, Save, Trash2, Camera, Palette } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import ColorWheel from "@/components/ColorWheel";
import { useDomus } from "@/context/DomusContext";
import { iconFor, SCENE_ICONS, SOFT_COLORS } from "@/lib/icons";
import { rgbToHex } from "@/lib/color";
import { ActionRow, ACTION_KINDS } from "@/components/AutomationEditor";

const EMPTY = { name: "", icon: "sparkles", color: "#b08e54", room_id: null, actions: {}, extra: [] };

export default function SceneEditor({ open, onClose, scene, defaultRoom = null }) {
  const { entities, rooms, settings, scenes, createScene, updateScene, deleteScene } = useDomus();
  const [form, setForm] = useState(EMPTY);
  const [wheelFor, setWheelFor] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (scene) setForm({ ...scene, actions: Object.fromEntries(scene.actions.filter((a) => !a.type || a.type === "entity").map((a) => [a.entity_id, { ...a.state }])), extra: scene.actions.filter((a) => a.type && a.type !== "entity") });
    else setForm({ ...EMPTY, room_id: defaultRoom || null, actions: {}, extra: [] });
    setWheelFor(null);
  }, [open, scene, defaultRoom]);

  const lights = entities.filter((e) => e.type === "light" && (!form.room_id || e.room_id === form.room_id));
  const presets = settings?.color_presets || [];
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setAction = (id, patch) => setForm((f) => ({ ...f, actions: { ...f.actions, [id]: { ...(f.actions[id] || {}), ...patch } } }));
  const toggleInclude = (l) => setForm((f) => {
    const actions = { ...f.actions };
    if (actions[l.id]) delete actions[l.id];
    else actions[l.id] = { on: true, ...(l.state?.supports_dimming ? { brightness: l.state.brightness ?? 80 } : {}), ...(l.state?.supports_color ? { rgb: l.state.rgb || [255, 200, 120] } : {}) };
    return { ...f, actions };
  });
  const capture = () => {
    const actions = Object.fromEntries(lights.map((l) => [l.id, { on: !!l.state?.on, ...(l.state?.supports_dimming ? { brightness: l.state.brightness ?? 80 } : {}), ...(l.state?.supports_color && l.state.rgb ? { rgb: l.state.rgb } : {}) }]));
    set({ actions }); toast.info("Stato attuale delle luci catturato");
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Inserisci un nome");
    const actions = [...Object.entries(form.actions).map(([entity_id, state]) => ({ entity_id, state })), ...(form.extra || [])];
    if (!actions.length) return toast.error("Seleziona almeno una luce o aggiungi un'azione avanzata");
    const payload = { name: form.name, icon: form.icon, color: form.color, room_id: form.room_id, actions };
    if (scene) await updateScene(scene.id, payload); else await createScene(payload);
    toast.success("Scena salvata"); onClose();
  };
  const remove = async () => {
    if (!scene || !window.confirm("Eliminare la scena?")) return;
    await deleteScene(scene.id); toast.success("Scena eliminata"); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={scene ? `Modifica "${scene.name}"` : "Nuova scena"} subtitle="Scegli le luci e come devono accendersi" icon={<Sparkles size={18} />} testid="scene-editor" width="max-w-3xl"
      footer={<>
        {scene && <button onClick={remove} className="btn-danger px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="scene-delete"><Trash2 size={14} /> Elimina</button>}
        <button onClick={save} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="scene-save"><Save size={14} /> Salva scena</button>
      </>}
    >
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <label className="block"><div className="label mb-1.5">Nome</div><input className="field" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Es. Relax, Cena, Lettura…" data-testid="scene-name" /></label>
        <label className="block"><div className="label mb-1.5">Ambito</div>
          <select className="field" value={form.room_id || ""} onChange={(e) => set({ room_id: e.target.value || null })} data-testid="scene-room">
            <option value="">Globale (tutta la casa)</option>{rooms.map((r) => <option key={r.id} value={r.id}>Stanza · {r.name}</option>)}
          </select></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <div><div className="label mb-1.5">Icona</div>
          <div className="flex flex-wrap gap-1.5">{SCENE_ICONS.map((k) => { const I = iconFor(k); return <button key={k} onClick={() => set({ icon: k })} className={`icon-btn w-9 h-9 ${form.icon === k ? "icon-on" : "icon-off"}`} data-testid={`scene-icon-${k}`}><I size={15} /></button>; })}</div></div>
        <div><div className="label mb-1.5">Colore etichetta</div>
          <div className="flex flex-wrap gap-1.5 pt-1">{SOFT_COLORS.map((c) => <button key={c} onClick={() => set({ color: c })} className={`w-7 h-7 rounded-full border-2 ${form.color === c ? "border-slate-700 dark:border-white scale-110" : "border-white/70"}`} style={{ background: c }} data-testid={`scene-color-${c.slice(1)}`} aria-label={c} />)}</div></div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="label">Luci ({Object.keys(form.actions).length} selezionate)</div>
        <button onClick={capture} className="chip !py-1" data-testid="scene-capture"><Camera size={12} /> Cattura stato attuale</button>
      </div>
      <div className="space-y-2">
        {lights.map((l) => {
          const a = form.actions[l.id];
          const LI = iconFor(l.icon);
          const room = rooms.find((r) => r.id === l.room_id);
          return (
            <div key={l.id} className={`rounded-2xl px-3 py-2.5 transition-colors ${a ? "bg-acc-soft" : "glass-inner"}`} data-testid={`scene-light-${l.id}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleInclude(l)} className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${a ? "bg-[rgb(var(--acc-strong))] border-transparent" : "border-slate-400/60"}`} data-testid={`scene-include-${l.id}`} aria-pressed={!!a}>{a && <span className="w-2 h-2 bg-white rounded-sm" />}</button>
                <LI size={14} className="text-muted shrink-0" />
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{l.name}</div><div className="text-[10px] text-muted">{room?.name || "Non assegnata"}</div></div>
                {a && <button onClick={() => setAction(l.id, { on: !a.on })} className={`toggle ${a.on ? "on" : ""}`} data-testid={`scene-on-${l.id}`} aria-label="Accesa" />}
              </div>
              {a && a.on && (
                <div className="mt-2.5 pl-7 space-y-2.5">
                  {l.state?.supports_dimming && (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted w-20">Luminosità</span>
                      <input type="range" min="1" max="100" value={a.brightness ?? 80} onChange={(e) => setAction(l.id, { brightness: parseInt(e.target.value, 10) })} className="slider flex-1" style={{ "--fill": `${a.brightness ?? 80}%` }} data-testid={`scene-brightness-${l.id}`} />
                      <span className="text-[11px] font-mono w-9 text-right">{a.brightness ?? 80}%</span>
                    </div>
                  )}
                  {l.state?.supports_color && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[11px] text-muted w-20">Colore</span>
                      <div className="flex items-center gap-1.5">
                        {presets.map((p, i) => <button key={`${p.name}-${i}`} title={p.name} onClick={() => setAction(l.id, { rgb: p.rgb })} className={`w-6 h-6 rounded-full border-2 ${a.rgb && rgbToHex(a.rgb) === rgbToHex(p.rgb) ? "border-slate-700 dark:border-white scale-110" : "border-white/80"}`} style={{ background: rgbToHex(p.rgb) }} data-testid={`scene-preset-${l.id}-${i}`} />)}
                        <button onClick={() => setWheelFor(wheelFor === l.id ? null : l.id)} className={`chip !py-1 !px-2.5 ${wheelFor === l.id ? "chip-active" : ""}`} data-testid={`scene-wheel-toggle-${l.id}`}><Palette size={11} /> Ruota</button>
                        <span className="w-5 h-5 rounded-full border border-white/70" style={{ background: rgbToHex(a.rgb || [255, 200, 120]) }} />
                      </div>
                      {wheelFor === l.id && <div className="w-full pt-1"><ColorWheel size={160} rgb={a.rgb || [255, 200, 120]} onChange={(rgb) => setAction(l.id, { rgb })} testid={`scene-wheel-${l.id}`} /></div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {lights.length === 0 && <div className="text-sm text-muted text-center py-4">Nessuna luce in questo ambito.</div>}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="label">Azioni avanzate ({(form.extra || []).length})</div>
          <select className="field !py-1 !text-[11px] !w-44" value="" onChange={(e) => e.target.value && set({ extra: [...(form.extra || []), { type: e.target.value }] })} data-testid="scene-add-advanced">
            <option value="">+ Aggiungi azione…</option>
            {ACTION_KINDS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          {(form.extra || []).map((a, i) => (
            <ActionRow key={i} action={a} index={i} entities={entities} scenes={scenes} customSounds={settings?.custom_sounds || []}
              onChange={(patch) => set({ extra: form.extra.map((r, j) => (j === i ? { ...r, ...patch } : r)) })}
              onDelete={() => set({ extra: form.extra.filter((_, j) => j !== i) })} />
          ))}
          {(form.extra || []).length === 0 && <p className="text-[11px] text-muted">Puoi aggiungere climatizzazione, media, annunci vocali, servizi Home Assistant, impulsi su relè, suonerie e notifiche.</p>}
        </div>
      </div>
    </Modal>
  );
}
