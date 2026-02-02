import * as React from "react";
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type HolidayCalendarProps = Omit<React.ComponentProps<typeof DayPicker>, 'mode' | 'selected' | 'onSelect'> & {
    date?: Date;
    onDateChange?: (date: Date | undefined) => void;
};

export function HolidayCalendar({
    date,
    onDateChange,
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: HolidayCalendarProps) {
    const [month, setMonth] = React.useState<Date>(date || new Date());

    React.useEffect(() => {
        if (date) {
            setMonth(date);
        }
    }, [date]);

    const handlePreviousMonth = () => {
        setMonth((prev) => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setMonth((prev) => addMonths(prev, 1));
    };

    const handleClear = () => {
        onDateChange?.(undefined);
    };

    const handleToday = () => {
        const today = new Date();
        setMonth(today);
        onDateChange?.(today);
    };

    return (
        <div className={cn("p-4 bg-white dark:bg-slate-950 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800", className)}>
            <div className="flex items-center justify-between mb-4">
                <button className="flex items-center gap-1 font-semibold text-sm text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-md transition-colors">
                    {format(month, "MMMM, yyyy")}
                    <ChevronDown className="h-4 w-4 text-slate-500" />
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
                mode="single"
                selected={date}
                onSelect={(day) => onDateChange?.(day)}
                month={month}
                onMonthChange={setMonth}
                showOutsideDays={showOutsideDays}
                formatters={{
                    formatWeekdayName: (date) => format(date, "eeeeee"),
                }}
                className={cn("p-0", className)}
                classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                    month: "space-y-4",
                    caption: "hidden", // We use custom header
                    nav: "hidden",     // We use custom nav
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex mb-2",
                    head_cell: "text-slate-900 dark:text-slate-100 rounded-md w-9 font-medium text-[0.8rem] text-center",
                    row: "flex w-full mt-1",
                    cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent focus-within:relative focus-within:z-20",
                    day: cn(
                        buttonVariants({ variant: "ghost" }),
                        "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-none transition-none"
                    ),
                    day_selected:
                        "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white rounded-none border-[1.5px] border-slate-950 dark:border-slate-50 shadow-none z-10 relative",
                    day_today: "text-blue-600 dark:text-blue-400 font-bold", // In the image today is the selected one, but usually it has a subtle indicator
                    day_outside: "text-slate-400 dark:text-slate-600 opacity-40",
                    day_disabled: "text-slate-300 opacity-50",
                    day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                    day_hidden: "invisible",
                    ...classNames,
                }}
                {...props}
            />

            <div className="flex items-center justify-between mt-4 pt-2">
                <button
                    onClick={handleClear}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium transition-colors"
                >
                    Clear
                </button>
                <button
                    onClick={handleToday}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium transition-colors"
                >
                    Today
                </button>
            </div>
        </div>
    );
}
