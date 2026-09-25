import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CameraPlayer from "@/components/CameraPlayer";
import { GridsAPI, EntitiesAPI } from "@/lib/api";
import { camBg } from "@/components/CameraGrid";
import { layoutClass, slotClass } from "@/components/GridsPanel";

// Pagina a schermo pieno con la griglia di telecamere: pensata per TV, Fire Stick e Nest Hub.
export default function Wall() {
  const { gridId } = useParams();
  const [grid, setGrid] = useState(null);
  const [cams, setCams] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [grids, entities] = await Promise.all([GridsAPI.list(), EntitiesAPI.list()]);
        if (!alive) return;
        setGrid(grids.find((g) => g.id === gridId) || null);
        setCams(entities.filter((e) => ["camera", "doorbell"].includes(e.type)));
      } catch (err) { console.warn("Griglia non caricata:", err?.message || err); }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [gridId]);

  if (!grid) return <div className="min-h-screen bg-black text-white/70 flex items-center justify-center text-sm" data-testid="wall-loading">Griglia non trovata o in caricamento…</div>;

  const slots = grid.slots || [];
  return (
    <div className="fixed inset-0 bg-black" data-testid="wall-page">
      <div className={`grid gap-[2px] w-full h-full ${layoutClass(grid.layout)}`}>
        {slots.map((id, i) => {
          const cam = cams.find((c) => c.id === id);
          return (
            <div key={i} className={`relative overflow-hidden bg-slate-900 ${slotClass(grid.layout, i)}`} data-testid={`wall-slot-${i}`}>
              {cam ? <>
                <CameraPlayer cam={cam} bg={camBg(cam, i)} live={!!cam.ha_entity_id} nightVision={cam.state?.night_vision} testid={`wall-player-${i}`} />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold uppercase tracking-wider z-10">{cam.name}</span>
              </> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">riquadro vuoto</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
