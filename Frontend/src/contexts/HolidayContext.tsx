import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isSameDay } from 'date-fns';
import { apiService } from '@/lib/api';

export interface Holiday {
  id?: number;
  date: Date;
  name: string;
  description?: string;
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
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch holidays from backend
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
        description: h.description,
        created_at: h.created_at,
        updated_at: h.updated_at,
      }));
      
      setHolidays(convertedHolidays);
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
      setError('Failed to fetch holidays from server');
      // Fallback to empty array if API fails
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
      
      // Check if holiday already exists for this date
      const existingHoliday = holidays.find(h => isSameDay(h.date, holiday.date));
      if (existingHoliday) {
        throw new Error(`A holiday "${existingHoliday.name}" already exists for this date.`);
      }

      // Format date as ISO string for API
      const dateStr = holiday.date.toISOString().split('T')[0];
      
      const response = await apiService.createHoliday({
        date: dateStr,
        name: holiday.name,
        description: holiday.description,
      });

      // Add the new holiday to state
      const newHoliday: Holiday = {
        id: response.id,
        date: new Date(response.date),
        name: response.name,
        description: response.description,
        created_at: response.created_at,
        updated_at: response.updated_at,
      };

      setHolidays([...holidays, newHoliday]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add holiday';
      setError(errorMsg);
      throw err;
    }
  }, [holidays]);

  const removeHoliday = useCallback(async (id: number) => {
    try {
      setError(null);
      await apiService.deleteHoliday(id);
      setHolidays(holidays.filter(h => h.id !== id));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove holiday';
      setError(errorMsg);
      throw err;
    }
  }, [holidays]);

  const updateHoliday = useCallback(async (id: number, updates: Partial<Omit<Holiday, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      setError(null);
      
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

      const response = await apiService.updateHoliday(id, updateData);

      // Update the holiday in state
      setHolidays(holidays.map(h => 
        h.id === id 
          ? {
              id: response.id,
              date: new Date(response.date),
              name: response.name,
              description: response.description,
              created_at: response.created_at,
              updated_at: response.updated_at,
            }
          : h
      ));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update holiday';
      setError(errorMsg);
      throw err;
    }
  }, [holidays]);

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
