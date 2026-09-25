import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { CamerasAPI } from "@/lib/api";

const LABEL = { hls: "Live HLS", mjpeg: "Live MJPEG", snapshot: "Snapshot", demo: "Live demo", loading: "Connessione…" };

// Live video for a camera: HLS from Home Assistant → MJPEG proxy → snapshot refresh → demo still.
export default function CameraPlayer({ cam, bg, live, nightVision, testid = "camera-player" }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const loadedRef = useRef(false);
  const [mode, setMode] = useState(live ? "loading" : "demo");
  const [tick, setTick] = useState(0);
  const filter = nightVision === "on" ? "grayscale(1) brightness(1.1) contrast(1.1)" : "brightness(0.88)";

  useEffect(() => {
    let cancelled = false;
    const destroy = () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
    destroy();
    loadedRef.current = false;
    if (!live) { setMode("demo"); return () => { cancelled = true; }; }
    setMode("loading");
    (async () => {
      let info = null;
      try { info = await CamerasAPI.streamInfo(cam.id); } catch { info = null; }
      if (cancelled) return;
      if (!info?.available || !info.url) { setMode(info?.mjpeg ? "mjpeg" : "demo"); return; }
      const url = CamerasAPI.absolute(info.url);
      const video = videoRef.current;
      if (video?.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.play().catch(() => {});
        setMode("hls");
        return;
      }
      if (!Hls.isSupported() || !video) { setMode("mjpeg"); return; }
      const hls = new Hls({ lowLatencyMode: true, liveDurationInfinity: true, manifestLoadingMaxRetry: 1 });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data?.fatal && !cancelled) { destroy(); setMode("mjpeg"); } });
      hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!cancelled) { setMode("hls"); video.play().catch(() => {}); } });
      hls.loadSource(url);
      hls.attachMedia(video);
    })();
    return () => { cancelled = true; destroy(); };
  }, [cam.id, live]);

  useEffect(() => {
    if (mode !== "snapshot") return undefined;
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, [mode]);

  // A connected-but-silent MJPEG stream never fires onError: fall back to snapshots after 7s without a frame.
  useEffect(() => {
    if (mode !== "mjpeg") return undefined;
    const t = setTimeout(() => setMode((m) => (m === "mjpeg" && !loadedRef.current ? "snapshot" : m)), 7000);
    return () => clearTimeout(t);
  }, [mode]);

  return (
    <div className="absolute inset-0" data-testid={testid} data-source={mode}>
      <video ref={videoRef} muted autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover ${mode === "hls" ? "" : "opacity-0 pointer-events-none"}`} style={{ filter }} data-testid={`${testid}-video`} />
      {mode !== "hls" && (
        <img alt={cam.name} style={{ filter }} className="absolute inset-0 w-full h-full object-cover"
          src={mode === "mjpeg" ? CamerasAPI.streamUrl(cam.id) : mode === "snapshot" ? CamerasAPI.snapshotUrl(cam.id, tick) : bg}
          onLoad={() => { loadedRef.current = true; }}
          onError={() => { loadedRef.current = false; setMode((m) => (m === "mjpeg" ? "snapshot" : m === "snapshot" ? "demo" : m)); }} />
      )}
      {mode === "loading" && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50"><span className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" /></div>}
      <span className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-black/55 backdrop-blur text-[10px] uppercase tracking-widest text-white font-semibold" data-testid={`${testid}-source`}>{LABEL[mode]}</span>
    </div>
  );
}
