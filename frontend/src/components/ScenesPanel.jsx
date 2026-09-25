import { useState } from "react";
import { Plus, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useDomus } from "@/context/DomusContext";
import { iconFor } from "@/lib/icons";
import SceneEditor from "@/components/SceneEditor";

export default function ScenesPanel({ roomFilter }) {
  const { scenes, rooms, activateScene } = useDomus();
  const [editor, setEditor] = useState({ open: false, scene: null });
  const roomSelected = roomFilter && roomFilter !== "all" && roomFilter !== "unassigned";
  const global = scenes.filter((s) => !s.room_id);
  const roomScenes = roomSelected ? scenes.filter((s) => s.room_id === roomFilter) : scenes.filter((s) => s.room_id);
  const roomName = roomSelected ? rooms.find((r) => r.id === roomFilter)?.name : null;

  const run = async (s) => { await activateScene(s.id); toast.success(`Scena "${s.name}" attivata`); };
  const openNew = (roomId) => setEditor({ open: true, scene: null, defaultRoom: roomId || null });

  return (
    <div className="space-y-8" data-testid="scenes-panel">
      <Section title="Scene globali" hint="Impostano più luci in tutta la casa con un tocco." action={
        <button onClick={() => openNew(null)} className="chip btn-acc" data-testid="new-global-scene"><Plus size={13} /> Nuova scena</button>
      }>
        <Grid>{global.map((s) => <SceneCard key={s.id} scene={s} onActivate={() => run(s)} onEdit={() => setEditor({ open: true, scene: s })} />)}</Grid>
        {global.length === 0 && <Empty />}
      </Section>

      <Section title={roomName ? `Scene rapide · ${roomName}` : "Scene rapide per stanza"} hint={roomName ? "Scene dedicate a questa stanza." : "Seleziona una stanza dai filtri per vedere solo le sue scene."} action={
        <button onClick={() => openNew(roomSelected ? roomFilter : rooms[0]?.id)} className="chip" data-testid="new-room-scene"><Plus size={13} /> Scena stanza</button>
      }>
        <Grid>{roomScenes.map((s) => <SceneCard key={s.id} scene={s} roomName={rooms.find((r) => r.id === s.room_id)?.name} onActivate={() => run(s)} onEdit={() => setEditor({ open: true, scene: s })} />)}</Grid>
        {roomScenes.length === 0 && <Empty />}
      </Section>

      <SceneEditor open={editor.open} scene={editor.scene} defaultRoom={editor.defaultRoom} onClose={() => setEditor((e) => ({ ...e, open: false }))} />
    </div>
  );
}

function Section({ title, hint, action, children }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div><h2 className="font-display text-xl font-semibold">{title}</h2>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}
const Grid = ({ children }) => <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">{children}</div>;
const Empty = () => <div className="glass rounded-[24px] p-6 text-center text-sm text-muted">Nessuna scena. Creane una nuova.</div>;

function SceneCard({ scene, onActivate, onEdit, roomName }) {
  const Icon = iconFor(scene.icon, Sparkles);
  return (
    <div className="glass rounded-[24px] p-4 bubble relative" data-testid={`scene-card-${scene.id}`}>
      <button onClick={onActivate} className="w-full text-left" data-testid={`scene-activate-${scene.id}`}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${scene.color}33`, color: scene.color }}><Icon size={18} /></div>
        <div className="mt-3 font-semibold text-sm truncate">{scene.name}</div>
        <div className="text-[10px] text-muted">{scene.actions.length} luci{roomName ? ` · ${roomName}` : ""}</div>
      </button>
      <button onClick={onEdit} className="absolute top-3 right-3 btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted opacity-70 hover:opacity-100" data-testid={`scene-edit-${scene.id}`} aria-label="Modifica scena"><Pencil size={12} /></button>
    </div>
  );
}
