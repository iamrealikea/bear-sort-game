/* audio.js — เสียงเอฟเฟกต์สังเคราะห์ด้วย Web Audio API (ไม่ต้องใช้ไฟล์เสียง) */
const Sfx = (() => {
  const STORAGE_KEY = 'bear_sort_sound';
  let ctx = null;
  let enabled = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) enabled = saved === 'true';
  } catch (e) {}

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* เล่นโน้ตเดี่ยว: ความถี่, เวลาเริ่ม(วินาทีจากตอนนี้), ความยาว, ชนิดคลื่น, ความดัง */
  function tone(freq, start, dur, type = 'sine', vol = 0.12) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    setEnabled(v) {
      enabled = Boolean(v);
      try {
        localStorage.setItem(STORAGE_KEY, String(enabled));
      } catch (e) {}
    },
    isEnabled() { return enabled; },
    select() { tone(660, 0, 0.12, 'triangle'); },
    swap() { tone(330, 0, 0.1, 'triangle'); tone(440, 0.08, 0.12, 'triangle'); },
    correct() { tone(523, 0, 0.12); tone(784, 0.1, 0.18); },
    wrong() { tone(180, 0, 0.25, 'sawtooth', 0.08); },
    win() { [523, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.12, 0.25, 'triangle', 0.14)); },
    lose() { [392, 330, 262].forEach((f, k) => tone(f, k * 0.18, 0.3, 'sine', 0.12)); },
    tick() { tone(880, 0, 0.05, 'square', 0.04); }
  };
})();
