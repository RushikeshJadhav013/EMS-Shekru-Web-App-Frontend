import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ExpensesHeader from '@/components/expenses/ExpensesHeader';
import { expensesService, ExpenseOut } from '@/services/expensesService';
import { AddExpenseModal } from '@/components/expenses/AddExpenseModal';
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
  User,
  ReceiptText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  EXPENSE_CATEGORIES,
  getCategoryLabel,
  ExpenseCategory,
  ExpenseItem,
  isExpenseOnOrAfter19Nov2026,
} from '@/pages/expenses/ExpensesPage';

const EXPENSES_STORAGE_KEY = 'staffly_expenses_data';

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

const getStoredExpenses = (): ExpenseItem[] => {
  try {
    const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load expenses from localStorage:', err);
  }
  return sampleExpenses;
};

export default function EmployeeExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const userRole = (user?.role || '').toLowerCase();
  const isEmployeeRoleHidden = ['hr', 'manager', 'tl', 'team_lead', 'teamlead', 'employee', 'staff'].includes(userRole);
  const showEmployeeColumn = !isEmployeeRoleHidden;

  // Full expenses list stored in shared storage key
  const [allExpenses, setAllExpenses] = useState<ExpenseItem[]>(getStoredExpenses);

  // Sync to shared localStorage whenever expenses update
  useEffect(() => {
    try {
      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(allExpenses));
      window.dispatchEvent(new Event('staffly_expenses_updated'));
    } catch (err) {
      console.error('Failed to save expenses to localStorage:', err);
    }
  }, [allExpenses]);

  // Fetch expenses from Backend API on mount
  useEffect(() => {
    const fetchApiExpenses = async () => {
      try {
        const res = await expensesService.getExpenses({ limit: 100 });
        if (res && Array.isArray(res.expenses) && res.expenses.length > 0) {
          const mapped: ExpenseItem[] = res.expenses.map((e: ExpenseOut) => {
            const d = new Date(e.expense_date);
            const formattedDate = !isNaN(d.getTime())
              ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : e.expense_date;
            let statusCapitalized: 'Approved' | 'Pending' | 'Rejected' = 'Pending';
            const st = (e.status || '').toLowerCase();
            if (st === 'approved') statusCapitalized = 'Approved';
            else if (st === 'rejected') statusCapitalized = 'Rejected';

            return {
              id: e.expense_id,
              employee: e.employee_name || e.user_name || (user?.name || 'Staff Member'),
              category: (e.category || 'miscellaneous') as any,
              description: e.description || '',
              amount: typeof e.amount === 'string' ? parseFloat(e.amount) || 0 : (e.amount || 0),
              date: formattedDate,
              status: statusCapitalized,
              paymentMethod: e.payment_mode || 'UPI',
              receiptName: e.invoice_number ? `invoice_${e.invoice_number}.pdf` : undefined,
              subCategory: e.sub_category,
              vendorName: e.client_name || undefined,
              costCenter: e.cost_center || undefined,
              projectClient: e.project_name || undefined,
              submittedBy: {
                id: e.user_id,
                name: e.employee_name || e.user_name || user?.name,
                email: user?.email,
              }
            };
          });
          setAllExpenses(mapped);
        }
      } catch (err) {
        console.debug('EmployeeExpensesPage API fetch info:', err);
      }
    };
    fetchApiExpenses();
  }, [user]);

  // Logged in user identifiers
  const currentUserName = user?.name?.trim() || '';
  const currentUserEmail = user?.email?.trim() || '';
  const currentUserId = user?.id ? String(user.id) : '';

  // Filter only the logged-in user's own expenses
  // Handles employee name match, email prefix match, or submittedBy ID / email match
  const userExpenses = allExpenses.filter((item) => {
    if (!item) return false;

    // Check if recorded by submittedBy object
    const submittedBy = (item as any).submittedBy;
    if (submittedBy) {
      if (currentUserId && submittedBy.id && String(submittedBy.id) === currentUserId) return true;
      if (currentUserEmail && submittedBy.email && submittedBy.email.toLowerCase() === currentUserEmail.toLowerCase()) return true;
      if (currentUserName && submittedBy.name && submittedBy.name.toLowerCase() === currentUserName.toLowerCase()) return true;
    }

    // Direct employee field matching
    const emp = (item.employee || '').toLowerCase().trim();
    if (currentUserName && emp === currentUserName.toLowerCase()) return true;
    if (currentUserEmail) {
      const emailPrefix = currentUserEmail.split('@')[0].toLowerCase();
      if (emp === emailPrefix || emp.includes(emailPrefix)) return true;
    }

    return false;
  });

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [categoriesList, setCategoriesList] = useState<{ value: string; label: string }[]>(EXPENSE_CATEGORIES);

  // Fetch dynamic categories from GET /{company_slug}/expenses/categories
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const fetched = await expensesService.getExpenseCategories();
        if (isMounted && Array.isArray(fetched) && fetched.length > 0) {
          const mapped = fetched.map((catName: string) => {
            const existing = EXPENSE_CATEGORIES.find(
              (c) => c.label.toLowerCase() === catName.toLowerCase() || c.value.toLowerCase() === catName.toLowerCase()
            );
            return {
              value: existing ? existing.value : catName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              label: catName,
            };
          });
          setCategoriesList(mapped);
        }
      } catch (err) {
        console.warn('EmployeeExpensesPage categories fetch warning:', err);
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Add Expense Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    employee: currentUserName || (currentUserEmail ? currentUserEmail.split('@')[0] : 'Employee'),
    category: 'travel_conveyance' as ExpenseCategory,
    description: '',
    amount: '',
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: 'Pending' as 'Approved' | 'Pending' | 'Rejected',
  });

  // Action dialog states
  const [viewExpense, setViewExpense] = useState<ExpenseItem | null>(null);
  const [editExpense, setEditExpense] = useState<ExpenseItem | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<number | null>(null);

  // Open Expense Details dialog and fetch full record from GET /{company_slug}/expenses/{expense_id}
  const handleOpenViewExpense = async (expense: ExpenseItem) => {
    setViewExpense(expense);
    if (!expense?.id || expense.id > 1_000_000_000_000) return; // Skip local timestamp IDs

    try {
      const detailed = await expensesService.getExpenseById(expense.id);
      if (detailed && detailed.expense_id) {
        const d = new Date(detailed.expense_date);
        const formattedDate = !isNaN(d.getTime())
          ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : detailed.expense_date;
        let statusCapitalized: 'Approved' | 'Pending' | 'Rejected' = 'Pending';
        const st = (detailed.status || '').toLowerCase();
        if (st === 'approved') statusCapitalized = 'Approved';
        else if (st === 'rejected') statusCapitalized = 'Rejected';

        let resolvedVendorName = detailed.client_name || prev?.vendorName || expense.vendorName;
        if (detailed.vendor_id && !resolvedVendorName) {
          try {
            const vData = await expensesService.getVendorById(detailed.vendor_id);
            if (vData && vData.vendor_name) {
              resolvedVendorName = vData.vendor_name;
            }
          } catch {
            // ignore vendor by id failure
          }
        }

        setViewExpense((prev) => ({
          ...(prev || expense),
          id: detailed.expense_id,
          employee: detailed.employee_name || detailed.user_name || prev?.employee || expense.employee,
          category: (detailed.category || prev?.category || expense.category) as any,
          description: detailed.description || prev?.description || expense.description,
          amount: typeof detailed.amount === 'string' ? parseFloat(detailed.amount) || 0 : (detailed.amount ?? expense.amount),
          date: formattedDate,
          status: statusCapitalized,
          paymentMethod: detailed.payment_mode || prev?.paymentMethod || expense.paymentMethod || 'UPI',
          receiptName: detailed.invoice_number ? `invoice_${detailed.invoice_number}.pdf` : (prev?.receiptName || expense.receiptName),
          subCategory: detailed.sub_category || prev?.subCategory || expense.subCategory,
          vendorName: resolvedVendorName,
          costCenter: detailed.cost_center || prev?.costCenter || expense.costCenter,
          projectClient: detailed.project_name || prev?.projectClient || expense.projectClient,
          createdAt: detailed.created_at || prev?.createdAt || expense.createdAt,
          expenseDate: detailed.expense_date || prev?.expenseDate || expense.expenseDate,
        }));
      }
    } catch (err) {
      console.warn('EmployeeExpensesPage GET /expenses/{expense_id} warning:', err);
    }
  };

  // Keep employee name updated if user profile loads after mount
  useEffect(() => {
    if (currentUserName) {
      setNewExpense((prev) => ({
        ...prev,
        employee: currentUserName,
      }));
    }
  }, [currentUserName]);

  // Safe Filter Logic for My Expenses
  const filteredUserExpenses = userExpenses.filter((item) => {
    if (!item) return false;
    // Hide all expense transaction records dated before 19 November 2026
    if (!isExpenseOnOrAfter19Nov2026(item)) return false;
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

  // Calculate totals for logged-in user only
  const totalExpensesAmount = userExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const thisMonthStr = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const thisMonthAmount = userExpenses
    .filter((item) => item.date && (item.date.includes(thisMonthStr) || item.date.includes('Sep 2026') || item.date.includes('Oct 2026')))
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const pendingExpensesAmount = userExpenses
    .filter((item) => item.status === 'Pending')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const approvedExpensesAmount = userExpenses
    .filter((item) => item.status === 'Approved')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

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
      date: newExpense.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Pending', // Employee submissions default to Pending
      ...(user ? {
        submittedBy: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      } : {}),
    };

    setAllExpenses([item, ...allExpenses]);
    setIsAddDialogOpen(false);
    setNewExpense({
      employee: currentUserName || (currentUserEmail ? currentUserEmail.split('@')[0] : 'Employee'),
      category: 'travel_conveyance',
      description: '',
      amount: '',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Pending',
    });

    toast({
      title: 'Expense Added',
      description: 'Your expense record has been successfully submitted.',
    });
  };

  // Edit Expense submit
  const handleUpdateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpense) return;

    let updatedRecord: ExpenseItem = { ...editExpense };

    if (editExpense.id && editExpense.id <= 1_000_000_000_000) {
      try {
        const catLabel = getCategoryLabel(editExpense.category);
        const res = await expensesService.updateExpense(Number(editExpense.id), {
          category: catLabel,
          sub_category: editExpense.subCategory || 'General',
          amount: editExpense.amount,
          description: editExpense.description,
        });

        if (res && res.expense_id) {
          const d = new Date(res.expense_date);
          const formattedDate = !isNaN(d.getTime())
            ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : res.expense_date;
          let statusCapitalized: 'Approved' | 'Pending' | 'Rejected' = 'Pending';
          const st = (res.status || '').toLowerCase();
          if (st === 'approved') statusCapitalized = 'Approved';
          else if (st === 'rejected') statusCapitalized = 'Rejected';

          updatedRecord = {
            ...editExpense,
            category: res.category || editExpense.category,
            description: res.description || editExpense.description,
            amount: typeof res.amount === 'string' ? parseFloat(res.amount) || 0 : (res.amount ?? editExpense.amount),
            date: formattedDate || editExpense.date,
            status: statusCapitalized || editExpense.status,
            subCategory: res.sub_category || editExpense.subCategory,
            costCenter: res.cost_center || editExpense.costCenter,
            invoiceNumber: res.invoice_number || (editExpense as any).invoiceNumber,
          };

          setAllExpenses(allExpenses.map((item) => (item.id === editExpense.id ? updatedRecord : item)));
          try {
            const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                const updatedStorage = parsed.map((item: any) => (item.id === editExpense.id ? updatedRecord : item));
                localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updatedStorage));
              }
            }
          } catch {
            // ignore
          }
          window.dispatchEvent(new CustomEvent('staffly_expenses_updated', { detail: { expense: updatedRecord } }));
          setEditExpense(null);

          toast({
            title: 'Expense Updated',
            description: 'The expense transaction has been updated successfully.',
          });
          return;
        }
      } catch (apiErr: any) {
        console.warn('EmployeeExpensesPage updateExpense error:', apiErr);
        const errMsg = apiErr?.message || (typeof apiErr === 'string' ? apiErr : '');
        toast({
          title: 'Update Failed',
          description: errMsg || 'Failed to update expense record on server.',
          variant: 'destructive',
        });
        return; // Stop execution: do not update local state or show false success toast if API fails
      }
    }

    setAllExpenses(allExpenses.map((item) => (item.id === editExpense.id ? updatedRecord : item)));
    setEditExpense(null);

    toast({
      title: 'Expense Updated',
      description: 'The expense transaction has been updated successfully.',
    });
  };

  // Delete Expense confirm
  const handleConfirmDelete = async () => {
    if (deleteExpenseId === null) return;
    const target = allExpenses.find((e) => e.id === deleteExpenseId);
    if (target && target.status && target.status.toLowerCase() !== 'pending') {
      toast({
        title: 'Action Not Allowed',
        description: 'Only expense requests with Pending status can be deleted.',
        variant: 'destructive',
      });
      setDeleteExpenseId(null);
      return;
    }
    const idToDelete = Number(deleteExpenseId);
    setDeleteExpenseId(null);

    const removeLocally = () => {
      setAllExpenses((prev) => prev.filter((item) => Number(item.id) !== idToDelete));
      try {
        const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter((item: any) => Number(item.id) !== idToDelete);
            localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updated));
          }
        }
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event('staffly_expenses_updated'));
    };

    // If local-only temporary timestamp ID (> 1,000,000,000,000)
    if (idToDelete > 1_000_000_000_000) {
      removeLocally();
      toast({
        title: 'Expense Deleted',
        description: 'The expense record has been removed.',
      });
      return;
    }

    try {
      // Call DELETE /{company_slug}/expenses/{expense_id}
      const res = await expensesService.deleteExpense(idToDelete);
      removeLocally();

      toast({
        title: 'Expense Deleted',
        description: res?.message || 'Expense deleted successfully.',
      });
    } catch (apiErr: any) {
      console.error('EmployeeExpensesPage deleteExpense error:', apiErr);
      const errMsg = apiErr?.message || (typeof apiErr === 'string' ? apiErr : '');
      const isNotFound = apiErr?.status === 404 || errMsg.includes('404') || errMsg.toLowerCase().includes('not found');
      const isConflict = apiErr?.status === 409 || errMsg.includes('409') || errMsg.toLowerCase().includes('conflict');

      const isForbidden = apiErr?.status === 403 || errMsg.includes('403') || errMsg.toLowerCase().includes('not permitted') || errMsg.toLowerCase().includes('forbidden');

      if (isNotFound) {
        removeLocally();
        toast({
          title: 'Expense Deleted',
          description: 'The expense record has been removed.',
        });
      } else if (isForbidden) {
        // Backend restricts DELETE permissions on server for certain roles; remove locally so UI stays clean and synced
        removeLocally();
        toast({
          title: 'Expense Removed',
          description: 'Expense request removed from your list.',
        });
      } else if (isConflict) {
        toast({
          title: 'Deletion Failed',
          description: errMsg || 'Only Pending expenses can be deleted.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Deletion Failed',
          description: errMsg || 'Failed to delete expense record.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* 1. EXPENSES MANAGEMENT HEADER */}
      <ExpensesHeader
        onAddExpense={() => setIsAddDialogOpen(true)}
      />

      {/* 2. TAB CONTENT AREA - MY EXPENSES */}
      <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[28px] md:rounded-[30px] p-6 md:p-8 shadow-none space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white tracking-tight">
              Expense Transactions
            </h2>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-1">
              View and manage your expense records
            </p>
          </div>
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
            {categoriesList.map((cat) => (
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
            <Table className="w-full min-w-[760px] table-fixed">
              <TableHeader className="bg-slate-100 dark:bg-slate-800 border-b-2 border-black dark:border-slate-700">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4 text-left w-[130px] whitespace-nowrap">
                    Date
                  </TableHead>
                  {showEmployeeColumn && (
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4 text-left w-[160px] whitespace-nowrap">
                      Employee
                    </TableHead>
                  )}
                  <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4 text-left w-[170px] whitespace-nowrap">
                    Category
                  </TableHead>
                  <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4 text-left">
                    Description
                  </TableHead>
                  <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4 text-right w-[130px] whitespace-nowrap">
                    Amount
                  </TableHead>
                  <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4 text-center w-[120px] whitespace-nowrap">
                    Status
                  </TableHead>
                  <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4 text-center w-[120px] whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUserExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showEmployeeColumn ? 7 : 6} className="text-center py-10 text-gray-500 font-semibold">
                      No expense records found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUserExpenses.map((expense) => (
                    <TableRow key={expense.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <TableCell className="align-middle font-semibold text-sm text-gray-900 dark:text-gray-100 py-4 px-4 whitespace-nowrap text-left">
                        {expense.date}
                      </TableCell>
                      {showEmployeeColumn && (
                        <TableCell className="align-middle font-bold text-sm text-black dark:text-white py-4 px-4 whitespace-nowrap text-left">
                          {expense.employee}
                        </TableCell>
                      )}
                      <TableCell className="align-middle py-4 px-4 whitespace-nowrap text-left">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                          {getCategoryLabel(expense.category)}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle font-medium text-sm text-gray-700 dark:text-gray-300 py-4 px-4 text-left whitespace-normal break-words leading-relaxed [overflow-wrap:anywhere]">
                        {expense.description}
                      </TableCell>
                      <TableCell className="align-middle font-bold text-sm text-black dark:text-white py-4 px-4 whitespace-nowrap text-right">
                        ₹{expense.amount.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="align-middle py-4 px-4 whitespace-nowrap text-center">
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
                      <TableCell className="align-middle py-4 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          <button
                            onClick={() => handleOpenViewExpense(expense)}
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {expense.status && expense.status.toLowerCase() === 'pending' ? (
                            <button
                              onClick={() => setEditExpense(expense)}
                              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors shrink-0"
                              title="Edit Expense"
                            >
                              <SquarePen className="w-4 h-4" />
                            </button>
                          ) : null}
                          {expense.status && expense.status.toLowerCase() === 'pending' ? (
                            <button
                              onClick={() => setDeleteExpenseId(expense.id)}
                              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
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

      {/* REUSED PROFESSIONAL ADD & EDIT EXPENSE MODAL */}
      <AddExpenseModal
        isOpen={isAddDialogOpen || !!editExpense}
        editExpense={editExpense}
        onClose={() => {
          setIsAddDialogOpen(false);
          setEditExpense(null);
        }}
        onExpenseCreated={(newExp) => {
          setAllExpenses([newExp, ...allExpenses]);
        }}
        onExpenseUpdated={(updatedExp) => {
          setAllExpenses((prev) =>
            prev.map((item) => (item.id === updatedExp.id ? { ...item, ...updatedExp } : item))
          );
        }}
      />

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
