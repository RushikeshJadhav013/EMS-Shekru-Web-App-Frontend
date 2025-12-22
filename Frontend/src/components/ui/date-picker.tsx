"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { nowIST } from "@/utils/timezone"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DatePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  disablePastDates?: boolean
  fromDate?: Date
  toDate?: Date
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
  const [currentMonth, setCurrentMonth] = React.useState<Date>(date || nowIST());

  // Set minimum date to today if disablePastDates is true
  const minDate = disablePastDates ? nowIST() : fromDate;

  const handleSelect = (selectedDate: Date | undefined) => {
    onDateChange?.(selectedDate);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant={"outline"}
        className={cn(
          "w-full justify-start text-left font-normal h-11 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-950 dark:hover:to-indigo-950 transition-all duration-300",
          !date && "text-muted-foreground hover:text-muted-foreground",
          date && "text-foreground hover:text-foreground",
          className
        )}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(date, "PPP") : <span>{placeholder}</span>}
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
              disabled={(date) => {
                if (minDate && date < minDate) {
                  // Disable dates before minDate
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const checkDate = new Date(date);
                  checkDate.setHours(0, 0, 0, 0);
                  return checkDate < today;
                }
                if (toDate && date > toDate) {
                  return true;
                }
                return false;
              }}
              initialFocus
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
