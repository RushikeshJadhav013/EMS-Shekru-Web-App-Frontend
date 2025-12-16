/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://staffly.space';
const FETCH_INTERVAL_MS = 60_000;
const POLLING_IDLE_TIMEOUT_MS = 5 * 60_000;

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

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
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
  const audioRef = useRef<{ play: () => void } | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const pollIdleTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Check if notifications are enabled
  const areNotificationsEnabled = () => {
    const stored = localStorage.getItem('notificationsEnabled');
    return stored === null ? true : stored === 'true';
  };

  // Load notifications from localStorage
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const stored = localStorage.getItem(`notifications_${user.id}`);
    if (stored) {
      try {
        const parsed: Notification[] = JSON.parse(stored);
        setNotifications(parsed);
      } catch (error) {
        console.error('Failed to parse stored notifications', error);
        localStorage.removeItem(`notifications_${user.id}`);
        setNotifications([]);
      }
    } else {
      setNotifications([]);
    }
  }, [user]);

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

  const playNotificationSound = () => {
    try {
      if (audioRef.current) {
        audioRef.current.play();
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const mapBackendTaskNotification = useCallback((notification: BackendTaskNotification): Notification => {
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

    return {
      id: `backend-task-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: String(notification.user_id),
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

  const mapBackendLeaveNotification = useCallback((notification: BackendLeaveNotification): Notification => {
    return {
      id: `backend-leave-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: String(notification.user_id),
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

  const mapBackendShiftNotification = useCallback((notification: BackendShiftNotification, userRole?: string): Notification => {
    // Determine the team page route based on user role
    let teamRoute = '/employee/team';
    if (userRole === 'team_lead') {
      teamRoute = '/team_lead/team';
    } else if (userRole === 'employee') {
      teamRoute = '/employee/team';
    }

    return {
      id: `backend-shift-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: String(notification.user_id),
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
  }, []);

  const fetchBackendNotifications = useCallback(async () => {
    if (!user) return;
    
    // Check if notifications are enabled
    if (!areNotificationsEnabled()) {
      return;
    }
    
    const authHeader = getAuthHeader();
    if (!authHeader) {
      stopPolling();
      return;
    }

    // ✅ Validate token exists and is not empty
    const token = localStorage.getItem('token');
    if (!token || token.trim() === '') {
      stopPolling();
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

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
          taskData.push(...data);
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
      }

      // Handle leave notifications
      if (leaveResult.status === 'fulfilled' && leaveResult.value.ok) {
        try {
          const data = await leaveResult.value.json();
          leaveData.push(...data);
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
      }

      // Handle shift notifications
      if (shiftResult.status === 'fulfilled' && shiftResult.value.ok) {
        try {
          const data = await shiftResult.value.json();
          shiftData.push(...data);
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
      }

      const backendNotifications = [
        ...taskData.map(mapBackendTaskNotification),
        ...leaveData.map(mapBackendLeaveNotification),
        ...shiftData.map(n => mapBackendShiftNotification(n, user.role)),
      ];

      setNotifications((prev) => {
        const localOnly = prev.filter((notification) => !notification.backendId);
        const combined = [...backendNotifications, ...localOnly];
        const uniqueById = new Map<string, Notification>();
        combined.forEach((notification) => {
          if (!uniqueById.has(notification.id)) {
            uniqueById.set(notification.id, notification);
          }
        });
        return Array.from(uniqueById.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  }, [mapBackendLeaveNotification, mapBackendTaskNotification, mapBackendShiftNotification, user, stopPolling]);

  const schedulePollingStop = useCallback(() => {
    if (pollIdleTimeoutRef.current) {
      window.clearTimeout(pollIdleTimeoutRef.current);
    }
    pollIdleTimeoutRef.current = window.setTimeout(() => {
      stopPolling();
    }, POLLING_IDLE_TIMEOUT_MS);
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    if (!user || document.visibilityState === 'hidden') {
      stopPolling();
      return;
    }
    
    // Check if notifications are enabled
    if (!areNotificationsEnabled()) {
      stopPolling();
      return;
    }

    // Check if we have a valid token before starting
    const authHeader = getAuthHeader();
    if (!authHeader) {
      stopPolling();
      return;
    }

    fetchBackendNotifications();

    if (!pollIntervalRef.current) {
      pollIntervalRef.current = window.setInterval(fetchBackendNotifications, FETCH_INTERVAL_MS);
    }

    schedulePollingStop();
  }, [fetchBackendNotifications, schedulePollingStop, stopPolling, user]);

  useEffect(() => {
    if (!user) {
      stopPolling();
      return;
    }

    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };

    const handleUserActivity = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      stopPolling();
      // Abort any pending fetch requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [startPolling, stopPolling, user]);

  const addNotification = (notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) => {
    if (!user) return;
    
    // Check if notifications are enabled
    if (!areNotificationsEnabled()) {
      return;
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
    
    // First, mark as read in local state
    setNotifications((prev) =>
      prev.map((notif) => {
        if (notif.id === notificationId) {
          backendId = notif.backendId;
          backendType = notif.type;
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

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to mark notification as read (${response.status})`);
      }
      
      // After successfully marking as read on backend, remove it from the list after a short delay
      setTimeout(() => {
        setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      }, 500); // 500ms delay to allow smooth UI transition
      
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
      fetchBackendNotifications();
    }
  }, [fetchBackendNotifications, user]);

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
    // First mark as read, then remove
    await markAsRead(notificationId);
    // The markAsRead function will handle the removal after marking as read
  }, [markAsRead]);

  const clearAll = () => {
    setNotifications([]);
    if (user) {
      localStorage.removeItem(`notifications_${user.id}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
        refreshNotifications: fetchBackendNotifications,
      }}
    >
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
