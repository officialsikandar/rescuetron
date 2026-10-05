import { Platform, Vibration } from 'react-native';

const ALERT_SOUND_DURATION_MS = 30000; // 30 seconds

let activeExpoSound: any = null;
let activeWebAudioCtx: any = null;
let activeWebInterval: any = null;
let autoStopTimeout: any = null;

/**
 * Generates a 1-second loopable dual-tone emergency siren WAV (880Hz <-> 1200Hz)
 * as a base64 data URI so it works 100% offline on Android, iOS, and Web without external files.
 */
function generateSirenWavDataUri(): string {
  const sampleRate = 8000;
  const durationSeconds = 1;
  const numSamples = sampleRate * durationSeconds;
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = numSamples * bytesPerSample;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      buffer[offset + i] = str.charCodeAt(i);
    }
  };

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // 16 bits per sample
  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Alternate between 880 Hz ( first 0.5s ) and 1200 Hz ( second 0.5s )
    const freq = t < 0.5 ? 880 : 1200;
    phase += (2 * Math.PI * freq) / sampleRate;
    // Rich harmonic emergency tone
    const raw = Math.sin(phase) * 0.7 + Math.sin(phase * 2) * 0.25;
    const sample = Math.max(-1, Math.min(1, raw));
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  // Encode Uint8Array to base64
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  for (let i = 0; i < buffer.length; i += 3) {
    const a = buffer[i];
    const b = i + 1 < buffer.length ? buffer[i + 1] : 0;
    const c = i + 2 < buffer.length ? buffer[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;

    base64 += chars[(triplet >> 18) & 0x3f];
    base64 += chars[(triplet >> 12) & 0x3f];
    base64 += i + 1 < buffer.length ? chars[(triplet >> 6) & 0x3f] : '=';
    base64 += i + 2 < buffer.length ? chars[triplet & 0x3f] : '=';
  }

  return `data:audio/wav;base64,${base64}`;
}

const SIREN_DATA_URI = generateSirenWavDataUri();

/**
 * Starts the 30-second emergency alert siren sound + vibration pattern.
 */
export async function startEmergencyAlertSound(durationMs: number = ALERT_SOUND_DURATION_MS): Promise<void> {
  await stopEmergencyAlertSound();

  // 1. Trigger continuous emergency vibration pattern on native mobile devices
  if (Platform.OS !== 'web') {
    try {
      Vibration.vibrate([0, 500, 250, 500], true);
    } catch (_e) {
      // ignore if vibration permission missing
    }
  }

  // 2. Try playing audio via expo-av on Android / iOS
  if (Platform.OS !== 'web') {
    try {
      // Dynamic require so app never crashes if expo-av isn't installed yet
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Audio } = require('expo-av');
      if (Audio && Audio.Sound) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: SIREN_DATA_URI },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        activeExpoSound = sound;
      }
    } catch (_err) {
      // Fallback if expo-av is not available in current native binary
    }
  }

  // 3. Web Audio API siren fallback (for Expo Web / browser preview)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        activeWebAudioCtx = ctx;

        const playPulse = () => {
          if (!activeWebAudioCtx) return;
          try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.setValueAtTime(1200, now + 0.4);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.78);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.8);
          } catch (_e) {
            // ignore
          }
        };

        playPulse();
        activeWebInterval = setInterval(playPulse, 850);
      }
    } catch (_e) {
      // ignore
    }
  }

  // 4. Automatically stop sound after 30 seconds
  autoStopTimeout = setTimeout(() => {
    stopEmergencyAlertSound();
  }, durationMs);
}

/**
 * Stops the emergency alert siren sound and vibration immediately.
 */
export async function stopEmergencyAlertSound(): Promise<void> {
  if (autoStopTimeout) {
    clearTimeout(autoStopTimeout);
    autoStopTimeout = null;
  }

  if (Platform.OS !== 'web') {
    try {
      Vibration.cancel();
    } catch (_e) {
      // ignore
    }
  }

  if (activeExpoSound) {
    const soundToStop = activeExpoSound;
    activeExpoSound = null;
    try {
      await soundToStop.stopAsync();
      await soundToStop.unloadAsync();
    } catch (_e) {
      // ignore
    }
  }

  if (activeWebInterval) {
    clearInterval(activeWebInterval);
    activeWebInterval = null;
  }

  if (activeWebAudioCtx) {
    const ctxToClose = activeWebAudioCtx;
    activeWebAudioCtx = null;
    try {
      await ctxToClose.close();
    } catch (_e) {
      // ignore
    }
  }
}
