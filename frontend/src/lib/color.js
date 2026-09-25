export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function rgbToHex(rgb = [255, 200, 120]) {
  return "#" + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function kelvinToRgb(k) {
  const t = clamp(k, 1000, 12000) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = clamp(99.47 * Math.log(t) - 161.12, 0, 255);
    b = t <= 19 ? 0 : clamp(138.52 * Math.log(t - 10) - 305.04, 0, 255);
  } else {
    r = clamp(329.7 * Math.pow(t - 60, -0.1332), 0, 255);
    g = clamp(288.12 * Math.pow(t - 60, -0.0755), 0, 255);
    b = 255;
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

export function readableOn(rgb) {
  const [r, g, b] = rgb;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#1f2833" : "#ffffff";
}
