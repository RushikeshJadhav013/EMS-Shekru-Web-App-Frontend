import * as React from "react";
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type HolidayCalendarProps = Omit<
  React.ComponentProps<typeof DayPicker>,
  "mode" | "selected" | "onSelect"
> & {
  date?: Date | Date[];
  mode?: "single" | "multiple";
  onDateChange?: (date: any) => void;
};

export function HolidayCalendar({
  date,
  mode = "single",
  onDateChange,
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: HolidayCalendarProps) {
  const getInitialMonth = () => {
    if (Array.isArray(date)) {
      return date.length > 0 ? date[0] : new Date();
    }
    return date || new Date();
  };
  const [month, setMonth] = React.useState<Date>(getInitialMonth());

  React.useEffect(() => {
    if (date) {
      setMonth(getInitialMonth());
    }
  }, [date]);

  const handlePreviousMonth = () => {
    setMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setMonth((prev) => addMonths(prev, 1));
  };

  const handleClear = () => {
    onDateChange?.(mode === "multiple" ? [] : undefined);
  };

  const handleToday = () => {
    const today = new Date();
    setMonth(today);
    onDateChange?.(mode === "multiple" ? [today] : today);
  };

  return (
    <div
      className={cn(
        "p-4 bg-white dark:bg-slate-950 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <button className="flex items-center gap-1 font-black text-[16px] text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-md transition-colors" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
          {format(month, "MMMM, yyyy")}
          <ChevronDown className="h-4 w-4 text-black dark:text-white" />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePreviousMonth}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <DayPicker
        mode={mode as any}
        selected={date as any}
        onSelect={(val) => onDateChange?.(val)}
        month={month}
        onMonthChange={setMonth}
        showOutsideDays={showOutsideDays}
        formatters={{
          formatWeekdayName: (date) => format(date, "eeeeee"),
        }}
        className={cn("p-0", className)}
        classNames={{
          months:
            "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "hidden", // We use custom header
          nav: "hidden", // We use custom nav
          table: "w-full border-collapse space-y-1",
          head_row: "flex mb-2",
          head_cell:
            "text-black dark:text-white rounded-md w-9 font-black text-[14px] text-center uppercase tracking-wider",
          row: "flex w-full mt-1",
          cell: "text-center text-[14px] p-0 relative [&:has([aria-selected])]:bg-transparent focus-within:relative focus-within:z-20",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 font-medium text-black dark:text-white aria-selected:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-none transition-none",
          ),
          day_selected:
            "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white rounded-none border-[1.5px] border-slate-950 dark:border-slate-50 shadow-none z-10 relative",
          day_today: "text-blue-600 dark:text-blue-400 font-bold", // In the image today is the selected one, but usually it has a subtle indicator
          day_outside: "text-slate-400 dark:text-slate-600 opacity-40",
          day_disabled: "text-slate-300 opacity-50",
          day_range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        {...props}
      />

      <div className="flex items-center justify-between mt-4 pt-2">
        <button
          onClick={handleClear}
          className="text-[12px] text-[#2563EB] dark:text-blue-400 hover:text-blue-700 font-bold transition-colors"
          style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
        >
          Clear
        </button>
        <button
          onClick={handleToday}
          className="text-[12px] text-[#2563EB] dark:text-blue-400 hover:text-blue-700 font-bold transition-colors"
          style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
        >
          Today
        </button>
      </div>
    </div>
  );
}
