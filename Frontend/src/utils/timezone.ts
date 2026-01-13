/**
 * Timezone Utility for Asia/Kolkata (IST - Indian Standard Time)
 * 
 * This utility provides consistent timezone handling across the application.
 * All dates are displayed in Asia/Kolkata timezone (UTC+5:30).
 */

import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// Application timezone constant
export const APP_TIMEZONE = 'Asia/Kolkata';

/**
 * Convert a date to IST timezone
 * @param date - Date string, Date object, or timestamp
 * @returns Date object in IST timezone
 */
export function toIST(date: string | Date | number): Date {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return toZonedTime(dateObj, APP_TIMEZONE);
}

/**
 * Convert IST date to UTC for API calls
 * @param date - Date in IST
 * @returns Date object in UTC
 */
export function fromIST(date: Date): Date {
  return fromZonedTime(date, APP_TIMEZONE);
}

/**
 * Format a date in IST timezone
 * @param date - Date string, Date object, or timestamp
 * @param formatStr - Format string (date-fns format)
 * @returns Formatted date string in IST
 */
export function formatIST(date: string | Date | number, formatStr: string = 'PPP'): string {
  const istDate = toIST(date);
  return dateFnsFormat(istDate, formatStr);
}

/**
 * Format a date with time in IST timezone
 * @param date - Date string, Date object, or timestamp
 * @param formatStr - Format string (default: 'MMM dd, yyyy HH:mm')
 * @returns Formatted date-time string in IST
 */
export function formatDateTimeIST(date: string | Date | number, formatStr: string = 'MMM dd, yyyy HH:mm'): string {
  return formatIST(date, formatStr);
}

/**
 * Format time only in IST timezone
 * @param date - Date string, Date object, or timestamp
 * @param formatStr - Format string (default: 'HH:mm:ss')
 * @returns Formatted time string in IST
 */
export function formatTimeIST(date: string | Date | number, formatStr: string = 'HH:mm:ss'): string {
  return formatIST(date, formatStr);
}

/**
 * Format date only in IST timezone
 * @param date - Date string, Date object, or timestamp
 * @param formatStr - Format string (default: 'yyyy-MM-dd')
 * @returns Formatted date string in IST
 */
export function formatDateIST(date: string | Date | number, formatStr: string = 'yyyy-MM-dd'): string {
  return formatIST(date, formatStr);
}

/**
 * Format relative time (e.g., "2 hours ago") in IST
 * @param date - Date string, Date object, or timestamp
 * @returns Relative time string
 */
export function formatDistanceToNowIST(date: string | Date | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return dateFnsFormatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Format a timestamp specifically for chat UI in IST
 * Today: "10:40 AM"
 * Yesterday: "Yesterday"
 * Older: "Jan 15"
 */
export function formatChatTimestampIST(date: string | Date | number): string {
  const istDate = toIST(date);
  const now = nowIST();

  const isToday = formatDateIST(istDate) === formatDateIST(now);
  if (isToday) {
    return dateFnsFormat(istDate, 'h:mm a');
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = formatDateIST(istDate) === formatDateIST(yesterday);
  if (isYesterday) {
    return 'Yesterday';
  }

  const isThisYear = istDate.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return dateFnsFormat(istDate, 'MMM d');
  }

  return dateFnsFormat(istDate, 'MM/dd/yy');
}

/**
 * Get current date-time in IST
 * @returns Current Date object in IST timezone
 */
export function nowIST(): Date {
  return toIST(new Date());
}

/**
 * Get current date in IST as string
 * @param formatStr - Format string (default: 'yyyy-MM-dd')
 * @returns Current date string in IST
 */
export function todayIST(formatStr: string = 'yyyy-MM-dd'): string {
  return formatIST(new Date(), formatStr);
}

/**
 * Parse a date string and convert to IST
 * Handles various date formats from backend
 * @param dateStr - Date string from backend
 * @returns Date object in IST
 */
export function parseToIST(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  try {
    // If the string doesn't have timezone info, assume it's UTC
    let date: Date;
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      date = new Date(dateStr + 'Z');
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) {
      return null;
    }

    return toIST(date);
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * Format a date-time string from backend to IST display format
 * @param dateStr - Date string from backend
 * @param formatStr - Format string (default: 'MMM dd, yyyy HH:mm')
 * @returns Formatted string or fallback text
 */
export function formatBackendDateIST(
  dateStr: string | null | undefined,
  formatStr: string = 'MMM dd, yyyy HH:mm',
  fallback: string = 'N/A'
): string {
  const date = parseToIST(dateStr);
  return date ? dateFnsFormat(date, formatStr) : fallback;
}

/**
 * Convert a date and time string to IST formatted string
 * Useful for attendance records where date and time come separately
 * NOTE: Backend sends times in IST already (without timezone indicator)
 * @param dateStr - Date string (e.g., '2024-01-15') - used only when timeStr is just time
 * @param timeStr - Time string (e.g., '09:30:00' or full ISO string like '2024-01-15T22:27:00' in IST)
 * @param formatStr - Format string (default: 'HH:mm:ss')
 * @returns Formatted time string in IST
 */
export function formatDateTimeComponentsIST(
  dateStr: string,
  timeStr: string | null | undefined,
  formatStr: string = 'HH:mm:ss'
): string {
  if (!timeStr) return 'N/A';

  try {
    let date: Date;

    // Check if timeStr is a full ISO datetime (contains T or space with time)
    if (timeStr.includes('T') || (timeStr.includes(' ') && timeStr.includes(':'))) {
      // It's a full ISO datetime string from backend
      // Backend sends times in IST without timezone indicator

      // Check if it has explicit timezone info
      if (timeStr.includes('Z') || timeStr.includes('+') || /\-\d{2}:\d{2}$/.test(timeStr)) {
        // Has timezone info - parse as UTC and convert to IST
        date = new Date(timeStr);
        return formatIST(date, formatStr);
      } else {
        // No timezone info - backend sent IST time without Z
        // Parse as local time and format directly without conversion
        // Extract the time components
        const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
        if (match) {
          const [, year, month, day, hours, minutes, seconds] = match;
          // Create a date object and format it directly
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
          return dateFnsFormat(date, formatStr);
        }
        // Fallback: parse as-is
        date = new Date(timeStr);
      }
    } else {
      // It's just a time string (HH:mm:ss format)
      // Combine with date - backend sends IST times
      const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const [, hours, minutes, seconds] = match;
        const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
          return dateFnsFormat(date, formatStr);
        }
      }
      // Fallback
      const combinedStr = `${dateStr}T${timeStr}`;
      date = new Date(combinedStr);
    }

    if (isNaN(date.getTime())) {
      return 'Invalid time';
    }

    // Format the date directly (already in IST)
    return dateFnsFormat(date, formatStr);
  } catch (error) {
    console.error('Error formatting date-time components:', error);
    return 'Error';
  }
}

/**
 * Get IST timezone offset string (e.g., '+05:30')
 * @returns Timezone offset string
 */
export function getISTOffset(): string {
  return '+05:30';
}

/**
 * Get IST timezone name
 * @returns Timezone name
 */
export function getISTName(): string {
  return 'IST (India Standard Time)';
}
