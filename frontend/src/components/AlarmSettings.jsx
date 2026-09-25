import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, Radar, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useDomus } from "@/context/DomusContext";
import { AlarmAPI } from "@/lib/api";

export const MODE_META = {
  disarmed: { l: "Disarmato", tone: "rgba(110,122,140,0.22)", fg: "inherit" },
  home: { l: "Armato Home", tone: "rgba(90,150,120,0.24)", fg: "#2f6b4f" },
  away: { l: "Armato Away", tone: "rgba(190,90,90,0.22)", fg: "#8f3b3b" },
  night: { l: "Armato Notte", tone: "rgba(110,120,190,0.22)", fg: "#43509b" },
  vacation: { l: "Vacanza", tone: "rgba(180,140,80,0.22)", fg: "#8a6a2e" },
  custom: { l: "Personalizzato", tone: "rgba(140,120,170,0.22)", fg: "#5f4a85" },
};
const ALL_MODES = Object.keys(MODE_META);
const HA_STATE_LABEL = { disarmed: "disarmato", armed_home: "armato home", armed_away: "armato away", armed_night: "armato notte", armed_vacation: "vacanza", armed_custom_bypass: "personalizzato", arming: "in armamento…", pending: "in attesa…", triggered: "IN ALLARME" };

// Settings tab: map the real HA alarm_control_panel, its modes and the Domus zones that belong to it.
export default function AlarmSettings() {
  const { settings, updateSettingsSecure, entities, ha } = useDomus();
  const [panels, setPanels] = useState([]);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const zones = entities.filter((e) => e.type === "alarm_zone");
  const selectedZones = settings?.alarm_zone_ids || [];
  const modes = settings?.alarm_modes || ["disarmed", "home", "away"];

  const load = useCallback(async () => {
    setLoading(true);
    try { setState(await AlarmAPI.state()); } catch { /* noop */ }
    try { setPanels(await AlarmAPI.panels()); } catch { setPanels([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (patch, msg = "Impostazioni salvate") => {
    const r = await updateSettingsSecure(patch, "Modifica configurazione allarme");
    if (r) { toast.success(msg); await load(); }
  };
  const panel = state?.panel;
  const toggleZone = (id) => {
    const base = selectedZones.length ? selectedZones : zones.map((z) => z.id);
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    save({ alarm_zone_ids: next.length === zones.length ? [] : next }, "Zone del pannello aggiornate");
  };

  return (
    <div className="space-y-6" data-testid="alarm-settings">
      <div className="glass-inner rounded-3xl p-4 flex items-start gap-3">
        <div className="icon-btn icon-on w-11 h-11 shrink-0"><ShieldCheck size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">{panel ? panel.name : ha?.connected ? "Nessun pannello selezionato" : "Home Assistant non connesso"}</div>
          <p className="text-xs text-muted mt-0.5">
            {panel ? <>Stato HA: <b>{HA_STATE_LABEL[panel.state] || panel.state}</b>{panel.changed_by ? ` · ultimo comando: ${panel.changed_by}` : ""}{panel.code_arm_required ? " · richiede codice" : ""}</>
              : "Collega Home Assistant e scegli l'entità alarm_control_panel per armare l'impianto reale."}
          </p>
        </div>
        <button onClick={load} className="chip shrink-0" data-testid="alarm-reload"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Aggiorna</button>
      </div>

      <div>
        <div className="label mb-1.5">Pannello Home Assistant</div>
        <select className="field" value={settings?.alarm_entity_id || ""} onChange={(e) => save({ alarm_entity_id: e.target.value }, "Pannello collegato")} data-testid="alarm-panel-select">
          <option value="">Nessuno (solo stato interno Domus)</option>
          {panels.map((p) => <option key={p.entity_id} value={p.entity_id}>{p.name} · {p.entity_id}</option>)}
          {settings?.alarm_entity_id && !panels.some((p) => p.entity_id === settings.alarm_entity_id) && <option value={settings.alarm_entity_id}>{settings.alarm_entity_id}</option>}
        </select>
        {!ha?.connected && <p className="text-[11px] text-muted mt-1.5">L'elenco si popola quando Home Assistant è connesso (tab Home Assistant).</p>}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="label">Modalità mostrate in Terminus</div>
          {panel?.supported_modes?.length > 0 && <button onClick={() => save({ alarm_modes: panel.supported_modes }, "Modalità sincronizzate dal pannello")} className="chip !py-1" data-testid="alarm-sync-modes">Usa quelle del pannello</button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {ALL_MODES.map((m) => {
            const active = modes.includes(m);
            const supported = !panel?.supported_modes || panel.supported_modes.includes(m);
            return (
              <button key={m} onClick={() => save({ alarm_modes: active ? modes.filter((x) => x !== m) : [...modes, m] }, "Modalità aggiornate")}
                className={`chip ${active ? "chip-active" : ""} ${supported ? "" : "opacity-50"}`} data-testid={`alarm-mode-${m}`} title={supported ? "" : "Non supportata dal pannello HA"}>
                {MODE_META[m].l}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="label mb-1.5">Codice del pannello HA</div>
        <button onClick={() => save({ alarm_use_pin_as_code: !(settings?.alarm_use_pin_as_code !== false) }, "Codice pannello aggiornato")} className="w-full glass-inner rounded-2xl px-4 py-3 flex items-center justify-between gap-3 press" data-testid="alarm-use-pin">
          <span className="text-sm flex items-center gap-2"><KeyRound size={15} /> Usa il PIN Domus come codice HA<span className="block text-[11px] text-muted mt-0.5">Il PIN inserito al disarmo viene passato al servizio alarm_control_panel</span></span>
          <span className={`toggle shrink-0 ${settings?.alarm_use_pin_as_code !== false ? "on" : ""}`} />
        </button>
        <input className="field mt-2 font-mono" type="password" placeholder={settings?.alarm_code_set ? "codice HA salvato · scrivi per sostituirlo" : "codice HA dedicato (opzionale)"}
          onBlur={(e) => e.target.value && save({ alarm_ha_code: e.target.value }, "Codice HA salvato")} data-testid="alarm-ha-code" />
      </div>

      <div>
        <div className="label mb-1.5 flex items-center gap-1.5"><Radar size={12} /> Zone appartenenti al pannello ({selectedZones.length || zones.length}/{zones.length})</div>
        <div className="grid sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
          {zones.map((z) => {
            const on = !selectedZones.length || selectedZones.includes(z.id);
            return (
              <button key={z.id} onClick={() => toggleZone(z.id)} className={`glass-inner rounded-2xl px-3 py-2 text-left text-sm flex items-center justify-between gap-2 press ${on ? "ring-1 ring-[rgb(var(--acc)/0.45)]" : "opacity-60"}`} data-testid={`alarm-zone-${z.id}`}>
                <span className="truncate">{z.name}</span>
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${on ? "bg-[rgb(var(--acc-strong))]" : "bg-slate-400/40"}`} />
              </button>
            );
          })}
          {zones.length === 0 && <div className="text-xs text-muted">Nessuna zona disponibile.</div>}
        </div>
        <p className="text-[11px] text-muted mt-1.5">Tutte selezionate = nessun filtro. Le zone escluse restano visibili in Terminus ma non nel pannello allarme.</p>
      </div>
    </div>
  );
}
