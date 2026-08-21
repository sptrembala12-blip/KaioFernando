/**
 * Toca um "bling" curto usando Web Audio API — não precisa de arquivo de áudio.
 */
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    const tones = [
      { freq: 880, start: 0, dur: 0.18 },
      { freq: 1318.5, start: 0.12, dur: 0.22 },
    ];

    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.25, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    });

    setTimeout(() => ctx.close(), 800);
  } catch (e) {
    console.warn("Audio falhou:", e);
  }
}

/** Som de caixa / dinheiro — só na venda aprovada. */
export function playCashSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    const ding = (freq: number, start: number, dur: number, vol = 0.32, type: OscillatorType = "square") => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    };

    // gaveta + moedas
    ding(220, 0, 0.12, 0.22, "sawtooth");
    ding(1800, 0.06, 0.1, 0.2, "square");
    ding(2400, 0.11, 0.12, 0.24, "square");
    ding(987.77, 0.2, 0.22, 0.22, "triangle");
    ding(1318.5, 0.32, 0.38, 0.28, "triangle");
    ding(1760, 0.42, 0.2, 0.12, "sine");

    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource();
    const ng = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2500;
    noise.buffer = noiseBuf;
    ng.gain.setValueAtTime(0.12, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    noise.connect(filter).connect(ng).connect(ctx.destination);
    noise.start(now);

    setTimeout(() => ctx.close(), 1400);
  } catch (e) {
    console.warn("Audio falhou:", e);
  }
}
