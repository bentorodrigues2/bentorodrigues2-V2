// Web Audio API Sound Synthesizer for Notifications and Feedback
let audioCtxInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxInstance || audioCtxInstance.state === "closed") {
      audioCtxInstance = new AudioCtx();
    }
    if (audioCtxInstance.state === "suspended") {
      audioCtxInstance.resume();
    }
    return audioCtxInstance;
  } catch (err) {
    console.warn("AudioContext init notice:", err);
    return null;
  }
}

export function playNotificationTone(soundType: string = "CondoManager Padronizado", volume: number = 0.7) {
  try {
    if (soundType.includes("Silencioso")) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(ctx.destination);

    if (soundType.includes("Suave") || soundType.includes("Melodia")) {
      // Gentle Marimba / Calm chime (F5 -> A5 -> C6)
      const notes = [698.46, 880.00, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        noteGain.gain.setValueAtTime(0.001, now + idx * 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.4, now + idx * 0.08 + 0.03);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.36);
      });
    } else if (soundType.includes("Cristalino")) {
      // Crisp Glass Tone (E6 + E7 harmonic)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(1318.51, now);
      osc2.frequency.setValueAtTime(2637.02, now);

      noteGain.gain.setValueAtTime(0.5, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(noteGain);
      osc2.connect(noteGain);
      noteGain.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.31);
      osc2.stop(now + 0.31);
    } else if (soundType.includes("Sino") || soundType.includes("Clássico")) {
      // Church Bell Chime (E4 + E5 resonant ring)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(329.63, now);
      osc2.frequency.setValueAtTime(659.25, now);

      noteGain.gain.setValueAtTime(0.6, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc1.connect(noteGain);
      osc2.connect(noteGain);
      noteGain.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.66);
      osc2.stop(now + 0.66);
    } else {
      // Default: CondoManager Standard Triad (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        noteGain.gain.setValueAtTime(0.001, now + idx * 0.07);
        noteGain.gain.exponentialRampToValueAtTime(0.5, now + idx * 0.07 + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.4);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.42);
      });
    }
  } catch (err) {
    console.warn("Notification audio tone generation error:", err);
  }
}

export function playVoiceNoteSimulation(durationSeconds: number = 3, onEnded?: () => void) {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      if (onEnded) setTimeout(onEnded, durationSeconds * 1000);
      return;
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.2, now);
    masterGain.connect(ctx.destination);

    // Warm friendly voice note chime sequence
    const notes = [330, 392, 440, 523.25, 440, 392];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.25);

      noteGain.gain.setValueAtTime(0.001, now + idx * 0.25);
      noteGain.gain.exponentialRampToValueAtTime(0.25, now + idx * 0.25 + 0.05);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.25 + 0.3);

      osc.connect(noteGain);
      noteGain.connect(masterGain);
      osc.start(now + idx * 0.25);
      osc.stop(now + idx * 0.25 + 0.32);
    });

    if (onEnded) {
      setTimeout(onEnded, Math.max(1500, durationSeconds * 1000));
    }
  } catch (err) {
    console.warn("Voice note playback notice:", err);
    if (onEnded) setTimeout(onEnded, 1500);
  }
}
