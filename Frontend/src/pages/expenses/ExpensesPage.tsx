import React, { useState } from 'react';
import ExpensesHeader from '@/components/expenses/ExpensesHeader';
import {
  Wallet,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Eye,
  SquarePen,
  Trash2,
  Receipt,
  User,
  ShieldCheck,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export type ExpenseCategory =
  | 'travel_conveyance'
  | 'food_refreshments'
  | 'office_supplies'
  | 'stationery'
  | 'electricity'
  | 'internet_telephone'
  | 'rent_maintenance'
  | 'software_subscription'
  | 'employee_welfare'
  | 'client_meeting'
  | 'marketing'
  | 'courier'
  | 'repairs_maintenance'
  | 'miscellaneous'
  | 'other';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'travel_conveyance', label: 'Travel & Conveyance' },
  { value: 'food_refreshments', label: 'Food & Refreshments' },
  { value: 'office_supplies', label: 'Office Supplies' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'internet_telephone', label: 'Internet & Telephone' },
  { value: 'rent_maintenance', label: 'Rent & Maintenance' },
  { value: 'software_subscription', label: 'Software / Subscription' },
  { value: 'employee_welfare', label: 'Employee Welfare' },
  { value: 'client_meeting', label: 'Client Meeting' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'courier', label: 'Courier' },
  { value: 'repairs_maintenance', label: 'Repairs & Maintenance' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
  { value: 'other', label: 'Other' },
];

export const getCategoryLabel = (catValue: string): string => {
  if (!catValue) return '';
  const found = EXPENSE_CATEGORIES.find(
    (c) => c.value.toLowerCase() === catValue.toLowerCase() || c.label.toLowerCase() === catValue.toLowerCase()
  );
  return found ? found.label : catValue;
};

export interface ExpenseItem {
  id: number;
  date: string;
  employee: string;
  category: ExpenseCategory | string;
  description: string;
  amount: number;
  status: 'Approved' | 'Pending' | 'Rejected';
  title?: string;
  paymentMethod?: string;
  receiptName?: string;
}

const sampleExpenses: ExpenseItem[] = [
  {
    id: 1,
    date: '01 Sep 2026',
    employee: 'Rahul Patil',
    category: 'travel_conveyance',
    description: 'Client meeting travel',
    amount: 1250,
    status: 'Approved',
    paymentMethod: 'UPI',
    receiptName: 'cab_receipt_01sep.pdf',
  },
  {
    id: 2,
    date: '03 Sep 2026',
    employee: 'Amit Sharma',
    category: 'food_refreshments',
    description: 'Team lunch',
    amount: 850,
    status: 'Pending',
    paymentMethod: 'Card',
    receiptName: 'lunch_bill.jpg',
  },
  {
    id: 3,
    date: '05 Sep 2026',
    employee: 'Priya Joshi',
    category: 'office_supplies',
    description: 'Office supplies purchase',
    amount: 2400,
    status: 'Approved',
    paymentMethod: 'Cash',
    receiptName: 'supplies_receipt.png',
  },
  {
    id: 4,
    date: '08 Sep 2026',
    employee: 'Sagar More',
    category: 'rent_maintenance',
    description: 'Office rent & maintenance',
    amount: 3200,
    status: 'Pending',
    paymentMethod: 'UPI',
    receiptName: 'maintenance_bill.pdf',
  },
  {
    id: 5,
    date: '12 Sep 2026',
    employee: 'Vikas Verma',
    category: 'software_subscription',
    description: 'Software subscription',
    amount: 4500,
    status: 'Approved',
    paymentMethod: 'Bank Transfer',
    receiptName: 'software_invoice.pdf',
  },
  {
    id: 6,
    date: '15 Sep 2026',
    employee: 'Sneha Kulkarni',
    category: 'internet_telephone',
    description: 'Broadband bill',
    amount: 850,
    status: 'Approved',
    paymentMethod: 'UPI',
    receiptName: 'broadband_sep.pdf',
  },
  {
    id: 7,
    date: '18 Sep 2026',
    employee: 'Rajesh Kumar',
    category: 'client_meeting',
    description: 'Client dinner meeting',
    amount: 5200,
    status: 'Rejected',
    paymentMethod: 'Card',
    receiptName: 'meeting_invoice.pdf',
  },
];

export default function ExpensesPage() {
  const { toast } = useToast();

  // Core data state
  const [expenses, setExpenses] = useState<ExpenseItem[]>(sampleExpenses);
  const [activeTab, setActiveTab] = useState<'my' | 'approval' | 'reports'>('my');

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Add Expense Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    employee: '',
    category: 'travel_conveyance' as ExpenseCategory,
    description: '',
    amount: '',
    date: '01 Sep 2026',
    status: 'Pending' as 'Approved' | 'Pending' | 'Rejected',
  });

  // Action dialog states
  const [viewExpense, setViewExpense] = useState<ExpenseItem | null>(null);
  const [editExpense, setEditExpense] = useState<ExpenseItem | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<number | null>(null);

  // Safe Filter Logic
  const filteredExpenses = expenses.filter((item) => {
    if (!item) return false;
    const emp = item.employee ? item.employee.toLowerCase() : '';
    const desc = item.description ? item.description.toLowerCase() : '';
    const catVal = item.category ? item.category.toLowerCase() : '';
    const catLabel = getCategoryLabel(item.category).toLowerCase();
    const query = searchQuery ? searchQuery.toLowerCase() : '';

    const matchesSearch = emp.includes(query) || desc.includes(query) || catVal.includes(query) || catLabel.includes(query);

    const matchesCategory =
      selectedCategory === 'all' ||
      catVal === selectedCategory.toLowerCase() ||
      catLabel === selectedCategory.toLowerCase() ||
      (EXPENSE_CATEGORIES.find((c) => c.value === selectedCategory)?.label.toLowerCase() === catLabel) ||
      (EXPENSE_CATEGORIES.find((c) => c.value === selectedCategory)?.label.toLowerCase() === catVal);

    const matchesStatus =
      selectedStatus === 'all' || (item.status && item.status.toLowerCase() === selectedStatus.toLowerCase());

    const matchesDate = !selectedDate || (item.date && item.date.includes(selectedDate));

    return matchesSearch && matchesCategory && matchesStatus && matchesDate;
  });

  // Calculate totals
  const totalExpensesAmount = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const thisMonthAmount = expenses
    .filter((item) => item.date && item.date.includes('Sep 2026'))
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const pendingExpensesAmount = expenses
    .filter((item) => item.status === 'Pending')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const approvedExpensesAmount = expenses
    .filter((item) => item.status === 'Approved')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Quick Approve / Reject in Expense Approval tab
  const handleApproveStatus = (id: number) => {
    setExpenses(expenses.map((e) => (e.id === id ? { ...e, status: 'Approved' } : e)));
    toast({
      title: 'Expense Approved',
      description: 'The expense item has been approved successfully.',
    });
  };

  const handleRejectStatus = (id: number) => {
    setExpenses(expenses.map((e) => (e.id === id ? { ...e, status: 'Rejected' } : e)));
    toast({
      title: 'Expense Rejected',
      description: 'The expense item status was changed to Rejected.',
      variant: 'destructive',
    });
  };

  // Add Expense submit
  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.employee.trim() || !newExpense.description.trim() || !newExpense.amount || Number(newExpense.amount) <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const item: ExpenseItem = {
      id: Date.now(),
      employee: newExpense.employee,
      category: newExpense.category,
      description: newExpense.description,
      amount: Number(newExpense.amount),
      date: newExpense.date || '01 Sep 2026',
      status: newExpense.status,
    };

    setExpenses([item, ...expenses]);
    setIsAddDialogOpen(false);
    setNewExpense({
      employee: '',
      category: 'travel_conveyance',
      description: '',
      amount: '',
      date: '01 Sep 2026',
      status: 'Pending',
    });

    toast({
      title: 'Expense Added',
      description: 'The new expense record has been successfully created.',
    });
  };

  // Edit Expense submit
  const handleUpdateExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpense) return;

    setExpenses(expenses.map((item) => (item.id === editExpense.id ? editExpense : item)));
    setEditExpense(null);

    toast({
      title: 'Expense Updated',
      description: 'The expense transaction has been updated.',
    });
  };

  // Delete Expense confirm
  const handleConfirmDelete = () => {
    if (deleteExpenseId !== null) {
      setExpenses(expenses.filter((item) => item.id !== deleteExpenseId));
      setDeleteExpenseId(null);

      toast({
        title: 'Expense Deleted',
        description: 'The expense record has been removed.',
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* 1. EXPENSES MANAGEMENT HEADER */}
      <ExpensesHeader
        onExport={() => {
          toast({
            title: 'Exporting Data',
            description: 'Your expense transactions report is being generated.',
          });
        }}
      />

      {/* 2. EXPENSE SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Card 1: Total Expenses */}
        <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[20px] md:rounded-[22px] p-4 md:p-5 shadow-none transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] md:text-[17px] font-bold text-black dark:text-white tracking-tight">
              Total Expenses
            </h3>
            <div className="w-[42px] h-[42px] md:w-[44px] md:h-[44px] rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-[#4545E9] stroke-[2]" />
            </div>
          </div>
          <div className="mt-3 md:mt-4">
            <span className="text-[22px] md:text-[24px] font-bold text-black dark:text-white tracking-tight">
              ₹{totalExpensesAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Card 2: This Month */}
        <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[20px] md:rounded-[22px] p-4 md:p-5 shadow-none transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] md:text-[17px] font-bold text-black dark:text-white tracking-tight">
              This Month
            </h3>
            <div className="w-[42px] h-[42px] md:w-[44px] md:h-[44px] rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-emerald-600 stroke-[2]" />
            </div>
          </div>
          <div className="mt-3 md:mt-4">
            <span className="text-[22px] md:text-[24px] font-bold text-black dark:text-white tracking-tight">
              ₹{thisMonthAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Card 3: Pending Expenses */}
        <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[20px] md:rounded-[22px] p-4 md:p-5 shadow-none transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] md:text-[17px] font-bold text-black dark:text-white tracking-tight">
              Pending Expenses
            </h3>
            <div className="w-[42px] h-[42px] md:w-[44px] md:h-[44px] rounded-full bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600 stroke-[2]" />
            </div>
          </div>
          <div className="mt-3 md:mt-4">
            <span className="text-[22px] md:text-[24px] font-bold text-black dark:text-white tracking-tight">
              ₹{pendingExpensesAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Card 4: Approved Expenses */}
        <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[20px] md:rounded-[22px] p-4 md:p-5 shadow-none transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] md:text-[17px] font-bold text-black dark:text-white tracking-tight">
              Approved Expenses
            </h3>
            <div className="w-[42px] h-[42px] md:w-[44px] md:h-[44px] rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-rose-500 stroke-[2]" />
            </div>
          </div>
          <div className="mt-3 md:mt-4">
            <span className="text-[22px] md:text-[24px] font-bold text-black dark:text-white tracking-tight">
              ₹{approvedExpensesAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* 3. HORIZONTAL TAB NAVIGATION (Compact & Sleek) */}
      <div className="w-full max-w-[680px] mx-auto min-h-[46px] bg-white dark:bg-slate-900 border border-[#111111] dark:border-slate-700 rounded-[20px] p-[4px] box-border flex items-center justify-between gap-1 md:gap-1.5">
        {/* TAB 1: My Expenses */}
        <button
          type="button"
          onClick={() => setActiveTab('my')}
          className={`flex-1 h-[38px] min-w-[100px] flex items-center justify-center gap-2 rounded-[16px] font-semibold text-[14px] md:text-[15px] transition-all duration-200 cursor-pointer select-none border box-border ${
            activeTab === 'my'
              ? 'bg-[#4545E9] text-white border-[#3154D8] font-bold shadow-none hover:border-[#2638C5] hover:shadow-[0_2px_5px_rgba(69,69,233,0.18)]'
              : 'bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 border-[#D1D5DB] dark:border-slate-700 hover:bg-[#EEF2FF] dark:hover:bg-slate-800 hover:border-[#4545E9] hover:text-[#4545E9] hover:shadow-[0_1px_3px_rgba(69,69,233,0.10)]'
          }`}
        >
          <User className={`w-4 h-4 stroke-[2] ${activeTab === 'my' ? 'text-white' : ''}`} />
          <span>My Expenses</span>
        </button>

        {/* TAB 2: Expense Approval */}
        <button
          type="button"
          onClick={() => setActiveTab('approval')}
          className={`flex-1 h-[38px] min-w-[100px] flex items-center justify-center gap-2 rounded-[16px] font-semibold text-[14px] md:text-[15px] transition-all duration-200 cursor-pointer select-none border box-border ${
            activeTab === 'approval'
              ? 'bg-[#4545E9] text-white border-[#3154D8] font-bold shadow-none hover:border-[#2638C5] hover:shadow-[0_2px_5px_rgba(69,69,233,0.18)]'
              : 'bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 border-[#D1D5DB] dark:border-slate-700 hover:bg-[#EEF2FF] dark:hover:bg-slate-800 hover:border-[#4545E9] hover:text-[#4545E9] hover:shadow-[0_1px_3px_rgba(69,69,233,0.10)]'
          }`}
        >
          <ShieldCheck className={`w-4 h-4 stroke-[2] ${activeTab === 'approval' ? 'text-white' : ''}`} />
          <span>Expense Approval</span>
        </button>

        {/* TAB 3: Expense Reports */}
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex-1 h-[38px] min-w-[100px] flex items-center justify-center gap-2 rounded-[16px] font-semibold text-[14px] md:text-[15px] transition-all duration-200 cursor-pointer select-none border box-border ${
            activeTab === 'reports'
              ? 'bg-[#4545E9] text-white border-[#3154D8] font-bold shadow-none hover:border-[#2638C5] hover:shadow-[0_2px_5px_rgba(69,69,233,0.18)]'
              : 'bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 border-[#D1D5DB] dark:border-slate-700 hover:bg-[#EEF2FF] dark:hover:bg-slate-800 hover:border-[#4545E9] hover:text-[#4545E9] hover:shadow-[0_1px_3px_rgba(69,69,233,0.10)]'
          }`}
        >
          <BarChart3 className={`w-4 h-4 stroke-[2] ${activeTab === 'reports' ? 'text-white' : ''}`} />
          <span>Expense Reports</span>
        </button>
      </div>

      {/* 4. TAB CONTENT AREA */}
      {activeTab === 'my' && (
        <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[28px] md:rounded-[30px] p-6 md:p-8 shadow-none space-y-6">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white tracking-tight">
                Expense Transactions
              </h2>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-1">
                View and manage all expense records
              </p>
            </div>
            <button
              onClick={() => setIsAddDialogOpen(true)}
              type="button"
              className="w-full sm:w-auto px-3 h-[40px] bg-[#4545E9] hover:bg-[#3737D4] active:scale-[0.98] text-white font-bold text-[15px] rounded-[14px] border-2 border-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm select-none"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>Add Expense</span>
            </button>
          </div>

          {/* SEARCH AND FILTER AREA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 pt-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[46px] pl-10 pr-4 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-600 rounded-[12px] text-sm text-black dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#4545E9]"
              />
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-[46px] px-3 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-600 rounded-[12px] text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9]"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-[46px] px-3 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-600 rounded-[12px] text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9]"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Date Filter Input */}
            <input
              type="text"
              placeholder="Select Date (e.g. Sep 2026)"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-[46px] px-4 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-600 rounded-[12px] text-sm text-black dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#4545E9]"
            />
          </div>

          {/* EXPENSE TABLE */}
          <div className="border-2 border-black dark:border-slate-700 rounded-[20px] overflow-hidden bg-white dark:bg-slate-900">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800 border-b-2 border-black dark:border-slate-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Date</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Employee</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Category</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Description</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Amount</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Status</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-gray-500 font-semibold">
                        No expense records found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-semibold text-sm text-gray-900 dark:text-gray-100 py-4 px-4 whitespace-nowrap">
                          {expense.date}
                        </TableCell>
                        <TableCell className="font-bold text-sm text-black dark:text-white py-4 px-4 whitespace-nowrap">
                          {expense.employee}
                        </TableCell>
                        <TableCell className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                            {getCategoryLabel(expense.category)}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-sm text-gray-700 dark:text-gray-300 py-4 px-4 max-w-[240px] truncate">
                          {expense.description}
                        </TableCell>
                        <TableCell className="font-bold text-sm text-black dark:text-white py-4 px-4 whitespace-nowrap">
                          ₹{expense.amount.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="py-4 px-4 whitespace-nowrap">
                          {expense.status === 'Approved' && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800">
                              Approved
                            </span>
                          )}
                          {expense.status === 'Pending' && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800">
                              Pending
                            </span>
                          )}
                          {expense.status === 'Rejected' && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800">
                              Rejected
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewExpense(expense)}
                              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditExpense(expense)}
                              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                              title="Edit Expense"
                            >
                              <SquarePen className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteExpenseId(expense.id)}
                              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSE APPROVAL */}
      {activeTab === 'approval' && (
        <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[28px] md:rounded-[30px] p-6 md:p-8 shadow-none space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white tracking-tight">
                Expense Approvals
              </h2>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-1">
                Review and manage employee expense approvals
              </p>
            </div>
          </div>

          <div className="border-2 border-black dark:border-slate-700 rounded-[20px] overflow-hidden bg-white dark:bg-slate-900">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800 border-b-2 border-black dark:border-slate-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Date</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Employee</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Category</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Description</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Amount</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Status</TableHead>
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4 text-right">Approve / Reject</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <TableCell className="font-semibold text-sm text-gray-900 dark:text-gray-100 py-4 px-4 whitespace-nowrap">
                        {expense.date}
                      </TableCell>
                      <TableCell className="font-bold text-sm text-black dark:text-white py-4 px-4 whitespace-nowrap">
                        {expense.employee}
                      </TableCell>
                      <TableCell className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                          {getCategoryLabel(expense.category)}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-sm text-gray-700 dark:text-gray-300 py-4 px-4 max-w-[240px] truncate">
                        {expense.description}
                      </TableCell>
                      <TableCell className="font-bold text-sm text-black dark:text-white py-4 px-4 whitespace-nowrap">
                        ₹{expense.amount.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="py-4 px-4 whitespace-nowrap">
                        {expense.status === 'Approved' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Approved
                          </span>
                        )}
                        {expense.status === 'Pending' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Pending
                          </span>
                        )}
                        {expense.status === 'Rejected' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            Rejected
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApproveStatus(expense.id)}
                            disabled={expense.status === 'Approved'}
                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs disabled:opacity-50 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectStatus(expense.id)}
                            disabled={expense.status === 'Rejected'}
                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs disabled:opacity-50 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXPENSE REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[28px] md:rounded-[30px] p-6 md:p-8 shadow-none space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white tracking-tight">
                Expense Reports & Analytics
              </h2>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-1">
                Category spending breakdown and export reports
              </p>
            </div>
            <button
              onClick={() => {
                toast({
                  title: 'Report Downloaded',
                  description: 'Detailed category spending report has been downloaded.',
                });
              }}
              className="px-4 py-2.5 bg-[#4545E9] text-white font-bold rounded-[12px] border-2 border-black flex items-center gap-2 text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Report</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {EXPENSE_CATEGORIES.map((catObj) => {
              const catTotal = expenses
                .filter((e) => {
                  const catVal = e.category ? e.category.toLowerCase() : '';
                  const catLabel = getCategoryLabel(e.category).toLowerCase();
                  return catVal === catObj.value.toLowerCase() || catLabel === catObj.label.toLowerCase();
                })
                .reduce((a, c) => a + (c.amount || 0), 0);
              const catCount = expenses.filter((e) => {
                const catVal = e.category ? e.category.toLowerCase() : '';
                const catLabel = getCategoryLabel(e.category).toLowerCase();
                return catVal === catObj.value.toLowerCase() || catLabel === catObj.label.toLowerCase();
              }).length;
              return (
                <div key={catObj.value} className="p-5 border-2 border-black dark:border-slate-700 rounded-[20px] bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{catObj.label}</span>
                    <h4 className="text-2xl font-bold text-black dark:text-white mt-1">
                      ₹{catTotal.toLocaleString('en-IN')}
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-[#4545E9] flex items-center justify-center font-bold">
                    {catCount}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADD EXPENSE DIALOG */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-2 border-black rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-black dark:text-white">Add New Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddExpenseSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-bold text-sm text-black">Employee Name</Label>
              <Input
                placeholder="e.g. Rahul Patil"
                value={newExpense.employee}
                onChange={(e) => setNewExpense({ ...newExpense, employee: e.target.value })}
                className="border-2 border-black rounded-[12px] h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-sm text-black">Category</Label>
                <select
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as ExpenseCategory })}
                  className="w-full h-[44px] px-3 border-2 border-black rounded-[12px] text-sm bg-white dark:bg-slate-800 dark:text-white"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-sm text-black">Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 1500"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="border-2 border-black rounded-[12px] h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-sm text-black">Date</Label>
                <Input
                  placeholder="e.g. 25 Sep 2026"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="border-2 border-black rounded-[12px] h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-sm text-black">Status</Label>
                <select
                  value={newExpense.status}
                  onChange={(e) => setNewExpense({ ...newExpense, status: e.target.value as 'Approved' | 'Pending' | 'Rejected' })}
                  className="w-full h-[44px] px-3 border-2 border-black rounded-[12px] text-sm bg-white"
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-sm text-black">Description</Label>
              <Textarea
                placeholder="Brief details about the expense"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                className="border-2 border-black rounded-[12px] min-h-[80px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-[12px] border-2 border-black font-semibold">
                Cancel
              </Button>
              <Button type="submit" className="bg-[#4545E9] hover:bg-[#3737D4] text-white font-bold border-2 border-black rounded-[12px]">
                Submit Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW EXPENSE DIALOG */}
      {viewExpense && (
        <Dialog open={!!viewExpense} onOpenChange={() => setViewExpense(null)}>
          <DialogContent className="sm:max-w-[450px] border-2 border-black rounded-[24px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-black">Expense Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-500">Employee</span>
                <span className="font-bold text-black">{viewExpense.employee}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-500">Date</span>
                <span className="font-bold text-black">{viewExpense.date}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-500">Category</span>
                <span className="font-bold text-black">{getCategoryLabel(viewExpense.category)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-500">Amount</span>
                <span className="font-bold text-black text-base">₹{viewExpense.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-gray-500">Status</span>
                <span className="font-bold">{viewExpense.status}</span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="font-semibold text-gray-500">Description</span>
                <p className="font-medium text-black bg-gray-50 p-2.5 rounded-lg border border-gray-200">{viewExpense.description}</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setViewExpense(null)} className="bg-black text-white font-bold rounded-[12px]">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* EDIT EXPENSE DIALOG */}
      {editExpense && (
        <Dialog open={!!editExpense} onOpenChange={() => setEditExpense(null)}>
          <DialogContent className="sm:max-w-[480px] border-2 border-black rounded-[24px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-black">Edit Expense Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateExpenseSubmit} className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="font-bold text-sm">Employee Name</Label>
                <Input
                  value={editExpense.employee}
                  onChange={(e) => setEditExpense({ ...editExpense, employee: e.target.value })}
                  className="border-2 border-black rounded-[12px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-bold text-sm">Category</Label>
                  <select
                    value={editExpense.category}
                    onChange={(e) => setEditExpense({ ...editExpense, category: e.target.value as ExpenseCategory })}
                    className="w-full h-[44px] px-3 border-2 border-black rounded-[12px] text-sm bg-white dark:bg-slate-800 dark:text-white"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="font-bold text-sm">Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editExpense.amount}
                    onChange={(e) => setEditExpense({ ...editExpense, amount: Number(e.target.value) })}
                    className="border-2 border-black rounded-[12px]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-sm">Status</Label>
                <select
                  value={editExpense.status}
                  onChange={(e) => setEditExpense({ ...editExpense, status: e.target.value as any })}
                  className="w-full h-[44px] px-3 border-2 border-black rounded-[12px] text-sm bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-sm">Description</Label>
                <Textarea
                  value={editExpense.description}
                  onChange={(e) => setEditExpense({ ...editExpense, description: e.target.value })}
                  className="border-2 border-black rounded-[12px]"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditExpense(null)} className="rounded-[12px] border-2 border-black">
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#4545E9] hover:bg-[#3737D4] text-white font-bold rounded-[12px] border-2 border-black">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* DELETE CONFIRMATION ALERT DIALOG */}
      <AlertDialog open={deleteExpenseId !== null} onOpenChange={() => setDeleteExpenseId(null)}>
        <AlertDialogContent className="border-2 border-black rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-lg text-black">Delete Expense Record</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 font-medium">
              Are you sure you want to delete this expense record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2 border-black rounded-[12px] font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-rose-600 hover:bg-rose-700 text-white font-bold border-2 border-black rounded-[12px]">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
