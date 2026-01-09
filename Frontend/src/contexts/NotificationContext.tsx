/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://staffly.space';
// Polling disabled - only fetch on app init/auth
const FETCH_INTERVAL_MS = 0; // Disabled
const POLLING_IDLE_TIMEOUT_MS = 10 * 60_000; // 10 minutes idle timeout
const RETRY_DELAY_MS = 10_000; // Retry after 10 seconds on failure
const MIN_FETCH_INTERVAL_MS = 30_000; // Minimum 30 seconds between fetches (except manual refresh)

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'leave' | 'task' | 'info' | 'warning' | 'shift';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
  metadata?: {
    leaveId?: string;
    taskId?: string;
    requesterId?: string;
    requesterName?: string;
    shiftAssignmentId?: string;
  };
  backendId?: number;
  passDetails?: {
    from?: string;
    to?: string;
    note?: string;
  };
}

// Debug logging helper
const debugLog = (message: string, data?: unknown) => {
  // Disabled to keep console clean. Enable only for debugging notifications.
  if (import.meta.env.DEV && false) {
    console.log(`[NotificationContext] ${message}`, data !== undefined ? data : '');
  }
};

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  addNotification: (notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotification: (notificationId: string) => void;
  clearAll: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

type BackendTaskNotification = {
  notification_id: number;
  user_id: number;
  task_id: number;
  notification_type: string;
  title: string;
  message: string;
  pass_details: string | Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

type BackendLeaveNotification = {
  notification_id: number;
  user_id: number;
  leave_id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type BackendShiftNotification = {
  notification_id: number;
  user_id: number;
  shift_assignment_id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

const getAuthHeader = (): string | null => {
  const storedToken = localStorage.getItem('token') || '';
  if (!storedToken) return null;
  return storedToken.startsWith('Bearer ') ? storedToken : `Bearer ${storedToken}`;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<{ play: () => void } | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const pollIdleTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const lastFetchRef = useRef<number>(0);
  const previousUnreadCountRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false); // Prevent concurrent fetches
  const initialFetchDoneRef = useRef<boolean>(false); // Track if initial fetch is done

  // Check if notifications are enabled
  const areNotificationsEnabled = () => {
    const stored = localStorage.getItem('notificationsEnabled');
    return stored === null ? true : stored === 'true';
  };

  // Load notifications from localStorage on mount
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const stored = localStorage.getItem(`notifications_${user.id}`);
    if (stored) {
      try {
        const parsed: Notification[] = JSON.parse(stored);
        debugLog('Loaded notifications from localStorage:', parsed.length);
        setNotifications(parsed);
      } catch (error) {
        console.error('Failed to parse stored notifications', error);
        localStorage.removeItem(`notifications_${user.id}`);
        setNotifications([]);
      }
    } else {
      debugLog('No stored notifications found');
      setNotifications([]);
    }
  }, [user?.id]);

  // Save notifications to localStorage
  useEffect(() => {
    if (!user) return;

    const localNotifications = notifications.filter((notification) => !notification.backendId);

    if (localNotifications.length > 0) {
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify(localNotifications));
    } else {
      localStorage.removeItem(`notifications_${user.id}`);
    }
  }, [notifications, user]);

  // Initialize notification sound
  useEffect(() => {
    // Create a simple notification sound using Web Audio API
    const createNotificationSound = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    };

    audioRef.current = {
      play: createNotificationSound,
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.play();
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, []);

  const mapBackendTaskNotification = useCallback((notification: BackendTaskNotification, currentUserId?: string): Notification | null => {
    let parsedDetails: Record<string, unknown> | null = null;
    if (notification.pass_details) {
      if (typeof notification.pass_details === 'string') {
        try {
          parsedDetails = JSON.parse(notification.pass_details);
        } catch (error) {
          console.error('Failed to parse task pass details', error);
        }
      } else if (typeof notification.pass_details === 'object') {
        parsedDetails = notification.pass_details as Record<string, unknown>;
      }
    }

    const fromValue = parsedDetails && typeof parsedDetails === 'object' ? parsedDetails['from'] : undefined;
    const toValue = parsedDetails && typeof parsedDetails === 'object' ? parsedDetails['to'] : undefined;
    const noteValue = parsedDetails && typeof parsedDetails === 'object' ? parsedDetails['note'] : undefined;

    // ✅ Filter out self-notifications: only show if the notification is for the current user
    // and the sender is different from the recipient
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) {
      // This notification is not for the current user, filter it out
      debugLog('Filtering out task notification - not for current user', { notificationUserId, currentUserId });
      return null;
    }

    // ✅ Prevent self-notifications: if sender and recipient are the same, don't show
    if (fromValue !== undefined && String(fromValue) === notificationUserId) {
      debugLog('Filtering out task notification - self notification', { fromValue, notificationUserId });
      return null;
    }

    debugLog('Mapping task notification', { id: notification.notification_id, title: notification.title, is_read: notification.is_read });

    return {
      id: `backend-task-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'task',
      read: notification.is_read,
      createdAt: notification.created_at,
      metadata: {
        taskId: String(notification.task_id),
        requesterId: fromValue !== undefined ? String(fromValue) : undefined,
      },
      passDetails: {
        from: fromValue !== undefined ? String(fromValue) : undefined,
        to: toValue !== undefined ? String(toValue) : undefined,
        note: typeof noteValue === 'string' ? noteValue : undefined,
      },
    };
  }, []);

  const mapBackendLeaveNotification = useCallback((notification: BackendLeaveNotification, currentUserId?: string): Notification | null => {
    // ✅ Filter out self-notifications: only show if the notification is for the current user
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) {
      // This notification is not for the current user, filter it out
      debugLog('Filtering out leave notification - not for current user', { notificationUserId, currentUserId });
      return null;
    }

    debugLog('Mapping leave notification', { id: notification.notification_id, title: notification.title, is_read: notification.is_read });

    return {
      id: `backend-leave-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'leave',
      read: notification.is_read,
      createdAt: notification.created_at,
      metadata: {
        leaveId: String(notification.leave_id),
      },
    };
  }, []);

  const mapBackendShiftNotification = useCallback((notification: BackendShiftNotification, userRole?: string, currentUserId?: string): Notification | null => {
    // ✅ Filter out self-notifications: only show if the notification is for the current user
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) {
      // This notification is not for the current user, filter it out
      debugLog('Filtering out shift notification - not for current user', { notificationUserId, currentUserId });
      return null;
    }

    // Determine the team page route based on user role
    let teamRoute = '/employee/team';
    if (userRole === 'team_lead') {
      teamRoute = '/team_lead/team';
    } else if (userRole === 'employee') {
      teamRoute = '/employee/team';
    }

    debugLog('Mapping shift notification', { id: notification.notification_id, title: notification.title, is_read: notification.is_read });

    return {
      id: `backend-shift-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'shift',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: teamRoute,
      metadata: {
        shiftAssignmentId: String(notification.shift_assignment_id),
      },
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollIdleTimeoutRef.current) {
      window.clearTimeout(pollIdleTimeoutRef.current);
      pollIdleTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const fetchBackendNotifications = useCallback(async (isManualRefresh = false) => {
    if (!user) {
      debugLog('No user, skipping fetch');
      return;
    }

    // Check if notifications are enabled
    if (!areNotificationsEnabled()) {
      debugLog('Notifications disabled, skipping fetch');
      return;
    }

    const authHeader = getAuthHeader();
    if (!authHeader) {
      debugLog('No auth header, stopping polling');
      stopPolling();
      return;
    }

    // ✅ Validate token exists and is not empty
    const token = localStorage.getItem('token');
    if (!token || token.trim() === '') {
      debugLog('No token, stopping polling');
      stopPolling();
      return;
    }

    // ✅ CRITICAL: Prevent concurrent fetches - only one request at a time
    if (isFetchingRef.current) {
      debugLog('Fetch already in progress, skipping');
      return;
    }

    // Prevent too frequent fetches (minimum 30 seconds between fetches, except for manual refresh)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    if (!isManualRefresh && timeSinceLastFetch < MIN_FETCH_INTERVAL_MS) {
      debugLog(`Fetch throttled, ${Math.round((MIN_FETCH_INTERVAL_MS - timeSinceLastFetch) / 1000)}s remaining`);
      return;
    }

    // Mark as fetching
    isFetchingRef.current = true;
    lastFetchRef.current = now;

    // Cancel previous request if still pending (shouldn't happen with isFetchingRef check)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    if (isManualRefresh) {
      setIsLoading(true);
    }
    setError(null);

    debugLog('Fetching notifications from API...');

    try {
      const [taskResult, leaveResult, shiftResult] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/tasks/notifications`, {
          headers: {
            Authorization: authHeader,
          },
          signal,
        }).catch(err => {
          // Silently handle network errors and aborts
          if (import.meta.env.DEV && err.name !== 'AbortError') {
            console.warn('Task notifications fetch failed:', err.message);
          }
          return { ok: false, status: 0 } as Response;
        }),
        fetch(`${API_BASE_URL}/leave/notifications`, {
          headers: {
            Authorization: authHeader,
          },
          signal,
        }).catch(err => {
          // Silently handle network errors and aborts
          if (import.meta.env.DEV && err.name !== 'AbortError') {
            console.warn('Leave notifications fetch failed:', err.message);
          }
          return { ok: false, status: 0 } as Response;
        }),
        fetch(`${API_BASE_URL}/shift/notifications`, {
          headers: {
            Authorization: authHeader,
          },
          signal,
        }).catch(err => {
          // Silently handle network errors and aborts
          if (import.meta.env.DEV && err.name !== 'AbortError') {
            console.warn('Shift notifications fetch failed:', err.message);
          }
          return { ok: false, status: 0 } as Response;
        }),
      ]);

      // Check for 401 errors - if any endpoint returns 401, stop polling and clear auth
      let hasUnauthorized = false;
      if (taskResult.status === 'fulfilled' && taskResult.value.status === 401) {
        hasUnauthorized = true;
      }
      if (leaveResult.status === 'fulfilled' && leaveResult.value.status === 401) {
        hasUnauthorized = true;
      }
      if (shiftResult.status === 'fulfilled' && shiftResult.value.status === 401) {
        hasUnauthorized = true;
      }

      if (hasUnauthorized) {
        // ✅ Token is invalid - clear auth and stop polling
        if (import.meta.env.DEV) {
          console.warn('Token expired or invalid - stopping notification polling');
        }
        stopPolling();
        // Clear auth data to prevent further unauthorized requests
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return;
      }

      const taskData: BackendTaskNotification[] = [];
      const leaveData: BackendLeaveNotification[] = [];
      const shiftData: BackendShiftNotification[] = [];

      // Handle task notifications
      if (taskResult.status === 'fulfilled' && taskResult.value.ok) {
        try {
          const data = await taskResult.value.json();
          debugLog('Task notifications API response:', data);
          // Handle both array and object responses
          if (Array.isArray(data)) {
            taskData.push(...data);
          } else if (data && typeof data === 'object') {
            if (Array.isArray(data.notifications)) {
              taskData.push(...data.notifications);
            } else if (Array.isArray(data.data)) {
              taskData.push(...data.data);
            }
          }
          debugLog('Parsed task notifications:', taskData);
        } catch (error) {
          // Silently handle parse errors and aborts
          if (import.meta.env.DEV && !(error instanceof Error && error.name === 'AbortError')) {
            console.error('Failed to parse task notifications', error);
          }
        }
      } else if (taskResult.status === 'rejected') {
        // Silently handle network errors and aborts for notifications
        if (import.meta.env.DEV && taskResult.reason?.name !== 'AbortError' && !taskResult.reason?.message?.includes('fetch')) {
          console.error('Failed to fetch task notifications:', taskResult.reason);
        }
      } else if (taskResult.status === 'fulfilled') {
        debugLog('Task notifications API returned non-OK status:', taskResult.value.status);
      }

      // Handle leave notifications
      if (leaveResult.status === 'fulfilled' && leaveResult.value.ok) {
        try {
          const data = await leaveResult.value.json();
          debugLog('Leave notifications API response:', data);
          // Handle both array and object responses
          if (Array.isArray(data)) {
            leaveData.push(...data);
          } else if (data && typeof data === 'object') {
            // If API returns an object with notifications array
            if (Array.isArray(data.notifications)) {
              leaveData.push(...data.notifications);
            } else if (Array.isArray(data.data)) {
              leaveData.push(...data.data);
            }
          }
          debugLog('Parsed leave notifications:', leaveData);
        } catch (error) {
          // Silently handle parse errors and aborts
          if (import.meta.env.DEV && !(error instanceof Error && error.name === 'AbortError')) {
            console.error('Failed to parse leave notifications', error);
          }
        }
      } else if (leaveResult.status === 'rejected') {
        // Silently handle network errors and aborts for notifications
        if (import.meta.env.DEV && leaveResult.reason?.name !== 'AbortError' && !leaveResult.reason?.message?.includes('fetch')) {
          console.error('Failed to fetch leave notifications:', leaveResult.reason);
        }
      } else if (leaveResult.status === 'fulfilled') {
        debugLog('Leave notifications API returned non-OK status:', leaveResult.value.status);
      }

      // Handle shift notifications
      if (shiftResult.status === 'fulfilled' && shiftResult.value.ok) {
        try {
          const data = await shiftResult.value.json();
          debugLog('Shift notifications API response:', data);
          // Handle both array and object responses
          if (Array.isArray(data)) {
            shiftData.push(...data);
          } else if (data && typeof data === 'object') {
            if (Array.isArray(data.notifications)) {
              shiftData.push(...data.notifications);
            } else if (Array.isArray(data.data)) {
              shiftData.push(...data.data);
            }
          }
          debugLog('Parsed shift notifications:', shiftData);
        } catch (error) {
          // Silently handle parse errors and aborts
          if (import.meta.env.DEV && !(error instanceof Error && error.name === 'AbortError')) {
            console.error('Failed to parse shift notifications', error);
          }
        }
      } else if (shiftResult.status === 'rejected') {
        // Silently handle network errors and aborts for notifications
        if (import.meta.env.DEV && shiftResult.reason?.name !== 'AbortError' && !shiftResult.reason?.message?.includes('fetch')) {
          console.error('Failed to fetch shift notifications:', shiftResult.reason);
        }
      } else if (shiftResult.status === 'fulfilled') {
        debugLog('Shift notifications API returned non-OK status:', shiftResult.value.status);
      }

      const backendNotifications = [
        ...taskData.map(n => mapBackendTaskNotification(n, user.id)).filter((n): n is Notification => n !== null),
        ...leaveData.map(n => mapBackendLeaveNotification(n, user.id)).filter((n): n is Notification => n !== null),
        ...shiftData.map(n => mapBackendShiftNotification(n, user.role, user.id)).filter((n): n is Notification => n !== null),
      ];

      debugLog('Total backend notifications mapped:', backendNotifications.length);
      debugLog('Backend notifications:', backendNotifications);
      const taskMapped = taskData.map(n => mapBackendTaskNotification(n, user.id)).filter((n): n is Notification => n !== null);
      const leaveMapped = leaveData.map(n => mapBackendLeaveNotification(n, user.id)).filter((n): n is Notification => n !== null);
      const shiftMapped = shiftData.map(n => mapBackendShiftNotification(n, user.role, user.id)).filter((n): n is Notification => n !== null);
      debugLog('Task notifications:', { raw: taskData.length, mapped: taskMapped.length });
      debugLog('Leave notifications:', { raw: leaveData.length, mapped: leaveMapped.length });
      debugLog('Shift notifications:', { raw: shiftData.length, mapped: shiftMapped.length });

      setNotifications((prev) => {
        const localOnly = prev.filter((notification) => !notification.backendId);
        const combined = [...backendNotifications, ...localOnly];
        const uniqueById = new Map<string, Notification>();
        combined.forEach((notification) => {
          if (!uniqueById.has(notification.id)) {
            uniqueById.set(notification.id, notification);
          }
        });
        const sortedNotifications = Array.from(uniqueById.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        debugLog('Final notifications count:', sortedNotifications.length);
        debugLog('Unread count:', sortedNotifications.filter(n => !n.read).length);

        // Check for new unread notifications and play sound
        const newUnreadCount = sortedNotifications.filter(n => !n.read).length;
        if (newUnreadCount > previousUnreadCountRef.current && previousUnreadCountRef.current > 0) {
          playNotificationSound();
        }
        previousUnreadCountRef.current = newUnreadCount;

        return sortedNotifications;
      });

      // Clear any retry timeout on success
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    } catch (error) {
      // Only set error for non-abort errors
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to fetch notifications', error);
        setError('Failed to load notifications');

        // Schedule retry on failure
        if (!retryTimeoutRef.current) {
          retryTimeoutRef.current = window.setTimeout(() => {
            retryTimeoutRef.current = null;
            fetchBackendNotifications();
          }, RETRY_DELAY_MS);
        }
      }
    } finally {
      // ✅ CRITICAL: Always reset fetching flag
      isFetchingRef.current = false;
      if (isManualRefresh) {
        setIsLoading(false);
      }
    }
  }, [mapBackendLeaveNotification, mapBackendTaskNotification, mapBackendShiftNotification, user, stopPolling, playNotificationSound]);

  const schedulePollingStop = useCallback(() => {
    if (pollIdleTimeoutRef.current) {
      window.clearTimeout(pollIdleTimeoutRef.current);
    }
    pollIdleTimeoutRef.current = window.setTimeout(() => {
      stopPolling();
    }, POLLING_IDLE_TIMEOUT_MS);
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    debugLog('startPolling called', { user: user?.id, visibility: document.visibilityState });

    if (!user || document.visibilityState === 'hidden') {
      debugLog('Stopping polling - no user or hidden');
      stopPolling();
      return;
    }

    // Check if notifications are enabled
    if (!areNotificationsEnabled()) {
      debugLog('Notifications disabled');
      stopPolling();
      return;
    }

    // Check if we have a valid token before starting
    const authHeader = getAuthHeader();
    if (!authHeader) {
      debugLog('No auth header available');
      stopPolling();
      return;
    }

    debugLog('Starting notification polling...');

    // Fetch immediately on start
    debugLog('Fetching notifications immediately on polling start');
    fetchBackendNotifications(true);

    // Set up polling interval only if FETCH_INTERVAL_MS > 0
    if (FETCH_INTERVAL_MS > 0 && !pollIntervalRef.current) {
      debugLog('Setting up polling interval');
      pollIntervalRef.current = window.setInterval(() => {
        debugLog('Polling interval triggered');
        fetchBackendNotifications();
      }, FETCH_INTERVAL_MS);
    } else if (FETCH_INTERVAL_MS === 0) {
      debugLog('Polling disabled - only fetching on demand');
    }

    schedulePollingStop();
  }, [fetchBackendNotifications, schedulePollingStop, stopPolling, user]);

  useEffect(() => {
    debugLog('User effect triggered', { userId: user?.id });

    if (!user) {
      debugLog('No user, stopping polling and resetting state');
      stopPolling();
      initialFetchDoneRef.current = false; // Reset on logout
      isFetchingRef.current = false;
      return;
    }

    // ✅ CRITICAL: Only fetch once on initial login/mount
    if (!initialFetchDoneRef.current) {
      debugLog('User logged in, fetching notifications once (initial fetch)');
      initialFetchDoneRef.current = true;
      fetchBackendNotifications(true);
    } else {
      debugLog('Initial fetch already done, skipping');
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        debugLog('Page became visible, fetching notifications');
        // Use throttled fetch - will be skipped if called too recently
        fetchBackendNotifications(false);
      } else {
        debugLog('Page became hidden');
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
      // Abort any pending fetch requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        isFetchingRef.current = false;
      }
    };
  }, [fetchBackendNotifications, stopPolling, user]);

  const addNotification = (notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) => {
    if (!user) return;

    // Check if notifications are enabled
    if (!areNotificationsEnabled()) {
      return;
    }

    // ✅ Prevent self-notifications: check if the requester is the same as the current user
    // For task notifications, check if the requesterId matches the current user
    if (notification.type === 'task' && notification.metadata?.requesterId) {
      if (String(notification.metadata.requesterId) === String(user.id)) {
        // Don't show self-notification for task assignments
        return;
      }
    }

    // ✅ Prevent self-notifications: check if the requester is the same as the current user
    // For leave notifications, check if the requesterId matches the current user
    if (notification.type === 'leave' && notification.metadata?.requesterId) {
      if (String(notification.metadata.requesterId) === String(user.id)) {
        // Don't show self-notification for leave approvals
        return;
      }
    }

    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      userId: user.id,
      read: false,
      createdAt: new Date().toISOString(),
    };

    setNotifications(prev => [newNotification, ...prev]);
    playNotificationSound();

    // Show browser notification if permitted
    if ('Notification' in window && window.Notification.permission === 'granted') {
      new window.Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });
    }
  };

  const markAsRead = useCallback(async (notificationId: string) => {
    let backendId: number | undefined;
    let backendType: Notification['type'] | undefined;

    // Find the notification first
    let targetNotification: Notification | undefined;
    setNotifications((prev) => {
      targetNotification = prev.find(n => n.id === notificationId);
      return prev;
    });

    if (!targetNotification) {
      return;
    }

    backendId = targetNotification.backendId;
    backendType = targetNotification.type;

    // Mark as read in local state
    setNotifications((prev) =>
      prev.map((notif) => {
        if (notif.id === notificationId) {
          return { ...notif, read: true };
        }
        return notif;
      })
    );

    // If it's a local-only notification (no backend ID), we're done
    if (!user || !backendId || !backendType) {
      return;
    }

    const authHeader = getAuthHeader();
    if (!authHeader) {
      return;
    }

    try {
      let endpoint = '';
      if (backendType === 'task') {
        endpoint = `${API_BASE_URL}/tasks/notifications/${backendId}/read`;
      } else if (backendType === 'leave') {
        endpoint = `${API_BASE_URL}/leave/notifications/${backendId}/read`;
      } else if (backendType === 'shift') {
        endpoint = `${API_BASE_URL}/shift/notifications/${backendId}/read`;
      } else {
        return;
      }

      debugLog('Marking notification as read:', { endpoint, notificationId });

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to mark notification as read (${response.status})`);
      }

      debugLog('Successfully marked notification as read:', notificationId);

      // Keep notification in list but marked as read (don't remove it)
      // This allows the UI to update properly without flickering

    } catch (error) {
      console.error('Failed to mark notification as read', error);
      // Revert the read status if backend call failed
      setNotifications((prev) =>
        prev.map((notif) => {
          if (notif.id === notificationId) {
            return { ...notif, read: false };
          }
          return notif;
        })
      );
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    const taskIds: number[] = [];
    const leaveIds: number[] = [];
    const shiftIds: number[] = [];
    const notificationIdsToRemove: string[] = [];

    setNotifications((prev) =>
      prev.map((notif) => {
        if (!notif.read) {
          notificationIdsToRemove.push(notif.id);
          if (notif.backendId) {
            if (notif.type === 'leave') {
              leaveIds.push(notif.backendId);
            } else if (notif.type === 'task') {
              taskIds.push(notif.backendId);
            } else if (notif.type === 'shift') {
              shiftIds.push(notif.backendId);
            }
          }
        }
        if (notif.read) return notif;
        return { ...notif, read: true };
      })
    );

    if (!user || (taskIds.length === 0 && leaveIds.length === 0 && shiftIds.length === 0)) {
      // Still remove local notifications even if no backend IDs
      setTimeout(() => {
        setNotifications((prev) => prev.filter((notif) => !notificationIdsToRemove.includes(notif.id)));
      }, 500);
      return;
    }

    const authHeader = getAuthHeader();
    if (!authHeader) {
      return;
    }

    try {
      await Promise.all([
        ...taskIds.map((id) =>
          fetch(`${API_BASE_URL}/tasks/notifications/${id}/read`, {
            method: 'PUT',
            headers: {
              Authorization: authHeader,
            },
          })
        ),
        ...leaveIds.map((id) =>
          fetch(`${API_BASE_URL}/leave/notifications/${id}/read`, {
            method: 'PUT',
            headers: {
              Authorization: authHeader,
            },
          })
        ),
        ...shiftIds.map((id) =>
          fetch(`${API_BASE_URL}/shift/notifications/${id}/read`, {
            method: 'PUT',
            headers: {
              Authorization: authHeader,
            },
          })
        ),
      ]);

      // After successfully marking all as read, remove them from the list
      setTimeout(() => {
        setNotifications((prev) => prev.filter((notif) => !notificationIdsToRemove.includes(notif.id)));
      }, 500);

    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
      // Revert the read status if backend call failed
      setNotifications((prev) =>
        prev.map((notif) => {
          if (notificationIdsToRemove.includes(notif.id)) {
            return { ...notif, read: false };
          }
          return notif;
        })
      );
      fetchBackendNotifications();
    }
  }, [fetchBackendNotifications, user]);

  const clearNotification = useCallback(async (notificationId: string) => {
    // Mark as read first
    await markAsRead(notificationId);
    // Then remove it from the list
    setTimeout(() => {
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
    }, 300);
  }, [markAsRead]);

  const clearAll = () => {
    setNotifications([]);
    if (user) {
      localStorage.removeItem(`notifications_${user.id}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // ✅ CRITICAL: Memoize refreshNotifications to prevent re-renders from creating new function references
  const refreshNotifications = useCallback(() => {
    return fetchBackendNotifications(true);
  }, [fetchBackendNotifications]);

  // ✅ Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    notifications,
    unreadCount,
    isLoading,
    error,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    refreshNotifications,
  }), [notifications, unreadCount, isLoading, error, markAsRead, markAllAsRead, clearNotification, refreshNotifications]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
