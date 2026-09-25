import { useEffect, useRef } from "react";

const rnd = (a, b) => a + Math.random() * (b - a);

// Canvas particle layer: stars (night), rain streaks + droplets on the "window", snow.
export default function SkyCanvas({ mode }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !mode) return undefined;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, raf = 0, t = 0;
    const stars = [], streaks = [], drops = [], flakes = [];

    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    if (mode === "stars") {
      for (let i = 0; i < 220; i++) stars.push({ x: Math.random(), y: rnd(0, 0.8), r: rnd(0.4, 1.7), p: rnd(0, Math.PI * 2), s: rnd(0.4, 1.6) });
    }
    if (mode === "rain" || mode === "storm") {
      const n = mode === "storm" ? 260 : 150;
      for (let i = 0; i < n; i++) streaks.push({ x: Math.random(), y: Math.random(), len: rnd(14, 34), v: rnd(9, 17) });
      for (let i = 0; i < 80; i++) drops.push({ x: Math.random(), y: Math.random(), r: rnd(2, 7), vy: 0 });
    }
    if (mode === "snow") {
      for (let i = 0; i < 150; i++) flakes.push({ x: Math.random(), y: Math.random(), r: rnd(1, 3.4), vy: rnd(0.35, 1.1), p: rnd(0, Math.PI * 2) });
    }

    const drawStars = () => {
      for (const s of stars) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.s + s.p));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.4) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(200,215,255,${a * 0.18})`;
          ctx.arc(s.x * w, s.y * h, s.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawRain = () => {
      ctx.strokeStyle = "rgba(210,225,245,0.32)";
      ctx.lineWidth = 1;
      for (const s of streaks) {
        const x = s.x * w, y = s.y * h;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + s.len); ctx.stroke();
        s.y += s.v / h;
        if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); }
      }
      for (const d of drops) {
        const x = d.x * w, y = d.y * h;
        const g = ctx.createRadialGradient(x - d.r * 0.3, y - d.r * 0.3, d.r * 0.1, x, y, d.r);
        g.addColorStop(0, "rgba(255,255,255,0.42)");
        g.addColorStop(0.7, "rgba(255,255,255,0.10)");
        g.addColorStop(1, "rgba(255,255,255,0.22)");
        ctx.beginPath(); ctx.fillStyle = g; ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.stroke();
        if (d.vy === 0) {
          d.r += 0.0025;
          if (d.r > 5.5 && Math.random() < 0.004) d.vy = rnd(0.6, 1.6);
        } else {
          d.vy = Math.min(d.vy + 0.02, 4);
          d.y += d.vy / h;
          d.r = Math.max(2.2, d.r - 0.004);
          if (d.y > 1.02) { d.y = rnd(0, 0.4); d.x = Math.random(); d.r = rnd(2, 5); d.vy = 0; }
        }
      }
    };

    const drawSnow = () => {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const f of flakes) {
        ctx.beginPath(); ctx.arc(f.x * w, f.y * h, f.r, 0, Math.PI * 2); ctx.fill();
        f.y += f.vy / h;
        f.x += (Math.sin(t * 0.8 + f.p) * 0.35) / w;
        if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
      }
    };

    const loop = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      if (mode === "stars") drawStars();
      else if (mode === "rain" || mode === "storm") drawRain();
      else if (mode === "snow") drawSnow();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [mode]);

  if (!mode) return null;
  return <canvas ref={ref} data-testid="sky-canvas" data-mode={mode} />;
}
