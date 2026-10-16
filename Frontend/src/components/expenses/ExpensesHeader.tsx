import React from 'react';
import { Wallet, Receipt, Download } from 'lucide-react';

export interface ExpensesHeaderProps {
  title?: string;
  subtitle?: string;
  onExport?: () => void;
  className?: string;
}

export const ExpensesHeader: React.FC<ExpensesHeaderProps> = ({
  title = 'Expenses Management',
  subtitle = 'Track your expenses and manage financial reports',
  onExport,
  className = '',
}) => {
  return (
    <div
      className={`w-full bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[28px] md:rounded-[30px] min-h-[125px] md:min-h-[135px] px-6 md:px-8 py-5 md:py-6 flex flex-col sm:flex-row items-center justify-between gap-5 md:gap-6 shadow-none transition-all duration-200 ${className}`}
    >
      {/* LEFT SECTION */}
      <div className="flex items-center gap-5 w-full sm:w-auto">
        {/* Icon Box */}
        <div className="w-[65px] h-[65px] md:w-[65px] md:h-[62px] bg-[#4545E9] rounded-[18px] md:rounded-[20px] flex items-center justify-center shrink-0 shadow-sm">
          <Wallet className="w-8 h-8 md:w-[34px] md:h-[34px] text-white stroke-[1.8]" />
        </div>

        {/* Text Content */}
        <div className="flex flex-col justify-center">
          <h1 className="text-[24px] sm:text-[28px] md:text-[32px] font-bold text-black dark:text-white tracking-tight leading-tight mb-1">
            {title}
          </h1>
          <div className="flex items-center gap-2 text-[13px] sm:text-[14px] font-semibold text-gray-700 dark:text-gray-300">
            <Receipt className="w-4 h-4 text-[#4545E9] stroke-[2.2] shrink-0" />
            <span>{subtitle}</span>
          </div>
        </div>
      </div>

      {/* RIGHT SECTION - Export Button */}
      <div className="w-full sm:w-auto flex items-center justify-end shrink-0">
        <button
          onClick={onExport}
          type="button"
          className="w-full sm:w-[130px] md:w-[120px] h-[48px] md:h-[45px] bg-[#4545E9] hover:bg-[#3737D4] active:scale-[0.98] rounded-[14px] border-2 border-black text-white font-bold text-[14px] md:text-[15px] flex items-center justify-center gap-2 transition-all cursor-pointer select-none"
        >
          <Download className="w-4 h-4 md:w-5 md:h-5 text-white stroke-[2.2]" />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};

export default ExpensesHeader;
