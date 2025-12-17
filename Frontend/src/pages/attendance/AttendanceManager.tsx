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
import { Calendar, Clock, MapPin, Search, Filter, Download, AlertCircle, CheckCircle, Users, X, User, Settings, LogOut, AlertTriangle, CheckCircle2, Timer, FileSpreadsheet, FileText, Home, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { AttendanceRecord } from '@/types';
import { format, subMonths, subDays } from 'date-fns';
import { formatIST, formatDateTimeIST, formatTimeIST, formatDateIST, todayIST, formatDateTimeComponentsIST, parseToIST, nowIST } from '@/utils/timezone';
import { DatePicker } from '@/components/ui/date-picker';
import OnlineStatusIndicator from '@/components/attendance/OnlineStatusIndicator';

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
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<{ total_employees: number; present_today: number; late_arrivals: number; early_departures: number; absent_today: number }>({ total_employees: 0, present_today: 0, late_arrivals: 0, early_departures: 0, absent_today: 0 });
  
  // Export modal states
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf' | null>(null);
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
  const [activeTab, setActiveTab] = useState<'attendance' | 'office-hours' | 'wfh-requests'>('attendance');
  const [officeTimings, setOfficeTimings] = useState<OfficeTiming[]>([]);
  const [officeFormLoading, setOfficeFormLoading] = useState(false);
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
  const [wfhRequestFilter, setWfhRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedWfhRequest, setSelectedWfhRequest] = useState<any>(null);
  const [showWfhRequestDialog, setShowWfhRequestDialog] = useState(false);
  const [isProcessingWfhRequest, setIsProcessingWfhRequest] = useState(false);
  
  // Ref for scrolling to department form when editing
  const departmentFormRef = useRef<HTMLDivElement>(null);
 
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: token } : {};
  };

  const fetchAllOnlineStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://staffly.space/attendance/current-online-status', {
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
    return `https://staffly.space${normalized}`;
  };

  useEffect(() => {
    loadAllAttendance();
    fetchSummary();
    loadEmployees();
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
      const res = await fetch('https://staffly.space/employees');
      if (!res.ok) throw new Error(`Failed to load employees: ${res.status}`);
      const data = await res.json();
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
      const res = await fetch('https://staffly.space/attendance/office-hours', {
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
      if (timingDepartments.length) {
        setDepartments((prev) => {
          const merged = new Set(prev);
          timingDepartments.forEach((dept) => merged.add(dept));
          return Array.from(merged).sort((a, b) => a.localeCompare(b));
        });
      }
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
      setOfficeFormLoading(true);
      const payload = {
        department: null,
        start_time: globalTimingForm.startTime,
        end_time: globalTimingForm.endTime,
        check_in_grace_minutes: resolveGraceValue(globalTimingForm.checkInGrace),
        check_out_grace_minutes: resolveGraceValue(globalTimingForm.checkOutGrace),
      };
      const res = await fetch('https://staffly.space/attendance/office-hours', {
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
      setOfficeFormLoading(false);
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
      setOfficeFormLoading(true);
      const payload = {
        department: departmentTimingForm.department.trim(),
        start_time: departmentTimingForm.startTime,
        end_time: departmentTimingForm.endTime,
        check_in_grace_minutes: resolveGraceValue(departmentTimingForm.checkInGrace),
        check_out_grace_minutes: resolveGraceValue(departmentTimingForm.checkOutGrace),
      };
      const res = await fetch('https://staffly.space/attendance/office-hours', {
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
      setOfficeFormLoading(false);
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
      const res = await fetch(`https://staffly.space/attendance/office-hours/${timing.id}`, {
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
      const res = await fetch('https://staffly.space/attendance/summary');
      if (!res.ok) throw new Error(`Failed to load summary: ${res.status}`);
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error('fetchSummary error', err);
    }
  };

  useEffect(() => {
    filterRecords();
  }, [searchTerm, filterStatus, filterDate, attendanceRecords]);

  const loadAllAttendance = (targetDate?: string) => {
    // Fetch today's attendance from backend
    // For Admin/HR/Manager: Load today's attendance records
    (async () => {
      try {
        const query = targetDate ? `?date=${encodeURIComponent(targetDate)}` : '';
        const res = await fetch(`https://staffly.space/attendance/today${query}`);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Failed to load attendance: ${res.status}`, errorText);
          throw new Error(`Failed to load attendance: ${res.status} - ${errorText}`);
        }
        
        const data = await res.json();
        console.log('Attendance data received:', data);
        
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
              workLocation: rec.workLocation || rec.work_location || 'office',
            };
          })
          .reverse();
        
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
        return true;
      });
    }
    
    // Filter by date
    if (filterDate) {
      filtered = filtered.filter(record => record.date === filterDate);
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
      case 'custom':
        // Don't modify dates when custom is selected, let user choose
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
      const params = new URLSearchParams();
      
      if (employeeFilter === 'specific' && selectedEmployee) {
        params.append('employee_id', selectedEmployee.employee_id || selectedEmployee.user_id.toString());
        if (selectedDepartmentFilter) {
          params.append('department', selectedDepartmentFilter);
        }
      }
      
      if (startDate) {
        params.append('start_date', format(startDate, 'yyyy-MM-dd'));
      }
      
      if (endDate) {
        params.append('end_date', format(endDate, 'yyyy-MM-dd'));
      }

      const apiUrl = `https://staffly.space/attendance/download/${exportType}?${params.toString()}`;
      const res = await fetch(apiUrl, { method: 'GET' });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const blob = await res.blob();
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
      
      a.download = `attendance_report${empStr}_${dateStr}.${exportType}`;
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
      label: 'Overrides',
      value: configuredDepartmentCount,
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
      // Frontend-only implementation - Admin sees only HR and Manager requests
      // Generate timestamps that are accurate to the current time
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000); // 2 minutes ago
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      
      const adminWfhRequests = [
        {
          id: 'admin-sample-1',
          startDate: formatDateIST(new Date(now.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // Tomorrow
          endDate: formatDateIST(new Date(now.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          reason: 'Important client meeting requires home office setup for better connectivity',
          type: 'full_day',
          status: 'pending',
          submittedAt: twoMinutesAgo.toISOString(), // 2 minutes ago
          submittedBy: 'Sarah Johnson',
          submittedById: '201',
          department: 'Human Resources',
          role: 'hr',
        },
        {
          id: 'admin-sample-2',
          startDate: formatDateIST(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // Day after tomorrow
          endDate: formatDateIST(new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // 4 days from now
          reason: 'Team planning session and quarterly review preparation - need focused environment',
          type: 'full_day',
          status: 'pending',
          submittedAt: fifteenMinutesAgo.toISOString(), // 15 minutes ago
          submittedBy: 'Michael Chen',
          submittedById: '301',
          department: 'Engineering',
          role: 'manager',
        },
        {
          id: 'admin-sample-3',
          startDate: format(yesterday, 'yyyy-MM-dd'), // Yesterday
          endDate: format(yesterday, 'yyyy-MM-dd'),
          reason: 'Annual performance reviews and HR policy updates',
          type: 'full_day',
          status: 'approved',
          submittedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          submittedBy: 'Lisa Rodriguez',
          submittedById: '202',
          department: 'Human Resources',
          role: 'hr',
          processedAt: oneHourAgo.toISOString(), // 1 hour ago
          processedBy: 'Admin',
        }
      ];
      
      setAllWfhRequests(adminWfhRequests);
    } catch (error) {
      console.error('Failed to load WFH requests:', error);
    } finally {
      setIsLoadingWfhRequests(false);
    }
  };

  // Handle WFH request approval/rejection for Admin
  const handleAdminWfhRequestAction = async (requestId: string, action: 'approve' | 'reject', reason?: string) => {
    setIsProcessingWfhRequest(true);
    try {
      // Frontend-only implementation
      const currentTime = new Date(); // Use current time for accurate timestamp
      setAllWfhRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { 
                ...req, 
                status: action === 'approve' ? 'approved' : 'rejected',
                processedAt: currentTime.toISOString(), // Use current time
                processedBy: user?.name || 'Admin',
                rejectionReason: action === 'reject' ? reason : undefined
              }
            : req
        )
      );

      toast({
        title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `WFH request from ${action === 'approve' ? 'HR/Manager' : 'HR/Manager'} has been ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
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
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800 rounded-2xl p-6 shadow-sm border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Clock className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{t.attendance.employeeAttendance}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t.attendance.monitorTeamAttendance}</p>
            </div>
          </div>
          <Button 
            onClick={() => setExportModalOpen(true)} 
            variant="outline" 
            className="gap-2 bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-950 border-2 border-blue-600 hover:border-blue-700 font-medium shadow-md hover:shadow-lg transition-all"
            disabled={isExporting}
            style={{ color: '#2563eb' }}
          >
            <Download className="h-4 w-4" style={{ color: '#2563eb' }} />
            <span className="font-semibold" style={{ color: '#2563eb' }}>
              {isExporting ? t.attendance.exporting : 'Export'}
            </span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-50">{t.attendance.totalEmployees}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayStats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-50">{t.attendance.presentToday}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayStats.present}</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-50">{t.attendance.lateArrivals}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayStats.late}</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-yellow-50">{t.attendance.earlyDepartures}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayStats.early}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
          <CardTitle className="text-xl font-semibold">{t.attendance.attendanceRecords}</CardTitle>
          <CardDescription>{t.attendance.viewAndManage}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.attendance.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[200px] h-11 bg-white dark:bg-gray-950">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t.attendance.filterByStatus} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.attendance.allStatus}</SelectItem>
                <SelectItem value="present">{t.attendance.onSchedule}</SelectItem>
                <SelectItem value="late">{t.attendance.lateArrivals}</SelectItem>
                <SelectItem value="early">{t.attendance.earlyDepartures}</SelectItem>
              </SelectContent>
            </Select>
            <DatePicker
              date={selectedDate}
              onDateChange={(date) => {
                if (date) {
                  setSelectedDate(date);
                  const formatted = format(date, 'yyyy-MM-dd');
                  setFilterDate(formatted);
                  loadAllAttendance(formatted);
                }
              }}
              placeholder={t.attendance.selectDate}
              className="w-[200px]"
            />
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
                  <tr className="hover:bg-transparent">
                    <th className="text-left p-3 font-medium">{t.attendance.employee}</th>
                    <th className="text-left p-3 font-medium">{t.attendance.employeeId}</th>
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
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <tr key={record.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{record.userName}</p>
                            <p className="text-sm text-muted-foreground">{record.userEmail}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-sm">{record.employeeId || record.userId || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">ID: {record.userId}</p>
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
                              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Work from Office</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {!record.checkOutTime ? (
                            <OnlineStatusIndicator 
                              isOnline={onlineStatusMap[parseInt(record.userId)] ?? true} 
                              size="md"
                              showLabel={true}
                              clickable={isAdmin}
                              attendanceId={parseInt(record.id)}
                              userId={parseInt(record.userId)}
                              userName={record.userName}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">Checked Out</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-green-500" />
                            <span>{formatAttendanceTime(record.date, record.checkInTime)}</span>
                          </div>
                          {record.scheduledStart && (
                            <div className="text-xs text-muted-foreground">
                              {t.attendance.scheduled}: {record.scheduledStart}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-red-500" />
                            <span>{formatAttendanceTime(record.date, record.checkOutTime)}</span>
                          </div>
                          {record.scheduledEnd && (
                            <div className="text-xs text-muted-foreground">
                              {t.attendance.scheduled}: {record.scheduledEnd}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {record.workHours ? (
                            <Badge variant="secondary" className="font-mono">{formatWorkHours(record.workHours)}</Badge>
                          ) : '-'}
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{t.attendance.noRecordsFound}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
          <div className="py-4 text-sm text-muted-foreground whitespace-pre-wrap">
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
            {/* Export Format Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Export Format</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportType('csv')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    exportType === 'csv'
                      ? 'border-green-600 bg-green-50 dark:bg-green-950'
                      : 'border-gray-200 hover:border-green-300 dark:border-gray-700'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className={`h-8 w-8 ${exportType === 'csv' ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold ${exportType === 'csv' ? 'text-green-600' : 'text-gray-600'}`}>
                      CSV
                    </span>
                    <span className="text-xs text-muted-foreground text-center">
                      Excel compatible
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setExportType('pdf')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    exportType === 'pdf'
                      ? 'border-red-600 bg-red-50 dark:bg-red-950'
                      : 'border-gray-200 hover:border-red-300 dark:border-gray-700'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileText className={`h-8 w-8 ${exportType === 'pdf' ? 'text-red-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold ${exportType === 'pdf' ? 'text-red-600' : 'text-gray-600'}`}>
                      PDF
                    </span>
                    <span className="text-xs text-muted-foreground text-center">
                      Print ready
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
                  <SelectItem value="last_month" className="cursor-pointer hover:bg-blue-50">
                    Last Month
                  </SelectItem>
                  <SelectItem value="last_3_months" className="cursor-pointer hover:bg-blue-50">
                    Last 3 Months
                  </SelectItem>
                  <SelectItem value="last_6_months" className="cursor-pointer hover:bg-blue-50">
                    Last 6 Months
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
                        onChange={(e) => setEmployeeSearch(e.target.value)}
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
                              className={`w-full text-left p-3 border-b last:border-b-0 transition-colors ${
                                isSelected
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
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/15 flex items-center justify-center shadow-lg">
              <Clock className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest text-white/70">Scheduling Hub</p>
              <h2 className="text-3xl font-bold">Office Hours Control Center</h2>
              <p className="text-white/80 mt-1">
                Define global timings, override specific departments, and keep every team aligned.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {configuredDepartmentCount} Department Override{configuredDepartmentCount === 1 ? '' : 's'}
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {officeTimings.length} Total Rule{officeTimings.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
          {officeQuickStats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl bg-gradient-to-br ${stat.accent} p-4 shadow-lg`}
            >
              <p className="text-sm text-white/70">{stat.label}</p>
              <p className="text-2xl font-semibold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
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
                <Label htmlFor="global-start" className="text-sm font-medium text-blue-600">
                  Start Time
                </Label>
              <Input
                id="global-start"
                type="time"
                value={globalTimingForm.startTime}
                  onChange={(e) =>
                    setGlobalTimingForm((prev) => ({ ...prev, startTime: e.target.value }))
                  }
                  className="h-12 border-2 border-blue-100 focus:border-blue-400"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="global-end" className="text-sm font-medium text-blue-600">
                  End Time
                </Label>
              <Input
                id="global-end"
                type="time"
                value={globalTimingForm.endTime}
                  onChange={(e) =>
                    setGlobalTimingForm((prev) => ({ ...prev, endTime: e.target.value }))
                  }
                  className="h-12 border-2 border-blue-100 focus:border-blue-400"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="global-grace-in" className="text-sm font-medium text-blue-600">
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
                className="h-12 border-2 border-blue-100 focus:border-blue-400"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="global-grace-out" className="text-sm font-medium text-blue-600">
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
                className="h-12 border-2 border-blue-100 focus:border-blue-400"
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
                disabled={officeFormLoading}
                className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
              >
              {officeFormLoading ? 'Saving...' : 'Save Global Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

        <Card ref={departmentFormRef} className="shadow-xl border border-purple-100 dark:border-slate-800 transition-all duration-300">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Department Overrides</CardTitle>
            <CardDescription>
              Override the global schedule for particular departments or create new ones.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-600">Department</Label>
              {departments.length > 0 && (
                <Select
                  value={
                    departmentTimingForm.department &&
                    departments.some(
                      (dept) =>
                        dept.trim().toLowerCase() ===
                        departmentTimingForm.department?.trim().toLowerCase(),
                    )
                      ? departmentTimingForm.department
                      : '__custom__'
                  }
                  onValueChange={(value) => {
                    if (value === '__custom__') return;
                    handleDepartmentSelect(value);
                  }}
                >
                  <SelectTrigger className="h-12 border-2 border-purple-100 focus:border-purple-400">
                    <SelectValue placeholder="Select department to edit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom__">Custom / New Department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                    <SelectItem value="__clear__" className="text-red-500">
                      Clear Selection
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            <Input
              id="department-name"
              placeholder="e.g., Engineering"
              value={departmentTimingForm.department}
                onChange={(e) =>
                  setDepartmentTimingForm((prev) => ({ ...prev, department: e.target.value }))
                }
                className="h-12 border-2 border-purple-100 focus:border-purple-400"
            />
            {departments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {departments.map((dept) => {
                    const isSelected =
                      dept.trim().toLowerCase() ===
                      departmentTimingForm.department?.trim().toLowerCase();
                    return (
                      <button
                    key={dept}
                    type="button"
                        onClick={() => handleDepartmentSelect(dept)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          isSelected
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
                <Label htmlFor="dept-start" className="text-sm font-medium text-purple-600">
                  Start Time
                </Label>
              <Input
                id="dept-start"
                type="time"
                value={departmentTimingForm.startTime}
                  onChange={(e) =>
                    setDepartmentTimingForm((prev) => ({ ...prev, startTime: e.target.value }))
                  }
                  className="h-12 border-2 border-purple-100 focus:border-purple-400"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="dept-end" className="text-sm font-medium text-purple-600">
                  End Time
                </Label>
              <Input
                id="dept-end"
                type="time"
                value={departmentTimingForm.endTime}
                  onChange={(e) =>
                    setDepartmentTimingForm((prev) => ({ ...prev, endTime: e.target.value }))
                  }
                  className="h-12 border-2 border-purple-100 focus:border-purple-400"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="dept-grace-in" className="text-sm font-medium text-purple-600">
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
                className="h-12 border-2 border-purple-100 focus:border-purple-400"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="dept-grace-out" className="text-sm font-medium text-purple-600">
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
                className="h-12 border-2 border-purple-100 focus:border-purple-400"
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
                disabled={officeFormLoading || !departmentTimingForm.department.trim()}
                className="gap-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 shadow-md"
              >
              {officeFormLoading ? 'Saving...' : 'Save Department Timing'}
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
                      <p className="text-sm uppercase tracking-wider text-slate-500">
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
            {/* WFH Requests Management for Admin */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  WFH Requests from HR & Managers
                  {getAdminPendingWfhCount() > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {getAdminPendingWfhCount()} Pending
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Review and manage work from home requests from HR and Manager roles</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Filter Controls */}
                  <div className="flex gap-3">
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="admin-wfh-status-filter">Status Filter</Label>
                      <Select value={wfhRequestFilter} onValueChange={(value: any) => setWfhRequestFilter(value)}>
                        <SelectTrigger id="admin-wfh-status-filter" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Requests</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label>Total Requests</Label>
                      <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm flex items-center justify-between">
                        <span>{getFilteredAdminWfhRequests().length} of {allWfhRequests.length} requests</span>
                        {wfhRequestFilter !== 'all' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setWfhRequestFilter('all')}
                            className="h-6 px-2 text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* WFH Requests List */}
                  {isLoadingWfhRequests ? (
                    <div className="flex items-center justify-center py-8">
                      <Timer className="h-8 w-8 animate-spin text-purple-600" />
                      <span className="ml-2 text-muted-foreground">Loading requests...</span>
                    </div>
                  ) : getFilteredAdminWfhRequests().length > 0 ? (
                    <div className="space-y-3">
                      {getFilteredAdminWfhRequests().map((request) => (
                        <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-blue-600" />
                                  <span className="font-medium">{request.submittedBy}</span>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${
                                      request.role === 'hr' 
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
                                {request.processedAt && (
                                  <span>Processed: {formatRelativeTime(request.processedAt)} ({formatDateTimeIST(request.processedAt, 'dd MMM yyyy, hh:mm a')})</span>
                                )}
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
                                variant={request.status === 'approved' ? 'default' : request.status === 'rejected' ? 'destructive' : 'secondary'}
                                className={request.status === 'approved' ? 'bg-green-500' : ''}
                              >
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </Badge>
                              {request.status === 'pending' && (
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
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No WFH requests found</p>
                      <p className="text-sm">
                        {wfhRequestFilter === 'all' ? 'No requests from HR or Managers yet' : `No ${wfhRequestFilter} requests from HR or Managers`}
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
                      className={`text-xs ${
                        selectedWfhRequest.role === 'hr' 
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
                  placeholder="Please provide a clear reason for rejecting this request..."
                  rows={3}
                  className="resize-none"
                  onChange={(e) => {
                    setSelectedWfhRequest(prev => prev ? {...prev, rejectionReason: e.target.value} : null);
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