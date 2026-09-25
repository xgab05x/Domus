import { useMemo, useState } from "react";
import { Plus, Home, Grid3x3, Sun, Lightbulb, Thermometer, Sparkles, Link2, Zap, Tv, ScrollText } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import DeviceBubble from "@/components/DeviceBubble";
import GroupBubble from "@/components/GroupBubble";
import GroupEditor from "@/components/GroupEditor";
import UnassignedDrawer from "@/components/UnassignedDrawer";
import RoomManagerDialog from "@/components/RoomManagerDialog";
import ScenesPanel from "@/components/ScenesPanel";
import ClimatePanel from "@/components/ClimatePanel";
import EnergyPanel from "@/components/EnergyPanel";
import MediaPanel from "@/components/MediaPanel";
import LogsSection from "@/components/LogsSection";
import AutomationsPanel from "@/components/AutomationsPanel";
import BannerArt from "@/components/BannerArt";
import { BrandLogo } from "@/components/BrandMedia";
import { PHASE_LABEL } from "@/lib/solar";
import { iconFor } from "@/lib/icons";

const CONTROLLABLE = new Set(["light", "plug", "switch", "meter", "thermostat", "sensor"]);
const TABS = [{ k: "devices", l: "Dispositivi", I: Lightbulb }, { k: "climate", l: "Clima", I: Thermometer }, { k: "energy", l: "Consumi", I: Zap }, { k: "media", l: "Media", I: Tv }, { k: "scenes", l: "Scene", I: Sparkles }, { k: "logs", l: "Log", I: ScrollText }];
const WEATHER_LABEL = { clear: "sereno", clouds: "nuvoloso", rain: "pioggia", snow: "neve", fog: "nebbia", storm: "temporale" };
const GREETING = { dawn: "Buongiorno", day: "Buona giornata", sunset: "Buonasera", night: "Buonanotte" };

export default function SolInvictus() {
  const { rooms, entities, discovered, groups, thermostats, phase, settings, weather, energy } = useDomus();
  const [tab, setTab] = useState("devices");
  const [filter, setFilter] = useState("all");
  const [roomMgrOpen, setRoomMgrOpen] = useState(false);
  const [unassOpen, setUnassOpen] = useState(false);
  const [groupEditor, setGroupEditor] = useState({ open: false, id: null });

  const devices = useMemo(() => entities.filter((e) => CONTROLLABLE.has(e.type)), [entities]);
  const automations = entities.filter((e) => e.type === "automation");
  const matchRoom = (rid) => filter === "all" || (filter === "unassigned" ? !rid : rid === filter);

  const items = useMemo(() => {
    const hidden = new Set();
    groups.forEach((g) => {
      if ((g.kind === "panel" && g.hide_members) || (g.kind === "sync" && g.display === "group_only")) g.members.forEach((m) => hidden.add(m));
    });
    const gs = groups.filter((g) => (g.kind === "panel" || g.display !== "members_only") && matchRoom(g.room_id)).map((g) => ({ kind: "group", g }));
    const es = devices.filter((e) => !hidden.has(e.id) && matchRoom(e.room_id)).map((e) => ({ kind: "entity", e }));
    return [...gs, ...es];
  }, [groups, devices, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalOn = devices.filter((e) => e.state?.on).length;
  const climateOn = thermostats.filter((t) => t.on).length;

  return (
    <div className="space-y-8 fade-in">
      <div className="grid lg:grid-cols-[3fr_2fr] gap-4 items-stretch" data-testid="sol-hero">
        <BannerArt name="sol" />
        <div className="glass rounded-[28px] p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start gap-4">
            <BrandLogo name="sol" size={72} className="shrink-0 drop-shadow-md" testid="brand-logo-sol" fallback={<div className="icon-btn icon-on w-14 h-14 shrink-0"><Sun size={26} /></div>} />
            <div className="min-w-0">
              <div className="label text-acc">Sol Invictus</div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-1 leading-tight">{GREETING[phase.phase]}, {settings?.home_name || "casa"}.</h1>
              <p className="text-sm text-muted mt-2">
                {PHASE_LABEL[phase.phase]}{weather ? ` · ${WEATHER_LABEL[weather.condition] || weather.condition}${weather.temperature != null ? `, ${Math.round(weather.temperature)}°C fuori` : ""}` : ""}. Luci, clima, consumi e scene in un unico posto.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Accesi" value={totalOn} hint="dispositivi" testid="stat-on" />
            <Stat label="Stanze" value={rooms.length} hint="gestite" testid="stat-rooms" />
            <Stat label="Clima" value={climateOn} hint="termostati attivi" testid="stat-climate" />
            <Stat label="Potenza" value={energy ? `${Math.round(energy.total_power_w)}` : "--"} hint="watt istantanei" testid="stat-power" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-full glass" data-testid="sol-tabs">
          {TABS.map(({ k, l, I }) => <button key={k} onClick={() => setTab(k)} className={`chip !py-2 ${tab === k ? "chip-active" : "!bg-transparent !border-transparent"}`} data-testid={`tab-${k}`} title={l}><I size={14} /> <span className={tab === k ? "" : "hidden sm:inline"}>{l}</span></button>)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {discovered.length > 0 && <button data-testid="open-unassigned-btn" onClick={() => setUnassOpen(true)} className="chip btn-acc"><Zap size={13} /> {discovered.length} nuovi rilevati</button>}
          <button data-testid="open-group-editor-btn" onClick={() => setGroupEditor({ open: true, id: null })} className="chip"><Link2 size={13} /> Gruppi e placche</button>
          <button data-testid="open-room-manager-btn" onClick={() => setRoomMgrOpen(true)} className="chip"><Plus size={13} /> Stanze</button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap" data-testid="room-filter">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")} icon={<Grid3x3 size={13} />} label="Tutte" testid="filter-all" />
        {rooms.map((r) => { const RI = iconFor(r.icon, Home); return <FilterPill key={r.id} active={filter === r.id} onClick={() => setFilter(r.id)} label={r.name} color={r.color} icon={<RI size={13} />} testid={`filter-${r.id}`} />; })}
        <FilterPill active={filter === "unassigned"} onClick={() => setFilter("unassigned")} icon={<Home size={13} />} label="Non assegnate" testid="filter-unassigned" />
      </div>

      {tab === "devices" && (
        <section className="space-y-8">
          {items.length === 0 ? (
            <div className="glass rounded-[28px] p-10 text-center text-muted" data-testid="empty-devices">Nessun dispositivo in questa vista.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger" data-testid="devices-grid">
              {items.map((it) => it.kind === "group"
                ? <GroupBubble key={`g-${it.g.id}`} group={it.g} onEdit={() => setGroupEditor({ open: true, id: it.g.id })} />
                : <DeviceBubble key={it.e.id} entity={it.e} />)}
            </div>
          )}
          {automations.length > 0 && filter === "all" && (
            <div>
              <h2 className="font-display text-xl font-semibold mb-3">Automazioni</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{automations.map((e) => <DeviceBubble key={e.id} entity={e} />)}</div>
            </div>
          )}
        </section>
      )}
      {tab === "climate" && <ClimatePanel roomFilter={filter} />}
      {tab === "energy" && <EnergyPanel roomFilter={filter} />}
      {tab === "media" && <MediaPanel roomFilter={filter} />}
      {tab === "scenes" && (
        <div className="space-y-5">
          <ScenesPanel roomFilter={filter} />
          <div className="glass rounded-[28px] p-6"><AutomationsPanel /></div>
        </div>
      )}
      {tab === "logs" && (
        <div className="glass rounded-[28px] p-6" data-testid="logs-panel">
          <div className="label text-acc">Registro attività</div>
          <h3 className="font-display text-lg font-semibold mb-4">Cosa è successo in casa</h3>
          <LogsSection />
        </div>
      )}

      <RoomManagerDialog open={roomMgrOpen} onOpenChange={setRoomMgrOpen} />
      <UnassignedDrawer open={unassOpen} onOpenChange={setUnassOpen} />
      <GroupEditor open={groupEditor.open} initialId={groupEditor.id} onClose={() => setGroupEditor((g) => ({ ...g, open: false }))} />
    </div>
  );
}

function Stat({ label, value, hint, testid }) {
  return (
    <div className="glass-inner rounded-2xl p-3" data-testid={testid}>
      <div className="label">{label}</div>
      <div className="font-display text-3xl font-semibold leading-tight mt-1">{value}</div>
      <div className="text-[10px] text-muted">{hint}</div>
    </div>
  );
}

function FilterPill({ active, onClick, label, color, icon, testid }) {
  return (
    <button data-testid={testid} onClick={onClick} className={`chip ${active ? "chip-active" : ""}`}>
      {icon}{color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}{label}
    </button>
  );
}
