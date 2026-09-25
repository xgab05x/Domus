import { useEffect, useRef, useState } from "react";
import { HardDrive, Plus, RotateCcw, Trash2, Download, Upload, FolderOpen, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useDomus } from "@/context/DomusContext";
import { BackupsAPI } from "@/lib/api";

const AUTO = [{ k: "off", l: "Disattivato" }, { k: "hourly", l: "Ogni ora" }, { k: "daily", l: "Giornaliero" }, { k: "weekly", l: "Settimanale" }];
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Local backups on the mini PC: folder, schedule, retention, create / restore / download / import.
export default function BackupSettings() {
  const { settings, updateSettings, refresh, askPin } = useDomus();
  const [data, setData] = useState(null);
  const [dir, setDir] = useState(settings?.backup_dir || "");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);

  const load = async () => { try { setData(await BackupsAPI.list()); } catch { toast.error("Impossibile leggere i backup"); } };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveDir = async () => { if (dir.trim() && dir.trim() !== settings.backup_dir) { await updateSettings({ backup_dir: dir.trim() }); await load(); toast.success("Cartella backup aggiornata"); } };
  const create = async () => { setBusy("create"); try { const info = await BackupsAPI.create(label.trim() || undefined); setLabel(""); await load(); toast.success(`Backup creato: ${info.name}`); } catch (e) { toast.error(e?.response?.data?.detail || "Backup non riuscito"); } finally { setBusy(null); } };
  const restore = async (name) => {
    if (!window.confirm(`Ripristinare "${name}"?\nStanze, dispositivi, scene, gruppi, clima, consumi e viste verranno sostituiti con quelli del backup.`)) return;
    const { ok: pinOk, pin } = await askPin("config", "Ripristina backup");
    if (!pinOk) return;
    setBusy(name);
    try { const r = await BackupsAPI.restore(name, true, pin); await refresh(); toast.success(`Ripristinato: ${Object.entries(r.counts).map(([k, v]) => `${v} ${k}`).join(", ")}`); }
    catch (e) { toast.error(e?.response?.data?.detail || "Ripristino non riuscito"); } finally { setBusy(null); }
  };
  const remove = async (name) => { if (!window.confirm(`Eliminare il file ${name}?`)) return; await BackupsAPI.remove(name); await load(); toast.success("Backup eliminato"); };
  const upload = async (e, doRestore) => {
    const f = e.target.files?.[0]; if (!f) return;
    let pin = null;
    if (doRestore) {
      const res = await askPin("config", "Importa e ripristina backup");
      if (!res.ok) { e.target.value = ""; return; }
      pin = res.pin;
    }
    setBusy("upload");
    try { const r = await BackupsAPI.upload(f, doRestore, pin); await load(); if (doRestore) await refresh(); toast.success(doRestore ? `Importato e ripristinato: ${r.saved_as}` : `Importato: ${r.saved_as}`); }
    catch (err) { toast.error(err?.response?.data?.detail || "File non valido"); } finally { setBusy(null); e.target.value = ""; }
  };

  const ok = data?.dir?.writable;
  return (
    <div className="space-y-5" data-testid="backup-settings">
      <div className={`rounded-3xl p-4 flex items-center gap-3 ${ok ? "glass-inner" : "bg-amber-500/10 ring-1 ring-amber-400/40"}`} data-testid="backup-status">
        <div className={`icon-btn w-11 h-11 shrink-0 ${ok ? "icon-on" : "bg-amber-500/80 text-white"}`}>{ok ? <HardDrive size={20} /> : <AlertTriangle size={20} />}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{ok ? `${data.items.length} backup ${data.items.length === 1 ? "salvato" : "salvati"} in locale` : data ? "Cartella non scrivibile" : "Caricamento…"}</div>
          <div className="text-xs text-muted truncate font-mono">{data?.dir?.path}{data?.dir?.error ? ` · ${data.dir.error}` : ""}</div>
          {data?.last && <div className="text-[11px] text-muted">Ultimo backup: {new Date(data.last).toLocaleString("it-IT")}</div>}
        </div>
        <button onClick={load} className="chip shrink-0" data-testid="backup-refresh"><RefreshCw size={13} /></button>
      </div>

      <div>
        <div className="label mb-1.5">Cartella sul mini PC</div>
        <div className="flex gap-2">
          <div className="relative flex-1"><FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="field !pl-9 font-mono" value={dir} onChange={(e) => setDir(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveDir()} placeholder="/var/lib/domus/backups" data-testid="backup-dir-input" /></div>
          <button onClick={saveDir} className="btn-acc px-4 py-2 rounded-2xl text-sm font-semibold shrink-0" data-testid="backup-dir-save">Usa cartella</button>
        </div>
        <p className="text-[11px] text-muted mt-1.5">Puoi indicare anche un disco esterno o una cartella sincronizzata (es. <span className="font-mono">/mnt/usb/domus</span>, <span className="font-mono">~/Nextcloud/domus</span>).</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="label mb-1.5">Backup automatico</div>
          <div className="flex gap-1.5 flex-wrap">{AUTO.map((a) => <button key={a.k} onClick={() => updateSettings({ backup_auto: a.k }).then(() => toast.success("Pianificazione salvata"))} className={`chip ${settings?.backup_auto === a.k ? "chip-active" : ""}`} data-testid={`backup-auto-${a.k}`}>{a.l}</button>)}</div>
        </div>
        <div>
          <div className="label mb-1.5">Conserva gli ultimi automatici</div>
          <div className="flex items-center gap-2">
            <input type="number" min="1" max="200" className="field !w-24 font-mono" defaultValue={settings?.backup_retention ?? 10} onBlur={(e) => { const v = parseInt(e.target.value, 10); if (v > 0 && v !== settings.backup_retention) updateSettings({ backup_retention: v }).then(() => toast.success("Retention salvata")); }} data-testid="backup-retention-input" />
            <span className="text-xs text-muted">backup · i manuali non vengono mai cancellati</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input className="field !w-48" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etichetta (opzionale)" data-testid="backup-label-input" />
        <button onClick={create} disabled={busy === "create"} className="btn-acc px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50" data-testid="backup-create-btn"><Plus size={14} /> Crea backup ora</button>
        <button onClick={() => fileRef.current?.click()} disabled={busy === "upload"} className="chip" data-testid="backup-upload-btn"><Upload size={13} /> Importa file</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => upload(e, window.confirm("Ripristinare subito la configurazione contenuta nel file?\nOK = importa e ripristina · Annulla = importa soltanto"))} data-testid="backup-upload-input" />
      </div>

      <div className="space-y-1.5" data-testid="backup-list">
        {(data?.items || []).map((b) => (
          <div key={b.name} className="glass-inner rounded-2xl px-3 py-2.5 flex items-center gap-3" data-testid={`backup-item-${b.name}`}>
            {b.valid ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={15} className="text-amber-600 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate font-mono">{b.name}</div>
              <div className="text-[11px] text-muted">{new Date(b.created_at).toLocaleString("it-IT")} · {fmtSize(b.size)} · {b.counts?.entities ?? 0} dispositivi, {b.counts?.rooms ?? 0} stanze, {b.counts?.scenes ?? 0} scene{b.label === "auto" ? " · automatico" : b.label ? ` · ${b.label}` : ""}</div>
            </div>
            <button onClick={() => restore(b.name)} disabled={!b.valid || busy === b.name} className="chip !py-1 !text-[11px]" data-testid={`backup-restore-${b.name}`}><RotateCcw size={12} /> Ripristina</button>
            <a href={BackupsAPI.downloadUrl(b.name)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center" title="Scarica" data-testid={`backup-download-${b.name}`}><Download size={14} /></a>
            <button onClick={() => remove(b.name)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-rose-600" title="Elimina" data-testid={`backup-delete-${b.name}`}><Trash2 size={14} /></button>
          </div>
        ))}
        {data && data.items.length === 0 && <div className="text-xs text-muted text-center py-6" data-testid="backup-empty">Nessun backup ancora. Creane uno adesso o attendi quello automatico.</div>}
      </div>
      <p className="text-[11px] text-muted">Ogni backup contiene stanze, dispositivi e loro posizione, gruppi e placche, scene, termostati e zone clima, contatori e grafici, viste Terminus e impostazioni (escluso il token HA).</p>
    </div>
  );
}
