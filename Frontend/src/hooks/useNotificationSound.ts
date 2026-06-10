/**
 * useNotificationSound — React hook
 * ───────────────────────────────────
 * Wraps the notificationSound utility in a React-friendly API.
 *
 * Usage:
 *   const { soundEnabled, toggleSound, playSound } = useNotificationSound();
 */

import { useState, useCallback } from 'react';
import {
    isNotificationSoundEnabled,
    setNotificationSoundEnabled,
    playNotificationChime,
    unlockAudio,
} from '@/utils/notificationSound';

export function useNotificationSound() {
    const [soundEnabled, setSoundEnabled] = useState<boolean>(isNotificationSoundEnabled);

    const toggleSound = useCallback(() => {
        setSoundEnabled((prev) => {
            const next = !prev;
            setNotificationSoundEnabled(next);
            // Play a preview chime when enabling so the user hears it right away
            if (next) {
                // Temporarily force-enable to bypass the check inside playNotificationChime
                setNotificationSoundEnabled(true);
                playNotificationChime();
            }
            return next;
        });
    }, []);

    const playSound = useCallback(() => {
        playNotificationChime();
    }, []);

    return { soundEnabled, toggleSound, playSound, unlockAudio };
}
