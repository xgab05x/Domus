import { useMemo, useRef } from "react";

const RATIO = { sol: "1600 / 609", terminus: "1600 / 786" };

function seeded(n, seed) {
  let s = seed;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: n }, (_, i) => ({ id: i, a: r(), b: r(), c: r(), d: r() }));
}

// Animated brand banner: parallax on pointer, breathing zoom, and section-specific light effects.
export default function BannerArt({ name, className = "" }) {
  const ref = useRef(null);
  const dots = useMemo(() => seeded(name === "sol" ? 18 : 28, name === "sol" ? 7 : 13), [name]);

  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const onLeave = () => { const el = ref.current; if (!el) return; el.style.setProperty("--px", 0); el.style.setProperty("--py", 0); };

  return (
    <div ref={ref} className={`banner-art ${className}`} style={{ aspectRatio: RATIO[name] }} onPointerMove={onMove} onPointerLeave={onLeave} data-testid={`banner-${name}`}>
      <div className="banner-parallax">
        <img src={`/brand/${name}-banner.webp`} alt={name === "sol" ? "Sol Invictus" : "Terminus"} className="banner-img" draggable={false} />
      </div>
      <div className="banner-parallax fx">
        {name === "sol" ? (
          <>
            <div className="fx-rays" style={{ left: "50%", top: "27%" }} />
            <div className="fx-glow" style={{ left: "50%", top: "27%" }} />
            <div className="fx-sheen" />
            {dots.map((d) => (
              <span key={d.id} className="fx-dust" style={{ left: `${8 + d.a * 84}%`, top: `${35 + d.b * 60}%`, width: 2 + d.c * 4, height: 2 + d.c * 4, animationDuration: `${9 + d.d * 10}s`, animationDelay: `${-d.a * 18}s` }} />
            ))}
          </>
        ) : (
          <>
            <div className="fx-torch" style={{ left: "32.5%", top: "64%" }} />
            <div className="fx-torch two" style={{ left: "67.5%", top: "64%" }} />
            <div className="fx-glow warm" style={{ left: "50%", top: "17%", width: "26%" }} />
            <div className="fx-moon" style={{ left: "19%", top: "63%" }} />
            <div className="fx-moon small" style={{ left: "81.5%", top: "60%" }} />
            {dots.map((d) => (
              <span key={d.id} className="fx-star" style={{ left: `${4 + d.a * 92}%`, top: `${4 + d.b * 40}%`, width: 1.5 + d.c * 2.5, height: 1.5 + d.c * 2.5, animationDuration: `${1.8 + d.d * 3}s`, animationDelay: `${-d.a * 4}s` }} />
            ))}
            <div className="fx-fog" />
          </>
        )}
      </div>
      <div className="banner-vignette" />
    </div>
  );
}
