/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '@/lib/api';

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
  type: 'leave' | 'task' | 'info' | 'warning' | 'shift' | 'wfh' | 'meeting' | 'salary' | 'project' | 'chat' | 'attendance' | 'hiring';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
  metadata?: {
    leaveId?: string;
    taskId?: string;
    requesterId?: string;
    requesterName?: string;
    shiftAssignmentId?: string;
    wfhId?: string;
    meetingId?: string;
    chatId?: string;
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
  if (import.meta.env.DEV && true) {
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

type BackendWFHNotification = {
  notification_id: number;
  user_id: number;
  wfh_id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type BackendMeetingNotification = {
  notification_id: number;
  user_id: number;
  meeting_id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type BackendSalaryNotification = {
  notification_id: number;
  user_id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type BackendProjectNotification = {
  notification_id: number;
  user_id: number;
  project_id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type BackendChatNotification = {
  notification_id: number;
  user_id: number;
  chat_id: string;
  msg_id: string;
  sender_id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type BackendAttendanceNotification = {
  notification_id: number;
  user_id: number;
  attendance_id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type BackendHiringNotification = {
  notification_id: number;
  user_id: number;
  candidate_id?: number;
  vacancy_id?: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

const getAuthHeader = (): Record<string, string> | null => {
  const storedToken = localStorage.getItem('token') || '';
  if (!storedToken) return null;
  const token = storedToken.startsWith('Bearer ') ? storedToken : `Bearer ${storedToken}`;

  const headers: Record<string, string> = {
    Authorization: token
  };

  const branchId = localStorage.getItem('branchId');
  const companyId = localStorage.getItem('companyId');

  if (branchId) headers['X-Branch-Id'] = branchId;
  if (companyId) headers['X-Company-Id'] = companyId;

  return headers;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const pollIdleTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const lastFetchRef = useRef<number>(0);
  const previousUnreadCountRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const initialFetchDoneRef = useRef<boolean>(false);

  const areNotificationsEnabled = () => {
    const stored = localStorage.getItem('notificationsEnabled');
    return stored === null ? true : stored === 'true';
  };

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
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const localNotifications = notifications.filter((notification) => !notification.backendId);
    if (localNotifications.length > 0) {
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify(localNotifications));
    } else {
      localStorage.removeItem(`notifications_${user.id}`);
    }
  }, [notifications, user]);

  const playNotificationSound = useCallback(() => {
    try {
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
      setTimeout(() => oscillator.stop(), 500);
    } catch (e) {
      console.warn('Audio feedback failed', e);
    }
  }, []);

  const mapBackendTaskNotification = useCallback((notification: BackendTaskNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    const passDetails = notification.pass_details;
    let fromValue: any, toValue: any, noteValue: any;

    if (typeof passDetails === 'string') {
      try {
        const parsed = JSON.parse(passDetails);
        fromValue = parsed.from;
        toValue = parsed.to;
        noteValue = parsed.note;
      } catch (e) {
        // ignore
      }
    } else if (passDetails) {
      fromValue = passDetails.from;
      toValue = passDetails.to;
      noteValue = passDetails.note;
    }

    if (fromValue !== undefined && toValue !== undefined &&
      String(fromValue) === notificationUserId && String(toValue) === notificationUserId) {
      return null;
    }

    return {
      id: `backend-task-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'task',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: userRole ? `/${userRole}/tasks` : '/tasks',
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

  const mapBackendLeaveNotification = useCallback((notification: BackendLeaveNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) return null;

    return {
      id: `backend-leave-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'leave',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: userRole ? `/${userRole}/leaves` : '/leaves',
      metadata: {
        leaveId: String(notification.leave_id),
      },
    };
  }, []);

  const mapBackendShiftNotification = useCallback((notification: BackendShiftNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) return null;

    const teamRoute = (userRole === 'team_lead') ? '/team_lead/team' : '/employee/team';

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

  const mapBackendWFHNotification = useCallback((notification: BackendWFHNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) return null;

    return {
      id: `backend-wfh-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'wfh',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: userRole ? `/${userRole}/wfh` : '/wfh',
      metadata: {
        wfhId: String(notification.wfh_id),
      },
    };
  }, []);

  const mapBackendMeetingNotification = useCallback((notification: BackendMeetingNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) return null;

    return {
      id: `backend-meeting-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'meeting',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: '/meetings',
      metadata: {
        meetingId: String(notification.meeting_id),
      },
    };
  }, []);

  const mapBackendSalaryNotification = useCallback((notification: BackendSalaryNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) return null;

    return {
      id: `backend-salary-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'salary',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: '/salary',
    };
  }, []);

  const mapBackendProjectNotification = useCallback((notification: BackendProjectNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) return null;

    return {
      id: `backend-project-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'project',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: '/projects',
    };
  }, []);

  const mapBackendChatNotification = useCallback((notification: BackendChatNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) return null;

    return {
      id: `backend-chat-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'chat',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: '/admin/messages',
      metadata: {
        chatId: notification.chat_id,
      },
    };
  }, []);

  const mapBackendAttendanceNotification = useCallback((notification: BackendAttendanceNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) return null;

    return {
      id: `backend-attendance-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'attendance',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: userRole ? `/${userRole}/attendance` : '/attendance',
      metadata: {},
    };
  }, []);

  const mapBackendHiringNotification = useCallback((notification: BackendHiringNotification, userRole?: string, currentUserId?: string): Notification | null => {
    const notificationUserId = String(notification.user_id);
    if (currentUserId && notificationUserId !== currentUserId) return null;

    return {
      id: `backend-hiring-${notification.notification_id}`,
      backendId: notification.notification_id,
      userId: notificationUserId,
      title: notification.title,
      message: notification.message,
      type: 'hiring',
      read: notification.is_read,
      createdAt: notification.created_at,
      actionUrl: userRole ? `/${userRole}/hiring` : '/hiring',
      metadata: {},
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
    if (!user) return;
    if (!areNotificationsEnabled()) return;

    if (isFetchingRef.current) return;
    const now = Date.now();
    if (!isManualRefresh && (now - lastFetchRef.current) < MIN_FETCH_INTERVAL_MS) return;

    isFetchingRef.current = true;
    lastFetchRef.current = now;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    if (isManualRefresh) setIsLoading(true);
    setError(null);

    try {
      const currentSlug = localStorage.getItem('company_slug') || undefined;
      let slugsToFetch: (string | undefined)[] = [currentSlug];

      // Try to get all accessible companies for admins to fetch cross-tenant notifications
      const storedCompanies = localStorage.getItem('accessibleCompanies');
      if (storedCompanies) {
        try {
          const companies = JSON.parse(storedCompanies);
          if (Array.isArray(companies)) {
            const allSlugs = companies
              .map(c => c.company_slug)
              .filter(s => !!s && s !== currentSlug);
            slugsToFetch = [currentSlug, ...allSlugs];
          }
        } catch (e) {
          // ignore parse error
        }
      }

      const unwrap = <T,>(result: PromiseSettledResult<any>): T[] => {
        if (result.status === 'fulfilled' && result.value) {
          const val = result.value;
          if (Array.isArray(val)) return val;
          if (val.notifications && Array.isArray(val.notifications)) return val.notifications;
          if (val.data && Array.isArray(val.data)) return val.data;
          if (val.results && Array.isArray(val.results)) return val.results;
        }
        return [];
      };

      const allFetchedTasks: BackendTaskNotification[] = [];
      const allFetchedLeaves: BackendLeaveNotification[] = [];
      const allFetchedShifts: BackendShiftNotification[] = [];
      const allFetchedWFH: BackendWFHNotification[] = [];
      const allFetchedMeetings: BackendMeetingNotification[] = [];
      const allFetchedSalary: BackendSalaryNotification[] = [];
      const allFetchedProjects: BackendProjectNotification[] = [];
      const allFetchedChats: BackendChatNotification[] = [];
      const allFetchedAttendance: BackendAttendanceNotification[] = [];
      const allFetchedHiring: BackendHiringNotification[] = [];

      let hasAuthError = false;

      for (const slug of slugsToFetch) {
        const results = await Promise.allSettled([
          apiService.getTaskNotifications(slug),
          apiService.getLeaveNotifications(slug),
          apiService.getShiftNotifications(slug),
          apiService.getWFHNotifications(slug),
          apiService.getMeetingNotifications(slug),
          apiService.getSalaryNotifications(slug),
          apiService.getProjectNotifications(slug),
          apiService.getChatNotifications(slug),
          apiService.getAttendanceNotifications(slug),
          apiService.getHiringNotifications(slug),
        ]);

        if (results.some(r => r.status === 'rejected' && (r.reason?.status === 401 || r.reason?.status === 403))) {
          hasAuthError = true;
          continue;
        }

        allFetchedTasks.push(...unwrap<BackendTaskNotification>(results[0]));
        allFetchedLeaves.push(...unwrap<BackendLeaveNotification>(results[1]));
        allFetchedShifts.push(...unwrap<BackendShiftNotification>(results[2]));
        allFetchedWFH.push(...unwrap<BackendWFHNotification>(results[3]));
        allFetchedMeetings.push(...unwrap<BackendMeetingNotification>(results[4]));
        allFetchedSalary.push(...unwrap<BackendSalaryNotification>(results[5]));
        allFetchedProjects.push(...unwrap<BackendProjectNotification>(results[6]));
        allFetchedChats.push(...unwrap<BackendChatNotification>(results[7]));
        allFetchedAttendance.push(...unwrap<BackendAttendanceNotification>(results[8]));
        allFetchedHiring.push(...unwrap<BackendHiringNotification>(results[9]));
      }

      if (hasAuthError && slugsToFetch.length === 1) {
        stopPolling();
        return;
      }

      const currentUserId = String(user.id);
      const userRole = user.role;

      const backendNotifications: Notification[] = [
        ...allFetchedTasks.map(n => mapBackendTaskNotification(n, userRole, currentUserId)),
        ...allFetchedLeaves.map(n => mapBackendLeaveNotification(n, userRole, currentUserId)),
        ...allFetchedShifts.map(n => mapBackendShiftNotification(n, userRole, currentUserId)),
        ...allFetchedWFH.map(n => mapBackendWFHNotification(n, userRole, currentUserId)),
        ...allFetchedMeetings.map(n => mapBackendMeetingNotification(n, userRole, currentUserId)),
        ...allFetchedSalary.map(n => mapBackendSalaryNotification(n, userRole, currentUserId)),
        ...allFetchedProjects.map(n => mapBackendProjectNotification(n, userRole, currentUserId)),
        ...allFetchedChats.map(n => mapBackendChatNotification(n, userRole, currentUserId)),
        ...allFetchedAttendance.map(n => mapBackendAttendanceNotification(n, userRole, currentUserId)),
        ...allFetchedHiring.map(n => mapBackendHiringNotification(n, userRole, currentUserId)),
      ].filter((n): n is Notification => n !== null);

      const dismissedKey = `dismissed_notifications_${user.id}`;
      const dismissedIds = new Set<string>(JSON.parse(localStorage.getItem(dismissedKey) || '[]') as string[]);

      const filteredBackendNotifications = backendNotifications.filter((n) => !n.backendId || !dismissedIds.has(String(n.backendId)));

      setNotifications((prev) => {
        const localOnly = prev.filter((n) => !n.backendId);
        const combined = [...filteredBackendNotifications, ...localOnly];
        const uniqueById = new Map<string, Notification>();
        combined.forEach((n) => { if (!uniqueById.has(n.id)) uniqueById.set(n.id, n); });

        const sortedNotifications = Array.from(uniqueById.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const newUnreadCount = sortedNotifications.filter(n => !n.read).length;
        if (newUnreadCount > previousUnreadCountRef.current && previousUnreadCountRef.current > 0) {
          playNotificationSound();
        }
        previousUnreadCountRef.current = newUnreadCount;
        return sortedNotifications;
      });

      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setError('Failed to load notifications');
        if (!retryTimeoutRef.current) {
          retryTimeoutRef.current = window.setTimeout(() => {
            retryTimeoutRef.current = null;
            fetchBackendNotifications();
          }, RETRY_DELAY_MS);
        }
      }
    } finally {
      isFetchingRef.current = false;
      if (isManualRefresh) setIsLoading(false);
    }
  }, [user, playNotificationSound, mapBackendTaskNotification, mapBackendLeaveNotification, mapBackendShiftNotification, mapBackendWFHNotification, mapBackendMeetingNotification, mapBackendSalaryNotification, mapBackendProjectNotification, mapBackendChatNotification, mapBackendAttendanceNotification, mapBackendHiringNotification, stopPolling]);

  const schedulePollingStop = useCallback(() => {
    if (pollIdleTimeoutRef.current) window.clearTimeout(pollIdleTimeoutRef.current);
    pollIdleTimeoutRef.current = window.setTimeout(() => stopPolling(), POLLING_IDLE_TIMEOUT_MS);
  }, [stopPolling]);

  useEffect(() => {
    if (!user) {
      stopPolling();
      initialFetchDoneRef.current = false;
      isFetchingRef.current = false;
      return;
    }

    if (!initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true;
      fetchBackendNotifications(true);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchBackendNotifications(false);
      else stopPolling();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchBackendNotifications, stopPolling, user]);

  const addNotification = (notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) => {
    if (!user || !areNotificationsEnabled()) return;

    // Self-filter logic
    if ((notification.type === 'task' || notification.type === 'leave') && notification.metadata?.requesterId) {
      if (String(notification.metadata.requesterId) === String(user.id)) return;
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

    if ('Notification' in window && window.Notification.permission === 'granted') {
      new window.Notification(notification.title, { body: notification.message });
    }
  };

  const markAsRead = useCallback(async (notificationId: string) => {
    let target: Notification | undefined;
    setNotifications((prev) => {
      target = prev.find(n => n.id === notificationId);
      return prev.map(n => n.id === notificationId ? { ...n, read: true } : n);
    });

    if (!user || !target?.backendId || !target.type) return;

    try {
      await apiService.markNotificationAsRead(target.type, target.backendId);
    } catch (error) {
      console.error('Failed to mark notification as read', error);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: false } : n));
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    const toMark: { type: string, id: number }[] = [];
    const idsToRevert: string[] = [];

    setNotifications(prev => prev.map(n => {
      if (!n.read) {
        idsToRevert.push(n.id);
        if (n.backendId) toMark.push({ type: n.type, id: n.backendId });
        return { ...n, read: true };
      }
      return n;
    }));

    if (!user || toMark.length === 0) return;

    try {
      await Promise.allSettled(toMark.map(item => apiService.markNotificationAsRead(item.type, item.id)));
    } catch (error) {
      console.error('Failed to mark all as read', error);
      setNotifications(prev => prev.map(n => idsToRevert.includes(n.id) ? { ...n, read: false } : n));
    }
  }, [user]);

  const clearNotification = useCallback(async (notificationId: string) => {
    let target: Notification | undefined;
    setNotifications(prev => {
      target = prev.find(n => n.id === notificationId);
      return prev.filter(n => n.id !== notificationId);
    });

    if (user && target?.backendId) {
      const dismissedKey = `dismissed_notifications_${user.id}`;
      const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]') as string[];
      if (!dismissed.includes(String(target.backendId))) {
        dismissed.push(String(target.backendId));
        if (dismissed.length > 1000) dismissed.shift();
        localStorage.setItem(dismissedKey, JSON.stringify(dismissed));
      }
      try {
        await apiService.markNotificationAsRead(target.type, target.backendId);
      } catch (e) {
        // ignore
      }
    }
  }, [user]);

  const clearAll = () => {
    setNotifications([]);
    if (user) localStorage.removeItem(`notifications_${user.id}`);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const refreshNotifications = useCallback(() => fetchBackendNotifications(true), [fetchBackendNotifications]);

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
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
