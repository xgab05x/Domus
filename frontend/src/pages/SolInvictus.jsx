import { useMemo, useState } from "react";
import { useDomus } from "@/context/DomusContext";
import DeviceBubble from "@/components/DeviceBubble";
import UnassignedDrawer from "@/components/UnassignedDrawer";
import RoomManagerDialog from "@/components/RoomManagerDialog";
import { Plus, Home, Grid3x3, Sparkles } from "lucide-react";

const CONTROLLABLE = new Set(["light", "plug", "thermostat"]);
const SCENE_TYPES = new Set(["scene", "automation"]);

export default function SolInvictus() {
  const { rooms, entities, discovered, phase, settings } = useDomus();
  const [filter, setFilter] = useState("all");
  const [roomMgrOpen, setRoomMgrOpen] = useState(false);
  const [unassOpen, setUnassOpen] = useState(false);

  const scenes = entities.filter((e) => SCENE_TYPES.has(e.type));
  const deviceEntities = entities.filter((e) => CONTROLLABLE.has(e.type));

  const filtered = useMemo(() => {
    if (filter === "all") return deviceEntities;
    if (filter === "unassigned") return deviceEntities.filter((e) => !e.room_id);
    return deviceEntities.filter((e) => e.room_id === filter);
  }, [filter, deviceEntities]);

  const totalOn = deviceEntities.filter((e) => e.state?.on).length;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass rounded-3xl p-6 md:col-span-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs uppercase tracking-widest font-semibold">
            <Sparkles size={14} />
            Sol Invictus
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-2">
            Ciao, <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">luce</span> in {settings?.home_name || "casa"}.
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-3 max-w-xl">
            Controlla luci, prese, scene e automazioni. L'ambiente cambia con il sole — ora è <b>{phase.phase}</b>.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="glass rounded-3xl p-5 flex flex-col justify-between" data-testid="stat-on">
            <div className="text-xs uppercase tracking-widest text-slate-500">Attivi</div>
            <div className="font-display text-4xl font-extrabold">{totalOn}</div>
            <div className="text-xs text-slate-500">dispositivi accesi</div>
          </div>
          <div className="glass rounded-3xl p-5 flex flex-col justify-between" data-testid="stat-rooms">
            <div className="text-xs uppercase tracking-widest text-slate-500">Stanze</div>
            <div className="font-display text-4xl font-extrabold">{rooms.length}</div>
            <div className="text-xs text-slate-500">gestite in Domus</div>
          </div>
        </div>
      </div>

      {/* Scenes */}
      {scenes.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold mb-3">Scene & Automazioni</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {scenes.map((e) => (
              <DeviceBubble key={e.id} entity={e} />
            ))}
          </div>
        </section>
      )}

      {/* Room filters */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-display text-xl font-bold">Dispositivi</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {discovered.length > 0 && (
              <button
                data-testid="open-unassigned-btn"
                onClick={() => setUnassOpen(true)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500 text-white shadow-md hover:shadow-lg transition"
              >
                {discovered.length} nuovi rilevati
              </button>
            )}
            <button
              data-testid="open-room-manager-btn"
              onClick={() => setRoomMgrOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700 border border-white/40 dark:border-white/10 flex items-center gap-1"
            >
              <Plus size={13} /> Gestisci stanze
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-5" data-testid="room-filter">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")} icon={<Grid3x3 size={13} />} label="Tutte" color="#f59e0b" testid="filter-all" />
          {rooms.map((r) => (
            <FilterPill
              key={r.id}
              active={filter === r.id}
              onClick={() => setFilter(r.id)}
              label={r.name}
              color={r.color}
              testid={`filter-${r.id}`}
            />
          ))}
          <FilterPill
            active={filter === "unassigned"}
            onClick={() => setFilter("unassigned")}
            icon={<Home size={13} />}
            label="Non assegnate"
            color="#64748b"
            testid="filter-unassigned"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-slate-500" data-testid="empty-devices">
            Nessun dispositivo in questa vista.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="devices-grid">
            {filtered.map((e) => (
              <DeviceBubble key={e.id} entity={e} />
            ))}
          </div>
        )}
      </section>

      <RoomManagerDialog open={roomMgrOpen} onOpenChange={setRoomMgrOpen} />
      <UnassignedDrawer open={unassOpen} onOpenChange={setUnassOpen} />
    </div>
  );
}

function FilterPill({ active, onClick, label, color, icon, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
        active
          ? "text-white shadow-md scale-[1.03] border-transparent"
          : "bg-white/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 border-white/40 dark:border-white/10"
      }`}
      style={active ? { background: color } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}
