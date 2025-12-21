import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayPicker } from "react-day-picker";
import { nowIST } from "@/utils/timezone";
import { useHolidays } from "@/contexts/HolidayContext";
import { cn } from "@/lib/utils";

type CalendarWithSelectProps = React.ComponentProps<typeof DayPicker> & {
  currentMonth?: Date;
  onMonthChange?: (date: Date) => void;
  minDate?: Date;
  showHolidayIndicator?: boolean;
};

export function CalendarWithSelect({
  currentMonth = nowIST(),
  onMonthChange,
  minDate,
  showHolidayIndicator = true,
  classNames,
  ...props
}: CalendarWithSelectProps) {
  const [month, setMonth] = React.useState<Date>(currentMonth);
  const { holidays } = useHolidays();

  React.useEffect(() => {
    setMonth(currentMonth);
  }, [currentMonth]);

  const handleMonthChange = (newMonth: Date) => {
    // Prevent navigation to months before minDate
    if (minDate) {
      const minYear = minDate.getFullYear();
      const minMonthIndex = minDate.getMonth();
      const newYear = newMonth.getFullYear();
      const newMonthIndex = newMonth.getMonth();
      
      if (newYear < minYear || (newYear === minYear && newMonthIndex < minMonthIndex)) {
        return;
      }
    }
    
    setMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const currentYear = month.getFullYear();
  const currentMonthIndex = month.getMonth();

  const years = React.useMemo(() => {
    const currentYear = nowIST().getFullYear();
    const startYear = currentYear - 10;
    const endYear = currentYear + 10;
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  }, []);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleYearChange = (year: string) => {
    const newDate = new Date(parseInt(year), currentMonthIndex, 1);
    // Ensure the date is set correctly in IST timezone
    newDate.setHours(0, 0, 0, 0);
    handleMonthChange(newDate);
  };

  const handleMonthSelect = (monthIndex: string) => {
    const newDate = new Date(currentYear, parseInt(monthIndex), 1);
    // Ensure the date is set correctly in IST timezone
    newDate.setHours(0, 0, 0, 0);
    handleMonthChange(newDate);
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(currentYear, currentMonthIndex - 1, 1);
    newDate.setHours(0, 0, 0, 0);
    handleMonthChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentYear, currentMonthIndex + 1, 1);
    newDate.setHours(0, 0, 0, 0);
    handleMonthChange(newDate);
  };

  // Check if previous month button should be disabled
  const isPreviousMonthDisabled = React.useMemo(() => {
    if (!minDate) return false;
    const minYear = minDate.getFullYear();
    const minMonthIndex = minDate.getMonth();
    return currentYear < minYear || (currentYear === minYear && currentMonthIndex <= minMonthIndex);
  }, [minDate, currentYear, currentMonthIndex]);

  // Create modifiers for holidays
  const modifiers = React.useMemo(() => {
    const holidayDates: Record<string, boolean> = {};
    holidays.forEach((holiday) => {
      const dateKey = holiday.date.toISOString().split('T')[0];
      holidayDates[dateKey] = true;
    });
    return holidayDates;
  }, [holidays]);

  const modifiersClassNames = React.useMemo(() => {
    const classNameMap: Record<string, string> = {};
    holidays.forEach((holiday) => {
      const dateKey = holiday.date.toISOString().split('T')[0];
      classNameMap[dateKey] = "holiday-day";
    });
    return classNameMap;
  }, [holidays]);

  const enhancedClassNames = {
    ...classNames,
    day: cn(
      classNames?.day,
      "relative"
    ),
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Modern Header with Navigation */}
      <div className="flex items-center justify-between gap-2 mb-4 px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={isPreviousMonthDisabled}
          className="h-8 w-8 flex-shrink-0 rounded-full hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/40 hover:scale-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </Button>

        <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
          <Select value={currentMonthIndex.toString()} onValueChange={handleMonthSelect}>
            <SelectTrigger className="flex-1 h-8 text-sm font-semibold border-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 transition-all shadow-sm min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((monthName, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {monthName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={currentYear.toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[70px] h-8 text-sm font-semibold border-0 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 transition-all shadow-sm flex-shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="h-8 w-8 flex-shrink-0 rounded-full hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/40 hover:scale-110 transition-all duration-200"
        >
          <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </Button>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 relative">
        <Calendar
          month={month}
          onMonthChange={handleMonthChange}
          firstWeekContainsDate={1}
          classNames={enhancedClassNames}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          {...props}
        />
        {showHolidayIndicator && holidays.length > 0 && (
          <style>{`
            .holiday-day {
              background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%) !important;
              border: 1px solid rgba(239, 68, 68, 0.3);
              border-radius: 0.5rem;
              position: relative;
            }
            
            .holiday-day::after {
              content: '';
              position: absolute;
              bottom: 1px;
              left: 50%;
              transform: translateX(-50%);
              width: 4px;
              height: 4px;
              background-color: rgb(239, 68, 68);
              border-radius: 50%;
            }
            
            .dark .holiday-day {
              background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%) !important;
              border-color: rgba(239, 68, 68, 0.5);
            }
          `}</style>
        )}
      </div>
    </div>
  );
}
