import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  Users,
  X,
  User,
  Settings,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Timer,
  FileSpreadsheet,
  FileText,
  Home,
  Send,
  History,
  Edit,
  Trash2,
  Globe,
  XCircle,
  Building2,
  LogIn,
  Check,
  LayoutGrid,
} from "lucide-react";
import SummaryCard from "@/components/ui/SummaryCard";
import { toast } from "@/hooks/use-toast";
import { AttendanceRecord } from "@/types";
import { format, subMonths, subDays, isAfter } from "date-fns";
import { Pagination } from "@/components/ui/pagination";
import TruncatedText from "@/components/ui/TruncatedText";
import {
  formatIST,
  formatDateTimeIST,
  formatTimeIST,
  formatDateIST,
  todayIST,
  formatDateTimeComponentsIST,
  parseToIST,
  nowIST,
} from "@/utils/timezone";
import { DatePicker } from "@/components/ui/date-picker";
import OnlineStatusIndicator from "@/components/attendance/OnlineStatusIndicator";
import { apiService, API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

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
  checkInLocationLabel?: string | null;
  checkOutLocationLabel?: string | null;
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
  checkInGrace: number | "";
  checkOutGrace: number | "";
};

type DepartmentTimingFormState = TimingFormState & {
  department: string;
};

const resolveGraceValue = (value: number | "") => (value === "" ? 0 : value);

const AttendanceManager: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Helper function to format work hours from decimal to "HH:MM" format
  const formatWorkHours = (decimalHours: number): string => {
    if (!decimalHours || decimalHours === 0) {
      return "00:00";
    }

    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };
  const isAdmin = user?.role === "admin";
  const [attendanceRecords, setAttendanceRecords] = useState<
    EmployeeAttendance[]
  >([]);
  const [filteredRecords, setFilteredRecords] = useState<EmployeeAttendance[]>(
    [],
  );
  const [selectedRecord, setSelectedRecord] =
    useState<EmployeeAttendance | null>(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [summaryModal, setSummaryModal] = useState<{
    open: boolean;
    summary: string | null;
  }>({ open: false, summary: null });
  const [locationModal, setLocationModal] = useState<{
    open: boolean;
    location: EmployeeAttendance | null;
  }>({ open: false, location: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState(todayIST());
  const [selectedDate, setSelectedDate] = useState<Date>(nowIST());
  const [timePeriodFilter, setTimePeriodFilter] = useState<
    | "today"
    | "current_month"
    | "last_month"
    | "last_3_months"
    | "last_6_months"
    | "last_12_months"
    | "custom"
  >("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    subDays(nowIST(), 7),
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(nowIST());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<{
    total_employees: number;
    present_today: number;
    late_arrivals: number;
    early_departures: number;
    absent_today: number;
  }>({
    total_employees: 0,
    present_today: 0,
    late_arrivals: 0,
    early_departures: 0,
    absent_today: 0,
  });

  // Export modal states
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<"csv" | "pdf" | null>("csv");
  const [reportLayout, setReportLayout] = useState<
    "basic" | "grid" | "detailed_grid"
  >("basic");
  const [quickFilter, setQuickFilter] = useState<string>("custom");
  const [gridMonth, setGridMonth] = useState<string>(
    String(new Date().getMonth() + 1),
  );
  const [gridYear, setGridYear] = useState<string>(
    String(new Date().getFullYear()),
  );
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [employeeFilter, setEmployeeFilter] = useState<"all" | "specific">(
    "all",
  );
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employees, setEmployees] = useState<
    Array<{
      user_id: number;
      employee_id: string;
      name: string;
      department?: string | null;
    }>
  >([]);
  const [filteredEmployees, setFilteredEmployees] = useState<
    Array<{
      user_id: number;
      employee_id: string;
      name: string;
      department?: string | null;
    }>
  >([]);
  const [selectedEmployee, setSelectedEmployee] = useState<{
    user_id: number;
    employee_id: string;
    name: string;
    department?: string | null;
  } | null>(null);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] =
    useState<string>("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [coreDepartments, setCoreDepartments] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    "attendance" | "office-hours" | "wfh-requests"
  >("attendance");
  const [officeTimings, setOfficeTimings] = useState<OfficeTiming[]>([]);
  const [officeFormLoading, setOfficeFormLoading] = useState(false);
  const [isGlobalSaving, setIsGlobalSaving] = useState(false);
  const [isDeptSaving, setIsDeptSaving] = useState(false);
  const [globalTimingForm, setGlobalTimingForm] = useState<TimingFormState>({
    startTime: "09:30",
    endTime: "18:00",
    checkInGrace: 15,
    checkOutGrace: 0,
  });
  const [departmentTimingForm, setDepartmentTimingForm] =
    useState<DepartmentTimingFormState>({
      department: "",
      startTime: "09:30",
      endTime: "18:00",
      checkInGrace: 15,
      checkOutGrace: 0,
    });
  const [onlineStatusMap, setOnlineStatusMap] = useState<
    Record<number, boolean>
  >({});

  // WFH Requests state (Admin only sees HR and Manager requests)
  const [allWfhRequests, setAllWfhRequests] = useState<any[]>([]);
  const [isLoadingWfhRequests, setIsLoadingWfhRequests] = useState(false);
  const [wfhRequestFilter, setWfhRequestFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [selectedWfhRequest, setSelectedWfhRequest] = useState<any>(null);
  const [showWfhRequestDialog, setShowWfhRequestDialog] = useState(false);
  const [isProcessingWfhRequest, setIsProcessingWfhRequest] = useState(false);
  const [wfhCurrentPage, setWfhCurrentPage] = useState(1);
  const [wfhItemsPerPage, setWfhItemsPerPage] = useState(10);
  const [pendingWfhCurrentPage, setPendingWfhCurrentPage] = useState(1);
  const [pendingWfhItemsPerPage, setPendingWfhItemsPerPage] = useState(10);
  const [wfhDecisionsDurationFilter, setWfhDecisionsDurationFilter] =
    useState<string>("all");
  const [wfhDecisionsStartDate, setWfhDecisionsStartDate] = useState<
    Date | undefined
  >(undefined);
  const [wfhDecisionsEndDate, setWfhDecisionsEndDate] = useState<
    Date | undefined
  >(undefined);
  const [tempWfhDecisionsStartDate, setTempWfhDecisionsStartDate] = useState<
    Date | undefined
  >(undefined);
  const [tempWfhDecisionsEndDate, setTempWfhDecisionsEndDate] = useState<
    Date | undefined
  >(undefined);
  const [wfhRoleFilter, setWfhRoleFilter] = useState<
    "all" | "hr" | "manager" | "team_lead" | "employee"
  >("all");

  // Ref for scrolling to department form when editing
  const departmentFormRef = useRef<HTMLDivElement>(null);
  const timePickerRefs = {
    globalStart: useRef<HTMLDivElement>(null),
    globalEnd: useRef<HTMLDivElement>(null),
    deptStart: useRef<HTMLDivElement>(null),
    deptEnd: useRef<HTMLDivElement>(null),
  };
  const [openTimePicker, setOpenTimePicker] = useState<
    "globalStart" | "globalEnd" | "deptStart" | "deptEnd" | null
  >(null);
  const HOURS = [
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
  ];
  const MINUTES = Array.from({ length: 60 }, (_, i) =>
    i.toString().padStart(2, "0"),
  );

  const formatRoleDisplay = (role: string): string => {
    if (!role) return "Employee";
    const roleMap: Record<string, string> = {
      admin: "Admin",
      hr: "HR",
      manager: "Manager",
      team_lead: "Team Lead",
      teamlead: "Team Lead",
      employee: "Employee",
    };
    return (
      roleMap[role.toLowerCase()] ||
      role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  const filteredRecentDecisions = useMemo(() => {
    let filtered = allWfhRequests.filter((req) => req.status !== "pending");

    // Apply Status Filter
    if (wfhRequestFilter !== "all") {
      filtered = filtered.filter((req) => req.status === wfhRequestFilter);
    }

    // Apply Role Filter
    if (wfhRoleFilter !== "all") {
      filtered = filtered.filter((req) => {
        const reqRoleStr = (req.role || "employee")
          .toLowerCase()
          .replace(/[\s_\-]+/g, "");
        const filterRoleStr = wfhRoleFilter
          .toLowerCase()
          .replace(/[\s_\-]+/g, "");
        return reqRoleStr === filterRoleStr;
      });
    }

    // Apply Duration Filter
    if (wfhDecisionsDurationFilter !== "all") {
      const startDate = wfhDecisionsStartDate;
      const endDate = wfhDecisionsEndDate
        ? new Date(wfhDecisionsEndDate)
        : new Date();
      endDate.setHours(23, 59, 59, 999);

      filtered = filtered.filter((req) => {
        // Filter by request date (startDate) instead of submittedAt
        const requestDate = parseToIST(req.startDate);
        return (
          requestDate && requestDate >= startDate! && requestDate <= endDate
        );
      });
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.processedAt || b.submittedAt || b.startDate).getTime() -
        new Date(a.processedAt || a.submittedAt || a.startDate).getTime(),
    );
  }, [
    allWfhRequests,
    wfhRequestFilter,
    wfhRoleFilter,
    wfhDecisionsDurationFilter,
    wfhDecisionsStartDate,
    wfhDecisionsEndDate,
  ]);

  useEffect(() => {
    setWfhCurrentPage(1);
    if (
      wfhDecisionsStartDate &&
      wfhDecisionsEndDate &&
      wfhDecisionsStartDate > wfhDecisionsEndDate
    ) {
      setWfhDecisionsEndDate(wfhDecisionsStartDate);
    }
  }, [
    wfhRequestFilter,
    wfhRoleFilter,
    wfhDecisionsDurationFilter,
    wfhDecisionsStartDate,
    wfhDecisionsEndDate,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openTimePicker) return;
      const targets = Object.values(timePickerRefs);
      const clickedInside = targets.some(
        (ref) => ref.current && ref.current.contains(event.target as Node),
      );
      if (!clickedInside) {
        setOpenTimePicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openTimePicker]);

  const parseTimeValue = (value: string) => {
    if (!value) return { hour12: "10", minute: "00", meridiem: "AM" };

    // Support formats like "09:30", "09:30 AM", "09:30AM", "21:30"
    const timeOnly = value.split(/\s|(?=[AP]M)/i)[0];
    const [h, m] = timeOnly.split(":");

    let hour = Math.max(0, Math.min(23, Number(h) || 0));
    const minute = Math.max(0, Math.min(59, Number(m) || 0));

    // Detect meridiem from string if present, otherwise from hour
    let meridiem: "AM" | "PM" = "AM";
    if (value.toUpperCase().includes("PM")) {
      meridiem = "PM";
    } else if (value.toUpperCase().includes("AM")) {
      meridiem = "AM";
    } else {
      meridiem = hour >= 12 ? "PM" : "AM";
    }

    let hour12 = hour % 12;
    if (hour12 === 0) hour12 = 12;

    return {
      hour12: hour12.toString().padStart(2, "0"),
      minute: minute.toString().padStart(2, "0"),
      meridiem,
    };
  };

  const to24Hour = (hour12: string, minute: string, meridiem: "AM" | "PM") => {
    let h = Number(hour12) % 12;
    if (meridiem === "PM") h += 12;
    const m = Number(minute) % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const handleTimeSelect = (
    field: "globalStart" | "globalEnd" | "deptStart" | "deptEnd",
    hour12: string,
    minute: string,
    meridiem: "AM" | "PM",
  ) => {
    const value = to24Hour(hour12, minute, meridiem);
    if (field === "globalStart") {
      setGlobalTimingForm((prev) => ({ ...prev, startTime: value }));
    } else if (field === "globalEnd") {
      setGlobalTimingForm((prev) => ({ ...prev, endTime: value }));
    } else if (field === "deptStart") {
      setDepartmentTimingForm((prev) => ({ ...prev, startTime: value }));
    } else if (field === "deptEnd") {
      setDepartmentTimingForm((prev) => ({ ...prev, endTime: value }));
    }
    setOpenTimePicker(null);
  };

  const TimePickerDropdown = ({
    field,
    value,
    accent,
  }: {
    field: "globalStart" | "globalEnd" | "deptStart" | "deptEnd";
    value: string;
    accent: "blue" | "purple";
  }) => {
    const { hour12, minute, meridiem } = parseTimeValue(value);
    const accentBase =
      accent === "blue"
        ? "text-blue-600 border-blue-200 bg-blue-50"
        : "text-purple-600 border-purple-200 bg-purple-50";
    const accentHover =
      accent === "blue"
        ? "hover:border-blue-300 hover:bg-blue-100"
        : "hover:border-purple-300 hover:bg-purple-100";

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
                    onClick={() =>
                      handleTimeSelect(
                        field,
                        h,
                        minute,
                        meridiem as "AM" | "PM",
                      )
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors text-left ${active ? accentBase : "border-slate-200 text-slate-700"} ${accentHover}`}
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
                    onClick={() =>
                      handleTimeSelect(
                        field,
                        hour12,
                        m,
                        meridiem as "AM" | "PM",
                      )
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors text-left ${active ? accentBase : "border-slate-200 text-slate-700"} ${accentHover}`}
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
              {(["AM", "PM"] as const).map((mer) => {
                const active = mer === meridiem;
                return (
                  <button
                    key={`${field}-mer-${mer}`}
                    type="button"
                    onClick={() => handleTimeSelect(field, hour12, minute, mer)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm transition-colors text-center ${active ? accentBase : "border-slate-200 text-slate-700"} ${accentHover}`}
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
    const token = localStorage.getItem("token");
    return {
      Authorization: token
        ? token.startsWith("Bearer ")
          ? token
          : `Bearer ${token}`
        : "",
      "Content-Type": "application/json",
    };
  };

  const loadCoreDepartments = async () => {
    try {
      const items = await apiService.getDepartmentNames();
      const names = items
        .map((d) => d?.name)
        .filter((name): name is string => Boolean(name && name.trim()))
        .map((name) => name.trim());
      setCoreDepartments(
        Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)),
      );
    } catch (err) {
      console.error("loadCoreDepartments error", err);
      // Non-blocking: department timing can still be used as custom input
      setCoreDepartments([]);
    }
  };

  const fetchAllOnlineStatus = async () => {
    try {
      const data = await apiService.getCurrentOnlineStatus();
      if (data) {
        const statusMap: Record<number, boolean> = {};
        Object.keys(data).forEach((userId) => {
          statusMap[parseInt(userId)] = data[userId].is_online;
        });
        setOnlineStatusMap(statusMap);
      }
    } catch (error) {
      console.error("Failed to fetch online status:", error);
    }
  };

  const resolveMediaUrl = (url?: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const normalized = url.startsWith("/") ? url : `/${url}`;
    return `${API_BASE_URL}${normalized}`;
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
  const getOnlineStatusForDisplay = (
    record: EmployeeAttendance,
  ): { isOnline: boolean; label: string; showAbsent: boolean } => {
    const today = todayIST();
    const recordDate = record.date;
    const checkInTime = record.checkInTime;
    const checkOutTime = record.checkOutTime;

    // If no check-in, show as offline
    if (!checkInTime) {
      return { isOnline: false, label: "Offline", showAbsent: false };
    }

    // If record date is today
    if (recordDate === today) {
      if (checkOutTime) {
        // Checked out today - show as checked out
        return { isOnline: false, label: "Checked Out", showAbsent: false };
      } else {
        // Not checked out - show online status from map
        const isOnline = onlineStatusMap[parseInt(record.userId)] ?? true;
        return {
          isOnline,
          label: isOnline ? "Online" : "Offline",
          showAbsent: false,
        };
      }
    }

    // If record date is before today (past date)
    const recordDateObj = new Date(recordDate);
    const todayDateObj = new Date(today);

    if (recordDateObj < todayDateObj) {
      if (!checkOutTime) {
        // Forgotten checkout - show as offline
        return { isOnline: false, label: "Offline", showAbsent: false };
      } else {
        // Checked out on past date - show as checked out
        return { isOnline: false, label: "Checked Out", showAbsent: false };
      }
    }

    // Default: show online status
    const isOnline = onlineStatusMap[parseInt(record.userId)] ?? false;
    return {
      isOnline,
      label: isOnline ? "Online" : "Offline",
      showAbsent: false,
    };
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
    if (activeTab === "wfh-requests" && isAdmin) {
      loadAdminWfhRequests();

      // Refresh sample data every 30 seconds to keep timestamps current
      const dataInterval = setInterval(() => {
        loadAdminWfhRequests();
      }, 30000);

      // Force re-render every minute to update relative timestamps
      const renderInterval = setInterval(() => {
        setAllWfhRequests((prev) => [...prev]); // Trigger re-render
      }, 60000);

      return () => {
        clearInterval(dataInterval);
        clearInterval(renderInterval);
      };
    }
  }, [activeTab, isAdmin]);

  // Refresh office hours data and department list whenever the admin opens the tab.
  useEffect(() => {
    if (activeTab === "office-hours" && isAdmin) {
      loadOfficeTimings();
      loadCoreDepartments();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (employeeFilter !== "specific") {
      setFilteredEmployees([]);
      return;
    }

    let subset = employees;
    const normalizedDept = selectedDepartmentFilter.trim().toLowerCase();
    if (normalizedDept) {
      subset = subset.filter((emp) =>
        (emp.department || "")
          .split(',')
          .map((d: string) => d.trim().toLowerCase())
          .includes(normalizedDept)
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
    if (employeeFilter === "specific") {
      if (!selectedDepartmentFilter && coreDepartments.length === 1) {
        setSelectedDepartmentFilter(coreDepartments[0]);
      }
    } else {
      setSelectedDepartmentFilter("");
      setSelectedEmployee(null);
    }
  }, [employeeFilter, departments, selectedDepartmentFilter]);

  const loadEmployees = async () => {
    try {
      let data = await apiService.getEmployees();
      if (!Array.isArray(data) && (data as any)?.employees) {
        data = (data as any).employees;
      } else if (!Array.isArray(data)) {
        data = [];
      }

      // Enforce strict visibility validation for Managers based on role hierarchy and department
      if (user?.role === "manager" && user?.department) {
        const managerId = String(user.id);
        const normalizedDept = user.department.trim().toLowerCase();

        // Step 1: Find all Team Leads reporting to this Manager (within same department)
        const teamLeadIds = new Set<string>();
        data.forEach((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          const role = (emp.role || "").replace(/[\s_]+/g, "").toLowerCase();
          const empDept = (emp.department || emp.department_name || "")
            .trim()
            .toLowerCase();
          const managerIdForEmp = emp.manager_id
            ? String(emp.manager_id)
            : null;

          // Team Lead in same department (allow all Team Leads in department to be visible to Manager)
          if (role === "teamlead" && empDept === normalizedDept) {
            teamLeadIds.add(uId);
          }
        });

        // Step 2: Find all Employees reporting to those Team Leads (within same department)
        const allowedEmployeeIds = new Set<string>();
        data.forEach((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          const role = (emp.role || "").toLowerCase();
          const empDept = (emp.department || emp.department_name || "")
            .trim()
            .toLowerCase();
          const teamLeadIdForEmp =
            emp.team_lead_id || emp.teamLeadId
              ? String(emp.team_lead_id || emp.teamLeadId)
              : null;

          // Employee reporting to a Team Lead that reports to this Manager, in same department
          if (
            role === "employee" &&
            empDept === normalizedDept &&
            teamLeadIdForEmp &&
            teamLeadIds.has(teamLeadIdForEmp)
          ) {
            allowedEmployeeIds.add(uId);
          }
        });

        // Simplified visibility: allow all Employees and Team Leads in same department
        data = data.filter((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          const empDept = (emp.department || emp.department_name || "")
            .trim()
            .toLowerCase();
          const role = (emp.role || "").replace(/[\s_]+/g, "").toLowerCase();

          // 1. Always allow Self (Manager)
          if (uId === managerId) return true;

          // 2. Allow all Employees and Team Leads
          const isAllowedRole = [
            "employee",
            "teamlead",
            "team_lead",
            "manager",
          ].includes(role);
          if (!isAllowedRole) return false;

          // 3. Role-based filtering is sufficient; backend handles branch/company scoping.
          return true;
        });

        console.log("Manager employee filtering:", {
          managerId,
          department: normalizedDept,
          teamLeadIds: Array.from(teamLeadIds),
          allowedEmployeeIds: Array.from(allowedEmployeeIds),
          filteredEmployeesCount: data.length,
        });
      }

      const departmentSet = new Set<string>();
      const mapped = data.map((emp: any) => {
        const department = emp.department || emp.department_name || "";
        if (department) {
          departmentSet.add(department);
        }
        return {
          user_id: emp.user_id || emp.userId,
          employee_id: emp.employee_id || emp.employeeId || "",
          name:
            emp.name || `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
          department,
        };
      });
      setEmployees(mapped);
      setDepartments(
        Array.from(departmentSet).sort((a, b) => a.localeCompare(b)),
      );
    } catch (err: any) {
      console.error("loadEmployees error", err);
      const errorMessage = err.message || "";
      if (err.status === 409 || errorMessage.includes("409") || errorMessage.includes("Scope conflict") || errorMessage.includes("Multiple company")) {
        // Redundant set active scope error removed in favor of global solution
      }
    }
  };

  const loadOfficeTimings = async () => {
    if (!isAdmin) return;
    setOfficeFormLoading(true);
    try {
      const data: OfficeTiming[] = await apiService.getOfficeTimings();
      setOfficeTimings(data);

      const globalTiming = data.find(
        (entry) => !entry.department || entry.department === "",
      );
      if (globalTiming) {
        setGlobalTimingForm({
          startTime: (globalTiming.start_time || "").slice(0, 5) || "10:00",
          endTime: (globalTiming.end_time || "").slice(0, 5) || "19:00",
          checkInGrace: globalTiming.check_in_grace_minutes ?? 0,
          checkOutGrace: globalTiming.check_out_grace_minutes ?? 0,
        });
      }

      const timingDepartments = data
        .map((entry) => entry.department)
        .filter((dept): dept is string => Boolean(dept && dept.trim()));
      // Intentionally do not merge timing departments into the main `departments` list.
      // The "Department Timing" UI uses `coreDepartments` (from /departments/names) to avoid messy/combined strings.
    } catch (error: any) {
      console.error("loadOfficeTimings error", error);
      const errorMessage = error.message || "";
      if (error.status === 409 || errorMessage.includes("409") || errorMessage.includes("Scope conflict") || errorMessage.includes("Multiple company")) {
        // Redundant set active scope error removed in favor of global solution
      }
      toast({
        title: "Office timing fetch failed",
        description: "Unable to load configured office timings.",
        variant: "destructive",
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
        check_in_grace_minutes: resolveGraceValue(
          globalTimingForm.checkInGrace,
        ),
        check_out_grace_minutes: resolveGraceValue(
          globalTimingForm.checkOutGrace,
        ),
      };
      await apiService.updateOfficeTiming(payload);
      await loadOfficeTimings();
      toast({
        title: "Office time saved",
        description: "Global office timing updated successfully.",
      });
    } catch (error) {
      console.error("handleGlobalTimingSave error", error);
      toast({
        title: "Save failed",
        description: "Unable to save global office time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGlobalSaving(false);
    }
  };

  const handleDepartmentTimingSave = async () => {
    if (!departmentTimingForm.department.trim()) {
      toast({
        title: "Branch required",
        description: "Please specify a branch before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDeptSaving(true);
      const payload = {
        department: departmentTimingForm.department.trim(),
        start_time: departmentTimingForm.startTime,
        end_time: departmentTimingForm.endTime,
        check_in_grace_minutes: resolveGraceValue(
          departmentTimingForm.checkInGrace,
        ),
        check_out_grace_minutes: resolveGraceValue(
          departmentTimingForm.checkOutGrace,
        ),
      };
      await apiService.updateOfficeTiming(payload);
      await loadOfficeTimings();
      toast({
        title: "Branch timing saved",
        description: `Office timing updated for ${departmentTimingForm.department}.`,
      });
    } catch (error) {
      console.error("handleDepartmentTimingSave error", error);
      toast({
        title: "Save failed",
        description: "Unable to save branch office time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeptSaving(false);
    }
  };

  const handleDepartmentTimingEdit = (timing: OfficeTiming) => {
    setDepartmentTimingForm({
      department: timing.department || "",
      startTime: (timing.start_time || "").slice(0, 5) || "10:00",
      endTime: (timing.end_time || "").slice(0, 5) || "19:00",
      checkInGrace: timing.check_in_grace_minutes ?? 0,
      checkOutGrace: timing.check_out_grace_minutes ?? 0,
    });

    // Scroll to the form and provide visual feedback
    setTimeout(() => {
      if (departmentFormRef.current) {
        departmentFormRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Add a brief highlight effect
        departmentFormRef.current.classList.add(
          "ring-4",
          "ring-purple-400",
          "ring-opacity-50",
        );
        setTimeout(() => {
          departmentFormRef.current?.classList.remove(
            "ring-4",
            "ring-purple-400",
            "ring-opacity-50",
          );
        }, 2000);
      }
    }, 100);

    // Show toast notification
    toast({
      title: "Editing Branch Timing",
      description: `Form populated with settings for ${timing.department || "All Branches"}. Scroll up to edit.`,
    });
  };

  const handleDepartmentTimingDelete = async (timing: OfficeTiming) => {
    if (
      !window.confirm(
        `Remove office timing for ${timing.department || "all departments"}?`,
      )
    ) {
      return;
    }

    try {
      setOfficeFormLoading(true);
      await apiService.deleteOfficeTiming(timing.id);
      await loadOfficeTimings();
      if (
        timing.department &&
        departmentTimingForm.department.trim().toLowerCase() ===
        timing.department.trim().toLowerCase()
      ) {
        setDepartmentTimingForm({
          department: "",
          startTime: globalTimingForm.startTime,
          endTime: globalTimingForm.endTime,
          checkInGrace: globalTimingForm.checkInGrace,
          checkOutGrace: globalTimingForm.checkOutGrace,
        });
      }
      toast({
        title: "Office timing removed",
        description: "The office timing has been deactivated.",
      });
    } catch (error) {
      console.error("handleDepartmentTimingDelete error", error);
      toast({
        title: "Delete failed",
        description: "Unable to remove the office timing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setOfficeFormLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const data = await apiService.getAttendanceSummary();
      setSummary(data);
    } catch (err) {
      console.error("fetchSummary error", err);
    }
  };

  useEffect(() => {
    filterRecords();
  }, [
    searchTerm,
    filterStatus,
    timePeriodFilter,
    customStartDate,
    customEndDate,
    attendanceRecords,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    filterStatus,
    timePeriodFilter,
    customStartDate,
    customEndDate,
  ]);

  const loadAllAttendance = (targetDate?: string) => {
    // Fetch today's attendance from backend
    // For Admin/HR/Manager: Load today's attendance records
    (async () => {
      try {
        const params: any = {};
        if (targetDate) params.date = targetDate;



        let [data, employeesRaw] = await Promise.all([
          apiService.getAttendanceRecords(params),
          apiService.getEmployees(),
        ]);

        let employeesData = Array.isArray(employeesRaw) ? employeesRaw : (employeesRaw as any)?.employees || [];
        if (!Array.isArray(employeesData)) {
          employeesData = [];
        }

        // Create comprehensive maps for role hierarchy validation
        const userRoleMap: Record<string, string> = {};
        const userDepartmentMap: Record<string, string> = {};
        const userManagerMap: Record<string, string | null> = {};
        const userTeamLeadMap: Record<string, string | null> = {};

        employeesData.forEach((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          userRoleMap[uId] = (emp.role || "")
            .replace(/[\s_]+/g, "")
            .toLowerCase();
          userDepartmentMap[uId] = (emp.department || emp.department_name || "")
            .trim()
            .toLowerCase();
          userManagerMap[uId] = emp.manager_id ? String(emp.manager_id) : null;
          userTeamLeadMap[uId] =
            emp.team_lead_id || emp.teamLeadId
              ? String(emp.team_lead_id || emp.teamLeadId)
              : null;
        });

        console.log("Attendance data received:", data);



        // Transform backend data to EmployeeAttendance format
        const transformedData: EmployeeAttendance[] = data
          .map((rec: any) => {
            const checkIn = rec.check_in || rec.checkInTime;
            const checkOut = rec.check_out || rec.checkOutTime;
            const checkInDate = checkIn ? new Date(checkIn) : null;

            const status = (rec.status || "present").toLowerCase();
            const checkInStatus =
              rec.checkInStatus || rec.check_in_status || null;
            const checkOutStatus =
              rec.checkOutStatus || rec.check_out_status || null;
            const scheduledStart =
              rec.scheduledStart || rec.scheduled_start || null;
            const scheduledEnd = rec.scheduledEnd || rec.scheduled_end || null;

            // Normalize work location from backend
            // Backend should return the correct work location based on WFH approval and check-in type
            let workLocation = rec.workLocation || rec.work_location;

            // Normalize work location values to backend-accepted enums: "office" or "work_from_home"
            if (
              workLocation === "work_from_home" ||
              workLocation === "wfh" ||
              workLocation === "WFH" ||
              workLocation === "Work From Home"
            ) {
              workLocation = "work_from_home";
            } else if (
              workLocation === "work_from_office" ||
              workLocation === "office" ||
              workLocation === "Office" ||
              workLocation === "Work From Office"
            ) {
              workLocation = "office";
            } else {
              // Default to office only if work location is truly not set
              // This should not happen if backend is correctly setting work location
              workLocation = "office";
            }

            return {
              id: String(rec.attendance_id || rec.id || ""),
              userId: String(rec.user_id || rec.userId || ""),
              userName: rec.userName || rec.name || "Unknown",
              userEmail: rec.userEmail || rec.email || "",
              employeeId:
                rec.employee_id ||
                rec.employeeId ||
                String(rec.user_id || rec.userId || ""),
              department: rec.department || "N/A",
              date: checkInDate ? formatDateIST(checkInDate) : todayIST(),
              checkInTime: checkIn || undefined,
              checkOutTime: checkOut || undefined,
              checkInLocation: {
                latitude: 0,
                longitude: 0,
                address:
                  rec.checkInLocationLabel ||
                  rec.locationLabel ||
                  rec.gps_location ||
                  rec.checkInLocation?.address ||
                  "N/A",
              },
              checkInSelfie: resolveMediaUrl(
                rec.checkInSelfie || rec.selfie || rec.selfie_url,
              ),
              checkOutSelfie: resolveMediaUrl(
                rec.checkOutSelfie ||
                rec.check_out_selfie ||
                rec.checkout_selfie_url,
              ),
              status: (status as any) || "present",
              workHours: rec.total_hours || rec.workHours || (checkIn && checkOut ? (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60) : 0) || 0,
              checkInStatus: checkInStatus || undefined,
              checkOutStatus: checkOutStatus || undefined,
              scheduledStart: scheduledStart || undefined,
              scheduledEnd: scheduledEnd || undefined,
              workSummary: rec.workSummary || rec.work_summary || null,
              workReport: resolveMediaUrl(rec.workReport || rec.work_report),
              taskDeadlineReason:
                rec.overdue_reason ||
                rec.task_overdue_reason ||
                rec.late_reason ||
                rec.due_reason ||
                rec.taskDeadlineReason ||
                rec.task_deadline_reason ||
                rec.deadline_reason ||
                rec.overdueReason ||
                rec.lateArrivalReason ||
                rec.taskPendingReason ||
                rec.task_pending_reason ||
                rec.overtime_reason ||
                rec.delay_reason ||
                rec.reason ||
                null,
              workLocation: workLocation,
              checkInLocationLabel: rec.checkInLocationLabel,
              checkOutLocationLabel: rec.checkOutLocationLabel,
            };
          })
          .sort((a, b) => {
            // Sort by date descending
            const dateCompare =
              new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateCompare !== 0) return dateCompare;

            // If same date, sort by check-in time descending
            const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
            const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
            return timeB - timeA;
          });

        console.log("Transformed attendance records:", transformedData);
        setAttendanceRecords(transformedData);
      } catch (error: any) {
        console.error("loadAllAttendance error", error);

        const errorMessage = error.message || "";
        if (error.status === 409 || errorMessage.includes("409") || errorMessage.includes("Scope conflict") || errorMessage.includes("Multiple company")) {
          // Scope conflict is handled globally via window event in api.ts
        }

        toast({
          title: "Error",
          description: "Failed to load attendance records. Please try again.",
          variant: "destructive",
        });
      }
    })();
  };

  const filterRecords = () => {
    let filtered = [...attendanceRecords];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (record) =>
          record.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (record.employeeId &&
            record.employeeId
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          (record.userId &&
            record.userId.toLowerCase().includes(searchTerm.toLowerCase())),
      );
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter((record) => {
        const statusValue = record.status?.toLowerCase() || "";
        const checkInStatusValue = record.checkInStatus?.toLowerCase() || "";
        const checkOutStatusValue = record.checkOutStatus?.toLowerCase() || "";
        if (filterStatus === "late") {
          return statusValue === "late" || checkInStatusValue === "late";
        }
        if (filterStatus === "early") {
          return checkOutStatusValue === "early";
        }
        if (filterStatus === "present") {
          return !!record.checkInTime;
        }
        if (filterStatus === "absent") {
          return statusValue === "absent" || !record.checkInTime;
        }
        return true;
      });
    }

    // Filter by date or time period
    if (timePeriodFilter === "today") {
      const todayStr = todayIST();
      filtered = filtered.filter((record) => record.date === todayStr);
    } else {
      const today = new Date();
      let startDateRange: Date = new Date();
      let endDateRange: Date = new Date();
      endDateRange.setHours(23, 59, 59, 999);

      switch (timePeriodFilter) {
        case "current_month":
          startDateRange = new Date(today.getFullYear(), today.getMonth(), 1);
          startDateRange.setHours(0, 0, 0, 0);
          break;
        case "last_month":
          const lastMonth = subMonths(today, 1);
          startDateRange = new Date(
            lastMonth.getFullYear(),
            lastMonth.getMonth(),
            1,
          );
          startDateRange.setHours(0, 0, 0, 0);
          endDateRange = new Date(
            lastMonth.getFullYear(),
            lastMonth.getMonth() + 1,
            0,
          );
          endDateRange.setHours(23, 59, 59, 999);
          break;
        case "last_3_months":
          startDateRange = subMonths(today, 3);
          startDateRange.setHours(0, 0, 0, 0);
          break;
        case "last_6_months":
          startDateRange = subMonths(today, 6);
          startDateRange.setHours(0, 0, 0, 0);
          break;
        case "last_12_months":
          startDateRange = subMonths(today, 12);
          startDateRange.setHours(0, 0, 0, 0);
          break;
        case "custom":
          if (customStartDate && customEndDate) {
            startDateRange = new Date(customStartDate);
            startDateRange.setHours(0, 0, 0, 0);
            endDateRange = new Date(customEndDate);
            endDateRange.setHours(23, 59, 59, 999);
          }
          break;
      }

      filtered = filtered.filter((record) => {
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

    if (record.checkInStatus === "late" || record.status === "late") {
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

    if (record.checkOutStatus === "early") {
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
    if (!timeString) return "-";
    return formatDateTimeComponentsIST(dateString, timeString, "h:mm a");
  };

  const handleQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    switch (filter) {
      case "yesterday": {
        const yesterday = subDays(new Date(), 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        setStartDate(yesterday);
        setEndDate(yesterdayEnd);
        break;
      }
      case "current_month":
        const firstDayOfMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          1,
        );
        firstDayOfMonth.setHours(0, 0, 0, 0);
        setStartDate(firstDayOfMonth);
        setEndDate(today);
        break;
      case "last_month":
        setStartDate(subMonths(today, 1));
        setEndDate(today);
        break;
      case "last_3_months":
        setStartDate(subMonths(today, 3));
        setEndDate(today);
        break;
      case "last_6_months":
        setStartDate(subMonths(today, 6));
        setEndDate(today);
        break;
      case "last_year":
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        setStartDate(oneYearAgo);
        setEndDate(today);
        break;
      case "custom":
        // Don't modify dates when custom is selected, let user choose
        break;
    }
  };

  const handleWfhDecisionsDurationFilter = (filter: string) => {
    setWfhDecisionsDurationFilter(filter);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    switch (filter) {
      case "current_month": {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        setWfhDecisionsStartDate(startOfMonth);
        setWfhDecisionsEndDate(today);
        break;
      }
      case "last_month": {
        const startOfLastMonth = new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          1,
        );
        startOfLastMonth.setHours(0, 0, 0, 0);
        const endOfLastMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          0,
          23,
          59,
          59,
          999,
        );
        setWfhDecisionsStartDate(startOfLastMonth);
        setWfhDecisionsEndDate(endOfLastMonth);
        break;
      }
      case "last_3_months": {
        const threeMonthsAgo = subMonths(today, 3);
        threeMonthsAgo.setHours(0, 0, 0, 0);
        setWfhDecisionsStartDate(threeMonthsAgo);
        setWfhDecisionsEndDate(today);
        break;
      }
      case "last_6_months": {
        const sixMonthsAgo = subMonths(today, 6);
        sixMonthsAgo.setHours(0, 0, 0, 0);
        setWfhDecisionsStartDate(sixMonthsAgo);
        setWfhDecisionsEndDate(today);
        break;
      }
      case "last_year": {
        const lastYear = subMonths(today, 12);
        lastYear.setHours(0, 0, 0, 0);
        setWfhDecisionsStartDate(lastYear);
        setWfhDecisionsEndDate(today);
        break;
      }
      case "custom":
        setTempWfhDecisionsStartDate(
          wfhDecisionsStartDate || subDays(new Date(), 7),
        );
        setTempWfhDecisionsEndDate(wfhDecisionsEndDate || new Date());
        break;
      case "all":
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
    setQuickFilter("custom");
    setGridMonth(String(today.getMonth() + 1));
    setGridYear(String(today.getFullYear()));
    setEmployeeFilter("all");
    setEmployeeSearch("");
    setSelectedEmployee(null);
    setSelectedDepartmentFilter("");
    setFilteredEmployees([]);
  };

  const performExport = async () => {
    if (!startDate && !endDate) {
      toast({
        title: "Date Range Required",
        description:
          "Please select at least a start date or end date for the export.",
        variant: "destructive",
      });
      return;
    }

    if (employeeFilter === "specific" && !selectedEmployee) {
      toast({
        title: "Employee Selection Required",
        description: "Please select an employee to export their data.",
        variant: "destructive",
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

      if (employeeFilter === "specific" && selectedEmployee) {
        exportParams.employee_id =
          selectedEmployee.employee_id || selectedEmployee.user_id.toString();
        if (selectedDepartmentFilter) {
          exportParams.department = selectedDepartmentFilter;
        }
      }

      // Enforce department scope for Manager exports
      if (user?.role === "manager" && user?.department) {
        exportParams.department = user.department;
      }

      if (startDate) {
        exportParams.start_date = format(startDate, "yyyy-MM-dd");
      }

      if (endDate) {
        exportParams.end_date = format(endDate, "yyyy-MM-dd");
      }

      // Use apiService for export with proper authentication
      let blob: Blob;
      if (reportLayout === "grid") {
        // Grid export uses selected month and year
        blob =
          exportType === "csv"
            ? await apiService.exportMonthlyGridCSV({
              month: gridMonth,
              year: gridYear,
              department: exportParams.department,
            })
            : await apiService.exportMonthlyGridPDF({
              month: gridMonth,
              year: gridYear,
              department: exportParams.department,
            });
      } else if (reportLayout === "detailed_grid") {
        // Detailed Grid export also uses selected month and year
        blob =
          exportType === "csv"
            ? await apiService.exportMonthlyGridDetailedCSV({
              month: gridMonth,
              year: gridYear,
              department: exportParams.department,
            })
            : await apiService.downloadMonthlyDetailedAttendanceGridPDF({
              month: gridMonth,
              year: gridYear,
              department: exportParams.department,
            });
      } else {
        blob =
          exportType === "csv"
            ? await apiService.exportAttendanceCSV(exportParams)
            : await apiService.exportAttendancePDF(exportParams);
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const dateStr =
        startDate && endDate
          ? `${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}`
          : startDate
            ? `from_${format(startDate, "yyyyMMdd")}`
            : endDate
              ? `until_${format(endDate, "yyyyMMdd")}`
              : "all";

      const empStr =
        employeeFilter === "specific" && selectedEmployee
          ? `_${selectedEmployee.employee_id || selectedEmployee.user_id}`
          : "";

      a.download = `${reportLayout}_attendance_report${empStr}_${dateStr}.${exportType}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Attendance data exported as ${exportType?.toUpperCase()} successfully.`,
        variant: "default",
      });
    } catch (err) {
      console.error(`Export ${exportType} failed`, err);
      let message = String(err);
      if (err && typeof err === "object" && "message" in err) {
        message = (err as any).message || message;
      }
      toast({
        title: "Export Failed",
        description: `Failed to export ${exportType?.toUpperCase()}: ${message}`,
        variant: "destructive",
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
    if (!timeValue) return "--:--";
    const normalized = timeValue.includes(":")
      ? timeValue.slice(0, 5)
      : timeValue;
    try {
      const [h, m] = normalized.split(":");
      const hour = parseInt(h, 10);
      const minute = parseInt(m, 10);

      if (isNaN(hour) || isNaN(minute)) return normalized;

      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      return formatTimeIST(date, "HH:mm");
    } catch (e) {
      console.error("formatTimeDisplay error:", e);
      return normalized;
    }
  };

  const globalTimingEntry = officeTimings.find(
    (entry) => !entry.department || entry.department === "",
  );
  const configuredDepartmentCount = officeTimings.filter(
    (entry) => entry.department && entry.department.trim(),
  ).length;
  const officeQuickStats = [
    {
      label: "Default Start",
      value: formatTimeDisplay(
        globalTimingEntry?.start_time || globalTimingForm.startTime,
      ),
      accent: "from-blue-500 to-indigo-500",
    },
    {
      label: "Default End",
      value: formatTimeDisplay(
        globalTimingEntry?.end_time || globalTimingForm.endTime,
      ),
      accent: "from-emerald-500 to-teal-500",
    },
    {
      label: "Check-in Grace",
      value: `${globalTimingEntry?.check_in_grace_minutes ?? resolveGraceValue(globalTimingForm.checkInGrace)} mins`,
      accent: "from-orange-500 to-amber-500",
    },
    {
      label: "Check-out Grace",
      value: `${globalTimingEntry?.check_out_grace_minutes ?? resolveGraceValue(globalTimingForm.checkOutGrace)} mins`,
      accent: "from-purple-500 to-pink-500",
    },
  ];

  const handleDepartmentSelect = (value: string) => {
    if (value === "__clear__") {
      setDepartmentTimingForm({
        department: "",
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
      // Fetch WFH requests and employees in parallel to ensure accurate roles
      const [response, employeesResponse] = await Promise.all([
        apiService.getAllWFHRequests(),
        apiService.getEmployees(),
      ]);

      // Create a map of userId -> role for quick lookup
      const userRoleMap: Record<string, string> = {};
      const employeesData = Array.isArray(employeesResponse)
        ? employeesResponse
        : (employeesResponse as any)?.employees || [];
      if (Array.isArray(employeesData)) {
        employeesData.forEach((emp: any) => {
          const uId = String(emp.user_id || emp.userId || emp.id);
          userRoleMap[uId] = emp.role || "";
        });
      }

      // Handle response - it might be wrapped in an object or be an array directly
      const requests = Array.isArray(response)
        ? response
        : response?.data || response?.requests || [];

      // Transform API response to match our UI format
      const formattedRequests = requests.map((req: any) => {
        const userIdForMapping = String(req.user_id || req.userId || "");
        let resolvedRole = userRoleMap[userIdForMapping];
        if (!resolvedRole) {
          resolvedRole = req.role || req.user_role || "employee";
        }

        return {
          id: String(req.wfh_id || req.id),
          startDate: req.start_date,
          endDate: req.end_date,
          reason: req.reason,
          type: (req.wfh_type || "Full Day").toLowerCase().includes("full")
            ? "full_day"
            : "half_day",
          status: (req.status || "Pending").toLowerCase(),
          submittedAt: req.created_at,
          submittedBy: req.name || req.employee_name || "Unknown",
          submittedById: String(req.user_id),
          employeeId: req.employee_id || "",
          department: req.department || "Unknown",
          role: resolvedRole.toLowerCase(),
          processedAt: req.processed_at || req.updated_at,
          processedBy: req.approver_name || req.approved_by || "Pending",
          rejectionReason: req.rejection_reason,
        };
      });

      setAllWfhRequests(formattedRequests);
    } catch (error: any) {
      setAllWfhRequests([]);
      const errorMessage = error.message || "";
      if (error.status === 409 || errorMessage.includes("409") || errorMessage.includes("Scope conflict") || errorMessage.includes("Multiple company")) {
        // Redundant set active scope error removed in favor of global solution
      }
    } finally {
      setIsLoadingWfhRequests(false);
    }
  };

  // Handle WFH request approval/rejection for Admin
  const handleAdminWfhRequestAction = async (
    requestId: string,
    action: "approve" | "reject",
    reason?: string,
  ) => {
    setIsProcessingWfhRequest(true);
    try {
      // Call API to approve/reject WFH request
      const wfhId = parseInt(requestId);
      const approved = action === "approve";

      await apiService.approveWFHRequest(wfhId, approved, reason);

      // Update local state optimistically
      const currentTime = new Date();
      setAllWfhRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? {
              ...req,
              status: action === "approve" ? "approved" : "rejected",
              processedAt: currentTime.toISOString(),
              processedBy: user?.name || "Admin",
              rejectionReason: action === "reject" ? reason : undefined,
            }
            : req,
        ),
      );

      toast({
        title: `Request ${action === "approve" ? "Approved" : "Rejected"}`,
        description: `WFH request has been ${action === "approve" ? "approved" : "rejected"} successfully.`,
        variant: "default",
      });

      setShowWfhRequestDialog(false);
      setSelectedWfhRequest(null);

      // Reload requests to ensure consistency
      await loadAdminWfhRequests();
    } catch (error) {
      console.error("Error processing WFH request:", error);
      toast({
        title: "Action Failed",
        description: `Failed to ${action} the request. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsProcessingWfhRequest(false);
    }
  };

  // Get filtered WFH requests for Admin
  const getFilteredAdminWfhRequests = () => {
    if (wfhRequestFilter === "all") return allWfhRequests;
    return allWfhRequests.filter((req) => req.status === wfhRequestFilter);
  };

  // Get pending requests count for Admin badge
  const getAdminPendingWfhCount = () => {
    return allWfhRequests.filter((req) => req.status === "pending").length;
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
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
  };

  const tabsContainer = (
    <div className="flex justify-center w-full">
      <div className="flex items-center w-full max-w-[500px]">
        <TabsList className="grid grid-cols-3 h-12 w-full bg-white dark:bg-slate-900 border-2 border-[#000000] dark:border-slate-700 rounded-2xl p-1 gap-2 shadow-sm">
          <TabsTrigger
            value="attendance"
            className="rounded-xl font-bold text-[10px] tracking-wide transition-all duration-300
            data-[state=active]:bg-[#000000] data-[state=active]:text-white data-[state=active]:shadow-lg
            data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700"
            style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
          >
            Attendance
          </TabsTrigger>
          <TabsTrigger
            value="office-hours"
            className="rounded-xl font-bold text-[10px] tracking-wide transition-all duration-300
            data-[state=active]:bg-[#000000] data-[state=active]:text-white data-[state=active]:shadow-lg
            data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700"
            style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
          >
            Office hours
          </TabsTrigger>
          <TabsTrigger
            value="wfh-requests"
            className="rounded-xl font-bold text-[10px] tracking-wide transition-all duration-300 relative
            data-[state=active]:bg-[#000000] data-[state=active]:text-white data-[state=active]:shadow-lg
            data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700"
            style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
          >
            Wfh requests
            {getAdminPendingWfhCount() > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full p-0 flex items-center justify-center text-[8px] font-black bg-rose-500 text-white border-2 border-white dark:border-gray-800"
              >
                {getAdminPendingWfhCount()}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );

  const attendanceHeader = (
    <div className="space-y-6">
      <div className="relative overflow-hidden flex flex-col xl:flex-row justify-between items-start xl:items-center p-8 rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5 shrink-0">
          <div className="h-16 w-16 rounded-2xl bg-[#000000] flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-105">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#000000] dark:text-white sm:text-3xl whitespace-nowrap" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
              {t.attendance.employeeAttendance}
            </h1>
            <p className="text-[#5e5b5b] dark:text-slate-400 font-bold flex items-center gap-2 mt-1 text-xs tracking-wide" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
              <Users className="h-4 w-4 text-blue-600" />
              {t.attendance.monitorTeamAttendance}
            </p>
          </div>
        </div>

        <div className="relative flex gap-3 shrink-0 mt-6 xl:mt-0">
          {(user?.role === "admin" || user?.role === "hr") && (
            <Button
              onClick={() => setExportModalOpen(true)}
              size="lg"
              className="rounded-xl px-6 h-12 bg-[#000000] hover:bg-[#333333] text-white shadow-md transition-all active:scale-95 gap-2 font-bold text-xs tracking-wide border-2 border-black"
              disabled={isExporting}
              style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
            >
              <Download className="h-4 w-4" />
              {isExporting ? t.attendance.exporting : "Export"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const attendanceContent = (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title={t.attendance.totalEmployees}
          value={todayStats.total}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <SummaryCard
          title={t.attendance.presentToday}
          value={todayStats.present}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <SummaryCard
          title={t.attendance.lateArrivals}
          value={todayStats.late}
          icon={Clock}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />
        <SummaryCard
          title={t.attendance.earlyDepartures}
          value={todayStats.early}
          icon={LogOut}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      <Card className="border-2 border-[#000000] shadow-xl bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-5 border-b-2 border-black">
          <CardTitle className="text-xl font-black text-[#000000] dark:text-white tracking-tight font-outfit uppercase">
            {t.attendance.attendanceRecords}
          </CardTitle>
          <CardDescription className="text-xs font-bold text-[#5e5b5b] dark:text-slate-400 tracking-wider mt-1 uppercase">
            {t.attendance.viewAndManage}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col xl:flex-row gap-6 mb-8 items-end p-6 border-b-2 border-black bg-slate-50/30 w-full">
            <div className="flex-1 w-full xl:w-auto flex flex-col gap-2">
              <Label className="text-[10px] font-black text-black dark:text-white ml-1 uppercase tracking-widest">
                Search Employee
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.attendance.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value.replace(
                        /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                        "",
                      ),
                    )
                  }
                  className="pl-10 h-11 bg-white dark:bg-gray-950 border-2 border-black rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-end gap-4 w-full xl:w-auto">
              <div className="w-full md:w-[200px] flex flex-col gap-2">
                <Label className="text-[10px] font-black text-black dark:text-white ml-1 uppercase tracking-widest">
                  Status Filter
                </Label>
                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                  <SelectTrigger className="w-full h-11 bg-white dark:bg-gray-950 border-2 border-black rounded-xl font-bold text-sm">
                    <Filter className="h-4 w-4 mr-2 text-blue-500" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="border-2 border-black rounded-xl">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="early">Early Departure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto">
                <div className={`w-full ${timePeriodFilter === 'custom' ? 'md:w-[220px]' : 'md:w-[220px]'} flex flex-col gap-2 transition-all duration-300`}>
                  <Label className="text-[10px] font-black text-black dark:text-white ml-1 uppercase tracking-widest">
                    Duration Filter
                  </Label>
                  <Select value={timePeriodFilter} onValueChange={(value: any) => setTimePeriodFilter(value)}>
                    <SelectTrigger className="w-full h-11 bg-white dark:bg-gray-950 border-2 border-black rounded-xl text-slate-700 dark:text-slate-200 font-bold text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black rounded-xl">
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="current_month">Current Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                      <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                      <SelectItem value="last_12_months">Last 1 Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {timePeriodFilter === "custom" && (
                  <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-300 w-full md:w-auto">
                    <div className="w-full md:w-[140px]">
                      <DatePicker
                        date={customStartDate}
                        onDateChange={setCustomStartDate}
                        placeholder="Start"
                        className="w-full bg-white dark:bg-gray-950 border-2 border-black rounded-xl h-11 text-xs"
                      />
                    </div>
                    <div className="w-full md:w-[140px]">
                      <DatePicker
                        date={customEndDate}
                        onDateChange={setCustomEndDate}
                        placeholder="End"
                        className="w-full bg-white dark:bg-gray-950 border-2 border-black rounded-xl h-11 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {timePeriodFilter === "custom" &&
            customStartDate &&
            customEndDate &&
            isAfter(customStartDate, customEndDate) && (
              <p className="text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/30 p-2 rounded-md border border-red-200 dark:border-red-800 mb-4">
                "From Date" cannot be after "To Date". Please select a valid
                range.
              </p>
            )}

          <div className="rounded-2xl border-2 border-black overflow-hidden bg-white dark:bg-slate-900 shadow-lg">
            <div className="overflow-x-auto max-h-[calc(100vh-450px)]">
              <table className="w-full table-auto border-collapse min-w-[1400px]">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-black sticky top-0 z-20">
                  <tr className="hover:bg-transparent">
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
                      Date
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      {t.attendance.employeeId}
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      {t.attendance.employee}
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      {t.attendance.department}
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">Work Location</th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      {t.attendance.checkInTime}
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      {t.attendance.checkOutTime}
                    </th>
                    <th className="text-center p-4 font-black text-[12px] text-black dark:text-white min-w-[120px] uppercase tracking-widest font-outfit">
                      {t.attendance.hours}
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      {t.attendance.location}
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      Photo
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      {t.common.status}
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      {t.attendance.workSummary}
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">
                      {t.attendance.workReport}
                    </th>
                    <th className="text-left p-4 font-black text-[12px] text-black dark:text-white uppercase tracking-widest font-outfit">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords
                      .slice(
                        (currentPage - 1) * itemsPerPage,
                        (currentPage - 1) * itemsPerPage + itemsPerPage,
                      )
                      .map((record) => (
                        <tr
                          key={record.id}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
                        >
                          <td className="p-4 sticky left-0 z-10 bg-white dark:bg-slate-950 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap group-hover:bg-slate-50 dark:group-hover:bg-slate-900 transition-colors">
                            <span className="text-[12px] font-black text-black dark:text-white font-outfit uppercase tracking-tight">
                              {formatDateIST(record.date, "dd MMM yyyy")}
                            </span>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="font-black text-[12px] text-black dark:text-white uppercase tracking-tight">
                                {record.employeeId || record.userId || "N/A"}
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                UID: {record.userId}
                              </p>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <p className="font-black text-[12px] text-black dark:text-white uppercase tracking-tight truncate max-w-[150px]">
                                {record.userName}
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 lowercase truncate max-w-[150px]">
                                {record.userEmail}
                              </p>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-[10px] font-black border-2 border-slate-200 text-slate-600 px-2 py-0.5 uppercase tracking-tighter">
                              {record.department}
                            </Badge>
                          </td>
                          <td className="p-4">
                            {record.workLocation === "work_from_home" ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-200 dark:border-orange-800">
                                <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                                <span className="text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-tight">
                                  WFH
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800">
                                <div className="h-1.5 w-1.5 rounded-sm bg-blue-500"></div>
                                <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-tight">
                                  Office
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="p-4 font-outfit">
                            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                              <Clock className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase">
                                {formatAttendanceTime(record.date, record.checkInTime)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 font-outfit">
                            <div className="flex items-center gap-2 px-2 py-1 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-100 dark:border-rose-900/50">
                              <Clock className="h-3.5 w-3.5 text-rose-600" />
                              <span className="text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase">
                                {formatAttendanceTime(record.date, record.checkOutTime)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 font-outfit text-center">
                            {record.checkOutTime ? (
                              <span className="inline-flex items-center text-[11px] font-black text-blue-700 dark:text-blue-400 whitespace-nowrap bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg border-2 border-blue-100 dark:border-blue-900 shadow-sm tabular-nums">
                                {formatWorkHours(record.workHours)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">--:--</span>
                            )}
                          </td>
                          <td className="p-4 font-outfit">
                            {record.checkInLocation?.address && record.checkInLocation.address !== "-" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLocationModal({ open: true, location: record })}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 h-8 px-2 font-black text-[10px] uppercase tracking-widest border-2 border-transparent hover:border-blue-200 rounded-lg"
                              >
                                <MapPin className="h-3.5 w-3.5 mr-1" />
                                Map
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div
                              className="h-9 w-9 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-500 transition-all shadow-sm"
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
                                    target.style.display = "none";
                                    const fallback = document.createElement("div");
                                    fallback.className = "w-full h-full bg-slate-100 flex items-center justify-center";
                                    fallback.innerHTML = '<svg class="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>';
                                    target.parentNode?.appendChild(fallback);
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                                  <User className="h-4 w-4 text-slate-300" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-2">
                              {/* Online Status */}
                              <div className="flex justify-center">
                                {(() => {
                                  const statusInfo = getOnlineStatusForDisplay(record);
                                  if (statusInfo.showAbsent) return null;
                                  if (statusInfo.label === "Checked Out") {
                                    return (
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Offline
                                      </span>
                                    );
                                  }
                                  return (
                                    <OnlineStatusIndicator
                                      isOnline={statusInfo.isOnline}
                                      size="sm"
                                      showLabel={true}
                                      clickable={isAdmin}
                                      attendanceId={parseInt(record.id)}
                                      userId={parseInt(record.userId)}
                                      userName={record.userName}
                                    />
                                  );
                                })()}
                              </div>
                              {/* Attendance Level Status */}
                              <div className="flex justify-center flex-wrap gap-1">
                                {getStatusBadge(record)}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {record.workSummary ? (
                              <button
                                type="button"
                                className="text-left text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors line-clamp-2 max-w-[150px]"
                                onClick={() => setSummaryModal({ open: true, summary: record.workSummary || "" })}
                              >
                                {record.workSummary}
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            {record.workReport ? (
                              <a
                                href={record.workReport}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-widest"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            {record.taskDeadlineReason ? (
                              <div className="max-w-[150px]">
                                <TruncatedText
                                  text={record.taskDeadlineReason}
                                  maxLength={30}
                                  showToggle={true}
                                  className="text-[11px] font-bold text-slate-600"
                                />
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
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
                            <p className="text-lg font-semibold text-slate-900 dark:text-white">
                              No records found
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Try adjusting your filters or date range
                            </p>
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
        <DialogContent className="sm:max-w-3xl border-2 border-black rounded-3xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-8 border-b-2 border-black bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-black flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-2xl font-black text-black dark:text-white uppercase tracking-tight font-outfit">
                  {selectedRecord?.userName}'s Attendance
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  Check-in and Check-out details for {selectedRecord?.date}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            {/* Check-in Selfie */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <h3 className="text-[10px] font-black text-black uppercase tracking-widest">{t.attendance.checkInSelfie}</h3>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black text-[9px] uppercase">Verified</Badge>
              </div>
              <div className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 border-black shadow-md">
                {selectedRecord?.checkInSelfie ? (
                  <img
                    src={selectedRecord.checkInSelfie}
                    alt="Check-in selfie"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = "none";
                      const fallback = document.createElement("div");
                      fallback.className = "w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center";
                      fallback.innerHTML = '<svg class="h-10 w-10 mb-2 opacity-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg><p class="text-[10px] font-black uppercase">No selfie available</p>';
                      target.parentNode?.appendChild(fallback);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                    <User className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase">{t.attendance.noSelfieAvailable}</p>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-400" />
                    <p className="text-xs font-black uppercase tracking-wider">
                      {selectedRecord?.checkInTime ? formatAttendanceTime(selectedRecord.date, selectedRecord.checkInTime) : "N/A"}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold opacity-90 leading-tight">
                      {selectedRecord?.checkInLocation?.address || "Location not available"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Check-out Selfie */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></div>
                  <h3 className="text-[10px] font-black text-black uppercase tracking-widest">{t.attendance.checkOutSelfie}</h3>
                </div>
                {selectedRecord?.checkOutTime && (
                  <Badge className="bg-rose-50 text-rose-700 border-rose-100 font-black text-[9px] uppercase">Verified</Badge>
                )}
              </div>
              <div className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 border-black shadow-md">
                {selectedRecord?.checkOutSelfie ? (
                  <img
                    src={selectedRecord.checkOutSelfie}
                    alt="Check-out selfie"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = "none";
                      const fallback = document.createElement("div");
                      fallback.className = "w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center";
                      fallback.innerHTML = '<svg class="h-10 w-10 mb-2 opacity-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg><p class="text-[10px] font-black uppercase">No check-out selfie</p>';
                      target.parentNode?.appendChild(fallback);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                    <User className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase">{t.attendance.checkOutSelfie}</p>
                    <p className="text-[9px] font-bold opacity-60 uppercase mt-1">{t.attendance.notCheckedOut}</p>
                  </div>
                )}
                {selectedRecord?.checkOutTime && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-3.5 w-3.5 text-rose-400" />
                      <p className="text-xs font-black uppercase tracking-wider">
                        {formatAttendanceTime(selectedRecord.date, selectedRecord.checkOutTime)}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold opacity-90 leading-tight">
                        {selectedRecord.checkOutLocation?.address || "Location not available"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t-2 border-black bg-slate-50/50">
            <Button
              variant="outline"
              onClick={() => setShowSelfieModal(false)}
              className="h-11 px-8 rounded-xl border-2 border-black font-black text-[10px] uppercase tracking-widest transition-all hover:bg-slate-100 gap-2"
            >
              <X className="h-4 w-4" />
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={summaryModal.open}
        onOpenChange={(open) =>
          setSummaryModal({ open, summary: open ? summaryModal.summary : null })
        }
      >
        <DialogContent className="sm:max-w-xl border-2 border-black rounded-3xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-8 border-b-2 border-black bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-black flex items-center justify-center shadow-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-2xl font-black text-black dark:text-white uppercase tracking-tight font-outfit">
                  {t.attendance.workSummaryTitle}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  {t.attendance.workSummaryDescription}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8">
            <div className="p-6 bg-slate-50 rounded-2xl border-2 border-black shadow-inner min-h-[200px] max-h-[400px] overflow-y-auto">
              <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                {summaryModal.summary || t.attendance.noSummaryProvided}
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 border-t-2 border-black bg-slate-50/50">
            <Button
              variant="outline"
              onClick={() => setSummaryModal({ open: false, summary: null })}
              className="h-11 px-8 rounded-xl border-2 border-black font-black text-[10px] uppercase tracking-widest transition-all hover:bg-slate-100 gap-2"
            >
              <X className="h-4 w-4" />
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={locationModal.open}
        onOpenChange={(open) =>
          setLocationModal({
            open,
            location: open ? locationModal.location : null,
          })
        }
      >
        <DialogContent className="sm:max-w-xl border-2 border-black rounded-3xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-8 border-b-2 border-black bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-black flex items-center justify-center shadow-lg">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-2xl font-black text-black dark:text-white uppercase tracking-tight font-outfit">
                  {t.attendance.checkInLocation}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  {t.attendance.fullLocationDetails}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8">
            <div className="p-6 bg-slate-50 rounded-2xl border-2 border-black shadow-inner">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-black flex items-center justify-center shadow-sm flex-shrink-0">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    {t.attendance.address}
                  </p>
                  <p className="text-sm font-bold text-black leading-relaxed break-words">
                    {locationModal.location?.checkInLocation?.address ||
                      t.attendance.locationNotAvailable}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 border-t-2 border-black bg-slate-50/50">
            <Button
              variant="outline"
              onClick={() => setLocationModal({ open: false, location: null })}
              className="h-11 px-8 rounded-xl border-2 border-black font-black text-[10px] uppercase tracking-widest transition-all hover:bg-slate-100 gap-2"
            >
              <X className="h-4 w-4" />
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden border-2 border-black rounded-3xl p-0 gap-0 shadow-2xl">
          <DialogHeader className="p-8 border-b-2 border-black bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-black flex items-center justify-center shadow-lg">
                <Download className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-2xl font-black text-black dark:text-white uppercase tracking-tight font-outfit">
                  {t.attendance.exportReport}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  {t.attendance.configureExport}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-8 p-8 flex-1 overflow-y-auto w-full">
            {/* Report Layout & Format in Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
              {/* Report Layout Selection */}
              <div className="space-y-4">
                <Label className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Report Layout</Label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'basic', label: 'Basic', sub: 'Standard list', icon: FileText, color: 'blue' },
                    { id: 'grid', label: 'Grid', sub: 'Monthly view', icon: Users, color: 'indigo' },
                    { id: 'detailed_grid', label: 'Detailed Grid', sub: 'Full details', icon: LayoutGrid, color: 'purple' }
                  ].map((layout) => (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => {
                        setReportLayout(layout.id as any);
                        if (layout.id === "detailed_grid") {
                          setExportType("pdf");
                        }
                      }}
                      className={`group flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden ${reportLayout === layout.id
                        ? "border-black bg-slate-100 shadow-inner"
                        : "border-slate-100 hover:border-black bg-white"
                        } ${layout.id === 'detailed_grid' && exportType === 'csv' ? 'hover:border-purple-400' : ''}`}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${reportLayout === layout.id ? 'bg-black text-white scale-110' : 'bg-slate-50 text-slate-400 group-hover:bg-black group-hover:text-white'}`}>
                        <layout.icon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className={`text-xs font-black uppercase tracking-tight ${reportLayout === layout.id ? 'text-black' : 'text-slate-600'}`}>{layout.label}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{layout.sub}</p>
                      </div>
                      {reportLayout === layout.id && <div className="absolute right-4 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-black animate-pulse" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Format Selection */}
              <div className="space-y-4">
                <Label className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Export Format</Label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'csv', label: 'CSV Excel', sub: '.csv format', icon: FileSpreadsheet, color: 'emerald' },
                    { id: 'pdf', label: 'PDF Document', sub: '.pdf format', icon: FileText, color: 'rose' }
                  ].map((format) => (
                    <button
                      key={format.id}
                      type="button"
                      disabled={reportLayout === "detailed_grid" && format.id === "csv"}
                      onClick={() => setExportType(format.id as any)}
                      className={`group flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden ${exportType === format.id
                        ? "border-black bg-slate-100 shadow-inner"
                        : "border-slate-100 hover:border-black bg-white"
                        } ${reportLayout === "detailed_grid" && format.id === "csv" ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${exportType === format.id ? 'bg-black text-white scale-110' : 'bg-slate-50 text-slate-400 group-hover:bg-black group-hover:text-white'}`}>
                        <format.icon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className={`text-xs font-black uppercase tracking-tight ${exportType === format.id ? 'text-black' : 'text-slate-600'}`}>{format.label}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{format.sub}</p>
                      </div>
                      {exportType === format.id && <div className="absolute right-4 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-black animate-pulse" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters Section */}
            <div className="space-y-6 pt-6 border-t-2 border-black border-dashed">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date Selection — Month/Year for grid layouts, Date Range for basic */}
                {(reportLayout === "grid" || reportLayout === "detailed_grid") ? (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="space-y-2">
                      <Label htmlFor="grid-month" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Month</Label>
                      <Select value={gridMonth} onValueChange={setGridMonth}>
                        <SelectTrigger id="grid-month" className="w-full h-11 border-2 border-black rounded-xl font-bold text-sm bg-white">
                          <SelectValue placeholder="Select Month" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black rounded-xl">
                          <SelectItem value="1" className="font-bold">JANUARY</SelectItem>
                          <SelectItem value="2" className="font-bold">FEBRUARY</SelectItem>
                          <SelectItem value="3" className="font-bold">MARCH</SelectItem>
                          <SelectItem value="4" className="font-bold">APRIL</SelectItem>
                          <SelectItem value="5" className="font-bold">MAY</SelectItem>
                          <SelectItem value="6" className="font-bold">JUNE</SelectItem>
                          <SelectItem value="7" className="font-bold">JULY</SelectItem>
                          <SelectItem value="8" className="font-bold">AUGUST</SelectItem>
                          <SelectItem value="9" className="font-bold">SEPTEMBER</SelectItem>
                          <SelectItem value="10" className="font-bold">OCTOBER</SelectItem>
                          <SelectItem value="11" className="font-bold">NOVEMBER</SelectItem>
                          <SelectItem value="12" className="font-bold">DECEMBER</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grid-year" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Year</Label>
                      <Select value={gridYear} onValueChange={setGridYear}>
                        <SelectTrigger id="grid-year" className="w-full h-11 border-2 border-black rounded-xl font-bold text-sm bg-white">
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black rounded-xl">
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
                            <SelectItem key={yr} value={String(yr)} className="font-bold">{yr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 w-full">
                    <Label htmlFor="quick-filter" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Time Period</Label>
                    <Select value={quickFilter} onValueChange={handleQuickFilter}>
                      <SelectTrigger id="quick-filter" className="w-full h-11 border-2 border-black rounded-xl font-bold text-sm bg-white">
                        <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent className="border-2 border-black rounded-xl">
                        <SelectItem value="yesterday" className="font-bold text-sm uppercase">Yesterday</SelectItem>
                        <SelectItem value="current_month" className="font-bold text-sm uppercase">Current Month</SelectItem>
                        <SelectItem value="last_month" className="font-bold text-sm uppercase">Last Month</SelectItem>
                        <SelectItem value="last_3_months" className="font-bold text-sm uppercase">Last 3 Months</SelectItem>
                        <SelectItem value="last_6_months" className="font-bold text-sm uppercase">Last 6 Months</SelectItem>
                        <SelectItem value="last_year" className="font-bold text-sm uppercase">Last 1 Year</SelectItem>
                        <SelectItem value="custom" className="font-bold text-sm uppercase">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}


              </div>

              {/* Custom Date Selection */}
              {quickFilter === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-slate-50 border-2 border-black rounded-2xl animate-in zoom-in-95 duration-200">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> From Date
                    </Label>
                    <DatePicker date={startDate} onDateChange={setStartDate} toDate={new Date()} placeholder="Start" className="w-full h-11 border-2 border-black rounded-xl bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> To Date
                    </Label>
                    <DatePicker date={endDate} onDateChange={setEndDate} fromDate={startDate} toDate={new Date()} placeholder="End" className="w-full h-11 border-2 border-black rounded-xl bg-white" />
                  </div>
                </div>
              )}

              {/* Specific Employee Selection Controls */}
              {employeeFilter === "specific" && (
                <div className="space-y-4 p-6 bg-slate-50 border-2 border-black rounded-2xl animate-in zoom-in-95 duration-200">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Department</Label>
                    <Select value={selectedDepartmentFilter} onValueChange={setSelectedDepartmentFilter}>
                      <SelectTrigger className="w-full h-11 border-2 border-black rounded-xl font-bold text-sm bg-white">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent className="border-2 border-black rounded-xl">
                        {coreDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept} className="font-bold text-sm uppercase">{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedDepartmentFilter && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-black uppercase tracking-widest">Search Employee</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            placeholder="Type employee name or ID..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            className="pl-10 h-11 border-2 border-black rounded-xl bg-white font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto p-1">
                        {filteredEmployees.length ? (
                          filteredEmployees.map((emp) => (
                            <button
                              key={emp.user_id}
                              type="button"
                              onClick={() => setSelectedEmployee(emp)}
                              className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedEmployee?.user_id === emp.user_id ? 'border-black bg-white shadow-md' : 'border-transparent hover:bg-white hover:border-slate-200'}`}
                            >
                              <div className="text-left">
                                <p className="text-xs font-black text-black uppercase">{emp.name}</p>
                                <p className="text-[10px] font-bold text-slate-400">ID: {emp.employee_id || emp.user_id}</p>
                              </div>
                              {selectedEmployee?.user_id === emp.user_id && <Check className="h-4 w-4 text-black" />}
                            </button>
                          ))
                        ) : (
                          <div className="py-8 text-center bg-white rounded-xl border-2 border-dashed border-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No results found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-8 border-t-2 border-black bg-slate-50/50 sm:justify-between w-full">
            <Button
              variant="outline"
              onClick={() => { setExportModalOpen(false); setExportType(null); }}
              className="h-12 px-8 rounded-xl border-2 border-black font-black text-[10px] uppercase tracking-widest transition-all hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              onClick={performExport}
              disabled={isExporting || !exportType || (!startDate && !endDate) || (employeeFilter === "specific" && !selectedEmployee)}
              className="h-12 px-8 rounded-xl border-2 border-black bg-black text-white font-black text-[10px] uppercase tracking-widest gap-2 shadow-lg hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : `Generate ${exportType?.toUpperCase() || 'Report'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const officeHoursContent = (
    <div className="space-y-8">


      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {officeQuickStats.map((stat, index) => {
          const labels = ["blue", "green", "orange", "purple"];
          const label = labels[index % labels.length];
          const icons = [Clock, Timer, Timer, Settings];
          const Icon = icons[index % icons.length];

          return (
            <SummaryCard
              key={stat.label}
              title={stat.label}
              value={stat.value}
              icon={Icon}
              iconColor={`text-${label}-600`}
              iconBg={`bg-${label}-50`}
            />
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-xl border-2 border-[#000000] rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1 pb-4 bg-slate-50/50 dark:bg-slate-800/50 border-b-2 border-black">
            <CardTitle className="text-sm font-black text-black dark:text-white uppercase tracking-widest font-outfit">
              Office Hours
            </CardTitle>
            <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
              Default schedule for the organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="global-start" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Start Time</Label>
                <div className="relative">
                  <Input
                    id="global-start"
                    type="time"
                    value={globalTimingForm.startTime}
                    onChange={(e) =>
                      setGlobalTimingForm((prev) => ({
                        ...prev,
                        startTime: e.target.value,
                      }))
                    }
                    className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 font-black text-sm pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-50 focus:outline-none"
                    onClick={() =>
                      setOpenTimePicker((prev) =>
                        prev === "globalStart" ? null : "globalStart",
                      )
                    }
                  >
                    <Clock className="h-4 w-4 text-black" />
                  </button>
                  {openTimePicker === "globalStart" && (
                    <TimePickerDropdown
                      field="globalStart"
                      value={globalTimingForm.startTime}
                      accent="blue"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="global-end" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">End Time</Label>
                <div className="relative">
                  <Input
                    id="global-end"
                    type="time"
                    value={globalTimingForm.endTime}
                    onChange={(e) =>
                      setGlobalTimingForm((prev) => ({
                        ...prev,
                        endTime: e.target.value,
                      }))
                    }
                    className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 font-black text-sm pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-50 focus:outline-none"
                    onClick={() =>
                      setOpenTimePicker((prev) =>
                        prev === "globalEnd" ? null : "globalEnd",
                      )
                    }
                  >
                    <Clock className="h-4 w-4 text-black" />
                  </button>
                  {openTimePicker === "globalEnd" && (
                    <TimePickerDropdown
                      field="globalEnd"
                      value={globalTimingForm.endTime}
                      accent="blue"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="global-grace-in" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">
                  In Grace (Mins)
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
                      checkInGrace:
                        e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 font-black text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="global-grace-out" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">
                  Out Grace (Mins)
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
                      checkOutGrace:
                        e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 font-black text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-6 border-t-2 border-black">
              <Button
                variant="outline"
                className="h-11 px-6 rounded-xl border-2 border-black font-black text-xs uppercase tracking-widest transition-all active:scale-95 bg-white hover:bg-slate-50"
                onClick={() => loadOfficeTimings()}
                disabled={officeFormLoading}
              >
                Refresh
              </Button>
              <Button
                onClick={handleGlobalTimingSave}
                disabled={isGlobalSaving || officeFormLoading}
                className="h-11 px-6 rounded-xl border-2 border-black font-black text-xs uppercase tracking-widest transition-all active:scale-95 bg-black text-white hover:bg-[#333333]"
              >
                {isGlobalSaving ? "Saving..." : "Save Global Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          ref={departmentFormRef}
          className="shadow-xl border-2 border-[#000000] rounded-2xl overflow-hidden transition-all duration-300"
        >
          <CardHeader className="space-y-1 pb-4 bg-slate-50/50 dark:bg-slate-800/50 border-b-2 border-black">
            <CardTitle className="text-sm font-black text-black dark:text-white uppercase tracking-widest font-outfit">
              Department Timing Override
            </CardTitle>
            <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
              Customize schedule for specific departments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Select Department</Label>
              <Select
                value={departmentTimingForm.department || undefined}
                onValueChange={handleDepartmentSelect}
                disabled={
                  coreDepartments.length === 0 &&
                  !departmentTimingForm.department
                }
              >
                <SelectTrigger className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 font-black text-sm">
                  <SelectValue
                    placeholder={
                      coreDepartments.length
                        ? "Choose a department..."
                        : "No departments available"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="border-2 border-black rounded-xl">
                  {coreDepartments.length === 0 ? (
                    <SelectItem value="__no_departments__" disabled>
                      {departmentTimingForm.department
                        ? `Using existing: ${departmentTimingForm.department}`
                        : "No departments found"}
                    </SelectItem>
                  ) : (
                    <>
                      {coreDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept} className="font-bold text-sm">
                          {dept}
                        </SelectItem>
                      ))}
                      {departmentTimingForm.department &&
                        !coreDepartments.some(
                          (dept) =>
                            dept.trim().toLowerCase() ===
                            departmentTimingForm.department
                              ?.trim()
                              .toLowerCase(),
                        ) && (
                          <SelectItem
                            value={departmentTimingForm.department}
                            disabled
                            className="font-bold text-sm"
                          >
                            {departmentTimingForm.department} (not in list)
                          </SelectItem>
                        )}
                      <SelectItem value="__clear__" className="text-red-500 font-bold text-sm">
                        Clear Selection
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dept-start" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Start Time</Label>
                <div className="relative">
                  <Input
                    id="dept-start"
                    type="time"
                    value={departmentTimingForm.startTime}
                    onChange={(e) =>
                      setDepartmentTimingForm((prev) => ({
                        ...prev,
                        startTime: e.target.value,
                      }))
                    }
                    className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 font-black text-sm pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-50 focus:outline-none"
                    onClick={() =>
                      setOpenTimePicker((prev) =>
                        prev === "deptStart" ? null : "deptStart",
                      )
                    }
                  >
                    <Clock className="h-4 w-4 text-black" />
                  </button>
                  {openTimePicker === "deptStart" && (
                    <TimePickerDropdown
                      field="deptStart"
                      value={departmentTimingForm.startTime}
                      accent="purple"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-end" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">End Time</Label>
                <div className="relative">
                  <Input
                    id="dept-end"
                    type="time"
                    value={departmentTimingForm.endTime}
                    onChange={(e) =>
                      setDepartmentTimingForm((prev) => ({
                        ...prev,
                        endTime: e.target.value,
                      }))
                    }
                    className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 font-black text-sm pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-50 focus:outline-none"
                    onClick={() =>
                      setOpenTimePicker((prev) =>
                        prev === "deptEnd" ? null : "deptEnd",
                      )
                    }
                  >
                    <Clock className="h-4 w-4 text-black" />
                  </button>
                  {openTimePicker === "deptEnd" && (
                    <TimePickerDropdown
                      field="deptEnd"
                      value={departmentTimingForm.endTime}
                      accent="purple"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-grace-in" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">In Grace (Mins)</Label>
                <Input
                  id="dept-grace-in"
                  type="number"
                  min={0}
                  max={180}
                  value={departmentTimingForm.checkInGrace}
                  onChange={(e) =>
                    setDepartmentTimingForm((prev) => ({
                      ...prev,
                      checkInGrace:
                        e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 font-black text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-grace-out" className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">
                  Out Grace (Mins)
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
                      checkOutGrace:
                        e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 font-black text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-6 border-t-2 border-black">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setDepartmentTimingForm({
                    department: "",
                    startTime: globalTimingForm.startTime,
                    endTime: globalTimingForm.endTime,
                    checkInGrace: globalTimingForm.checkInGrace,
                    checkOutGrace: globalTimingForm.checkOutGrace,
                  })
                }
                className="h-11 px-6 rounded-xl border-2 border-black font-black text-xs uppercase tracking-widest transition-all active:scale-95 bg-white hover:bg-slate-50"
              >
                Reset
              </Button>
              <Button
                onClick={handleDepartmentTimingSave}
                disabled={
                  isDeptSaving ||
                  officeFormLoading ||
                  !departmentTimingForm.department.trim()
                }
                className="h-11 px-6 rounded-xl border-2 border-black font-black text-xs uppercase tracking-widest transition-all active:scale-95 bg-black text-white hover:bg-[#333333]"
              >
                {isDeptSaving ? "Saving..." : "Save Department Timing"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl border-2 border-[#000000] rounded-2xl overflow-hidden">
        <CardHeader className="space-y-1 pb-4 bg-slate-50/50 dark:bg-slate-800/50 border-b-2 border-black">
          <CardTitle className="text-sm font-black text-black dark:text-white uppercase tracking-widest font-outfit">
            Configured Schedules
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
            Overview of current global and department timings
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {officeTimings.length > 0 ? (
            <div className="grid gap-4">
              {officeTimings.map((timing) => {
                const isGlobalTiming = !timing.department;
                return (
                  <div
                    key={timing.id}
                    className="group border-2 border-black rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all hover:bg-slate-50/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isGlobalTiming ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                          {isGlobalTiming ? <Globe className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                        </div>
                        <h3 className="text-lg font-black text-black dark:text-white uppercase tracking-tight font-outfit">
                          {isGlobalTiming ? "Global Schedule" : timing.department}
                        </h3>
                        {isGlobalTiming && (
                          <Badge className="bg-blue-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md uppercase">Default</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900">
                          <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase">
                            Start: {formatTimeDisplay(timing.start_time)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900">
                          <LogOut className="h-3.5 w-3.5 text-rose-600" />
                          <span className="text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase">
                            End: {formatTimeDisplay(timing.end_time)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-100 dark:border-orange-900">
                          <Timer className="h-3.5 w-3.5 text-orange-600" />
                          <span className="text-[11px] font-black text-orange-700 dark:text-orange-400 uppercase">
                            Grace: {timing.check_in_grace_minutes}m In / {timing.check_out_grace_minutes}m Out
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleDepartmentTimingEdit(timing)}
                        className="h-10 px-4 rounded-xl border-2 border-black bg-white hover:bg-slate-50 text-black font-black text-[10px] uppercase tracking-widest gap-2"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      {!isGlobalTiming && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDepartmentTimingDelete(timing)}
                          disabled={officeFormLoading}
                          className="h-10 px-4 rounded-xl border-2 border-black bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest gap-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <div className="h-20 w-20 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Clock className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-black dark:text-white uppercase tracking-tight mb-2">No schedules found</h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider max-w-md mx-auto">
                Start by configuring global office hours or add department-specific overrides above.
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
        <div className="space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(
                value as "attendance" | "office-hours" | "wfh-requests",
              )
            }
            className="space-y-6"
          >
            {attendanceHeader}
            {tabsContainer}
            <TabsContent value="attendance" className="space-y-6">
              {attendanceContent}
            </TabsContent>
            <TabsContent value="office-hours" className="space-y-6">
              {officeHoursContent}
            </TabsContent>
            <TabsContent value="wfh-requests" className="space-y-6">
              {/* Pending WFH Requests Section */}
              <Card className="border-2 border-[#000000] shadow-xl bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-5 border-b-2 border-black">
                  <CardTitle className="text-xl font-black text-[#000000] dark:text-white tracking-tight font-outfit uppercase flex items-center gap-3">
                    <FileText className="h-6 w-6 text-blue-600" />
                    WFH Pending Requests
                    {getAdminPendingWfhCount() > 0 && (
                      <Badge className="bg-rose-500 text-white border-0 h-6 px-2 text-[10px] font-black rounded-full">
                        {getAdminPendingWfhCount()}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs font-bold text-[#5e5b5b] dark:text-slate-400 tracking-wider mt-1 uppercase">
                    Review and process recent work from home requests
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {isLoadingWfhRequests ? (
                    <div className="flex items-center justify-center py-8">
                      <Timer className="h-8 w-8 animate-spin text-purple-600" />
                      <span className="ml-2 text-muted-foreground">
                        Loading requests...
                      </span>
                    </div>
                  ) : allWfhRequests.filter((req) => req.status === "pending")
                    .length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {allWfhRequests
                          .filter((req) => req.status === "pending")
                          .slice(
                            (pendingWfhCurrentPage - 1) * pendingWfhItemsPerPage,
                            pendingWfhCurrentPage * pendingWfhItemsPerPage,
                          )
                          .map((request) => (
                            <div
                              key={request.id}
                              className="border-2 border-black rounded-xl p-5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 group shadow-sm hover:shadow-md"
                            >
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                <div className="space-y-3 flex-1">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                                      <User className="h-4 w-4 text-blue-600" />
                                      <span className="text-sm font-black text-black dark:text-white uppercase tracking-tight">
                                        {request.submittedBy}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-700 bg-white">
                                        {formatRoleDisplay(request.role)}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                      <Calendar className="h-4 w-4 text-emerald-600" />
                                      <span className="text-sm font-black text-black dark:text-white uppercase tracking-tight">
                                        {formatDateIST(request.startDate, "dd MMM yyyy")} - {formatDateIST(request.endDate, "dd MMM yyyy")}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] font-bold border-emerald-200 text-emerald-700 bg-white">
                                        {request.type === "full_day" ? "Full Day" : "Half Day"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed italic">
                                      "{request.reason}"
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                                    <span className="flex items-center gap-1">
                                      <History className="h-3 w-3" />
                                      Submitted: {formatRelativeTime(request.submittedAt)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Globe className="h-3 w-3" />
                                      Dept: {request.department}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-row lg:flex-col gap-3 min-w-[140px]">
                                  <Button
                                    size="lg"
                                    className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-black font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md flex-1 lg:w-full"
                                    onClick={() => handleAdminWfhRequestAction(request.id, "approve")}
                                    disabled={isProcessingWfhRequest}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="lg"
                                    className="h-11 px-6 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border-2 border-rose-600 font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex-1 lg:w-full"
                                    onClick={() => {
                                      setSelectedWfhRequest(request);
                                      setShowWfhRequestDialog(true);
                                    }}
                                    disabled={isProcessingWfhRequest}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                      <div className="mt-4">
                        <Pagination
                          currentPage={pendingWfhCurrentPage}
                          totalPages={Math.ceil(
                            allWfhRequests.filter(
                              (req) => req.status === "pending",
                            ).length / pendingWfhItemsPerPage,
                          )}
                          totalItems={
                            allWfhRequests.filter(
                              (req) => req.status === "pending",
                            ).length
                          }
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

              <Card className="border-2 border-[#000000] shadow-xl bg-white dark:bg-slate-900 rounded-2xl overflow-hidden mt-8">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-5 border-b-2 border-black">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-[#000000] flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-110">
                        <History className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-black text-[#000000] dark:text-white tracking-tight font-outfit uppercase">
                          Recent WFH Decisions
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-[#5e5b5b] dark:text-slate-400 tracking-wider mt-1 uppercase">
                          History of processed requests
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Filter Controls for Recent Decisions */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 border-b-2 border-black rounded-xl">
                      <div className="flex flex-col xl:flex-row gap-6 items-end w-full">
                        <div className="flex-1 w-full xl:w-auto flex flex-col gap-2">
                          <Label className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">
                            Decision Status
                          </Label>
                          <Select value={wfhRequestFilter} onValueChange={(value: any) => setWfhRequestFilter(value)}>
                            <SelectTrigger className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 font-bold text-sm">
                              <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent className="border-2 border-black rounded-xl">
                              <SelectItem value="all">All Decisions</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col md:flex-row items-end gap-4 w-full xl:w-auto">
                          <div className="flex flex-col gap-2 w-full md:w-[200px]">
                            <Label className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Time Period</Label>
                            <Select value={wfhDecisionsDurationFilter} onValueChange={handleWfhDecisionsDurationFilter}>
                              <SelectTrigger className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 font-bold text-sm">
                                <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-2 border-black rounded-xl">
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="current_month">Current Month</SelectItem>
                                <SelectItem value="last_month">Last Month</SelectItem>
                                <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                                <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                                <SelectItem value="last_year">Last Year</SelectItem>
                                <SelectItem value="custom">Custom Range</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {wfhDecisionsDurationFilter === 'custom' && (
                            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-300 w-full md:w-auto">
                              <div className="w-full md:w-[130px]">
                                <DatePicker
                                  date={wfhDecisionsStartDate}
                                  onDateChange={setWfhDecisionsStartDate}
                                  placeholder="Start"
                                  className="w-full bg-white dark:bg-gray-950 border-2 border-black rounded-xl h-11 text-xs"
                                />
                              </div>
                              <div className="w-full md:w-[130px]">
                                <DatePicker
                                  date={wfhDecisionsEndDate}
                                  onDateChange={setWfhDecisionsEndDate}
                                  fromDate={wfhDecisionsStartDate}
                                  placeholder="End"
                                  className="w-full bg-white dark:bg-gray-950 border-2 border-black rounded-xl h-11 text-xs"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col gap-2 w-full md:w-[180px]">
                            <Label className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest ml-1">Role Filter</Label>
                            <Select value={wfhRoleFilter} onValueChange={(value: any) => setWfhRoleFilter(value)}>
                              <SelectTrigger className="h-11 border-2 border-black rounded-xl bg-white dark:bg-gray-950 font-bold text-sm">
                                <Filter className="h-4 w-4 mr-2 text-blue-500" />
                                <SelectValue placeholder="All Roles" />
                              </SelectTrigger>
                              <SelectContent className="border-2 border-black rounded-xl">
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="hr">HR</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="team_lead">Team Lead</SelectItem>
                                <SelectItem value="employee">Employee</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                    </div>

                    {isLoadingWfhRequests ? (
                      <div className="flex items-center justify-center py-8">
                        <Timer className="h-8 w-8 animate-spin text-blue-600" />
                        <span className="ml-2 text-muted-foreground">
                          Loading decisions...
                        </span>
                      </div>
                    ) : filteredRecentDecisions.length > 0 ? (
                      <>
                        <div className="space-y-3">
                          {filteredRecentDecisions
                            .slice(
                              (wfhCurrentPage - 1) * wfhItemsPerPage,
                              wfhCurrentPage * wfhItemsPerPage,
                            )
                            .map((request) => (
                              <div
                                key={request.id}
                                className="border-2 border-black rounded-xl p-5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 group shadow-sm hover:shadow-md"
                              >
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                  <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-4 flex-wrap">
                                      <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <User className="h-3.5 w-3.5 text-slate-500" />
                                        <span className="text-sm font-black text-black dark:text-white uppercase tracking-tight">
                                          {request.submittedBy}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] font-bold border-slate-200 text-slate-600 bg-white dark:bg-slate-900">
                                          {formatRoleDisplay(request.role)}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                                        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                                          {formatDateIST(request.startDate, "dd MMM yyyy")} - {formatDateIST(request.endDate, "dd MMM yyyy")}
                                        </span>
                                        <Badge
                                          className={`text-[10px] font-black rounded-lg border-0 px-2 h-5 flex items-center justify-center ${request.status === "approved"
                                            ? "bg-emerald-500 text-white"
                                            : "bg-rose-500 text-white"
                                            }`}
                                        >
                                          {request.status.toUpperCase()}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                                      <p className="text-sm font-bold text-slate-600 dark:text-slate-400 italic">
                                        {request.reason}
                                      </p>
                                    </div>
                                    {request.rejectionReason && (
                                      <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-100 dark:border-rose-900/50 rounded-xl">
                                        <p className="text-[12px] font-bold text-rose-700 dark:text-rose-400">
                                          <span className="uppercase tracking-widest mr-2 opacity-70">Rejection Reason:</span>
                                          {request.rejectionReason}
                                        </p>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-1 px-1">
                                      <span className="flex items-center gap-1.5">
                                        <History className="h-3 w-3" />
                                        Submission: {formatDateTimeIST(request.submittedAt, "dd MMM yyyy, hh:mm a")}
                                      </span>
                                      <span className="h-1 w-1 rounded-full bg-slate-200" />
                                      <span className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Decision: {formatDateTimeIST(request.processedAt || request.submittedAt, "dd MMM yyyy, hh:mm a")}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                        <div className="mt-4">
                          <Pagination
                            currentPage={wfhCurrentPage}
                            totalPages={Math.ceil(
                              filteredRecentDecisions.length / wfhItemsPerPage,
                            )}
                            totalItems={filteredRecentDecisions.length}
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
                          {wfhRequestFilter === "all"
                            ? "No requests have been approved or rejected"
                            : `No ${wfhRequestFilter} requests`}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="space-y-6">
          {attendanceHeader}
          {attendanceContent}
        </div>
      )}
    </div>
  );
};

export default AttendanceManager;
