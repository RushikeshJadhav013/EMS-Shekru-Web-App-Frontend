/**
 * Navigation utility functions for role-based and company-scoped routing.
 * Ensures consistent routing across Admin, HR, Manager, Team Lead, and Employee.
 */

/**
 * Normalizes user roles across the application.
 * E.g., 'teamlead' -> 'team_lead', 'staff' -> 'employee'.
 */
export const normalizeRole = (role?: string | null): string => {
  if (!role) return 'employee';
  const clean = role.toLowerCase().trim();
  if (clean === 'teamlead') return 'team_lead';
  if (clean === 'staff') return 'employee';
  return clean;
};

/**
 * Retrieves the currently active company slug.
 * Checks localStorage first, and falls back to window.location pathname inspection.
 */
export const getActiveCompanySlug = (): string | null => {
  try {
    const slug = localStorage.getItem('company_slug');
    if (slug && slug.trim() && slug !== 'null' && slug !== 'undefined') {
      return slug.trim();
    }
  } catch {
    // In case localStorage is inaccessible
  }

  // Fallback: Check if the first path segment is a company slug (not a known role or root page)
  try {
    if (typeof window !== 'undefined' && window.location?.pathname) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const knownPrefixes = ['admin', 'hr', 'manager', 'team_lead', 'teamlead', 'employee', 'staff', 'login', 'salary', 'profile', 'settings', 'meetings', 'expenses'];
      if (parts.length > 0 && !knownPrefixes.includes(parts[0].toLowerCase())) {
        return parts[0];
      }
    }
  } catch {
    // Ignore fallback errors
  }

  return null;
};

/**
 * Generates the base path for a user's role, preserving company slug if present.
 * E.g., '/pvg-pvt-ltd/hr' or '/hr'.
 */
export const getRoleBasePath = (role?: string | null, customSlug?: string | null): string => {
  const effectiveRole = normalizeRole(role);
  const slug = customSlug !== undefined ? customSlug : getActiveCompanySlug();
  return slug ? `/${slug}/${effectiveRole}` : `/${effectiveRole}`;
};

/**
 * Generates the Chat module URL and route state for any role.
 * - Uses the actual chat ID as the primary path identifier.
 * - Uses senderId as a query-param fallback for individual conversations (survives page refresh).
 */
export const getChatNavigationUrl = (
  role?: string | null,
  chatId?: string | number | null,
  senderId?: string | number | null,
  customSlug?: string | null
): { url: string; state?: { senderId?: string; chatId?: string } } => {
  const base = getRoleBasePath(role, customSlug);
  const cleanChatId = chatId ? String(chatId).trim() : null;
  const cleanSenderId = senderId ? String(senderId).trim() : null;

  // Primary: Actual chat ID in the route path
  if (cleanChatId && cleanChatId !== 'null' && cleanChatId !== 'undefined') {
    return {
      url: `${base}/chat/${cleanChatId}`,
      state: {
        chatId: cleanChatId,
        senderId: cleanSenderId || undefined,
      },
    };
  }

  // Fallback: Individual conversation by senderId (query param persists on refresh)
  if (cleanSenderId && cleanSenderId !== 'null' && cleanSenderId !== 'undefined') {
    return {
      url: `${base}/chat?senderId=${encodeURIComponent(cleanSenderId)}`,
      state: {
        senderId: cleanSenderId,
      },
    };
  }

  // General chat module
  return {
    url: `${base}/chat`,
  };
};

/**
 * Generates the Attendance Management URL with specific tab and optional parameters (e.g. wfhId).
 * Preserves company slug and user role consistently for all roles.
 */
export const getAttendanceNavigationUrl = (
  role?: string | null,
  tab: string = 'wfh_requests',
  params?: Record<string, string | number | undefined | null>,
  customSlug?: string | null
): string => {
  const base = getRoleBasePath(role, customSlug);
  const searchParams = new URLSearchParams();

  if (tab) {
    searchParams.set('tab', tab);
  }

  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && String(val).trim()) {
        searchParams.set(key, String(val).trim());
      }
    });
  }

  const query = searchParams.toString();
  return `${base}/attendance${query ? `?${query}` : ''}`;
};
