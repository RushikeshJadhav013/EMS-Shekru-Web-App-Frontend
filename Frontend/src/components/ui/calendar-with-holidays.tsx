import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { useHolidays } from "@/contexts/HolidayContext";
import { isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarProps } from "@/components/ui/calendar";

export type CalendarWithHolidaysProps = CalendarProps & {
  showHolidayIndicator?: boolean;
};

export function CalendarWithHolidays({
  showHolidayIndicator = true,
  classNames,
  ...props
}: CalendarWithHolidaysProps) {
  const { holidays } = useHolidays();

  // Create a custom classNames object that includes holiday styling
  const enhancedClassNames = {
    ...classNames,
    day: cn(
      classNames?.day,
      "relative"
    ),
  };

  // Custom day renderer to show holiday indicator
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

  return (
    <div className="relative">
      <Calendar
        classNames={enhancedClassNames}
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
  );
}
