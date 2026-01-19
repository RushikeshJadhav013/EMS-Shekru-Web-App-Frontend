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
    <div className="w-full max-w-md mx-auto">
      {/* Modern Header with Navigation */}
      <div className="flex items-center justify-between gap-3 mb-6 px-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={isPreviousMonthDisabled}
          className="h-10 w-10 flex-shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </Button>

        <div className="flex items-center gap-2 flex-1 justify-center">
          <Select value={currentMonthIndex.toString()} onValueChange={handleMonthSelect}>
            <SelectTrigger className="flex-[2] h-10 text-sm font-bold border-2 border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-900 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-sm px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((monthName, index) => (
                <SelectItem key={index} value={index.toString()} className="font-medium">
                  {monthName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={currentYear.toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[100px] h-10 text-sm font-bold border-2 border-purple-100 dark:border-purple-900/50 bg-white dark:bg-slate-900 rounded-xl hover:border-purple-300 dark:hover:border-purple-700 transition-all shadow-sm px-3 flex-shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()} className="font-medium">
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
          className="h-10 w-10 flex-shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-md transition-all duration-200"
        >
          <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </Button>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-indigo-100/20 dark:shadow-none border border-slate-100 dark:border-slate-800 p-2 relative overflow-hidden">
        <Calendar
          month={month}
          onMonthChange={handleMonthChange}
          firstWeekContainsDate={1}
          classNames={{
            ...enhancedClassNames,
            caption: "hidden", // Hide the secondary internal header
            nav: "hidden",     // Hide the secondary internal navigation
          }}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          {...props}
        />
        {showHolidayIndicator && holidays.length > 0 && (
          <style>{`
            .holiday-day {
              background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%) !important;
              border: 2px solid rgba(239, 68, 68, 0.4);
              border-radius: 0.5rem;
              position: relative;
              font-weight: 600;
              color: rgb(127, 29, 29);
            }
            
            .holiday-day::after {
              content: '';
              position: absolute;
              bottom: 2px;
              left: 50%;
              transform: translateX(-50%);
              width: 5px;
              height: 5px;
              background-color: rgb(239, 68, 68);
              border-radius: 50%;
            }
            
            .dark .holiday-day {
              background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(249, 115, 22, 0.25) 100%) !important;
              border-color: rgba(239, 68, 68, 0.6);
              color: rgb(254, 226, 226);
            }
          `}</style>
        )}
      </div>
    </div>
  );
}
