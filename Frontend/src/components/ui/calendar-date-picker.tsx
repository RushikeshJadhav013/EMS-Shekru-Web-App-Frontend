import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayPicker } from "react-day-picker";
import { nowIST } from "@/utils/timezone";
import { cn } from "@/lib/utils";

type CalendarDatePickerProps = React.ComponentProps<typeof DayPicker> & {
  currentMonth?: Date;
  onMonthChange?: (date: Date) => void;
  minDate?: Date;
};

export function CalendarDatePicker({
  currentMonth = nowIST(),
  onMonthChange,
  minDate,
  classNames,
  ...props
}: CalendarDatePickerProps) {
  const [month, setMonth] = React.useState<Date>(currentMonth);

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
    newDate.setHours(0, 0, 0, 0);
    handleMonthChange(newDate);
  };

  const handleMonthSelect = (monthIndex: string) => {
    const newDate = new Date(currentYear, parseInt(monthIndex), 1);
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
      <div className="flex items-center justify-between gap-2 mb-4 px-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={isPreviousMonthDisabled}
          className="h-8 w-8 flex-shrink-0 rounded-full hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </Button>

        <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
          <Select value={currentMonthIndex.toString()} onValueChange={handleMonthSelect}>
            <SelectTrigger className="flex-1 h-8 text-xs font-semibold border-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 transition-all shadow-sm min-w-0">
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
            <SelectTrigger className="w-[65px] h-8 text-xs font-semibold border-0 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 transition-all shadow-sm flex-shrink-0">
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
          className="h-8 w-8 flex-shrink-0 rounded-full hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/40 transition-all duration-200"
        >
          <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </Button>
      </div>

      {/* Calendar - Clean, neutral styling without holiday indicators */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 relative">
        <Calendar
          month={month}
          onMonthChange={handleMonthChange}
          firstWeekContainsDate={1}
          classNames={enhancedClassNames}
          {...props}
        />
      </div>
    </div>
  );
}
