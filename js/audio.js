// Sons sintetizados na hora (sem arquivos): zumbido dos feixes, cliques das peças, acorde de
// cada cristal que acende e fanfarra de vitória.
import { R, G, B } from './optics.js';

// Notas de cada componente de cor (dó, mi, sol): cristal amarelo toca dó+mi, branco o acorde.
const NOTE = { [R]: 523.25, [G]: 659.25, [B]: 783.99 };

export class Sfx {
  constructor() { this.ctx = null; this.humOn = true; this.humLevel = 0; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      this.startHum();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Zumbido elétrico baixinho: duas ondas dente-de-serra num filtro grave, com volume que
  // acompanha quanta luz está na bancada.
  startHum() {
    const c = this.ctx;
    this.humGain = c.createGain();
    this.humGain.gain.value = 0;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 4;
    for (const [fr, v] of [[110, 1], [165.5, 0.6], [220.8, 0.3]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = fr; g.gain.value = v;
      o.connect(g); g.connect(f);
      o.start();
    }
    // tremido lento
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 0.35; lg.gain.value = 90;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    f.connect(this.humGain); this.humGain.connect(this.master);
  }

  // amount: 0..1 (fração de feixes na bancada)
  setHum(amount) {
    if (!this.ctx || !this.humGain) return;
    const v = this.humOn ? 0.012 + 0.05 * Math.min(1, amount) : 0;
    if (Math.abs(v - this.humLevel) < 0.002) return;
    this.humLevel = v;
    this.humGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.15);
  }

  tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.1, freq = 1200, q = 1, at = 0 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  click() { this.tone(1400, 0.04, { vol: 0.06, type: 'square' }); }
  grab() { this.tone(380, 0.1, { vol: 0.09, type: 'triangle', slide: 1.6 }); }
  place() { this.noise(0.05, { vol: 0.14, freq: 900, q: 2 }); this.tone(220, 0.08, { vol: 0.08, type: 'triangle' }); }
  back() { this.tone(500, 0.14, { vol: 0.07, type: 'triangle', slide: 0.5 }); }
  turn() { this.tone(1900, 0.025, { vol: 0.05, type: 'square' }); this.noise(0.02, { vol: 0.05, freq: 5000, q: 3 }); }
  deny() { this.tone(160, 0.12, { vol: 0.08, type: 'square' }); }
  // Cristal acendeu: as notas das cores que ele pede, em arpejo rápido.
  crystal(color) {
    let k = 0;
    for (const c of [R, G, B]) if (color & c) this.tone(NOTE[c], 0.9, { vol: 0.1, at: 0.05 * k++, type: 'sine' });
    this.tone(NOTE[R] * 2, 0.5, { vol: 0.04, at: 0.12, type: 'triangle' });
  }
  alarm() { this.tone(110, 0.35, { vol: 0.09, type: 'sawtooth' }); this.tone(104, 0.35, { vol: 0.09, type: 'sawtooth', at: 0.18 }); }
  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.6, { vol: 0.11, at: i * 0.09, type: 'triangle' }));
    [261.6, 329.6, 392].forEach(f => this.tone(f, 1.6, { vol: 0.08, at: 0.45, type: 'sine' }));
  }
}
