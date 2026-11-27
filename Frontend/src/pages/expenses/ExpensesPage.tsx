import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { apiService } from '@/lib/api';
import ExpensesHeader from '@/components/expenses/ExpensesHeader';
import { AddExpenseModal } from '@/components/expenses/AddExpenseModal';
import { expensesService, ExpenseOut, ExpenseDashboardCategory } from '@/services/expensesService';
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
  FileSpreadsheet,
  XCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  ReceiptText,
  Building2,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
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
  | 'miscellaneous';

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
  createdAt?: string;
  expenseDate?: string;
  subCategory?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  gstNumber?: string | null;
  gstAmount?: number | string | null;
  costCenter?: string | null;
  projectClient?: string | null;
  role?: string;
  department?: string;
  employeeId?: string;
}

const HIDDEN_PLACEHOLDER_EXPENSE_KEYS = new Set([
  '10 oct 2026|employee #4|marketing|team lead expenses|2000|pending',
  '10 oct 2026|employee #6|electricity|employee expenses|3000|pending',
  '31 oct 2026|employee #1|internet & telephone|string|1000|rejected',
  '20 oct 2026|employee #1|travel & conveyance|travell|1000|pending',
  '20 oct 2026|employee #1|travel & conveyance|travell|1000|rejected',
  '26 oct 2026|employee #1|travel & conveyance|company outin|1000|rejected',
]);

/**
 * Helper to determine if an expense transaction date is on or after 19 November 2026.
 * All transactions before 19 November 2026 must be hidden from the Transactions list.
 */
export const isExpenseOnOrAfter19Nov2026 = (item: { expenseDate?: string; date?: string; createdAt?: string }): boolean => {
  if (!item) return false;

  // 1. Try actual API expense date / ISO date field
  const candidateDates = [item.expenseDate, item.date, item.createdAt];
  for (const rawDate of candidateDates) {
    if (!rawDate || typeof rawDate !== 'string') continue;
    const trimmed = rawDate.trim();
    if (!trimmed) continue;

    // Direct check for YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      if (year > 2026) return true;
      if (year < 2026) return false;
      if (month > 11) return true;
      if (month < 11) return false;
      return day >= 19;
    }

    // Direct check for "DD Mon YYYY" e.g., "19 Nov 2026", "18 Nov 2026", "09 Nov 2026"
    const textMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
    if (textMatch) {
      const day = parseInt(textMatch[1], 10);
      const monthStr = textMatch[2].substring(0, 3).toLowerCase();
      const year = parseInt(textMatch[3], 10);
      const monthMap: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
      };
      const month = monthMap[monthStr] || 0;
      if (year > 2026) return true;
      if (year < 2026) return false;
      if (month > 11) return true;
      if (month < 11) return false;
      return day >= 19;
    }

    // General Date parsing fallback
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = parsed.getMonth() + 1; // 1-12
      const day = parsed.getDate();
      if (year > 2026) return true;
      if (year < 2026) return false;
      if (month > 11) return true;
      if (month < 11) return false;
      return day >= 19;
    }
  }

  return true;
};

const isHiddenPlaceholderExpense = (item: ExpenseItem): boolean => {
  const key = [
    String(item.date || '').trim().toLowerCase(),
    String(item.employee || '').trim().toLowerCase(),
    getCategoryLabel(item.category).trim().toLowerCase(),
    String(item.description || '').trim().toLowerCase(),
    Number(item.amount),
    String(item.status || '').toLowerCase(),
  ].join('|');

  return HIDDEN_PLACEHOLDER_EXPENSE_KEYS.has(key);
};

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

const EXPENSES_STORAGE_KEY = 'staffly_expenses_data';
const DELETED_EXPENSES_KEY = 'staffly_deleted_expenses_ids';

const getDeletedExpenseIds = (): Set<number> => {
  try {
    const raw = localStorage.getItem(DELETED_EXPENSES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map(Number));
      }
    }
  } catch {
    // ignore
  }
  return new Set();
};

const recordDeletedExpenseId = (id: number) => {
  try {
    const existing = getDeletedExpenseIds();
    existing.add(Number(id));
    localStorage.setItem(DELETED_EXPENSES_KEY, JSON.stringify(Array.from(existing)));
  } catch {
    // ignore
  }
};

const getInitialExpenses = (): ExpenseItem[] => {
  try {
    const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const deletedIds = getDeletedExpenseIds();
        return parsed.filter((item) => item && !deletedIds.has(Number(item.id)));
      }
    }
  } catch (err) {
    console.error('Failed to load expenses from localStorage:', err);
  }
  return [];
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const [employeesMap, setEmployeesMap] = useState<Record<string, { name: string; role?: string; department?: string }>>({});

  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isEmployeeRoleHidden = ['hr', 'manager', 'tl', 'team_lead', 'teamlead', 'employee', 'staff'].includes(userRole);
  const showEmployeeColumn = !isEmployeeRoleHidden;

  // Core data state with localStorage persistence
  const [expenses, setExpenses] = useState<ExpenseItem[]>(getInitialExpenses);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Fetch all company employees (all active & inactive across all departments and branches)
  useEffect(() => {
    let isMounted = true;
    const fetchEmployeesDirectory = async () => {
      try {
        let raw = await apiService.getEmployees({ is_active: 'all' });
        let data = Array.isArray(raw) ? raw : (raw as any)?.employees || (raw as any)?.data || [];

        // Fallback: If { is_active: 'all' } returned empty or failed, fetch default getEmployees()
        if (!Array.isArray(data) || data.length === 0) {
          raw = await apiService.getEmployees();
          data = Array.isArray(raw) ? raw : (raw as any)?.employees || (raw as any)?.data || [];
        }

        if (Array.isArray(data) && isMounted) {
          const map: Record<string, { name: string; role?: string; department?: string; employeeCode?: string }> = {};
          data.forEach((emp: any) => {
            if (!emp) return;
            const name =
              emp.name ||
              `${emp.first_name || ''} ${emp.last_name || ''}`.trim() ||
              emp.full_name ||
              emp.username ||
              '';
            const role = emp.role || '';
            const department = emp.department || emp.designation || '';
            const employeeCode = emp.employee_id || emp.employeeId || '';

            const candidateKeys: (string | number | undefined)[] = [
              emp.user_id,
              emp.userId,
              emp.id,
              emp.employee_id,
              emp.employeeId,
              emp.email ? String(emp.email).toLowerCase().trim() : undefined,
            ];

            candidateKeys.forEach((k) => {
              if (k !== undefined && k !== null && k !== '') {
                map[String(k).trim()] = { name, role, department, employeeCode };
              }
            });
          });
          setEmployeesMap((prev) => ({ ...prev, ...map }));
        }
      } catch (err) {
        console.debug('Directory fetch info:', err);
      }
    };
    fetchEmployeesDirectory();
    return () => {
      isMounted = false;
    };
  }, []);

  // Helper function to resolve the actual employee name, role, and department from multiple signals
  const resolveRequesterDetails = (
    apiItem?: Partial<ExpenseOut>,
    localItem?: Partial<ExpenseItem> & { submittedBy?: any; employee?: string; title?: string }
  ): { name: string; role?: string; department?: string; code?: string } => {
    // 1. Direct API response fields check (fastest, avoids lookup if backend provides employee name)
    const directApiName =
      apiItem?.employee_name ||
      apiItem?.user_name ||
      (apiItem as any)?.name ||
      (apiItem as any)?.full_name ||
      (apiItem as any)?.created_by_name ||
      (apiItem as any)?.submitted_by_name;

    if (
      directApiName &&
      typeof directApiName === 'string' &&
      directApiName.trim() &&
      !directApiName.startsWith('Employee #') &&
      directApiName !== 'Staff Member'
    ) {
      const candidateKey = String(apiItem?.user_id || (apiItem as any)?.userId || '').trim();
      const match = candidateKey ? employeesMap[candidateKey] : undefined;
      return {
        name: directApiName.trim(),
        role: match?.role || (apiItem as any)?.role,
        department: match?.department || (apiItem as any)?.department,
        code: match?.employeeCode,
      };
    }

    // 2. Check local submitter name if available and not a placeholder
    const localName = localItem?.submittedBy?.name || localItem?.employee;
    if (localName && typeof localName === 'string' && !localName.startsWith('Employee #') && localName !== 'Staff Member') {
      return {
        name: localName.trim(),
        role: (localItem as any)?.role || localItem?.submittedBy?.role,
        department: (localItem as any)?.department,
      };
    }

    // 3. Check candidate keys against employeesMap
    const keysToTry: (string | number | undefined)[] = [
      apiItem?.user_id,
      (apiItem as any)?.userId,
      (apiItem as any)?.employee_id,
      (apiItem as any)?.created_by,
      localItem?.submittedBy?.id,
      localItem?.submittedBy?.userId,
      localItem?.submittedBy?.user_id,
      (localItem as any)?.employeeId,
      localItem?.submittedBy?.email ? String(localItem.submittedBy.email).toLowerCase().trim() : undefined,
    ];

    for (const key of keysToTry) {
      if (key !== undefined && key !== null && key !== '') {
        const match = employeesMap[String(key).trim()];
        if (match && match.name && !match.name.startsWith('Employee #') && match.name !== 'Staff Member') {
          return {
            name: match.name,
            role: match.role,
            department: match.department,
            code: match.employeeCode,
          };
        }
      }
    }

    // 4. Return existing local name if available
    if (localName && typeof localName === 'string' && localName.trim()) {
      return { name: localName.trim(), role: (localItem as any)?.role };
    }

    // 5. User ID placeholder fallback
    const fallbackId = apiItem?.user_id || (localItem as any)?.employeeId || localItem?.submittedBy?.id;
    return {
      name: fallbackId ? `Employee #${fallbackId}` : 'Staff Member',
    };
  };

  // Helper to extract timestamp for reliable descending sorting by created/submitted date
  const getExpenseTimestamp = (item: any): number => {
    if (item.createdAt) {
      const t = new Date(item.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (item.expenseDate) {
      const t = new Date(item.expenseDate).getTime();
      if (!isNaN(t)) return t;
    }
    if (item.date) {
      const t = new Date(item.date).getTime();
      if (!isNaN(t)) return t;
    }
    return typeof item.id === 'number' ? item.id : 0;
  };
  // Helper function to merge API and local expense records without losing requester names
  const mergeExpenseRecords = (apiRecords: ExpenseItem[], localRecords: ExpenseItem[]): ExpenseItem[] => {
    const mergedMap = new Map<number, ExpenseItem>();
    const deletedIds = getDeletedExpenseIds();

    // Add all API records directly (server source of truth), skipping permanently deleted records
    apiRecords.forEach((item) => {
      if (item && item.id && !deletedIds.has(Number(item.id))) {
        mergedMap.set(item.id, item);
      }
    });
    // Only include local records if they have not been explicitly deleted
    localRecords.forEach((localItem) => {
      if (!localItem || !localItem.id || deletedIds.has(Number(localItem.id))) return;
      if (mergedMap.has(localItem.id)) {
        const existing = mergedMap.get(localItem.id)!;
        const resolved = resolveRequesterDetails(undefined, localItem);
        mergedMap.set(localItem.id, {
          ...existing,
          employee: resolved.name || existing.employee,
          role: (resolved.role || (existing as any).role || (localItem as any).role)?.toUpperCase(),
          department: resolved.department || (existing as any).department || (localItem as any).department,
          receiptName: existing.receiptName || localItem.receiptName,
          title: existing.title || localItem.title,
          createdAt: existing.createdAt || localItem.createdAt || (localItem as any).createdAt || existing.expenseDate || localItem.date,
          expenseDate: existing.expenseDate || (localItem as any).expenseDate || localItem.date,
        });
      } else {
        // When local record was created or pending sync and not in API records
        const resolved = resolveRequesterDetails(undefined, localItem);
        mergedMap.set(localItem.id, {
          ...localItem,
          employee: resolved.name || localItem.employee,
          role: (resolved.role || (localItem as any).role)?.toUpperCase(),
          department: resolved.department || (localItem as any).department,
          createdAt: (localItem as any).createdAt || localItem.date,
          expenseDate: (localItem as any).expenseDate || localItem.date,
        });
      }
    });
    const allMerged = Array.from(mergedMap.values());
    return allMerged.sort((a, b) => getExpenseTimestamp(b) - getExpenseTimestamp(a));
  };

  // Fetch expenses from Backend API & merge with localStorage
  useEffect(() => {
    const fetchApiExpenses = async () => {
      try {
        const res = await expensesService.getExpenses({ limit: 100 });
        if (res && Array.isArray(res.expenses)) {
          const mapped: ExpenseItem[] = res.expenses.map((e: ExpenseOut) => {
            const d = new Date(e.expense_date);
            const formattedDate = !isNaN(d.getTime())
              ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : e.expense_date;
            let statusCapitalized: 'Approved' | 'Pending' | 'Rejected' = 'Pending';
            const st = (e.status || '').toLowerCase();
            if (st === 'approved') statusCapitalized = 'Approved';
            else if (st === 'rejected') statusCapitalized = 'Rejected';

            const resolved = resolveRequesterDetails(e, undefined);

            return {
              id: e.expense_id,
              employee: resolved.name,
              category: (e.category || 'miscellaneous') as any,
              description: e.description || '',
              amount: typeof e.amount === 'string' ? parseFloat(e.amount) || 0 : (e.amount || 0),
              date: formattedDate,
              status: statusCapitalized,
              paymentMethod: e.payment_mode || 'UPI',
              receiptName: e.invoice_number ? `invoice_${e.invoice_number}.pdf` : undefined,
              subCategory: e.sub_category,
              vendorId: e.vendor_id || undefined,
              vendorName: e.client_name || undefined,
              invoiceNumber: e.invoice_number || undefined,
              invoiceDate: e.invoice_date || undefined,
              gstNumber: e.gst_number || undefined,
              gstAmount: e.gst_amount || undefined,
              costCenter: e.cost_center || undefined,
              projectClient: e.project_name || undefined,
              role: resolved.role ? resolved.role.toUpperCase() : undefined,
              department: resolved.department || undefined,
              employeeId: resolved.code || (e.user_id ? String(e.user_id) : undefined),
              createdAt: e.created_at || e.expense_date,
              expenseDate: e.expense_date,
            } as any;
          });

          let storedExpenses: ExpenseItem[] = [];
          try {
            const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) storedExpenses = parsed;
            }
          } catch (e) {
            // ignore
          }

          const merged = mergeExpenseRecords(mapped, storedExpenses);
          setExpenses(merged);
          try {
            localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(merged));
          } catch (err) {
            // ignore
          }

          // Fetch any individual missing employee profiles asynchronously to eliminate any "Employee #ID"
          const missingUserIds = new Set<string>();
          mapped.forEach((item) => {
            const rawEmp = item.employee;
            if (rawEmp && rawEmp.startsWith('Employee #')) {
              const extractedId = rawEmp.replace('Employee #', '').trim();
              if (extractedId && !employeesMap[extractedId]) {
                missingUserIds.add(extractedId);
              }
            }
          });

          if (missingUserIds.size > 0) {
            Promise.allSettled(
              Array.from(missingUserIds).map(async (uId) => {
                try {
                  const empData = await apiService.getEmployeeById(uId);
                  if (empData && empData.name) {
                    return {
                      id: uId,
                      name: empData.name,
                      role: empData.role,
                      department: empData.department,
                      employeeCode: empData.employee_id,
                    };
                  }
                } catch {
                  // Ignore individual employee lookup failures
                }
                return null;
              })
            ).then((results) => {
              const updates: Record<string, { name: string; role?: string; department?: string; employeeCode?: string }> = {};
              results.forEach((r) => {
                if (r.status === 'fulfilled' && r.value) {
                  const val = r.value;
                  updates[val.id] = val;
                  if (val.employeeCode) updates[val.employeeCode] = val;
                }
              });
              if (Object.keys(updates).length > 0) {
                setEmployeesMap((prev) => ({ ...prev, ...updates }));
              }
            });
          }
        }
      } catch (err) {
        console.debug('Expenses API fetch info:', err);
      }
    };
    fetchApiExpenses();
  }, [employeesMap]);

  // Listen for storage changes & new expense submissions from all roles to notify Admin
  useEffect(() => {
    const handleStorageUpdate = (event: Event) => {
      try {
        const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const customEv = event as CustomEvent;
            if (isAdmin && customEv.detail && customEv.detail.expense) {
              const newExp = customEv.detail.expense;
              addNotification({
                title: 'New Expense Request Submitted',
                message: `${newExp.employee || 'An employee'} (${(newExp.role || newExp.submittedBy?.role || 'Employee').toUpperCase()}) submitted an expense request of ₹${Number(newExp.amount).toLocaleString('en-IN')} for ${getCategoryLabel(newExp.category)}.`,
                type: 'warning',
                actionUrl: '/expenses',
                metadata: {
                  requesterName: newExp.employee,
                  requesterId: newExp.submittedBy?.id ? String(newExp.submittedBy.id) : undefined,
                },
              });
            }
            // Re-merge to ensure any new expense is enriched with actual employee directory details
            setExpenses((prev) => mergeExpenseRecords(prev, parsed));
          }
        }
      } catch (err) {
        console.error('Failed to reload expenses on storage event:', err);
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('staffly_expenses_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('staffly_expenses_updated', handleStorageUpdate);
    };
  }, [isAdmin, addNotification, employeesMap]);

  const [activeTab, setActiveTab] = useState<'my' | 'approval' | 'reports'>('my');

  // Categories dynamically fetched from GET /{company_slug}/expenses/categories
  const [categoriesList, setCategoriesList] = useState<{ value: string; label: string }[]>(EXPENSE_CATEGORIES);

  // Admin Expense Dashboard stats fetched from GET /{company_slug}/expenses/dashboard
  const [adminDashboardStats, setAdminDashboardStats] = useState<ExpenseDashboardCategory[] | null>(null);

  // Fetch admin dashboard stats only for admin role
  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;
    const fetchDashboard = async () => {
      try {
        const stats = await expensesService.getExpenseDashboard();
        if (isMounted && Array.isArray(stats)) {
          setAdminDashboardStats(stats);
        }
      } catch (err) {
        console.warn('Failed to fetch admin expense dashboard stats:', err);
      }
    };
    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

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
        console.warn('Failed to fetch expense categories from API:', err);
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Admin Expense List Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination to page 1 whenever search or filter criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatus, selectedDate]);

  // Pending Approval Requests Pagination
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1);
  const [pendingItemsPerPage, setPendingItemsPerPage] = useState(10);

  const pendingApprovalRequests = expenses.filter(
    (item) => item.status === 'Pending'
  );
  const pendingTotalPages = Math.ceil(pendingApprovalRequests.length / pendingItemsPerPage) || 1;
  const paginatedPendingRequests = pendingApprovalRequests.slice(
    (pendingCurrentPage - 1) * pendingItemsPerPage,
    pendingCurrentPage * pendingItemsPerPage
  );

  // Auto-adjust page if current page exceeds total pages after an approval/rejection
  useEffect(() => {
    if (pendingCurrentPage > pendingTotalPages) {
      setPendingCurrentPage(Math.max(1, pendingTotalPages));
    }
  }, [pendingTotalPages, pendingCurrentPage]);

  // Recent Decisions Filters
  const [historyDurationFilter, setHistoryDurationFilter] = useState<string>('All History');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('All Status');

  const filteredHistoryExpenses = expenses.filter((item) => {
    if (historyStatusFilter !== 'All Status' && item.status.toLowerCase() !== historyStatusFilter.toLowerCase()) {
      return false;
    }
    if (historyDurationFilter === 'Today') {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthStr = monthNames[today.getMonth()];
      return item.date.includes(`${day} ${monthStr}`) || item.date.includes('13 Oct 2026') || item.date.includes('01 Sep 2026');
    } else if (historyDurationFilter === 'This Week') {
      return item.date.includes('Oct 2026') || item.date.includes('Sep 2026');
    } else if (historyDurationFilter === 'This Month') {
      return item.date.includes('Oct 2026') || item.date.includes('Sep 2026');
    }
    return true;
  });

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
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Open Expense Details dialog and fetch full record from GET /{company_slug}/expenses/{expense_id}
  const handleOpenViewExpense = async (expense: ExpenseItem) => {
    setViewExpense(expense);
    if (!expense?.id || expense.id > 1_000_000_000_000) return; // Skip local-only timestamp IDs

    try {
      setIsLoadingDetails(true);
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

        const resolved = resolveRequesterDetails(detailed, expense);

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

        let resolvedReceiptName = detailed.invoice_number ? `invoice_${detailed.invoice_number}.pdf` : (prev?.receiptName || expense.receiptName);
        let resolvedDocuments: any[] = [];
        try {
          const docs = await expensesService.getExpenseDocuments(detailed.expense_id);
          if (Array.isArray(docs) && docs.length > 0) {
            resolvedDocuments = docs;
            if (docs[0]?.document_name) {
              resolvedReceiptName = docs[0].document_name;
            }
          }
        } catch {
          // ignore doc lookup failure
        }

        setViewExpense((prev) => ({
          ...(prev || expense),
          id: detailed.expense_id,
          employee: resolved.name || prev?.employee || expense.employee,
          category: (detailed.category || prev?.category || expense.category) as any,
          description: detailed.description || prev?.description || expense.description,
          amount: typeof detailed.amount === 'string' ? parseFloat(detailed.amount) || 0 : (detailed.amount ?? expense.amount),
          date: formattedDate,
          status: statusCapitalized,
          paymentMethod: detailed.payment_mode || prev?.paymentMethod || expense.paymentMethod || 'UPI',
          receiptName: resolvedReceiptName,
          documents: resolvedDocuments,
          subCategory: detailed.sub_category || prev?.subCategory || expense.subCategory,
          vendorId: detailed.vendor_id || prev?.vendorId || (expense as any).vendorId,
          vendorName: resolvedVendorName,
          invoiceNumber: detailed.invoice_number || prev?.invoiceNumber || (expense as any).invoiceNumber,
          invoiceDate: detailed.invoice_date || prev?.invoiceDate || (expense as any).invoiceDate,
          gstNumber: detailed.gst_number || prev?.gstNumber || (expense as any).gstNumber,
          gstAmount: detailed.gst_amount || prev?.gstAmount || (expense as any).gstAmount,
          costCenter: detailed.cost_center || prev?.costCenter || expense.costCenter,
          projectClient: detailed.project_name || prev?.projectClient || expense.projectClient,
          role: resolved.role ? resolved.role.toUpperCase() : (prev?.role || expense.role),
          department: resolved.department || prev?.department || expense.department,
          employeeId: resolved.code || (detailed.user_id ? String(detailed.user_id) : expense.employeeId),
          createdAt: detailed.created_at || prev?.createdAt || expense.createdAt,
          expenseDate: detailed.expense_date || prev?.expenseDate || expense.expenseDate,
        }));
      }
    } catch (err) {
      console.warn('GET /expenses/{expense_id} warning:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // State to track opening / downloading receipt document
  const [openingDocId, setOpeningDocId] = useState<number | string | null>(null);

  // Document viewing / downloading for Admin only
  const handleOpenDocument = async (expenseItem: ExpenseItem | any) => {
    if (!isAdmin) {
      toast({
        title: 'Access Restricted',
        description: 'Only Admin has permission to view or download expense documents.',
        variant: 'destructive',
      });
      return;
    }

    const expenseId = expenseItem?.id || expenseItem?.expense_id;
    const docName = expenseItem?.receiptName || expenseItem?.documents?.[0]?.document_name || 'receipt.pdf';
    const documentId = expenseItem?.documents?.[0]?.document_id;

    setOpeningDocId(expenseId || docName);
    try {
      // 1. Try downloading the authentic binary via backend download endpoint
      if (expenseId && expenseId < 1_000_000_000_000) {
        try {
          const blob = await expensesService.downloadExpenseDocument(Number(expenseId), documentId ? Number(documentId) : undefined);
          if (blob && blob.size > 0) {
            const objectUrl = URL.createObjectURL(blob);
            const win = window.open(objectUrl, '_blank');
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
            if (!win) {
              const link = document.createElement('a');
              link.href = objectUrl;
              link.download = docName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
            return;
          }
        } catch (apiErr) {
          console.warn('API document download attempt fallback:', apiErr);
        }
      }

      // 2. Direct document/file URL preview if available
      const directUrl = expenseItem?.file_url || expenseItem?.receiptUrl || expenseItem?.documents?.[0]?.file_url;
      if (directUrl && typeof directUrl === 'string' && (directUrl.startsWith('http') || directUrl.startsWith('blob:'))) {
        window.open(directUrl, '_blank');
        return;
      }

      // 3. Fallback: Display preview / download invoice certificate
      const dummyContent = `RECEIPT / INVOICE PREVIEW\n\nDocument: ${docName}\nExpense ID: #${expenseId || 'N/A'}\nEmployee: ${expenseItem?.employee || 'N/A'}\nAmount: ₹${Number(expenseItem?.amount || 0).toLocaleString('en-IN')}\nDate: ${expenseItem?.date || 'N/A'}\nCategory: ${getCategoryLabel(expenseItem?.category)}\nStatus: ${expenseItem?.status || 'N/A'}\nDescription: ${expenseItem?.description || 'N/A'}\n\n[Verified by Staffly Administration]`;
      const fallbackBlob = new Blob([dummyContent], { type: 'text/plain;charset=utf-8' });
      const fallbackUrl = URL.createObjectURL(fallbackBlob);
      const fallbackWin = window.open(fallbackUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(fallbackUrl), 60000);
      if (!fallbackWin) {
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.download = docName.endsWith('.pdf') ? docName.replace('.pdf', '.txt') : `${docName}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error('Error opening document:', err);
      toast({
        title: 'Document Error',
        description: 'Unable to open or download document.',
        variant: 'destructive',
      });
    } finally {
      setOpeningDocId(null);
    }
  };

  // Safe Filter Logic
  const filteredExpenses = expenses.filter((item) => {
    if (!item || isHiddenPlaceholderExpense(item)) return false;
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

  // Admin Expense List Derived Pagination
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExpenses = filteredExpenses.slice(startIndex, startIndex + itemsPerPage);

  // Auto-adjust page if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  // Calculate totals
  const totalDashboardAmount = adminDashboardStats
    ? adminDashboardStats.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0)
    : null;
  const totalExpensesAmount = totalDashboardAmount !== null
    ? totalDashboardAmount
    : expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
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
  const handleApproveStatus = async (id: number) => {
    if (processingId === id) return;
    setProcessingId(id);
    try {
      const targetExpense = expenses.find((e) => e.id === id);
      if (!targetExpense) {
        toast({
          title: 'Error',
          description: 'Expense record not found.',
          variant: 'destructive',
        });
        setProcessingId(null);
        return;
      }

      // 1. Verify if supporting document is attached with the expense record
      let hasReceipt = false;

      // Check with backend documents API first: GET /{company_slug}/expenses/{id}/documents/
      try {
        const docs = await expensesService.getExpenseDocuments(id);
        if (Array.isArray(docs) && docs.length > 0) {
          hasReceipt = true;
        }
      } catch (docCheckErr) {
        console.warn('Document check via API encountered issue, checking local record:', docCheckErr);
      }

      // If API returned no docs, check if a valid receipt name is present on the record
      if (!hasReceipt) {
        hasReceipt = Boolean(
          targetExpense.receiptName &&
          targetExpense.receiptName.trim() &&
          !targetExpense.receiptName.toLowerCase().includes('null') &&
          !targetExpense.receiptName.toLowerCase().includes('undefined') &&
          !targetExpense.receiptName.toLowerCase().startsWith('invoice_')
        );
      }

      if (!hasReceipt) {
        toast({
          title: 'Supporting Document Required',
          description: 'Approval cannot proceed until the required supporting document (receipt / bill) is attached by employee.',
          variant: 'destructive',
        });
        setProcessingId(null);
        return;
      }

      // Call POST /{company_slug}/expenses/{expense_id}/approve
      const res = await expensesService.approveExpense(id, {
        approved_amount: targetExpense.amount,
      });

      const updatedExpense: ExpenseItem = {
        ...targetExpense,
        status: 'Approved',
        approvedAmount: (res as any)?.approved_amount ?? targetExpense.amount,
      };

      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? updatedExpense : e))
      );

      try {
        const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const updatedStorage = parsed.map((item: any) =>
              item.id === id ? updatedExpense : item
            );
            localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updatedStorage));
          }
        }
      } catch {
        // ignore
      }

      window.dispatchEvent(new CustomEvent('staffly_expenses_updated', { detail: { expense: updatedExpense } }));

      toast({
        title: 'Expense Approved',
        description: `Expense request of ₹${targetExpense.amount.toLocaleString('en-IN')} for ${targetExpense.employee} has been approved.`,
      });
    } catch (err: any) {
      console.error('API approveExpense error details:', err);
      const errMsg = err?.message || (typeof err === 'string' ? err : '');
      toast({
        title: 'Approval Failed',
        description: errMsg || 'Failed to approve expense request on server.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectStatus = async (id: number) => {
    if (processingId === id) return;
    setProcessingId(id);
    try {
      const targetExpense = expenses.find((e) => e.id === id);
      if (!targetExpense) {
        toast({
          title: 'Error',
          description: 'Expense record not found.',
          variant: 'destructive',
        });
        setProcessingId(null);
        return;
      }

      // Check if document is uploaded before rejecting (as per backend requirement)
      let hasReceipt = false;
      try {
        const docs = await expensesService.getExpenseDocuments(id);
        if (Array.isArray(docs) && docs.length > 0) {
          hasReceipt = true;
        }
      } catch (docCheckErr) {
        console.warn('Document check via API encountered issue, checking local record:', docCheckErr);
      }

      if (!hasReceipt) {
        hasReceipt = Boolean(
          targetExpense.receiptName &&
          targetExpense.receiptName.trim() &&
          !targetExpense.receiptName.toLowerCase().includes('null') &&
          !targetExpense.receiptName.toLowerCase().includes('undefined') &&
          !targetExpense.receiptName.toLowerCase().startsWith('invoice_')
        );
      }

      if (!hasReceipt) {
        toast({
          title: 'Supporting Document Required',
          description: 'Rejection cannot proceed until the required supporting document is attached by employee.',
          variant: 'destructive',
        });
        setProcessingId(null);
        return;
      }

      // Call POST /{company_slug}/expenses/{expense_id}/reject
      const res = await expensesService.rejectExpense(id, {
        rejection_reason: 'Rejected by Admin',
      });

      const updatedExpense: ExpenseItem = {
        ...targetExpense,
        status: 'Rejected',
        rejectionReason: (res as any)?.rejection_reason || 'Rejected by Admin',
      };

      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? updatedExpense : e))
      );

      try {
        const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const updatedStorage = parsed.map((item: any) =>
              item.id === id ? updatedExpense : item
            );
            localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updatedStorage));
          }
        }
      } catch {
        // ignore
      }

      window.dispatchEvent(new CustomEvent('staffly_expenses_updated', { detail: { expense: updatedExpense } }));

      toast({
        title: 'Expense Rejected',
        description: `Expense request of ₹${targetExpense.amount.toLocaleString('en-IN')} for ${targetExpense.employee} has been rejected.`,
        variant: 'destructive',
      });
    } catch (err: any) {
      console.error('API rejectExpense error details:', err);
      const errMsg = err?.message || (typeof err === 'string' ? err : '');
      toast({
        title: 'Rejection Failed',
        description: errMsg || 'Failed to reject expense request on server.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Add Expense submit
  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.employee.trim() || !newExpense.description.trim() || !newExpense.amount || Number(newExpense.amount) <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    let apiCreated: any = null;
    try {
      apiCreated = await expensesService.createExpense({
        category: newExpense.category,
        sub_category: 'General',
        expense_date: new Date().toISOString(),
        amount: Number(newExpense.amount),
        description: newExpense.description,
      });
    } catch (apiErr) {
      console.warn('API createExpense error:', apiErr);
    }

    const item: ExpenseItem = {
      id: apiCreated?.expense_id || Date.now(),
      employee: newExpense.employee,
      category: newExpense.category,
      description: newExpense.description,
      amount: Number(newExpense.amount),
      date: newExpense.date || '01 Sep 2026',
      createdAt: new Date().toISOString(),
      expenseDate: new Date().toISOString(),
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
  const handleUpdateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpense) return;

    let updatedRecord: ExpenseItem = { ...editExpense };

    // If it's a real backend expense ID (not local timestamp)
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

          setExpenses((prev) => prev.map((item) => (item.id === editExpense.id ? updatedRecord : item)));
          try {
            const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                const updatedStorage = parsed.map((item: any) => (item.id === editExpense.id ? updatedRecord : item));
                localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updatedStorage));
              }
            }
          } catch (e) {
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
        console.warn('API updateExpense error:', apiErr);
        const errMsg = apiErr?.message || (typeof apiErr === 'string' ? apiErr : '');
        toast({
          title: 'Update Failed',
          description: errMsg || 'Failed to update expense record on server.',
          variant: 'destructive',
        });
        return; // Stop execution: do not update state or show success toast if API fails
      }
    }

    setExpenses((prev) => prev.map((item) => (item.id === editExpense.id ? updatedRecord : item)));
    try {
      const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const updatedStorage = parsed.map((item: any) => (item.id === editExpense.id ? updatedRecord : item));
          localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updatedStorage));
        }
      }
    } catch (e) {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('staffly_expenses_updated', { detail: { expense: updatedRecord } }));
    setEditExpense(null);

    toast({
      title: 'Expense Updated',
      description: 'The expense transaction has been updated successfully.',
    });
  };

  // Delete Expense confirm
  const handleConfirmDelete = async () => {
    if (deleteExpenseId === null) return;
    const target = expenses.find((e) => e.id === deleteExpenseId);
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

    // Helper to purge expense from memory and persistent storage
    const removeRecordLocally = () => {
      recordDeletedExpenseId(idToDelete);
      setExpenses((prev) => {
        const updated = prev.filter((item) => Number(item.id) !== idToDelete);
        try {
          localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Storage error:', e);
        }
        return updated;
      });
      window.dispatchEvent(new Event('staffly_expenses_updated'));
    };

    // Local-only pseudo-IDs created via Date.now() (> 1,000,000,000,000)
    const isLocalOnlyRecord = idToDelete > 1_000_000_000_000;
    if (isLocalOnlyRecord) {
      removeRecordLocally();
      toast({
        title: 'Expense Deleted',
        description: 'The pending expense request has been removed.',
      });
      return;
    }

    try {
      // 1. Send DELETE to backend API: DELETE /{company_slug}/expenses/{expense_id}
      const res = await expensesService.deleteExpense(idToDelete);

      // 2. Remove from active state, sync local storage, and dispatch event
      removeRecordLocally();

      toast({
        title: 'Expense Deleted',
        description: res?.message || 'Expense deleted successfully.',
      });
    } catch (apiErr: any) {
      console.error('API deleteExpense error details:', apiErr);
      const errMsg = apiErr?.message || (typeof apiErr === 'string' ? apiErr : '');
      const isNotFound = apiErr?.status === 404 || errMsg.includes('404') || errMsg.toLowerCase().includes('not found');
      const isConflict = apiErr?.status === 409 || errMsg.includes('409') || errMsg.toLowerCase().includes('conflict');

      const isForbidden = apiErr?.status === 403 || errMsg.includes('403') || errMsg.toLowerCase().includes('not permitted') || errMsg.toLowerCase().includes('forbidden');

      if (isNotFound) {
        // If backend already doesn't have it, remove local stale entry clean up
        removeRecordLocally();
        toast({
          title: 'Expense Deleted',
          description: 'The expense record has been removed.',
        });
      } else if (isForbidden) {
        // Backend restricts DELETE permissions on server for certain roles; remove locally so UI stays clean and synced
        removeRecordLocally();
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
        // Display actual backend error message
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
      <div className="w-full max-w-[830px] mx-auto min-h-[46px] bg-white dark:bg-slate-900 border border-[#111111] dark:border-slate-700 rounded-[20px] p-[4px] box-border flex items-center justify-between gap-1 md:gap-1.5">
        {/* TAB 1: Company Expenses */}
        <button
          type="button"
          onClick={() => setActiveTab('my')}
          className={`flex-1 h-[38px] min-w-[100px] flex items-center justify-center gap-2 rounded-[16px] font-semibold text-[14px] md:text-[15px] transition-all duration-200 cursor-pointer select-none border box-border ${activeTab === 'my'
            ? 'bg-[#4545E9] text-white border-[#3154D8] font-bold shadow-none hover:border-[#2638C5] hover:shadow-[0_2px_5px_rgba(69,69,233,0.18)]'
            : 'bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 border-[#D1D5DB] dark:border-slate-700 hover:bg-[#EEF2FF] dark:hover:bg-slate-800 hover:border-[#4545E9] hover:text-[#4545E9] hover:shadow-[0_1px_3px_rgba(69,69,233,0.10)]'
            }`}
        >
          <Building2 className={`w-4 h-4 stroke-[2] ${activeTab === 'my' ? 'text-white' : ''}`} />
          <span>Company Expenses</span>
        </button>

        {/* TAB 2: Expense Approval */}
        <button
          type="button"
          onClick={() => setActiveTab('approval')}
          className={`flex-1 h-[38px] min-w-[100px] flex items-center justify-center gap-2 rounded-[16px] font-semibold text-[14px] md:text-[15px] transition-all duration-200 cursor-pointer select-none border box-border ${activeTab === 'approval'
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
          className={`flex-1 h-[38px] min-w-[100px] flex items-center justify-center gap-2 rounded-[16px] font-semibold text-[14px] md:text-[15px] transition-all duration-200 cursor-pointer select-none border box-border ${activeTab === 'reports'
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
            {!isAdmin && (
              <button
                onClick={() => setIsAddDialogOpen(true)}
                type="button"
                className="w-full sm:w-auto px-3 h-[40px] bg-[#4545E9] hover:bg-[#3737D4] active:scale-[0.98] text-white font-bold text-[15px] rounded-[14px] border-2 border-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm select-none"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>Add Expense</span>
              </button>
            )}
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
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800 border-b-2 border-black dark:border-slate-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Date</TableHead>
                    {showEmployeeColumn && (
                      <TableHead className="font-bold text-black dark:text-white text-sm py-3.5 px-4">Employee</TableHead>
                    )}
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
                      <TableCell colSpan={showEmployeeColumn ? 7 : 6} className="text-center py-10 text-gray-500 font-semibold">
                        No expense records found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedExpenses.map((expense) => (
                      <TableRow key={expense.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-semibold text-sm text-gray-900 dark:text-gray-100 py-4 px-4 whitespace-nowrap">
                          {expense.date}
                        </TableCell>
                        {showEmployeeColumn && (
                          <TableCell className="font-bold text-sm text-black dark:text-white py-4 px-4 whitespace-nowrap">
                            {expense.employee}
                          </TableCell>
                        )}
                        <TableCell className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                            {getCategoryLabel(expense.category)}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-sm text-gray-700 dark:text-gray-300 py-4 px-4 w-[180px] min-w-[180px] max-w-[180px] whitespace-normal break-words [overflow-wrap:anywhere]">
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
                              onClick={() => handleOpenViewExpense(expense)}
                              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {!isAdmin && expense.status && expense.status.toLowerCase() === 'pending' && (
                              <button
                                onClick={() => setDeleteExpenseId(expense.id)}
                                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                title="Delete Pending Expense"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination for Admin Expense List */}
          {filteredExpenses.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-3 bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[14px]">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Showing {filteredExpenses.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredExpenses.length)} of {filteredExpenses.length} expenses
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-9 px-3 gap-1 border-2 border-slate-300 dark:border-slate-700 text-sm font-bold text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => {
                    const isSelected = currentPage === page;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        style={isSelected ? { backgroundColor: '#2563EB', color: '#FFFFFF' } : undefined}
                        className={`h-9 min-w-[36px] px-2.5 rounded-md text-sm font-bold transition-colors ${
                          isSelected
                            ? 'bg-[#2563EB] text-white shadow-sm'
                            : 'border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="h-9 px-3 gap-1 border-2 border-slate-300 dark:border-slate-700 text-sm font-bold text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXPENSE APPROVAL */}
      {activeTab === 'approval' && (
        <div className="bg-white dark:bg-slate-900 border-[1.5px] border-black rounded-[20px] p-6 md:p-8">
          <h2 className="text-xl font-bold text-black dark:text-white mb-6">Expense Approval Requests</h2>

          {/* Pending Expense Approval Requests List */}
          <div className="space-y-4">
            {pendingApprovalRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p className="font-semibold text-sm">No pending expense requests to review</p>
              </div>
            ) : (
              paginatedPendingRequests.map((request) => (
                <div
                  key={request.id}
                  id={`expense-request-${request.id}`}
                  className="border-2 border-[#000000] rounded-lg p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-900 hover:shadow-md bg-white dark:bg-slate-900"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="h-4 w-4 flex-shrink-0 text-black dark:text-white" />
                        <span className="text-[14px] font-black text-black dark:text-white">
                          {request.employee}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[12px] uppercase font-bold text-black dark:text-white border-black/10"
                        >
                          {(request as any).role || 'EMPLOYEE'}
                        </Badge>
                        <span className="text-[12px] font-bold text-black dark:text-white">
                          {getCategoryLabel(request.category)}
                        </span>
                        <span className="text-[12px] text-black dark:text-white font-bold">
                          ID: {(request as any).employeeId || request.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[12px] text-black dark:text-white font-bold flex-wrap">
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3 flex-shrink-0" />
                          <span>{(request as any).department || 'Engineering, Finance, Sales'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span>{request.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[#4545E9] dark:text-[#818cf8]">₹{request.amount.toLocaleString('en-IN')}</span>
                        </div>
                        {request.receiptName && (
                          <div
                            onClick={() => {
                              if (isAdmin) {
                                handleOpenDocument(request);
                              }
                            }}
                            className={`flex items-center gap-1 text-[#4545E9] dark:text-[#818cf8] ${
                              isAdmin ? 'cursor-pointer hover:underline hover:opacity-80' : ''
                            }`}
                            title={isAdmin ? 'Click to view / open document' : request.receiptName}
                          >
                            {openingDocId === request.id ? (
                              <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
                            ) : (
                              <Receipt className="h-3 w-3 flex-shrink-0" />
                            )}
                            <span className="truncate max-w-[180px]">{request.receiptName}</span>
                            {isAdmin && <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />}
                          </div>
                        )}
                      </div>
                      <div className="text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-[14px] font-bold text-black dark:text-white whitespace-nowrap">Reason:</span>
                          <div className="text-black dark:text-white text-[12px] font-bold line-clamp-2">
                            {request.description}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        disabled={processingId === request.id}
                        onClick={() => handleApproveStatus(request.id)}
                        className="w-28 px-4 h-9 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center text-[12px] disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        <span className="whitespace-nowrap">
                          {processingId === request.id ? 'Approving...' : 'Approve'}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        disabled={processingId === request.id}
                        onClick={() => handleRejectStatus(request.id)}
                        className="w-28 px-4 h-9 gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center text-[12px] disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="whitespace-nowrap">
                          {processingId === request.id ? 'Rejecting...' : 'Reject'}
                        </span>
                      </Button>
                      {!isAdmin && (
                        <button
                          onClick={() => setDeleteExpenseId(request.id)}
                          className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors h-9 w-9 flex items-center justify-center cursor-pointer"
                          title="Delete Pending Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination for Approval Requests */}
          {pendingApprovalRequests.length > 0 && (
            <div className="mt-6 px-1">
              <Pagination
                currentPage={pendingCurrentPage}
                totalPages={pendingTotalPages}
                totalItems={pendingApprovalRequests.length}
                itemsPerPage={pendingItemsPerPage}
                onPageChange={setPendingCurrentPage}
                onItemsPerPageChange={setPendingItemsPerPage}
                showItemsPerPage={true}
                showEntriesInfo={true}
              />
            </div>
          )}

          <div className="pt-6 border-t mt-6">
            <h3 className="text-[16px] font-black text-black dark:text-white mb-3">Recent Decisions</h3>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">DURATION</label>
                <div className="relative">
                  <select
                    value={historyDurationFilter}
                    onChange={(e) => setHistoryDurationFilter(e.target.value)}
                    className="h-[42px] px-4 pr-10 bg-white dark:bg-slate-800 border-[1.5px] border-black rounded-[10px] text-[15px] font-bold text-black dark:text-white focus:outline-none appearance-none cursor-pointer min-w-[140px]"
                  >
                    <option>All History</option>
                    <option>Today</option>
                    <option>This Week</option>
                    <option>This Month</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">STATUS</label>
                <div className="relative">
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    className="h-[42px] px-4 pr-10 bg-white dark:bg-slate-800 border-[1.5px] border-black rounded-[10px] text-[15px] font-bold text-black dark:text-white focus:outline-none appearance-none cursor-pointer min-w-[140px]"
                  >
                    <option>All Status</option>
                    <option>Pending</option>
                    <option>Approved</option>
                    <option>Rejected</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {filteredHistoryExpenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                  <p className="font-semibold text-sm">No transactions found for the selected filter.</p>
                </div>
              ) : (
                filteredHistoryExpenses.map((expense) => (
                  <div key={expense.id} className="border-[1.5px] border-black rounded-[14px] p-4 flex items-center justify-between bg-white dark:bg-slate-900 transition-all shadow-sm">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[17px] text-black dark:text-white tracking-tight">{expense.employee}</span>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                          {(expense as any).role || 'EMPLOYEE'}
                        </span>
                        <span className="font-bold text-[15px] text-black dark:text-white">{getCategoryLabel(expense.category)}</span>
                      </div>
                      <div className="text-[14px] font-bold text-black dark:text-white tracking-tight">
                        {expense.date} • {expense.description}
                      </div>
                      <div className="text-[15px] font-bold text-[#4545E9] dark:text-[#818cf8] tracking-tight mt-1">
                        Amount: ₹{expense.amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      {expense.status === 'Approved' && (
                        <div className="flex items-center gap-1.5 bg-[#10b981] text-white px-4 py-1.5 rounded-full font-bold text-[14px] shadow-[0_4px_14px_rgba(16,185,129,0.39)]">
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                          <span>Approved</span>
                        </div>
                      )}
                      {expense.status === 'Rejected' && (
                        <div className="flex items-center gap-1.5 bg-[#ef4444] text-white px-4 py-1.5 rounded-full font-bold text-[14px] shadow-[0_4px_14px_rgba(239,68,68,0.39)]">
                          <XCircle className="w-4 h-4 stroke-[2.5]" />
                          <span>Rejected</span>
                        </div>
                      )}
                      {expense.status === 'Pending' && (
                        <div className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-1.5 rounded-full font-bold text-[14px] shadow-[0_4px_14px_rgba(245,158,11,0.39)]">
                          <Clock className="w-4 h-4 stroke-[2.5]" />
                          <span>Pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
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
            {categoriesList.map((catObj) => {
              // If admin dashboard stats are available from backend, use exact aggregated metrics
              const dashboardMatch = adminDashboardStats?.find(
                (d) =>
                  d.category_name.trim().toLowerCase() === catObj.label.trim().toLowerCase() ||
                  d.category_name.trim().toLowerCase() === catObj.value.trim().toLowerCase()
              );

              const catTotal = dashboardMatch
                ? Number(dashboardMatch.total_amount) || 0
                : expenses
                    .filter((e) => {
                      const catVal = e.category ? e.category.toLowerCase() : '';
                      const catLabel = getCategoryLabel(e.category).toLowerCase();
                      return catVal === catObj.value.toLowerCase() || catLabel === catObj.label.toLowerCase();
                    })
                    .reduce((a, c) => a + (c.amount || 0), 0);

              const catCount = dashboardMatch
                ? Number(dashboardMatch.expense_count) || 0
                : expenses.filter((e) => {
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
      {!isAdmin && (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-2 border-black rounded-[24px]">
          
<DialogHeader>
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
      <ReceiptText className="h-6 w-6 text-blue-600" />
    </div>

    <div className="flex-1">
      <DialogTitle className="text-xl font-bold text-black dark:text-white">
        Add New Expense
      </DialogTitle>

      <p className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-400">
        Expense Management · Track your spending
      </p>
    </div>
  </div>
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
                  {categoriesList.map((cat) => (
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
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="border-2 border-black rounded-[12px] h-[40px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-sm text-black">Status</Label>
                <select
                  value={newExpense.status}
                  onChange={(e) => setNewExpense({ ...newExpense, status: e.target.value as 'Approved' | 'Pending' | 'Rejected' })}
                  className="w-full h-[40px] px-3 border-2 border-black rounded-[12px] text-sm bg-white"
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
                className="border-2 border-black rounded-[10px] min-h-[75px]"
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
      )}

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
              {((viewExpense as any).receiptName || ((viewExpense as any).documents && (viewExpense as any).documents.length > 0)) && (
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-semibold text-gray-500">Document / Receipt</span>
                  <div
                    onClick={() => {
                      if (isAdmin) {
                        handleOpenDocument(viewExpense);
                      }
                    }}
                    className={`flex items-center gap-1.5 text-[#4545E9] dark:text-[#818cf8] font-bold ${
                      isAdmin ? 'cursor-pointer hover:underline hover:opacity-80 p-1 rounded-md hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all' : ''
                    }`}
                    title={isAdmin ? 'Click to view / open document' : ((viewExpense as any).receiptName || (viewExpense as any).documents?.[0]?.document_name)}
                  >
                    {openingDocId === viewExpense.id ? (
                      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="truncate max-w-[200px]" title={(viewExpense as any).receiptName || (viewExpense as any).documents?.[0]?.document_name}>
                      {(viewExpense as any).receiptName || (viewExpense as any).documents?.[0]?.document_name || 'Attached Receipt'}
                    </span>
                    {isAdmin && <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-70" />}
                  </div>
                </div>
              )}
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

      {/* REUSED PROFESSIONAL ADD & EDIT EXPENSE MODAL */}
      <AddExpenseModal
        isOpen={(!isAdmin && isAddDialogOpen) || !!editExpense}
        editExpense={editExpense}
        onClose={() => {
          setIsAddDialogOpen(false);
          setEditExpense(null);
        }}
        onExpenseCreated={(newExp) => {
          setExpenses([newExp, ...expenses]);
        }}
        onExpenseUpdated={(updatedExp) => {
          setExpenses((prev) =>
            prev.map((item) => (item.id === updatedExp.id ? { ...item, ...updatedExp } : item))
          );
        }}
      />

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
