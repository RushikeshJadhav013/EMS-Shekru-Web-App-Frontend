import React, { createContext, useContext, useState, useEffect } from 'react';
import { isSameDay } from 'date-fns';

export interface Holiday {
  date: Date;
  name: string;
  description?: string;
}

interface HolidayContextType {
  holidays: Holiday[];
  addHoliday: (holiday: Holiday) => void;
  removeHoliday: (date: Date) => void;
  isHoliday: (date: Date) => boolean;
  getHolidayName: (date: Date) => string | undefined;
  refreshHolidays: () => void;
}

const HolidayContext = createContext<HolidayContextType | undefined>(undefined);

const STORAGE_KEY = 'companyHolidays';

const loadStoredHolidays = (): Holiday[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { date: string; name: string; description?: string }[];
      return parsed.map((h) => ({
        date: new Date(h.date),
        name: h.name,
        description: h.description,
      }));
    }
  } catch (error) {
    console.error('Failed to parse stored holidays:', error);
  }
  
  // Default holidays
  return [
    { date: new Date(2025, 0, 1), name: 'New Year' },
    { date: new Date(2025, 1, 26), name: 'Republic Day' },
  ];
};

export const HolidayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [holidays, setHolidays] = useState<Holiday[]>(loadStoredHolidays());

  // Save holidays to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        holidays.map((h) => ({
          date: h.date.toISOString(),
          name: h.name,
          description: h.description,
        }))
      )
    );
  }, [holidays]);

  const addHoliday = (holiday: Holiday) => {
    // Check if holiday already exists for this date
    const existingHoliday = holidays.find(h => isSameDay(h.date, holiday.date));
    if (existingHoliday) {
      throw new Error(`A holiday "${existingHoliday.name}" already exists for this date.`);
    }

    setHolidays([...holidays, holiday]);
  };

  const removeHoliday = (date: Date) => {
    setHolidays(holidays.filter(h => !isSameDay(h.date, date)));
  };

  const isHoliday = (date: Date): boolean => {
    return holidays.some(h => isSameDay(h.date, date));
  };

  const getHolidayName = (date: Date): string | undefined => {
    const holiday = holidays.find(h => isSameDay(h.date, date));
    return holiday?.name;
  };

  const refreshHolidays = () => {
    const stored = loadStoredHolidays();
    setHolidays(stored);
  };

  return (
    <HolidayContext.Provider
      value={{
        holidays,
        addHoliday,
        removeHoliday,
        isHoliday,
        getHolidayName,
        refreshHolidays,
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
