import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = false, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-0", className)}
      classNames={{
        months: "flex flex-col sm:flex-row",
        month: "space-y-3 w-full",
        caption: "flex justify-between items-center pt-1 relative mb-4 px-2",
        caption_label: "text-sm font-medium text-slate-600 dark:text-slate-300",
        nav: "flex gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 p-0 opacity-50 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800"
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell: "text-slate-500 dark:text-slate-400 w-9 font-medium text-[11px] uppercase tracking-wider py-2 text-center",
        row: "flex w-full mt-0.5",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-gradient-to-r [&:has([aria-selected])]:from-blue-50 [&:has([aria-selected])]:to-indigo-50 dark:[&:has([aria-selected])]:from-blue-950/30 dark:[&:has([aria-selected])]:to-indigo-950/30",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal rounded-lg transition-all duration-200 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/40 hover:scale-105 hover:shadow-sm"
        ),
        day_range_end: "day-range-end rounded-r-lg",
        day_selected:
          "bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-semibold shadow-md hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg scale-105",
        day_today: "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 text-amber-900 dark:text-amber-100 font-bold ring-2 ring-amber-400 dark:ring-amber-600 shadow-sm",
        day_outside:
          "day-outside text-slate-300 dark:text-slate-700 opacity-30",
        day_disabled: "text-slate-200 dark:text-slate-800 opacity-30 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-gradient-to-r aria-selected:from-blue-100 aria-selected:to-indigo-100 dark:aria-selected:from-blue-900/30 dark:aria-selected:to-indigo-900/30 aria-selected:text-blue-700 dark:aria-selected:text-blue-300 rounded-none",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
