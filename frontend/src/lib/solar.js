// Lightweight solar phase computation - approximates sunrise/sunset from lat/lon and date.
// Returns { phase, altitude, sunriseHour, sunsetHour, progress } where progress is 0..1 through the current phase.

const rad = Math.PI / 180;

function dayOfYear(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

export function sunTimes(date, lat, lon) {
  const N = dayOfYear(date);
  // Solar declination (deg)
  const decl = 23.44 * Math.sin(rad * (360 / 365) * (N - 81));
  const latR = lat * rad;
  const decR = decl * rad;
  let cosH = -Math.tan(latR) * Math.tan(decR);
  cosH = Math.max(-1, Math.min(1, cosH));
  const H = Math.acos(cosH) / rad; // degrees
  // Equation of time approx
  const B = rad * (360 / 365) * (N - 81);
  const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
  // Timezone offset (hours) from local
  const tzOffsetH = -date.getTimezoneOffset() / 60;
  const solarNoonLocal = 12 - lon / 15 - EoT / 60 + tzOffsetH;
  const sunriseLocal = solarNoonLocal - H / 15;
  const sunsetLocal = solarNoonLocal + H / 15;
  return { sunriseLocal, sunsetLocal, solarNoonLocal, declination: decl };
}

export function currentHourFractional(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function computePhase(date, lat, lon) {
  const { sunriseLocal, sunsetLocal } = sunTimes(date, lat, lon);
  const h = currentHourFractional(date);
  const dawnStart = sunriseLocal - 0.75;
  const dawnEnd = sunriseLocal + 0.75;
  const duskStart = sunsetLocal - 0.75;
  const duskEnd = sunsetLocal + 0.75;

  let phase = "night";
  let progress = 0;
  if (h >= dawnStart && h < dawnEnd) {
    phase = "dawn";
    progress = (h - dawnStart) / (dawnEnd - dawnStart);
  } else if (h >= dawnEnd && h < duskStart) {
    phase = "day";
    progress = (h - dawnEnd) / (duskStart - dawnEnd);
  } else if (h >= duskStart && h < duskEnd) {
    phase = "sunset";
    progress = (h - duskStart) / (duskEnd - duskStart);
  } else {
    phase = "night";
    // progress: 0 at duskEnd, 1 at dawnStart (of next day)
    const total = 24 - duskEnd + dawnStart;
    const inNight = h >= duskEnd ? h - duskEnd : 24 - duskEnd + h;
    progress = Math.min(1, Math.max(0, inNight / (total || 1)));
  }

  return {
    phase,
    progress,
    sunriseHour: sunriseLocal,
    sunsetHour: sunsetLocal,
  };
}

export const PHASE_LABEL = {
  dawn: "Alba",
  day: "Giorno",
  sunset: "Tramonto",
  night: "Notte",
};

export function formatHour(h) {
  if (!isFinite(h)) return "--:--";
  const hh = Math.floor(((h % 24) + 24) % 24);
  const mm = Math.floor(((h * 60) % 60 + 60) % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
