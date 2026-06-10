/**
 * Notification Sound Utility
 * ─────────────────────────
 * Uses the Web Audio API to synthesize a pleasant Slack-like chime.
 * No external audio files required — fully self-contained.
 *
 * Key guarantees:
 *  • Sound only plays for *new* notifications (caller responsibility).
 *  • Respects the `notificationSoundEnabled` localStorage key.
 *  • Handles browser autoplay restrictions gracefully.
 *  • Debounced — cannot play more than once per 500 ms to avoid overlapping.
 *  • Works across Chrome, Firefox, Safari (webkit prefix handled).
 */

const STORAGE_KEY = 'notificationSoundEnabled';
const DEBOUNCE_MS = 500;

let lastPlayedAt = 0;
let audioCtx: AudioContext | null = null;

/** Returns true if the user has notification sound enabled (default: true). */
export function isNotificationSoundEnabled(): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === null ? true : stored === 'true';
    } catch {
        return true;
    }
}

/** Persists the notification sound preference. */
export function setNotificationSoundEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
        // localStorage unavailable — no-op
    }
}

/** Lazily creates (or resumes) the shared AudioContext. */
function getAudioContext(): AudioContext | null {
    try {
        if (!audioCtx) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return null;
            audioCtx = new Ctx();
        }
        // Resume if suspended (autoplay restriction)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {/* ignore */ });
        }
        return audioCtx;
    } catch {
        return null;
    }
}

/**
 * Plays a soft two-tone chime (similar to Slack's notification sound).
 * Safe to call concurrently — debounced internally.
 */
export function playNotificationChime(): void {
    if (!isNotificationSoundEnabled()) return;

    const now = Date.now();
    if (now - lastPlayedAt < DEBOUNCE_MS) return;
    lastPlayedAt = now;

    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        // --- First note ---
        const t0 = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, t0);             // A5
        osc1.frequency.exponentialRampToValueAtTime(1046, t0 + 0.10); // C6
        gain1.gain.setValueAtTime(0, t0);
        gain1.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(t0);
        osc1.stop(t0 + 0.35);

        // --- Second note (delayed) ---
        const t1 = t0 + 0.18;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318, t1);            // E6
        gain2.gain.setValueAtTime(0, t1);
        gain2.gain.linearRampToValueAtTime(0.20, t1 + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, t1 + 0.50);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t1);
        osc2.stop(t1 + 0.50);
    } catch (e) {
        if (import.meta.env.DEV) {
            console.warn('[notificationSound] Audio playback failed:', e);
        }
    }
}

/**
 * Activates the AudioContext after a user gesture (click/keydown).
 * Call once from your root component to unblock autoplay.
 */
export function unlockAudio(): void {
    getAudioContext();
}
