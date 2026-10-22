'use client';

import type { PieceSymbol } from '../types/chess.ts';

let audioCtx: AudioContext | null = null;
let isMuted = false;
let ambientNodes: {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  gain: GainNode;
} | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setSoundMuted(muted: boolean): void {
  isMuted = muted;
  if (muted) {
    stopChamberAmbientSound();
  }
}

export function getSoundMuted(): boolean {
  return isMuted;
}

export function setChamberAmbientSound(enabled: boolean): void {
  if (!enabled || isMuted) {
    stopChamberAmbientSound();
    return;
  }
  const ctx = getAudioContext();
  if (!ctx || ambientNodes) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  // Warm library hall low harmonic drone (A1 + E2 fifth)
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(55.0, now);
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(82.41, now);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(160, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.025, now + 1.5);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  ambientNodes = { osc1, osc2, gain };
}

export function stopChamberAmbientSound(): void {
  if (!ambientNodes) return;
  try {
    ambientNodes.osc1.stop();
    ambientNodes.osc2.stop();
    ambientNodes.gain.disconnect();
  } catch {
    // ignore
  }
  ambientNodes = null;
}

export function playWoodMoveSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(145, now);
  osc.frequency.exponentialRampToValueAtTime(48, now + 0.085);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(420, now);

  gain.gain.setValueAtTime(0.26, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.095);
}

export function playDuelCombatSound(attackerType: PieceSymbol): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (attackerType === 'q' || attackerType === 'b') {
    // Arcane / Mystic resonant energy sweep + strike
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.42);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.46);
  } else if (attackerType === 'r') {
    // Heavy Golem siege warhammer ground impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, now + 0.12);

    gain.gain.setValueAtTime(0.35, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.12);
    osc.stop(now + 0.5);
  } else {
    // Steel sword / lance clash + armor hit
    [0.08, 0.22].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 620 : 190, now + offset);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 240 : 55, now + offset + 0.14);

      gain.gain.setValueAtTime(idx === 0 ? 0.18 : 0.28, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    });
  }
}

export function playWoodCaptureSound(attackerType?: PieceSymbol): void {
  if (isMuted) return;
  if (attackerType) {
    playDuelCombatSound(attackerType);
    return;
  }
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [0, 0.035].forEach((offset, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = idx === 0 ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(idx === 0 ? 260 : 165, now + offset);
    osc.frequency.exponentialRampToValueAtTime(55, now + offset + 0.09);

    gain.gain.setValueAtTime(idx === 0 ? 0.16 : 0.32, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + offset);
    osc.stop(now + offset + 0.1);
  });
}

export function playCastleSound(): void {
  if (isMuted) return;
  playWoodMoveSound();
  setTimeout(() => {
    playWoodMoveSound();
  }, 110);
}

export function playCheckAlertSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(587.33, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.28);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.32);
}

export function playPromotionFanfareSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [440, 554.37, 659.25, 880];
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now + i * 0.07);

    gain.gain.setValueAtTime(0.16, now + i * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.07);
    osc.stop(now + i * 0.07 + 0.38);
  });
}

export function playGameBellSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [440, 554.37, 659.25];
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now + i * 0.06);

    gain.gain.setValueAtTime(0.12, now + i * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.06);
    osc.stop(now + i * 0.06 + 0.48);
  });
}
