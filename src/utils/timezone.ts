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
  const istDate = toIST(date);
  return dateFnsFormatDistanceToNow(istDate, { addSuffix: true });
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
 * @param dateStr - Date string (e.g., '2024-01-15')
 * @param timeStr - Time string (e.g., '09:30:00' or full ISO string)
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
    
    // Check if timeStr is a full ISO datetime
    if (timeStr.includes('T') || timeStr.includes(' ')) {
      date = new Date(timeStr);
      if (!timeStr.includes('Z') && !timeStr.includes('+')) {
        // Assume UTC if no timezone
        date = new Date(timeStr + 'Z');
      }
    } else {
      // It's just a time string, combine with date
      const combinedStr = `${dateStr}T${timeStr}Z`;
      date = new Date(combinedStr);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid time';
    }
    
    return formatIST(date, formatStr);
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
