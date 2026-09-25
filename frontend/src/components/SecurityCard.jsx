import { BatteryMedium, Wifi, Clock, AlertTriangle } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { iconFor } from "@/lib/icons";
import { KIND_ICON, KIND_SHORT, zoneStatus, TONE, batteryTone, fmtTime } from "@/lib/security";

// Card for an alarm zone / environmental sensor. Full name always visible (wraps up to 2 lines).
export default function SecurityCard({ entity, compact = false, onOpen }) {
  const { rooms, updateEntity } = useDomus();
  const s = entity.state || {};
  const isZone = entity.type === "alarm_zone";
  const kind = s.kind || "contact";
  const Icon = iconFor(entity.icon, KIND_ICON[kind] || KIND_ICON.contact);
  const st = isZone ? zoneStatus(entity) : sensorStatus(entity);
  const room = rooms.find((r) => r.id === entity.room_id);
  const offline = entity.available === false;

  return (
    <div
      role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen?.()}
      className={`text-left w-full rounded-2xl ${compact ? "p-3" : "p-4"} bubble transition-colors cursor-pointer ${s.triggered ? "bg-rose-500/10 ring-1 ring-rose-400/50" : "glass-inner hover:bg-white/55 dark:hover:bg-white/10"} ${offline ? "ring-1 ring-amber-400/60" : ""}`}
      data-testid={`security-card-${entity.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`icon-btn ${compact ? "w-9 h-9" : "w-11 h-11"} shrink-0 ${s.triggered ? "bg-rose-500/80 text-white" : "icon-on"}`}><Icon size={compact ? 15 : 18} /></div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold ${compact ? "text-sm" : "text-[15px]"} leading-snug break-words line-clamp-2`} title={entity.name} data-testid={`security-name-${entity.id}`}>{entity.name}</div>
          <div className="label mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{isZone ? KIND_SHORT[kind] || kind : "sensore"}</span>
            {room && <><span className="opacity-40">·</span><span>{room.name}</span></>}
            <span className="opacity-40">·</span><span>{entity.integration}</span>
          </div>
        </div>
        <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${TONE[st.tone]}`} data-testid={`security-status-${entity.id}`}>{st.label}</span>
      </div>
      {!compact && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {s.battery != null && <Chip tone={batteryTone(s.battery)} icon={<BatteryMedium size={11} />} testid={`security-battery-${entity.id}`}>{Math.round(s.battery)}%</Chip>}
          {s.signal != null && <Chip tone={s.signal < 50 ? "amber" : "slate"} icon={<Wifi size={11} />}>{Math.round(s.signal)}%</Chip>}
          {(s.last_triggered || s.last_motion) && <Chip tone="slate" icon={<Clock size={11} />}>{fmtTime(s.last_triggered || s.last_motion)}</Chip>}
          {offline && <Chip tone="amber" icon={<AlertTriangle size={11} />}>offline</Chip>}
          {isZone && (
            <button onClick={() => updateEntity(entity.id, { state: { bypass: !s.bypass } })} className={`ml-auto chip !py-0.5 !px-2 !text-[10px] ${s.bypass ? "chip-active" : ""}`} data-testid={`zone-bypass-${entity.id}`}>
              {s.bypass ? "bypass" : "attiva"}
            </button>
          )}
          {!isZone && (s.temperature != null || s.humidity != null) && (
            <span className="ml-auto text-xs font-mono text-muted">{s.temperature != null ? `${Number(s.temperature).toFixed(1)}°` : ""}{s.humidity != null ? ` · ${s.humidity}%` : ""}</span>
          )}
        </div>
      )}
    </div>
  );
}

function sensorStatus(e) {
  const s = e.state || {};
  if (e.available === false) return { label: "Offline", tone: "amber" };
  if (s.on === true) return { label: "Attivo", tone: "rose" };
  if (s.temperature != null) return { label: `${Number(s.temperature).toFixed(1)}°`, tone: "acc" };
  return { label: "Ok", tone: "emerald" };
}

export function Chip({ tone = "slate", icon, children, testid }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${TONE[tone]}`} data-testid={testid}>{icon}{children}</span>;
}
