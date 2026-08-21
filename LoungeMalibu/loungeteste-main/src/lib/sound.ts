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
