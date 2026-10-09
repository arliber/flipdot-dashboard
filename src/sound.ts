/* Synthesised flip sound: one tick per disc landing, binned and panned by column. */

import { COLS } from './fonts';
import type { Hit } from './board';

export class FlipSound {
  private ac?: AudioContext;
  private master?: AudioNode;
  private bufs: AudioBuffer[] = [];

  /** Create or resume the audio context. Must be called from a user gesture. */
  unlock(): void {
    if (this.ac) { if (this.ac.state === 'suspended') void this.ac.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = (this.ac = new AC());
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.001;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 220;
    hp.connect(comp).connect(ac.destination);
    this.master = hp;
    this.bufs = Array.from({ length: 6 }, (_, s) => {
      const sr = ac.sampleRate, len = Math.floor(sr * 0.03), b = ac.createBuffer(1, len, sr), d = b.getChannelData(0);
      const f1 = 3000 + s * 450 + Math.random() * 300, f2 = 780 + s * 90, f3 = 210 + s * 20;
      let lp = 0;
      for (let n = 0; n < len; n++) {
        const t = n / sr, nz = Math.random() * 2 - 1;
        lp += (nz - lp) * 0.45;
        d[n] = (lp * Math.exp(-t / 0.0009) * 1.1 +
          Math.sin(2 * Math.PI * f1 * t) * Math.exp(-t / 0.0016) * 0.35 +
          Math.sin(2 * Math.PI * f2 * t) * Math.exp(-t / 0.004) * 0.22 +
          Math.sin(2 * Math.PI * f3 * t) * Math.exp(-t / 0.006) * 0.25) * 0.75;
      }
      return b;
    });
  }

  play(hits: Hit[], volume: number): void {
    const ac = this.ac, master = this.master;
    if (!ac || !master || ac.state !== 'running' || !hits.length) return;
    const bins = new Map<number, [number, number]>();
    for (const [t, x] of hits) {
      const k = Math.round(t / 2.5), b = bins.get(k) || [0, 0];
      b[0]++; b[1] += x; bins.set(k, b);
    }
    const base = ac.currentTime - performance.now() / 1000;
    const fire = (when: number, n: number, xAvg: number, gainMul: number) => {
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = this.bufs[Math.floor(Math.random() * this.bufs.length)];
      src.playbackRate.value = 0.88 + Math.random() * 0.26;
      g.gain.value = volume * gainMul * Math.min(1.25, 0.1 + 0.16 * Math.sqrt(n));
      let node: AudioNode = src.connect(g);
      if (ac.createStereoPanner) {
        const pn = ac.createStereoPanner();
        pn.pan.value = ((xAvg / (COLS - 1)) * 2 - 1) * 0.75;
        node = node.connect(pn);
      }
      node.connect(master);
      src.start(when);
    };
    for (const [k, [n, sx]] of bins) {
      const when = Math.max(ac.currentTime, base + (k * 2.5) / 1000);
      fire(when, n, sx / n, 1);
      if (n > 2) fire(when + 0.011 + Math.random() * 0.004, n, sx / n, 0.28);
    }
  }
}
