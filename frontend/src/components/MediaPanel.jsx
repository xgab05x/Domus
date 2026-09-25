import { useState } from "react";
import { Tv, Speaker, Megaphone, MonitorSpeaker } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import MediaCard from "@/components/MediaCard";
import MediaDetail from "@/components/MediaDetail";
import AnnouncePanel from "@/components/AnnouncePanel";

export default function MediaPanel({ roomFilter = "all" }) {
  const { entities } = useDomus();
  const players = entities.filter((e) => e.type === "media_player" && (roomFilter === "all" || (roomFilter === "unassigned" ? !e.room_id : e.room_id === roomFilter)));
  const tvs = players.filter((p) => p.state?.device_class === "tv");
  const speakers = players.filter((p) => p.state?.device_class !== "tv");
  const [detail, setDetail] = useState(null);
  const detailEntity = entities.find((e) => e.id === detail);
  const playing = players.filter((p) => p.state?.status === "playing").length;

  return (
    <div className="space-y-8" data-testid="media-panel">
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat icon={<Tv size={16} />} label="Schermi" value={tvs.length} hint="Android TV, Fire TV, Nest Hub" testid="media-stat-tv" />
        <Stat icon={<Speaker size={16} />} label="Altoparlanti" value={speakers.length} hint="Echo, Nest, Cast" testid="media-stat-speakers" />
        <Stat icon={<MonitorSpeaker size={16} />} label="In riproduzione" value={playing} hint="adesso" testid="media-stat-playing" />
      </div>

      {players.length === 0 ? (
        <div className="glass rounded-[28px] p-10 text-center text-muted" data-testid="media-empty">Nessun media player in questa vista.</div>
      ) : (
        <>
          {tvs.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2"><Tv size={18} className="text-acc" /> Televisori e schermi</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="media-tv-grid">{tvs.map((p) => <MediaCard key={p.id} entity={p} onOpen={() => setDetail(p.id)} />)}</div>
            </section>
          )}
          {speakers.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2"><Speaker size={18} className="text-acc" /> Assistenti e altoparlanti</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="media-speaker-grid">{speakers.map((p) => <MediaCard key={p.id} entity={p} onOpen={() => setDetail(p.id)} />)}</div>
            </section>
          )}
        </>
      )}

      <section>
        <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2"><Megaphone size={18} className="text-acc" /> Annunci e notifiche</h2>
        <AnnouncePanel players={players} />
      </section>

      <MediaDetail entity={detailEntity} open={!!detailEntity} onClose={() => setDetail(null)} />
    </div>
  );
}

function Stat({ icon, label, value, hint, testid }) {
  return (
    <div className="glass rounded-[24px] p-4 flex items-center gap-3" data-testid={testid}>
      <div className="icon-btn icon-on w-11 h-11 shrink-0">{icon}</div>
      <div><div className="label">{label}</div><div className="font-display text-2xl font-semibold leading-tight">{value}</div><div className="text-[10px] text-muted">{hint}</div></div>
    </div>
  );
}
