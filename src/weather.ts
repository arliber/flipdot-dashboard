/* Live weather from Open-Meteo (free, no API key). */

export interface DayForecast { date: string; code: number; hi: number; lo: number }

export type WxState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; temp: number; code: number; day: boolean; days: DayForecast[] };

const LATLON = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;

async function resolve(loc: string): Promise<[number, number]> {
  const m = loc.match(LATLON);
  if (m) return [+m[1], +m[3]];
  if (loc) {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(loc.split(',')[0])}`);
    const g = await res.json();
    if (!g.results?.length) throw new Error('no place');
    return [g.results[0].latitude, g.results[0].longitude];
  }
  const pos = await new Promise<GeolocationPosition | null>((done) => {
    if (!navigator.geolocation) return done(null);
    navigator.geolocation.getCurrentPosition(done, () => done(null), { timeout: 8000, maximumAge: 3600000 });
  });
  if (!pos) throw new Error('no gps');
  return [pos.coords.latitude, pos.coords.longitude];
}

/** Fetch current conditions plus a 4-day forecast (today + 3). Throws on failure. */
export async function fetchWeather(location: string): Promise<WxState> {
  const [lat, lon] = await resolve(location.trim());
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4',
  );
  const r = await res.json();
  if (!r.current) throw new Error('bad response');
  return {
    status: 'ok',
    temp: Math.round(r.current.temperature_2m),
    code: r.current.weather_code,
    day: !!r.current.is_day,
    days: (r.daily.time as string[]).map((date, i) => ({
      date,
      code: r.daily.weather_code[i],
      hi: Math.round(r.daily.temperature_2m_max[i]),
      lo: Math.round(r.daily.temperature_2m_min[i]),
    })),
  };
}
