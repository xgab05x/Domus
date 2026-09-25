import { useState } from "react";

// Brand slots: drop files in /public/brand/ (domus.png, sol.png, terminus.png, sol.mp4|gif|jpg, terminus.mp4|gif|jpg).
export function BrandLogo({ name, size = 32, className = "", fallback = null, testid }) {
  const [ok, setOk] = useState(true);
  if (!ok) return fallback;
  return (
    <img
      src={`/brand/${name}.png`} alt={name} width={size} height={size} data-testid={testid}
      className={`object-contain ${className}`} onError={() => setOk(false)} draggable={false}
    />
  );
}

const CANDIDATES = (name) => [
  { kind: "video", src: `/brand/${name}.mp4` },
  { kind: "img", src: `/brand/${name}.gif` },
  { kind: "img", src: `/brand/${name}.jpg`, kenburns: true },
  { kind: "img", src: `/brand/${name}.png`, kenburns: true },
];

export function BrandMotion({ name, className = "" }) {
  const [idx, setIdx] = useState(0);
  const list = CANDIDATES(name);
  if (idx >= list.length) return null;
  const c = list[idx];
  const next = () => setIdx((i) => i + 1);
  const cls = `absolute inset-0 w-full h-full object-cover pointer-events-none ${c.kenburns ? "kenburns" : ""} ${className}`;
  if (c.kind === "video") {
    return <video key={c.src} src={c.src} autoPlay muted loop playsInline className={cls} onError={next} data-testid={`brand-motion-${name}`} />;
  }
  return <img key={c.src} src={c.src} alt="" className={cls} onError={next} draggable={false} data-testid={`brand-motion-${name}`} />;
}

export function DomusMark({ size = 32 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-display font-semibold"
      style={{ width: size, height: size, background: "rgb(var(--acc) / 0.22)", color: "rgb(var(--acc-fg))", fontSize: size * 0.5 }}
      aria-label="Domus"
    >
      D
    </div>
  );
}
