/**
 * High-performance Web Audio synthesizer for warehouse barcode scanners & HHDs.
 * Generates an instantaneous, crisp, success-confirming beep (2100Hz–2400Hz)
 * without relying on external media files, zero network latency, and 100% offline-ready.
 */

let audioContext: AudioContext | null = null;
let isAudioUnlocked = false;

/**
 * Initializes and unlocks the Web Audio API AudioContext.
 * Automatically recovers from 'suspended' state caused by mobile browser autoplay restrictions.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
      }
    }

    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  } catch (err) {
    console.warn('[SoundEffects] Web Audio not available:', err);
    return null;
  }
}

/**
 * Attaches user gesture listeners once to ensure audio context is ready
 * when the first barcode trigger or keystroke occurs.
 */
export function initializeAudioUnlock(): void {
  if (typeof window === 'undefined' || isAudioUnlocked) return;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        isAudioUnlocked = true;
      }).catch(() => {});
    } else if (ctx) {
      isAudioUnlocked = true;
    }

    // Clean up listeners once unlocked
    window.removeEventListener('click', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
  };

  window.addEventListener('click', unlock, true);
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('touchstart', unlock, true);
}

// Auto-register unlock on module load
if (typeof window !== 'undefined') {
  initializeAudioUnlock();
}

/**
 * Plays a brief, crisp success-confirming beep sound effect
 * designed specifically for industrial barcode guns and Handheld Devices (HHD).
 * 
 * Frequency: Dual-stage crisp chirp (2093 Hz -> 2489 Hz)
 * Duration: ~85 milliseconds
 * Profile: Fast attack, zero click, sharp decay
 */
export function playScanSuccessBeep(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';

    // Industrial barcode scanner chirp profile:
    // Starts at high C (2093 Hz) and swiftly sweeps up to ~2489 Hz (D#7)
    // for a sharp, unmistakable confirmation tone that cuts through warehouse noise.
    osc.frequency.setValueAtTime(2093, now);
    osc.frequency.exponentialRampToValueAtTime(2489, now + 0.04);
    osc.frequency.setValueAtTime(2489, now + 0.08);

    // Envelope: Fast 4ms ramp up to prevent clicking, constant volume, then fast exponential decay
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.005);
    gain.gain.setValueAtTime(0.35, now + 0.055);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.085);

    // Optional haptic pulse on mobile PDA / HHD devices
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(60);
      } catch {}
    }
  } catch (err) {
    console.warn('[SoundEffects] Unable to play success beep:', err);
  }
}

/**
 * Plays a low-frequency alert tone for invalid scans, duplicates, or missing batches.
 * 
 * Frequency: 220 Hz low buzz with double pulse
 * Duration: ~200 milliseconds
 */
export function playScanErrorBeep(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(160, now + 0.1);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gain.gain.setValueAtTime(0.3, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.09);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.11);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);

    // Heavy haptic error vibration on HHDs
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 60, 100]);
      } catch {}
    }
  } catch (err) {
    console.warn('[SoundEffects] Unable to play error beep:', err);
  }
}
