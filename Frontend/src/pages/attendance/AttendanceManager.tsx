import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, Search, Filter, Download, AlertCircle, CheckCircle, Users, X, User, Settings, LogOut, AlertTriangle, CheckCircle2, Timer, FileSpreadsheet, FileText, Home, Send, History, LayoutGrid } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { AttendanceRecord } from '@/types';
import { format, subMonths, subDays, isAfter } from 'date-fns';
import { Pagination } from '@/components/ui/pagination';
import TruncatedText from '@/components/ui/TruncatedText';
import { formatIST, formatDateTimeIST, formatTimeIST, formatDateIST, todayIST, formatDateTimeComponentsIST, parseToIST, nowIST } from '@/utils/timezone';
import { DatePicker } from '@/components/ui/date-picker';
import OnlineStatusIndicator from '@/components/attendance/OnlineStatusIndicator';
import { apiService } from '@/lib/api';

interface EmployeeAttendance extends AttendanceRecord {
  userName: string;
  userEmail: string;
  department: string;
  employeeId?: string;
  checkInStatus?: string;
  checkOutStatus?: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  workSummary?: string | null;
  workReport?: string | null;
  workLocation?: string;
}

interface OfficeTiming {
  id: number;
  department?: string | null;
  start_time: string;
  end_time: string;
  check_in_grace_minutes: number;
  check_out_grace_minutes: number;
}

type TimingFormState = {
  startTime: string;
  endTime: string;
  checkInGrace: number | '';
  checkOutGrace: number | '';
};

type DepartmentTimingFormState = TimingFormState & {
  department: string;
};

const resolveGraceValue = (value: number | '') => (value === '' ? 0 : value);

const AttendanceManager: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

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
  const isAdmin = user?.role === 'admin';
  const [attendanceRecords, setAttendanceRecords] = useState<EmployeeAttendance[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<EmployeeAttendance[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<EmployeeAttendance | null>(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [summaryModal, setSummaryModal] = useState<{ open: boolean; summary: string | null }>({ open: false, summary: null });
  const [locationModal, setLocationModal] = useState<{ open: boolean; location: EmployeeAttendance | null }>({ open: false, location: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState(todayIST());
  const [selectedDate, setSelectedDate] = useState<Date>(nowIST());
  const [timePeriodFilter, setTimePeriodFilter] = useState<'today' | 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_12_months' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>(subDays(nowIST(), 7));
  const [customEndDate, setCustomEndDate] = useState<Date>(nowIST());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<{ total_employees: number; present_today: number; late_arrivals: number; early_departures: number; absent_today: number }>({ total_employees: 0, present_today: 0, late_arrivals: 0, early_departures: 0, absent_today: 0 });

  // Export modal states
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf' | null>('csv');
  const [reportLayout, setReportLayout] = useState<'basic' | 'grid' | 'detailed_grid'>('basic');
  const [quickFilter, setQuickFilter] = useState<string>('custom');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [employeeFilter, setEmployeeFilter] = useState<'all' | 'specific'>('all');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employees, setEmployees] = useState<Array<{ user_id: number; employee_id: string; name: string; department?: string | null }>>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Array<{ user_id: number; employee_id: string; name: string; department?: string | null }>>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<{ user_id: number; employee_id: string; name: string; department?: string | null } | null>(null);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [coreDepartments, setCoreDepartments] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'office-hours' | 'wfh-requests'>('attendance');
  const [officeTimings, setOfficeTimings] = useState<OfficeTiming[]>([]);
  const [officeFormLoading, setOfficeFormLoading] = useState(false);
  const [isGlobalSaving, setIsGlobalSaving] = useState(false);
  const [isDeptSaving, setIsDeptSaving] = useState(false);
  const [globalTimingForm, setGlobalTimingForm] = useState<TimingFormState>({
    startTime: '09:30',
    endTime: '18:00',
    checkInGrace: 15,
    checkOutGrace: 0,
  });
  const [departmentTimingForm, setDepartmentTimingForm] = useState<DepartmentTimingFormState>({
    department: '',
    startTime: '09:30',
    endTime: '18:00',
    checkInGrace: 15,
    checkOutGrace: 0,
  });
  const [onlineStatusMap, setOnlineStatusMap] = useState<Record<number, boolean>>({});

  // WFH Requests state (Admin only sees HR and Manager requests)
  const [allWfhRequests, setAllWfhRequests] = useState<any[]>([]);
  const [isLoadingWfhRequests, setIsLoadingWfhRequests] = useState(false);
  const [wfhRequestFilter, setWfhRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedWfhRequest, setSelectedWfhRequest] = useState<any>(null);
  const [showWfhRequestDialog, setShowWfhRequestDialog] = useState(false);
  const [isProcessingWfhRequest, setIsProcessingWfhRequest] = useState(false);
  const [wfhCurrentPage, setWfhCurrentPage] = useState(1);
  const [wfhItemsPerPage, setWfhItemsPerPage] = useState(10);
  const [pendingWfhCurrentPage, setPendingWfhCurrentPage] = useState(1);
  const [pendingWfhItemsPerPage, setPendingWfhItemsPerPage] = useState(10);
  const [wfhDecisionsDurationFilter, setWfhDecisionsDurationFilter] = useState<string>('all');
  const [wfhDecisionsStartDate, setWfhDecisionsStartDate] = useState<Date | undefined>(undefined);
  const [wfhDecisionsEndDate, setWfhDecisionsEndDate] = useState<Date | undefined>(undefined);
  const [wfhRoleFilter, setWfhRoleFilter] = useState<'all' | 'hr' | 'manager' | 'team_lead' | 'employee'>('all');

  // Ref for scrolling to department form when editing
  const departmentFormRef = useRef<HTMLDivElement>(null);
  const timePickerRefs = {
    globalStart: useRef<HTMLDivElement>(null),
    globalEnd: useRef<HTMLDivElement>(null),
    deptStart: useRef<HTMLDivElement>(null),
    deptEnd: useRef<HTMLDivElement>(null),
  };
  const [openTimePicker, setOpenTimePicker] = useState<'globalStart' | 'globalEnd' | 'deptStart' | 'deptEnd' | null>(null);
  const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  useEffect(() => {
    setWfhCurrentPage(1);
  }, [wfhRequestFilter, wfhRoleFilter, wfhDecisionsDurationFilter, wfhDecisionsStartDate, wfhDecisionsEndDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openTimePicker) return;
      const targets = Object.values(timePickerRefs);
      const clickedInside = targets.some((ref) => ref.current && ref.current.contains(event.target as Node));
      if (!clickedInside) {
        setOpenTimePicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openTimePicker]);

  const parseTimeValue = (value: string) => {
    if (!value) return { hour12: '10', minute: '00', meridiem: 'AM' };
    const [h, m] = value.split(':');
    const hour = Math.max(0, Math.min(23, Number(h) || 0));
    const minute = Math.max(0, Math.min(59, Number(m) || 0));
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    let hour12 = hour % 12;
    if (hour12 === 0) hour12 = 12;
    return {
      hour12: hour12.toString().padStart(2, '0'),
      minute: minute.toString().padStart(2, '0'),
      meridiem,
    };
  };

  const to24Hour = (hour12: string, minute: string, meridiem: 'AM' | 'PM') => {
    let h = Number(hour12) % 12;
    if (meridiem === 'PM') h += 12;
    const m = Number(minute) % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleTimeSelect = (
    field: 'globalStart' | 'globalEnd' | 'deptStart' | 'deptEnd',
    hour12: string,
    minute: string,
    meridiem: 'AM' | 'PM',
  ) => {
    const value = to24Hour(hour12, minute, meridiem);
    if (field === 'globalStart') {
      setGlobalTimingForm((prev) => ({ ...prev, startTime: value }));
    } else if (field === 'globalEnd') {
      setGlobalTimingForm((prev) => ({ ...prev, endTime: value }));
    } else if (field === 'deptStart') {
      setDepartmentTimingForm((prev) => ({ ...prev, startTime: value }));
    } else if (field === 'deptEnd') {
      setDepartmentTimingForm((prev) => ({ ...prev, endTime: value }));
    }
    setOpenTimePicker(null);
  };

  const TimePickerDropdown = ({
    field,
    value,
    accent,
  }: {
    field: 'globalStart' | 'globalEnd' | 'deptStart' | 'deptEnd';
    value: string;
    accent: 'blue' | 'purple';
  }) => {
    const { hour12, minute, meridiem } = parseTimeValue(value);
    const accentBase = accent === 'blue' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-purple-600 border-purple-200 bg-purple-50';
    const accentHover = accent === 'blue' ? 'hover:border-blue-300 hover:bg-blue-100' : 'hover:border-purple-300 hover:bg-purple-100';

    return (
      <div
        ref={timePickerRefs[field]}
        className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-black/5"
      >
        <div className="flex gap-3 p-4 text-sm">
          <div className="w-20 space-y-2">
            <p className="font-medium text-slate-600">Hour</p>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {HOURS.map((h) => {
                const active = h === hour12;
                return (
                  <button
                    key={`${field}-h-${h}`}
                    type="button"
                    onClick={() => handleTimeSelect(field, h, minute, meridiem as 'AM' | 'PM')}
                    className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors text-left ${active ? accentBase : 'border-slate-200 text-slate-700'} ${accentHover}`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-20 space-y-2">
            <p className="font-medium text-slate-600">Minute</p>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {MINUTES.map((m) => {
                const active = m === minute;
                return (
                  <button
                    key={`${field}-m-${m}`}
                    type="button"
                    onClick={() => handleTimeSelect(field, hour12, m, meridiem as 'AM' | 'PM')}
                    className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors text-left ${active ? accentBase : 'border-slate-200 text-slate-700'} ${accentHover}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-20 space-y-2">
            <p className="font-medium text-slate-600">AM/PM</p>
            <div className="flex flex-col gap-2">
              {(['AM', 'PM'] as const).map((mer) => {
                const active = mer === meridiem;
                return (
                  <button
                    key={`${field}-mer-${mer}`}
                    type="button"
                    onClick={() => handleTimeSelect(field, hour12, minute, mer)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm transition-colors text-center ${active ? accentBase : 'border-slate-200 text-slate-700'} ${accentHover}`}
                  >
                    {mer}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: token } : {};
  };

  const loadCoreDepartments = async () => {
    try {
      const items = await apiService.getDepartmentNames();
      const names = items
        .map((d) => d?.name)
        .filter((name): name is string => Boolean(name && name.trim()))
        .map((name) => name.trim());
      setCoreDepartments(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error('loadCoreDepartments error', err);
      // Non-blocking: department timing can still be used as custom input
      setCoreDepartments([]);
    }
  };

  const fetchAllOnlineStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://testing.staffly.space/attendance/current-online-status', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const statusMap: Record<number, boolean> = {};
        Object.keys(data).forEach(userId => {
          statusMap[parseInt(userId)] = data[userId].is_online;
        });
        setOnlineStatusMap(statusMap);
      }
    } catch (error) {
      console.error('Failed to fetch online status:', error);
    }
  };

  const resolveMediaUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `https://testing.staffly.space${normalized}`;
  };

  // Helper function to determine if employee should show as absent
  const shouldShowAsAbsent = (record: EmployeeAttendance): boolean => {
    const today = todayIST();
    const recordDate = record.date;
    const checkInTime = record.checkInTime;
    const checkOutTime = record.checkOutTime;

    // If no check-in time, show as absent
    if (!checkInTime) {
      return true;
    }

    // If record date is today
    if (recordDate === today) {
      // If checked out, not absent
      if (checkOutTime) {
        return false;
      }
      // If not checked out but has check-in, show online status (not absent)
      return false;
    }

    // If record date is before today (past date)
    const recordDateObj = new Date(recordDate);
    const todayDateObj = new Date(today);

    if (recordDateObj < todayDateObj) {
      // If checkout was forgotten (no checkout and it's a past date), show as absent
      if (!checkOutTime) {
        return true; // Forgotten checkout - show as absent
      }
      // If checked out on past date, not absent (already completed)
      return false;
    }

    // Future date (shouldn't happen, but handle it)
    return false;
  };

  // Helper function to get online status for display
  const getOnlineStatusForDisplay = (record: EmployeeAttendance): { isOnline: boolean; label: string; showAbsent: boolean } => {
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

  useEffect(() => {
    loadAllAttendance();
    fetchSummary();
    loadEmployees();
    loadCoreDepartments();
    fetchAllOnlineStatus();

    // Fetch online status every 15 seconds
    const interval = setInterval(fetchAllOnlineStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadOfficeTimings();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'wfh-requests' && isAdmin) {
      loadAdminWfhRequests();

      // Refresh sample data every 30 seconds to keep timestamps current
      const dataInterval = setInterval(() => {
        loadAdminWfhRequests();
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
  }, [activeTab, isAdmin]);

  // Refresh office hours data and department list whenever the admin opens the tab.
  useEffect(() => {
    if (activeTab === 'office-hours' && isAdmin) {
      loadOfficeTimings();
      loadCoreDepartments();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (employeeFilter !== 'specific') {
      setFilteredEmployees([]);
      return;
    }

    let subset = employees;
    const normalizedDept = selectedDepartmentFilter.trim().toLowerCase();
    if (normalizedDept) {
      subset = subset.filter(
        (emp) => (emp.department || '').trim().toLowerCase() === normalizedDept,
      );
    }

    const searchValue = employeeSearch.trim().toLowerCase();
    if (searchValue) {
      subset = subset.filter(
        (emp) =>
          emp.name.toLowerCase().includes(searchValue) ||
          emp.employee_id?.toLowerCase().includes(searchValue),
      );
    }

    setFilteredEmployees(subset);
  }, [employeeFilter, selectedDepartmentFilter, employeeSearch, employees]);

  useEffect(() => {
    if (employeeFilter === 'specific') {
      if (!selectedDepartmentFilter && departments.length === 1) {
        setSelectedDepartmentFilter(departments[0]);
      }
    } else {
      setSelectedDepartmentFilter('');
      setSelectedEmployee(null);
    }
  }, [employeeFilter, departments, selectedDepartmentFilter]);

  const loadEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };
      const res = await fetch('https://testing.staffly.space/employees/', { headers });

      if (!res.ok) throw new Error(`Failed to load employees: ${res.status}`);
      let data = await res.json();
      if (!Array.isArray(data) && data?.employees) {
        data = data.employees;
      } else if (!Array.isArray(data)) {
        data = [];
      }

      // Enforce strict visibility validation for Managers based on role hierarchy and department
      if (user?.role === 'manager' && user?.department) {
        const managerId = String(user.id);
        const normalizedDept = user.department.trim().toLowerCase();

        // Step 1: Find all Team Leads reporting to this Manager (within same department)
        const teamLeadIds = new Set<string>();
        data.forEach((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          const role = (emp.role || '').replace(/[\s_]+/g, '').toLowerCase();
          const empDept = (emp.department || emp.department_name || '').trim().toLowerCase();
          const managerIdForEmp = emp.manager_id ? String(emp.manager_id) : null;

          // Team Lead in same department (allow all Team Leads in department to be visible to Manager)
          if (role === 'teamlead' && empDept === normalizedDept) {
            teamLeadIds.add(uId);
          }
        });

        // Step 2: Find all Employees reporting to those Team Leads (within same department)
        const allowedEmployeeIds = new Set<string>();
        data.forEach((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          const role = (emp.role || '').toLowerCase();
          const empDept = (emp.department || emp.department_name || '').trim().toLowerCase();
          const teamLeadIdForEmp = emp.team_lead_id || emp.teamLeadId ? String(emp.team_lead_id || emp.teamLeadId) : null;

          // Employee reporting to a Team Lead that reports to this Manager, in same department
          if (role === 'employee' && empDept === normalizedDept && teamLeadIdForEmp && teamLeadIds.has(teamLeadIdForEmp)) {
            allowedEmployeeIds.add(uId);
          }
        });

        // Step 3: Filter employees based on allowed users
        data = data.filter((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          const empDept = (emp.department || emp.department_name || '').trim().toLowerCase();
          const role = (emp.role || '').replace(/[\s_]+/g, '').toLowerCase();

          // 1. Always allow Self (Manager)
          if (uId === managerId) return true;

          // 2. Department must match (mandatory)
          if (empDept !== normalizedDept) return false;

          // 3. Check if user is in allowed set (Team Lead or Employee in reporting chain)
          if (teamLeadIds.has(uId)) return true; // Team Lead reporting to Manager
          if (allowedEmployeeIds.has(uId)) return true; // Employee reporting to Team Lead

          // 4. Explicitly exclude other roles
          if (role === 'admin' || role === 'hr' || role === 'manager') {
            return false;
          }

          // 5. Exclude Team Leads not reporting to this Manager
          if (role === 'teamlead' && !teamLeadIds.has(uId)) {
            return false;
          }

          // 6. Exclude Employees not reporting to allowed Team Leads
          if (role === 'employee' && !allowedEmployeeIds.has(uId)) {
            return false;
          }

          // Default: exclude unknown users
          return false;
        });

        console.log('Manager employee filtering:', {
          managerId,
          department: normalizedDept,
          teamLeadIds: Array.from(teamLeadIds),
          allowedEmployeeIds: Array.from(allowedEmployeeIds),
          filteredEmployeesCount: data.length
        });
      }

      const departmentSet = new Set<string>();
      const mapped = data.map((emp: any) => {
        const department = emp.department || emp.department_name || '';
        if (department) {
          departmentSet.add(department);
        }
        return {
          user_id: emp.user_id || emp.userId,
          employee_id: emp.employee_id || emp.employeeId || '',
          name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          department,
        };
      });
      setEmployees(mapped);
      setDepartments(Array.from(departmentSet).sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error('loadEmployees error', err);
    }
  };

  const loadOfficeTimings = async () => {
    if (!isAdmin) return;
    setOfficeFormLoading(true);
    try {
      const res = await fetch('https://testing.staffly.space/attendance/office-hours', {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error(`Failed to load office timings: ${res.status}`);
      const data: OfficeTiming[] = await res.json();
      setOfficeTimings(data);

      const globalTiming = data.find((entry) => !entry.department || entry.department === '');
      if (globalTiming) {
        setGlobalTimingForm({
          startTime: (globalTiming.start_time || '').slice(0, 5) || '10:00 AM',
          endTime: (globalTiming.end_time || '').slice(0, 5) || '07:00PM',
          checkInGrace: globalTiming.check_in_grace_minutes ?? 0,
          checkOutGrace: globalTiming.check_out_grace_minutes ?? 0,
        });
      }

      const timingDepartments = data
        .map((entry) => entry.department)
        .filter((dept): dept is string => Boolean(dept && dept.trim()));
      // Intentionally do not merge timing departments into the main `departments` list.
      // The "Department Timing" UI uses `coreDepartments` (from /departments/names) to avoid messy/combined strings.
    } catch (error) {
      console.error('loadOfficeTimings error', error);
      toast({
        title: 'Office timing fetch failed',
        description: 'Unable to load configured office timings.',
        variant: 'destructive',
      });
    } finally {
      setOfficeFormLoading(false);
    }
  };

  const handleGlobalTimingSave = async () => {
    try {
      setIsGlobalSaving(true);
      const payload = {
        department: null,
        start_time: globalTimingForm.startTime,
        end_time: globalTimingForm.endTime,
        check_in_grace_minutes: resolveGraceValue(globalTimingForm.checkInGrace),
        check_out_grace_minutes: resolveGraceValue(globalTimingForm.checkOutGrace),
      };
      const res = await fetch('https://testing.staffly.space/attendance/office-hours', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to save office timing: ${res.status}`);
      await loadOfficeTimings();
      toast({ title: 'Office time saved', description: 'Global office timing updated successfully.' });
    } catch (error) {
      console.error('handleGlobalTimingSave error', error);
      toast({
        title: 'Save failed',
        description: 'Unable to save global office time. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGlobalSaving(false);
    }
  };

  const handleDepartmentTimingSave = async () => {
    if (!departmentTimingForm.department.trim()) {
      toast({
        title: 'Department required',
        description: 'Please specify a department before saving.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsDeptSaving(true);
      const payload = {
        department: departmentTimingForm.department.trim(),
        start_time: departmentTimingForm.startTime,
        end_time: departmentTimingForm.endTime,
        check_in_grace_minutes: resolveGraceValue(departmentTimingForm.checkInGrace),
        check_out_grace_minutes: resolveGraceValue(departmentTimingForm.checkOutGrace),
      };
      const res = await fetch('https://testing.staffly.space/attendance/office-hours', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to save department office timing: ${res.status}`);
      await loadOfficeTimings();
      toast({
        title: 'Department timing saved',
        description: `Office timing updated for ${departmentTimingForm.department}.`,
      });
    } catch (error) {
      console.error('handleDepartmentTimingSave error', error);
      toast({
        title: 'Save failed',
        description: 'Unable to save department office time. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeptSaving(false);
    }
  };

  const handleDepartmentTimingEdit = (timing: OfficeTiming) => {
    setDepartmentTimingForm({
      department: timing.department || '',
      startTime: (timing.start_time || '').slice(0, 5) || '10:00 AM',
      endTime: (timing.end_time || '').slice(0, 5) || '07:00 PM',
      checkInGrace: timing.check_in_grace_minutes ?? 0,
      checkOutGrace: timing.check_out_grace_minutes ?? 0,
    });

    // Scroll to the form and provide visual feedback
    setTimeout(() => {
      if (departmentFormRef.current) {
        departmentFormRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // Add a brief highlight effect
        departmentFormRef.current.classList.add('ring-4', 'ring-purple-400', 'ring-opacity-50');
        setTimeout(() => {
          departmentFormRef.current?.classList.remove('ring-4', 'ring-purple-400', 'ring-opacity-50');
        }, 2000);
      }
    }, 100);

    // Show toast notification
    toast({
      title: 'Editing Department Timing',
      description: `Form populated with settings for ${timing.department || 'All Departments'}. Scroll up to edit.`,
    });
  };

  const handleDepartmentTimingDelete = async (timing: OfficeTiming) => {
    if (!window.confirm(`Remove office timing for ${timing.department || 'all departments'}?`)) {
      return;
    }

    try {
      setOfficeFormLoading(true);
      const res = await fetch(`https://testing.staffly.space/attendance/office-hours/${timing.id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error(`Failed to delete office timing: ${res.status}`);
      await loadOfficeTimings();
      if (
        timing.department &&
        departmentTimingForm.department.trim().toLowerCase() === timing.department.trim().toLowerCase()
      ) {
        setDepartmentTimingForm({
          department: '',
          startTime: globalTimingForm.startTime,
          endTime: globalTimingForm.endTime,
          checkInGrace: globalTimingForm.checkInGrace,
          checkOutGrace: globalTimingForm.checkOutGrace,
        });
      }
      toast({ title: 'Office timing removed', description: 'The office timing has been deactivated.' });
    } catch (error) {
      console.error('handleDepartmentTimingDelete error', error);
      toast({
        title: 'Delete failed',
        description: 'Unable to remove the office timing. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setOfficeFormLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch('https://testing.staffly.space/attendance/summary');
      if (!res.ok) throw new Error(`Failed to load summary: ${res.status}`);
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error('fetchSummary error', err);
    }
  };

  useEffect(() => {
    filterRecords();
  }, [searchTerm, filterStatus, timePeriodFilter, customStartDate, customEndDate, attendanceRecords]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, timePeriodFilter, customStartDate, customEndDate]);

  const loadAllAttendance = (targetDate?: string) => {
    // Fetch today's attendance from backend
    // For Admin/HR/Manager: Load today's attendance records
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': token ? `Bearer ${token}` : '',
        };

        let query = targetDate ? `?date=${encodeURIComponent(targetDate)}` : '';

        // Enforce backend-level filtering for Managers (Department Scope + Manager ID)
        if (user?.role === 'manager' && user?.department) {
          query += (query ? '&' : '?') + `department=${encodeURIComponent(user.department)}`;
          query += `&manager_id=${encodeURIComponent(user.id)}`;
        }

        // Fetch attendance and employees in parallel to ensure we have role data
        const [attendanceRes, employeesRes] = await Promise.all([
          fetch(`https://testing.staffly.space/attendance/all${query}`, { headers }),
          fetch('https://testing.staffly.space/employees/', { headers })
        ]);

        if (!attendanceRes.ok) {
          const errorText = await attendanceRes.text();
          console.error(`Failed to load attendance: ${attendanceRes.status}`, errorText);
          throw new Error(`Failed to load attendance: ${attendanceRes.status} - ${errorText}`);
        }

        let data = await attendanceRes.json();
        let employeesData = employeesRes.ok ? await employeesRes.json() : [];
        if (!Array.isArray(employeesData) && employeesData?.employees) {
          employeesData = employeesData.employees;
        } else if (!Array.isArray(employeesData)) {
          employeesData = [];
        }

        // Create comprehensive maps for role hierarchy validation
        const userRoleMap: Record<string, string> = {};
        const userDepartmentMap: Record<string, string> = {};
        const userManagerMap: Record<string, string | null> = {};
        const userTeamLeadMap: Record<string, string | null> = {};

        employeesData.forEach((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          userRoleMap[uId] = (emp.role || '').replace(/[\s_]+/g, '').toLowerCase();
          userDepartmentMap[uId] = (emp.department || emp.department_name || '').trim().toLowerCase();
          userManagerMap[uId] = emp.manager_id ? String(emp.manager_id) : null;
          userTeamLeadMap[uId] = emp.team_lead_id || emp.teamLeadId ? String(emp.team_lead_id || emp.teamLeadId) : null;
        });

        console.log('Attendance data received:', data);

        // Enforce strict visibility validation for Managers based on role hierarchy and department
        if (user?.role === 'manager' && user?.department) {
          const managerId = String(user.id);
          const normalizedDept = user.department.trim().toLowerCase();

          // Step 1: Find all Team Leads reporting to this Manager (within same department)
          const teamLeadIds = new Set<string>();
          Object.keys(userRoleMap).forEach((uId) => {
            const role = userRoleMap[uId];
            const dept = userDepartmentMap[uId];
            const managerIdForUser = userManagerMap[uId];

            // Team Lead in same department (allow all Team Leads in department to be visible to Manager)
            if (role === 'teamlead' && dept === normalizedDept) {
              teamLeadIds.add(uId);
            }
          });

          // Step 2: Find all Employees reporting to those Team Leads (within same department)
          const allowedEmployeeIds = new Set<string>();
          Object.keys(userRoleMap).forEach((uId) => {
            const role = userRoleMap[uId];
            const dept = userDepartmentMap[uId];
            const teamLeadIdForUser = userTeamLeadMap[uId];

            // Employee reporting to a Team Lead that reports to this Manager, in same department
            if (role === 'employee' && dept === normalizedDept && teamLeadIdForUser && teamLeadIds.has(teamLeadIdForUser)) {
              allowedEmployeeIds.add(uId);
            }
          });

          // Step 3: Filter attendance records based on allowed users
          data = data.filter((rec: any) => {
            const recUserId = String(rec.user_id || rec.userId);
            const recDept = (rec.department || '').trim().toLowerCase();

            // 1. Always show Self (Manager)
            if (recUserId === managerId) return true;

            // 2. Department must match (mandatory)
            if (recDept !== normalizedDept) return false;

            // 3. Check if user is in allowed set (Team Lead or Employee in reporting chain)
            if (teamLeadIds.has(recUserId)) return true; // Team Lead reporting to Manager
            if (allowedEmployeeIds.has(recUserId)) return true; // Employee reporting to Team Lead

            // 4. Explicitly exclude:
            //    - Other Managers (even in same department)
            //    - Admins
            //    - HR
            //    - Users outside reporting chain
            const recRole = userRoleMap[recUserId];
            if (recRole === 'admin' || recRole === 'hr' || recRole === 'manager') {
              return false;
            }

            // 5. If role is team_lead but not in our teamLeadIds set, exclude
            if (recRole === 'teamlead' && !teamLeadIds.has(recUserId)) {
              return false;
            }

            // 6. If role is employee but not in our allowedEmployeeIds set, exclude
            if (recRole === 'employee' && !allowedEmployeeIds.has(recUserId)) {
              return false;
            }

            // Default: exclude unknown users
            return false;
          });

          console.log('Manager attendance filtering:', {
            managerId,
            department: normalizedDept,
            teamLeadIds: Array.from(teamLeadIds),
            allowedEmployeeIds: Array.from(allowedEmployeeIds),
            filteredRecordsCount: data.length
          });
        }

        // Transform backend data to EmployeeAttendance format
        const transformedData: EmployeeAttendance[] = data
          .map((rec: any) => {
            const checkIn = rec.check_in || rec.checkInTime;
            const checkOut = rec.check_out || rec.checkOutTime;
            const checkInDate = checkIn ? new Date(checkIn) : null;

            const status = (rec.status || 'present').toLowerCase();
            const checkInStatus = rec.checkInStatus || rec.check_in_status || null;
            const checkOutStatus = rec.checkOutStatus || rec.check_out_status || null;
            const scheduledStart = rec.scheduledStart || rec.scheduled_start || null;
            const scheduledEnd = rec.scheduledEnd || rec.scheduled_end || null;

            // Normalize work location from backend
            // Backend should return the correct work location based on WFH approval and check-in type
            let workLocation = rec.workLocation || rec.work_location;

            // Normalize work location values to backend-accepted enums: "office" or "work_from_home"
            if (workLocation === 'work_from_home' || workLocation === 'wfh' || workLocation === 'WFH' || workLocation === 'Work From Home') {
              workLocation = 'work_from_home';
            } else if (workLocation === 'work_from_office' || workLocation === 'office' || workLocation === 'Office' || workLocation === 'Work From Office') {
              workLocation = 'office';
            } else {
              // Default to office only if work location is truly not set
              // This should not happen if backend is correctly setting work location
              workLocation = 'office';
            }

            return {
              id: String(rec.attendance_id || rec.id || ''),
              userId: String(rec.user_id || rec.userId || ''),
              userName: rec.userName || rec.name || 'Unknown',
              userEmail: rec.userEmail || rec.email || '',
              employeeId: rec.employee_id || rec.employeeId || String(rec.user_id || rec.userId || ''),
              department: rec.department || 'N/A',
              date: checkInDate ? formatDateIST(checkInDate) : todayIST(),
              checkInTime: checkIn || undefined,
              checkOutTime: checkOut || undefined,
              checkInLocation: {
                latitude: 0,
                longitude: 0,
                address: rec.checkInLocationLabel || rec.locationLabel || rec.gps_location || rec.checkInLocation?.address || 'N/A'
              },
              checkInSelfie: resolveMediaUrl(rec.checkInSelfie || rec.selfie || rec.selfie_url),
              checkOutSelfie: resolveMediaUrl(rec.checkOutSelfie || rec.check_out_selfie || rec.checkout_selfie_url),
              status: (status as any) || 'present',
              workHours: rec.total_hours || rec.workHours || 0,
              checkInStatus: checkInStatus || undefined,
              checkOutStatus: checkOutStatus || undefined,
              scheduledStart: scheduledStart || undefined,
              scheduledEnd: scheduledEnd || undefined,
              workSummary: rec.workSummary || rec.work_summary || null,
              workReport: resolveMediaUrl(rec.workReport || rec.work_report),
              taskDeadlineReason: rec.taskDeadlineReason || rec.task_deadline_reason || rec.taskPendingReason || rec.task_pending_reason || null,
              workLocation: workLocation,
            };
          })
          .sort((a, b) => {
            // Sort by date descending
            const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateCompare !== 0) return dateCompare;

            // If same date, sort by check-in time descending
            const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
            const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
            return timeB - timeA;
          });

        console.log('Transformed attendance records:', transformedData);
        setAttendanceRecords(transformedData);
      } catch (err) {
        console.error('loadAllAttendance error', err);
        toast({
          title: 'Error',
          description: 'Failed to load attendance records. Please try again.',
          variant: 'destructive',
        });
      }
    })();
  };

  const filterRecords = () => {
    let filtered = [...attendanceRecords];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.employeeId && record.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.userId && record.userId.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(record => {
        const statusValue = record.status?.toLowerCase() || '';
        const checkInStatusValue = record.checkInStatus?.toLowerCase() || '';
        const checkOutStatusValue = record.checkOutStatus?.toLowerCase() || '';
        if (filterStatus === 'late') {
          return statusValue === 'late' || checkInStatusValue === 'late';
        }
        if (filterStatus === 'early') {
          return checkOutStatusValue === 'early';
        }
        if (filterStatus === 'present') {
          return statusValue === 'present' && checkOutStatusValue !== 'early';
        }
        if (filterStatus === 'absent') {
          return statusValue === 'absent' || !record.checkInTime;
        }
        return true;
      });
    }

    // Filter by date or time period
    if (timePeriodFilter === 'today') {
      const todayStr = todayIST();
      filtered = filtered.filter(record => record.date === todayStr);
    } else {
      const today = new Date();
      let startDateRange: Date = new Date();
      let endDateRange: Date = new Date();
      endDateRange.setHours(23, 59, 59, 999);

      switch (timePeriodFilter) {
        case 'current_month':
          startDateRange = new Date(today.getFullYear(), today.getMonth(), 1);
          startDateRange.setHours(0, 0, 0, 0);
          break;
        case 'last_month':
          const lastMonth = subMonths(today, 1);
          startDateRange = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
          startDateRange.setHours(0, 0, 0, 0);
          endDateRange = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
          endDateRange.setHours(23, 59, 59, 999);
          break;
        case 'last_3_months':
          startDateRange = subMonths(today, 3);
          startDateRange.setHours(0, 0, 0, 0);
          break;
        case 'last_6_months':
          startDateRange = subMonths(today, 6);
          startDateRange.setHours(0, 0, 0, 0);
          break;
        case 'last_12_months':
          startDateRange = subMonths(today, 12);
          startDateRange.setHours(0, 0, 0, 0);
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            startDateRange = new Date(customStartDate);
            startDateRange.setHours(0, 0, 0, 0);
            endDateRange = new Date(customEndDate);
            endDateRange.setHours(23, 59, 59, 999);
          }
          break;
      }

      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= startDateRange && recordDate <= endDateRange;
      });
    }

    setFilteredRecords(filtered);
  };

  const getStatusBadge = (record: EmployeeAttendance) => {
    const badges: React.ReactNode[] = [];

    if (!record.checkOutTime) {
      badges.push(
        <Badge
          key="active"
          variant="default"
          className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 shadow-sm"
        >
          <Timer className="h-2.5 w-2.5" />
          {t.attendance.awaiting}
        </Badge>,
      );
    }

    if (record.checkInStatus === 'late' || record.status === 'late') {
      badges.push(
        <Badge
          key="late"
          variant="destructive"
          className="bg-red-500 hover:bg-red-600 text-white text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 shadow-sm"
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {t.attendance.late}
        </Badge>,
      );
    }

    if (record.checkOutStatus === 'early') {
      badges.push(
        <Badge
          key="early"
          variant="outline"
          className="border-orange-500 bg-orange-50 text-orange-600 hover:bg-orange-100 text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 shadow-sm"
        >
          <LogOut className="h-2.5 w-2.5" />
          {t.attendance.early}
        </Badge>,
      );
    }

    if (badges.length === 0) {
      badges.push(
        <Badge
          key="ontime"
          variant="default"
          className="bg-green-500 hover:bg-green-600 text-white text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 shadow-sm"
        >
          <CheckCircle2 className="h-2.5 w-2.5" />
          {t.attendance.onTime}
        </Badge>,
      );
    }

    return badges;
  };

  const formatAttendanceTime = (dateString: string, timeString?: string) => {
    if (!timeString) return '-';
    return formatDateTimeComponentsIST(dateString, timeString, 'hh:mm a');
  };

  const handleQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    switch (filter) {
      case 'current_month':
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        setStartDate(firstDayOfMonth);
        setEndDate(today);
        break;
      case 'last_month':
        setStartDate(subMonths(today, 1));
        setEndDate(today);
        break;
      case 'last_3_months':
        setStartDate(subMonths(today, 3));
        setEndDate(today);
        break;
      case 'last_6_months':
        setStartDate(subMonths(today, 6));
        setEndDate(today);
        break;
      case 'last_year':
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        setStartDate(oneYearAgo);
        setEndDate(today);
        break;
      case 'custom':
        // Don't modify dates when custom is selected, let user choose
        break;
    }
  };

  const handleWfhDecisionsDurationFilter = (filter: string) => {
    setWfhDecisionsDurationFilter(filter);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    switch (filter) {
      case 'current_month':
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        setWfhDecisionsStartDate(firstDayOfMonth);
        setWfhDecisionsEndDate(today);
        break;
      case 'last_month':
        setWfhDecisionsStartDate(subMonths(today, 1));
        setWfhDecisionsEndDate(today);
        break;
      case 'last_3_months':
        setWfhDecisionsStartDate(subMonths(today, 3));
        setWfhDecisionsEndDate(today);
        break;
      case 'last_6_months':
        setWfhDecisionsStartDate(subMonths(today, 6));
        setWfhDecisionsEndDate(today);
        break;
      case 'last_year':
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        setWfhDecisionsStartDate(oneYearAgo);
        setWfhDecisionsEndDate(today);
        break;
      case 'custom':
        // Don't modify dates when custom is selected, let user choose
        break;
      case 'all':
        setWfhDecisionsStartDate(undefined);
        setWfhDecisionsEndDate(undefined);
        break;
    }
  };

  const openExportModal = () => {
    setExportType(null);
    setExportModalOpen(true);
    // Set default dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    setEndDate(today);
    setStartDate(undefined);
    setQuickFilter('custom');
    setEmployeeFilter('all');
    setEmployeeSearch('');
    setSelectedEmployee(null);
    setSelectedDepartmentFilter('');
    setFilteredEmployees([]);
  };

  const performExport = async () => {
    if (!startDate && !endDate) {
      toast({
        title: 'Date Range Required',
        description: 'Please select at least a start date or end date for the export.',
        variant: 'destructive',
      });
      return;
    }

    if (employeeFilter === 'specific' && !selectedEmployee) {
      toast({
        title: 'Employee Selection Required',
        description: 'Please select an employee to export their data.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    setExportModalOpen(false);

    try {
      const exportParams: {
        employee_id?: string;
        department?: string;
        start_date?: string;
        end_date?: string;
      } = {};

      if (employeeFilter === 'specific' && selectedEmployee) {
        exportParams.employee_id = selectedEmployee.employee_id || selectedEmployee.user_id.toString();
        if (selectedDepartmentFilter) {
          exportParams.department = selectedDepartmentFilter;
        }
      }

      // Enforce department scope for Manager exports
      if (user?.role === 'manager' && user?.department) {
        exportParams.department = user.department;
      }

      if (startDate) {
        exportParams.start_date = format(startDate, 'yyyy-MM-dd');
      }

      if (endDate) {
        exportParams.end_date = format(endDate, 'yyyy-MM-dd');
      }

      // Use apiService for export with proper authentication
      let blob: Blob;
      if (reportLayout === 'grid') {
        // Grid export needs month and year
        const exportMonth = startDate ? (startDate.getMonth() + 1).toString() : (new Date().getMonth() + 1).toString();
        const exportYear = startDate ? startDate.getFullYear().toString() : new Date().getFullYear().toString();

        blob = exportType === 'csv'
          ? await apiService.exportMonthlyGridCSV({
            month: exportMonth,
            year: exportYear,
            department: exportParams.department
          })
          : await apiService.exportMonthlyGridPDF({
            month: exportMonth,
            year: exportYear,
            department: exportParams.department
          });
      } else if (reportLayout === 'detailed_grid') {
        // Detailed Grid export also needs month and year
        const exportMonth = startDate ? (startDate.getMonth() + 1).toString() : (new Date().getMonth() + 1).toString();
        const exportYear = startDate ? startDate.getFullYear().toString() : new Date().getFullYear().toString();

        blob = exportType === 'csv'
          ? await apiService.exportMonthlyGridDetailedCSV({
            month: exportMonth,
            year: exportYear,
            department: exportParams.department
          })
          : await apiService.exportMonthlyGridDetailedPDF({
            month: exportMonth,
            year: exportYear,
            department: exportParams.department
          });
      } else {
        blob = exportType === 'csv'
          ? await apiService.exportAttendanceCSV(exportParams)
          : await apiService.exportAttendancePDF(exportParams);
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const dateStr = startDate && endDate
        ? `${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}`
        : startDate
          ? `from_${format(startDate, 'yyyyMMdd')}`
          : endDate
            ? `until_${format(endDate, 'yyyyMMdd')}`
            : 'all';

      const empStr = employeeFilter === 'specific' && selectedEmployee
        ? `_${selectedEmployee.employee_id || selectedEmployee.user_id}`
        : '';

      a.download = `${reportLayout}_attendance_report${empStr}_${dateStr}.${exportType}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Attendance data exported as ${exportType?.toUpperCase()} successfully.`,
        variant: 'default',
      });
    } catch (err) {
      console.error(`Export ${exportType} failed`, err);
      let message = String(err);
      if (err && typeof err === 'object' && 'message' in err) {
        message = (err as any).message || message;
      }
      toast({
        title: 'Export Failed',
        description: `Failed to export ${exportType?.toUpperCase()}: ${message}`,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };




  const todayStats = {
    total: summary.total_employees,
    present: summary.present_today,
    late: summary.late_arrivals,
    early: summary.early_departures,
  };

  const formatTimeDisplay = (timeValue?: string | null) => {
    if (!timeValue) return '--:--';
    const normalized = timeValue.includes(':') ? timeValue.slice(0, 5) : timeValue;
    const [hour, minute] = normalized.split(':');
    if (hour === undefined || minute === undefined) return normalized;
    try {
      const date = new Date();
      date.setHours(Number(hour), Number(minute));
      return formatTimeIST(date, 'HH:mm');
    } catch {
      return normalized;
    }
  };

  const globalTimingEntry = officeTimings.find(
    (entry) => !entry.department || entry.department === '',
  );
  const configuredDepartmentCount = officeTimings.filter(
    (entry) => entry.department && entry.department.trim(),
  ).length;
  const officeQuickStats = [
    {
      label: 'Default Start',
      value: formatTimeDisplay(globalTimingEntry?.start_time || globalTimingForm.startTime),
      accent: 'from-blue-500 to-indigo-500',
    },
    {
      label: 'Default End',
      value: formatTimeDisplay(globalTimingEntry?.end_time || globalTimingForm.endTime),
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      label: 'Check-in Grace',
      value: `${globalTimingEntry?.check_in_grace_minutes ?? resolveGraceValue(globalTimingForm.checkInGrace)} mins`,
      accent: 'from-orange-500 to-amber-500',
    },
    {
      label: 'Check-out Grace',
      value: `${globalTimingEntry?.check_out_grace_minutes ?? resolveGraceValue(globalTimingForm.checkOutGrace)} mins`,
      accent: 'from-purple-500 to-pink-500',
    },
  ];

  const handleDepartmentSelect = (value: string) => {
    if (value === '__clear__') {
      setDepartmentTimingForm({
        department: '',
        startTime: globalTimingForm.startTime,
        endTime: globalTimingForm.endTime,
        checkInGrace: globalTimingForm.checkInGrace,
        checkOutGrace: globalTimingForm.checkOutGrace,
      });
      return;
    }

    const target = officeTimings.find(
      (entry) =>
        entry.department &&
        entry.department.trim().toLowerCase() === value.trim().toLowerCase(),
    );

    if (target) {
      handleDepartmentTimingEdit(target);
    } else {
      setDepartmentTimingForm((prev) => ({
        ...prev,
        department: value,
      }));
    }
  };

  // Load WFH requests for Admin (only HR and Manager requests)
  const loadAdminWfhRequests = async () => {
    if (!isAdmin) return;

    setIsLoadingWfhRequests(true);
    try {
      // Call API to get all WFH requests for admin/hr/manager approval
      const response = await apiService.getAllWFHRequests();

      // Handle response - it might be wrapped in an object or be an array directly
      let requests = Array.isArray(response) ? response : (response?.data || response?.requests || []);

      // Transform API response to match our UI format
      // The API returns requests with fields like: wfh_id, user_id, start_date, end_date, wfh_type, reason, status, employee_id, name, department, role, approver_name
      const formattedRequests = requests.map((req: any) => ({
        id: String(req.wfh_id || req.id),
        startDate: req.start_date,
        endDate: req.end_date,
        reason: req.reason,
        type: (req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day',
        status: (req.status || 'Pending').toLowerCase(),
        submittedAt: req.created_at,
        submittedBy: req.name || req.employee_name || 'Unknown',
        submittedById: String(req.user_id),
        employeeId: req.employee_id || '',
        department: req.department || 'Unknown',
        role: (req.role || 'employee').toLowerCase(),
        processedAt: req.updated_at,
        processedBy: req.approver_name || req.approved_by || 'Pending',
        rejectionReason: req.rejection_reason,
      }));

      setAllWfhRequests(formattedRequests);
    } catch (error: any) {
      // Silently fail - endpoint may not be implemented yet
      // The API method already handles errors gracefully
      setAllWfhRequests([]);
    } finally {
      setIsLoadingWfhRequests(false);
    }
  };

  // Handle WFH request approval/rejection for Admin
  const handleAdminWfhRequestAction = async (requestId: string, action: 'approve' | 'reject', reason?: string) => {
    setIsProcessingWfhRequest(true);
    try {
      // Call API to approve/reject WFH request
      const wfhId = parseInt(requestId);
      const approved = action === 'approve';

      await apiService.approveWFHRequest(wfhId, approved, reason);

      // Update local state optimistically
      const currentTime = new Date();
      setAllWfhRequests(prev =>
        prev.map(req =>
          req.id === requestId
            ? {
              ...req,
              status: action === 'approve' ? 'approved' : 'rejected',
              processedAt: currentTime.toISOString(),
              processedBy: user?.name || 'Admin',
              rejectionReason: action === 'reject' ? reason : undefined
            }
            : req
        )
      );

      toast({
        title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `WFH request has been ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
        variant: 'default',
      });

      setShowWfhRequestDialog(false);
      setSelectedWfhRequest(null);

      // Reload requests to ensure consistency
      await loadAdminWfhRequests();
    } catch (error) {
      console.error('Error processing WFH request:', error);
      toast({
        title: 'Action Failed',
        description: `Failed to ${action} the request. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingWfhRequest(false);
    }
  };

  // Get filtered WFH requests for Admin
  const getFilteredAdminWfhRequests = () => {
    if (wfhRequestFilter === 'all') return allWfhRequests;
    return allWfhRequests.filter(req => req.status === wfhRequestFilter);
  };

  // Get pending requests count for Admin badge
  const getAdminPendingWfhCount = () => {
    return allWfhRequests.filter(req => req.status === 'pending').length;
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

  const attendanceContent = (
    <div className="space-y-6">
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
              {t.attendance.employeeAttendance}
            </h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <Users className="h-4 w-4 text-blue-500" />
              {t.attendance.monitorTeamAttendance}
            </p>
          </div>
        </div>

        <div className="relative flex gap-3">
          <Button
            onClick={() => setExportModalOpen(true)}
            size="lg"
            className="rounded-xl px-6 h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 gap-2"
            disabled={isExporting}
          >
            <Download className="h-4 w-4" />
            {isExporting ? t.attendance.exporting : 'Export'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            title: t.attendance.totalEmployees,
            value: todayStats.total,
            sub: 'Active Workforce',
            icon: Users,
            color: 'blue',
            bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
            cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
            borderColor: 'border-blue-300/80 dark:border-blue-700/50',
            hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400',
          },
          {
            title: t.attendance.presentToday,
            value: todayStats.present,
            sub: 'Currently Active',
            icon: CheckCircle2,
            color: 'emerald',
            bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
            cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
            borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
            hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400',
          },
          {
            title: t.attendance.lateArrivals,
            value: todayStats.late,
            sub: 'Beyond Grace Period',
            icon: Timer,
            color: 'orange',
            bg: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
            cardBg: 'bg-orange-50/40 dark:bg-orange-950/10',
            borderColor: 'border-orange-300/80 dark:border-orange-700/50',
            hoverBorder: 'group-hover:border-orange-500 dark:group-hover:border-orange-400',
          },
          {
            title: t.attendance.earlyDepartures,
            value: todayStats.early,
            sub: 'Before Working Hours',
            icon: LogOut,
            color: 'amber',
            bg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
            cardBg: 'bg-amber-50/40 dark:bg-amber-950/10',
            borderColor: 'border-amber-300/80 dark:border-amber-700/50',
            hoverBorder: 'group-hover:border-amber-500 dark:group-hover:border-amber-400',
          },
        ].map((item, i) => (
          <Card
            key={i}
            className={`border-2 ${item.borderColor} ${item.hoverBorder} shadow-sm ${item.cardBg} backdrop-blur-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative cursor-pointer`}
          >
            {/* Background Accent */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${item.bg.split(' ')[0]}`} />

            <CardContent className="p-5 relative">
              <div className="flex justify-between items-start mb-3">
                <div className={`p-2.5 rounded-xl ${item.bg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest leading-none">{item.title}</h3>
                <div className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{item.value}</div>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/50 dark:bg-gray-900/30 border border-black/5 dark:border-white/5">
                  <div className={`h-1.5 w-1.5 rounded-full ${item.color === 'blue' ? 'bg-blue-500' :
                    item.color === 'emerald' ? 'bg-emerald-500' :
                      item.color === 'orange' ? 'bg-orange-500' :
                        'bg-amber-500'
                    }`} />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.sub}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200/60 border shadow-sm bg-white rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/30 px-5 py-4">
          <CardTitle className="text-sm font-bold text-slate-900">{t.attendance.attendanceRecords}</CardTitle>
          <CardDescription className="text-[11px] font-medium">{t.attendance.viewAndManage}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:flex-wrap gap-3 mb-6">
            <div className="w-full md:w-[260px] lg:w-[320px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.attendance.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                  className="pl-10 h-11 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-[160px] h-11 bg-white dark:bg-gray-950 border-2">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="early">Early Departure</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timePeriodFilter} onValueChange={(value: any) => setTimePeriodFilter(value)}>
              <SelectTrigger className={`${timePeriodFilter === 'custom' ? 'md:w-[320px]' : 'md:w-[180px]'} w-full h-11 bg-white dark:bg-gray-950 border-2 text-slate-700 dark:text-slate-200 transition-all duration-300`}>
                <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                <SelectValue>
                  {timePeriodFilter === 'custom'
                    ? (customStartDate && customEndDate
                      ? `Custom: ${formatDateIST(customStartDate)} - ${formatDateIST(customEndDate)}`
                      : 'Custom Range')
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="current_month">Current Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                <SelectItem value="last_12_months">Last 1 Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {timePeriodFilter === 'custom' && (
              <div className="w-full mt-2 p-4 border rounded-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-800 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      From Date
                    </Label>
                    <DatePicker
                      date={customStartDate}
                      onDateChange={setCustomStartDate}
                      toDate={new Date()}
                      placeholder="Start Date"
                      className="w-full bg-white dark:bg-gray-950 border-blue-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      To Date
                    </Label>
                    <DatePicker
                      date={customEndDate}
                      onDateChange={setCustomEndDate}
                      toDate={new Date()}
                      placeholder="End Date"
                      className="w-full bg-white dark:bg-gray-950 border-indigo-200"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {timePeriodFilter === 'custom' && customStartDate && customEndDate && isAfter(customStartDate, customEndDate) && (
            <p className="text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/30 p-2 rounded-md border border-red-200 dark:border-red-800 mb-4">
              "From Date" cannot be after "To Date". Please select a valid range.
            </p>
          )}

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
                  <tr className="hover:bg-transparent">
                    <th className="text-left p-3 font-medium">{t.attendance.employeeId}</th>
                    <th className="text-left p-3 font-medium">{t.attendance.employee}</th>
                    <th className="text-left p-3 font-medium">{t.attendance.department}</th>
                    <th className="text-left p-3 font-medium">Work Location</th>
                    <th className="text-left p-3 font-medium">Online Status</th>
                    <th className="text-left p-3 font-medium">{t.attendance.checkInTime}</th>
                    <th className="text-left p-3 font-medium">{t.attendance.checkOutTime}</th>
                    <th className="text-left p-3 font-medium">{t.attendance.hours}</th>
                    <th className="text-left p-3 font-medium">{t.attendance.location}</th>
                    <th className="text-left p-3 font-medium">{t.attendance.selfiePhoto}</th>
                    <th className="text-left p-3 font-medium">{t.common.status}</th>
                    <th className="text-left p-3 font-medium">{t.attendance.workSummary}</th>
                    <th className="text-left p-3 font-medium">{t.attendance.workReport}</th>
                    <th className="text-left p-3 font-medium">Overdue Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords
                      .slice((currentPage - 1) * itemsPerPage, (currentPage - 1) * itemsPerPage + itemsPerPage)
                      .map((record) => (
                        <tr key={record.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-sm">{record.employeeId || record.userId || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground">ID: {record.userId}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{record.userName}</p>
                              <p className="text-sm text-muted-foreground">{record.userEmail}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{record.department}</Badge>
                          </td>
                          <td className="p-3">
                            {record.workLocation === 'work_from_home' ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                                <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></div>
                                <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Work from Home</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                <div className="h-2 w-2 rounded-sm bg-blue-500"></div>
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                  Work from Office
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {(() => {
                              const statusInfo = getOnlineStatusForDisplay(record);
                              if (statusInfo.showAbsent) {
                                return (
                                  <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white text-xs">
                                    Absent
                                  </Badge>
                                );
                              } else if (statusInfo.label === 'Checked Out') {
                                return <span className="text-xs text-muted-foreground">Checked Out</span>;
                              } else {
                                return (
                                  <OnlineStatusIndicator
                                    isOnline={statusInfo.isOnline}
                                    size="md"
                                    showLabel={true}
                                    clickable={isAdmin}
                                    attendanceId={parseInt(record.id)}
                                    userId={parseInt(record.userId)}
                                    userName={record.userName}
                                  />
                                );
                              }
                            })()}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatAttendanceTime(record.date, record.checkInTime)}</span>
                            </div>
                            {record.scheduledStart && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Scheduled: {record.scheduledStart}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-red-500" />
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatAttendanceTime(record.date, record.checkOutTime)}</span>
                            </div>
                            {record.scheduledEnd && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Scheduled: {record.scheduledEnd}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {record.workHours ? (
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatWorkHours(record.workHours)}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {record.checkInLocation?.address && record.checkInLocation.address !== '-' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLocationModal({ open: true, location: record })}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 h-8 px-3"
                              >
                                <MapPin className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div
                              className="h-10 w-10 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowSelfieModal(true);
                              }}
                            >
                              {record.checkInSelfie ? (
                                <img
                                  src={record.checkInSelfie}
                                  alt={`${record.userName}'s selfie`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.currentTarget as HTMLImageElement;
                                    target.style.display = 'none';
                                    // Create fallback div
                                    const fallback = document.createElement('div');
                                    fallback.className = 'w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center';
                                    fallback.innerHTML = '<svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>';
                                    target.parentNode?.appendChild(fallback);
                                  }}
                                />
                              ) : null}
                              {!record.checkInSelfie && (
                                <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                  <User className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {getStatusBadge(record)}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground max-w-[200px]">
                            {record.workSummary ? (
                              <button
                                type="button"
                                className="text-left truncate max-w-[180px] hover:text-blue-600"
                                onClick={() => setSummaryModal({ open: true, summary: record.workSummary || '' })}
                              >
                                {record.workSummary.length > 40
                                  ? `${record.workSummary.slice(0, 40)}…`
                                  : record.workSummary}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-3">
                            {record.workReport ? (
                              <a
                                href={record.workReport}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                {t.attendance.viewReport}
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground max-w-[200px]">
                            {record.taskDeadlineReason ? (
                              <div className="text-left w-full">
                                <TruncatedText
                                  text={record.taskDeadlineReason}
                                  maxLength={40}
                                  showToggle={false}
                                />
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={14} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Search className="h-8 w-8 text-slate-400" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-lg font-semibold text-slate-900 dark:text-white">No records found</p>
                            <p className="text-sm text-muted-foreground">Try adjusting your filters or date range</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredRecords.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredRecords.length / itemsPerPage)}
                totalItems={filteredRecords.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                showItemsPerPage={true}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSelfieModal} onOpenChange={setShowSelfieModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedRecord?.userName}'s Attendance
            </DialogTitle>
            <DialogDescription>
              View check-in and check-out selfies with location and time information
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Check-in Selfie */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <h3 className="font-medium">{t.attendance.checkInSelfie}</h3>
              </div>
              <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {selectedRecord?.checkInSelfie ? (
                  <img
                    src={selectedRecord.checkInSelfie}
                    alt="Check-in selfie"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      // Create fallback div
                      const fallback = document.createElement('div');
                      fallback.className = 'w-full h-full flex flex-col items-center justify-center text-gray-400';
                      fallback.innerHTML = '<svg class="h-12 w-12 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg><p>No selfie available</p>';
                      target.parentNode?.appendChild(fallback);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <User className="h-12 w-12 mb-2" />
                    <p>{t.attendance.noSelfieAvailable}</p>
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
                <h3 className="font-medium">{t.attendance.checkOutSelfie}</h3>
              </div>
              <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {selectedRecord?.checkOutSelfie ? (
                  <img
                    src={selectedRecord.checkOutSelfie}
                    alt="Check-out selfie"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      // Create fallback div
                      const fallback = document.createElement('div');
                      fallback.className = 'w-full h-full flex flex-col items-center justify-center text-gray-400';
                      fallback.innerHTML = '<svg class="h-12 w-12 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg><p>No check-out selfie</p><p class="text-sm">Not checked out yet</p>';
                      target.parentNode?.appendChild(fallback);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <User className="h-12 w-12 mb-2" />
                    <p>{t.attendance.checkOutSelfie}</p>
                    <p className="text-sm">{t.attendance.notCheckedOut}</p>
                  </div>
                )}
                {selectedRecord?.checkOutTime && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                    <p className="font-medium">Check-out: {formatAttendanceTime(selectedRecord.date, selectedRecord.checkOutTime)}</p>
                    <p className="text-sm opacity-80">{selectedRecord.checkOutLocation?.address || 'Location not available'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSelfieModal(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={summaryModal.open}
        onOpenChange={(open) => setSummaryModal({ open, summary: open ? summaryModal.summary : null })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.attendance.workSummaryTitle}</DialogTitle>
            <DialogDescription>{t.attendance.workSummaryDescription}</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
            {summaryModal.summary || t.attendance.noSummaryProvided}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryModal({ open: false, summary: null })}>
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={locationModal.open}
        onOpenChange={(open) => setLocationModal({ open, location: open ? locationModal.location : null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              {t.attendance.checkInLocation}
            </DialogTitle>
            <DialogDescription>{t.attendance.fullLocationDetails}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{t.attendance.address}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed break-words">
                    {locationModal.location?.checkInLocation?.address || t.attendance.locationNotAvailable}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLocationModal({ open: false, location: null })}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-visible">
          <DialogHeader>
            <DialogTitle>{t.attendance.exportReport}</DialogTitle>
            <DialogDescription>
              {t.attendance.configureExport}
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
                      <LayoutGrid className="h-4.5 w-4.5" />
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
                  <SelectValue placeholder="Select time period" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="w-[var(--radix-select-trigger-width)] min-w-[200px] max-w-[400px] z-50"
                  sideOffset={5}
                  align="start"
                >
                  <SelectItem value="current_month" className="cursor-pointer hover:bg-blue-50">
                    Current Month
                  </SelectItem>
                  <SelectItem value="last_month" className="cursor-pointer hover:bg-blue-50">
                    Last Month
                  </SelectItem>
                  <SelectItem value="last_3_months" className="cursor-pointer hover:bg-blue-50">
                    Last 3 Months
                  </SelectItem>
                  <SelectItem value="last_6_months" className="cursor-pointer hover:bg-blue-50">
                    Last 6 Months
                  </SelectItem>
                  <SelectItem value="last_year" className="cursor-pointer hover:bg-blue-50">
                    Last 1 Year
                  </SelectItem>
                  <SelectItem value="custom" className="cursor-pointer hover:bg-blue-50">
                    Custom Date Range
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <DatePicker
                  date={startDate}
                  onDateChange={setStartDate}
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <DatePicker
                  date={endDate}
                  onDateChange={setEndDate}
                  placeholder="Select end date"
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
                    id="all-employees"
                    name="employee-filter"
                    checked={employeeFilter === 'all'}
                    onChange={() => {
                      setEmployeeFilter('all');
                      setSelectedEmployee(null);
                      setEmployeeSearch('');
                      setSelectedDepartmentFilter('');
                      setFilteredEmployees([]);
                    }}
                    className="h-4 w-4 text-blue-600"
                  />
                  <Label htmlFor="all-employees" className="cursor-pointer">All Employees</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="specific-employee"
                    name="employee-filter"
                    checked={employeeFilter === 'specific'}
                    onChange={() => {
                      setEmployeeFilter('specific');
                      setSelectedEmployee(null);
                      setSelectedDepartmentFilter('');
                      setEmployeeSearch('');
                      setFilteredEmployees([]);
                    }}
                    className="h-4 w-4 text-blue-600"
                  />
                  <Label htmlFor="specific-employee" className="cursor-pointer">Specific Employee</Label>
                </div>
              </div>
            </div>

            {/* Employee Selection */}
            {employeeFilter === 'specific' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="department-select" className="text-sm font-medium">Department</Label>
                  <Select
                    value={selectedDepartmentFilter}
                    onValueChange={(value) => {
                      setSelectedDepartmentFilter(value);
                      setSelectedEmployee(null);
                      setEmployeeSearch('');
                    }}
                  >
                    <SelectTrigger
                      id="department-select"
                      className="w-full h-10 border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    >
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="w-[var(--radix-select-trigger-width)] min-w-[200px] max-w-[400px] max-h-[300px] z-50"
                      sideOffset={5}
                      align="start"
                    >
                      {departments.length ? (
                        departments.map((dept) => (
                          <SelectItem key={dept} value={dept} className="cursor-pointer hover:bg-blue-50">
                            {dept}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__empty" disabled>
                          No departments available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDepartmentFilter ? (
                  <div className="space-y-2">
                    <Label htmlFor="employee-search">Select Employee</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="employee-search"
                        placeholder="Search by name or employee ID..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                        className="pl-10"
                      />
                    </div>
                    <div className="border rounded-md max-h-40 overflow-y-auto mt-2">
                      {filteredEmployees.length ? (
                        filteredEmployees.map((emp) => {
                          const isSelected = selectedEmployee?.user_id === emp.user_id;
                          return (
                            <button
                              type="button"
                              key={emp.user_id}
                              onClick={() => setSelectedEmployee(emp)}
                              className={`w-full text-left p-3 border-b last:border-b-0 transition-colors ${isSelected
                                ? 'bg-blue-50 dark:bg-blue-900'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                              <div className="font-medium">{emp.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {emp.employee_id ? `ID: ${emp.employee_id}` : 'User ID: ' + emp.user_id}
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
                    {selectedEmployee && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900 rounded-md flex items-center justify-between">
                        <div>
                          <div className="font-medium">{selectedEmployee.name}</div>
                          {selectedEmployee.employee_id && (
                            <div className="text-sm text-muted-foreground">ID: {selectedEmployee.employee_id}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedEmployee(null);
                            setEmployeeSearch('');
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
              disabled={isExporting || !exportType || (!startDate && !endDate) || (employeeFilter === 'specific' && !selectedEmployee)}
              className={exportType === 'csv' ? 'bg-green-600 hover:bg-green-700' : exportType === 'pdf' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {isExporting ? 'Exporting...' : exportType ? `Export ${exportType.toUpperCase()}` : 'Select Format'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const officeHoursContent = (
    <div className="space-y-6">
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-white to-purple-50/30 border border-purple-100/50 shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-purple-100/20 rounded-full blur-3xl -z-10" />
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-100/50 flex items-center justify-center border border-purple-200/50 shadow-sm group transition-all duration-300 hover:scale-110">
            <Clock className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
              Office Hours Control Center
            </h2>
            <p className="text-muted-foreground mt-0.5">Define global timings, override specific departments, and keep every team aligned.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {officeQuickStats.map((stat, index) => {
          const colors = ['blue', 'emerald', 'orange', 'purple'];
          const color = colors[index % colors.length];
          const icons = [Clock, Timer, Timer, Settings];
          const Icon = icons[index % icons.length];

          const subs = ['Office Opens', 'Office Closes', 'Late Threshold', 'Early Threshold'];
          const sub = subs[index % subs.length];

          // Replicating exact styles from Attendance Stats in lines 1097+
          const borderColor = `border-${color}-300/80 dark:border-${color}-700/50`;
          const hoverBorder = `group-hover:border-${color}-500 dark:group-hover:border-${color}-400`;
          const cardBg = `bg-${color}-50/40 dark:bg-${color}-950/10`;
          const iconBg = `bg-${color}-50 text-${color}-600 dark:bg-${color}-900/20 dark:text-${color}-400`;

          return (
            <Card
              key={stat.label}
              className={`border-2 ${borderColor} ${hoverBorder} shadow-sm ${cardBg} backdrop-blur-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative cursor-pointer`}
            >
              <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity bg-${color}-500`} />

              <CardContent className="p-5 relative">
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2.5 rounded-xl ${iconBg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest leading-none">{stat.label}</h3>
                  <div className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{stat.value}</div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/50 dark:bg-gray-900/30 border border-black/5 dark:border-white/5">
                    <div className={`h-1.5 w-1.5 rounded-full bg-${color}-500`} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{sub}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-xl border border-blue-100 dark:border-slate-800">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Global Office Hours</CardTitle>
            <CardDescription>
              Default schedule applied to every department unless specifically overridden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="global-start">
                  Start Time
                </Label>
                <div className="relative">
                  <Input
                    id="global-start"
                    type="time"
                    value={globalTimingForm.startTime}
                    onChange={(e) =>
                      setGlobalTimingForm((prev) => ({ ...prev, startTime: e.target.value }))
                    }
                    className="h-10 border-blue-100 focus:border-blue-400 pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    onClick={() => setOpenTimePicker((prev) => (prev === 'globalStart' ? null : 'globalStart'))}
                    aria-label="Set start time"
                  >
                    <Clock className="h-4 w-4 text-blue-500" />
                  </button>
                  {openTimePicker === 'globalStart' && (
                    <TimePickerDropdown
                      field="globalStart"
                      value={globalTimingForm.startTime}
                      accent="blue"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="global-end">
                  End Time
                </Label>
                <div className="relative">
                  <Input
                    id="global-end"
                    type="time"
                    value={globalTimingForm.endTime}
                    onChange={(e) =>
                      setGlobalTimingForm((prev) => ({ ...prev, endTime: e.target.value }))
                    }
                    className="h-10 border-blue-100 focus:border-blue-400 pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    onClick={() => setOpenTimePicker((prev) => (prev === 'globalEnd' ? null : 'globalEnd'))}
                    aria-label="Set end time"
                  >
                    <Clock className="h-4 w-4 text-blue-500" />
                  </button>
                  {openTimePicker === 'globalEnd' && (
                    <TimePickerDropdown
                      field="globalEnd"
                      value={globalTimingForm.endTime}
                      accent="blue"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="global-grace-in">
                  Check-in Grace (minutes)
                </Label>
                <Input
                  id="global-grace-in"
                  type="number"
                  min={0}
                  max={180}
                  value={globalTimingForm.checkInGrace}
                  onChange={(e) =>
                    setGlobalTimingForm((prev) => ({
                      ...prev,
                      checkInGrace: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  className="h-10 border-blue-100 focus:border-blue-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="global-grace-out">
                  Check-out Grace (minutes)
                </Label>
                <Input
                  id="global-grace-out"
                  type="number"
                  min={0}
                  max={180}
                  value={globalTimingForm.checkOutGrace}
                  onChange={(e) =>
                    setGlobalTimingForm((prev) => ({
                      ...prev,
                      checkOutGrace: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  className="h-10 border-blue-100 focus:border-blue-400"
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                className="border-2 border-blue-200 text-blue-600 hover:bg-blue-50 dark:text-blue-300"
                onClick={() => loadOfficeTimings()}
                disabled={officeFormLoading}
              >
                Refresh
              </Button>
              <Button
                onClick={handleGlobalTimingSave}
                disabled={isGlobalSaving || officeFormLoading}
                className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
              >
                {isGlobalSaving ? 'Saving...' : 'Save Global Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card ref={departmentFormRef} className="shadow-xl border border-purple-100 dark:border-slate-800 transition-all duration-300">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Department Timing</CardTitle>
            <CardDescription>
              Override the global schedule for particular departments or create new ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={departmentTimingForm.department || undefined}
                onValueChange={handleDepartmentSelect}
                disabled={coreDepartments.length === 0 && !departmentTimingForm.department}
              >
                <SelectTrigger className="h-10 border-purple-100 focus:border-purple-400">
                  <SelectValue
                    placeholder={
                      coreDepartments.length ? 'Select department' : 'No departments available'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {coreDepartments.length === 0 ? (
                    <SelectItem value="__no_departments__" disabled>
                      {departmentTimingForm.department
                        ? `Using existing: ${departmentTimingForm.department}`
                        : 'No departments found'}
                    </SelectItem>
                  ) : (
                    <>
                      {coreDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                      {departmentTimingForm.department &&
                        !coreDepartments.some(
                          (dept) =>
                            dept.trim().toLowerCase() ===
                            departmentTimingForm.department?.trim().toLowerCase(),
                        ) && (
                          <SelectItem value={departmentTimingForm.department} disabled>
                            {departmentTimingForm.department} (not in list)
                          </SelectItem>
                        )}
                      <SelectItem value="__clear__" className="text-red-500">
                        Clear Selection
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {coreDepartments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {coreDepartments.map((dept) => {
                    const isSelected =
                      dept.trim().toLowerCase() ===
                      departmentTimingForm.department?.trim().toLowerCase();
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => handleDepartmentSelect(dept)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${isSelected
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                          }`}
                      >
                        {dept}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dept-start">
                  Start Time
                </Label>
                <div className="relative">
                  <Input
                    id="dept-start"
                    type="time"
                    value={departmentTimingForm.startTime}
                    onChange={(e) =>
                      setDepartmentTimingForm((prev) => ({ ...prev, startTime: e.target.value }))
                    }
                    className="h-10 border-purple-100 focus:border-purple-400 pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    onClick={() => setOpenTimePicker((prev) => (prev === 'deptStart' ? null : 'deptStart'))}
                    aria-label="Set department start time"
                  >
                    <Clock className="h-4 w-4 text-purple-500" />
                  </button>
                  {openTimePicker === 'deptStart' && (
                    <TimePickerDropdown
                      field="deptStart"
                      value={departmentTimingForm.startTime}
                      accent="purple"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-end">
                  End Time
                </Label>
                <div className="relative">
                  <Input
                    id="dept-end"
                    type="time"
                    value={departmentTimingForm.endTime}
                    onChange={(e) =>
                      setDepartmentTimingForm((prev) => ({ ...prev, endTime: e.target.value }))
                    }
                    className="h-10 border-purple-100 focus:border-purple-400 pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    onClick={() => setOpenTimePicker((prev) => (prev === 'deptEnd' ? null : 'deptEnd'))}
                    aria-label="Set department end time"
                  >
                    <Clock className="h-4 w-4 text-purple-500" />
                  </button>
                  {openTimePicker === 'deptEnd' && (
                    <TimePickerDropdown
                      field="deptEnd"
                      value={departmentTimingForm.endTime}
                      accent="purple"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-grace-in">
                  Check-in Grace (minutes)
                </Label>
                <Input
                  id="dept-grace-in"
                  type="number"
                  min={0}
                  max={180}
                  value={departmentTimingForm.checkInGrace}
                  onChange={(e) =>
                    setDepartmentTimingForm((prev) => ({
                      ...prev,
                      checkInGrace: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  className="h-10 border-purple-100 focus:border-purple-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-grace-out">
                  Check-out Grace (minutes)
                </Label>
                <Input
                  id="dept-grace-out"
                  type="number"
                  min={0}
                  max={180}
                  value={departmentTimingForm.checkOutGrace}
                  onChange={(e) =>
                    setDepartmentTimingForm((prev) => ({
                      ...prev,
                      checkOutGrace: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  className="h-10 border-purple-100 focus:border-purple-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setDepartmentTimingForm({
                    department: '',
                    startTime: globalTimingForm.startTime,
                    endTime: globalTimingForm.endTime,
                    checkInGrace: globalTimingForm.checkInGrace,
                    checkOutGrace: globalTimingForm.checkOutGrace,
                  })
                }
                className="border-2 border-purple-200 text-purple-600 hover:bg-purple-50 dark:text-purple-300"
              >
                Reset
              </Button>
              <Button
                onClick={handleDepartmentTimingSave}
                disabled={isDeptSaving || officeFormLoading || !departmentTimingForm.department.trim()}
                className="gap-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 shadow-md"
              >
                {isDeptSaving ? 'Saving...' : 'Save Department Timing'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl border border-slate-100 dark:border-slate-800">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-semibold">Configured Schedules</CardTitle>
          <CardDescription>
            Overview of current global and department-specific office timings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {officeTimings.length > 0 ? (
            <div className="grid gap-4">
              {officeTimings.map((timing) => {
                const isGlobalTiming = !timing.department;
                return (
                  <div
                    key={timing.id}
                    className="group border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-sm hover:shadow-lg transition-shadow"
                  >
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {isGlobalTiming ? 'Global Schedule' : 'Department'}
                      </p>
                      <h3 className="text-xl font-semibold">
                        {isGlobalTiming ? 'All Departments' : timing.department}
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                          Start: {formatTimeDisplay(timing.start_time)}
                        </Badge>
                        <Badge variant="secondary" className="bg-green-50 text-green-700">
                          End: {formatTimeDisplay(timing.end_time)}
                        </Badge>
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                          Grace In: {timing.check_in_grace_minutes}m
                        </Badge>
                        <Badge variant="secondary" className="bg-rose-50 text-rose-700">
                          Grace Out: {timing.check_out_grace_minutes}m
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-2 border-blue-200 text-blue-600 hover:bg-blue-50 dark:text-blue-300"
                        onClick={() => handleDepartmentTimingEdit(timing)}
                      >
                        Edit
                      </Button>
                      {!isGlobalTiming && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-red-50"
                          onClick={() => handleDepartmentTimingDelete(timing)}
                          disabled={officeFormLoading}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center">
              <Clock className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-lg font-medium">No office timings configured yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start by adding a global schedule, then override specific departments as needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'attendance' | 'office-hours' | 'wfh-requests')}
          className="space-y-6"
        >
          <TabsList className="flex w-full md:w-auto">
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="office-hours" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Office Hours
            </TabsTrigger>
            <TabsTrigger value="wfh-requests" className="flex items-center gap-2 relative">
              <FileText className="h-4 w-4" />
              WFH Requests
              {getAdminPendingWfhCount() > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-red-500 text-white border-2 border-white dark:border-gray-800"
                >
                  {getAdminPendingWfhCount()}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="attendance" className="space-y-6">
            {attendanceContent}
          </TabsContent>
          <TabsContent value="office-hours" className="space-y-6">
            {officeHoursContent}
          </TabsContent>
          <TabsContent value="wfh-requests" className="space-y-6">
            {/* Pending WFH Requests Section */}
            <Card className="border-slate-200/60 border shadow-sm bg-white rounded-xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/30 px-5 py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-blue-600" />
                  WFH Pending Requests
                  {getAdminPendingWfhCount() > 0 && (
                    <Badge className="bg-rose-50 text-rose-600 hover:bg-rose-100 border-0 h-4.5 px-1.5 text-[10px] font-black">
                      {getAdminPendingWfhCount()}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-[11px] font-medium">Review and process recent work from home requests.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoadingWfhRequests ? (
                  <div className="flex items-center justify-center py-8">
                    <Timer className="h-8 w-8 animate-spin text-purple-600" />
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
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-blue-600" />
                                    <span className="font-medium">{request.submittedBy}</span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${request.role === 'hr'
                                        ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950'
                                        : 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950'
                                        }`}
                                    >
                                      {request.role === 'hr' ? 'HR' : 'Manager'}
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
                                <p className="text-sm text-muted-foreground">{request.reason}</p>
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
                                    onClick={() => handleAdminWfhRequestAction(request.id, 'approve')}
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
            <Card className="border-slate-200/60 border shadow-sm bg-white rounded-xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/30 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shadow-sm">
                      <History className="h-4.5 w-4.5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">Recent Decisions</CardTitle>
                      <CardDescription className="text-[11px] font-medium">History of processed WFH requests.</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Filter Controls for Recent Decisions */}
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1 max-w-xs">
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
                      <div className="flex-1 max-w-xs">
                        <Label htmlFor="decision-duration-filter">Duration</Label>
                        <Select value={wfhDecisionsDurationFilter} onValueChange={handleWfhDecisionsDurationFilter}>
                          <SelectTrigger id="decision-duration-filter" className="mt-1">
                            <SelectValue />
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
                      <div className="flex-1 max-w-xs">
                        <Label htmlFor="decision-role-filter">Role</Label>
                        <Select value={wfhRoleFilter} onValueChange={(value: any) => setWfhRoleFilter(value)}>
                          <SelectTrigger id="decision-role-filter" className="mt-1">
                            <SelectValue />
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
                      <div className="flex-1">
                        <Label>Total Decisions</Label>
                        <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm flex items-center justify-between">
                          <span>{allWfhRequests.filter(req => req.status !== 'pending' && (wfhRequestFilter === 'all' || req.status === wfhRequestFilter) && (wfhRoleFilter === 'all' || (req.role || 'employee').toLowerCase() === wfhRoleFilter)).length} of {allWfhRequests.filter(req => req.status !== 'pending').length} decisions</span>
                        </div>
                      </div>
                    </div>
                    {wfhDecisionsDurationFilter === 'custom' && (
                      <div className="p-4 border rounded-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-800 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              From Date
                            </Label>
                            <DatePicker
                              date={wfhDecisionsStartDate}
                              onDateChange={setWfhDecisionsStartDate}
                              toDate={new Date()}
                              placeholder="Start Date"
                              className="w-full bg-white dark:bg-gray-950 border-blue-200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
                              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                              To Date
                            </Label>
                            <DatePicker
                              date={wfhDecisionsEndDate}
                              onDateChange={setWfhDecisionsEndDate}
                              fromDate={wfhDecisionsStartDate}
                              toDate={new Date()}
                              placeholder="End Date"
                              className="w-full bg-white dark:bg-gray-950 border-indigo-200"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recent Decisions Table */}
                  {isLoadingWfhRequests ? (
                    <div className="flex items-center justify-center py-8">
                      <Timer className="h-8 w-8 animate-spin text-blue-600" />
                      <span className="ml-2 text-muted-foreground">Loading decisions...</span>
                    </div>
                  ) : allWfhRequests.filter(req => req.status !== 'pending' && (wfhRequestFilter === 'all' || req.status === wfhRequestFilter) && (wfhRoleFilter === 'all' || (req.role || 'employee').toLowerCase() === wfhRoleFilter)).length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {allWfhRequests
                          .filter(req => req.status !== 'pending' && (wfhRequestFilter === 'all' || req.status === wfhRequestFilter) && (wfhRoleFilter === 'all' || (req.role || 'employee').toLowerCase() === wfhRoleFilter))
                          .sort((a, b) => new Date(b.processedAt || b.submittedAt).getTime() - new Date(a.processedAt || a.submittedAt).getTime())
                          .slice((wfhCurrentPage - 1) * wfhItemsPerPage, wfhCurrentPage * wfhItemsPerPage)
                          .map((request) => (
                            <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                              <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4 text-blue-600" />
                                      <span className="font-medium">{request.submittedBy}</span>
                                      <Badge
                                        variant="outline"
                                        className={`text-xs ${request.role === 'hr'
                                          ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950'
                                          : 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950'
                                          }`}
                                      >
                                        {request.role === 'hr' ? 'HR' : 'Manager'}
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
                                  <p className="text-sm text-muted-foreground">{request.reason}</p>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>Submitted: {formatDateTimeIST(request.submittedAt, 'dd MMM yyyy, hh:mm a')}</span>
                                    <span>Decision: {formatDateTimeIST(request.processedAt || request.submittedAt, 'dd MMM yyyy, hh:mm a')}</span>
                                    <span>Department: {request.department}</span>
                                  </div>
                                  {request.rejectionReason && (
                                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mt-2">
                                      <p className="text-sm text-red-800 dark:text-red-200">
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
                      <div className="mt-4">
                        <Pagination
                          currentPage={wfhCurrentPage}
                          totalPages={Math.ceil(allWfhRequests.filter(req => req.status !== 'pending' && (wfhRequestFilter === 'all' || req.status === wfhRequestFilter)).length / wfhItemsPerPage)}
                          totalItems={allWfhRequests.filter(req => req.status !== 'pending' && (wfhRequestFilter === 'all' || req.status === wfhRequestFilter)).length}
                          itemsPerPage={wfhItemsPerPage}
                          onPageChange={setWfhCurrentPage}
                          onItemsPerPageChange={setWfhItemsPerPage}
                          showItemsPerPage={true}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No decisions yet</p>
                      <p className="text-sm">
                        {wfhRequestFilter === 'all' ? 'No requests have been approved or rejected' : `No ${wfhRequestFilter} requests`}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        attendanceContent
      )}

      {/* WFH Request Rejection Dialog for Admin */}
      <Dialog open={showWfhRequestDialog} onOpenChange={setShowWfhRequestDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-600" />
              Reject WFH Request
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this work from home request from HR/Manager.
            </DialogDescription>
          </DialogHeader>

          {selectedWfhRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{selectedWfhRequest.submittedBy}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${selectedWfhRequest.role === 'hr'
                        ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950'
                        : 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950'
                        }`}
                    >
                      {selectedWfhRequest.role === 'hr' ? 'HR' : 'Manager'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <span className="text-sm">
                      {formatDateIST(selectedWfhRequest.startDate, 'dd MMM yyyy')} - {formatDateIST(selectedWfhRequest.endDate, 'dd MMM yyyy')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedWfhRequest.reason}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-rejection-reason">Rejection Reason <span className="text-red-500">*</span></Label>
                <Textarea
                  id="admin-rejection-reason"
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
                  handleAdminWfhRequestAction(selectedWfhRequest.id, 'reject', selectedWfhRequest.rejectionReason);
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
                  <Timer className="h-4 w-4 mr-2 animate-spin" />
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
    </div>
  );
};

export default AttendanceManager;