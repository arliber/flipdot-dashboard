import './style.css';
import { Board } from './board';
import { pageClock, pageForecast, pageNow } from './pages';
import { Panel } from './panel';
import { FlipSound } from './sound';
import { DEFAULTS, clearSettings, loadSettings, saveSettings, type Settings } from './settings';
import { fetchWeather, type WxState } from './weather';

const PAGES = 3;
const DOUBLE_TAP_MS = 320;
const WEATHER_REFRESH_MS = 15 * 60 * 1000;

class App {
  private s: Settings = loadSettings();
  private page = 0;
  private pageStart = Date.now();
  private wx: WxState = { status: 'loading' };
  private wxSeq = 0;
  private started = false;
  private lastTap = 0;
  private tapT = 0;
  private lock: WakeLockSentinel | null = null;

  private sound = new FlipSound();
  private board: Board;
  private panel: Panel;
  private specs: HTMLDivElement;

  constructor(root: HTMLElement) {
    root.innerHTML = '<div class="stage"><div class="board"><canvas></canvas></div><div class="specs" hidden></div></div>';
    const stage = root.querySelector<HTMLDivElement>('.stage')!;
    this.specs = root.querySelector('.specs')!;
    this.board = new Board(root.querySelector('canvas')!, (hits) => {
      if (this.s.sound) this.sound.play(hits, this.s.volume);
    });
    this.panel = new Panel({
      get: () => this.s,
      set: (k, v) => this.set(k, v),
      wxStatus: () => ({ ok: 'Weather loaded', error: 'Could not load weather for this location', loading: 'Loading weather…' })[this.wx.status],
      nextPage: () => this.nextPage(),
      reset: () => this.reset(),
    });
    root.append(this.panel.el);

    stage.addEventListener('pointerdown', this.onTap);
    window.addEventListener('resize', () => this.layout());

    this.layout();
    if (this.s.wornDots) this.board.rollWorn();
    void this.loadWeather();
    setInterval(() => void this.loadWeather(), WEATHER_REFRESH_MS);
    setTimeout(() => { this.started = true; this.render(true); }, 400);
    const loop = () => setTimeout(() => { this.tick(); loop(); }, 1000 - (Date.now() % 1000) + 5);
    loop();
  }

  /* ---------- settings ---------- */
  private set<K extends keyof Settings>(k: K, v: Settings[K]): void {
    const before = this.s;
    this.s = { ...this.s, [k]: v };
    saveSettings(this.s);
    this.apply(before);
  }

  private reset(): void {
    const before = this.s;
    clearSettings();
    this.s = { ...DEFAULTS };
    this.apply(before);
  }

  private apply(before: Settings): void {
    const ch = (k: keyof Settings) => before[k] !== this.s[k];
    if (ch('dotColor') || ch('discShape') || ch('discSize')) this.layout();
    if (ch('showSpecs')) this.specs.hidden = !this.s.showSpecs;
    if (ch('location')) { this.wx = { status: 'loading' }; void this.loadWeather(); this.render(false); }
    if (ch('hour24') || ch('blinkColon')) this.render(false);
    if (ch('wornDots')) {
      if (this.s.wornDots) this.board.rollWorn();
      else { this.board.clearWorn(); this.render(false); }
    }
    this.panel.sync();
  }

  private layout(): void {
    const { specs, regrid } = this.board.layout(this.s.discShape, this.s.dotColor, this.s.discSize);
    this.specs.textContent = specs;
    this.specs.hidden = !this.s.showSpecs;
    // a new grid starts blank; redraw it (once the intro has played)
    if (regrid && this.started) {
      if (this.s.wornDots) this.board.rollWorn();
      this.render(false);
    }
  }

  /* ---------- weather ---------- */
  private async loadWeather(): Promise<void> {
    const seq = ++this.wxSeq;
    let next: WxState;
    try { next = await fetchWeather(this.s.location); }
    catch { next = this.wx.status === 'ok' ? this.wx : { status: 'error' }; }
    if (seq !== this.wxSeq) return; // a newer request (e.g. location change) superseded this one
    this.wx = next;
    if (this.page !== 0) this.render(false);
    this.panel.sync();
  }

  /* ---------- pages ---------- */
  private render(pageChange: boolean): void {
    const { cols, rows } = this.board.size;
    const frame = this.page === 0 ? pageClock(cols, rows, this.s.hour24, this.s.blinkColon)
      : this.page === 1 ? pageNow(cols, rows, this.wx)
      : pageForecast(cols, rows, this.wx);
    this.board.setFrame(frame, pageChange ? this.s.transition : 'wipe');
  }

  private nextPage(): void {
    this.page = (this.page + 1) % PAGES;
    this.pageStart = Date.now();
    this.render(true);
  }

  private tick(): void {
    const secs = this.s.pageSeconds;
    if (secs > 0 && Date.now() - this.pageStart >= secs * 1000) this.nextPage();
    else this.render(false);
  }

  /* ---------- input ---------- */
  private onTap = (): void => {
    this.sound.unlock();
    if (navigator.wakeLock && !this.lock) navigator.wakeLock.request('screen').then((l) => (this.lock = l)).catch(() => {});
    if (window.top === window && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    const now = Date.now();
    if (now - this.lastTap < DOUBLE_TAP_MS) {
      clearTimeout(this.tapT);
      this.lastTap = 0;
      this.panel.open();
      return;
    }
    this.lastTap = now;
    this.tapT = window.setTimeout(() => this.nextPage(), DOUBLE_TAP_MS);
  };
}

new App(document.getElementById('app')!);
