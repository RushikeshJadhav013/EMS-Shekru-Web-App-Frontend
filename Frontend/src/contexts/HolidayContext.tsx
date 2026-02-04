import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isSameDay } from 'date-fns';
import { apiService } from '@/lib/api';
import { useAuth } from './AuthContext';

export interface Holiday {
  id?: number;
  date: Date;
  name: string;
  description?: string;
  is_recurring?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface HolidayContextType {
  holidays: Holiday[];
  addHoliday: (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  removeHoliday: (id: number) => Promise<void>;
  updateHoliday: (id: number, holiday: Partial<Omit<Holiday, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  isHoliday: (date: Date) => boolean;
  getHolidayName: (date: Date) => string | undefined;
  refreshHolidays: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const HolidayContext = createContext<HolidayContextType | undefined>(undefined);

export const HolidayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch holidays from backend - always fetch from backend, never use localStorage
  const fetchHolidays = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.getHolidays();
      
      // Convert API response to Holiday objects
      const convertedHolidays: Holiday[] = response.map((h: any) => ({
        id: h.id,
        date: new Date(h.date),
        name: h.name,
        description: h.description || '',
        is_recurring: h.is_recurring ?? false,
        created_at: h.created_at,
        updated_at: h.updated_at || undefined,
      }));
      
      // Remove duplicates by date - keep the first occurrence (by ID if available)
      const uniqueHolidays = convertedHolidays.reduce((acc: Holiday[], current) => {
        const existingIndex = acc.findIndex(h => isSameDay(h.date, current.date));
        if (existingIndex === -1) {
          // No duplicate found, add it
          acc.push(current);
        } else {
          // Duplicate found - keep the one with the lower ID (older/primary record)
          const existing = acc[existingIndex];
          if (current.id && existing.id && current.id < existing.id) {
            acc[existingIndex] = current;
          }
        }
        return acc;
      }, []);
      
      setHolidays(uniqueHolidays);
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
      setError('Failed to fetch holidays from server');
      // Fallback to empty array if API fails - never use localStorage
      setHolidays([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const addHoliday = useCallback(async (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null);
      
      // Check if user is admin
      if (user?.role !== 'admin') {
        throw new Error('Only administrators can add holidays.');
      }
      
      // Check if holiday already exists for this date (both in local state and backend)
      const existingHoliday = holidays.find(h => isSameDay(h.date, holiday.date));
      if (existingHoliday) {
        throw new Error(`A holiday "${existingHoliday.name}" already exists for this date.`);
      }

      // Format date as ISO string (YYYY-MM-DD) for API
      const dateStr = holiday.date.toISOString().split('T')[0];
      
      // Prepare data for API - ensure all required fields are present
      const holidayData = {
        date: dateStr,
        name: holiday.name.trim(),
        description: holiday.description?.trim() || '',
        is_recurring: holiday.is_recurring ?? false,
      };
      
      const response = await apiService.createHoliday(holidayData);

      // Refresh holidays from backend to ensure consistency and avoid duplicates
      await fetchHolidays();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add holiday';
      setError(errorMsg);
      throw err;
    }
  }, [holidays, user?.role, fetchHolidays]);

  const removeHoliday = useCallback(async (id: number) => {
    try {
      setError(null);
      
      // Check if user is admin
      if (user?.role !== 'admin') {
        throw new Error('Only administrators can remove holidays.');
      }
      
      await apiService.deleteHoliday(id);
      
      // Refresh holidays from backend to ensure consistency
      await fetchHolidays();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove holiday';
      setError(errorMsg);
      throw err;
    }
  }, [user?.role, fetchHolidays]);

  const updateHoliday = useCallback(async (id: number, updates: Partial<Omit<Holiday, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      setError(null);
      
      // Check if user is admin
      if (user?.role !== 'admin') {
        throw new Error('Only administrators can update holidays.');
      }
      
      // Check for duplicate date if date is being updated
      if (updates.date) {
        const existingHoliday = holidays.find(h => h.id !== id && isSameDay(h.date, updates.date!));
        if (existingHoliday) {
          throw new Error(`A holiday "${existingHoliday.name}" already exists for this date.`);
        }
      }
      
      const updateData: any = {};
      if (updates.date) {
        updateData.date = updates.date.toISOString().split('T')[0];
      }
      if (updates.name) {
        updateData.name = updates.name;
      }
      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }
      if (updates.is_recurring !== undefined) {
        updateData.is_recurring = updates.is_recurring;
      }

      await apiService.updateHoliday(id, updateData);

      // Refresh holidays from backend to ensure consistency
      await fetchHolidays();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update holiday';
      setError(errorMsg);
      throw err;
    }
  }, [holidays, user?.role, fetchHolidays]);

  const isHoliday = (date: Date): boolean => {
    return holidays.some(h => isSameDay(h.date, date));
  };

  const getHolidayName = (date: Date): string | undefined => {
    const holiday = holidays.find(h => isSameDay(h.date, date));
    return holiday?.name;
  };

  const refreshHolidays = useCallback(async () => {
    await fetchHolidays();
  }, [fetchHolidays]);

  return (
    <HolidayContext.Provider
      value={{
        holidays,
        addHoliday,
        removeHoliday,
        updateHoliday,
        isHoliday,
        getHolidayName,
        refreshHolidays,
        isLoading,
        error,
      }}
    >
      {children}
    </HolidayContext.Provider>
  );
};

export const useHolidays = () => {
  const context = useContext(HolidayContext);
  if (!context) {
    throw new Error('useHolidays must be used within a HolidayProvider');
  }
  return context;
};
