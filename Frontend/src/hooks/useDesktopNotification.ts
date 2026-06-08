/**
 * useDesktopNotification — React hook
 * ─────────────────────────────────────
 * Abstracts the Browser Notification API.
 *
 * • Requests permission lazily on first use (never on mount).
 * • Returns a `sendDesktopNotification` function safe to call anytime.
 * • Respects the `notificationsEnabled` localStorage flag.
 */

import { useCallback, useRef } from 'react';

const STORAGE_KEY = 'notificationsEnabled';

function areNotificationsEnabled(): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === null ? true : stored === 'true';
    } catch {
        return true;
    }
}

export function useDesktopNotification() {
    const permissionRef = useRef<NotificationPermission | null>(null);

    /** Requests Notification permission if not already granted/denied. */
    const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (!('Notification' in window)) return 'denied';
        if (Notification.permission !== 'default') {
            permissionRef.current = Notification.permission;
            return Notification.permission;
        }
        const perm = await Notification.requestPermission();
        permissionRef.current = perm;
        return perm;
    }, []);

    /**
     * Shows a desktop notification if permission is granted.
     * Automatically requests permission on first call.
     */
    const sendDesktopNotification = useCallback(
        async (title: string, options?: NotificationOptions) => {
            if (!areNotificationsEnabled()) return;
            if (!('Notification' in window)) return;

            // Ensure permission is fetched
            if (permissionRef.current === null) {
                permissionRef.current = Notification.permission;
            }

            // Auto-request if still at default
            if (permissionRef.current === 'default') {
                permissionRef.current = await requestPermission();
            }

            if (permissionRef.current !== 'granted') return;

            try {
                // Only fire when the tab is not active
                if (document.visibilityState === 'visible') return;

                const n = new Notification(title, {
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    silent: true, // We play our own sound via Web Audio API
                    ...options,
                });

                // Auto-close after 5 seconds
                setTimeout(() => n.close(), 5000);
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.warn('[useDesktopNotification] Failed to show notification:', e);
                }
            }
        },
        [requestPermission],
    );

    return { sendDesktopNotification, requestPermission };
}
