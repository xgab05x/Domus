import { useState } from "react";
import { Link2, LayoutGrid, Pencil, Palette, AlertTriangle } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { iconFor } from "@/lib/icons";
import LightEditor from "@/components/LightEditor";

export default function GroupBubble({ group, onEdit }) {
  const { entities, toggleGroup, updateEntity } = useDomus();
  const [editing, setEditing] = useState(null);
  const members = group.members.map((id) => entities.find((e) => e.id === id)).filter(Boolean);
  const offline = members.filter((m) => m.available === false).length;
  const Icon = iconFor(group.icon, group.kind === "panel" ? LayoutGrid : Link2);
  const OfflineBadge = offline > 0 ? <span className="badge !bg-amber-500/20 !text-amber-800 dark:!text-amber-200 inline-flex items-center gap-1" data-testid={`group-offline-${group.id}`}><AlertTriangle size={9} /> {offline} offline</span> : null;

  if (group.kind === "panel") {
    return (
      <div className={`glass rounded-[28px] p-4 bubble sm:col-span-2 ${offline ? "ring-1 ring-amber-400/60" : ""}`} data-testid={`group-bubble-${group.id}`}>
        <div className="flex items-start gap-3">
          <div className="icon-btn icon-on w-11 h-11 shrink-0"><Icon size={19} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{group.name}</div>
            <div className="label mt-0.5 flex items-center gap-1.5">Placca · {members.length} tasti {OfflineBadge}</div>
          </div>
          <button onClick={onEdit} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted" data-testid={`group-edit-${group.id}`} aria-label="Modifica gruppo"><Pencil size={13} /></button>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {members.map((m) => {
            const MIcon = iconFor(m.icon);
            const on = !!m.state?.on;
            const editable = m.type === "light" && (m.state?.supports_color || m.state?.supports_dimming);
            const off = m.available === false;
            return (
              <div key={m.id} className={`relative rounded-2xl transition-colors ${on ? "icon-on" : "glass-inner"} ${off ? "ring-1 ring-amber-400/60" : ""}`}>
                <button onClick={() => updateEntity(m.id, { state: { on: !on } })} data-testid={`panel-btn-${group.id}-${m.id}`} className="w-full text-left p-3">
                  <MIcon size={16} />
                  <div className="text-[11px] font-semibold mt-2 leading-tight line-clamp-2">{m.name}</div>
                  <div className="text-[10px] opacity-70 mt-0.5 flex items-center gap-1">{off && <AlertTriangle size={9} className="text-amber-600" />}{off ? "offline" : on ? "acceso" : "spento"}</div>
                </button>
                {editable && (
                  <button onClick={() => setEditing(m)} className="absolute top-2 right-2 w-6 h-6 rounded-full btn-ghost flex items-center justify-center" data-testid={`panel-edit-${group.id}-${m.id}`} aria-label="Dimmer e colore"><Palette size={11} /></button>
                )}
              </div>
            );
          })}
        </div>
        <LightEditor entity={editing ? entities.find((e) => e.id === editing.id) : null} open={!!editing} onClose={() => setEditing(null)} />
      </div>
    );
  }

  const primary = entities.find((e) => e.id === group.primary_id) || members[0];
  const on = !!primary?.state?.on;
  return (
    <div className={`glass rounded-[28px] p-4 bubble ${offline ? "ring-1 ring-amber-400/60" : ""}`} data-testid={`group-bubble-${group.id}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => toggleGroup(group.id)} className={`icon-btn w-11 h-11 shrink-0 ${on ? "icon-on" : "icon-off"}`} data-testid={`group-toggle-${group.id}`} aria-pressed={on}>
          <Icon size={19} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{group.name}</div>
          <div className="label mt-0.5 flex items-center gap-1.5 flex-wrap"><Link2 size={10} /> {members.length} dispositivi collegati {OfflineBadge}</div>
        </div>
        <button onClick={onEdit} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted" data-testid={`group-edit-${group.id}`} aria-label="Modifica gruppo"><Pencil size={13} /></button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {members.map((m) => (
          <span key={m.id} className={`text-[10px] px-2 py-0.5 rounded-full ${m.state?.on ? "bg-acc-soft text-acc" : "glass-inner text-muted"}`} data-testid={`group-member-${group.id}-${m.id}`}>{m.name}</span>
        ))}
      </div>
    </div>
  );
}
