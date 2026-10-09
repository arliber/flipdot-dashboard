export type DiscShape = 'notched' | 'round' | 'octagon' | 'square' | 'rounded';
export type DiscSize = 'standard' | 'large' | 'xlarge';
export type DotColor = 'white' | 'yellow' | 'green' | 'orange';
export type Transition = 'wipe' | 'cascade' | 'scatter' | 'flush';

export interface Settings {
  discShape: DiscShape;
  /** Disc pitch; larger discs mean fewer of them, and pages re-lay out to fit. */
  discSize: DiscSize;
  dotColor: DotColor;
  transition: Transition;
  wornDots: boolean;
  showSpecs: boolean;
  sound: boolean;
  volume: number;
  hour24: boolean;
  blinkColon: boolean;
  /** City name, "lat, lon", or empty for device geolocation. */
  location: string;
  /** Auto-rotate interval; 0 disables. */
  pageSeconds: number;
}

export const DEFAULTS: Settings = {
  discShape: 'notched',
  discSize: 'standard',
  dotColor: 'white',
  transition: 'wipe',
  wornDots: false,
  showSpecs: false,
  sound: true,
  volume: 0.6,
  hour24: false,
  blinkColon: true,
  location: '31.9425, 34.8389',
  pageSeconds: 15,
};

const STORE = 'flipdot.settings.v1';
const DISC_SIZE_KEYS: DiscSize[] = ['standard', 'large', 'xlarge'];

export function loadSettings(): Settings {
  try {
    const s: Settings = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORE) ?? 'null') || {}) };
    if (!DISC_SIZE_KEYS.includes(s.discSize)) s.discSize = DEFAULTS.discSize; // values from older versions
    return s;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export function clearSettings(): void {
  try { localStorage.removeItem(STORE); } catch { /* storage unavailable */ }
}
