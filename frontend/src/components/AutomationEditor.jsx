import { useEffect, useState } from "react";
import { Plus, Trash2, Zap, Play, Save, Volume2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import { useDomus } from "@/context/DomusContext";
import { AutomationsAPI } from "@/lib/api";
import { RINGTONES, SIRENS, playSound, stopSound } from "@/lib/sounds";

const OPS = [{ v: "changed", l: "cambia" }, { v: "on", l: "è acceso/attivo" }, { v: "off", l: "è spento" }, { v: "eq", l: "=" },
  { v: "ne", l: "≠" }, { v: "gt", l: ">" }, { v: "lt", l: "<" }, { v: "gte", l: "≥" }, { v: "lte", l: "≤" }, { v: "contains", l: "contiene" }];
const TRIGGER_KINDS = [{ v: "state", l: "Stato/valore di un'entità" }, { v: "ring", l: "Squillo citofono/campanello" },
  { v: "alarm", l: "Antintrusione" }, { v: "time", l: "Orario" }];
const ACTION_KINDS = [{ v: "entity", l: "Cambia stato entità" }, { v: "pulse", l: "Impulso su relè" }, { v: "scene", l: "Attiva scena" },
  { v: "service", l: "Servizio Home Assistant" }, { v: "media", l: "Media / annuncio" }, { v: "sound", l: "Suoneria sui tablet" },
  { v: "notify", l: "Notifica Domus" }, { v: "alarm", l: "Arma/disarma allarme" }, { v: "delay", l: "Attendi" }];
const ALARM_MODES = ["disarmed", "home", "away", "night", "vacation", "custom", "triggered", "any"];
const NUMERIC = { brightness: [1, 100], volume: [0, 100], target_temp: [5, 35] };
const BOOL_KEYS = ["on", "privacy", "siren", "locked", "muted", "power", "enabled", "recording", "motion_detection"];

const blank = { state: { type: "state", entity_id: "", key: "on", op: "changed", value: "" }, ring: { type: "ring", entity_id: "" },
  alarm: { type: "alarm", value: "triggered" }, time: { type: "time", value: "08:00" } };

// Editor "se questo → allora quello": funziona con qualunque entità, servizio HA, media o suoneria.
export default function AutomationEditor({ open, onClose, automation, defaults, title, onSaved }) {
  const { entities, scenes, settings } = useDomus();
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (!open) return;
    setForm(automation ? JSON.parse(JSON.stringify(automation))
      : { name: "", enabled: true, match: "any", triggers: [], conditions: [], actions: [], ...(defaults || {}) });
  }, [open, automation, defaults]);
  if (!open || !form) return null;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setRow = (list, i, patch) => set({ [list]: form[list].map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const delRow = (list, i) => set({ [list]: form[list].filter((_, j) => j !== i) });
  const addRow = (list, row) => set({ [list]: [...form[list], row] });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Dai un nome all'automazione");
    if (!form.triggers.length) return toast.error("Aggiungi almeno un evento (SE)");
    if (!form.actions.length) return toast.error("Aggiungi almeno un'azione (ALLORA)");
    try {
      const saved = automation ? await AutomationsAPI.update(automation.id, form) : await AutomationsAPI.create(form);
      toast.success(automation ? "Automazione aggiornata" : "Automazione creata");
      onSaved?.(saved);
      onClose();
    } catch (err) { toast.error(err?.response?.data?.detail || "Salvataggio non riuscito"); }
  };

  const entity = (id) => entities.find((e) => e.id === id);
  const stateKeys = (id) => Object.keys(entity(id)?.state || {}).filter((k) => !k.startsWith("has_") && !["effect_list", "source_list", "hvac_modes", "supported_features"].includes(k));

  return (
    <Modal open={open} onClose={onClose} title={title || (automation ? "Modifica automazione" : "Nuova automazione")}
      subtitle="Se accade questo, allora fai quello" icon={<Zap size={18} />} width="max-w-3xl" testid="automation-editor"
      footer={<button onClick={save} className="btn-acc px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="automation-save"><Save size={15} /> Salva</button>}>
      <div className="space-y-5">
        <div className="flex gap-2 items-center">
          <input className="field flex-1" placeholder="Nome (es. Suonano: accendi ingresso)" value={form.name} onChange={(e) => set({ name: e.target.value })} data-testid="automation-name" />
          <button onClick={() => set({ enabled: !form.enabled })} className={`chip ${form.enabled ? "chip-active" : ""}`} data-testid="automation-enabled">{form.enabled ? "Attiva" : "Disattivata"}</button>
        </div>

        <Section label="SE (eventi)" extra={
          <div className="flex gap-1">
            {TRIGGER_KINDS.map((t) => <button key={t.v} onClick={() => addRow("triggers", { ...blank[t.v] })} className="chip !py-1 !text-[11px]" data-testid={`add-trigger-${t.v}`}><Plus size={11} /> {t.l.split(" ")[0]}</button>)}
          </div>}>
          {form.triggers.map((t, i) => (
            <Row key={i} onDelete={() => delRow("triggers", i)} testid={`trigger-row-${i}`}>
              <span className="text-[11px] text-muted w-16 shrink-0">{TRIGGER_KINDS.find((k) => k.v === t.type)?.l.split(" ")[0]}</span>
              {t.type === "state" && <>
                <select className="field !py-1.5 flex-1 min-w-0" value={t.entity_id} onChange={(e) => setRow("triggers", i, { entity_id: e.target.value, key: stateKeys(e.target.value)[0] || "on" })} data-testid={`trigger-entity-${i}`}>
                  <option value="">Qualsiasi entità…</option>
                  {entities.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.type}</option>)}
                </select>
                <select className="field !py-1.5 !w-32" value={t.key} onChange={(e) => setRow("triggers", i, { key: e.target.value })} data-testid={`trigger-key-${i}`}>
                  {(stateKeys(t.entity_id).length ? stateKeys(t.entity_id) : ["on"]).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <select className="field !py-1.5 !w-28" value={t.op} onChange={(e) => setRow("triggers", i, { op: e.target.value })} data-testid={`trigger-op-${i}`}>
                  {OPS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                {!["changed", "on", "off"].includes(t.op) && <input className="field !py-1.5 !w-24" value={t.value ?? ""} onChange={(e) => setRow("triggers", i, { value: e.target.value })} placeholder="valore" data-testid={`trigger-value-${i}`} />}
              </>}
              {t.type === "ring" && (
                <select className="field !py-1.5 flex-1" value={t.entity_id} onChange={(e) => setRow("triggers", i, { entity_id: e.target.value })} data-testid={`trigger-ring-${i}`}>
                  <option value="">Qualsiasi citofono/campanello</option>
                  {entities.filter((e) => ["doorbell", "intercom"].includes(e.type)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}
              {t.type === "alarm" && (
                <select className="field !py-1.5 flex-1" value={t.value} onChange={(e) => setRow("triggers", i, { value: e.target.value })} data-testid={`trigger-alarm-${i}`}>
                  {ALARM_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
              {t.type === "time" && <input type="time" className="field !py-1.5 !w-32" value={t.value} onChange={(e) => setRow("triggers", i, { value: e.target.value })} data-testid={`trigger-time-${i}`} />}
            </Row>
          ))}
          {form.triggers.length > 1 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              Attiva quando
              <button onClick={() => set({ match: form.match === "all" ? "any" : "all" })} className="chip !py-0.5" data-testid="automation-match">{form.match === "all" ? "tutti gli eventi" : "almeno un evento"}</button>
            </div>
          )}
        </Section>

        <Section label="SOLO SE (condizioni facoltative)" extra={<button onClick={() => addRow("conditions", { entity_id: "", key: "on", op: "on", value: "" })} className="chip !py-1 !text-[11px]" data-testid="add-condition"><Plus size={11} /> Condizione</button>}>
          {form.conditions.map((c, i) => (
            <Row key={i} onDelete={() => delRow("conditions", i)} testid={`condition-row-${i}`}>
              <select className="field !py-1.5 flex-1 min-w-0" value={c.entity_id} onChange={(e) => setRow("conditions", i, { entity_id: e.target.value, key: stateKeys(e.target.value)[0] || "on" })} data-testid={`condition-entity-${i}`}>
                <option value="">Scegli entità…</option>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <select className="field !py-1.5 !w-32" value={c.key} onChange={(e) => setRow("conditions", i, { key: e.target.value })}>
                {(stateKeys(c.entity_id).length ? stateKeys(c.entity_id) : ["on"]).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <select className="field !py-1.5 !w-28" value={c.op} onChange={(e) => setRow("conditions", i, { op: e.target.value })}>
                {OPS.filter((o) => o.v !== "changed").map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              {!["on", "off"].includes(c.op) && <input className="field !py-1.5 !w-24" value={c.value ?? ""} onChange={(e) => setRow("conditions", i, { value: e.target.value })} placeholder="valore" />}
            </Row>
          ))}
        </Section>

        <Section label="ALLORA (azioni)" extra={
          <select className="field !py-1 !text-[11px] !w-44" value="" onChange={(e) => e.target.value && addRow("actions", { type: e.target.value })} data-testid="add-action">
            <option value="">+ Aggiungi azione…</option>
            {ACTION_KINDS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>}>
          {form.actions.map((a, i) => (
            <ActionRow key={i} action={a} index={i} entities={entities} scenes={scenes} customSounds={settings?.custom_sounds || []}
              onChange={(patch) => setRow("actions", i, patch)} onDelete={() => delRow("actions", i)} stateKeys={stateKeys} />
          ))}
        </Section>
      </div>
    </Modal>
  );
}

function Section({ label, extra, children }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="label">{label}</div>
        {extra}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ children, onDelete, testid }) {
  return (
    <div className="glass-inner rounded-2xl px-3 py-2 flex items-center gap-2 flex-wrap" data-testid={testid}>
      {children}
      <button onClick={onDelete} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted ml-auto shrink-0" data-testid={`${testid}-delete`}><Trash2 size={13} /></button>
    </div>
  );
}

export function ActionRow({ action: a, index: i, entities, scenes, customSounds, onChange, onDelete, stateKeys }) {
  const target = entities.find((e) => e.id === a.entity_id);
  const keys = (stateKeys ? stateKeys(a.entity_id) : Object.keys(target?.state || {})).filter((k) => BOOL_KEYS.includes(k) || k in NUMERIC || ["effect", "mode", "rgb"].includes(k));
  const patch = a.state || {};
  const setPatch = (p) => onChange({ state: { ...patch, ...p } });

  return (
    <Row onDelete={onDelete} testid={`action-row-${i}`}>
      <span className="text-[11px] text-muted w-16 shrink-0">{ACTION_KINDS.find((k) => k.v === a.type)?.l.split(" ")[0]}</span>

      {["entity", "pulse"].includes(a.type) && <>
        <select className="field !py-1.5 flex-1 min-w-0" value={a.entity_id || ""} onChange={(e) => onChange({ entity_id: e.target.value })} data-testid={`action-entity-${i}`}>
          <option value="">Scegli dispositivo…</option>
          {entities.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.type}</option>)}
        </select>
        {a.type === "pulse" && <input type="number" min="0.2" step="0.2" className="field !py-1.5 !w-20" value={a.seconds ?? 1.5} onChange={(e) => onChange({ seconds: parseFloat(e.target.value) })} title="secondi" data-testid={`action-seconds-${i}`} />}
        {a.type === "entity" && keys.map((k) => (
          BOOL_KEYS.includes(k) ? (
            <button key={k} onClick={() => setPatch({ [k]: !patch[k] })} className={`chip !py-1 ${k in patch ? "chip-active" : ""}`} data-testid={`action-key-${i}-${k}`}>{k}: {patch[k] ? "sì" : "no"}</button>
          ) : k === "effect" ? (
            <select key={k} className="field !py-1.5 !w-40" value={patch.effect || ""} onChange={(e) => setPatch({ effect: e.target.value })} data-testid={`action-effect-${i}`}>
              <option value="">effetto LED…</option>
              {(target?.state?.effect_list || []).map((fx) => <option key={fx} value={fx}>{fx}</option>)}
            </select>
          ) : k in NUMERIC ? (
            <input key={k} type="number" min={NUMERIC[k][0]} max={NUMERIC[k][1]} className="field !py-1.5 !w-24" placeholder={k}
              value={patch[k] ?? ""} onChange={(e) => setPatch({ [k]: e.target.value === "" ? undefined : Number(e.target.value) })} data-testid={`action-num-${i}-${k}`} />
          ) : null
        ))}
      </>}

      {a.type === "scene" && (
        <select className="field !py-1.5 flex-1" value={a.scene_id || ""} onChange={(e) => onChange({ scene_id: e.target.value })} data-testid={`action-scene-${i}`}>
          <option value="">Scegli scena…</option>
          {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {a.type === "service" && <>
        <input className="field !py-1.5 !w-44" placeholder="dominio.servizio" value={a.service || ""} onChange={(e) => onChange({ service: e.target.value })} data-testid={`action-service-${i}`} />
        <input className="field !py-1.5 flex-1 min-w-0" placeholder="entity_id HA (opzionale)" value={a.entity_id || ""} onChange={(e) => onChange({ entity_id: e.target.value })} data-testid={`action-service-entity-${i}`} />
      </>}

      {a.type === "media" && <>
        <select className="field !py-1.5 !w-32" value={a.media || "tts"} onChange={(e) => onChange({ media: e.target.value })} data-testid={`action-media-kind-${i}`}>
          <option value="tts">Annuncio</option><option value="notify">Notifica TV</option><option value="command">Comando</option><option value="cast">Trasmetti</option>
        </select>
        <select className="field !py-1.5 !w-40" value={a.entity_id || ""} onChange={(e) => onChange({ entity_id: e.target.value })} data-testid={`action-media-target-${i}`}>
          <option value="">Tutti i player</option>
          {entities.filter((e) => e.type === "media_player").map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {["tts", "notify"].includes(a.media || "tts") && <input className="field !py-1.5 flex-1 min-w-0" placeholder="Messaggio" value={a.message || ""} onChange={(e) => onChange({ message: e.target.value })} data-testid={`action-media-msg-${i}`} />}
        {a.media === "cast" && (
          <select className="field !py-1.5 flex-1" value={a.camera_id || ""} onChange={(e) => onChange({ cast_kind: "camera", camera_id: e.target.value })} data-testid={`action-cast-camera-${i}`}>
            <option value="">Telecamera da trasmettere…</option>
            {entities.filter((e) => ["camera", "doorbell"].includes(e.type)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
      </>}

      {a.type === "sound" && <>
        <select className="field !py-1.5 flex-1 min-w-0" value={a.sound || "chime"} onChange={(e) => onChange({ sound: e.target.value })} data-testid={`action-sound-${i}`}>
          <optgroup label="Suonerie">{RINGTONES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
          <optgroup label="Sirene">{SIRENS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
          {customSounds?.length > 0 && <optgroup label="I tuoi MP3">{customSounds.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
        </select>
        <input type="number" min="0" max="100" className="field !py-1.5 !w-20" value={a.volume ?? 70} onChange={(e) => onChange({ volume: Number(e.target.value) })} title="volume %" data-testid={`action-sound-volume-${i}`} />
        <input type="number" min="1" max="120" className="field !py-1.5 !w-20" value={a.duration ?? 6} onChange={(e) => onChange({ duration: Number(e.target.value) })} title="durata s" data-testid={`action-sound-duration-${i}`} />
        <button onMouseDown={() => playSound(a.sound || "chime", { volume: a.volume ?? 70, duration: Math.min(a.duration ?? 6, 4), custom: customSounds })}
          onMouseUp={stopSound} className="chip !py-1" data-testid={`action-sound-test-${i}`}><Volume2 size={12} /> Prova</button>
      </>}

      {a.type === "notify" && <>
        <select className="field !py-1.5 !w-28" value={a.level || "info"} onChange={(e) => onChange({ level: e.target.value })}><option value="info">Info</option><option value="warning">Attenzione</option><option value="error">Allarme</option></select>
        <input className="field !py-1.5 flex-1 min-w-0" placeholder="Testo notifica" value={a.message || ""} onChange={(e) => onChange({ message: e.target.value })} data-testid={`action-notify-${i}`} />
      </>}

      {a.type === "alarm" && (
        <select className="field !py-1.5 flex-1" value={a.mode || "away"} onChange={(e) => onChange({ mode: e.target.value })} data-testid={`action-alarm-${i}`}>
          {["disarmed", "home", "away", "night", "vacation", "custom"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      )}

      {a.type === "delay" && <input type="number" min="1" max="300" className="field !py-1.5 !w-24" value={a.seconds ?? 5} onChange={(e) => onChange({ seconds: Number(e.target.value) })} title="secondi" data-testid={`action-delay-${i}`} />}
    </Row>
  );
}

export { ACTION_KINDS, Row, Section };
export const TestRunButton = ({ id }) => (
  <button onClick={() => AutomationsAPI.run(id).then(() => toast.success("Automazione eseguita")).catch(() => toast.error("Esecuzione non riuscita"))}
    className="chip !py-1" data-testid={`automation-run-${id}`}><Play size={11} /> Prova</button>
);
