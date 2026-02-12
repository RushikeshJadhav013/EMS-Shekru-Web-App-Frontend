import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import TruncatedText from '@/components/ui/TruncatedText';
import { Pagination } from '@/components/ui/pagination';
import { useLeaveBalance } from '@/contexts/LeaveBalanceContext';
import { useHolidays } from '@/contexts/HolidayContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { calculateLeaveDays, getLeaveDeductionTypes, isLeaveTypeDisabled, getAvailableLeaveTypes, validateLeaveRequest } from '@/utils/leaveUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { CalendarWithSelect } from '@/components/ui/calendar-with-select';
import { DatePicker } from '@/components/ui/date-picker';
import { HolidayCalendar } from '@/components/ui/holiday-calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { addDays, isSameDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatIST, formatDateTimeIST, formatDateIST, todayIST, parseToIST, nowIST } from '@/utils/timezone';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar as CalendarIcon,
  User,
  FileText,
  Timer,
  Pencil,
  Trash2,
  ChevronRight
} from 'lucide-react';

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  role?: string;
  type: 'annual' | 'sick' | 'casual' | 'maternity' | 'paternity' | 'unpaid';
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  comments?: string;
  requestDate: Date;
}

export default function LeaveManagement() {
  const { user } = useAuth();
  const { holidays, addHoliday, removeHoliday, isHoliday, getHolidayName } = useHolidays();
  const { addNotification } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [displayedMonth, setDisplayedMonth] = useState<Date>(new Date());

  // Initialize leave requests from localStorage or use default mock data
  const initializeLeaveRequests = (): LeaveRequest[] => {
    const stored = localStorage.getItem('leaveRequests');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LeaveRequest[];
        // Convert date strings back to Date objects
        return parsed.map((req) => ({
          ...req,
          startDate: new Date(req.startDate),
          endDate: new Date(req.endDate),
          requestDate: new Date(req.requestDate)
        }));
      } catch (error) {
        console.error('Error parsing leave requests:', error);
      }
    }
    // Default mock data
    return [
      {
        id: '1',
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        department: 'Engineering',
        type: 'annual',
        startDate: new Date(2024, 0, 15),
        endDate: new Date(2024, 0, 17),
        reason: 'Family vacation',
        status: 'pending',
        requestDate: new Date(2024, 0, 10)
      },
      {
        id: '2',
        employeeId: 'EMP002',
        employeeName: 'Jane Smith',
        department: 'Marketing',
        type: 'sick',
        startDate: new Date(2024, 0, 20),
        endDate: new Date(2024, 0, 21),
        reason: 'Medical appointment',
        status: 'approved',
        approvedBy: 'Manager',
        requestDate: new Date(2024, 0, 18)
      }
    ];
  };

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(initializeLeaveRequests());
  const [approvalRequests, setApprovalRequests] = useState<LeaveRequest[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<LeaveRequest[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [customHistoryStartDate, setCustomHistoryStartDate] = useState<Date | undefined>(undefined);
  const [customHistoryEndDate, setCustomHistoryEndDate] = useState<Date | undefined>(new Date());
  const [leaveHistoryCustomStartDate, setLeaveHistoryCustomStartDate] = useState<Date | undefined>(undefined);
  const [leaveHistoryCustomEndDate, setLeaveHistoryCustomEndDate] = useState<Date | undefined>(new Date());
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [historyRoleFilter, setHistoryRoleFilter] = useState<'all' | 'hr' | 'manager' | 'team_lead' | 'employee'>('all');

  const [formData, setFormData] = useState({
    type: 'sick',
    startDate: new Date(),
    endDate: new Date(),
    reason: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvingLeaveId, setApprovingLeaveId] = useState<string | null>(null);
  const [leaveHistoryPeriod, setLeaveHistoryPeriod] = useState<string>('all');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [editFormData, setEditFormData] = useState({
    startDate: new Date(),
    endDate: new Date(),
    reason: ''
  });
  const [isUpdatingLeave, setIsUpdatingLeave] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null);
  const [isDeletingLeave, setIsDeletingLeave] = useState(false);

  // Pagination states for approval requests
  const [approvalCurrentPage, setApprovalCurrentPage] = useState(1);
  const [approvalItemsPerPage, setApprovalItemsPerPage] = useState(10);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());

  // Pagination states for approval history
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(20);

  // Pagination states for My Leave History
  const [myLeaveCurrentPage, setMyLeaveCurrentPage] = useState(1);
  const [myLeaveItemsPerPage, setMyLeaveItemsPerPage] = useState(10);

  // Holiday dialog state
  const [selectedHoliday, setSelectedHoliday] = useState<typeof holidays[0] | null>(null);
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);

  const [holidayForm, setHolidayForm] = useState<{ date: Date; name: string; description?: string }>({
    date: new Date(),
    name: '',
    description: ''
  });

  const handleAddHoliday = async () => {
    // Check if user is admin
    if (user?.role !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'Only administrators can add holidays.',
        variant: 'destructive'
      });
      return;
    }

    if (!holidayForm.name) {
      toast({
        title: 'Error',
        description: 'Please enter a holiday name.',
        variant: 'destructive'
      });
      return;
    }

    // Check if the date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(holidayForm.date);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      toast({
        title: 'Error',
        description: 'Cannot set holidays for past dates. Please select a current or future date.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Use local date handling to avoid timezone shifts
      const dateStr = format(holidayForm.date, 'yyyy-MM-dd');
      // Create date at noon to avoid boundary issues
      const normalizedDate = new Date(dateStr + 'T12:00:00');

      await addHoliday({
        date: normalizedDate,
        name: holidayForm.name,
        description: holidayForm.description
      });
      setHolidayForm({ date: new Date(), name: '', description: '' });
      toast({
        title: 'Holiday added',
        description: `${holidayForm.name} has been added to the calendar.`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add holiday.',
        variant: 'destructive'
      });
    }
  };

  const handleDayClick = (date: Date | undefined) => {
    if (!date) return;

    const holiday = holidays.find(h => isSameDay(h.date, date));
    if (holiday) {
      // If clicking on a holiday, show the dialog but don't change selected date
      setSelectedHoliday(holiday);
      setIsHolidayDialogOpen(true);
      return; // Don't update selectedDate
    }
    // Only update selected date if it's not a holiday
    setSelectedDate(date);
  };

  const handleRemoveHoliday = async (id: number) => {
    // Check if user is admin (also checked in context, but adding here for better UX)
    if (user?.role !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'Only administrators can remove holidays.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await removeHoliday(id);
      toast({ title: 'Holiday removed', description: 'Company holiday removed from calendar.' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove holiday.',
        variant: 'destructive'
      });
    }
  };

  const [weekOffConfig, setWeekOffConfig] = useState<Record<string, string[]>>({});
  const [isLoadingWeekOffs, setIsLoadingWeekOffs] = useState(true);
  const [companyDepartments, setCompanyDepartments] = useState<string[]>([]);
  const [weekOffForm, setWeekOffForm] = useState<{ department: string; days: string[] }>({
    department: '',
    days: ['saturday'],
  });

  // Fetch weekoffs from API
  const fetchWeekOffs = useCallback(async () => {
    try {
      setIsLoadingWeekOffs(true);
      const response = await apiService.getWeekoffs();
      const weekOffMap: Record<string, string[]> = {};
      response.forEach((item) => {
        if (item.is_active) {
          // Convert API day names (e.g., "Saturday", "Sunday") to lowercase format
          weekOffMap[item.department] = item.days.map(day => day.toLowerCase());
        }
      });
      setWeekOffConfig(weekOffMap);
    } catch (error) {
      console.error('Failed to fetch weekoffs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load week-off configurations.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingWeekOffs(false);
    }
  }, []);

  // Load weekoffs on mount
  useEffect(() => {
    fetchWeekOffs();
  }, [fetchWeekOffs]);

  const handleSaveWeekOff = async () => {
    const department = weekOffForm.department.trim();
    if (!department) {
      toast({
        title: 'Department required',
        description: 'Please enter or pick a department before saving the week-off.',
        variant: 'destructive',
      });
      return;
    }
    if (weekOffForm.days.length === 0) {
      toast({
        title: 'Pick at least one day',
        description: 'Select one or more days to mark as weekly off.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const uniqueDays = Array.from(new Set(weekOffForm.days));
      // Convert to capitalized format for API (e.g., "Saturday", "Sunday")
      const capitalizedDays = uniqueDays.map(day => {
        const lowerDay = day.toLowerCase();
        return lowerDay.charAt(0).toUpperCase() + lowerDay.slice(1);
      });

      await apiService.createWeekoff({
        department: department,
        days: capitalizedDays,
      });

      // Update local state
      setWeekOffConfig((prev) => ({
        ...prev,
        [department]: uniqueDays,
      }));

      toast({
        title: 'Week-off saved',
        description: `${department} will now have days off on ${uniqueDays
          .map((day) => weekDayLabels[day] || day)
          .join(', ')}.`,
      });
    } catch (error) {
      console.error('Failed to save weekoff:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save week-off configuration.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveWeekOff = (department: string) => {
    // Note: API doesn't have DELETE endpoint, so we just remove from local state
    // In a real scenario, you might want to set is_active to false via API
    setWeekOffConfig((prev) => {
      const updated = { ...prev };
      delete updated[department];
      return updated;
    });
    toast({
      title: 'Week-off removed',
      description: `${department} no longer has a dedicated weekly off set.`,
    });
  };

  const { leaveBalance, loadLeaveBalance } = useLeaveBalance();

  // Leave Allocation Configuration (Admin only)
  const [leaveAllocationConfig, setLeaveAllocationConfig] = useState({
    total_annual_leave: 15,
    sick_leave_allocation: 10,
    casual_leave_allocation: 5,
    other_leave_allocation: 0,
  });
  const [isSavingLeaveConfig, setIsSavingLeaveConfig] = useState(false);

  const weekDayOptions = [
    { value: 'sunday', label: 'Sunday', emoji: '☀️' },
    { value: 'monday', label: 'Monday', emoji: '🌤️' },
    { value: 'tuesday', label: 'Tuesday', emoji: '🌥️' },
    { value: 'wednesday', label: 'Wednesday', emoji: '⛅' },
    { value: 'thursday', label: 'Thursday', emoji: '🌦️' },
    { value: 'friday', label: 'Friday', emoji: '🌈' },
    { value: 'saturday', label: 'Saturday', emoji: '💫' },
  ];

  const weekDayLabels = weekDayOptions.reduce<Record<string, string>>((acc, day) => {
    acc[day.value] = `${day.label}`;
    return acc;
  }, {});

  const weekDayIndexMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const departmentOptions = useMemo(() => {
    const deptSet = new Set<string>();
    companyDepartments.forEach((dept) => dept && deptSet.add(dept));
    leaveRequests.forEach((req) => req.department && deptSet.add(req.department));
    approvalRequests.forEach((req) => req.department && deptSet.add(req.department));
    if (user?.department) {
      deptSet.add(user.department);
    }
    Object.keys(weekOffConfig).forEach((dept) => dept && deptSet.add(dept));
    return Array.from(deptSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [companyDepartments, leaveRequests, approvalRequests, user?.department, weekOffConfig]);

  useEffect(() => {
    if (!weekOffForm.department && departmentOptions.length > 0) {
      setWeekOffForm((prev) => ({ ...prev, department: departmentOptions[0] }));
    }
  }, [departmentOptions, weekOffForm.department]);

  useEffect(() => {
    if (!weekOffForm.department) {
      return;
    }
    const existing = weekOffConfig[weekOffForm.department];
    if (existing) {
      const sameLength = existing.length === weekOffForm.days.length;
      const sameValues = sameLength && existing.every((day) => weekOffForm.days.includes(day));
      if (!sameValues) {
        setWeekOffForm((prev) => ({
          ...prev,
          days: existing,
        }));
      }
    } else if (weekOffForm.days.length === 0) {
      setWeekOffForm((prev) => ({ ...prev, days: ['saturday'] }));
    }
  }, [weekOffForm.department, weekOffForm.days.length, weekOffConfig]);

  const userWeekOffDays = useMemo(() => {
    // For management profiles, show all types of week offs from all departments
    if (['admin', 'hr', 'manager'].includes(user?.role || '')) {
      const allDays = new Set<string>();
      Object.values(weekOffConfig).forEach(days => {
        days.forEach(d => allDays.add(d.toLowerCase()));
      });
      return Array.from(allDays);
    }

    // For regular employees, show only their department's week offs
    if (!user?.department) return [];
    return weekOffConfig[user.department] || [];
  }, [user?.department, user?.role, weekOffConfig]);

  const canApproveLeaves = ['admin', 'hr', 'manager'].includes(user?.role || '');
  const canViewTeamLeaves = [].includes(user?.role || '');
  // Admins should not have an option to apply for leave from the admin dashboard
  const canApply = user?.role !== 'admin';

  // determine default tab based on available tabs for the current user
  const getDefaultTab = () => {
    return canApply
      ? 'request'
      : (canApproveLeaves || canViewTeamLeaves) ? 'approvals' : 'calendar';
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());

  // Handle navigation from HR Dashboard or Manager Dashboard with viewMode/tab state
  useEffect(() => {
    const state = locationState.state as { viewMode?: string; tab?: string } | null;
    if (state?.viewMode === 'approvals' || state?.tab === 'approvals') {
      setActiveTab('approvals');
    }
  }, [locationState.state]);

  // Save leave requests to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('leaveRequests', JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await apiService.getDepartmentNames();
        if (Array.isArray(response)) {
          const names = response
            .map((dept: any) => dept.name || '')
            .filter(Boolean);
          setCompanyDepartments(names);
        }
      } catch (error) {
        console.error('Failed to fetch departments for week-off planner:', error);
        // Fallback: if user has a department, at least show their own
        if (user?.department) {
          setCompanyDepartments([user.department]);
        }
      }
    };

    loadDepartments();
  }, [user?.department]);

  const loadLeaveRequests = useCallback(async (period: string = leaveHistoryPeriod, startDate?: Date, endDate?: Date) => {
    if (!user) return;
    try {
      const startStr = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
      const endStr = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;
      const requests = await apiService.getLeaveRequests(period, startStr, endStr);

      // Convert API response to our local format
      const formattedRequests: LeaveRequest[] = requests.map((req) => {
        const leaveType = (req.leave_type || 'annual').toLowerCase() as LeaveRequest['type'];
        const status = (String(req.status || 'pending').toLowerCase() as LeaveRequest['status']);
        return {
          id: String(req.leave_id),
          employeeId: String(req.user_id),
          employeeName: user?.name || String(req.user_id),
          department: user?.department || '',
          type: leaveType,
          startDate: new Date(req.start_date),
          endDate: new Date(req.end_date),
          reason: req.reason,
          status,
          requestDate: new Date(req.start_date)
        };
      });

      setLeaveRequests(formattedRequests);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      // If API fails, keep existing data or use localStorage
    }
  }, [user]);



  // Load leave allocation configuration (Admin only)
  const loadLeaveAllocationConfig = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const config = await apiService.getCurrentLeaveAllocation();
      setLeaveAllocationConfig({
        total_annual_leave: config.total_annual_leave,
        sick_leave_allocation: config.sick_leave_allocation,
        casual_leave_allocation: config.casual_leave_allocation,
        other_leave_allocation: config.other_leave_allocation,
      });
    } catch (error) {
      console.error('Error fetching leave allocation config:', error);
    }
  }, [user]);

  // Save leave allocation configuration
  const handleSaveLeaveAllocationConfig = async () => {
    if (!user?.id) return;

    // Validation
    const sick = leaveAllocationConfig.sick_leave_allocation;
    const casual = leaveAllocationConfig.casual_leave_allocation;
    // Enforce Total = Sick + Casual
    const total = sick + casual;
    const other = leaveAllocationConfig.other_leave_allocation;

    if (total < 1) {
      toast({
        title: 'Invalid Configuration',
        description: 'Total annual leave must be at least 1 day.',
        variant: 'destructive',
      });
      return;
    }

    if (sick < 0 || casual < 0 || other < 0) {
      toast({
        title: 'Invalid Configuration',
        description: 'Leave allocations cannot be negative.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingLeaveConfig(true);

    try {
      await apiService.createLeaveAllocationConfig({
        ...leaveAllocationConfig,
        total_annual_leave: total
      });

      toast({
        title: 'Configuration Saved',
        description: 'Leave allocation has been updated successfully. All users will see the new allocations.',
      });

      // Reload leave balance to reflect new configuration
      await loadLeaveBalance();
    } catch (error) {
      console.error('Error saving leave allocation config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save leave allocation configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingLeaveConfig(false);
    }
  };

  // Load leave requests from API on component mount and when period changes
  useEffect(() => {
    if (user) {
      const fetchLeaveRequests = async () => {
        if (leaveHistoryPeriod === 'custom') {
          if (leaveHistoryCustomStartDate && leaveHistoryCustomEndDate) {
            await loadLeaveRequests('custom', leaveHistoryCustomStartDate, leaveHistoryCustomEndDate);
          }
        } else {
          await loadLeaveRequests(leaveHistoryPeriod);
        }
      };

      const fetchApprovals = async () => {
        try {
          if (!(canApproveLeaves || canViewTeamLeaves)) return;
          const approvals = await apiService.getLeaveApprovals();
          const formatted: LeaveRequest[] = approvals.map((req) => ({
            id: String(req.leave_id),
            employeeId: String(req.user_id),
            employeeName: req.name || req.employee_id,
            department: req.department || '',
            role: req.role,
            type: (req.leave_type || 'annual').toLowerCase() as LeaveRequest['type'],
            startDate: new Date(req.start_date),
            endDate: new Date(req.end_date),
            reason: req.reason,
            status: (String(req.status || 'pending').toLowerCase() as LeaveRequest['status']),
            requestDate: new Date(req.start_date)
          }));
          setApprovalRequests(formatted);
        } catch (error) {
          console.error('Error fetching approvals:', error);
        }
      };

      const fetchApprovalHistory = async () => {
        try {
          if (!canApproveLeaves) return;
          const history = await apiService.getLeaveApprovalsHistory();
          const formatted: LeaveRequest[] = history.map((req) => ({
            id: String(req.leave_id),
            employeeId: String(req.user_id),
            employeeName: req.name || req.employee_id,
            department: req.department || '',
            role: req.role,
            type: (req.leave_type || 'annual').toLowerCase() as LeaveRequest['type'],
            startDate: new Date(req.start_date),
            endDate: new Date(req.end_date),
            reason: req.reason,
            status: (String(req.status || 'approved').toLowerCase() as LeaveRequest['status']),
            requestDate: new Date(req.start_date)
          }));
          // Merge with existing history
          setApprovalHistory(prev => {
            const existingIds = new Set(formatted.map(r => r.id));
            const localDecisions = prev.filter(r => !existingIds.has(r.id) && r.status !== 'pending');
            const combined = [...localDecisions, ...formatted];
            return combined.sort((a, b) => {
              const timeA = new Date(a.requestDate).getTime();
              const timeB = new Date(b.requestDate).getTime();
              return timeB - timeA;
            });
          });
        } catch (error) {
          console.error('Error fetching approvals history:', error);
        }
      };

      fetchLeaveRequests();
      fetchApprovals();
      fetchApprovalHistory();
      loadLeaveBalance();
      loadLeaveAllocationConfig();
    }
  }, [user, leaveHistoryPeriod, leaveHistoryCustomStartDate, leaveHistoryCustomEndDate, loadLeaveRequests, loadLeaveBalance, loadLeaveAllocationConfig, canApproveLeaves, canViewTeamLeaves]);

  // Handle URL parameters for tab navigation and leave highlighting
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const leaveId = searchParams.get('leaveId');

    if (tabParam) {
      setActiveTab(tabParam);
    }

    // If leaveId is provided, highlight the specific request
    if (leaveId) {
      setTimeout(() => {
        const element = document.getElementById(`leave-request-${leaveId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 3000);
        }
      }, 300);
    }
  }, [searchParams]);
  // compute visible tabs count and columns class for the TabsList
  const tabsCount = (canApply ? 1 : 0) + ((canApproveLeaves || canViewTeamLeaves) ? 1 : 0) + 1; // calendar always present
  const colsClass = tabsCount === 3 ? 'grid-cols-3' : (tabsCount === 2 ? 'grid-cols-2' : 'grid-cols-1');

  const handleSubmitRequest = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User ID not found. Please log in again.',
        variant: 'destructive'
      });
      return;
    }

    const validation = validateLeaveRequest(
      formData.type,
      formData.startDate,
      formData.endDate,
      leaveBalance,
      formData.reason
    );

    if (!validation.valid) {
      toast({
        title: 'Request Invalid',
        description: validation.error,
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare data for API
      const leaveRequestData = {
        employee_id: String(user.id),
        start_date: format(formData.startDate, 'yyyy-MM-dd'),
        end_date: format(formData.endDate, 'yyyy-MM-dd'),
        reason: formData.reason,
        leave_type: formData.type
      };

      // Submit to API
      const response = await apiService.submitLeaveRequest(leaveRequestData);



      // Create local leave request object for immediate UI update
      const newRequest: LeaveRequest = {
        id: String(response.leave_id),
        employeeId: user.id,
        employeeName: user.name || '',
        department: user.department || '',
        type: formData.type as LeaveRequest['type'],
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        status: 'pending',
        requestDate: new Date()
      };

      // Refresh leave history from API to get the latest data
      try {
        await loadLeaveRequests(leaveHistoryPeriod);
        await loadLeaveBalance();
      } catch (refreshError) {
        console.error('Error refreshing leave requests:', refreshError);
        // Fallback: add to local state if refresh fails
        setLeaveRequests([...leaveRequests, newRequest]);
      }

      // ✅ Trigger notification for leave application
      if (user) {
        const leaveType = formData.type.charAt(0).toUpperCase() + formData.type.slice(1);
        addNotification({
          title: 'Leave Request Submitted',
          message: `Your ${leaveType} leave request from ${formatDateIST(formData.startDate)} to ${formatDateIST(formData.endDate)} has been submitted for approval`,
          type: 'leave',
          metadata: {
            leaveId: String(response.leave_id),
            requesterId: user.id,
            requesterName: user.name,
          }
        });
      }

      toast({
        title: 'Success',
        description: `Leave request submitted successfully. ${formData.type === 'unpaid' ? 'Unpaid leave does not deduct from your Annual Leave balance.' : formData.type !== 'annual' ? 'This leave has been deducted from your Annual Leave balance.' : ''}`
      });

      // Reset form
      setFormData({
        type: 'sick',
        startDate: new Date(),
        endDate: new Date(),
        reason: ''
      });
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit leave request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveReject = async (id: string, status: 'approved' | 'rejected') => {
    const request = approvalRequests.find(req => req.id === id) || leaveRequests.find(req => req.id === id);

    if (!request) {
      toast({
        title: 'Error',
        description: 'Leave request not found',
        variant: 'destructive'
      });
      return;
    }

    // Prevent multiple clicks
    if (approvingLeaveId) {
      return;
    }

    setApprovingLeaveId(id);

    try {
      // Call API to approve/reject
      const approved = status === 'approved';
      await apiService.approveLeaveRequest(id, approved);



      // Update approvals list - move approved/rejected request to the top
      const updatedRequest = { ...request, status, approvedBy: user?.name };
      const otherRequests = approvalRequests.filter(req => req.id !== id);

      // Move the updated request to the top of the list
      setApprovalRequests([updatedRequest, ...otherRequests]);

      // Reset pagination to show the updated request at the top
      setApprovalCurrentPage(1);

      // Add the decision to approval history for real-time display
      // This ensures both approved and rejected requests appear in Recent Decisions
      setApprovalHistory(prev => [updatedRequest, ...prev]);

      // Refresh leave history to get updated status
      try {
        await loadLeaveRequests(leaveHistoryPeriod);
        await loadLeaveBalance();
      } catch (refreshError) {
        console.error('Error refreshing leave requests:', refreshError);
        // Fallback: update local state if refresh fails
        setLeaveRequests(leaveRequests.map(req =>
          req.id === id
            ? { ...req, status, approvedBy: user?.name }
            : req
        ));
      }

      // ✅ Trigger notification to the leave requester
      if (request.employeeId && user) {
        const statusText = status === 'approved' ? 'approved' : 'rejected';
        const leaveType = request.type.charAt(0).toUpperCase() + request.type.slice(1);
        addNotification({
          title: `Leave ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          message: `Your ${leaveType} leave request from ${formatDateIST(request.startDate)} to ${formatDateIST(request.endDate)} has been ${statusText} by ${user.name}`,
          type: 'leave',
          metadata: {
            leaveId: request.id,
            requesterId: user.id,
            requesterName: user.name,
          }
        });
      }

      toast({
        title: 'Success',
        description: `Leave request ${status} successfully`
      });
    } catch (error) {
      console.error('Error approving/rejecting leave request:', error);
      toast({
        title: 'Error',
        description: `Failed to ${status} leave request. Please try again.`,
        variant: 'destructive'
      });
    } finally {
      setApprovingLeaveId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-white border-2 border-amber-300 dark:border-amber-600 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/50';
      case 'approved':
        return 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-2 border-emerald-300 dark:border-emerald-600 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/50';
      case 'rejected':
        return 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white border-2 border-rose-300 dark:border-rose-600 shadow-lg shadow-rose-200/50 dark:shadow-rose-900/50';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'annual': return 'bg-blue-100 text-blue-800';
      case 'sick': return 'bg-red-100 text-red-800';
      case 'casual': return 'bg-green-100 text-green-800';
      case 'maternity': return 'bg-purple-100 text-purple-800';
      case 'paternity': return 'bg-indigo-100 text-indigo-800';
      case 'unpaid': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEditLeave = (leave: LeaveRequest) => {
    setEditingLeave(leave);
    setEditFormData({
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingLeave) return;
    // Adjust balance to account for the days currently locked by this pending request
    // This allows users to reschedule leave even if they have 0 remaining balance (because this request is consuming it)
    let adjustedBalance = { ...leaveBalance };

    // Deep clone the specific balance objects we might modify to avoid mutating state
    if (editingLeave.type !== 'unpaid') {
      const originalDays = calculateLeaveDays(editingLeave.startDate, editingLeave.endDate);

      // Clone annual as it's always affected/checked
      adjustedBalance.annual = { ...leaveBalance.annual };
      adjustedBalance.annual.remaining += originalDays;

      // Clone and update specific type if it exists
      if (editingLeave.type === 'sick') {
        adjustedBalance.sick = { ...leaveBalance.sick };
        adjustedBalance.sick.remaining += originalDays;
      } else if (editingLeave.type === 'casual') {
        adjustedBalance.casual = { ...leaveBalance.casual };
        adjustedBalance.casual.remaining += originalDays;
      }
    }

    const validation = validateLeaveRequest(
      editingLeave.type,
      editFormData.startDate,
      editFormData.endDate,
      adjustedBalance,
      editFormData.reason
    );

    if (!validation.valid) {
      toast({
        title: 'Update Invalid',
        description: validation.error,
        variant: 'destructive'
      });
      return;
    }

    setIsUpdatingLeave(true);
    try {
      await apiService.updateLeaveRequest(editingLeave.id, {
        start_date: format(editFormData.startDate, 'yyyy-MM-dd'),
        end_date: format(editFormData.endDate, 'yyyy-MM-dd'),
        reason: editFormData.reason,
        leave_type: editingLeave.type
      });
      await loadLeaveRequests(leaveHistoryPeriod);
      await loadLeaveBalance();
      toast({
        title: 'Leave Updated',
        description: 'Your leave request has been updated successfully.'
      });
      setIsEditDialogOpen(false);
      setEditingLeave(null);
    } catch (error) {
      console.error('Error updating leave request:', error);
      toast({
        title: 'Error',
        description: 'Failed to update leave request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingLeave(false);
    }
  };

  const handleDeleteLeave = (leave: LeaveRequest) => {
    // Ensure we have a valid leave request
    if (!leave || !leave.id) {
      toast({
        title: 'Error',
        description: 'Invalid leave request. Please refresh the page and try again.',
        variant: 'destructive'
      });
      return;
    }

    // Only allow deletion of pending requests
    if (leave.status !== 'pending') {
      toast({
        title: 'Cannot Delete',
        description: 'Only pending leave requests can be deleted.',
        variant: 'destructive'
      });
      return;
    }

    // Set the leave to delete and open dialog
    setLeaveToDelete(leave);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteLeave = async () => {
    if (!leaveToDelete) {
      return;
    }

    setIsDeletingLeave(true);

    try {
      await apiService.deleteLeaveRequest(leaveToDelete.id);

      // Refresh the leave requests and balance
      await loadLeaveRequests(leaveHistoryPeriod);
      await loadLeaveBalance();

      // Show success message
      toast({
        title: 'Leave Request Deleted',
        description: `Your leave request from ${format(leaveToDelete.startDate, 'MMM dd, yyyy')} to ${format(leaveToDelete.endDate, 'MMM dd, yyyy')} has been successfully deleted.`,
      });

      // Close dialog and clear state
      setIsDeleteDialogOpen(false);
      setLeaveToDelete(null);

    } catch (error) {
      console.error('Error deleting leave request:', error);

      let errorMessage = 'Failed to delete leave request. Please try again.';

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          errorMessage = 'Leave request not found. It may have already been deleted.';
        } else if (error.message.includes('400')) {
          errorMessage = 'Cannot delete this leave request. Only pending requests can be deleted.';
        } else if (error.message.includes('403')) {
          errorMessage = 'You do not have permission to delete this leave request.';
        }
      }

      toast({
        title: 'Delete Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsDeletingLeave(false);
    }
  };

  // Filter requests based on role
  const getFilteredRequests = () => {
    // Admin can see all leave requests
    if (user?.role === 'admin') {
      return leaveRequests;
    }
    // HR can see all leave requests (except admin requests if any)
    else if (user?.role === 'hr') {
      return leaveRequests.filter(req => req.employeeId !== user?.id);
    }
    // Manager can see requests from their department or team
    else if (user?.role === 'manager') {
      return leaveRequests.filter(req =>
        req.employeeId !== user?.id && req.department === user?.department
      );
    }
    // Team lead can see requests from their team
    else if (user?.role === 'team_lead') {
      return leaveRequests.filter(req =>
        req.employeeId !== user?.id && req.department === user?.department
      );
    }
    // Employees see only their own requests
    return leaveRequests.filter(req => req.employeeId === user?.id);
  };

  // Filter approval history based on date range and sort by most recent first
  const getFilteredApprovalHistory = useMemo(() => {
    if (approvalHistory.length === 0) return [];

    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear() + 2, 11, 31, 23, 59, 59); // 2 years in future

    switch (historyFilter) {
      case 'all':
        startDate = new Date(2020, 0, 1);
        break;
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // End of previous month
        break;
      case 'last_6_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // End of previous month
        break;
      case 'custom':
        if (!customHistoryStartDate || !customHistoryEndDate) {
          return [...approvalHistory].sort((a, b) => {
            const timeA = new Date(a.requestDate).getTime();
            const timeB = new Date(b.requestDate).getTime();
            return timeB - timeA;
          });
        }
        startDate = new Date(customHistoryStartDate.getFullYear(), customHistoryStartDate.getMonth(), customHistoryStartDate.getDate(), 0, 0, 0);
        endDate = new Date(customHistoryEndDate.getFullYear(), customHistoryEndDate.getMonth(), customHistoryEndDate.getDate(), 23, 59, 59);
        break;
      default:
        return [...approvalHistory].sort((a, b) => {
          const timeA = new Date(a.requestDate).getTime();
          const timeB = new Date(b.requestDate).getTime();
          return timeB - timeA;
        });
    }

    let filtered = approvalHistory.filter(request => {
      const requestDate = new Date(request.startDate);
      return requestDate >= startDate && requestDate <= endDate;
    });

    // Apply Status Filter
    if (historyStatusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === historyStatusFilter);
    }

    // Apply Role Filter
    if (historyRoleFilter !== 'all') {
      filtered = filtered.filter(req => {
        // Map role names if necessary, ensuring case-insensitivity
        const reqRole = (req.role || '').toLowerCase();
        const filterRole = historyRoleFilter.toLowerCase();
        return reqRole === filterRole;
      });
    }

    return filtered.sort((a, b) => {
      const timeA = new Date(a.requestDate).getTime();
      const timeB = new Date(b.requestDate).getTime();
      return timeB - timeA;
    });
  }, [approvalHistory, historyFilter, customHistoryStartDate, customHistoryEndDate, historyStatusFilter, historyRoleFilter]);

  // Paginated approval requests - sorted by most recent first
  const paginatedApprovalRequests = useMemo(() => {
    // Sort by request date in descending order (most recent first)
    const sorted = [...approvalRequests].sort((a, b) => {
      const timeA = new Date(a.requestDate).getTime();
      const timeB = new Date(b.requestDate).getTime();
      return timeB - timeA; // Descending order (most recent first)
    });

    const startIndex = (approvalCurrentPage - 1) * approvalItemsPerPage;
    const endIndex = startIndex + approvalItemsPerPage;
    return sorted.slice(startIndex, endIndex);
  }, [approvalRequests, approvalCurrentPage, approvalItemsPerPage]);

  // Paginated approval history
  const paginatedApprovalHistory = useMemo(() => {
    const startIndex = (historyCurrentPage - 1) * historyItemsPerPage;
    const endIndex = startIndex + historyItemsPerPage;
    return getFilteredApprovalHistory.slice(startIndex, endIndex);
  }, [getFilteredApprovalHistory, historyCurrentPage, historyItemsPerPage]);

  const approvalTotalPages = Math.ceil(approvalRequests.length / approvalItemsPerPage);
  const historyTotalPages = Math.ceil(getFilteredApprovalHistory.length / historyItemsPerPage);

  // Reset pagination when filters change
  useEffect(() => {
    setApprovalCurrentPage(1);
  }, [approvalRequests.length]);

  useEffect(() => {
    setHistoryCurrentPage(1);
  }, [historyFilter, customHistoryStartDate, customHistoryEndDate]);

  useEffect(() => {
    setMyLeaveCurrentPage(1);
  }, [leaveHistoryPeriod, leaveHistoryCustomStartDate, leaveHistoryCustomEndDate]);

  // Filter leave requests based on selected period (My Leave History)
  const getFilteredLeaveRequests = useMemo(() => {
    const userLeaves = leaveRequests.filter(req => String(req.employeeId) === String(user?.id));
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear() + 2, 11, 31, 23, 59, 59); // default: 2 years in future

    switch (leaveHistoryPeriod) {
      case 'all':
        startDate = new Date(2020, 0, 1);
        break;
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0);
        break;
      case 'last_6_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1, 0, 0, 0);
        break;
      case 'last_1_year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1, 0, 0, 0);
        break;
      case 'custom':
        if (!leaveHistoryCustomStartDate || !leaveHistoryCustomEndDate) {
          return userLeaves.sort((a, b) => {
            const timeA = new Date(a.startDate).getTime();
            const timeB = new Date(b.startDate).getTime();
            return timeB - timeA;
          });
        }
        startDate = new Date(leaveHistoryCustomStartDate.getFullYear(), leaveHistoryCustomStartDate.getMonth(), leaveHistoryCustomStartDate.getDate(), 0, 0, 0);
        endDate = new Date(leaveHistoryCustomEndDate.getFullYear(), leaveHistoryCustomEndDate.getMonth(), leaveHistoryCustomEndDate.getDate(), 23, 59, 59);
        break;
      default:
        return userLeaves.sort((a, b) => {
          const timeA = new Date(a.startDate).getTime();
          const timeB = new Date(b.startDate).getTime();
          return timeB - timeA;
        });
    }

    const filtered = userLeaves.filter(request => {
      const requestDate = new Date(request.startDate);
      return requestDate >= startDate && requestDate <= endDate;
    });

    return filtered.sort((a, b) => {
      const timeA = new Date(a.startDate).getTime();
      const timeB = new Date(b.startDate).getTime();
      return timeB - timeA;
    });
  }, [leaveRequests, user?.id, leaveHistoryPeriod, leaveHistoryCustomStartDate, leaveHistoryCustomEndDate]);

  return (
    <div className="w-full space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
            <CalendarDays className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Leave Management
            </h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <Clock className="h-4 w-4 text-indigo-500" />
              Manage leave requests and view calendar
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${colsClass} h-14 bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg p-1 gap-1 shadow-sm`}>
          {canApply && (
            <TabsTrigger
              value="request"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
            >
              Apply Leave
            </TabsTrigger>
          )}
          {(canApproveLeaves || canViewTeamLeaves) && (
            <TabsTrigger
              value="approvals"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
            >
              {canApproveLeaves ? 'Approvals' : 'Team Leaves'}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="calendar"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
          >
            Leave Calendar
          </TabsTrigger>
        </TabsList>

        {canApply && (
          <TabsContent value="request" className="space-y-4">
            {/* Leave Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Total Leaves',
                  value: `${leaveBalance.annual.remaining}/${leaveBalance.annual.allocated}`,
                  sub: `${leaveBalance.annual.used} used`,
                  icon: CalendarDays,
                  color: 'blue',
                  bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
                  cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
                  borderColor: 'border-blue-300/80 dark:border-blue-700/50',
                  hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400',
                },
                {
                  label: 'Sick Leave',
                  value: `${leaveBalance.sick.remaining}/${leaveBalance.sick.allocated}`,
                  sub: `${leaveBalance.sick.used} used`,
                  icon: AlertCircle,
                  color: 'rose',
                  bg: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
                  cardBg: 'bg-rose-50/40 dark:bg-rose-950/10',
                  borderColor: 'border-rose-300/80 dark:border-rose-700/50',
                  hoverBorder: 'group-hover:border-rose-500 dark:group-hover:border-rose-400',
                },
                {
                  label: 'Casual Leave',
                  value: `${leaveBalance.casual.remaining}/${leaveBalance.casual.allocated}`,
                  sub: `${leaveBalance.casual.used} used`,
                  icon: Clock,
                  color: 'emerald',
                  bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
                  cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
                  borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
                  hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400',
                },
                {
                  label: 'Unpaid Leave',
                  value: leaveBalance.unpaid.used,
                  sub: 'days taken',
                  icon: FileText,
                  color: 'slate',
                  bg: 'bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400',
                  cardBg: 'bg-slate-50/40 dark:bg-slate-950/10',
                  borderColor: 'border-slate-300/80 dark:border-slate-700/50',
                  hoverBorder: 'group-hover:border-slate-500 dark:group-hover:border-slate-400',
                }
              ].map((item, i) => (
                <Card
                  key={i}
                  className={`border-2 ${item.borderColor} ${item.hoverBorder} shadow-sm ${item.cardBg} backdrop-blur-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative cursor-pointer`}
                >
                  {/* Background Accent */}
                  <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${item.bg.split(' ')[0]}`} />

                  <CardContent className="p-4 relative">
                    <div className="flex justify-between items-start mb-2">
                      <div className={`p-2.5 rounded-xl ${item.bg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{item.label}</h3>
                      <div className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{item.value}</div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/50 dark:bg-gray-900/30 border border-black/5 dark:border-white/5">
                        <div className={`h-1.5 w-1.5 rounded-full ${item.color === 'blue' ? 'bg-blue-500' :
                          item.color === 'rose' ? 'bg-rose-500' :
                            item.color === 'emerald' ? 'bg-emerald-500' :
                              'bg-slate-500'
                          }`} />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.sub}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Leave Request Form */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
                <CardTitle className="text-xl font-semibold">Request Leave</CardTitle>
                <div className="mt-2 space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> Annual, Sick, and Casual leave requests will deduct from your <strong>Annual Leave</strong> balance.
                      Only <strong>Unpaid Leave</strong> does not affect your Annual Leave balance.
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Leave Restrictions:</strong>
                    </p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                      <li>• <strong>Sick Leave:</strong> Can only be applied for 3 or more days (use Casual Leave for 1-2 days)</li>
                      <li>• <strong>Sick Leave:</strong> Must be applied at least 2 hours in advance</li>
                      <li>• <strong>Other Leaves:</strong> Must be applied at least 24 hours in advance</li>
                    </ul>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Leave Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Leave Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sick" disabled={isLeaveTypeDisabled('sick', leaveBalance)}>
                          Sick Leave {leaveBalance.sick.remaining <= 0 ? '(No balance)' : `(${leaveBalance.sick.remaining} days)`}
                        </SelectItem>
                        <SelectItem value="casual" disabled={isLeaveTypeDisabled('casual', leaveBalance)}>
                          Casual Leave {leaveBalance.casual.remaining <= 0 ? '(No balance)' : `(${leaveBalance.casual.remaining} days)`}
                        </SelectItem>
                        <SelectItem value="maternity">Maternity Leave</SelectItem>
                        <SelectItem value="paternity">Paternity Leave</SelectItem>
                        <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <div className="flex gap-2">
                      <DatePicker
                        date={formData.startDate}
                        onDateChange={(date) => date && setFormData({ ...formData, startDate: date })}
                        placeholder="Start date"
                      />
                      <DatePicker
                        date={formData.endDate}
                        onDateChange={(date) => date && setFormData({ ...formData, endDate: date })}
                        placeholder="End date"
                      />
                    </div>
                  </div>
                </div>

                {/* Dynamic validation feedback */}
                {(() => {
                  const leaveDays = Math.ceil((formData.endDate.getTime() - formData.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const now = new Date();
                  const startDate = new Date(formData.startDate);
                  const timeDifference = startDate.getTime() - now.getTime();
                  const hoursDifference = timeDifference / (1000 * 60 * 60);

                  const validationMessages = [];

                  // Check sick leave duration
                  if (formData.type === 'sick' && leaveDays < 3) {
                    validationMessages.push({
                      type: 'error',
                      message: `Sick leave requires minimum 3 days. Current selection: ${leaveDays} day${leaveDays === 1 ? '' : 's'}. Consider using Casual Leave for shorter periods.`
                    });
                  }

                  // Check advance notice requirements
                  if (formData.type === 'sick') {
                    // Sick leave requires 2 hours advance notice
                    if (hoursDifference < 2 && hoursDifference >= 0) {
                      const hoursRemaining = Math.ceil(2 - hoursDifference);
                      const minutesRemaining = Math.ceil((2 - hoursDifference) * 60);
                      validationMessages.push({
                        type: 'error',
                        message: `Sick leave must be applied 2 hours in advance. Please select a date at least ${hoursRemaining > 0 ? `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}` : `${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'}`} from now.`
                      });
                    }
                  } else {
                    // Other leaves require 24 hours advance notice
                    if (hoursDifference < 24 && hoursDifference >= 0) {
                      const hoursRemaining = Math.ceil(24 - hoursDifference);
                      validationMessages.push({
                        type: 'error',
                        message: `Leave must be applied 24 hours in advance. Please select a date at least ${hoursRemaining} hours from now.`
                      });
                    }
                  }

                  // Show success message when valid
                  if (validationMessages.length === 0 && leaveDays > 0) {
                    if (formData.type === 'sick') {
                      validationMessages.push({
                        type: 'success',
                        message: `✓ Valid sick leave request for ${leaveDays} day${leaveDays === 1 ? '' : 's'} with ${Math.floor(hoursDifference)} hours advance notice.`
                      });
                    } else if (hoursDifference >= 24) {
                      validationMessages.push({
                        type: 'success',
                        message: `✓ Valid leave request with ${Math.floor(hoursDifference)} hours advance notice.`
                      });
                    }
                  }

                  return validationMessages.length > 0 ? (
                    <div className="space-y-2">
                      {validationMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border text-sm ${msg.type === 'error'
                            ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                            : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                            }`}
                        >
                          {msg.message}
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') })}
                    placeholder="Please provide a reason for your leave request (minimum 10 characters)."
                    rows={3}
                    className={formData.reason.trim().length > 0 && formData.reason.trim().length < 10 ? 'border-red-500' : ''}
                  />
                  <div className="flex justify-between text-sm">
                    <span className={`${formData.reason.trim().length < 10 ? 'text-red-500' : 'text-green-600'}`}>
                      {formData.reason.trim().length < 10
                        ? `${formData.reason.trim().length}/10 characters (minimum required)`
                        : `${formData.reason.trim().length}/500 characters`
                      }
                    </span>
                    {formData.reason.trim().length < 10 && formData.reason.trim().length > 0 && (
                      <span className="text-red-500 text-xs">Minimum 10 characters required</span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleSubmitRequest}
                  disabled={isSubmitting || formData.reason.trim().length < 10}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md disabled:opacity-50"
                >
                  <CalendarIcon className="h-4 w-4" />
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </CardContent>
            </Card>

            {/* My Leave History - Premium UI */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <CalendarDays className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                        My Leave History
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Track all your leave requests and their status
                      </p>
                    </div>
                  </div>
                  <Select
                    value={leaveHistoryPeriod}
                    onValueChange={(value) => setLeaveHistoryPeriod(value)}
                  >
                    <SelectTrigger className="w-[220px] bg-white dark:bg-slate-800 border-2 shadow-md hover:shadow-lg transition-all">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current_month">Current Month</SelectItem>
                      <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                      <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                      <SelectItem value="last_1_year">Last 1 Year</SelectItem>
                      <SelectItem value="all">All History</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              {leaveHistoryPeriod === 'custom' && (
                <div className="border-b bg-slate-50 dark:bg-slate-900 p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[150px]">
                      <Label className="text-xs mb-1 block">From Date</Label>
                      <DatePicker
                        date={leaveHistoryCustomStartDate}
                        onDateChange={setLeaveHistoryCustomStartDate}
                        placeholder="Select start date"
                        className="w-full"
                      />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <Label className="text-xs mb-1 block">To Date</Label>
                      <DatePicker
                        date={leaveHistoryCustomEndDate}
                        onDateChange={setLeaveHistoryCustomEndDate}
                        placeholder="Select end date"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
              <CardContent className="p-6">
                {getFilteredLeaveRequests.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="h-12 w-12 text-indigo-500 dark:text-indigo-400 opacity-50" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Leave History</h3>
                    <p className="text-sm text-muted-foreground">No leave requests found for the selected period.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getFilteredLeaveRequests
                      .slice((myLeaveCurrentPage - 1) * myLeaveItemsPerPage, myLeaveCurrentPage * myLeaveItemsPerPage)
                      .map((request) => {
                        const daysCount = Math.ceil((request.endDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        const statusConfig = {
                          pending: {
                            bg: 'bg-amber-50 dark:bg-amber-950',
                            border: 'border-amber-200 dark:border-amber-800',
                            icon: Clock,
                            iconColor: 'text-amber-600 dark:text-amber-400',
                          },
                          approved: {
                            bg: 'bg-emerald-50 dark:bg-emerald-950',
                            border: 'border-emerald-200 dark:border-emerald-800',
                            icon: CheckCircle,
                            iconColor: 'text-emerald-600 dark:text-emerald-400',
                          },
                          rejected: {
                            bg: 'bg-red-50 dark:bg-red-950',
                            border: 'border-red-200 dark:border-red-800',
                            icon: XCircle,
                            iconColor: 'text-red-600 dark:text-red-400',
                          },
                        };
                        const config = statusConfig[request.status] || statusConfig.pending;
                        const StatusIcon = config.icon;

                        return (
                          <div
                            key={request.id}
                            className={`flex items-start justify-between gap-4 rounded-xl border ${config.border} bg-white dark:bg-slate-900 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`mt-1 h-9 w-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                                <StatusIcon className={`h-4 w-4 ${config.iconColor}`} />
                              </div>
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {format(request.startDate, 'dd MMM yyyy')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">to</span>
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {format(request.endDate, 'dd MMM yyyy')}
                                  </span>
                                  <Badge className={`${getLeaveTypeColor(request.type)} text-[10px] font-semibold capitalize`}>
                                    {request.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Timer className="h-3 w-3" />
                                    {daysCount} {daysCount === 1 ? 'day' : 'days'}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-start gap-2">
                                  <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="line-clamp-2 break-words overflow-wrap-anywhere whitespace-pre-wrap">{request.reason}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge
                                className={`px-3 py-1 text-xs font-bold capitalize ${getStatusBadgeStyle(request.status)}`}
                              >
                                {request.status}
                              </Badge>
                              {request.approvedBy && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span>by {request.approvedBy}</span>
                                </span>
                              )}
                              {request.status === 'pending' && (
                                <div className="mt-1 flex items-center gap-1.5">
                                  <Button
                                    size="xs"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => handleEditLeave(request)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="destructive"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteLeave(request);
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {getFilteredLeaveRequests.length > 0 && (
                      <div className="mt-6 px-2">
                        <Pagination
                          currentPage={myLeaveCurrentPage}
                          totalPages={Math.ceil(getFilteredLeaveRequests.length / myLeaveItemsPerPage)}
                          totalItems={getFilteredLeaveRequests.length}
                          itemsPerPage={myLeaveItemsPerPage}
                          onPageChange={setMyLeaveCurrentPage}
                          onItemsPerPageChange={setMyLeaveItemsPerPage}
                          showItemsPerPage={true}
                          showEntriesInfo={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="calendar">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <CardTitle className="text-xl font-semibold">Leave Calendar</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Admin holiday management UI */}
              {user?.role === 'admin' && (
                <div className="mb-6 space-y-6 mt-4">
                  {/* Leave Allocation Configuration Panel */}
                  <div className="p-6 border-2 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950 dark:via-indigo-950 dark:to-blue-950 shadow-lg">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                          <FileText className="h-6 w-6 text-purple-600" />
                          Leave Allocation Configuration
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Set the total annual leave and distribute it across different leave types. Changes apply to all users immediately.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
                      <div className="space-y-2">
                        <Label className="font-semibold text-purple-700 dark:text-purple-300">
                          Total Annual Leave
                        </Label>
                        <Input
                          disabled
                          value={leaveAllocationConfig.total_annual_leave}
                          className="border-2 border-purple-200 dark:border-purple-800 bg-gray-100 dark:bg-gray-800 opacity-80 cursor-not-allowed font-bold"
                          placeholder="Calculated automatically"
                        />
                        <p className="text-xs text-muted-foreground">
                          Total days (Sick + Casual)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-semibold text-red-700 dark:text-red-300">
                          Sick Leave
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="365"
                          value={leaveAllocationConfig.sick_leave_allocation}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setLeaveAllocationConfig((prev) => ({
                              ...prev,
                              sick_leave_allocation: val,
                              total_annual_leave: val + prev.casual_leave_allocation,
                            }));
                          }}
                          className="border-2 border-red-200 dark:border-red-800 focus:border-red-500"
                          placeholder="e.g., 10"
                        />
                        <p className="text-xs text-muted-foreground">
                          Days allocated
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-semibold text-green-700 dark:text-green-300">
                          Casual Leave
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="365"
                          value={leaveAllocationConfig.casual_leave_allocation}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setLeaveAllocationConfig((prev) => ({
                              ...prev,
                              casual_leave_allocation: val,
                              total_annual_leave: prev.sick_leave_allocation + val,
                            }));
                          }}
                          className="border-2 border-green-200 dark:border-green-800 focus:border-green-500"
                          placeholder="e.g., 5"
                        />
                        <p className="text-xs text-muted-foreground">
                          Days allocated
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-semibold text-gray-700 dark:text-gray-300">
                          Other Leave
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="365"
                          value={leaveAllocationConfig.other_leave_allocation}
                          onChange={(e) =>
                            setLeaveAllocationConfig((prev) => ({
                              ...prev,
                              other_leave_allocation: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="border-2 border-gray-200 dark:border-gray-800 focus:border-gray-500"
                          placeholder="e.g., 0"
                        />
                        <p className="text-xs text-muted-foreground">
                          Days allocated
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Note:</strong> Annual, Sick, and Casual leave requests will deduct from the <strong>Total Annual Leave</strong> balance.
                        The individual allocations (Sick, Casual, Other) are for reference and tracking purposes.
                      </p>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                      <Button
                        onClick={handleSaveLeaveAllocationConfig}
                        disabled={isSavingLeaveConfig}
                        className="gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-lg"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {isSavingLeaveConfig ? 'Saving...' : 'Save Configuration'}
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Changes will apply to all users immediately
                      </p>
                    </div>
                  </div>

                  {user?.role === 'admin' && (
                    <div className="p-4 border rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-amber-600" />
                        Set Company Holidays
                      </h3>
                      <div className="space-y-3">
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                          <div className="flex-shrink-0 mx-auto md:mx-0">
                            <HolidayCalendar
                              date={holidayForm.date}
                              onDateChange={(date) => date && setHolidayForm({ ...holidayForm, date })}
                              className="w-[280px]"
                            />
                          </div>
                          <div className="flex-1 space-y-4 w-full">
                            <div className="space-y-2">
                              <Label>Holiday Name</Label>
                              <Input
                                type="text"
                                placeholder="e.g., Diwali, New Year"
                                value={holidayForm.name}
                                onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') })}
                                className="bg-white dark:bg-slate-900"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                placeholder="Description (optional) - e.g., Festival of Lights celebration"
                                value={holidayForm.description || ''}
                                onChange={e => setHolidayForm({ ...holidayForm, description: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') })}
                                rows={3}
                                className="resize-none bg-white dark:bg-slate-900"
                              />
                            </div>
                            <Button
                              onClick={handleAddHoliday}
                              className="w-full gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-md"
                            >
                              <CalendarIcon className="h-4 w-4" />
                              Add Holiday
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Current Holidays:</h4>
                        {holidays.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No holidays configured yet.</p>
                        ) : (
                          <ul className="space-y-2">
                            {holidays.map(h => (
                              <li key={h.id || h.date.toISOString()} className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-800 rounded border">
                                <span className="flex-1">
                                  <strong>{h.name}</strong> - {format(h.date, 'MMMM dd, yyyy')}
                                  {h.description && <span className="text-sm text-muted-foreground ml-2">({h.description})</span>}
                                </span>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => h.id && handleRemoveHoliday(h.id)}
                                >
                                  Remove
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-4 border rounded-lg bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold mb-1 flex items-center gap-2">
                          <Clock className="h-5 w-5 text-sky-600" />
                          Department Week-off Planner
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Define weekly off days for each department to keep schedules aligned.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        {departmentOptions.length > 0 ? (
                          <Select
                            value={weekOffForm.department}
                            onValueChange={(value) =>
                              setWeekOffForm((prev) => ({ ...prev, department: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {departmentOptions.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="e.g., Engineering"
                            value={weekOffForm.department}
                            onChange={(e) =>
                              setWeekOffForm((prev) => ({ ...prev, department: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))
                            }
                          />
                        )}
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Weekly Off Days</Label>
                        <div className="flex flex-wrap gap-2">
                          {weekDayOptions.map((day) => {
                            const isSelected = weekOffForm.days.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                onClick={() =>
                                  setWeekOffForm((prev) => {
                                    const exists = prev.days.includes(day.value);
                                    const nextDays = exists
                                      ? prev.days.filter((d) => d !== day.value)
                                      : prev.days.length >= 2
                                        ? prev.days
                                        : [...prev.days, day.value];
                                    if (!exists && prev.days.length >= 2) {
                                      toast({
                                        title: 'Limit reached',
                                        description: 'You can only select up to two weekly off days.',
                                      });
                                    }
                                    return { ...prev, days: nextDays };
                                  })
                                }
                                className={`rounded-full px-3 py-1 text-sm border transition ${isSelected
                                  ? 'border-sky-500 bg-white text-sky-600 shadow-sm'
                                  : 'border-slate-300 text-slate-600 hover:bg-white'
                                  }`}
                              >
                                {day.emoji} {day.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tip: Select up to two days if the department enjoys a long weekend.
                        </p>
                      </div>
                      <div className="space-y-2 flex flex-col justify-end md:col-span-3">
                        <Button
                          className="rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 self-start"
                          onClick={handleSaveWeekOff}
                        >
                          Save Week-off
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Active Week-off Rules</h4>
                      {Object.keys(weekOffConfig).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No department-specific week-offs defined yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(weekOffConfig).map(([dept, days]) => (
                            <div
                              key={dept}
                              className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/60 px-3 py-2 text-sm"
                            >
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                  {dept}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  Weekly off: {days.map((day) => weekDayLabels[day.toLowerCase()] || day).join(', ')}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-500 hover:text-rose-600"
                                onClick={() => handleRemoveWeekOff(dept)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Calendar with holidays highlighted */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Left Column: Calendar */}
                <div className="xl:col-span-5 space-y-6">
                  <div className="relative group p-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 shadow-2xl shadow-indigo-100 dark:shadow-none transition-all duration-300">
                    {/* Decorative Background Blobs */}
                    <div className="absolute top-0 left-0 -mt-4 -ml-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
                    <div className="absolute bottom-0 right-0 -mb-4 -mr-4 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors" />

                    <div className="relative">
                      <CalendarWithSelect
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDayClick}
                        currentMonth={displayedMonth}
                        onMonthChange={setDisplayedMonth}
                        className="rounded-2xl bg-transparent"
                        modifiers={{
                          holiday: holidays.map(h => h.date),
                          weekOff: (date) =>
                            userWeekOffDays.some(
                              (day) => weekDayIndexMap[day.toLowerCase()] === date.getDay(),
                            ),
                          leave: leaveRequests
                            .filter(r => r.status === 'approved')
                            .reduce((acc: Date[], r) => {
                              const start = new Date(r.startDate);
                              const end = new Date(r.endDate);
                              const curr = new Date(start);
                              while (curr <= end) {
                                acc.push(new Date(curr));
                                curr.setDate(curr.getDate() + 1);
                              }
                              return acc;
                            }, []),
                        }}
                        modifiersClassNames={{
                          holiday:
                            'bg-gradient-to-br from-rose-500 to-red-600 text-white font-bold hover:scale-110 hover:rotate-3 transition-all duration-300 shadow-md cursor-pointer ring-2 ring-red-200 dark:ring-red-900',
                          weekOff:
                            'week-off-day border-2 border-dashed border-sky-400 text-sky-600 font-bold bg-sky-50/50 hover:bg-sky-100 dark:bg-sky-900/10 dark:text-sky-400 transition-colors',
                          leave:
                            'bg-indigo-100 text-indigo-700 font-semibold border-2 border-indigo-200 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
                        }}
                      />
                    </div>
                  </div>

                  {/* Enhanced Legend Card */}
                  <Card className="rounded-2xl border-0 shadow-lg bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-500" />
                        Color Guide
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 rounded bg-gradient-to-br from-rose-500 to-red-600 shadow-sm" />
                        <span className="text-sm font-medium">Company Holidays</span>
                        <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-800 mx-2" />
                        <span className="text-xs text-muted-foreground">Off Work</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 rounded border-2 border-dashed border-sky-400 bg-sky-50 dark:bg-sky-900/10" />
                        <span className="text-sm font-medium">Weekly-Off Days</span>
                        <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-800 mx-2" />
                        <span className="text-xs text-muted-foreground">Department</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 rounded bg-indigo-100 border border-indigo-200 dark:bg-indigo-900/30" />
                        <span className="text-sm font-medium">Your Approved Leaves</span>
                        <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-800 mx-2" />
                        <span className="text-xs text-muted-foreground">Private</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Month Details & Statistics */}
                <div className="xl:col-span-7 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Month Statistics Header */}
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-100 dark:shadow-none flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                          <CalendarIcon className="h-6 w-6 text-white" />
                        </div>
                        <Badge className="bg-white/20 hover:bg-white/30 border-0 text-white font-bold backdrop-blur-md">
                          {format(displayedMonth, 'yyyy')}
                        </Badge>
                      </div>
                      <div>
                        <h3 className="text-3xl font-black tracking-tight">{format(displayedMonth, 'MMMM')}</h3>
                        <p className="text-white/80 text-sm font-medium mt-1">Month overview and holidays</p>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/50 flex flex-col justify-center items-center text-center group hover:scale-[1.05] transition-transform">
                        <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mb-1">
                          {holidays.filter(h => h.date.getMonth() === displayedMonth.getMonth()).length}
                        </div>
                        <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Holidays</div>
                      </div>
                      <div className="p-4 rounded-3xl bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800/50 flex flex-col justify-center items-center text-center group hover:scale-[1.05] transition-transform">
                        <div className="text-3xl font-black text-sky-600 dark:text-sky-400 mb-1">
                          {userWeekOffDays.length}
                        </div>
                        <div className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">Off Days</div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Holiday List */}
                  <Card className="rounded-3xl border-0 shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                          <CalendarIcon className="h-5 w-5 text-red-500" />
                          Upcoming Festivals & Holidays
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {(() => {
                        const monthHolidays = holidays.filter(h =>
                          h.date.getFullYear() === displayedMonth.getFullYear() &&
                          h.date.getMonth() === displayedMonth.getMonth()
                        ).sort((a, b) => a.date.getTime() - b.date.getTime());

                        if (monthHolidays.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <CalendarIcon className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                              </div>
                              <p className="text-slate-500 font-medium">No company holidays scheduled for this month</p>
                              <p className="text-xs text-slate-400 mt-1">Check back later for updates</p>
                            </div>
                          );
                        }

                        return (
                          <div className="grid gap-4">
                            {monthHolidays.map(h => (
                              <div
                                key={h.date.toISOString()}
                                className="group relative flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-all duration-300 cursor-pointer"
                                onClick={() => {
                                  setSelectedHoliday(h);
                                  setIsHolidayDialogOpen(true);
                                }}
                              >
                                <div className="flex flex-col items-center justify-center h-16 w-16 rounded-xl bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900 shadow-sm group-hover:scale-110 transition-transform">
                                  <span className="text-[10px] font-bold text-red-500 uppercase">{format(h.date, 'MMM')}</span>
                                  <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{format(h.date, 'dd')}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-red-600 transition-colors truncate">
                                    {h.name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground mt-0.5 font-medium flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(h.date, 'EEEE')}
                                  </p>
                                  {h.description && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{h.description}</p>
                                  )}
                                </div>
                                <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 hover:bg-white dark:hover:bg-slate-800">
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Week-off Visibility for Management */}
                  {userWeekOffDays.length > 0 && (
                    <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950 border border-indigo-100 dark:border-indigo-900 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                        <Clock className="h-6 w-6 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Weekly-Off Reminder</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {user?.role === 'employee' ? (
                            <>Your department ({user?.department}) enjoys off on <span className="font-bold text-sky-600">{userWeekOffDays.map(d => weekDayLabels[d.toLowerCase()] || d).join(', ')}</span></>
                          ) : (
                            <>Management View: Showing all active department week-offs across the center</>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </CardContent>

          </Card>
        </TabsContent>

        {(canApproveLeaves || canViewTeamLeaves) && (
          <TabsContent value="approvals">
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
                <CardTitle className="text-xl font-semibold">
                  {canApproveLeaves ? 'Leave Approval Requests' : 'Team Leave Requests'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {(approvalRequests.length === 0) ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No leave requests to display</p>
                    </div>
                  ) : (
                    paginatedApprovalRequests.map((request) => {
                      return (
                        <div
                          key={request.id}
                          id={`leave-request-${request.id}`}
                          className="border rounded-lg p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-900 hover:shadow-md">
                          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                            <div className="space-y-3 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <User className="h-4 w-4 flex-shrink-0" />
                                <span className="font-medium">{request.employeeName}</span>
                                {request.role && (
                                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500 border-slate-300">
                                    {request.role}
                                  </Badge>
                                )}
                                <Badge className={getLeaveTypeColor(request.type)}>
                                  {request.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  ID: {request.employeeId}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  <span>{request.department}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  <span>
                                    {format(request.startDate, 'MMM dd')} - {format(request.endDate, 'MMM dd, yyyy')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {Math.ceil((request.endDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm space-y-1">
                                <span className="font-medium">Reason:</span>
                                <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                                  <div className="text-slate-700 dark:text-slate-300 text-sm">
                                    <TruncatedText
                                      text={request.reason}
                                      maxLength={150}
                                      textClassName="whitespace-pre-wrap break-words"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {request.status === 'pending' && canApproveLeaves ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="px-4 h-9 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    onClick={() => handleApproveReject(request.id, 'approved')}
                                    disabled={approvingLeaveId === request.id}
                                  >
                                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                                    <span className="whitespace-nowrap">
                                      {approvingLeaveId === request.id ? 'Processing...' : 'Approve'}
                                    </span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="px-4 h-9 gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    onClick={() => handleApproveReject(request.id, 'rejected')}
                                    disabled={approvingLeaveId === request.id}
                                  >
                                    <XCircle className="h-4 w-4 flex-shrink-0" />
                                    <span className="whitespace-nowrap">
                                      {approvingLeaveId === request.id ? 'Processing...' : 'Reject'}
                                    </span>
                                  </Button>
                                </>
                              ) : (
                                <div className="flex flex-col gap-2 w-full">
                                  <Badge className={`w-full px-4 py-1.5 text-sm font-bold capitalize transition-all duration-300 text-center ${getStatusBadgeStyle(request.status)}`}>
                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  </Badge>
                                  {request.status !== 'pending' && request.approvedBy && (
                                    <span className="text-xs text-muted-foreground text-center">
                                      by {request.approvedBy}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }))}

                  {/* Pagination for Approval Requests */}
                  {approvalRequests.length > 0 && (
                    <div className="mt-6 px-2">
                      <Pagination
                        currentPage={approvalCurrentPage}
                        totalPages={approvalTotalPages}
                        totalItems={approvalRequests.length}
                        itemsPerPage={approvalItemsPerPage}
                        onPageChange={setApprovalCurrentPage}
                        onItemsPerPageChange={setApprovalItemsPerPage}
                        showItemsPerPage={true}
                        showEntriesInfo={true}
                      />
                    </div>
                  )}

                  <div className="pt-6 border-t mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Recent Decisions</h3>
                      <div className="flex items-center gap-2">
                        <Select value={historyFilter} onValueChange={setHistoryFilter}>
                          <SelectTrigger className="w-[180px] h-9 bg-white dark:bg-gray-950">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All History</SelectItem>
                            <SelectItem value="current_month">Current Month</SelectItem>
                            <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                            <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={historyStatusFilter} onValueChange={(val: any) => setHistoryStatusFilter(val)}>
                          <SelectTrigger className="w-[140px] h-9 bg-white dark:bg-gray-950">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={historyRoleFilter} onValueChange={(val: any) => setHistoryRoleFilter(val)}>
                          <SelectTrigger className="w-[140px] h-9 bg-white dark:bg-gray-950">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="hr">HR</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="team_lead">Team Lead</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {historyFilter === 'custom' && (
                      <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[150px]">
                            <Label className="text-xs mb-1">Start Date</Label>
                            <DatePicker
                              date={customHistoryStartDate}
                              onDateChange={setCustomHistoryStartDate}
                              placeholder="Select start date"
                              className="w-full"
                            />
                          </div>
                          <div className="flex-1 min-w-[150px]">
                            <Label className="text-xs mb-1">End Date</Label>
                            <DatePicker
                              date={customHistoryEndDate}
                              onDateChange={setCustomHistoryEndDate}
                              placeholder="Select end date"
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {getFilteredApprovalHistory.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No decisions found for the selected period.</p>
                      </div>
                    ) : (
                      <div>
                        <div className="space-y-3">
                          {paginatedApprovalHistory.map((request) => (
                            <div key={`hist-${request.id}`} className="border rounded-lg p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                              <div className="text-sm flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{request.employeeName}</span>
                                  {request.role && (
                                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {request.role}
                                    </span>
                                  )}
                                  <Badge className={`${getLeaveTypeColor(request.type)} text-xs`}>
                                    {request.type}
                                  </Badge>
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {format(request.startDate, 'MMM dd')} - {format(request.endDate, 'MMM dd, yyyy')} • {request.department}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`px-4 py-1.5 text-sm font-bold capitalize transition-all duration-300 ${getStatusBadgeStyle(request.status)}`}>
                                  {request.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Pagination for Approval History */}
                        {getFilteredApprovalHistory.length > 0 && (
                          <div className="mt-6 px-2">
                            <Pagination
                              currentPage={historyCurrentPage}
                              totalPages={historyTotalPages}
                              totalItems={getFilteredApprovalHistory.length}
                              itemsPerPage={historyItemsPerPage}
                              onPageChange={setHistoryCurrentPage}
                              onItemsPerPageChange={setHistoryItemsPerPage}
                              showItemsPerPage={true}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Leave Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingLeave(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
            <DialogDescription>
              Update your leave dates or reason. Only pending requests can be modified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <DatePicker
                  date={editFormData.startDate}
                  onDateChange={(date) => date && setEditFormData(prev => ({ ...prev, startDate: date }))}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <DatePicker
                  date={editFormData.endDate}
                  onDateChange={(date) => date && setEditFormData(prev => ({ ...prev, endDate: date }))}
                />
              </div>
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea
                value={editFormData.reason}
                onChange={(e) => setEditFormData(prev => ({ ...prev, reason: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                rows={4}
                placeholder="Update the reason for your leave request (minimum 10 characters)."
                className={editFormData.reason.trim().length > 0 && editFormData.reason.trim().length < 10 ? 'border-red-500' : ''}
              />
              <div className="flex justify-between text-sm mt-1">
                <span className={`${editFormData.reason.trim().length < 10 ? 'text-red-500' : 'text-green-600'}`}>
                  {editFormData.reason.trim().length < 10
                    ? `${editFormData.reason.trim().length}/10 characters (minimum required)`
                    : `${editFormData.reason.trim().length}/500 characters`
                  }
                </span>
                {editFormData.reason.trim().length < 10 && editFormData.reason.trim().length > 0 && (
                  <span className="text-red-500 text-xs">Minimum 10 characters required</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isUpdatingLeave}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={isUpdatingLeave || editFormData.reason.trim().length < 10}>
              {isUpdatingLeave ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Leave Confirmation */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeletingLeave) {
            setIsDeleteDialogOpen(open);
            if (!open) {
              setLeaveToDelete(null);
            }
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
                <Trash2 className="h-5 w-5 text-white" />
              </div>
              Delete Leave Request
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete this leave request? This action cannot be undone.
              {leaveToDelete && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 rounded-lg border-2 border-red-200 dark:border-red-800 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Leave Details</p>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mt-1">
                      {format(leaveToDelete.startDate, 'MMM dd, yyyy')} to {format(leaveToDelete.endDate, 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Type</p>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mt-1">
                      {leaveToDelete.type.charAt(0).toUpperCase() + leaveToDelete.type.slice(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Reason</p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1 line-clamp-2 break-words overflow-wrap-anywhere whitespace-pre-wrap">
                      {leaveToDelete.reason}
                    </p>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={isDeletingLeave}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={confirmDeleteLeave}
              disabled={isDeletingLeave}
              className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed gap-2"
            >
              {isDeletingLeave ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Request
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Holiday Details Dialog */}
      <Dialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              Holiday Information
            </DialogTitle>
          </DialogHeader>
          {selectedHoliday && (
            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 rounded-lg p-4 border-2 border-red-200 dark:border-red-800">
                <h3 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">
                  {selectedHoliday.name}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <CalendarDays className="h-4 w-4" />
                  <span className="font-semibold">{format(selectedHoliday.date, 'EEEE, MMMM dd, yyyy')}</span>
                </div>
                {selectedHoliday.description && (
                  <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {selectedHoliday.description}
                    </p>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  This is a company-wide holiday. All offices will be closed.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setIsHolidayDialogOpen(false)}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}