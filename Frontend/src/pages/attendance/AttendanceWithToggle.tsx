import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AttendanceCamera from '@/components/attendance/AttendanceCamera';
import OnlineStatusToggle from '@/components/attendance/OnlineStatusToggle';
import OnlineStatusIndicator from '@/components/attendance/OnlineStatusIndicator';
import { Clock, MapPin, Calendar, LogIn, LogOut, FileText, CheckCircle, AlertCircle, Users, Filter, User, X, Download, Search, Loader2, Home, Send, Edit, Trash2, History, FileSpreadsheet, Timer } from 'lucide-react';
import { AttendanceRecord, UserRole } from '@/types';
import { format, subMonths, isAfter } from 'date-fns';
import { formatIST, formatDateTimeIST, formatTimeIST, formatDateIST, todayIST, formatDateTimeComponentsIST, parseToIST, nowIST } from '@/utils/timezone';
import { getCurrentLocation as fetchPreciseLocation, getCurrentLocationFast } from '@/utils/geolocation';
import { DatePicker } from '@/components/ui/date-picker';
import { Pagination } from '@/components/ui/pagination';
import { apiService, API_BASE_URL } from '@/lib/api';

type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

type ExportEmployee = {
  user_id: number;
  employee_id?: string;
  name: string;
  department?: string | null;
};

const AttendanceWithToggle: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const routerLocation = useLocation();
  interface EmployeeAttendanceRecord extends AttendanceRecord {
    name?: string;
    email?: string;
    department?: string;
    workLocation?: string;
    taskDeadlineReason?: string | null;
  }
  const [viewMode, setViewMode] = useState<'self' | 'employee' | 'wfh' | 'wfh_requests'>('self');
  const [showCamera, setShowCamera] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(true);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [todaysWork, setTodaysWork] = useState('');
  const [taskDeadlineReason, setTaskDeadlineReason] = useState('');
  const [workPdf, setWorkPdf] = useState<File | null>(null);
  const [currentAttendance, setCurrentAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [employeeAttendanceData, setEmployeeAttendanceData] = useState<EmployeeAttendanceRecord[]>([]);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [isGettingFastLocation, setIsGettingFastLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIST());
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  // Default employee attendance view to "Today" for clearer, focused data when the page first loads
  const [timePeriodFilter, setTimePeriodFilter] = useState<'today' | 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_12_months' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'late' | 'early'>('all');
  const [filteredEmployeeAttendanceData, setFilteredEmployeeAttendanceData] = useState<EmployeeAttendanceRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selfCurrentPage, setSelfCurrentPage] = useState(1);
  const [selfItemsPerPage, setSelfItemsPerPage] = useState(10);
  const [selectedRecord, setSelectedRecord] = useState<EmployeeAttendanceRecord | null>(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [showWorkSummaryDialog, setShowWorkSummaryDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [selectedWorkSummary, setSelectedWorkSummary] = useState<string>('');
  const [selectedOverdueReason, setSelectedOverdueReason] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<{ checkIn?: string, checkOut?: string }>({});
  const initialLocationRequestedRef = useRef(false);
  const lastGeocodeKeyRef = useRef<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf' | null>(null);
  const [quickFilter, setQuickFilter] = useState('custom');
  const [exportStartDate, setExportStartDate] = useState<Date | undefined>(undefined);
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>(new Date());
  const [employeeExportFilter, setEmployeeExportFilter] = useState<'all' | 'specific'>('all');
  const [exportEmployees, setExportEmployees] = useState<ExportEmployee[]>([]);
  const [filteredExportEmployees, setFilteredExportEmployees] = useState<ExportEmployee[]>([]);
  const [employeeExportSearch, setEmployeeExportSearch] = useState('');
  const [selectedExportEmployee, setSelectedExportEmployee] = useState<ExportEmployee | null>(null);
  const [selectedExportDepartment, setSelectedExportDepartment] = useState<string>('');
  const [exportDepartments, setExportDepartments] = useState<string[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [reportLayout, setReportLayout] = useState<'basic' | 'grid' | 'detailed_grid'>('basic');

  // Online/Offline status state
  const [isOnline, setIsOnline] = useState(true);
  const [hasLoadedOnlineStatus, setHasLoadedOnlineStatus] = useState(false);
  const [workingHours, setWorkingHours] = useState('0:00');
  const [onlineStatusMap, setOnlineStatusMap] = useState<Record<number, boolean>>({});
  const [allUsersOnlineStatus, setAllUsersOnlineStatus] = useState<Record<string, boolean>>({});
  const [historyQuickFilter, setHistoryQuickFilter] = useState<'today' | 'all' | 'date'>('today');
  const [historyCustomDateRange, setHistoryCustomDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({ startDate: null, endDate: null });

  // Enhanced time tracking with proper timer logic
  const [onlineWorkingHours, setOnlineWorkingHours] = useState('0 hrs - 0 mins');
  const [totalOfflineTime, setTotalOfflineTime] = useState('0 hrs - 0 mins');
  const [currentSessionOfflineTime, setCurrentSessionOfflineTime] = useState('0:00:00');
  const [lastStatusChangeTime, setLastStatusChangeTime] = useState<Date | null>(null);

  // Timer state for proper tracking
  const [onlineStartTime, setOnlineStartTime] = useState<Date | null>(null);
  const [offlineStartTime, setOfflineStartTime] = useState<Date | null>(null);
  const [accumulatedOnlineSeconds, setAccumulatedOnlineSeconds] = useState(0);
  const [accumulatedOfflineSeconds, setAccumulatedOfflineSeconds] = useState(0);

  // Fresh check-in flag to prevent backend sync from overriding zero values
  const [isFreshCheckIn, setIsFreshCheckIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);

  // WFH Request state
  const [wfhStartDate, setWfhStartDate] = useState<Date | undefined>(undefined);
  const [wfhEndDate, setWfhEndDate] = useState<Date | undefined>(undefined);
  const [wfhReason, setWfhReason] = useState('');
  const [wfhType, setWfhType] = useState<'full_day' | 'half_day'>('full_day');
  const [isSubmittingWfh, setIsSubmittingWfh] = useState(false);
  const [wfhRequests, setWfhRequests] = useState<any[]>([]);
  // WFH History Filtering and Pagination
  const [wfhHistoryPage, setWfhHistoryPage] = useState(1);
  const [wfhHistoryItemsPerPage, setWfhHistoryItemsPerPage] = useState(10);
  const [wfhHistoryTimeFilter, setWfhHistoryTimeFilter] = useState<'all' | 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_year' | 'custom'>('all');
  const [wfhHistoryStartDate, setWfhHistoryStartDate] = useState<Date | undefined>(undefined);
  const [wfhHistoryEndDate, setWfhHistoryEndDate] = useState<Date | undefined>(new Date());

  // Reset WFH history page when filters change
  useEffect(() => {
    setWfhHistoryPage(1);
  }, [wfhHistoryTimeFilter, wfhHistoryStartDate, wfhHistoryEndDate]);

  const filteredWfhHistory = useMemo(() => {
    let filtered = [...wfhRequests];

    if (wfhHistoryTimeFilter !== 'all') {
      const today = new Date();
      let startDate: Date | undefined;
      let endDate: Date = new Date(today.getFullYear() + 2, 11, 31, 23, 59, 59); // Default to future to see upcoming WFH

      switch (wfhHistoryTimeFilter) {
        case 'current_month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
          break;
        case 'last_month':
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
          break;
        case 'last_3_months':
          startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
          break;
        case 'last_6_months':
          startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
          break;
        case 'last_year':
          startDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
          break;
        case 'custom':
          startDate = wfhHistoryStartDate;
          endDate = wfhHistoryEndDate || new Date();
          if (endDate) endDate.setHours(23, 59, 59, 999);
          break;
      }

      if (startDate) {
        filtered = filtered.filter(req => {
          const reqDate = new Date(req.submittedAt || req.startDate);
          return reqDate >= startDate! && reqDate <= endDate;
        });
      }
    }

    // Sort by submission date or start date descending
    return filtered.sort((a, b) => new Date(b.submittedAt || b.startDate).getTime() - new Date(a.submittedAt || a.startDate).getTime());
  }, [wfhRequests, wfhHistoryTimeFilter, wfhHistoryStartDate, wfhHistoryEndDate]);

  const paginatedWfhHistory = filteredWfhHistory.slice(
    (wfhHistoryPage - 1) * wfhHistoryItemsPerPage,
    wfhHistoryPage * wfhHistoryItemsPerPage
  );

  const [editingWfhId, setEditingWfhId] = useState<string | null>(null);
  const [isDeletingWfhId, setIsDeletingWfhId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // WFH Management state (for Admin, HR, Manager)
  const [allWfhRequests, setAllWfhRequests] = useState<any[]>([]);
  const [isLoadingWfhRequests, setIsLoadingWfhRequests] = useState(false);
  const [wfhRequestFilter, setWfhRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [wfhRoleFilter, setWfhRoleFilter] = useState<'all' | 'hr' | 'manager' | 'team_lead' | 'employee'>('all');
  const [pendingWfhCurrentPage, setPendingWfhCurrentPage] = useState(1);
  const [pendingWfhItemsPerPage, setPendingWfhItemsPerPage] = useState(10);
  const [selectedWfhRequest, setSelectedWfhRequest] = useState<any>(null);
  const [showWfhRequestDialog, setShowWfhRequestDialog] = useState(false);
  const [isProcessingWfhRequest, setIsProcessingWfhRequest] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [wfhRequestTimeFilter, setWfhRequestTimeFilter] = useState<'all' | 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_year' | 'custom'>('all');
  const [wfhRequestStartDate, setWfhRequestStartDate] = useState<Date | undefined>(undefined);
  const [wfhRequestEndDate, setWfhRequestEndDate] = useState<Date | undefined>(new Date());
  const [recentDecisionsCurrentPage, setRecentDecisionsCurrentPage] = useState(1);
  const [recentDecisionsItemsPerPage, setRecentDecisionsItemsPerPage] = useState(10);

  // Reset recent decisions page when filters change
  useEffect(() => {
    setRecentDecisionsCurrentPage(1);
  }, [wfhRequestFilter, wfhRoleFilter, wfhRequestTimeFilter, wfhRequestStartDate, wfhRequestEndDate]);

  const filteredRecentDecisions = useMemo(() => {
    let filtered = allWfhRequests.filter(req => req.status !== 'pending');

    // Apply Status Filter
    if (wfhRequestFilter !== 'all') {
      filtered = filtered.filter(req => req.status === wfhRequestFilter);
    }

    // Apply Role Filter
    if (wfhRoleFilter !== 'all') {
      filtered = filtered.filter(req => {
        const reqRoleStr = (req.role || 'employee').toLowerCase().replace(/[\s_\-]+/g, '');
        const filterRoleStr = wfhRoleFilter.toLowerCase().replace(/[\s_\-]+/g, '');
        return reqRoleStr === filterRoleStr;
      });
    }

    // Apply Duration Filter
    if (wfhRequestTimeFilter !== 'all') {
      const today = new Date();
      let startDate: Date | undefined;
      let endDate: Date = new Date(today.getFullYear() + 2, 11, 31, 23, 59, 59); // Default to future to see upcoming WFH

      switch (wfhRequestTimeFilter) {
        case 'current_month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
          break;
        case 'last_month':
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
          break;
        case 'last_3_months':
          startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
          break;
        case 'last_6_months':
          startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
          break;
        case 'last_year':
          startDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
          break;
        case 'custom':
          startDate = wfhRequestStartDate ? new Date(wfhRequestStartDate) : undefined;
          endDate = wfhRequestEndDate ? new Date(wfhRequestEndDate) : new Date();
          if (endDate) endDate.setHours(23, 59, 59, 999);
          break;
      }

      if (startDate) {
        filtered = filtered.filter(req => {
          const reqDate = new Date(req.processedAt || req.submittedAt || req.startDate);
          return reqDate >= startDate! && reqDate <= endDate;
        });
      }
    }

    return filtered.sort((a, b) => new Date(b.processedAt || b.submittedAt || b.startDate).getTime() - new Date(a.processedAt || a.submittedAt || a.startDate).getTime());
  }, [allWfhRequests, wfhRequestFilter, wfhRoleFilter, wfhRequestTimeFilter, wfhRequestStartDate, wfhRequestEndDate]);

  // Helper function to format role for display
  const formatRoleDisplay = (role: string): string => {
    if (!role) return 'Employee';
    const roleMap: Record<string, string> = {
      'admin': 'Admin',
      'hr': 'HR',
      'manager': 'Manager',
      'team_lead': 'Team Lead',
      'teamlead': 'Team Lead',
      'employee': 'Employee',
    };
    return roleMap[role.toLowerCase()] || role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Helper function to format time in "X hrs - Y mins" format with tags
  const formatTimeDisplay = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours === 0 && minutes === 0) {
      return '0 hrs - 0 mins';
    } else if (hours === 0) {
      return `0 hrs - ${minutes} mins`;
    } else if (minutes === 0) {
      return `${hours} hrs - 0 mins`;
    } else {
      return `${hours} hrs - ${minutes} mins`;
    }
  };

  // Helper function to format work hours from decimal to "X hrs - Y mins" format
  const formatWorkHours = (decimalHours: number): string => {
    if (!decimalHours || decimalHours === 0) {
      return '0 hrs - 0 mins';
    }

    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);

    if (hours === 0 && minutes === 0) {
      return '0 hrs - 0 mins';
    } else if (hours === 0) {
      return `0 hrs - ${minutes} mins`;
    } else if (minutes === 0) {
      return `${hours} hrs - 0 mins`;
    } else {
      return `${hours} hrs - ${minutes} mins`;
    }
  };

  // Filter attendance history based on quick filter
  const getFilteredAttendanceHistory = () => {
    let filtered = [...attendanceHistory];

    if (historyQuickFilter === 'today') {
      const today = todayIST();
      filtered = filtered.filter(record => record.date === today);
    } else if (historyQuickFilter === 'date') {
      filtered = filtered.filter(record => {
        if (!historyCustomDateRange.startDate && !historyCustomDateRange.endDate) return true;

        const recordDate = record.date;
        const start = historyCustomDateRange.startDate ? formatDateIST(historyCustomDateRange.startDate) : null;
        const end = historyCustomDateRange.endDate ? formatDateIST(historyCustomDateRange.endDate) : null;

        if (start && end) {
          return recordDate >= start && recordDate <= end;
        }

        if (start) {
          return recordDate >= start;
        }

        if (end) {
          return recordDate <= end;
        }

        return true;
      });
    }

    return filtered.sort((a, b) => {
      return b.date.localeCompare(a.date);
    });
  };

  const resolveStaticUrl = useCallback((url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE_URL}${normalized}`;
  }, []);

  // Determine if user can view employee attendance (management roles excluding Team Lead)
  const canViewEmployeeAttendance = user?.role && ['admin', 'hr', 'manager'].includes(user.role);
  const canExportAttendance = user?.role && ['admin', 'hr'].includes(user.role);

  // Access rules for attendance viewing
  const getViewableRoles = (): UserRole[] => {
    if (user?.role === 'admin') return ['admin', 'hr', 'manager', 'team_lead', 'employee'];
    if (user?.role === 'hr') return ['hr', 'manager', 'team_lead', 'employee'];
    if (user?.role === 'manager') return ['team_lead', 'employee'];
    if (user?.role === 'team_lead') return ['employee'];
    return [];
  };

  const refreshLocation = useCallback(async () => {
    try {
      const preciseLocation = await fetchPreciseLocation();
      setLocation({
        latitude: preciseLocation.latitude,
        longitude: preciseLocation.longitude,
        accuracy: preciseLocation.accuracy ?? null,
        address:
          preciseLocation.address ||
          `${preciseLocation.latitude.toFixed(6)}, ${preciseLocation.longitude.toFixed(6)}`,
      });
    } catch (error: any) {
      toast({
        title: 'Location Error',
        description: error?.message || t.attendance.locationRequired,
        variant: 'destructive',
      });
    }
  }, [toast, t.attendance.locationRequired]);

  const refreshLocationFast = useCallback(async () => {
    try {
      setIsGettingFastLocation(true);
      const fastLocation = await getCurrentLocationFast();
      setLocation({
        latitude: fastLocation.latitude,
        longitude: fastLocation.longitude,
        accuracy: fastLocation.accuracy ?? null,
        address: fastLocation.address || `${fastLocation.latitude.toFixed(6)}, ${fastLocation.longitude.toFixed(6)}`,
      });
    } catch (error: any) {
      toast({
        title: 'Location Error',
        description: error?.message || t.attendance.locationRequired,
        variant: 'destructive',
      });
    } finally {
      setIsGettingFastLocation(false);
    }
  }, [toast, t.attendance.locationRequired]);

  // Load user's own WFH requests
  const loadMyWfhRequests = useCallback(async () => {
    try {
      const wfhResponse = await apiService.getMyWFHRequests();
      let wfhData = [];

      if (Array.isArray(wfhResponse)) {
        wfhData = wfhResponse;
      } else if (wfhResponse && typeof wfhResponse === 'object') {
        if (wfhResponse.data && Array.isArray(wfhResponse.data)) {
          wfhData = wfhResponse.data;
        } else if (wfhResponse.requests && Array.isArray(wfhResponse.requests)) {
          wfhData = wfhResponse.requests;
        } else if (wfhResponse.wfh_requests && Array.isArray(wfhResponse.wfh_requests)) {
          wfhData = wfhResponse.wfh_requests;
        } else if (wfhResponse.results && Array.isArray(wfhResponse.results)) {
          wfhData = wfhResponse.results;
        }
      }

      const formattedWfhRequests = wfhData.map((req: any) => ({
        id: req.wfh_id || req.id,
        wfhId: req.wfh_id || req.id,
        startDate: req.start_date,
        endDate: req.end_date,
        reason: req.reason,
        type: ((req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day'),
        status: (req.status || 'pending').toLowerCase(),
        submittedAt: req.created_at,
        submittedById: req.user_id,
        rejectionReason: req.rejection_reason,
        approvedBy: req.approved_by,
      }));

      setWfhRequests(formattedWfhRequests);
    } catch (wfhError) {
      console.error('Failed to load WFH requests:', wfhError);
      setWfhRequests([]);
    }
  }, []);

  // Load all WFH requests for management view
  const loadAllWfhRequests = useCallback(async () => {
    if (!canViewEmployeeAttendance) return;

    setIsLoadingWfhRequests(true);
    try {
      // Fetch WFH requests and employees in parallel to ensure accurate roles
      const [wfhResponse, employeesResponse] = await Promise.all([
        apiService.getAllWFHRequests(),
        apiService.getEmployees()
      ]);

      // Create a map of userId -> role for quick lookup to fix the "Manager" display issue
      const userRoleMap: Record<string, string> = {};
      const employeesData = Array.isArray(employeesResponse) ? employeesResponse : (employeesResponse as any)?.employees || [];
      if (Array.isArray(employeesData)) {
        employeesData.forEach((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          userRoleMap[uId] = emp.role || '';
        });
      }

      const mappedRequests = Array.isArray(wfhResponse) ? wfhResponse.map((req: any) => {
        // Use multiple fallback fields for user ID to ensure a match
        const userIdForMapping = String(req.user_id || req.userId || req.submittedById || '');

        // Robust role lookup:
        // 1. Try exact match in map
        // 2. Try falling back to request-provided role
        // 3. Default to 'employee'
        // We explicitly check userRoleMap first to fix the "Showing as Manager" issue
        // where backend might return incorrect role on the request object.
        let resolvedRole = userRoleMap[userIdForMapping];

        if (!resolvedRole) {
          resolvedRole = req.role || req.user_role || req.requester_role || 'employee';
        }

        return {
          id: req.id?.toString() || req.wfh_id?.toString(),
          wfhId: req.id || req.wfh_id,
          user_id: req.user_id,
          submittedBy: req.employee_name || req.user_name || req.name || 'Unknown User',
          role: resolvedRole,
          department: req.department || '',
          startDate: req.start_date,
          endDate: req.end_date,
          reason: req.reason,
          type: ((req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day'),
          status: (req.status || 'pending').toLowerCase(),
          submittedAt: req.created_at,
          submittedById: req.user_id,
          rejectionReason: req.rejection_reason,
          processedAt: req.processed_at || req.updated_at,
          approvedBy: req.approved_by,
        };
      }) : [];

      setAllWfhRequests(mappedRequests);
    } catch (error) {
      console.error('Failed to load WFH requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load WFH requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingWfhRequests(false);
    }
  }, [canViewEmployeeAttendance, toast]);

  useEffect(() => {
    loadFromBackend();
    if (!initialLocationRequestedRef.current) {
      initialLocationRequestedRef.current = true;
      // Use fast location for immediate access when page loads
      refreshLocationFast();
    }
  }, [refreshLocationFast]);

  // Handle navigation from HR Dashboard with viewMode state or query param
  useEffect(() => {
    const state = routerLocation.state as { viewMode?: string } | null;
    const queryParams = new URLSearchParams(routerLocation.search);
    const tab = queryParams.get('tab');

    if (state?.viewMode) {
      setViewMode(state.viewMode as any);
    } else if (tab) {
      setViewMode(tab as any);
    }
  }, [routerLocation.state, routerLocation.search]);

  useEffect(() => {
    if (viewMode === 'employee' && canViewEmployeeAttendance) {
      loadEmployeeAttendance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, canViewEmployeeAttendance]);

  // Separate useEffect for WFH requests to ensure proper loading
  useEffect(() => {
    if (viewMode === 'wfh_requests' && canViewEmployeeAttendance) {
      // Load immediately when tab is opened
      loadAllWfhRequests();

      // Refresh data every 30 seconds to keep timestamps current
      const dataInterval = setInterval(() => {
        loadAllWfhRequests();
      }, 30000);

      // Force re-render every minute to update relative timestamps
      const renderInterval = setInterval(() => {
        setAllWfhRequests(prev => [...prev]); // Trigger re-render
      }, 60000);

      return () => {
        clearInterval(dataInterval);
        clearInterval(renderInterval);
      };
    }
  }, [viewMode, canViewEmployeeAttendance, loadAllWfhRequests]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [timePeriodFilter, customStartDate, customEndDate]);

  useEffect(() => {
    if (employeeExportFilter !== 'specific') {
      setFilteredExportEmployees([]);
      return;
    }
    let subset = exportEmployees;
    const normalizedDept = selectedExportDepartment.trim().toLowerCase();
    if (normalizedDept) {
      subset = subset.filter(
        (emp) => (emp.department || '').trim().toLowerCase() === normalizedDept,
      );
    }
    const searchValue = employeeExportSearch.trim().toLowerCase();
    if (searchValue) {
      subset = subset.filter(
        (emp) =>
          emp.name.toLowerCase().includes(searchValue) ||
          emp.employee_id?.toLowerCase().includes(searchValue),
      );
    }
    setFilteredExportEmployees(subset);
  }, [
    employeeExportFilter,
    exportEmployees,
    selectedExportDepartment,
    employeeExportSearch,
  ]);

  useEffect(() => {
    if (employeeExportFilter === 'all') {
      setSelectedExportEmployee(null);
    }
  }, [employeeExportFilter]);

  const handleQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    switch (filter) {
      case 'last_month':
        setExportStartDate(subMonths(today, 1));
        setExportEndDate(today);
        break;
      case 'last_3_months':
        setExportStartDate(subMonths(today, 3));
        setExportEndDate(today);
        break;
      case 'last_6_months':
        setExportStartDate(subMonths(today, 6));
        setExportEndDate(today);
        break;
      case 'custom':
      default:
        break;
    }
  };

  const openExportModal = () => {
    if (!canExportAttendance) {
      return;
    }
    setExportType('csv'); // Default to CSV
    setReportLayout('basic');
    setExportModalOpen(true);
    setQuickFilter('custom');
    setExportStartDate(undefined);
    setExportEndDate(new Date());
    setEmployeeExportFilter('all');
    setSelectedExportEmployee(null);
    setEmployeeExportSearch('');
    if (exportDepartments.length === 1) {
      setSelectedExportDepartment(exportDepartments[0]);
    } else if (user?.department) {
      const normalized = exportDepartments.find(
        (dept) => dept.trim().toLowerCase() === user.department.trim().toLowerCase(),
      );
      setSelectedExportDepartment(normalized || selectedExportDepartment || '');
    }
  };

  const performExport = async () => {
    if (!exportStartDate && !exportEndDate) {
      toast({
        title: 'Date Range Required',
        description: 'Please select at least a start or end date.',
        variant: 'destructive',
      });
      return;
    }

    if (employeeExportFilter === 'specific' && !selectedExportEmployee) {
      toast({
        title: 'Employee Selection Required',
        description: 'Choose an employee to export their attendance.',
        variant: 'destructive',
      });
      return;
    }

    // Allow Admin/HR to export without selecting a department
    const departmentParam = (selectedExportDepartment || user?.department || '').trim();
    if (!departmentParam && canExportAttendance && user?.role === 'manager') {
      toast({
        title: 'Department Required',
        description: 'Please select a department to export.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    setExportModalOpen(false);

    try {
      const params: any = {};
      if (departmentParam) {
        params.department = departmentParam;
      }

      // Enforce department scope for Manager exports
      if (user?.role === 'manager' && user?.department) {
        params.department = user.department;
      }

      if (exportStartDate) {
        params.start_date = format(exportStartDate, 'yyyy-MM-dd');
      }
      if (exportEndDate) {
        params.end_date = format(exportEndDate, 'yyyy-MM-dd');
      }
      if (employeeExportFilter === 'specific' && selectedExportEmployee) {
        params.employee_id = selectedExportEmployee.employee_id || selectedExportEmployee.user_id.toString();
      }

      let blob: Blob;
      if (reportLayout === 'grid') {
        // Grid export needs month and year
        const exportMonth = exportStartDate ? (exportStartDate.getMonth() + 1).toString() : (new Date().getMonth() + 1).toString();
        const exportYear = exportStartDate ? exportStartDate.getFullYear().toString() : new Date().getFullYear().toString();

        blob = exportType === 'csv'
          ? await apiService.exportMonthlyGridCSV({
            month: exportMonth,
            year: exportYear,
            department: params.department
          })
          : await apiService.exportMonthlyGridPDF({
            month: exportMonth,
            year: exportYear,
            department: params.department
          });
      } else if (reportLayout === 'detailed_grid') {
        // Detailed Grid export
        const exportMonth = exportStartDate ? (exportStartDate.getMonth() + 1).toString() : (new Date().getMonth() + 1).toString();
        const exportYear = exportStartDate ? exportStartDate.getFullYear().toString() : new Date().getFullYear().toString();

        blob = exportType === 'csv'
          ? await apiService.exportMonthlyGridDetailedCSV({
            month: exportMonth,
            year: exportYear,
            department: params.department
          })
          : await apiService.downloadMonthlyDetailedAttendanceGridPDF({
            month: exportMonth,
            year: exportYear,
            department: params.department
          });
      } else {
        blob = exportType === 'csv'
          ? await apiService.exportAttendanceCSV(params)
          : await apiService.exportAttendancePDF(params);
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const dateStr =
        exportStartDate && exportEndDate
          ? `${format(exportStartDate, 'yyyyMMdd')}_${format(exportEndDate, 'yyyyMMdd')}`
          : exportStartDate
            ? `from_${format(exportStartDate, 'yyyyMMdd')}`
            : exportEndDate
              ? `until_${format(exportEndDate, 'yyyyMMdd')}`
              : 'all';

      const empSuffix =
        employeeExportFilter === 'specific' && selectedExportEmployee
          ? `_${selectedExportEmployee.employee_id || selectedExportEmployee.user_id}`
          : '';

      a.download = `${reportLayout}_attendance_report${empSuffix}_${dateStr}.${exportType}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Attendance data exported as ${exportType?.toUpperCase()}.`,
      });
    } catch (error: any) {
      console.error('Attendance export failed', error);
      toast({
        title: 'Export Failed',
        description: error?.message || 'Unable to export attendance data.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  useEffect(() => {
    if (!exportDepartments.length) {
      setSelectedExportDepartment('');
      return;
    }
    if (
      selectedExportDepartment &&
      exportDepartments.some(
        (dept) => dept.trim().toLowerCase() === selectedExportDepartment.trim().toLowerCase(),
      )
    ) {
      return;
    }
    const preferred =
      user?.department &&
      exportDepartments.find(
        (dept) => dept.trim().toLowerCase() === user.department.trim().toLowerCase(),
      );
    setSelectedExportDepartment(preferred || exportDepartments[0]);
  }, [exportDepartments, selectedExportDepartment, user?.department]);

  const loadFromBackend = async () => {
    try {
      if (!user?.id) return;
      const token = localStorage.getItem('token');
      const res = await fetch(`https://testing.staffly.space/attendance/my-attendance/${user.id}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAttendanceHistory(
        data
          .sort((a: any, b: any) => {
            const timeA = new Date(a?.check_in || 0).getTime();
            const timeB = new Date(b?.check_in || 0).getTime();
            return timeB - timeA; // latest first
          })
          .map((rec: any) => {
            // Determine work location from backend or based on WFH approval
            let workLocation = rec.workLocation || rec.work_location;

            // If work location is not set, check for WFH approval for that date
            if (!workLocation && rec.check_in) {
              const recordDate = formatDateIST(rec.check_in, 'yyyy-MM-dd');
              const wfhStatus = getWfhStatusForDate(recordDate);
              workLocation = wfhStatus.hasApprovedWfh ? 'work_from_home' : 'office';
            }

            // Normalize work location values to backend-accepted enums: "office" or "work_from_home"
            if (workLocation === 'work_from_home' || workLocation === 'wfh' || workLocation === 'WFH') {
              workLocation = 'work_from_home';
            } else if (workLocation === 'work_from_office' || !workLocation || workLocation === 'office' || workLocation === 'Office') {
              workLocation = 'office';
            }

            let status = 'present';
            const recordDateStr = formatDateIST(rec.check_in, 'yyyy-MM-dd');
            const todayStr = formatDateIST(new Date(), 'yyyy-MM-dd');

            // If it's a past date and check-out is missing, mark as absent (forgotten checkout)
            if (recordDateStr < todayStr && !rec.check_out) {
              status = 'absent';
            }

            return {
              id: String(rec.attendance_id),
              userId: String(rec.user_id),
              date: formatDateIST(rec.check_in),
              checkInTime: rec.check_in,
              checkOutTime: rec.check_out || undefined,
              checkInLocation: {
                latitude: 0,
                longitude: 0,
                address: rec.checkInLocationLabel || rec.locationLabel || 'N/A',
              },
              checkOutLocation: {
                latitude: 0,
                longitude: 0,
                address: rec.checkOutLocationLabel || rec.locationLabel || 'N/A',
              },
              checkInSelfie: rec.checkInSelfie || '',
              checkOutSelfie: rec.checkOutSelfie || '',
              status: status,
              workHours: rec.total_hours,
              workSummary: rec.workSummary || rec.work_summary || null,
              taskDeadlineReason: rec.taskDeadlineReason || rec.task_deadline_reason || rec.taskPendingReason || rec.task_pending_reason || null,
              workReport: resolveStaticUrl(rec.workReport || rec.work_report),
              workLocation: workLocation,
            };
          })
          .sort((a, b) => {
            const timeA = new Date(a.checkInTime || 0).getTime();
            const timeB = new Date(b.checkInTime || 0).getTime();
            return timeB - timeA; // newest first
          })
      );


      // Load WFH requests from backend
      await loadMyWfhRequests();


      const today = todayIST();
      const yesterday = formatDateIST(new Date(Date.now() - 24 * 60 * 60 * 1000));

      // Find today's record
      const todayRecord = data.find((rec: any) => {
        const checkInDate = formatDateIST(rec.check_in);
        // Only consider records from today for current check-in session
        return checkInDate === today;
      });

      if (todayRecord) {
        // Determine work location from backend or based on WFH approval
        let workLocation = todayRecord.workLocation || todayRecord.work_location;

        // If work location is not set, check for WFH approval for the check-in date
        if (!workLocation) {
          const checkInDate = formatDateIST(todayRecord.check_in, 'yyyy-MM-dd');
          const wfhStatus = getWfhStatusForDate(checkInDate);
          workLocation = wfhStatus.hasApprovedWfh ? 'work_from_home' : 'office';
        }

        // Normalize work location values to backend-accepted enums: "office" or "work_from_home"
        if (workLocation === 'work_from_home' || workLocation === 'wfh' || workLocation === 'WFH') {
          workLocation = 'work_from_home';
        } else if (workLocation === 'work_from_office' || !workLocation || workLocation === 'office' || workLocation === 'Office') {
          workLocation = 'office';
        }

        const attendance: AttendanceRecord = {
          id: todayRecord.attendance_id.toString(),
          userId: todayRecord.user_id.toString(),
          date: formatDateIST(todayRecord.check_in),
          checkInTime: todayRecord.check_in, // Use ISO datetime string
          checkOutTime: todayRecord.check_out || undefined, // Use ISO datetime string
          checkInLocation: {
            latitude: 0,
            longitude: 0,
            address: todayRecord.checkInLocationLabel || todayRecord.locationLabel || todayRecord.gps_location || 'N/A',
          },
          checkOutLocation: {
            latitude: 0,
            longitude: 0,
            address: todayRecord.checkOutLocationLabel || todayRecord.locationLabel || todayRecord.gps_location || 'N/A',
          },
          checkInSelfie: todayRecord.checkInSelfie || todayRecord.selfie || '',
          checkOutSelfie: todayRecord.checkOutSelfie || '',
          status: 'present',
          workHours: todayRecord.total_hours,
          workSummary: todayRecord.workSummary || todayRecord.work_summary || null,
          taskDeadlineReason: todayRecord.taskDeadlineReason || todayRecord.task_deadline_reason || todayRecord.taskPendingReason || todayRecord.task_pending_reason || null,
          workReport: resolveStaticUrl(todayRecord.workReport || todayRecord.work_report),
          workLocation: workLocation,
        };
        setCurrentAttendance(attendance);

        // Initialize timer state for existing attendance
        if (!attendance.checkOutTime) {
          const attendanceCheckInTime = new Date(attendance.checkInTime);
          const now = new Date();
          const timeSinceCheckIn = (now.getTime() - attendanceCheckInTime.getTime()) / 1000; // seconds

          // Check if this is a fresh check-in (less than 5 minutes ago)
          const isRecentCheckIn = timeSinceCheckIn < 5 * 60; // 5 minutes

          if (isRecentCheckIn) {
            // Fresh check-in - start with zero values
            setOnlineStartTime(attendanceCheckInTime);
            setOfflineStartTime(null);
            setAccumulatedOnlineSeconds(0);
            setAccumulatedOfflineSeconds(0);
            setWorkingHours('0 hrs - 0 mins');
            setOnlineWorkingHours('0 hrs - 0 mins');
            setTotalOfflineTime('0 hrs - 0 mins');
            setIsFreshCheckIn(true);
            setCheckInTime(attendanceCheckInTime);

            // Clear fresh flag after remaining time
            const remainingTime = (5 * 60 * 1000) - (timeSinceCheckIn * 1000);
            setTimeout(() => {
              setIsFreshCheckIn(false);
              console.log('Fresh check-in period ended - backend sync enabled');
            }, remainingTime);

            console.log(`Fresh check-in detected (${Math.floor(timeSinceCheckIn)}s ago) - starting with zero values`);
          } else {
            // Existing attendance - fetch actual work hours from backend
            setOnlineStartTime(now);
            setOfflineStartTime(null);
            setIsFreshCheckIn(false);
            setCheckInTime(attendanceCheckInTime);

            // Fetch actual work hours from backend
            try {
              const token = localStorage.getItem('token');
              const workHoursResponse = await fetch(`https://testing.staffly.space/attendance/working-hours/${attendance.id}`, {
                headers: {
                  'Authorization': token ? `Bearer ${token}` : '',
                },
              });

              if (workHoursResponse.ok) {
                const workHoursData = await workHoursResponse.json();
                const backendOnlineSeconds = workHoursData.total_seconds || 0;
                const backendOfflineSeconds = workHoursData.total_offline_seconds || 0;
                const isCurrentlyOnline = workHoursData.is_currently_online || false;

                // Set accumulated to backend values (only actual tracked time)
                setAccumulatedOnlineSeconds(backendOnlineSeconds);
                setAccumulatedOfflineSeconds(backendOfflineSeconds);

                // Update display with actual tracked time
                const onlineDisplay = formatTimeDisplay(backendOnlineSeconds);
                const offlineDisplay = formatTimeDisplay(backendOfflineSeconds);
                setOnlineWorkingHours(onlineDisplay);
                setWorkingHours(onlineDisplay);
                setTotalOfflineTime(offlineDisplay);

                // Set current online status from backend
                setIsOnline(isCurrentlyOnline);

                console.log(`Existing attendance - loaded from backend: Online=${backendOnlineSeconds}s, Offline=${backendOfflineSeconds}s, CurrentlyOnline=${isCurrentlyOnline}`);
              } else {
                // If backend call fails, start with 0 hours (no tracked time)
                setAccumulatedOnlineSeconds(0);
                setAccumulatedOfflineSeconds(0);
                setWorkingHours('0 hrs - 0 mins');
                setOnlineWorkingHours('0 hrs - 0 mins');
                setTotalOfflineTime('0 hrs - 0 mins');
                setIsOnline(false);
                console.log(`Existing attendance - backend call failed, starting with 0 hours`);
              }
            } catch (error) {
              // If fetch fails, start with 0 hours (no tracked time)
              setAccumulatedOnlineSeconds(0);
              setAccumulatedOfflineSeconds(0);
              setWorkingHours('0 hrs - 0 mins');
              setOnlineWorkingHours('0 hrs - 0 mins');
              setTotalOfflineTime('0 hrs - 0 mins');
              setIsOnline(false);
              console.log(`Existing attendance - fetch error, starting with 0 hours`);
            }
          }

          setLastStatusChangeTime(attendanceCheckInTime);
        }

        // Store all history
        setAttendanceHistory((prev) => prev);
      } else {
        setCurrentAttendance(null);
      }
    } catch (e) {
      // ignore
    }
  };

  const loadEmployeeAttendance = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };

      let url = `${API_BASE_URL}/attendance/all`;
      // Attempt backend enforcement by passing department scope
      if (user?.role === 'manager' && user?.department) {
        url += `?department=${encodeURIComponent(user.department)}`;
        url += `&manager_id=${encodeURIComponent(user.id)}`;
      } else if (user?.role === 'team_lead') {
        url += `?team_lead_id=${encodeURIComponent(user.id)}`;
      }

      // Fetch attendance and employees in parallel to ensure we have role data
      const [attendanceRes, employeesRes] = await Promise.all([
        fetch(url, { headers }),
        fetch(`${API_BASE_URL}/employees/`, { headers })
      ]);

      if (!attendanceRes.ok) {
        const errorText = await attendanceRes.text();
        console.error(`Failed to load employee attendance: ${attendanceRes.status}`, errorText);
        toast({
          title: 'Error',
          description: `Failed to load attendance: ${attendanceRes.status === 403 ? 'Access denied' : attendanceRes.status === 400 ? 'Department not assigned' : 'Server error'}`,
          variant: 'destructive',
        });
        setEmployeeAttendanceData([]);
        return;
      }

      let data = await attendanceRes.json();
      let employeesData = employeesRes.ok ? await employeesRes.json() : [];
      if (!Array.isArray(employeesData) && employeesData?.employees) {
        employeesData = employeesData.employees;
      } else if (!Array.isArray(employeesData)) {
        employeesData = [];
      }

      // Create a map of userId -> role for quick lookup
      const userRoleMap: Record<string, string> = {};
      employeesData.forEach((emp: any) => {
        const uId = String(emp.user_id || emp.userId || emp.id);
        userRoleMap[uId] = (emp.role || '').toLowerCase();
      });

      // Enforce strict visibility rules (Client-side fail-safe)
      if ((user?.role === 'manager' || user?.role === 'team_lead') && user?.id) {
        const userId = String(user.id);
        const userDept = user.department?.trim().toLowerCase();

        data = data.filter((rec: any) => {
          const recUserId = String(rec.user_id || rec.employee_id);
          const recDept = (rec.department || '').trim().toLowerCase();

          // 1. Always show Self
          if (recUserId === userId) return true;

          // 2. Manager view: Same department + (employees or team leads)
          if (user.role === 'manager') {
            if (recDept !== userDept) return false;
            const recRole = (userRoleMap[recUserId] || '').replace(/[\s_]+/g, '').toLowerCase();
            return recRole === 'employee' || recRole === 'teamlead' || recRole === 'team_lead';
          }

          // 3. Team Lead view: Only those reporting to them (matching on backend normally, but fail-safe here)
          if (user.role === 'team_lead') {
            const recRole = (userRoleMap[recUserId] || '').replace(/[\s_]+/g, '').toLowerCase();
            // Team leads can see employees in their department
            return recDept === userDept && (recRole === 'employee');
          }

          return false;
        });
      }

      // Calculate date range based on time period filter
      const today = new Date();
      let startDate = new Date();

      switch (timePeriodFilter) {
        case 'today':
          startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'current_month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
        case 'last_month':
          startDate = subMonths(today, 1);
          break;
        case 'last_3_months':
          startDate = subMonths(today, 3);
          break;
        case 'last_6_months':
          startDate = subMonths(today, 6);
          break;
        case 'last_12_months':
          startDate = subMonths(today, 12);
          break;
        case 'custom':
          startDate = customStartDate ? new Date(customStartDate) : new Date(0);
          break;
      }

      const endDateLimit = timePeriodFilter === 'custom' && customEndDate ? new Date(customEndDate) : today;
      // Set end date limit to end of day
      endDateLimit.setHours(23, 59, 59, 999);

      const records: EmployeeAttendanceRecord[] = data
        .filter((rec: any) => rec.check_in && new Date(rec.check_in))
        .map((rec: any) => {
          const checkInDate = rec.check_in;
          const checkOutDate = rec.check_out;
          const recordDateStr = formatDateIST(checkInDate, 'yyyy-MM-dd');
          const todayStr = formatDateIST(new Date(), 'yyyy-MM-dd');

          let statusResult = 'present';
          // If it's a past date and check-out is missing, mark as absent (forgotten checkout)
          if (recordDateStr < todayStr && !checkOutDate) {
            statusResult = 'absent';
          }

          // Determine work location from backend or based on WFH approval
          let workLocation = rec.workLocation || rec.work_location;

          // If work location is not set, check for WFH approval for that date
          if (!workLocation && checkInDate) {
            const recordDate = formatDateIST(checkInDate, 'yyyy-MM-dd');
            const wfhStatus = getWfhStatusForDate(recordDate);
            workLocation = wfhStatus.hasApprovedWfh ? 'work_from_home' : 'office';
          }

          // Normalize work location values to backend-accepted enums: "office" or "work_from_home"
          if (workLocation === 'work_from_home' || workLocation === 'wfh' || workLocation === 'WFH' || workLocation === 'Work From Home') {
            workLocation = 'work_from_home';
          } else if (workLocation === 'work_from_office' || !workLocation || workLocation === 'office' || workLocation === 'Office' || workLocation === 'Work From Office') {
            workLocation = 'office';
          }

          return {
            id: String(rec.attendance_id || rec.id || ''),
            userId: String(rec.user_id || rec.employee_id || ''),
            date: rec.check_in ? formatDateIST(rec.check_in) : selectedDate,
            checkInTime: rec.check_in || undefined,
            checkOutTime: rec.check_out || undefined,
            checkInLocation: {
              latitude: 0,
              longitude: 0,
              address: rec.checkInLocationLabel || rec.locationLabel || rec.gps_location || 'N/A',
            },
            checkOutLocation: {
              latitude: 0,
              longitude: 0,
              address: rec.checkOutLocationLabel || rec.locationLabel || 'N/A',
            },
            checkInSelfie: rec.checkInSelfie || rec.selfie || '',
            checkOutSelfie: rec.checkOutSelfie || '',
            status: statusResult,
            workHours: rec.total_hours || 0,
            name: rec.name || rec.userName || undefined,
            email: rec.email || rec.userEmail || undefined,
            department: rec.department || undefined,
            workSummary: rec.workSummary || rec.work_summary || null,
            workReport: resolveStaticUrl(rec.workReport || rec.work_report),
            workLocation: workLocation,
            taskDeadlineReason: rec.taskDeadlineReason || rec.task_deadline_reason || rec.taskPendingReason || rec.task_pending_reason || null,
          };
        })
        .filter((r: AttendanceRecord) => {
          // Filter by date range based on time period
          const recordDate = new Date(r.date);
          return recordDate >= startDate && recordDate <= endDateLimit;
        })
        .sort((a, b) => {
          // Sort by check-in time in descending order (most recent first)
          const timeA = new Date(a.checkInTime || 0).getTime();
          const timeB = new Date(b.checkInTime || 0).getTime();
          return timeB - timeA;
        });
      setEmployeeAttendanceData(records);
    } catch (e: any) {
      console.error('Error loading employee attendance:', e);
      toast({
        title: 'Error',
        description: e.message || 'Failed to load employee attendance',
        variant: 'destructive',
      });
      setEmployeeAttendanceData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter employee attendance data based on search and status
  useEffect(() => {
    let filtered = [...employeeAttendanceData];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(record =>
        (record.name && record.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.email && record.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.department && record.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.userId && record.userId.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(record => {
        const statusValue = record.status?.toLowerCase() || '';
        const checkInTime = record.checkInTime || '';
        const checkOutTime = record.checkOutTime || '';

        // Check if check-in was late (similar to getStatusBadge logic)
        const checkInT = checkInTime && (checkInTime.includes(' ') || checkInTime.includes('T')) ? (checkInTime.includes('T') ? checkInTime.split('T')[1].substring(0, 8) : checkInTime.split(' ')[1].substring(0, 8)) : checkInTime;
        const isCheckInLate = statusValue === 'late' || (checkInT && checkInT > '09:30:00');

        // Check if check-out was early
        const checkOutT = checkOutTime && (checkOutTime.includes(' ') || checkOutTime.includes('T')) ? (checkOutTime.includes('T') ? checkOutTime.split('T')[1].substring(0, 8) : checkOutTime.split(' ')[1].substring(0, 8)) : checkOutTime;
        const isCheckOutEarly = checkOutT && checkOutT < '18:00:00';

        if (filterStatus === 'late') {
          return isCheckInLate;
        }
        if (filterStatus === 'early') {
          return isCheckOutEarly;
        }
        if (filterStatus === 'present') {
          return statusValue === 'present' && !isCheckOutEarly;
        }
        return true;
      });
    }

    setFilteredEmployeeAttendanceData(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, filterStatus, employeeAttendanceData]);

  const loadExportEmployees = useCallback(async () => {
    if (!canExportAttendance) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };

      const res = await fetch(`${API_BASE_URL}/employees/`, { headers });
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(`Failed to load employees: ${res.status}`, errorText);
        toast({
          title: 'Error',
          description: res.status === 403
            ? 'Access denied. You do not have permission to view employees.'
            : `Failed to load employees: ${res.status}`,
          variant: 'destructive',
        });
        setExportEmployees([]);
        setExportDepartments([]);
        return;
      }
      let data = await res.json();
      if (!Array.isArray(data) && data?.employees) {
        data = data.employees;
      } else if (!Array.isArray(data)) {
        data = [];
      }

      let mapped: ExportEmployee[] = data.map((emp: any) => ({
        user_id: emp.user_id || emp.userId,
        employee_id: emp.employee_id || emp.employeeId || '',
        name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        department: emp.department || emp.department_name || '',
      }));

      // Managers are restricted to their department, but Admin/HR can see everyone
      if (user?.department && !['admin', 'hr'].includes(user?.role || '')) {
        const normalizedDept = user.department.trim().toLowerCase();
        mapped = mapped.filter(
          (emp) => (emp.department || '').trim().toLowerCase() === normalizedDept,
        );
      }

      setExportEmployees(mapped);
      const deptSet = new Set(
        mapped
          .map((emp) => emp.department)
          .filter((dept): dept is string => Boolean(dept && dept.trim())),
      );
      const deptList = Array.from(deptSet).sort((a, b) => a.localeCompare(b));
      setExportDepartments(deptList);
      if (deptList.length === 1) {
        setSelectedExportDepartment(deptList[0]);
      }
    } catch (error) {
      console.error('loadExportEmployees error', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load employees. Please try again.',
        variant: 'destructive',
      });
      setExportEmployees([]);
      setExportDepartments([]);
    }
  }, [canExportAttendance, user?.department, user?.role]);

  useEffect(() => {
    if (canExportAttendance) {
      loadExportEmployees();
    }
  }, [canExportAttendance, loadExportEmployees]);

  const handleCheckIn = () => {
    if (!location) {
      toast({
        title: 'Error',
        description: t.attendance.locationRequired,
        variant: 'destructive',
      });
      return;
    }
    setIsCheckingIn(true);
    setShowCamera(true);
  };

  const handleCheckOut = () => {
    if (!location) {
      toast({
        title: 'Error',
        description: t.attendance.locationRequired,
        variant: 'destructive',
      });
      return;
    }
    setShowCheckoutDialog(true);
  };

  const confirmCheckOut = () => {
    if (!todaysWork.trim()) {
      toast({
        title: 'Work Summary Required',
        description: 'Please provide today\'s work summary before checking out.',
        variant: 'destructive',
      });
      return;
    }
    setIsCheckingIn(false);
    setShowCamera(true);
    setShowCheckoutDialog(false);
  };

  // Helper function to compress base64 image
  const compressBase64Image = async (base64: string, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to compressed base64
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.src = base64;
    });
  };

  const handleCameraCapture = async (imageData: string) => {
    setIsLoading(true);
    try {
      // ✅ Compress the image to reduce payload size (fixes 413 error)
      const compressedImage = await compressBase64Image(imageData, 800, 0.7);
      if (!location) {
        await refreshLocation();
      }
      if (!location || !user?.id) throw new Error('Location or user missing');
      if (!isCheckingIn && !todaysWork.trim()) {
        throw new Error('Work summary is required to check out.');
      }

      // Check WFH approval status for check-in date
      const checkInDate = nowIST();
      const wfhStatus = isCheckingIn ? getWfhStatusForDate(checkInDate) : null;

      // Determine check-in type and work location
      // If WFH is approved for the date, check-in type should be 'wfh'
      // Otherwise, it's 'office'
      // IMPORTANT: Work location is set at check-in time and must remain immutable after attendance is finalized
      // Backend accepts: "office" or "work_from_home" (not "work_from_office")
      // WFH Approval Override: If has_wfh_approval === true, force work_location = "work_from_home"
      const checkInType = isCheckingIn && wfhStatus?.hasApprovedWfh ? 'wfh' : 'office';
      // WFH approval override: if approved, always use work_from_home, otherwise use office
      const workLocation = isCheckingIn && wfhStatus?.hasApprovedWfh ? 'work_from_home' : 'office';

      const locationPayload = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy ?? null,
        address: location.address ?? '',
        timestamp: new Date().toISOString(),
      };
      if (location.accuracy && location.accuracy > 10) {
        toast({ title: 'Low GPS Accuracy', description: `Proceeding with ±${Math.round(location.accuracy)}m.`, variant: 'default' });
      }
      let workReportBase64: string | undefined;
      if (!isCheckingIn && workPdf) {
        workReportBase64 = await fileToBase64(workPdf);
      }
      const payload = {
        user_id: user.id,
        gps_location: locationPayload,
        location_data: {
          [isCheckingIn ? 'check_in' : 'check_out']: locationPayload,
        },
        selfie: compressedImage, // ✅ Use compressed image
        work_summary: !isCheckingIn ? todaysWork.trim() : undefined,
        task_deadline_reason: !isCheckingIn ? taskDeadlineReason.trim() : undefined,
        work_report: !isCheckingIn ? workReportBase64 : undefined,
        // Include WFH approval status and check-in type for backend
        ...(isCheckingIn && {
          check_in_type: checkInType,
          work_location: workLocation,
          has_wfh_approval: wfhStatus?.hasApprovedWfh || false,
          wfh_request_id: wfhStatus?.wfhRequest?.id || null,
        }),
      };
      const endpoint = isCheckingIn
        ? 'https://testing.staffly.space/attendance/check-in/json'
        : 'https://testing.staffly.space/attendance/check-out/json';

      // ✅ Get token from localStorage for authentication
      const token = localStorage.getItem('token');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Attendance API error');
      }

      // Parse and log the API response for debugging
      const responseData = await response.json().catch(() => null);
      if (responseData) {
        console.log('Check-in API Response:', {
          attendance_id: responseData.attendance_id,
          user_id: responseData.user_id,
          check_in: responseData.check_in,
          check_out: responseData.check_out,
          total_hours: responseData.total_hours,
          work_location: responseData.work_location,
          gps_location: responseData.gps_location,
        });
      }

      await loadFromBackend();
      toast({ title: 'Success', description: isCheckingIn ? t.attendance.checkedIn : t.attendance.checkedOut });

      // Set user online status based on check-in/check-out
      if (isCheckingIn) {
        setIsOnline(true);
        // Initialize timers to 0 on check-in
        const now = new Date();
        setOnlineStartTime(now);
        setOfflineStartTime(null);
        setAccumulatedOnlineSeconds(0);
        setAccumulatedOfflineSeconds(0);
        setWorkingHours('0 hrs - 0 mins');
        setOnlineWorkingHours('0 hrs - 0 mins');
        setTotalOfflineTime('0 hrs - 0 mins');
        setCurrentSessionOfflineTime('0:00:00');
        setLastStatusChangeTime(now);

        // Set fresh check-in flag to prevent backend sync for 5 minutes
        setIsFreshCheckIn(true);
        setCheckInTime(now);

        // Clear fresh check-in flag after 5 minutes
        setTimeout(() => {
          setIsFreshCheckIn(false);
          console.log('Fresh check-in period ended - backend sync enabled');
        }, 5 * 60 * 1000); // 5 minutes

        console.log('User checked in - timers initialized to 0, fresh check-in flag set');
      } else {
        setIsOnline(false);
        // Reset all timers on checkout
        setOnlineStartTime(null);
        setOfflineStartTime(null);
        setAccumulatedOnlineSeconds(0);
        setAccumulatedOfflineSeconds(0);
        setWorkingHours('0 hrs - 0 mins');
        setOnlineWorkingHours('0 hrs - 0 mins');
        setTotalOfflineTime('0 hrs - 0 mins');
        setCurrentSessionOfflineTime('0:00:00');
        setLastStatusChangeTime(null);
        setIsFreshCheckIn(false);
        setCheckInTime(null);
        console.log('User checked out - all timers reset');
        setTodaysWork('');
        setTaskDeadlineReason('');
        setWorkPdf(null);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to record attendance', variant: 'destructive' });
    } finally {
      setShowCamera(false);
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWorkPdf(file);
    }
  };

  // Helper function to get tomorrow's date (start of day in IST)
  const getTomorrowIST = (): Date => {
    const tomorrow = nowIST();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  // Helper function to get today's date (start of day in IST)
  const getTodayISTDate = (): Date => {
    const today = nowIST();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  // Helper function to check if a date is valid for WFH (must be today or later)
  const isValidWfhDate = (date: Date | undefined): boolean => {
    if (!date) return false;
    const today = getTodayISTDate();
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate >= today;
  };

  // Helper function to validate WFH form
  const validateWfhForm = (): { valid: boolean; message?: string } => {
    // Check start date
    if (!wfhStartDate) {
      return { valid: false, message: 'Please select a start date.' };
    }

    if (!isValidWfhDate(wfhStartDate)) {
      return { valid: false, message: 'Start date must be today or later.' };
    }

    // For full day, check end date
    if (wfhType === 'full_day') {
      if (!wfhEndDate) {
        return { valid: false, message: 'Please select an end date.' };
      }

      if (!isValidWfhDate(wfhEndDate)) {
        return { valid: false, message: 'End date must be today or later.' };
      }

      if (wfhEndDate < wfhStartDate) {
        return { valid: false, message: 'End date must be on or after the start date.' };
      }
    }

    // Check reason
    if (!wfhReason.trim()) {
      return { valid: false, message: 'Please provide a reason for your WFH request.' };
    }

    if (wfhReason.trim().length < 10) {
      return { valid: false, message: 'Reason must be at least 10 characters long.' };
    }

    return { valid: true };
  };

  const handleWfhSubmit = async () => {
    const validation = validateWfhForm();
    if (!validation.valid) {
      toast({
        title: 'Invalid Information',
        description: validation.message || 'Please fill in all required fields correctly.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingWfh(true);
    try {
      // Call API to submit WFH request
      const wfhTypeLabel = wfhType === 'full_day' ? 'Full Day' : 'Half Day';
      // For half day, use start date as both start and end date
      const endDate = wfhType === 'half_day' ? wfhStartDate : wfhEndDate;

      await apiService.submitWFHRequest({
        start_date: format(wfhStartDate!, 'yyyy-MM-dd'),
        end_date: format(endDate!, 'yyyy-MM-dd'),
        wfh_type: wfhTypeLabel,
        reason: wfhReason.trim(),
      });

      // Reload WFH requests from backend to get fresh data
      await loadMyWfhRequests();

      toast({
        title: 'WFH Request Submitted',
        description: 'Your work from home request has been submitted for approval.',
        variant: 'default',
      });

      // Reset form
      setWfhStartDate(undefined);
      setWfhEndDate(undefined);
      setWfhReason('');
      setWfhType('full_day');
    } catch (error: any) {
      toast({
        title: 'Submission Failed',
        description: error.message || 'Failed to submit WFH request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingWfh(false);
    }
  };

  const handleEditWfh = (request: any) => {
    setEditingWfhId(request.id || request.wfhId);
    setWfhStartDate(parseToIST(request.startDate) || undefined);
    setWfhEndDate(parseToIST(request.endDate) || undefined);
    setWfhReason(request.reason);
    setWfhType(request.type === 'Full Day' || request.type === 'full_day' ? 'full_day' : 'half_day');
    setIsEditDialogOpen(true);
  };

  const handleUpdateWfh = async () => {
    if (!editingWfhId) {
      toast({
        title: 'Error',
        description: 'No WFH request selected for update.',
        variant: 'destructive',
      });
      return;
    }

    const validation = validateWfhForm();
    if (!validation.valid) {
      toast({
        title: 'Invalid Information',
        description: validation.message || 'Please fill in all required fields correctly.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingWfh(true);
    try {
      const wfhTypeLabel = wfhType === 'full_day' ? 'Full Day' : 'Half Day';
      // For half day, use start date as both start and end date
      const endDate = wfhType === 'half_day' ? wfhStartDate : wfhEndDate;

      await apiService.updateWFHRequest(parseInt(editingWfhId!), {
        start_date: format(wfhStartDate!, 'yyyy-MM-dd'),
        end_date: format(endDate!, 'yyyy-MM-dd'),
        wfh_type: wfhTypeLabel,
        reason: wfhReason.trim(),
      });

      // Reload WFH requests from backend to get fresh data
      await loadMyWfhRequests();

      toast({
        title: 'WFH Request Updated',
        description: 'Your work from home request has been updated successfully.',
        variant: 'default',
      });

      setIsEditDialogOpen(false);
      setEditingWfhId(null);
      setWfhStartDate(undefined);
      setWfhEndDate(undefined);
      setWfhReason('');
      setWfhType('full_day');
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update WFH request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingWfh(false);
    }
  };

  const handleDeleteWfh = async (wfhId: string) => {
    setIsDeletingWfhId(wfhId);
    try {
      await apiService.deleteWFHRequest(parseInt(wfhId));

      // Reload WFH requests from backend to get fresh data
      await loadMyWfhRequests();

      toast({
        title: 'WFH Request Deleted',
        description: 'Your work from home request has been deleted successfully.',
        variant: 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete WFH request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingWfhId(null);
    }
  };

  // Handle WFH request approval/rejection
  const handleWfhRequestAction = async (requestId: string, action: 'approve' | 'reject', reason?: string) => {
    setIsProcessingWfhRequest(true);
    try {
      // Call the backend API to approve/reject
      await apiService.approveWFHRequest(
        parseInt(requestId),
        action === 'approve',
        action === 'reject' ? reason : undefined
      );

      // Reload WFH requests from backend to get fresh data
      await loadAllWfhRequests();

      toast({
        title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `WFH request has been ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
        variant: 'default',
      });

      setShowWfhRequestDialog(false);
      setSelectedWfhRequest(null);
    } catch (error) {
      toast({
        title: 'Action Failed',
        description: `Failed to ${action} the request. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingWfhRequest(false);
    }
  };

  // Get filtered WFH requests
  const getFilteredWfhRequests = () => {
    if (wfhRequestFilter === 'all') return allWfhRequests;
    return allWfhRequests.filter(req => req.status === wfhRequestFilter);
  };

  // Get pending requests count for badge
  const getPendingWfhCount = () => {
    return allWfhRequests.filter(req => req.status === 'pending').length;
  };

  // Check if user has approved WFH for a specific date
  const getWfhStatusForDate = (date: string | Date): { hasApprovedWfh: boolean; wfhRequest?: any } => {
    const checkDate = typeof date === 'string' ? date : formatDateIST(date, 'yyyy-MM-dd');
    const wfhRequest = [...wfhRequests, ...allWfhRequests].find(req =>
      req.submittedById === user?.id &&
      req.status === 'approved' &&
      req.startDate <= checkDate &&
      req.endDate >= checkDate
    );
    return {
      hasApprovedWfh: !!wfhRequest,
      wfhRequest: wfhRequest || undefined
    };
  };

  // Check if user has approved WFH for today
  const getTodayWfhStatus = () => {
    const today = formatDateIST(new Date(), 'yyyy-MM-dd');
    return getWfhStatusForDate(today);
  };

  // Format relative time for better user experience
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  const handleOnlineStatusChange = async (newStatus: boolean, reason?: string) => {
    if (!currentAttendance?.id) {
      throw new Error('No active attendance record');
    }

    const now = new Date();

    // Update accumulated time before changing status
    if (isOnline && onlineStartTime && !newStatus) {
      // Was online, now going offline - accumulate online time
      const onlineSessionSeconds = Math.floor((now.getTime() - onlineStartTime.getTime()) / 1000);
      const newAccumulatedOnline = accumulatedOnlineSeconds + onlineSessionSeconds;
      setAccumulatedOnlineSeconds(newAccumulatedOnline);
      console.log(`Going offline - accumulated ${onlineSessionSeconds}s online time (total: ${newAccumulatedOnline}s)`);
      setOnlineStartTime(null);
      setOfflineStartTime(now);
    } else if (!isOnline && offlineStartTime && newStatus) {
      // Was offline, now going online - accumulate offline time
      const offlineSessionSeconds = Math.floor((now.getTime() - offlineStartTime.getTime()) / 1000);
      const newAccumulatedOffline = accumulatedOfflineSeconds + offlineSessionSeconds;
      setAccumulatedOfflineSeconds(newAccumulatedOffline);
      console.log(`Going online - accumulated ${offlineSessionSeconds}s offline time (total: ${newAccumulatedOffline}s)`);
      setOfflineStartTime(null);
      setOnlineStartTime(now);
    } else if (newStatus && !onlineStartTime) {
      // Starting online timer for first time or after reset
      setOnlineStartTime(now);
      console.log('Starting online timer for first time');
    } else if (!newStatus && !offlineStartTime) {
      // Starting offline timer for first time
      setOfflineStartTime(now);
      console.log('Starting offline timer for first time');
    }

    // Call API to update status
    const token = localStorage.getItem('token');
    const response = await fetch('https://testing.staffly.space/attendance/online-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        attendance_id: parseInt(currentAttendance.id),
        is_online: newStatus,
        reason: reason || null,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to update status');
    }

    // Update state after successful API call
    setIsOnline(newStatus);
    setLastStatusChangeTime(now);

    console.log(`Status changed successfully: ${newStatus ? 'Online' : 'Offline'} at ${now.toLocaleTimeString()}`);
  };

  const fetchWorkingHours = async () => {
    if (!currentAttendance?.id) return;

    // Skip backend sync during fresh check-in period (first 5 minutes)
    if (isFreshCheckIn && checkInTime) {
      const now = new Date();
      const timeSinceCheckIn = (now.getTime() - checkInTime.getTime()) / 1000; // seconds

      if (timeSinceCheckIn < 5 * 60) { // Less than 5 minutes
        console.log(`Skipping backend sync - fresh check-in (${Math.floor(timeSinceCheckIn)}s since check-in)`);
        return;
      }
    }

    try {
      const data = await apiService.getWorkingHours(parseInt(currentAttendance.id));

      if (data) {
        // Fetch correct values from backend
        // The backend should return:
        // - total_online_seconds: Total accumulated online time (paused when offline)
        // - total_offline_seconds: Total accumulated offline time (paused when online)
        // - is_currently_online: Current online status
        const backendOnlineSeconds = data.total_online_seconds || data.total_seconds || 0;
        const backendOfflineSeconds = data.total_offline_seconds || 0;
        const backendIsOnline = data.is_currently_online !== undefined ? data.is_currently_online : isOnline;

        if (backendOnlineSeconds < 60 && isFreshCheckIn) {
          console.log('Skipping sync - no meaningful backend activity yet');
          return;
        }

        // For fresh check-ins, calculate elapsed time from check-in instead of using backend total
        // This ensures we start from 0 hrs - 0 mins at check-in time
        let effectiveOnlineSeconds = backendOnlineSeconds;
        let effectiveOfflineSeconds = backendOfflineSeconds;

        if (isFreshCheckIn && checkInTime) {
          const now = new Date();
          const timeSinceCheckIn = (now.getTime() - checkInTime.getTime()) / 1000; // seconds

          // For fresh check-in, use elapsed time since check-in as the source of truth
          if (isOnline) {
            // If currently online, use time since check-in
            effectiveOnlineSeconds = timeSinceCheckIn;
            effectiveOfflineSeconds = 0;
            console.log(`Fresh check-in sync: Using elapsed time (${Math.floor(timeSinceCheckIn)}s) instead of backend value (${backendOnlineSeconds}s)`);
          } else {
            // If currently offline, backend offline time is valid, but online time should be from check-in to first offline
            effectiveOnlineSeconds = Math.max(0, timeSinceCheckIn - backendOfflineSeconds);
            console.log(`Fresh check-in sync (offline): Online=${Math.floor(effectiveOnlineSeconds)}s, Offline=${backendOfflineSeconds}s`);
          }
        }

        // Sync backend data with our local timer state
        // The backend now properly tracks pause/resume from logout/login
        const now = new Date();

        // Update accumulated times to match backend's pause/resume calculations
        if (isOnline && onlineStartTime) {
          // Currently online - set accumulated to effective value minus current session
          const currentSessionSeconds = Math.floor((now.getTime() - onlineStartTime.getTime()) / 1000);
          // Ensure we don't get negative values due to timezone or timing issues
          const calculatedAccumulated = Math.max(0, effectiveOnlineSeconds - currentSessionSeconds);
          setAccumulatedOnlineSeconds(calculatedAccumulated);

          console.log(`Online sync: Effective=${effectiveOnlineSeconds}s, CurrentSession=${currentSessionSeconds}s, Accumulated=${calculatedAccumulated}s`);
        } else {
          // Currently offline - set accumulated to effective value
          setAccumulatedOnlineSeconds(effectiveOnlineSeconds);
          console.log(`Online sync (offline): Effective=${effectiveOnlineSeconds}s, Accumulated=${effectiveOnlineSeconds}s`);
        }

        if (!isOnline && offlineStartTime) {
          // Currently offline - set accumulated to effective value minus current session
          const currentSessionSeconds = Math.floor((now.getTime() - offlineStartTime.getTime()) / 1000);
          // Ensure we don't get negative values due to timezone or timing issues
          const calculatedAccumulated = Math.max(0, effectiveOfflineSeconds - currentSessionSeconds);
          setAccumulatedOfflineSeconds(calculatedAccumulated);

          console.log(`Offline sync: Effective=${effectiveOfflineSeconds}s, CurrentSession=${currentSessionSeconds}s, Accumulated=${calculatedAccumulated}s`);
        } else {
          // Currently online - set accumulated to effective value
          setAccumulatedOfflineSeconds(effectiveOfflineSeconds);
          console.log(`Offline sync (online): Effective=${effectiveOfflineSeconds}s, Accumulated=${effectiveOfflineSeconds}s`);
        }

        console.log(`Synced with backend - Online: ${effectiveOnlineSeconds}s, Offline: ${effectiveOfflineSeconds}s (fresh check-in aware)`);

      } else {
        console.log('Backend sync failed, using local timer state');
      }
    } catch (error) {
      console.error('Failed to fetch working hours:', error);
    }
  };

  // Fetch user's current online status (preserves status across login/logout with pause/resume)
  const fetchUserOnlineStatus = async () => {
    if (!user?.id || hasLoadedOnlineStatus) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://testing.staffly.space/attendance/user-online-status/${user.id}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Only update online status if user is currently checked in and not checked out
        if (data.is_checked_in && !data.checked_out) {
          const wasOnline = data.is_online;
          setIsOnline(wasOnline);

          // Use the actual last status change time from backend, not current time
          const lastStatusChangeTime = new Date(data.last_status_change);
          const now = new Date();

          // Debug logging for timezone issues
          console.log(`🔍 Resume Debug Info:`);
          console.log(`   Backend last_status_change: ${data.last_status_change}`);
          console.log(`   Parsed as Date: ${lastStatusChangeTime.toISOString()}`);
          console.log(`   Local time: ${lastStatusChangeTime.toLocaleString()}`);
          console.log(`   Current time: ${now.toISOString()}`);
          console.log(`   Time difference: ${(now.getTime() - lastStatusChangeTime.getTime()) / 1000}s`);

          if (wasOnline) {
            // User was online when they logged back in - resume online timer from last status change
            setOnlineStartTime(lastStatusChangeTime);
            setOfflineStartTime(null);
            console.log(`User online status preserved: Online (timer resumed from ${lastStatusChangeTime.toLocaleTimeString()})`);
          } else {
            // User was offline when they logged back in - resume offline timer from last status change
            setOnlineStartTime(null);
            setOfflineStartTime(lastStatusChangeTime);
            console.log(`User online status preserved: Offline (timer resumed from ${lastStatusChangeTime.toLocaleTimeString()})`);
          }

          setLastStatusChangeTime(lastStatusChangeTime);

          // Force a backend sync to get accurate accumulated times
          // Don't rely on local calculations when resuming from logout
          setAccumulatedOnlineSeconds(0);
          setAccumulatedOfflineSeconds(0);

        } else {
          // If not checked in, set to offline
          setIsOnline(false);
          setOnlineStartTime(null);
          setOfflineStartTime(null);
          console.log('User not checked in, setting status to offline');
        }
        setHasLoadedOnlineStatus(true);
      }
    } catch (error) {
      console.error('Failed to fetch user online status:', error);
      // Default to offline if we can't fetch status
      setIsOnline(false);
      setOnlineStartTime(null);
      setOfflineStartTime(null);
      setHasLoadedOnlineStatus(true);
    }
  };

  // Fetch working hours periodically when checked in
  useEffect(() => {
    if (currentAttendance && !currentAttendance.checkOutTime) {
      fetchWorkingHours();
      const interval = setInterval(fetchWorkingHours, 10000); // Update every 10 seconds for responsive tracking
      return () => clearInterval(interval);
    }
  }, [currentAttendance]);

  // Real-time timer updates
  useEffect(() => {
    let interval: any;

    interval = setInterval(() => {
      const now = new Date();

      if (isOnline && onlineStartTime) {
        // Update online time display - current session + accumulated
        const currentOnlineSeconds = Math.floor((now.getTime() - onlineStartTime.getTime()) / 1000);
        const totalOnlineSeconds = accumulatedOnlineSeconds + currentOnlineSeconds;
        const onlineDisplay = formatTimeDisplay(totalOnlineSeconds);
        setOnlineWorkingHours(onlineDisplay);
        setWorkingHours(onlineDisplay); // Main working hours shows online time

        // When online, show only accumulated offline time (current session is 0)
        const offlineDisplay = formatTimeDisplay(accumulatedOfflineSeconds);
        setTotalOfflineTime(offlineDisplay);
        setCurrentSessionOfflineTime('0:00:00');

        console.log(`Timer Update (Online): Online=${onlineDisplay}, Offline=${offlineDisplay}`);
      } else if (!isOnline && offlineStartTime) {
        // Update offline time displays - current session + accumulated
        const currentOfflineSeconds = Math.floor((now.getTime() - offlineStartTime.getTime()) / 1000);
        const totalOfflineSeconds = accumulatedOfflineSeconds + currentOfflineSeconds;
        const offlineDisplay = formatTimeDisplay(totalOfflineSeconds);
        setTotalOfflineTime(offlineDisplay);

        // Current session offline time in H:MM:SS format
        const hours = Math.floor(currentOfflineSeconds / 3600);
        const minutes = Math.floor((currentOfflineSeconds % 3600) / 60);
        const seconds = currentOfflineSeconds % 60;
        setCurrentSessionOfflineTime(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

        // When offline, online time remains at accumulated value (no current session)
        const onlineDisplay = formatTimeDisplay(accumulatedOnlineSeconds);
        setOnlineWorkingHours(onlineDisplay);
        setWorkingHours(onlineDisplay); // Main working hours shows accumulated online time only

        console.log(`Timer Update (Offline): Online=${onlineDisplay}, Offline=${offlineDisplay}, Current Session=${currentOfflineSeconds}s`);
      } else {
        // If neither online nor offline timer is running, maintain current values
        const onlineDisplay = formatTimeDisplay(accumulatedOnlineSeconds);
        const offlineDisplay = formatTimeDisplay(accumulatedOfflineSeconds);
        setOnlineWorkingHours(onlineDisplay);
        setWorkingHours(onlineDisplay);
        setTotalOfflineTime(offlineDisplay);
        setCurrentSessionOfflineTime('0:00:00');
      }
    }, 1000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnline, onlineStartTime, offlineStartTime, accumulatedOnlineSeconds, accumulatedOfflineSeconds]);

  // Fetch user's online status when they have an active attendance record
  useEffect(() => {
    if (currentAttendance && !currentAttendance.checkOutTime && !hasLoadedOnlineStatus) {
      fetchUserOnlineStatus();
    }
  }, [currentAttendance, hasLoadedOnlineStatus]);

  // Fetch online status for all employees (for admin/hr/manager view)
  const fetchAllOnlineStatus = useCallback(async () => {
    if (!canViewEmployeeAttendance) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://testing.staffly.space/attendance/current-online-status', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Convert to simple map of user_id -> is_online
        const statusMap: Record<number, boolean> = {};
        Object.keys(data).forEach(userId => {
          statusMap[parseInt(userId)] = data[userId].is_online;
        });
        setOnlineStatusMap(statusMap);
      }
    } catch (error) {
      console.error('Failed to fetch online status:', error);
    }
  }, [canViewEmployeeAttendance]);

  // Fetch online status periodically when viewing employee attendance
  useEffect(() => {
    if (viewMode === 'employee' && canViewEmployeeAttendance) {
      fetchAllOnlineStatus();
      const interval = setInterval(fetchAllOnlineStatus, 15000); // Update every 15 seconds
      return () => clearInterval(interval);
    }
  }, [viewMode, canViewEmployeeAttendance, fetchAllOnlineStatus]);

  // Fetch all users' online status (for Admin, HR, Manager viewing employee attendance)
  const fetchAllUsersOnlineStatus = useCallback(async () => {
    if (!canViewEmployeeAttendance) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://testing.staffly.space/attendance/current-online-status', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const statusMap: Record<string, boolean> = {};
        Object.keys(data).forEach(userId => {
          statusMap[userId] = data[userId].is_online;
        });
        setAllUsersOnlineStatus(statusMap);
      }
    } catch (error) {
      console.error('Failed to fetch online status:', error);
    }
  }, [canViewEmployeeAttendance]);

  // Fetch online status periodically when viewing employee attendance
  useEffect(() => {
    if (viewMode === 'employee' && canViewEmployeeAttendance) {
      fetchAllUsersOnlineStatus();
      const interval = setInterval(fetchAllUsersOnlineStatus, 15000); // Update every 15 seconds
      return () => clearInterval(interval);
    }
  }, [viewMode, canViewEmployeeAttendance, fetchAllUsersOnlineStatus]);

  const getStatusBadge = (status: string, checkInTime?: string, checkOutTime?: string) => {
    const checkInT = checkInTime && (checkInTime.includes(' ') || checkInTime.includes('T')) ? (checkInTime.includes('T') ? checkInTime.split('T')[1].substring(0, 8) : checkInTime.split(' ')[1].substring(0, 8)) : checkInTime;
    const checkOutT = checkOutTime && (checkOutTime.includes(' ') || checkOutTime.includes('T')) ? (checkOutTime.includes('T') ? checkOutTime.split('T')[1].substring(0, 8) : checkOutTime.split(' ')[1].substring(0, 8)) : checkOutTime;

    // Check if check-in was late
    const isCheckInLate = status === 'late' || (checkInT && checkInT > '09:30:00');

    // If check-in was late, always show "Late" badge regardless of check-out time
    if (isCheckInLate) {
      return <Badge variant="destructive">Late</Badge>;
    }

    // For check-out badge: if check-out time is provided, check if it's early
    if (checkOutT && checkOutT < '18:00:00') {
      return <Badge variant="outline" className="border-orange-500 text-orange-500">Early</Badge>;
    }

    // If check-out time is provided and it's not early, show nothing (on-time check-out)
    if (checkOutTime) {
      return null;
    }

    if (status === 'absent') {
      return <Badge variant="destructive">Absent</Badge>;
    }

    // If check-in was on time and no early check-out, show "On Time"
    if (status === 'present') {
      return <Badge variant="default" className="bg-green-500">On Time</Badge>;
    }

    return null;
  };

  // Midnight refresh logic - ensures the page resets for a new day if left open
  useEffect(() => {
    const checkMidnight = setInterval(() => {
      const now = new Date();
      // Check if it's precisely midnight (first minute of the day)
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        console.log('Midnight detected, refreshing attendance for new day...');
        loadFromBackend();
        if (viewMode === 'employee' && canViewEmployeeAttendance) {
          loadEmployeeAttendance();
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkMidnight);
  }, [viewMode, canViewEmployeeAttendance]);

  // Helper function to get online status for display in employee attendance table
  const getOnlineStatusForEmployeeDisplay = (record: EmployeeAttendanceRecord): { isOnline: boolean; label: string; showAbsent: boolean } => {
    const today = todayIST();
    const recordDate = record.date;
    const checkInTime = record.checkInTime;
    const checkOutTime = record.checkOutTime;

    // If no check-in, show as absent
    if (!checkInTime) {
      return { isOnline: false, label: 'Absent', showAbsent: true };
    }

    // If record date is today
    if (recordDate === today) {
      if (checkOutTime) {
        // Checked out today - show as checked out
        return { isOnline: false, label: 'Checked Out', showAbsent: false };
      } else {
        // Not checked out - show online status from map
        const isOnline = onlineStatusMap[parseInt(record.userId)] ?? true;
        return { isOnline, label: isOnline ? 'Online' : 'Offline', showAbsent: false };
      }
    }

    // If record date is before today (past date)
    const recordDateObj = new Date(recordDate);
    const todayDateObj = new Date(today);

    if (recordDateObj < todayDateObj) {
      if (!checkOutTime) {
        // Forgotten checkout - show as absent
        return { isOnline: false, label: 'Absent', showAbsent: true };
      } else {
        // Checked out on past date - show as checked out
        return { isOnline: false, label: 'Checked Out', showAbsent: false };
      }
    }

    // Default: show online status
    const isOnline = onlineStatusMap[parseInt(record.userId)] ?? false;
    return { isOnline, label: isOnline ? 'Online' : 'Offline', showAbsent: false };
  };

  const formatAttendanceTime = (dateString: string, timeString?: string) => {
    if (!timeString) return '-';
    return formatDateTimeComponentsIST(dateString, timeString, 'hh:mm a');
  };

  if (showCamera) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {isCheckingIn ? t.attendance.checkIn : t.attendance.checkOut}
          </h2>
        </div>
        <AttendanceCamera
          onCapture={handleCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
        {isLoading && (
          <div className="text-center">
            <p className="text-muted-foreground animate-pulse">Recognizing face...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border shadow-sm mt-1">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-purple-500/5 rounded-full blur-3xl" />

          <div className="relative flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-black">
                Attendance <span className="text-black">Management</span>
              </h1>
              <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-indigo-500" />
                {formatDateIST(new Date(), 'EEEE, dd MMM yyyy')}
              </p>
            </div>
          </div>

          {canExportAttendance && (
            <div className="relative z-10">
              <Button
                size="lg"
                className="rounded-xl px-6 h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 gap-2"
                onClick={() => openExportModal()}
                disabled={isExporting}
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export Report'}
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-center w-full">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'self' | 'employee' | 'wfh' | 'wfh_requests')} className="w-full sm:w-auto">
            <TabsList className={`grid ${canViewEmployeeAttendance ? 'grid-cols-4' : 'grid-cols-2'} h-12 w-full ${canViewEmployeeAttendance ? 'sm:w-[1100px]' : 'sm:w-[1000px]'} bg-[#f8faff] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full p-1 shadow-sm`}>
              <TabsTrigger
                value="self"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2b59ff] data-[state=active]:to-[#5c51ff] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-700 transition-all duration-300 rounded-full h-full text-sm font-medium"
              >
                Self Attendance
              </TabsTrigger>
              {canViewEmployeeAttendance && (
                <TabsTrigger
                  value="employee"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2b59ff] data-[state=active]:to-[#5c51ff] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-700 transition-all duration-300 rounded-full h-full text-sm font-medium"
                >
                  Employee Attendance
                </TabsTrigger>
              )}
              <TabsTrigger
                value="wfh"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2b59ff] data-[state=active]:to-[#5c51ff] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-700 transition-all duration-300 rounded-full h-full text-sm font-medium"
              >
                Apply WFH
              </TabsTrigger>
              {canViewEmployeeAttendance && (
                <TabsTrigger
                  value="wfh_requests"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2b59ff] data-[state=active]:to-[#5c51ff] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-700 transition-all duration-300 rounded-full h-full text-sm font-medium relative"
                >
                  WFH Requests
                  {getPendingWfhCount() > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white border border-white dark:border-gray-800"
                    >
                      {getPendingWfhCount()}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      </div>



      {viewMode === 'self' ? (
        <>
          {/* Self Attendance View */}
          <Card>
            <CardHeader>
              <CardTitle>{t.attendance.todayStatus}</CardTitle>
              <CardDescription>Your attendance status for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isGettingFastLocation ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Getting location...</span>
                  </div>
                ) : location ? (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <span className="flex-1">{location.address}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>Location not available</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentAttendance ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <LogIn className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Check-in Time</span>
                          {getStatusBadge(currentAttendance.status, currentAttendance.checkInTime, currentAttendance.checkOutTime)}
                          {currentAttendance.workLocation === 'work_from_home' ? (
                            <Badge variant="outline" className="bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                              <Home className="h-3 w-3 mr-1" />
                              Work From Home
                            </Badge>
                          ) : currentAttendance.workLocation === 'office' ? (
                            <Badge variant="outline" className="bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              <MapPin className="h-3 w-3 mr-1" />
                              Work From Office
                            </Badge>
                          ) : (
                            // Fallback: check WFH status if workLocation is not set
                            getTodayWfhStatus()?.hasApprovedWfh ? (
                              <Badge variant="outline" className="bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                <Home className="h-3 w-3 mr-1" />
                                Work From Home
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                <MapPin className="h-3 w-3 mr-1" />
                                Work From Office
                              </Badge>
                            )
                          )}
                        </div>
                        <p className="text-lg font-semibold">
                          {formatAttendanceTime(currentAttendance.date, currentAttendance.checkInTime)}
                        </p>
                        {currentAttendance.workLocation === 'work_from_home' || (currentAttendance.workLocation !== 'office' && getTodayWfhStatus()?.hasApprovedWfh) ? (
                          <p className="text-xs text-orange-600 dark:text-orange-400">
                            Working from home today
                          </p>
                        ) : (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Working from office today
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <LogOut className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium">Check-out Time</span>
                          {(() => {
                            const checkOutT = currentAttendance.checkOutTime && (currentAttendance.checkOutTime.includes(' ') || currentAttendance.checkOutTime.includes('T')) ? (currentAttendance.checkOutTime.includes('T') ? currentAttendance.checkOutTime.split('T')[1].substring(0, 8) : currentAttendance.checkOutTime.split(' ')[1].substring(0, 8)) : currentAttendance.checkOutTime;
                            return checkOutT && checkOutT < '18:00:00' && (
                              <Badge variant="outline" className="border-orange-500 text-orange-500">Early</Badge>
                            );
                          })()}
                        </div>
                        <p className="text-lg font-semibold">
                          {currentAttendance.checkOutTime
                            ? formatAttendanceTime(currentAttendance.date, currentAttendance.checkOutTime)
                            : '-'}
                        </p>
                      </div>

                      <div className="col-span-2 space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">Total Work Hours</span>
                          </div>
                          <p className="text-lg font-semibold">
                            {currentAttendance.checkOutTime
                              ? formatWorkHours(currentAttendance.workHours || 0)
                              : workingHours}
                          </p>
                        </div>

                        {/* Show online status indicator when checked in */}
                        {!currentAttendance.checkOutTime && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-green-700 dark:text-green-300">Live tracking - updates in real-time</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Not checked in yet</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  {!currentAttendance ? (
                    <Button onClick={handleCheckIn} size="lg" className="flex-1">
                      <LogIn className="h-5 w-5 mr-2" />
                      {t.attendance.checkIn}
                    </Button>
                  ) : !currentAttendance.checkOutTime ? (
                    <Button onClick={handleCheckOut} size="lg" variant="destructive" className="flex-1">
                      <LogOut className="h-5 w-5 mr-2" />
                      {t.attendance.checkOut}
                    </Button>
                  ) : (
                    <div className="flex-1 text-center">
                      <Badge variant="outline" className="px-4 py-2">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Attendance Completed for Today
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Online/Offline Status Toggle */}
          {currentAttendance && !currentAttendance.checkOutTime && (
            <OnlineStatusToggle
              isOnline={isOnline}
              onStatusChange={handleOnlineStatusChange}
              workingHours={onlineWorkingHours}
              totalOfflineTime={totalOfflineTime}
              currentSessionOfflineTime={currentSessionOfflineTime}
              isVisible={true}
              attendanceId={currentAttendance?.id ? parseInt(currentAttendance.id) : undefined}
              userId={user?.id ? parseInt(user.id) : undefined}
            />
          )}

          {/* Attendance History */}
          <Card>
            <CardHeader>
              <CardTitle>{t.attendance.history}</CardTitle>
              <CardDescription>Your recent attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Quick Filters</Label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant={historyQuickFilter === 'today' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setHistoryQuickFilter('today')}
                        className={historyQuickFilter === 'today' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                      >
                        Today
                      </Button>
                      <Button
                        variant={historyQuickFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setHistoryQuickFilter('all')}
                        className={historyQuickFilter === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                      >
                        All
                      </Button>
                      <Button
                        variant={historyQuickFilter === 'date' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setHistoryQuickFilter('date')}
                        className={historyQuickFilter === 'date' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                      >
                        Date
                      </Button>

                      {historyQuickFilter === 'date' && (
                        <div className="flex flex-col sm:flex-row items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                          <DatePicker
                            date={historyCustomDateRange.startDate || undefined}
                            onDateChange={(date) => setHistoryCustomDateRange({ ...historyCustomDateRange, startDate: date || null })}
                            placeholder="From Date"
                            className="w-[160px] h-10 border-2 border-slate-200 dark:border-slate-800 rounded-xl"
                          />
                          <DatePicker
                            date={historyCustomDateRange.endDate || undefined}
                            onDateChange={(date) => setHistoryCustomDateRange({ ...historyCustomDateRange, endDate: date || null })}
                            placeholder="To Date"
                            fromDate={historyCustomDateRange.startDate || undefined}
                            className="w-[160px] h-10 border-2 border-slate-200 dark:border-slate-800 rounded-xl"
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                      Showing {getFilteredAttendanceHistory().length} records
                    </div>
                  </div>
                </div>

                {attendanceHistory.length > 0 ? (
                  <>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden w-full">
                      <div className="w-full overflow-x-auto">
                        <table className="w-full table-auto min-w-[1800px]" style={{ tableLayout: 'auto' }}>
                          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.department}</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">Work Location</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">Online Status</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.checkInTime}</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.checkOutTime}</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.hours}</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.location}</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.selfiePhoto}</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.common.status}</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.workSummary}</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.workReport}</th>
                              <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">Overdue Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredAttendanceHistory()
                              .slice((selfCurrentPage - 1) * selfItemsPerPage, (selfCurrentPage - 1) * selfItemsPerPage + selfItemsPerPage)
                              .map((record) => (
                                <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                                  <td className="p-3 whitespace-nowrap">
                                    <Badge variant="outline" className="text-xs">{user?.department || '-'}</Badge>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    {record.workLocation === 'work_from_home' ? (
                                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500"></div>
                                        <span className="text-xs font-medium text-orange-700 dark:text-orange-300">WFH</span>
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                        <div className="h-1.5 w-1.5 rounded-sm bg-blue-500"></div>
                                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Office</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    {(() => {
                                      if (!record.checkOutTime && record.date === todayIST()) {
                                        return (
                                          <OnlineStatusIndicator
                                            isOnline={isOnline}
                                            size="sm"
                                            showLabel={true}
                                          />
                                        );
                                      } else if (record.checkOutTime) {
                                        return <span className="text-xs text-slate-500 dark:text-slate-400">Checked Out</span>;
                                      } else {
                                        return <span className="text-xs text-slate-500 dark:text-slate-400">Past Date</span>;
                                      }
                                    })()}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatAttendanceTime(record.date, record.checkInTime)}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatAttendanceTime(record.date, record.checkOutTime)}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    {record.workHours ? (
                                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatWorkHours(record.workHours)}</span>
                                    ) : (
                                      <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                                    )}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    {record.checkInLocation?.address && record.checkInLocation.address !== 'N/A' ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedLocation({
                                            checkIn: record.checkInLocation?.address,
                                            checkOut: record.checkOutLocation?.address
                                          });
                                          setShowLocationDialog(true);
                                        }}
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 h-7 px-2 text-xs"
                                      >
                                        <MapPin className="h-3 w-3 mr-1" />
                                        View
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                                    )}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <div
                                      className="h-8 w-8 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity mx-auto"
                                      onClick={() => {
                                        setSelectedRecord(record);
                                        setShowSelfieModal(true);
                                      }}
                                    >
                                      {record.checkInSelfie ? (
                                        <img
                                          src={record.checkInSelfie.startsWith('http') ? record.checkInSelfie : `${import.meta.env.VITE_API_BASE_URL || 'https://testing.staffly.space'}${record.checkInSelfie}`}
                                          alt={`${user?.name || 'Employee'}'s selfie`}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            const target = e.currentTarget as HTMLImageElement;
                                            target.style.display = 'none';
                                            const fallback = document.createElement('div');
                                            fallback.className = 'w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center';
                                            fallback.innerHTML = '<svg class="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>';
                                            target.parentNode?.appendChild(fallback);
                                          }}
                                        />
                                      ) : null}
                                      {!record.checkInSelfie && (
                                        <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                          <User className="h-4 w-4 text-gray-400" />
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <div className="flex justify-center">
                                      {getStatusBadge(record.status, record.checkInTime, record.checkOutTime)}
                                    </div>
                                  </td>
                                  <td className="p-3 text-xs text-slate-600 dark:text-slate-400 max-w-[280px]">
                                    {record.workSummary ? (
                                      <button
                                        type="button"
                                        className="text-left hover:text-blue-600 dark:hover:text-blue-400 block w-full text-xs leading-relaxed"
                                        onClick={() => {
                                          setSelectedWorkSummary(record.workSummary || '');
                                          setSelectedOverdueReason('');
                                          setShowWorkSummaryDialog(true);
                                        }}
                                        title={record.workSummary}
                                        style={{
                                          wordBreak: 'break-word',
                                          overflowWrap: 'break-word',
                                          display: 'block',
                                          textAlign: 'left'
                                        }}
                                      >
                                        <span style={{
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                        }}>
                                          {record.workSummary}
                                        </span>
                                        {record.workSummary.length > 60 && (
                                          <span className="text-blue-600 dark:text-blue-400 font-medium mt-1 block">View more...</span>
                                        )}
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-500">—</span>
                                    )}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    {record.workReport ? (
                                      <a
                                        href={record.workReport}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        {t.attendance.viewReport || 'View'}
                                      </a>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-xs text-slate-600 dark:text-slate-400 max-w-[280px]">
                                    {record.taskDeadlineReason ? (
                                      <button
                                        type="button"
                                        className="text-left hover:text-blue-600 dark:hover:text-blue-400 block w-full text-xs leading-relaxed"
                                        onClick={() => {
                                          setSelectedOverdueReason(record.taskDeadlineReason || '');
                                          setShowWorkSummaryDialog(true);
                                        }}
                                        title={record.taskDeadlineReason}
                                        style={{
                                          wordBreak: 'break-word',
                                          overflowWrap: 'break-word',
                                          display: 'block',
                                          textAlign: 'left'
                                        }}
                                      >
                                        <span style={{
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                        }}>
                                          {record.taskDeadlineReason}
                                        </span>
                                        {record.taskDeadlineReason.length > 60 && (
                                          <span className="text-blue-600 dark:text-blue-400 font-medium mt-1 block">View more...</span>
                                        )}
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-500">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {getFilteredAttendanceHistory().length > 0 && (
                      <div className="mt-6">
                        <Pagination
                          currentPage={selfCurrentPage}
                          totalPages={Math.ceil(getFilteredAttendanceHistory().length / selfItemsPerPage)}
                          totalItems={getFilteredAttendanceHistory().length}
                          itemsPerPage={selfItemsPerPage}
                          onPageChange={setSelfCurrentPage}
                          onItemsPerPageChange={setSelfItemsPerPage}
                          showItemsPerPage={true}
                        />
                      </div>
                    )}
                  </>

                ) : (
                  <p className="text-center py-8 text-muted-foreground">No attendance history</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : viewMode === 'employee' ? (
        <>
          {/* Employee Attendance View */}
          <Card className="border-slate-200/60 border shadow-sm bg-white rounded-xl overflow-hidden w-full">
            <CardHeader className="border-b border-slate-100 bg-slate-50/30 px-5 py-4">
              <CardTitle className="text-sm font-bold text-slate-900">{t.attendance.employeeAttendance}</CardTitle>
              <CardDescription className="text-[11px] font-medium">{t.attendance.viewAndManage}</CardDescription>
            </CardHeader>
            <CardContent className="w-full">
              <div className="flex flex-col md:flex-row md:flex-wrap items-end gap-3 mb-6">
                <div className="flex flex-col gap-2 w-full md:w-[240px] lg:w-[400px]">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t.attendance.searchPlaceholder || "Search by name, email, or employee ID"}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                      className="pl-10 h-11 bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</Label>
                  <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                    <SelectTrigger className="w-[160px] h-11 bg-white dark:bg-gray-950 border-2 border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-400 focus:ring-blue-500/20 transition-all duration-300">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-blue-500" />
                        <SelectValue placeholder="Status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="early">Early Departure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Time Period</Label>
                  <Select
                    value={timePeriodFilter || 'today'}
                    onValueChange={(value: any) => {
                      setTimePeriodFilter(value);
                    }}
                  >
                    <SelectTrigger className="w-[190px] h-11 bg-white dark:bg-gray-950 border-2 border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-400 focus:ring-blue-500/20 transition-all duration-300">
                      <Calendar className="h-4 w-4 text-blue-500 mr-2" />
                      <SelectValue placeholder="Time Period" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl">
                      <SelectItem value="today" className="rounded-lg">Today</SelectItem>
                      <SelectItem value="current_month" className="rounded-lg">Current Month</SelectItem>
                      <SelectItem value="last_month" className="rounded-lg">Last Month</SelectItem>
                      <SelectItem value="last_3_months" className="rounded-lg">Last 3 Months</SelectItem>
                      <SelectItem value="last_6_months" className="rounded-lg">Last 6 Months</SelectItem>
                      <SelectItem value="last_12_months" className="rounded-lg">Last 1 Year</SelectItem>
                      <SelectItem value="custom" className="rounded-lg">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
              {timePeriodFilter === 'custom' && (
                <div className="flex flex-col sm:flex-row items-end gap-3 mb-6 animate-in fade-in slide-in-from-left-2 duration-300 w-full">
                  <div className="flex flex-col gap-2 w-full sm:flex-1">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">From Date</Label>
                    <Input
                      type="date"
                      value={customStartDate ? format(customStartDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m, d] = e.target.value.split('-').map(Number);
                          setCustomStartDate(new Date(y, m - 1, d));
                        } else {
                          setCustomStartDate(undefined);
                        }
                      }}
                      max={getTodayISTDate ? format(getTodayISTDate(), 'yyyy-MM-dd') : undefined}
                      className="h-11 border-2 focus:ring-2 focus:ring-violet-500 transition-all w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-2 w-full sm:flex-1">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">To Date</Label>
                    <Input
                      type="date"
                      value={customEndDate ? format(customEndDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m, d] = e.target.value.split('-').map(Number);
                          setCustomEndDate(new Date(y, m - 1, d));
                        } else {
                          setCustomEndDate(undefined);
                        }
                      }}
                      min={customStartDate ? format(customStartDate, 'yyyy-MM-dd') : undefined}
                      max={getTodayISTDate ? format(getTodayISTDate(), 'yyyy-MM-dd') : undefined}
                      className="h-11 border-2 focus:ring-2 focus:ring-violet-500 transition-all w-full"
                    />
                  </div>
                </div>
              )}

              {timePeriodFilter === 'custom' && customStartDate && customEndDate && isAfter(customStartDate, customEndDate) && (
                <p className="text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/30 p-2 rounded-md border border-red-200 dark:border-red-800 mb-4">
                  "From Date" cannot be after "To Date". Please select a valid range.
                </p>
              )}

              {/* Simple Table List View */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden w-full">
                <div className="w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]">
                  <table className="w-full table-auto min-w-[1800px]" style={{ tableLayout: 'auto' }}>
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
                      <tr>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">{t.attendance.employee}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.department}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">Work Location</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">Online Status</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.checkInTime}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.checkOutTime}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.hours}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.location}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.selfiePhoto}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.common.status}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.workSummary}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.attendance.workReport}</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">Overdue Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployeeAttendanceData.length > 0 ? (
                        filteredEmployeeAttendanceData
                          .slice((currentPage - 1) * itemsPerPage, (currentPage - 1) * itemsPerPage + itemsPerPage)
                          .map((record) => (
                            <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                              <td className="p-3 sticky left-0 z-10 bg-white dark:bg-slate-950 border-r border-slate-100 dark:border-slate-800">
                                <div className="min-w-[150px]">
                                  <p className="font-medium text-sm text-slate-900 dark:text-white truncate" title={record.name || '-'}>{record.name || '-'}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDateIST(record.date, 'dd MMM yyyy')}
                                  </p>
                                </div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <Badge variant="outline" className="text-xs">{record.department || '-'}</Badge>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                {record.workLocation === 'work_from_home' ? (
                                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                                    <div className="h-1.5 w-1.5 rounded-full bg-orange-500"></div>
                                    <span className="text-xs font-medium text-orange-700 dark:text-orange-300">WFH</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                    <div className="h-1.5 w-1.5 rounded-sm bg-blue-500"></div>
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Office</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                {(() => {
                                  const statusInfo = getOnlineStatusForEmployeeDisplay(record);
                                  if (statusInfo.showAbsent) {
                                    return (
                                      <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-0.5">
                                        Absent
                                      </Badge>
                                    );
                                  } else if (statusInfo.label === 'Checked Out') {
                                    return <span className="text-xs text-slate-500 dark:text-slate-400">Checked Out</span>;
                                  } else {
                                    return (
                                      <OnlineStatusIndicator
                                        isOnline={statusInfo.isOnline}
                                        size="sm"
                                        showLabel={true}
                                      />
                                    );
                                  }
                                })()}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                  <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatAttendanceTime(record.date, record.checkInTime)}</span>
                                </div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                  <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatAttendanceTime(record.date, record.checkOutTime)}</span>
                                </div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                {record.workHours ? (
                                  <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatWorkHours(record.workHours)}</span>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                {record.checkInLocation?.address && record.checkInLocation.address !== 'N/A' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedLocation({
                                        checkIn: record.checkInLocation?.address,
                                        checkOut: record.checkOutLocation?.address
                                      });
                                      setShowLocationDialog(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 h-7 px-2 text-xs"
                                  >
                                    <MapPin className="h-3 w-3 mr-1" />
                                    View
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div
                                  className="h-8 w-8 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity mx-auto"
                                  onClick={() => {
                                    setSelectedRecord(record);
                                    setShowSelfieModal(true);
                                  }}
                                >
                                  {record.checkInSelfie ? (
                                    <img
                                      src={record.checkInSelfie.startsWith('http') ? record.checkInSelfie : `${API_BASE_URL}${record.checkInSelfie}`}
                                      alt={`${record.name || 'Employee'}'s selfie`}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.currentTarget as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = document.createElement('div');
                                        fallback.className = 'w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center';
                                        fallback.innerHTML = '<svg class="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>';
                                        target.parentNode?.appendChild(fallback);
                                      }}
                                    />
                                  ) : null}
                                  {!record.checkInSelfie && (
                                    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                      <User className="h-4 w-4 text-gray-400" />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="flex justify-center">
                                  {getStatusBadge(record.status, record.checkInTime, record.checkOutTime)}
                                </div>
                              </td>
                              <td className="p-3 text-xs text-slate-600 dark:text-slate-400 max-w-[280px]">
                                {record.workSummary ? (
                                  <button
                                    type="button"
                                    className="text-left hover:text-blue-600 dark:hover:text-blue-400 block w-full text-xs leading-relaxed"
                                    onClick={() => {
                                      setSelectedWorkSummary(record.workSummary || '');
                                      setSelectedOverdueReason('');
                                      setShowWorkSummaryDialog(true);
                                    }}
                                    title={record.workSummary}
                                    style={{
                                      wordBreak: 'break-word',
                                      overflowWrap: 'break-word',
                                      display: 'block',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <span style={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      {record.workSummary}
                                    </span>
                                    {record.workSummary.length > 60 && (
                                      <span className="text-blue-600 dark:text-blue-400 font-medium mt-1 block">View more...</span>
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500">—</span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                {record.workReport ? (
                                  <a
                                    href={record.workReport}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    {t.attendance.viewReport || 'View'}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                                )}
                              </td>
                              <td className="p-3 text-xs text-slate-600 dark:text-slate-400 max-w-[280px]">
                                {record.taskDeadlineReason ? (
                                  <div className="text-left text-xs leading-relaxed" style={{
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word'
                                  }}>
                                    <span style={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      {record.taskDeadlineReason}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={13} className="h-64 text-center p-8">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <Search className="h-8 w-8 text-slate-400" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-lg font-semibold text-slate-900 dark:text-white">No records found</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters or date range</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredEmployeeAttendanceData.length > 0 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredEmployeeAttendanceData.length / itemsPerPage)}
                    totalItems={filteredEmployeeAttendanceData.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                    showItemsPerPage={true}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : viewMode === 'wfh_requests' ? (
        <>
          {/* Pending WFH Requests Section */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Pending WFH Requests
                {getPendingWfhCount() > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {getPendingWfhCount()}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Review and approve/reject pending work from home requests</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoadingWfhRequests ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                  <span className="ml-2 text-muted-foreground">Loading requests...</span>
                </div>
              ) : allWfhRequests.filter(req => req.status === 'pending').length > 0 ? (
                <>
                  <div className="space-y-3">
                    {allWfhRequests
                      .filter(req => req.status === 'pending')
                      .slice((pendingWfhCurrentPage - 1) * pendingWfhItemsPerPage, pendingWfhCurrentPage * pendingWfhItemsPerPage)
                      .map((request) => (
                        <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-blue-600" />
                                  <span className="font-medium">{request.submittedBy}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {formatRoleDisplay(request.role)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-green-600" />
                                  <span className="text-sm">
                                    {formatDateIST(request.startDate, 'dd MMM yyyy')} - {formatDateIST(request.endDate, 'dd MMM yyyy')}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {request.type === 'full_day' ? 'Full Day' : 'Half Day'}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground break-words overflow-wrap-anywhere whitespace-pre-wrap">{request.reason}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Submitted: {formatRelativeTime(request.submittedAt)} ({formatDateTimeIST(request.submittedAt, 'dd MMM yyyy, hh:mm a')})</span>
                                <span>Department: {request.department}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Badge variant="secondary">Pending</Badge>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                                  onClick={() => handleWfhRequestAction(request.id, 'approve')}
                                  disabled={isProcessingWfhRequest}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                  onClick={() => {
                                    setSelectedWfhRequest(request);
                                    setShowWfhRequestDialog(true);
                                  }}
                                  disabled={isProcessingWfhRequest}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {allWfhRequests.filter(req => req.status === 'pending').length > 0 && (
                    <div className="mt-4">
                      <Pagination
                        currentPage={pendingWfhCurrentPage}
                        totalPages={Math.ceil(allWfhRequests.filter(req => req.status === 'pending').length / pendingWfhItemsPerPage)}
                        totalItems={allWfhRequests.filter(req => req.status === 'pending').length}
                        itemsPerPage={pendingWfhItemsPerPage}
                        onPageChange={setPendingWfhCurrentPage}
                        onItemsPerPageChange={setPendingWfhItemsPerPage}
                        showItemsPerPage={true}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending WFH requests</p>
                  <p className="text-sm">All requests have been processed</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Decisions Section */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <History className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold">Recent Decisions</CardTitle>
                    <CardDescription>Approved and rejected WFH requests</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Filter Controls for Recent Decisions */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[150px]">
                      <Label htmlFor="decision-status-filter">Decision Status</Label>
                      <Select value={wfhRequestFilter} onValueChange={(value: any) => setWfhRequestFilter(value)}>
                        <SelectTrigger id="decision-status-filter" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Decisions</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <Label htmlFor="role-filter">Role</Label>
                      <Select value={wfhRoleFilter} onValueChange={(value: any) => setWfhRoleFilter(value)}>
                        <SelectTrigger id="role-filter" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          {user?.role === 'admin' && <SelectItem value="hr">HR</SelectItem>}
                          {(user?.role === 'admin' || user?.role === 'hr') && <SelectItem value="manager">Manager</SelectItem>}
                          <SelectItem value="team_lead">Team Lead</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <Label htmlFor="decision-time-filter">Duration</Label>
                      <Select value={wfhRequestTimeFilter} onValueChange={(value: any) => setWfhRequestTimeFilter(value)}>
                        <SelectTrigger id="decision-time-filter" className="mt-1">
                          <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                          <SelectValue placeholder="Filter by time">
                            {wfhRequestTimeFilter === 'custom' ? 'Custom Range' : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="current_month">Current Month</SelectItem>
                          <SelectItem value="last_month">Last Month</SelectItem>
                          <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                          <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                          <SelectItem value="last_year">Last 1 Year</SelectItem>
                          <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <Label>Summary</Label>
                      <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm flex items-center justify-between">
                        <span>{filteredRecentDecisions.length} of {allWfhRequests.filter(req => req.status !== 'pending').length} decisions</span>
                      </div>
                    </div>
                  </div>

                  {wfhRequestTimeFilter === 'custom' && (
                    <div className="flex flex-col sm:flex-row items-end gap-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="space-y-1 w-full sm:flex-1">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">From Date</Label>
                        <DatePicker
                          date={wfhRequestStartDate || undefined}
                          onDateChange={setWfhRequestStartDate}
                          placeholder="Select from date"
                          toDate={getTodayISTDate()}
                          className="border-2 border-slate-200 dark:border-slate-800 rounded-xl h-10 w-full"
                        />
                      </div>
                      <div className="self-center mb-3 text-muted-foreground hidden sm:block">to</div>
                      <div className="space-y-1 w-full sm:flex-1">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To Date</Label>
                        <DatePicker
                          date={wfhRequestEndDate || undefined}
                          onDateChange={setWfhRequestEndDate}
                          placeholder="Select to date"
                          toDate={getTodayISTDate()}
                          fromDate={wfhRequestStartDate || undefined}
                          className="border-2 border-slate-200 dark:border-slate-800 rounded-xl h-10 w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Decisions Table */}
                {isLoadingWfhRequests ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-muted-foreground">Loading decisions...</span>
                  </div>
                ) : filteredRecentDecisions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {filteredRecentDecisions
                        .slice((recentDecisionsCurrentPage - 1) * recentDecisionsItemsPerPage, recentDecisionsCurrentPage * recentDecisionsItemsPerPage)
                        .map((request) => (
                          <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-blue-600" />
                                    <span className="font-medium">{request.submittedBy}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {formatRoleDisplay(request.role)}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-green-600" />
                                    <span className="text-sm">
                                      {formatDateIST(request.startDate, 'dd MMM yyyy')} - {formatDateIST(request.endDate, 'dd MMM yyyy')}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {request.type === 'full_day' ? 'Full Day' : 'Half Day'}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground break-words overflow-wrap-anywhere whitespace-pre-wrap">{request.reason}</p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>Submitted: {formatDateTimeIST(request.submittedAt, 'dd MMM yyyy, hh:mm a')}</span>
                                  <span>Decision: {formatDateTimeIST(request.processedAt || request.submittedAt, 'dd MMM yyyy, hh:mm a')}</span>
                                  <span>Department: {request.department}</span>
                                </div>
                                {request.rejectionReason && (
                                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mt-2">
                                    <p className="text-sm text-red-800 dark:text-red-200 break-words overflow-wrap-anywhere whitespace-pre-wrap">
                                      <strong>Rejection Reason:</strong> {request.rejectionReason}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <Badge
                                  variant={request.status === 'approved' ? 'default' : 'destructive'}
                                  className={request.status === 'approved' ? 'bg-green-500' : ''}
                                >
                                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>

                    {filteredRecentDecisions.length > 0 && (
                      <div className="mt-6 border-t pt-4">
                        <Pagination
                          currentPage={recentDecisionsCurrentPage}
                          totalPages={Math.ceil(filteredRecentDecisions.length / recentDecisionsItemsPerPage)}
                          totalItems={filteredRecentDecisions.length}
                          itemsPerPage={recentDecisionsItemsPerPage}
                          onPageChange={setRecentDecisionsCurrentPage}
                          onItemsPerPageChange={setRecentDecisionsItemsPerPage}
                          showItemsPerPage={true}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No decisions yet</p>
                    <p className="text-sm">
                      {wfhRequestTimeFilter === 'all' ? (wfhRequestFilter === 'all' ? 'No requests have been approved or rejected' : `No ${wfhRequestFilter} requests found`) : `No requests found for the selected duration`}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Work From Home Request View */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Home className="h-5 w-5 text-orange-600" />
                Apply for Work From Home
              </CardTitle>
              <CardDescription>Submit a request to work from home</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* WFH Type removed as per request */}


                <div className={wfhType === 'half_day' ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}>
                  <div className="space-y-2">
                    <Label htmlFor="wfh-start-date">
                      {wfhType === 'half_day' ? 'Date' : 'Start Date'} <span className="text-red-500">*</span>
                    </Label>
                    <DatePicker
                      date={wfhStartDate}
                      onDateChange={(date) => {
                        setWfhStartDate(date);
                        if (date && (!wfhEndDate || wfhEndDate < date)) {
                          setWfhEndDate(date);
                        }
                      }}
                      placeholder="Select date"
                      disablePastDates={true}
                      fromDate={getTodayISTDate()}
                    />
                    {wfhStartDate && !isValidWfhDate(wfhStartDate) && (
                      <p className="text-xs text-red-500 mt-1">Date must be today or later</p>
                    )}
                  </div>
                  {wfhType === 'full_day' && (
                    <div className="space-y-2">
                      <Label htmlFor="wfh-end-date">End Date <span className="text-red-500">*</span></Label>
                      <DatePicker
                        date={wfhEndDate}
                        onDateChange={setWfhEndDate}
                        placeholder="Select end date"
                        disablePastDates={true}
                        fromDate={wfhStartDate || getTodayISTDate()}
                      />
                      {wfhEndDate && !isValidWfhDate(wfhEndDate) && (
                        <p className="text-xs text-red-500 mt-1">Date must be today or later</p>
                      )}
                      {wfhStartDate && wfhEndDate && wfhEndDate < wfhStartDate && (
                        <p className="text-xs text-red-500 mt-1">End date must be on or after start date</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wfh-reason">Reason for WFH Request <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="wfh-reason"
                    placeholder="Please provide a detailed reason for your work from home request."
                    value={wfhReason}
                    onChange={(e) => setWfhReason(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <p className={`text-xs ${wfhReason.trim().length < 10 && wfhReason.length > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                      Characters must be more than 10 (Current: {wfhReason.length})
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">Request Guidelines:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Submit requests in advance</li>
                        <li>Provide a clear and valid reason for the request</li>
                        <li>Ensure you have necessary equipment and internet connectivity</li>
                        <li>Your request will be reviewed by your {user?.role === 'employee' || user?.role === 'team_lead' ? 'manager and HR' : 'admin'}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleWfhSubmit}
                    disabled={isSubmittingWfh || !validateWfhForm().valid}
                    className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                  >
                    {isSubmittingWfh ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit WFH Request
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WFH Request History */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold">Your WFH Requests</CardTitle>
                  <CardDescription>Track the status of your work from home requests</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={wfhHistoryTimeFilter} onValueChange={(value: any) => setWfhHistoryTimeFilter(value)}>
                    <SelectTrigger className="w-[180px] bg-white dark:bg-slate-950">
                      <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filter by time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Requests</SelectItem>
                      <SelectItem value="current_month">Current Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                      <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                      <SelectItem value="last_year">Last 1 Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>

                  {wfhHistoryTimeFilter === 'custom' && (
                    <div className="flex flex-col sm:flex-row items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200 w-full sm:w-auto">
                      <DatePicker
                        date={wfhHistoryStartDate}
                        onDateChange={setWfhHistoryStartDate}
                        className="w-full sm:w-[160px] border-2 border-slate-200 dark:border-slate-800 rounded-xl"
                        placeholder="From Date"
                      />
                      <span className="text-muted-foreground text-xs font-medium">to</span>
                      <DatePicker
                        date={wfhHistoryEndDate}
                        onDateChange={setWfhHistoryEndDate}
                        className="w-full sm:w-[160px] border-2 border-slate-200 dark:border-slate-800 rounded-xl"
                        placeholder="To Date"
                        fromDate={wfhHistoryStartDate}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {filteredWfhHistory.length > 0 ? (
                  <div className="space-y-3">
                    {paginatedWfhHistory.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">
                                {formatDateIST(request.startDate, 'dd MMM yyyy')} - {formatDateIST(request.endDate, 'dd MMM yyyy')}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {request.type === 'full_day' || request.type === 'Full Day' ? 'Full Day' : 'Half Day'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground break-words overflow-wrap-anywhere whitespace-pre-wrap">{request.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              Submitted {formatRelativeTime(request.submittedAt)} ({formatDateTimeIST(request.submittedAt, 'dd MMM yyyy, hh:mm a')})
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={request.status === 'approved' ? 'default' : request.status === 'rejected' ? 'destructive' : 'secondary'}
                              className={request.status === 'approved' ? 'bg-green-500' : ''}
                            >
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </Badge>
                            {request.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditWfh(request)}
                                  className="h-8 w-8 p-0"
                                  title="Edit request"
                                >
                                  <Edit className="h-4 w-4 text-blue-600 hover:text-blue-700" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteWfh(request.id || request.wfhId)}
                                  disabled={isDeletingWfhId === (request.id || request.wfhId)}
                                  className="h-8 w-8 p-0"
                                  title="Delete request"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {filteredWfhHistory.length > 0 && (
                      <div className="mt-6 pt-4 border-t">
                        <Pagination
                          currentPage={wfhHistoryPage}
                          totalPages={Math.ceil(filteredWfhHistory.length / wfhHistoryItemsPerPage)}
                          totalItems={filteredWfhHistory.length}
                          itemsPerPage={wfhHistoryItemsPerPage}
                          onPageChange={setWfhHistoryPage}
                          onItemsPerPageChange={setWfhHistoryItemsPerPage}
                          showItemsPerPage={true}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No WFH requests found for the selected period</p>
                    <p className="text-sm">Try adjusting your filters or submit a new request</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )
      }

      {/* Checkout Confirmation Dialog */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Check-out</DialogTitle>
            <DialogDescription>
              Please provide today's work summary before checking out. You can optionally upload a work report PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="work-summary">Today's Work Summary <span className="text-red-500">*</span></Label>
              <Textarea
                id="work-summary"
                placeholder="Brief description of today's work."
                value={todaysWork}
                onChange={(e) => setTodaysWork(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                className="mt-2 resize-none"
                rows={4}
                required
              />
            </div>
            <div>
              <Label htmlFor="work-pdf">Upload Work Report PDF (Optional)</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  id="work-pdf"
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={handleFileUpload}
                />
                {workPdf && (
                  <Badge variant="outline">
                    <FileText className="h-3 w-3 mr-1" />
                    {workPdf.name}
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="task-deadline-reason">Task Deadline Reason (Optional)</Label>
              <Textarea
                id="task-deadline-reason"
                placeholder="Reason for any task deadlines not met."
                value={taskDeadlineReason}
                onChange={(e) => setTaskDeadlineReason(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                className="mt-2 resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckoutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCheckOut}>
              Proceed to Check-out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={exportModalOpen}
        onOpenChange={(open) => {
          setExportModalOpen(open);
          if (!open) {
            setExportType(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-visible">
          <DialogHeader>
            <DialogTitle>Export Attendance Report</DialogTitle>
            <DialogDescription>
              Configure your export preferences. Select date range and employee filter options.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 flex-1 overflow-y-auto overflow-x-visible pr-1">
            {/* Report Layout Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Report Layout</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReportLayout('basic')}
                  className={`p-2.5 rounded-lg border transition-all ${reportLayout === 'basic'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 hover:border-blue-300 dark:border-gray-700'
                    }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${reportLayout === 'basic' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <span className={`text-xs font-bold ${reportLayout === 'basic' ? 'text-blue-600' : 'text-gray-600'}`}>
                      Basic
                    </span>
                    <span className="text-[9px] text-muted-foreground text-center line-clamp-1">
                      Standard list
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setReportLayout('grid')}
                  className={`p-2.5 rounded-lg border transition-all ${reportLayout === 'grid'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950'
                    : 'border-gray-200 hover:border-indigo-300 dark:border-gray-700'
                    }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${reportLayout === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <span className={`text-xs font-bold ${reportLayout === 'grid' ? 'text-indigo-600' : 'text-gray-600'}`}>
                      Grid
                    </span>
                    <span className="text-[9px] text-muted-foreground text-center line-clamp-1">
                      Monthly view
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setReportLayout('detailed_grid')}
                  className={`p-2.5 rounded-lg border transition-all ${reportLayout === 'detailed_grid'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-950'
                    : 'border-gray-200 hover:border-purple-300 dark:border-gray-700'
                    }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${reportLayout === 'detailed_grid' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                      <History className="h-4.5 w-4.5" />
                    </div>
                    <span className={`text-xs font-bold ${reportLayout === 'detailed_grid' ? 'text-purple-600' : 'text-gray-600'}`}>
                      Detailed Grid
                    </span>
                    <span className="text-[9px] text-muted-foreground text-center line-clamp-1">
                      Full details
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Export Format Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Export Format</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportType('csv')}
                  className={`p-2.5 rounded-lg border transition-all ${exportType === 'csv'
                    ? 'border-green-600 bg-green-50 dark:bg-green-950'
                    : 'border-gray-200 hover:border-green-300 dark:border-gray-700'
                    }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <FileSpreadsheet className={`h-6 w-6 ${exportType === 'csv' ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className={`text-xs font-bold ${exportType === 'csv' ? 'text-green-600' : 'text-gray-600'}`}>
                      CSV
                    </span>
                    <span className="text-[9px] text-muted-foreground text-center">
                      Excel file
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setExportType('pdf')}
                  className={`p-2.5 rounded-lg border transition-all ${exportType === 'pdf'
                    ? 'border-red-600 bg-red-50 dark:bg-red-950'
                    : 'border-gray-200 hover:border-red-300 dark:border-gray-700'
                    }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <FileText className={`h-6 w-6 ${exportType === 'pdf' ? 'text-red-600' : 'text-gray-400'}`} />
                    <span className={`text-xs font-bold ${exportType === 'pdf' ? 'text-red-600' : 'text-gray-600'}`}>
                      PDF
                    </span>
                    <span className="text-[9px] text-muted-foreground text-center">
                      Print file
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Filter Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="quick-filter" className="text-sm font-medium">Quick Filter</Label>
              <Select value={quickFilter} onValueChange={handleQuickFilter}>
                <SelectTrigger
                  id="quick-filter"
                  className="w-full h-10 border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                >
                  <SelectValue placeholder="Select time period">
                    {quickFilter === 'custom' ? 'Custom Range' : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="w-[var(--radix-select-trigger-width)] min-w-[200px] max-w-[400px] z-50"
                  sideOffset={5}
                  align="start"
                >
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                  <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="export-start" className="text-sm font-medium">Start Date</Label>
                <DatePicker
                  date={exportStartDate}
                  onDateChange={setExportStartDate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="export-end" className="text-sm font-medium">End Date</Label>
                <DatePicker
                  date={exportEndDate}
                  onDateChange={setExportEndDate}
                />
              </div>
            </div>

            {/* Employee Filter */}
            <div className="space-y-2">
              <Label>Employee Filter</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="export-all"
                    name="employee-export-filter"
                    className="h-4 w-4 text-blue-600"
                    checked={employeeExportFilter === 'all'}
                    onChange={() => {
                      setEmployeeExportFilter('all');
                      setSelectedExportEmployee(null);
                      setEmployeeExportSearch('');
                      if (!exportDepartments.length && !user?.department) setSelectedExportDepartment('');
                    }}
                  />
                  <Label htmlFor="export-all" className="cursor-pointer">
                    All Employees
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="export-specific"
                    name="employee-export-filter"
                    className="h-4 w-4 text-blue-600"
                    checked={employeeExportFilter === 'specific'}
                    onChange={() => setEmployeeExportFilter('specific')}
                  />
                  <Label htmlFor="export-specific" className="cursor-pointer">
                    Specific Employee
                  </Label>
                </div>
              </div>
            </div>

            {/* Employee Selection */}
            {employeeExportFilter === 'specific' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="export-department">Department</Label>
                  <Select
                    value={selectedExportDepartment}
                    onValueChange={(value) => {
                      setSelectedExportDepartment(value);
                      setSelectedExportEmployee(null);
                      setEmployeeExportSearch('');
                    }}
                  >
                    <SelectTrigger id="export-department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {exportDepartments.length ? (
                        exportDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__empty" disabled>
                          No departments found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedExportDepartment ? (
                  <div className="space-y-2">
                    <Label htmlFor="export-employee-search">Select Employee</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="export-employee-search"
                        placeholder="Search by name or employee ID..."
                        value={employeeExportSearch}
                        onChange={(e) => setEmployeeExportSearch(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                        className="pl-10"
                      />
                    </div>
                    <div className="border rounded-md max-h-40 overflow-y-auto mt-2">
                      {filteredExportEmployees.length ? (
                        filteredExportEmployees.map((emp) => {
                          const isSelected = selectedExportEmployee?.user_id === emp.user_id;
                          return (
                            <button
                              type="button"
                              key={emp.user_id}
                              onClick={() => setSelectedExportEmployee(emp)}
                              className={`w-full text-left p-3 border-b last:border-b-0 transition-colors ${isSelected
                                ? 'bg-blue-50 dark:bg-blue-900'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                              <div className="font-medium">{emp.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {emp.employee_id ? `ID: ${emp.employee_id}` : `User: ${emp.user_id}`}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-sm text-muted-foreground">
                          No employees found for this department.
                        </div>
                      )}
                    </div>
                    {selectedExportEmployee && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900 rounded-md flex items-center justify-between">
                        <div>
                          <div className="font-medium">{selectedExportEmployee.name}</div>
                          {selectedExportEmployee.employee_id && (
                            <div className="text-sm text-muted-foreground">
                              ID: {selectedExportEmployee.employee_id}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedExportEmployee(null);
                            setEmployeeExportSearch('');
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a department to view its employees.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExportModalOpen(false);
                setExportType(null);
              }}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={performExport}
              disabled={
                isExporting ||
                (!exportStartDate && !exportEndDate) ||
                (employeeExportFilter === 'specific' && !selectedExportEmployee)
              }
              className={exportType === 'csv' ? 'bg-green-600 hover:bg-green-700' : exportType === 'pdf' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {isExporting ? 'Exporting...' : exportType ? `Export ${exportType.toUpperCase()}` : 'Select Format'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selfie Modal */}
      <Dialog open={showSelfieModal} onOpenChange={setShowSelfieModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedRecord?.name || 'Employee'}'s Attendance
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Check-in Selfie */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <h3 className="font-medium">Check-in Selfie</h3>
              </div>
              <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {selectedRecord?.checkInSelfie ? (
                  <img
                    src={selectedRecord.checkInSelfie.startsWith('http') ? selectedRecord.checkInSelfie : `${API_BASE_URL}${selectedRecord.checkInSelfie}`}
                    alt="Check-in selfie"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <User className="h-12 w-12 mb-2" />
                    <p>No selfie available</p>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                  <p className="font-medium">Check-in: {selectedRecord?.checkInTime ? formatAttendanceTime(selectedRecord.date, selectedRecord.checkInTime) : 'N/A'}</p>
                  <p className="text-sm opacity-80">{selectedRecord?.checkInLocation?.address || 'Location not available'}</p>
                </div>
              </div>
            </div>

            {/* Check-out Selfie */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <h3 className="font-medium">Check-out Selfie</h3>
              </div>
              <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {selectedRecord?.checkOutSelfie ? (
                  <img
                    src={selectedRecord.checkOutSelfie.startsWith('http') ? selectedRecord.checkOutSelfie : `${API_BASE_URL}${selectedRecord.checkOutSelfie}`}
                    alt="Check-out selfie"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <User className="h-12 w-12 mb-2" />
                    <p>No check-out selfie</p>
                    <p className="text-sm">Not checked out yet</p>
                  </div>
                )}
                {selectedRecord?.checkOutTime && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                    <p className="font-medium">Check-out: {formatAttendanceTime(selectedRecord.date, selectedRecord.checkOutTime)}</p>
                    <p className="text-sm opacity-80">{selectedRecord?.checkOutLocation?.address || 'Location not available'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Work Summary</p>
              <p className="text-muted-foreground">
                {selectedRecord?.workSummary || 'Not provided'}
              </p>
            </div>
            {selectedRecord?.taskDeadlineReason && (
              <div>
                <p className="font-medium">Overdue Reason</p>
                <p className="text-muted-foreground">
                  {selectedRecord.taskDeadlineReason}
                </p>
              </div>
            )}
            {selectedRecord?.workReport && (
              <div>
                <p className="font-medium">Work Report</p>
                <a
                  href={selectedRecord.workReport}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Document
                </a>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSelfieModal(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Details Modal */}
      <Dialog open={!!selectedRecord && !showSelfieModal} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Location Details
            </DialogTitle>
            <DialogDescription>
              Check-in and check-out location information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Check-in Location */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <h3 className="font-semibold text-base">Check-in Location</h3>
              </div>
              <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
                      {formatAttendanceTime(selectedRecord?.date || '', selectedRecord?.checkInTime)}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">
                      {selectedRecord?.checkInLocation?.address || 'Location not available'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Check-out Location */}
            {selectedRecord?.checkOutTime ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <h3 className="font-semibold text-base">Check-out Location</h3>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                        {formatAttendanceTime(selectedRecord?.date || '', selectedRecord?.checkOutTime)}
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                        {selectedRecord?.checkOutLocation?.address || 'Location not available'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-slate-400"></div>
                  <h3 className="font-semibold text-base">Check-out Location</h3>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/20 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 text-center py-2">
                    User has not checked out yet
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedRecord(null)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Work Summary Dialog */}
      <Dialog open={showWorkSummaryDialog} onOpenChange={setShowWorkSummaryDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Attendance Details
            </DialogTitle>
            <DialogDescription>
              Detailed work summary and overdue reasons for the selected record
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border">
              <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-2">Work Summary</h4>
              <div className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                {selectedWorkSummary || 'No work summary provided'}
              </div>
            </div>

            {selectedOverdueReason && (
              <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                <h4 className="font-medium text-sm text-orange-700 dark:text-orange-300 mb-2">Overdue Reason</h4>
                <div className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                  {selectedOverdueReason}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowWorkSummaryDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Details Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Location Details
            </DialogTitle>
            <DialogDescription>
              Check-in and check-out location information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Check-in Location */}
            {selectedLocation.checkIn && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <h4 className="font-medium text-sm">Check-in Location</h4>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed">
                      {selectedLocation.checkIn}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Check-out Location */}
            {selectedLocation.checkOut && selectedLocation.checkOut !== selectedLocation.checkIn && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <h4 className="font-medium text-sm">Check-out Location</h4>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
                      {selectedLocation.checkOut}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Same location message */}
            {selectedLocation.checkOut && selectedLocation.checkOut === selectedLocation.checkIn && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Same location used for both check-in and check-out
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WFH Request Rejection Dialog */}
      <Dialog open={showWfhRequestDialog} onOpenChange={setShowWfhRequestDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-600" />
              Reject WFH Request
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this work from home request.
            </DialogDescription>
          </DialogHeader>

          {selectedWfhRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{selectedWfhRequest.submittedBy}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatRoleDisplay(selectedWfhRequest.role)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <span className="text-sm">
                      {formatDateIST(selectedWfhRequest.startDate, 'dd MMM yyyy')} - {formatDateIST(selectedWfhRequest.endDate, 'dd MMM yyyy')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground break-words overflow-wrap-anywhere whitespace-pre-wrap">{selectedWfhRequest.reason}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason <span className="text-red-500">*</span></Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Please provide a clear reason for rejecting this request."
                  value={selectedWfhRequest?.rejectionReason || ''}
                  rows={3}
                  className="resize-none"
                  onChange={(e) => {
                    setSelectedWfhRequest(prev => prev ? { ...prev, rejectionReason: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') } : null);
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowWfhRequestDialog(false);
                setSelectedWfhRequest(null);
              }}
              disabled={isProcessingWfhRequest}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedWfhRequest?.rejectionReason?.trim()) {
                  handleWfhRequestAction(selectedWfhRequest.id, 'reject', selectedWfhRequest.rejectionReason);
                } else {
                  toast({
                    title: 'Rejection Reason Required',
                    description: 'Please provide a reason for rejecting this request.',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={isProcessingWfhRequest || !selectedWfhRequest?.rejectionReason?.trim()}
            >
              {isProcessingWfhRequest ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Reject Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All WFH Requests Confirmation Dialog */}
      <AlertDialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All WFH Requests</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all requests? All pending requests will be automatically rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Clear all WFH requests from the UI
                setAllWfhRequests([]);
                setShowClearConfirmation(false);
                toast({
                  title: 'Requests Cleared',
                  description: 'All WFH requests have been cleared and marked as rejected.',
                });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit WFH Request Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit WFH Request</DialogTitle>
            <DialogDescription>Update your work from home request details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className={wfhType === 'half_day' ? 'space-y-2' : 'grid grid-cols-2 gap-4'}>
              <div className="space-y-2">
                <Label>{wfhType === 'half_day' ? 'Date *' : 'Start Date *'}</Label>
                <DatePicker
                  date={wfhStartDate}
                  onDateChange={(date) => {
                    setWfhStartDate(date);
                    if (date && (!wfhEndDate || wfhEndDate < date)) {
                      setWfhEndDate(date);
                    }
                  }}
                  placeholder="Select date"
                  disablePastDates={true}
                  fromDate={getTodayISTDate()}
                />
              </div>
              {wfhType === 'full_day' && (
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <DatePicker
                    date={wfhEndDate}
                    onDateChange={setWfhEndDate}
                    placeholder="Select end date"
                    disablePastDates={true}
                    fromDate={wfhStartDate || getTodayISTDate()}
                  />
                </div>
              )}
            </div>
            {/* edit-wfh-type removed as per request */}

            <div className="space-y-2">
              <Label htmlFor="edit-wfh-reason">Reason *</Label>
              <Textarea
                id="edit-wfh-reason"
                placeholder="Enter reason for WFH request."
                value={wfhReason}
                onChange={(e) => setWfhReason(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingWfhId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateWfh}
              disabled={isSubmittingWfh}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isSubmittingWfh ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default AttendanceWithToggle;