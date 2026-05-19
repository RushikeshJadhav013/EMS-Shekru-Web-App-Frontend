"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { nowIST } from "@/utils/timezone";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  disablePastDates?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
  disablePastDates = false,
  fromDate,
  toDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Memoize minDate so it has a stable reference across renders.
  // Without useMemo, `nowIST()` creates a new Date object every render,
  // which causes the useEffect below to fire on every re-render, resetting the month.
  const minDate = React.useMemo(
    () => (disablePastDates ? nowIST() : fromDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disablePastDates, fromDate?.getTime?.()],
  );

  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    if (date) return date;
    if (minDate && minDate > nowIST()) return minDate;
    if (toDate && toDate < nowIST()) return toDate;
    return nowIST();
  });

  // Sync current month only when the dialog opens or when the selected date changes.
  // Do NOT include minDate or toDate in the deps — they can be new object references
  // on every render (e.g. `new Date(...)` inline in the parent), which would cause
  // this effect to fire after every month navigation and reset back to today.
  React.useEffect(() => {
    if (open) {
      if (date) {
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);

        if (minDate) {
          const normalizedMin = new Date(minDate);
          normalizedMin.setHours(0, 0, 0, 0);
          if (normalizedDate < normalizedMin) {
            setCurrentMonth(minDate);
            return;
          }
        }

        if (toDate) {
          const normalizedMax = new Date(toDate);
          normalizedMax.setHours(23, 59, 59, 999);
          if (normalizedDate > normalizedMax) {
            setCurrentMonth(toDate);
            return;
          }
        }

        setCurrentMonth(date);
      } else if (minDate && minDate > nowIST()) {
        setCurrentMonth(minDate);
      } else if (toDate && toDate < nowIST()) {
        setCurrentMonth(toDate);
      } else {
        setCurrentMonth(nowIST());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const handleSelect = (selectedDate: Date | undefined) => {
    onDateChange?.(selectedDate);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-between items-center text-left font-normal h-10 bg-white dark:bg-gray-950 border border-slate-300 rounded-xl shadow-md shadow-slate-100/50 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all",
          !date && "text-slate-400 italic",
          date && "text-black dark:text-white font-semibold",
          className,
        )}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {date ? format(date, "dd-MM-yyyy") : <span>{placeholder}</span>}
        <CalendarIcon className="h-4 w-4 text-slate-400" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
              Select Date
            </DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-4">
            <CalendarDatePicker
              mode="single"
              selected={date}
              onSelect={handleSelect}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              minDate={minDate}
              toDate={toDate}
              disabled={(checkDate) => {
                const normalized = new Date(checkDate);
                normalized.setHours(0, 0, 0, 0);
                // Disable dates strictly before the minimum allowed date
                if (minDate) {
                  const minNormalized = new Date(minDate);
                  minNormalized.setHours(0, 0, 0, 0);
                  if (normalized < minNormalized) return true;
                }
                // Disable dates strictly after the maximum allowed date
                if (toDate) {
                  const maxNormalized = new Date(toDate);
                  maxNormalized.setHours(23, 59, 59, 999);
                  if (normalized > maxNormalized) return true;
                }
                return false;
              }}
              initialFocus
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
