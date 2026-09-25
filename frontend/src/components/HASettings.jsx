import { useState } from "react";
import { Cpu, Plug, RefreshCw, Download, CheckCircle2, XCircle, Eye, EyeOff, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useDomus } from "@/context/DomusContext";
import { HAAPI } from "@/lib/api";

// Home Assistant connection: URL + long-lived token, test, import of all entities. Falls back to demo mode when unreachable.
export default function HASettings() {
  const { settings, ha, setHa, refresh, updateSettings } = useDomus();
  const [url, setUrl] = useState(settings?.ha_url || "http://localhost:8123");
  const [token, setToken] = useState("");
  const [showTok, setShowTok] = useState(false);
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [states, setStates] = useState(null);

  const save = async (enabled) => {
    setBusy("save");
    try {
      const r = await HAAPI.config({ ha_url: url.trim(), ha_token: token.trim() || undefined, ha_enabled: enabled ?? settings.ha_enabled });
      setHa(r.ha); setToken("");
      await refresh();
      toast[r.ha.connected ? "success" : "warning"](r.ha.connected ? `Connesso a Home Assistant ${r.ha.version}` : `Salvato · HA non raggiungibile, resto in demo`);
    } finally { setBusy(null); }
  };
  const check = async () => { setBusy("check"); try { const st = await HAAPI.check(); setHa(st); toast[st.connected ? "success" : "warning"](st.connected ? "Home Assistant risponde" : `Non raggiungibile: ${st.last_error || "disabilitato"}`); } finally { setBusy(null); } };
  const doImport = async () => {
    setBusy("import");
    try { const r = await HAAPI.import(); setResult(r); await refresh(); toast.success(`Importate ${r.created} nuove entità, ${r.updated} aggiornate`); }
    catch (e) { toast.error(e?.response?.data?.detail || "Import non riuscito"); }
    finally { setBusy(null); }
  };
  const loadStates = async () => { try { setStates(await HAAPI.states(300)); } catch (e) { toast.error(e?.response?.data?.detail || "HA non connesso"); } };

  const connected = !!ha?.connected;
  return (
    <div className="space-y-5" data-testid="ha-settings">
      <div className={`rounded-3xl p-4 flex items-center gap-3 ${connected ? "bg-emerald-500/10 ring-1 ring-emerald-400/40" : "glass-inner"}`} data-testid="ha-status-card">
        <div className={`icon-btn w-11 h-11 shrink-0 ${connected ? "bg-emerald-500/80 text-white" : "icon-off"}`}>{connected ? <CheckCircle2 size={20} /> : <Plug size={20} />}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm" data-testid="ha-status-label">{connected ? `Connesso · Home Assistant ${ha.version || ""}` : settings?.ha_enabled ? "Non raggiungibile · modalità Demo" : "Disattivato · modalità Demo"}</div>
          <div className="text-xs text-muted truncate">{connected ? `${ha.location_name || ""} · ${ha.entity_count} entità · ${ha.events_received} eventi live` : ha?.last_error || "Inserisci URL e token, poi attiva la connessione."}</div>
        </div>
        <button onClick={check} disabled={busy === "check"} className="chip shrink-0" data-testid="ha-check-btn"><RefreshCw size={13} className={busy === "check" ? "animate-spin" : ""} /> Testa</button>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="block"><div className="label mb-1.5">URL di Home Assistant</div>
          <input className="field font-mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:8123" data-testid="ha-url-input" /></label>
        <label className="block"><div className="label mb-1.5">&nbsp;</div>
          <button onClick={() => updateSettings({ ha_import_rooms: !settings.ha_import_rooms })} className={`chip !py-2.5 ${settings?.ha_import_rooms ? "chip-active" : ""}`} data-testid="ha-import-rooms">Crea stanze dalle aree HA</button></label>
      </div>
      <label className="block"><div className="label mb-1.5">Long-Lived Access Token {settings?.ha_token_set && <span className="normal-case tracking-normal font-normal text-emerald-700 dark:text-emerald-300">· token salvato</span>}</div>
        <div className="relative">
          <input type={showTok ? "text" : "password"} className="field font-mono !pr-10" value={token} onChange={(e) => setToken(e.target.value)} placeholder={settings?.ha_token_set ? "•••••••• (lascia vuoto per non cambiare)" : "Profilo HA → Sicurezza → Token di accesso a lunga durata"} data-testid="ha-token-input" autoComplete="off" />
          <button onClick={() => setShowTok((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost w-8 h-8 rounded-full flex items-center justify-center" aria-label="Mostra token">{showTok ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        </div>
        <p className="text-[11px] text-muted mt-1.5">Il token resta sul server Domus e non viene mai inviato al browser. Sul mini PC usa <span className="font-mono">http://localhost:8123</span>.</p>
      </label>
      <label className="block"><div className="label mb-1.5">Entità TTS (opzionale)</div>
        <input className="field font-mono" defaultValue={settings?.tts_entity || ""} onBlur={(e) => e.target.value !== settings?.tts_entity && updateSettings({ tts_entity: e.target.value.trim() }).then(() => toast.success("TTS salvato"))} placeholder="tts.google_translate_it_it · per gli annunci vocali via tts.speak" data-testid="ha-tts-input" /></label>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => save(true)} disabled={busy === "save"} className="btn-acc px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" data-testid="ha-connect-btn"><Link2 size={14} /> {settings?.ha_enabled ? "Salva e riconnetti" : "Salva e collega"}</button>
        {settings?.ha_enabled && <button onClick={() => save(false)} className="chip" data-testid="ha-disable-btn">Passa a Demo</button>}
        {settings?.ha_token_set && <button onClick={async () => { if (!window.confirm("Rimuovere il token salvato? Domus tornerà in modalità demo.")) return; const r = await HAAPI.config({ ha_token_clear: true }); setHa(r.ha); await refresh(); toast.success("Token rimosso"); }} className="chip" data-testid="ha-clear-token-btn">Rimuovi token</button>}
        <button onClick={doImport} disabled={!connected || busy === "import"} className="chip disabled:opacity-50" data-testid="ha-import-btn"><Download size={13} className={busy === "import" ? "animate-bounce" : ""} /> Importa tutte le entità</button>
        <button onClick={loadStates} disabled={!connected} className="chip disabled:opacity-50" data-testid="ha-states-btn"><Cpu size={13} /> Vedi entità HA</button>
      </div>
      {result && <div className="glass-inner rounded-2xl p-3 text-xs" data-testid="ha-import-result">Import: <b>{result.created}</b> nuove · <b>{result.updated}</b> aggiornate · {result.total_mapped}/{result.ha_states} stati mappati · aree: {result.areas.join(", ") || "—"}</div>}
      {states && (
        <div className="max-h-56 overflow-y-auto glass-inner rounded-2xl p-2 space-y-0.5" data-testid="ha-states-list">
          {states.map((s) => <div key={s.entity_id} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded-lg hover:bg-white/40 dark:hover:bg-white/5">{s.linked ? <CheckCircle2 size={11} className="text-emerald-600 shrink-0" /> : <XCircle size={11} className="text-muted shrink-0" />}<span className="font-mono truncate flex-1">{s.entity_id}</span><span className="text-muted truncate max-w-[40%]">{s.name}</span><span className="font-mono">{s.state}</span></div>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {["Sonoff eWeLink", "Tuya Smart Life", "TP-Link Tapo", "Blink", "Alexa Media Player", "Android TV / Cast"].map((n) => (
          <div key={n} className="glass-inner rounded-2xl px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium">{n}</span>
            <span className={`label flex items-center gap-1 ${connected ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}`}><span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} /> {connected ? "via HA" : "demo"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
