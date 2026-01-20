import * as React from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
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
    months: "flex flex-col",
    month: "space-y-3 w-full",
    table: "w-full border-collapse",
    head_row: "grid grid-cols-7 gap-1 mb-1",
    head_cell:
      "h-7 flex items-center justify-center text-[11px] font-medium tracking-wide text-slate-400 uppercase",
    row: "grid grid-cols-7 gap-1",
    cell:
      "relative h-9 flex items-center justify-center text-sm focus-within:z-20",
    day: cn(
      "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
      "text-slate-700 dark:text-slate-100",
      "hover:bg-slate-100 dark:hover:bg-slate-800",
      classNames?.day
    ),
    day_selected:
      "bg-orange-500 text-white hover:bg-orange-500 focus:bg-orange-500 font-semibold",
    day_today:
      "ring-1 ring-orange-400 text-orange-700 dark:text-orange-300 font-semibold",
    day_outside: "text-slate-300 dark:text-slate-700",
  } as typeof classNames;

  // Derive the date to show in the header – prefer the currently selected day.
  const selected =
    props.mode === "single" && props.selected instanceof Date
      ? props.selected
      : Array.isArray(props.selected) && props.selected.length > 0
      ? (props.selected[0] as Date)
      : undefined;

  const headerDate = selected ?? month;

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Minimal Header like the provided design */}
      <div className="flex items-center justify-between mb-4 px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={isPreviousMonthDisabled}
          className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4 text-slate-500 dark:text-slate-300" />
        </Button>

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-slate-400">
            {format(headerDate, "EEEE")}
          </span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {format(headerDate, "MMMM d yyyy")}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4 text-slate-500 dark:text-slate-300" />
        </Button>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-3 relative overflow-hidden">
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
