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
  type: 'leave' | 'task' | 'info' | 'warning' | 'shift' | 'salary';
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
  pass_details: string | {
    from?: number;
    to?: number;
    note?: string;
  } | null;
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

type BackendSalaryNotification = {
  notification_id: number;
  user_id: number;
  salary_id: number;
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
  const salaryUnreadCountRef = useRef<number>(0);
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
    // Parse pass_details - can be string (JSON) or object
    let passDetails: { from?: number; to?: number; note?: string } | null = null;

    if (notification.pass_details) {
      if (typeof notification.pass_details === 'string') {
        try {
          passDetails = JSON.parse(notification.pass_details);
        } catch (error) {
          console.error('Failed to parse task pass details', error);
          passDetails = null;
        }
      } else if (typeof notification.pass_details === 'object' && notification.pass_details !== null) {
        // Already an object, use it directly
        passDetails = notification.pass_details;
      }
    }

    const fromValue = passDetails?.from;
    const toValue = passDetails?.to;
    const noteValue = passDetails?.note;

    // ✅ Filter: only show notifications for the current user
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) {
      // This notification is not for the current user, filter it out
      debugLog('Filtering out task notification - not for current user', { notificationUserId, currentUserId });
      return null;
    }

    // ✅ Filter: Don't show if user assigned task to themselves (from === to === user_id)
    // But still show if user received task from someone else (from !== user_id, to === user_id)
    if (fromValue !== undefined && toValue !== undefined &&
      String(fromValue) === notificationUserId && String(toValue) === notificationUserId) {
      debugLog('Filtering out task notification - self-assigned task', { fromValue, toValue, notificationUserId });
      return null;
    }

    debugLog('Mapping task notification', {
      id: notification.notification_id,
      title: notification.title,
      is_read: notification.is_read,
      from: fromValue,
      to: toValue
    });

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
      const [taskResult, leaveResult, shiftResult, salaryResult, salaryUnreadResult] = await Promise.allSettled([
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
        fetch(`${API_BASE_URL}/salary/notifications`, {
          headers: {
            Authorization: authHeader,
          },
          signal,
        }).catch(err => {
          // Silently handle network errors and aborts
          if (import.meta.env.DEV && err.name !== 'AbortError') {
            console.warn('Salary notifications fetch failed:', err.message);
          }
          return { ok: false, status: 0 } as Response;
        }),
        fetch(`${API_BASE_URL}/salary/notifications/unread/count`, {
          headers: {
            Authorization: authHeader,
          },
          signal,
        }).catch(err => {
          // Silently handle network errors and aborts
          if (import.meta.env.DEV && err.name !== 'AbortError') {
            console.warn('Salary unread count fetch failed:', err.message);
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
      if (salaryResult.status === 'fulfilled' && salaryResult.value.status === 401) {
        hasUnauthorized = true;
      }
      if (salaryUnreadResult.status === 'fulfilled' && salaryUnreadResult.value.status === 401) {
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
      const salaryData: BackendSalaryNotification[] = [];

      // Handle task notifications
      if (taskResult.status === 'fulfilled' && taskResult.value.ok) {
        try {
          const data = await taskResult.value.json();
          debugLog('Task notifications API response:', data);

          // API returns direct array: [{ notification_id, user_id, task_id, ... }]
          if (Array.isArray(data)) {
            // Validate each item has required fields before adding
            const validNotifications = data.filter((item: unknown) =>
              item &&
              typeof item === 'object' &&
              'notification_id' in item &&
              'user_id' in item &&
              'task_id' in item &&
              'is_read' in item
            );
            taskData.push(...validNotifications as BackendTaskNotification[]);
          } else if (data && typeof data === 'object') {
            // Handle wrapped responses (fallback)
            if (Array.isArray(data.notifications)) {
              taskData.push(...(data.notifications as BackendTaskNotification[]));
            } else if (Array.isArray(data.data)) {
              taskData.push(...(data.data as BackendTaskNotification[]));
            }
          }
          debugLog('Parsed task notifications:', taskData.length);
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

          // API returns direct array: [{ notification_id, user_id, leave_id, ... }]
          if (Array.isArray(data)) {
            // Validate each item has required fields before adding
            const validNotifications = data.filter((item: unknown) =>
              item &&
              typeof item === 'object' &&
              'notification_id' in item &&
              'user_id' in item &&
              'leave_id' in item &&
              'is_read' in item
            );
            leaveData.push(...validNotifications as BackendLeaveNotification[]);
          } else if (data && typeof data === 'object') {
            // Handle wrapped responses (fallback)
            if (Array.isArray(data.notifications)) {
              leaveData.push(...(data.notifications as BackendLeaveNotification[]));
            } else if (Array.isArray(data.data)) {
              leaveData.push(...(data.data as BackendLeaveNotification[]));
            }
          }
          debugLog('Parsed leave notifications:', leaveData.length);
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

      // Handle salary notifications
      if (salaryResult.status === 'fulfilled' && salaryResult.value.ok) {
        try {
          const data = await salaryResult.value.json();
          debugLog('Salary notifications API response:', data);
          if (Array.isArray(data)) {
            salaryData.push(...data);
          } else if (data && typeof data === 'object') {
            if (Array.isArray(data.notifications)) {
              salaryData.push(...data.notifications);
            } else if (Array.isArray(data.data)) {
              salaryData.push(...data.data);
            }
          }
          debugLog('Parsed salary notifications:', salaryData);
        } catch (error) {
          if (import.meta.env.DEV && !(error instanceof Error && error.name === 'AbortError')) {
            console.error('Failed to parse salary notifications', error);
          }
        }
      } else if (salaryResult.status === 'rejected') {
        if (import.meta.env.DEV && salaryResult.reason?.name !== 'AbortError' && !salaryResult.reason?.message?.includes('fetch')) {
          console.error('Failed to fetch salary notifications:', salaryResult.reason);
        }
      } else if (salaryResult.status === 'fulfilled') {
        debugLog('Salary notifications API returned non-OK status:', salaryResult.value.status);
      }

      // Handle salary unread count
      if (salaryUnreadResult.status === 'fulfilled' && salaryUnreadResult.value.ok) {
        try {
          const data = await salaryUnreadResult.value.json();
          const backendCount = typeof data === 'number'
            ? data
            : typeof data?.count === 'number'
              ? data.count
              : Array.isArray(data?.data)
                ? data.data.length
                : 0;
          salaryUnreadCountRef.current = backendCount;
          debugLog('Salary unread count:', backendCount);
        } catch (error) {
          if (import.meta.env.DEV && !(error instanceof Error && error.name === 'AbortError')) {
            console.error('Failed to parse salary unread count', error);
          }
        }
      }

      // Filter out read notifications - only show unread ones
      const backendNotifications = [
        ...taskData
          .filter(n => !n.is_read) // Only unread notifications
          .map(n => mapBackendTaskNotification(n, user.id))
          .filter((n): n is Notification => n !== null),
        ...leaveData
          .filter(n => !n.is_read) // Only unread notifications
          .map(n => mapBackendLeaveNotification(n, user.id))
          .filter((n): n is Notification => n !== null),
        ...shiftData
          .filter(n => !n.is_read) // Only unread notifications
          .map(n => mapBackendShiftNotification(n, user.role, user.id))
          .filter((n): n is Notification => n !== null),
        ...salaryData
          .filter(n => !n.is_read) // Only unread notifications
          .map(n => ({
            id: `backend-salary-${n.notification_id}`,
            backendId: n.notification_id,
            userId: String(n.user_id),
            title: n.title,
            message: n.message,
            type: 'salary' as const,
            read: n.is_read,
            createdAt: n.created_at,
            metadata: {
              // keep flexible for future salary-specific routing if needed
            },
          } satisfies Notification)),
      ];

      // Get dismissed notification IDs from localStorage to filter them out
      const dismissedKey = `dismissed_notifications_${user.id}`;
      const dismissedIds = new Set<string>(
        JSON.parse(localStorage.getItem(dismissedKey) || '[]') as string[]
      );

      // Filter out dismissed notifications
      const filteredBackendNotifications = backendNotifications.filter((notification) => {
        if (notification.backendId) {
          return !dismissedIds.has(String(notification.backendId));
        }
        return true; // Keep local notifications without backend IDs
      });

      debugLog('Total backend notifications mapped:', backendNotifications.length);
      debugLog('Filtered dismissed notifications:', backendNotifications.length - filteredBackendNotifications.length);
      debugLog('Backend notifications after filtering:', filteredBackendNotifications.length);

      setNotifications((prev) => {
        const localOnly = prev.filter((notification) => !notification.backendId);
        const combined = [...filteredBackendNotifications, ...localOnly];
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
      } else if (backendType === 'salary') {
        endpoint = `${API_BASE_URL}/salary/notifications/${backendId}/read`;
      } else {
        return;
      }

      debugLog('Marking notification as read:', { endpoint, notificationId, backendId });

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification_id: backendId,
        }),
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
    const salaryIds: number[] = [];
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
            } else if (notif.type === 'salary') {
              salaryIds.push(notif.backendId);
            }
          }
        }
        if (notif.read) return notif;
        return { ...notif, read: true };
      })
    );

    if (!user || (taskIds.length === 0 && leaveIds.length === 0 && shiftIds.length === 0 && salaryIds.length === 0)) {
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
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notification_id: id,
            }),
          })
        ),
        ...leaveIds.map((id) =>
          fetch(`${API_BASE_URL}/leave/notifications/${id}/read`, {
            method: 'PUT',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notification_id: id,
            }),
          })
        ),
        ...shiftIds.map((id) =>
          fetch(`${API_BASE_URL}/shift/notifications/${id}/read`, {
            method: 'PUT',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notification_id: id,
            }),
          })
        ),
        ...salaryIds.map((id) =>
          fetch(`${API_BASE_URL}/salary/notifications/${id}/read`, {
            method: 'PUT',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notification_id: id,
            }),
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
    // Find the notification to get backend info
    let targetNotification: Notification | undefined;
    setNotifications((prev) => {
      targetNotification = prev.find(n => n.id === notificationId);
      return prev;
    });

    if (!targetNotification) {
      return;
    }

    // Mark as read in backend FIRST (before removing from UI) to ensure permanent removal
    if (user && targetNotification.backendId && targetNotification.type) {
      const authHeader = getAuthHeader();
      if (authHeader) {
        try {
          let endpoint = '';
          const backendType = targetNotification.type;
          const backendId = targetNotification.backendId;

          if (backendType === 'task') {
            endpoint = `${API_BASE_URL}/tasks/notifications/${backendId}/read`;
          } else if (backendType === 'leave') {
            endpoint = `${API_BASE_URL}/leave/notifications/${backendId}/read`;
          } else if (backendType === 'shift') {
            endpoint = `${API_BASE_URL}/shift/notifications/${backendId}/read`;
          } else if (backendType === 'salary') {
            endpoint = `${API_BASE_URL}/salary/notifications/${backendId}/read`;
          }

          if (endpoint) {
            const response = await fetch(endpoint, {
              method: 'PUT',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                notification_id: backendId,
              }),
            });

            if (!response.ok) {
              throw new Error(`Failed to mark notification as read (${response.status})`);
            }

            // Only remove from UI after successful backend update
            setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));

            // Store dismissed notification ID to prevent it from reappearing
            const dismissedKey = `dismissed_notifications_${user.id}`;
            const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]') as string[];
            if (!dismissed.includes(String(targetNotification.backendId))) {
              dismissed.push(String(targetNotification.backendId));
              // Keep only last 1000 dismissed IDs to prevent localStorage from growing too large
              if (dismissed.length > 1000) {
                dismissed.shift(); // Remove oldest
              }
              localStorage.setItem(dismissedKey, JSON.stringify(dismissed));
            }
          } else {
            // No backend ID, just remove from UI (local notification)
            setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
          }
        } catch (error) {
          console.error('Failed to mark notification as read when clearing', error);
          // Still remove from UI even if backend call fails - user dismissed it
          setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));

          // Store dismissed notification ID anyway to prevent reappearing
          if (targetNotification.backendId) {
            const dismissedKey = `dismissed_notifications_${user.id}`;
            const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]') as string[];
            if (!dismissed.includes(String(targetNotification.backendId))) {
              dismissed.push(String(targetNotification.backendId));
              // Keep only last 1000 dismissed IDs to prevent localStorage from growing too large
              if (dismissed.length > 1000) {
                dismissed.shift(); // Remove oldest
              }
              localStorage.setItem(dismissedKey, JSON.stringify(dismissed));
            }
          }
        }
      } else {
        // No auth header, just remove from UI
        setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      }
    } else {
      // No backend ID or user, just remove from UI (local notification)
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
    }
  }, [user]);

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
