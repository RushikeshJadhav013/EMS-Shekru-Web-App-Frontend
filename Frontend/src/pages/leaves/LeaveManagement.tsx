import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import TruncatedText from "@/components/ui/TruncatedText";
import { Pagination } from "@/components/ui/pagination";
import { useLeaveBalance } from "@/contexts/LeaveBalanceContext";
import { useHolidays } from "@/contexts/HolidayContext";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  calculateLeaveDays,
  getLeaveDeductionTypes,
  isLeaveTypeDisabled,
  getAvailableLeaveTypes,
  validateLeaveRequest,
} from "@/utils/leaveUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { CalendarWithSelect } from "@/components/ui/calendar-with-select";
import { DatePicker } from "@/components/ui/date-picker";
import { HolidayCalendar } from "@/components/ui/holiday-calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addDays, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  formatIST,
  formatDateTimeIST,
  formatDateIST,
  todayIST,
  parseToIST,
  nowIST,
} from "@/utils/timezone";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/lib/api";
import { cn } from "@/lib/utils";
import SummaryCard from "@/components/ui/SummaryCard";

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
  ChevronRight,
  Loader2,
  Download,
} from "lucide-react";

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  role?: string;
  type:
  | "annual"
  | "sick"
  | "casual"
  | "maternity"
  | "paternity"
  | "unpaid"
  | "wfh";
  startDate: Date;
  endDate: Date;
  reason: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  comments?: string;
  requestDate: Date;
  isWFH?: boolean;
  duration_days?: number;
  leave_session?: string | null;
}

export default function LeaveManagement() {
  const { user } = useAuth();
  const {
    holidays,
    addHoliday,
    removeHoliday,
    isHoliday,
    getHolidayName,
    refreshHolidays,
  } = useHolidays();
  const { addNotification } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [displayedMonth, setDisplayedMonth] = useState<Date>(new Date());

  // Refresh holidays on mount to ensure we have the latest data
  useEffect(() => {
    refreshHolidays();
  }, []);

  // Initialize leave requests from localStorage or use default mock data
  const initializeLeaveRequests = (): LeaveRequest[] => {
    const stored = localStorage.getItem("leaveRequests");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LeaveRequest[];
        // Convert date strings back to Date objects
        return parsed.map((req) => ({
          ...req,
          startDate: new Date(req.startDate),
          endDate: new Date(req.endDate),
          requestDate: new Date(req.requestDate),
        }));
      } catch (error) {
        console.error("Error parsing leave requests:", error);
      }
    }
    // Default mock data
    return [
      {
        id: "1",
        employeeId: "EMP001",
        employeeName: "John Doe",
        department: "Engineering",
        type: "annual",
        startDate: new Date(2024, 0, 15),
        endDate: new Date(2024, 0, 17),
        reason: "Family vacation",
        status: "pending",
        requestDate: new Date(2024, 0, 10),
      },
      {
        id: "2",
        employeeId: "EMP002",
        employeeName: "Jane Smith",
        department: "Marketing",
        type: "sick",
        startDate: new Date(2024, 0, 20),
        endDate: new Date(2024, 0, 21),
        reason: "Medical appointment",
        status: "approved",
        approvedBy: "Manager",
        requestDate: new Date(2024, 0, 18),
      },
    ];
  };

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(
    initializeLeaveRequests(),
  );
  const [approvalRequests, setApprovalRequests] = useState<LeaveRequest[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<LeaveRequest[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [customHistoryStartDate, setCustomHistoryStartDate] = useState<
    Date | undefined
  >(undefined);
  const [customHistoryEndDate, setCustomHistoryEndDate] = useState<
    Date | undefined
  >(new Date());
  const [leaveHistoryCustomStartDate, setLeaveHistoryCustomStartDate] =
    useState<Date | undefined>(undefined);
  const [leaveHistoryCustomEndDate, setLeaveHistoryCustomEndDate] = useState<
    Date | undefined
  >(new Date());
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "all" | "approved" | "rejected"
  >("all");
  const [historyRoleFilter, setHistoryRoleFilter] = useState<
    "all" | "hr" | "manager" | "team_lead" | "employee"
  >("all");

  const [formData, setFormData] = useState({
    type: "sick",
    startDate: new Date(),
    endDate: new Date(),
    reason: "",
    unpaidSubType: "full_day" as "full_day" | "half_day_before_lunch" | "half_day_after_lunch",
  });

  const canApproveLeaves = user?.role === "admin" || user?.role === "hr" || user?.role === "manager" || user?.role === "team_lead";
  const canViewTeamLeaves = user?.role === "admin" || user?.role === "hr" || user?.role === "manager" || user?.role === "team_lead";

  const [isDeletingLeave, setIsDeletingLeave] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvingLeaveId, setApprovingLeaveId] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      if (!(canApproveLeaves || canViewTeamLeaves)) return;
      const approvals = await apiService.getLeaveApprovals();

      const formattedLeaves: LeaveRequest[] = approvals
        .filter((req: any) => (req.leave_type || "").toLowerCase() !== "wfh")
        .map((req: any) => ({
          id: String(req.leave_id),
          employeeId: String(req.user_id),
          employeeName: req.name || req.employee_id,
          department: req.department || req.department_name || "",
          role: req.role || "employee",
          type: (
            req.leave_type || "annual"
          ).toLowerCase() as LeaveRequest["type"],
          startDate: new Date(req.start_date),
          endDate: new Date(req.end_date),
          reason: req.reason,
          status: String(
            req.status || "pending",
          ).toLowerCase() as LeaveRequest["status"],
          requestDate: new Date(req.start_date),
          isWFH: false,
        }));

      setApprovalRequests(formattedLeaves);
    } catch (error) {
      console.error("Error fetching approvals:", error);
    }
  }, [canApproveLeaves, canViewTeamLeaves]);

  const fetchApprovalHistory = useCallback(async () => {
    try {
      if (!canApproveLeaves) return;

      // Prepare parameters based on historyFilter
      const params: {
        period?: string;
        start_date?: string;
        end_date?: string;
      } = {
        period: historyFilter,
      };

      if (
        historyFilter === "custom" &&
        customHistoryStartDate &&
        customHistoryEndDate
      ) {
        params.start_date = format(customHistoryStartDate, "yyyy-MM-dd");
        params.end_date = format(customHistoryEndDate, "yyyy-MM-dd");
      }

      const history = await apiService.getLeaveApprovalsHistory(params);

      const formattedLeaves: LeaveRequest[] = history
        .filter((req: any) => (req.leave_type || "").toLowerCase() !== "wfh")
        .map((req: any) => ({
          id: String(req.leave_id),
          employeeId: String(req.user_id),
          employeeName: req.name || req.employee_id,
          department: req.department || req.department_name || "",
          role: req.role || "employee",
          type: (
            req.leave_type || "annual"
          ).toLowerCase() as LeaveRequest["type"],
          startDate: new Date(req.start_date),
          endDate: new Date(req.end_date),
          reason: req.reason,
          status: String(
            req.status || "approved",
          ).toLowerCase() as LeaveRequest["status"],
          requestDate: new Date(req.start_date),
          isWFH: false,
        }));

      // Merge with existing history
      setApprovalHistory((prev) => {
        const existingIds = new Set(formattedLeaves.map((r) => r.id));
        const localDecisions = prev.filter(
          (r) => !existingIds.has(r.id) && r.status !== "pending",
        );
        const combined = [...localDecisions, ...formattedLeaves];
        return combined.sort((a, b) => {
          const timeA = new Date(a.requestDate).getTime();
          const timeB = new Date(b.requestDate).getTime();
          return timeB - timeA;
        });
      });
    } catch (error) {
      console.error("Error fetching approvals history:", error);
    }
  }, [
    canApproveLeaves,
    historyFilter,
    customHistoryStartDate,
    customHistoryEndDate,
  ]);
  const [leaveHistoryPeriod, setLeaveHistoryPeriod] = useState<string>("all");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [editFormData, setEditFormData] = useState({
    startDate: new Date(),
    endDate: new Date(),
    reason: "",
  });
  const [isUpdatingLeave, setIsUpdatingLeave] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null);

  // Pagination states for approval requests
  const [approvalCurrentPage, setApprovalCurrentPage] = useState(1);
  const [approvalItemsPerPage, setApprovalItemsPerPage] = useState(10);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(
    new Set(),
  );

  // Pagination states for approval history
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(20);

  // Pagination states for My Leave History
  const [myLeaveCurrentPage, setMyLeaveCurrentPage] = useState(1);
  const [myLeaveItemsPerPage, setMyLeaveItemsPerPage] = useState(10);

  // Leave export states
  const [leaveStartDate, setLeaveStartDate] = useState(
    formatIST(
      new Date(nowIST().getFullYear(), nowIST().getMonth(), 1),
      "yyyy-MM-dd",
    ),
  );
  const [leaveEndDate, setLeaveEndDate] = useState(
    formatIST(
      new Date(nowIST().getFullYear(), nowIST().getMonth() + 1, 0),
      "yyyy-MM-dd",
    ),
  );
  const [leaveDepartment, setLeaveDepartment] = useState("all");
  const [leaveFormat, setLeaveFormat] = useState<"pdf" | "csv">("pdf");
  const [isExportLoading, setIsExportLoading] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Holiday dialog state
  const [selectedHoliday, setSelectedHoliday] = useState<
    (typeof holidays)[0] | null
  >(null);
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);

  const [holidayForm, setHolidayForm] = useState<{
    dates: Date[];
    name: string;
    description?: string;
    is_recurring: boolean;
  }>({
    dates: [],
    name: "",
    description: "",
    is_recurring: false,
  });

  const handleAddHoliday = async () => {
    // Check if user is admin
    if (user?.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "Only administrators can add holidays.",
        variant: "destructive",
      });
      return;
    }

    if (!holidayForm.name) {
      toast({
        title: "Error",
        description: "Please enter a holiday name.",
        variant: "destructive",
      });
      return;
    }

    if (!holidayForm.dates || holidayForm.dates.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one date.",
        variant: "destructive",
      });
      return;
    }

    // Check if any date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hasPastDates = holidayForm.dates.some((d) => {
      const selected = new Date(d);
      selected.setHours(0, 0, 0, 0);
      return selected < today;
    });

    if (hasPastDates) {
      toast({
        title: "Error",
        description:
          "Cannot set holidays for past dates. Please select current or future dates.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use Promise.all to add multiple holidays concurrently
      await Promise.all(
        holidayForm.dates.map(async (d) => {
          // Use local date handling to avoid timezone shifts
          const dateStr = format(d, "yyyy-MM-dd");
          // Create date at noon to avoid boundary issues
          const normalizedDate = new Date(dateStr + "T12:00:00");

          await addHoliday({
            date: normalizedDate,
            name: holidayForm.name,
            description: holidayForm.description,
            is_recurring: holidayForm.is_recurring,
          });
        }),
      );

      setHolidayForm({
        dates: [],
        name: "",
        description: "",
        is_recurring: false,
      });
      toast({
        title: "Holidays added",
        description: `${holidayForm.name} has been added to the calendar.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add holiday(s).",
        variant: "destructive",
      });
    }
  };

  const handleDayClick = (date: Date | undefined) => {
    if (!date) return;

    const holiday = holidays.find((h) => isSameDay(h.date, date));
    if (holiday) {
      // If clicking on a holiday, show the dialog but don't change selected date
      setSelectedHoliday(holiday);
      setIsHolidayDialogOpen(true);
      return; // Don't update selectedDate
    }

    // Interactive Weekly-off Toggling for Admins/HR
    if (
      ["admin", "hr"].includes(user?.role || "") &&
      activeTab === "calendar" &&
      weekOffForm.department
    ) {
      const dayName = format(date, "eeee").toLowerCase();
      setWeekOffForm((prev) => {
        const exists = prev.days.includes(dayName);
        const nextDays = exists
          ? prev.days.filter((d) => d !== dayName)
          : [...prev.days, dayName];

        toast({
          title: exists ? "Weekly-off removed" : "Weekly-off added",
          description: `${exists ? "Removed" : "Added"} ${format(date, "eeee")} as a weekly-off for ${prev.department}.`,
        });

        return { ...prev, days: nextDays };
      });
    }

    // Only update selected date if it's not a holiday
    setSelectedDate(date);
  };

  const handleRemoveHoliday = async (id: number) => {
    // Check if user is admin (also checked in context, but adding here for better UX)
    if (user?.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "Only administrators can remove holidays.",
        variant: "destructive",
      });
      return;
    }

    try {
      await removeHoliday(id);
      toast({
        title: "Holiday removed",
        description: "Company holiday removed from calendar.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove holiday.",
        variant: "destructive",
      });
    }
  };

  /* Updated to handle potential multiple rules per department (duplicates) */
  const [weekOffConfig, setWeekOffConfig] = useState<
    Record<string, { id: number; ids: number[]; days: string[] }>
  >({});
  const [isLoadingWeekOffs, setIsLoadingWeekOffs] = useState(true);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [weekOffForm, setWeekOffForm] = useState<{
    department: string;
    days: string[];
  }>({
    department: "",
    days: ["saturday"],
  });

  // Fetch weekoffs from API
  const fetchWeekOffs = useCallback(async () => {
    try {
      setIsLoadingWeekOffs(true);
      const response = await apiService.getWeekoffs();
      const weekOffMap: Record<
        string,
        { id: number; ids: number[]; days: string[] }
      > = {};

      response.forEach((item) => {
        if (item.is_active) {
          const dept = item.department;
          // Convert API day names (e.g., "Saturday", "Sunday") to lowercase format, stripping symbols/emojis
          const days = item.days.map((day) =>
            day.replace(/[^\p{L}]/gu, "").toLowerCase(),
          );

          if (weekOffMap[dept]) {
            // If department already exists, append ID and merge days
            weekOffMap[dept].ids.push(item.id);
            // Union of days
            const existingDays = new Set(weekOffMap[dept].days);
            days.forEach((d) => existingDays.add(d));
            weekOffMap[dept].days = Array.from(existingDays);
          } else {
            weekOffMap[dept] = {
              id: item.id, // Keep one ID as main reference
              ids: [item.id], // Store all IDs to ensure we can delete all
              days: days,
            };
          }
        }
      });
      setWeekOffConfig(weekOffMap);
    } catch (error) {
      console.error("Failed to fetch weekoffs:", error);
      toast({
        title: "Error",
        description: "Failed to load week-off configurations.",
        variant: "destructive",
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
        title: "Department required",
        description:
          "Please enter or pick a department before saving the week-off.",
        variant: "destructive",
      });
      return;
    }
    if (weekOffForm.days.length === 0) {
      toast({
        title: "Pick at least one day",
        description: "Select one or more days to mark as weekly off.",
        variant: "destructive",
      });
      return;
    }
    try {
      const uniqueDays = Array.from(new Set(weekOffForm.days));
      // Convert to capitalized format for API (e.g., "Saturday", "Sunday")
      const capitalizedDays = uniqueDays.map((day) => {
        const lowerDay = day.toLowerCase();
        return lowerDay.charAt(0).toUpperCase() + lowerDay.slice(1);
      });

      await apiService.createWeekoff({
        department: department,
        days: capitalizedDays,
      });

      // Refresh from API to get the correct IDs
      await fetchWeekOffs();

      toast({
        title: "Week-off saved",
        description: `${department} will now have days off on ${uniqueDays
          .map((day) => {
            const cleanDayKey = day.toLowerCase().replace(/[^\p{L}]/gu, "");
            return weekDayLabels[cleanDayKey] || day.replace(/[^\p{L}]/gu, "");
          })
          .join(", ")}.`,
      });
    } catch (error) {
      console.error("Failed to save weekoff:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save week-off configuration.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveWeekOff = async (department: string) => {
    const config = weekOffConfig[department];
    console.log("Attempting to remove week-off for department:", department);
    console.log("Week-off config:", config);
    console.log("All week-off configs:", weekOffConfig);

    if (!config) {
      console.error("No config found for department:", department);
      toast({
        title: "Error",
        description: `No week-off configuration found for ${department}.`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Delete all rules associated with this department (handling duplicates)
      const idsToDelete =
        config.ids && config.ids.length > 0 ? config.ids : [config.id];
      console.log("Calling API to delete week-off IDs:", idsToDelete);

      await Promise.all(idsToDelete.map((id) => apiService.deleteWeekoff(id)));

      // Remove from local state
      setWeekOffConfig((prev) => {
        const updated = { ...prev };
        delete updated[department];
        return updated;
      });

      // Refresh from API to ensure consistency
      await fetchWeekOffs();

      toast({
        title: "Week-off removed",
        description: `${department} no longer has a dedicated weekly off set.`,
      });
    } catch (error) {
      console.error("Failed to remove weekoff:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to remove week-off configuration.",
        variant: "destructive",
      });
    }
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
    { value: "sunday", label: "Sunday" },
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
  ];

  const weekDayLabels = weekDayOptions.reduce<Record<string, string>>(
    (acc, day) => {
      // Ensure labels are clean strings without symbols
      acc[day.value] = day.label.replace(/[^\p{L}]/gu, "");
      return acc;
    },
    {},
  );

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
    availableDepartments.forEach(
      (dept) =>
        dept && deptSet.add(dept.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, "")),
    );
    leaveRequests.forEach(
      (req) =>
        req.department &&
        deptSet.add(
          req.department.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ""),
        ),
    );
    approvalRequests.forEach(
      (req) =>
        req.department &&
        deptSet.add(
          req.department.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ""),
        ),
    );
    if (user?.department) {
      deptSet.add(
        user.department.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ""),
      );
    }
    Object.keys(weekOffConfig).forEach(
      (dept) =>
        dept && deptSet.add(dept.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, "")),
    );
    return Array.from(deptSet)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [
    availableDepartments,
    leaveRequests,
    approvalRequests,
    user?.department,
    weekOffConfig,
  ]);

  useEffect(() => {
    // Only auto-select department if none is selected and it's the first load
    if (
      !weekOffForm.department &&
      departmentOptions.length > 0 &&
      Array.isArray(departmentOptions)
    ) {
      // We don't force it anymore to allow users to clear selection and see 'All'
    }
  }, [departmentOptions]);

  useEffect(() => {
    if (!weekOffForm.department) {
      return;
    }
    const existing = weekOffConfig[weekOffForm.department];
    if (existing) {
      const sameLength = existing.days.length === weekOffForm.days.length;
      const sameValues =
        sameLength &&
        existing.days.every((day) => weekOffForm.days.includes(day));
      if (!sameValues) {
        setWeekOffForm((prev) => ({
          ...prev,
          days: existing.days,
        }));
      }
    } else if (weekOffForm.days.length === 0) {
      setWeekOffForm((prev) => ({ ...prev, days: ["saturday"] }));
    }
  }, [weekOffForm.department, weekOffConfig]);

  const userWeekOffDays = useMemo(() => {
    // For management profiles (Admin, HR, Manager), show all week-offs or selected department
    if (["admin", "hr", "manager"].includes(user?.role || "")) {
      if (weekOffForm.department && weekOffForm.days.length > 0) {
        return weekOffForm.days;
      }

      // If no specific department selected in form, aggregate all unique week-off days across all departments
      const allDays = new Set<string>();
      Object.values(weekOffConfig).forEach((config) => {
        config.days.forEach((d) => allDays.add(d.toLowerCase()));
      });
      return Array.from(allDays);
    }

    // For regular employees and Team Leads, show only their department's week offs (case-insensitive match)
    const userDept = user?.department?.trim().toLowerCase();
    if (!userDept) return [];

    // Find config that matches user's department (case-insensitive key search)
    const deptKey = Object.keys(weekOffConfig).find(
      (k) => k.toLowerCase() === userDept,
    );
    return deptKey ? weekOffConfig[deptKey].days : [];
  }, [
    user?.department,
    user?.role,
    weekOffConfig,
    weekOffForm.department,
    weekOffForm.days,
  ]);

  const canExport = ["admin", "hr"].includes(user?.role || "");
  // Admins should not have an option to apply for leave from the admin dashboard
  const canApply = user?.role !== "admin";

  // determine default tab based on available tabs for the current user
  const getDefaultTab = () => {
    return canApply
      ? "request"
      : canApproveLeaves || canViewTeamLeaves
        ? "approvals"
        : "calendar";
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());

  // Handle navigation from HR Dashboard or Manager Dashboard with viewMode/tab state
  useEffect(() => {
    const state = locationState.state as {
      viewMode?: string;
      tab?: string;
    } | null;
    if (state?.viewMode === "approvals" || state?.tab === "approvals") {
      setActiveTab("approvals");
    }
  }, [locationState.state]);

  // Save leave requests to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("leaveRequests", JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await apiService.getDepartmentNames();
        if (Array.isArray(response)) {
          const names = response
            .map((dept: any) => dept.name || "")
            .filter(Boolean);
          setAvailableDepartments(names);
        }
      } catch (error) {
        console.error(
          "Failed to fetch departments for week-off planner:",
          error,
        );
        // Fallback: if user has a department, at least show their own
        if (user?.department) {
          setAvailableDepartments([user.department]);
        }
      }
    };

    loadDepartments();
  }, [user?.department]);

  const loadLeaveRequests = useCallback(
    async (
      period: string = leaveHistoryPeriod,
      startDate?: Date,
      endDate?: Date,
    ) => {
      if (!user) return;
      try {
        const startStr = startDate
          ? format(startDate, "yyyy-MM-dd")
          : undefined;
        const endStr = endDate ? format(endDate, "yyyy-MM-dd") : undefined;
        const requests = await apiService.getLeaveRequests(
          period === "all" ? "" : period,
          startStr,
          endStr,
        );

        // Convert API response to our local format
        const formattedRequests: LeaveRequest[] = requests.map((req) => {
          const leaveType = (
            req.leave_type || "annual"
          ).toLowerCase() as LeaveRequest["type"];
          const status = String(
            req.status || "pending",
          ).toLowerCase() as LeaveRequest["status"];
          return {
            id: String(req.leave_id),
            employeeId: String(req.user_id),
            employeeName: user?.name || String(req.user_id),
            department: user?.department || "",
            type: leaveType,
            startDate: new Date(req.start_date),
            endDate: new Date(req.end_date),
            reason: req.reason,
            status,
            requestDate: new Date(req.start_date),
            duration_days: req.duration_days,
            leave_session: req.leave_session,
          };
        });

        setLeaveRequests(formattedRequests);
      } catch (error) {
        console.error("Error fetching leave requests:", error);
        // If API fails, keep existing data or use localStorage
      }
    },
    [user],
  );

  // Load leave allocation configuration (Admin only)
  const loadLeaveAllocationConfig = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      const config = await apiService.getCurrentLeaveAllocation();
      setLeaveAllocationConfig({
        total_annual_leave: config.total_annual_leave,
        sick_leave_allocation: config.sick_leave_allocation,
        casual_leave_allocation: config.casual_leave_allocation,
        other_leave_allocation: config.other_leave_allocation,
      });
    } catch (error) {
      console.error("Error fetching leave allocation config:", error);
    }
  }, [user]);

  // Save leave allocation configuration
  const handleSaveLeaveAllocationConfig = async () => {
    if (!user?.id) return;

    // Validation
    const sick = leaveAllocationConfig.sick_leave_allocation;
    const casual = leaveAllocationConfig.casual_leave_allocation;
    const other = leaveAllocationConfig.other_leave_allocation;
    // Enforce Total = Sick + Casual (Other leave is excluded from annual total)
    const total = sick + casual;

    if (total < 1) {
      toast({
        title: "Invalid Configuration",
        description: "Total annual leave must be at least 1 day.",
        variant: "destructive",
      });
      return;
    }

    if (sick < 0 || casual < 0 || other < 0) {
      toast({
        title: "Invalid Configuration",
        description: "Leave allocations cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingLeaveConfig(true);

    try {
      await apiService.createLeaveAllocationConfig({
        ...leaveAllocationConfig,
        total_annual_leave: total,
      });

      toast({
        title: "Configuration Saved",
        description:
          "Leave allocation has been updated successfully. All users will see the new allocations.",
      });

      // Reload leave balance to reflect new configuration
      await loadLeaveBalance();
    } catch (error) {
      console.error("Error saving leave allocation config:", error);
      toast({
        title: "Error",
        description:
          "Failed to save leave allocation configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingLeaveConfig(false);
    }
  };

  // Load leave requests from API on component mount and when period changes
  useEffect(() => {
    if (user) {
      const fetchLeaveRequests = async () => {
        if (leaveHistoryPeriod === "custom") {
          if (leaveHistoryCustomStartDate && leaveHistoryCustomEndDate) {
            await loadLeaveRequests(
              "custom",
              leaveHistoryCustomStartDate,
              leaveHistoryCustomEndDate,
            );
          }
        } else {
          await loadLeaveRequests(leaveHistoryPeriod);
        }
      };

      fetchLeaveRequests();
      fetchApprovals();
      fetchApprovalHistory();
      loadLeaveBalance();
      loadLeaveAllocationConfig();
    }
  }, [
    user,
    leaveHistoryPeriod,
    leaveHistoryCustomStartDate,
    leaveHistoryCustomEndDate,
    historyFilter,
    customHistoryStartDate,
    customHistoryEndDate,
    loadLeaveRequests,
    fetchApprovals,
    fetchApprovalHistory,
    loadLeaveBalance,
    loadLeaveAllocationConfig,
    canApproveLeaves,
    canViewTeamLeaves,
  ]);

  // Handle URL parameters for tab navigation and leave highlighting
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const leaveId = searchParams.get("leaveId");

    if (tabParam) {
      setActiveTab(tabParam);
    }

    // If leaveId is provided, highlight the specific request
    if (leaveId) {
      setTimeout(() => {
        const element = document.getElementById(`leave-request-${leaveId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("ring-2", "ring-primary", "ring-offset-2");
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
          }, 3000);
        }
      }, 300);
    }
  }, [searchParams]);
  // Tabs and permission logic consolidated below near line 1560

  const handleSubmitRequest = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User ID not found. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    const validation = validateLeaveRequest(
      formData.type,
      formData.startDate,
      formData.endDate,
      leaveBalance,
      formData.reason,
    );

    if (!validation.valid) {
      toast({
        title: "Request Invalid",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare data for API (Matches SR.NO 4)
      const unpaidSubTypeLabel =
        formData.unpaidSubType === "full_day"
          ? "Full Day"
          : formData.unpaidSubType === "half_day_before_lunch"
            ? "Half Day (Before Lunch)"
            : "Half Day (After Lunch)";

      const reasonWithSubType =
        formData.type === "unpaid"
          ? `[${unpaidSubTypeLabel}] ${formData.reason}`
          : formData.reason;

      // Map unpaidSubType to session and duration as per API spec
      let leaveSession: string | null = null;
      let durationDays = calculateLeaveDays(formData.startDate, formData.endDate);

      if (formData.type === "unpaid") {
        if (formData.unpaidSubType === "half_day_before_lunch") {
          leaveSession = "before_lunch";
          durationDays = 0.5;
        } else if (formData.unpaidSubType === "half_day_after_lunch") {
          leaveSession = "after_lunch";
          durationDays = 0.5;
        } else {
          durationDays = 1;
        }
      }

      // Note: company_slug is auto-injected into the URL path by the api.ts request() method.
      // X-Branch-Id and X-Company-Id are sent as headers automatically.
      // Only include the fields the API actually expects in the request body.
      const leaveRequestData = {
        user_id: String(user.id),
        start_date: format(formData.startDate, "yyyy-MM-dd"),
        end_date: format(formData.endDate, "yyyy-MM-dd"),
        reason: reasonWithSubType,
        leave_type: formData.type,
        duration_days: durationDays,
        leave_session: leaveSession,
      };

      // Submit to API
      const response = await apiService.submitLeaveRequest(leaveRequestData);

      // Create local leave request object for immediate UI update
      const newRequest: LeaveRequest = {
        id: String(response.leave_id),
        employeeId: user.id,
        employeeName: user.name || "",
        department: user.department || "",
        type: formData.type as LeaveRequest["type"],
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        status: "pending",
        requestDate: new Date(),
      };

      // Refresh leave history from API to get the latest data
      try {
        await loadLeaveRequests(leaveHistoryPeriod);
        await loadLeaveBalance();
      } catch (refreshError) {
        console.error("Error refreshing leave requests:", refreshError);
        // Fallback: add to local state if refresh fails
        setLeaveRequests([...leaveRequests, newRequest]);
      }

      // ✅ Trigger notification for leave application
      if (user) {
        const leaveType =
          formData.type.charAt(0).toUpperCase() + formData.type.slice(1);
        addNotification({
          title: "Leave Request Submitted",
          message: `Your ${leaveType} leave request from ${formatDateIST(formData.startDate)} to ${formatDateIST(formData.endDate)} has been submitted for approval`,
          type: "leave",
          metadata: {
            leaveId: String(response.leave_id),
            requesterId: user.id,
            requesterName: user.name,
          },
        });
      }

      toast({
        title: "Success",
        description: `Leave request submitted successfully. ${formData.type === "unpaid" ? "Unpaid leave does not deduct from your Annual Leave balance." : formData.type !== "annual" ? "This leave has been deducted from your Annual Leave balance." : ""}`,
      });

      // Reset form
      setFormData({
        type: "sick",
        startDate: new Date(),
        endDate: new Date(),
        reason: "",
        unpaidSubType: "full_day",
      });
    } catch (error) {
      console.error("Error submitting leave request:", error);
      toast({
        title: "Error",
        description: "Failed to submit leave request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveReject = async (
    id: string,
    status: "approved" | "rejected",
  ) => {
    const request =
      approvalRequests.find((req) => req.id === id) ||
      leaveRequests.find((req) => req.id === id);

    if (!request) {
      toast({
        title: "Error",
        description: "Leave request not found",
        variant: "destructive",
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
      const approved = status === "approved";
      await apiService.approveLeaveRequest(id, approved);

      // Prepare the updated request with new status and approver info
      const updatedRequest = { ...request, status, approvedBy: user?.name };

      // Remove the processed request from the pending list
      const otherRequests = approvalRequests.filter((req) => req.id !== id);
      setApprovalRequests(otherRequests);

      // Reset pagination to show the updated request at the top
      setApprovalCurrentPage(1);

      // Add the decision to approval history for real-time display
      // This ensures both approved and rejected requests appear in Recent Decisions
      setApprovalHistory((prev) => [updatedRequest, ...prev]);

      // Refresh records to ensure consistency
      try {
        await Promise.all([
          loadLeaveRequests(leaveHistoryPeriod),
          fetchApprovals(),
          fetchApprovalHistory(),
          loadLeaveBalance(),
        ]);
      } catch (refreshError) {
        console.error("Error refreshing leave requests:", refreshError);
        // Fallback: update local state if refresh fails
        setLeaveRequests(
          leaveRequests.map((req) =>
            req.id === id ? { ...req, status, approvedBy: user?.name } : req,
          ),
        );
      }

      // ✅ Trigger notification to the leave requester
      if (request.employeeId && user) {
        const statusText = status === "approved" ? "approved" : "rejected";
        const leaveType =
          request.type.charAt(0).toUpperCase() + request.type.slice(1);
        addNotification({
          title: `Leave ${status === "approved" ? "Approved" : "Rejected"}`,
          message: `Your ${leaveType} leave request from ${formatDateIST(request.startDate)} to ${formatDateIST(request.endDate)} has been ${statusText} by ${user.name}`,
          type: "leave",
          metadata: {
            leaveId: request.id,
            requesterId: user.id,
            requesterName: user.name,
          },
        });
      }

      toast({
        title: "Success",
        description: `Leave request ${status} successfully`,
      });
    } catch (error) {
      console.error("Error approving/rejecting leave request:", error);
      toast({
        title: "Error",
        description: `Failed to ${status} leave request. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setApprovingLeaveId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-white border-2 border-amber-300 dark:border-amber-600 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/50";
      case "approved":
        return "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-2 border-emerald-300 dark:border-emerald-600 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/50";
      case "rejected":
        return "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white border-2 border-rose-300 dark:border-rose-600 shadow-lg shadow-rose-200/50 dark:shadow-rose-900/50";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case "annual":
        return "bg-blue-100 text-blue-800";
      case "sick":
        return "bg-red-100 text-red-800";
      case "casual":
        return "bg-green-100 text-green-800";
      case "maternity":
        return "bg-purple-100 text-purple-800";
      case "paternity":
        return "bg-indigo-100 text-indigo-800";
      case "unpaid":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleEditLeave = (leave: LeaveRequest) => {
    setEditingLeave(leave);
    setEditFormData({
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingLeave) return;
    // Adjust balance to account for the days currently locked by this pending request
    // This allows users to reschedule leave even if they have 0 remaining balance (because this request is consuming it)
    const adjustedBalance = { ...leaveBalance };

    // Deep clone the specific balance objects we might modify to avoid mutating state
    if (editingLeave.type !== "unpaid") {
      const originalDays = calculateLeaveDays(
        editingLeave.startDate,
        editingLeave.endDate,
      );

      // Clone annual as it's always affected/checked
      adjustedBalance.annual = { ...leaveBalance.annual };
      adjustedBalance.annual.remaining += originalDays;

      // Clone and update specific type if it exists
      if (editingLeave.type === "sick") {
        adjustedBalance.sick = { ...leaveBalance.sick };
        adjustedBalance.sick.remaining += originalDays;
      } else if (editingLeave.type === "casual") {
        adjustedBalance.casual = { ...leaveBalance.casual };
        adjustedBalance.casual.remaining += originalDays;
      }
    }

    const validation = validateLeaveRequest(
      editingLeave.type,
      editFormData.startDate,
      editFormData.endDate,
      adjustedBalance,
      editFormData.reason,
    );

    if (!validation.valid) {
      toast({
        title: "Update Invalid",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingLeave(true);
    try {
      let durationDays = calculateLeaveDays(editFormData.startDate, editFormData.endDate);
      if (editingLeave.type === "unpaid" && editingLeave.leave_session) {
        durationDays = 0.5;
      }

      await apiService.updateLeaveRequest(editingLeave.id, {
        start_date: format(editFormData.startDate, "yyyy-MM-dd"),
        end_date: format(editFormData.endDate, "yyyy-MM-dd"),
        reason: editFormData.reason,
        leave_type: editingLeave.type,
        duration_days: durationDays,
        leave_session: editingLeave.leave_session,
      });
      await loadLeaveRequests(leaveHistoryPeriod);
      await loadLeaveBalance();
      toast({
        title: "Leave Updated",
        description: "Your leave request has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditingLeave(null);
    } catch (error) {
      console.error("Error updating leave request:", error);
      toast({
        title: "Error",
        description: "Failed to update leave request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingLeave(false);
    }
  };

  const handleDeleteLeave = (leave: LeaveRequest) => {
    // Ensure we have a valid leave request
    if (!leave || !leave.id) {
      toast({
        title: "Error",
        description:
          "Invalid leave request. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    // Only allow deletion of pending requests
    if (leave.status !== "pending") {
      toast({
        title: "Cannot Delete",
        description: "Only pending leave requests can be deleted.",
        variant: "destructive",
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
        title: "Leave Request Deleted",
        description: `Your leave request from ${format(leaveToDelete.startDate, "MMM dd, yyyy")} to ${format(leaveToDelete.endDate, "MMM dd, yyyy")} has been successfully deleted.`,
      });

      // Close dialog and clear state
      setIsDeleteDialogOpen(false);
      setLeaveToDelete(null);
    } catch (error) {
      console.error("Error deleting leave request:", error);

      let errorMessage = "Failed to delete leave request. Please try again.";

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes("404")) {
          errorMessage =
            "Leave request not found. It may have already been deleted.";
        } else if (error.message.includes("400")) {
          errorMessage =
            "Cannot delete this leave request. Only pending requests can be deleted.";
        } else if (error.message.includes("403")) {
          errorMessage =
            "You do not have permission to delete this leave request.";
        }
      }

      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeletingLeave(false);
    }
  };

  // Filter approval history based on date range and sort by most recent first
  // Filter approval history based on visibility rules and date range
  const getFilteredApprovalHistory = useMemo(() => {
    if (approvalHistory.length === 0) return [];

    // Helper to normalize roles for consistent comparison
    const normalize = (r: string) =>
      (r || "").toLowerCase().replace(/[\s_]+/g, "");
    const userRole = normalize(user?.role || "");
    const userDepts = (user?.department || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    // 1. Apply Visibility Rules (Admin: all, HR: manager/tl/emp, Manager: tl/emp in dept)
    const visibleHistory = approvalHistory.filter((req) => {
      if (userRole === "admin") return true;
      const role = normalize(req.role || "");

      if (userRole === "hr") {
        return ["manager", "teamlead", "team_lead", "employee"].includes(role);
      }

      if (userRole === "manager") {
        const isAllowedRole = ["teamlead", "team_lead", "employee"].includes(
          role,
        );
        const isSameDept = userDepts.includes(
          (req.department || "").trim().toLowerCase(),
        );
        return isAllowedRole && isSameDept;
      }

      return false;
    });

    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear() + 2, 11, 31, 23, 59, 59);

    const period = String(historyFilter || "").toLowerCase();

    switch (period) {
      case "all":
        startDate = new Date(0);
        break;
      case "current_month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case "last_3_months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case "last_6_months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case "last_1_year":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case "custom":
        if (customHistoryStartDate && customHistoryEndDate) {
          startDate = new Date(
            customHistoryStartDate.getFullYear(),
            customHistoryStartDate.getMonth(),
            customHistoryStartDate.getDate(),
            0,
            0,
            0,
          );
          endDate = new Date(
            customHistoryEndDate.getFullYear(),
            customHistoryEndDate.getMonth(),
            customHistoryEndDate.getDate(),
            23,
            59,
            59,
          );
        } else {
          startDate = new Date(0);
        }
        break;
      default:
        startDate = new Date(0);
        break;
    }

    let filtered = visibleHistory.filter((request) => {
      const requestDate = new Date(request.startDate);
      return requestDate >= startDate && requestDate <= endDate;
    });

    // 2. Apply Status Filter
    if (historyStatusFilter !== "all") {
      const filterStatus = String(historyStatusFilter || "").toLowerCase();
      filtered = filtered.filter((req) => {
        const reqStatus = String(req.status || "").toLowerCase();
        return reqStatus === filterStatus;
      });
    }

    // 3. Apply User Selected Role Filter
    if (historyRoleFilter !== "all") {
      const normalizeRole = (r: string) =>
        (r || "").toLowerCase().replace(/[\s_]+/g, "");
      const filterRole = normalizeRole(historyRoleFilter);
      filtered = filtered.filter(
        (req) => normalizeRole(req.role || "") === filterRole,
      );
    }

    return filtered.sort((a, b) => {
      const timeA = new Date(a.requestDate).getTime();
      const timeB = new Date(b.requestDate).getTime();
      return timeB - timeA;
    });
  }, [
    approvalHistory,
    historyFilter,
    customHistoryStartDate,
    customHistoryEndDate,
    historyStatusFilter,
    historyRoleFilter,
    user,
  ]);

  // Filter pending approval requests based on same visibility rules
  const getFilteredApprovalRequests = useMemo(() => {
    if (approvalRequests.length === 0) return [];

    // Helper to normalize roles for consistent comparison
    const normalize = (r: string) =>
      (r || "").toLowerCase().replace(/[\s_]+/g, "");
    const userRole = normalize(user?.role || "");
    const userDepts = (user?.department || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    return approvalRequests
      .filter((req) => {
        if (userRole === "admin") return true;
        const role = normalize(req.role || "");

        if (userRole === "hr") {
          return ["manager", "teamlead", "team_lead", "employee"].includes(
            role,
          );
        }

        if (userRole === "manager") {
          const isAllowedRole = ["teamlead", "team_lead", "employee"].includes(
            role,
          );
          const isSameDept = userDepts.includes(
            (req.department || "").trim().toLowerCase(),
          );
          return isAllowedRole && isSameDept;
        }

        if (userRole === "teamlead") {
          const isAllowedRole = role === "employee";
          const isSameDept = userDepts.includes(
            (req.department || "").trim().toLowerCase(),
          );
          return isAllowedRole && isSameDept;
        }

        return false;
      })
      .sort((a, b) => {
        const timeA = new Date(a.requestDate).getTime();
        const timeB = new Date(b.requestDate).getTime();
        return timeB - timeA;
      });
  }, [approvalRequests, user]);

  // Paginated and filtered approval requests
  const paginatedApprovalRequests = useMemo(() => {
    const startIndex = (approvalCurrentPage - 1) * approvalItemsPerPage;
    const endIndex = startIndex + approvalItemsPerPage;
    return getFilteredApprovalRequests.slice(startIndex, endIndex);
  }, [getFilteredApprovalRequests, approvalCurrentPage, approvalItemsPerPage]);

  // Paginated approval history
  const paginatedApprovalHistory = useMemo(() => {
    const startIndex = (historyCurrentPage - 1) * historyItemsPerPage;
    const endIndex = startIndex + historyItemsPerPage;
    return getFilteredApprovalHistory.slice(startIndex, endIndex);
  }, [getFilteredApprovalHistory, historyCurrentPage, historyItemsPerPage]);

  const approvalTotalPages = Math.ceil(
    getFilteredApprovalRequests.length / approvalItemsPerPage,
  );
  const historyTotalPages = Math.ceil(
    getFilteredApprovalHistory.length / historyItemsPerPage,
  );

  // Reset pagination when filters change
  useEffect(() => {
    setApprovalCurrentPage(1);
  }, [approvalRequests.length]);

  useEffect(() => {
    setHistoryCurrentPage(1);
  }, [
    historyFilter,
    customHistoryStartDate,
    customHistoryEndDate,
    historyStatusFilter,
    historyRoleFilter,
  ]);

  useEffect(() => {
    setMyLeaveCurrentPage(1);
  }, [
    leaveHistoryPeriod,
    leaveHistoryCustomStartDate,
    leaveHistoryCustomEndDate,
  ]);

  // Filter leave requests based on selected period (My Leave History)
  const getFilteredLeaveRequests = useMemo(() => {
    const userLeaves = leaveRequests.filter(
      (req) => String(req.employeeId) === String(user?.id),
    );
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear() + 2, 11, 31, 23, 59, 59); // default: 2 years in future

    switch (leaveHistoryPeriod) {
      case "all":
        startDate = new Date(0);
        break;
      case "current_month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case "last_3_months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case "last_6_months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1, 0, 0, 0);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case "last_1_year":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1, 0, 0, 0);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        break;
      case "custom":
        if (!leaveHistoryCustomStartDate || !leaveHistoryCustomEndDate) {
          return userLeaves.sort((a, b) => {
            const timeA = new Date(a.startDate).getTime();
            const timeB = new Date(b.startDate).getTime();
            return timeB - timeA;
          });
        }
        startDate = new Date(
          leaveHistoryCustomStartDate.getFullYear(),
          leaveHistoryCustomStartDate.getMonth(),
          leaveHistoryCustomStartDate.getDate(),
          0,
          0,
          0,
        );
        endDate = new Date(
          leaveHistoryCustomEndDate.getFullYear(),
          leaveHistoryCustomEndDate.getMonth(),
          leaveHistoryCustomEndDate.getDate(),
          23,
          59,
          59,
        );
        break;
      default:
        return userLeaves.sort((a, b) => {
          const timeA = new Date(a.startDate).getTime();
          const timeB = new Date(b.startDate).getTime();
          return timeB - timeA;
        });
    }

    const filtered = userLeaves.filter((request) => {
      const requestDate = new Date(request.startDate);
      return requestDate >= startDate && requestDate <= endDate;
    });

    return filtered.sort((a, b) => {
      const timeA = new Date(a.startDate).getTime();
      const timeB = new Date(b.startDate).getTime();
      return timeB - timeA;
    });
  }, [
    leaveRequests,
    user?.id,
    leaveHistoryPeriod,
    leaveHistoryCustomStartDate,
    leaveHistoryCustomEndDate,
  ]);

  // Calculate true totals across all leave types since annual might only represent the annual bucket
  const totalAllocated = leaveBalance.annual.allocated || 0;
  const totalUsed = leaveBalance.annual.used || 0;
  const totalRemaining = Math.max(0, totalAllocated - totalUsed);

  // Calculate total unpaid days applied (including pending) from history to ensure visibility
  const totalUnpaidApplied = useMemo(() => {
    return leaveRequests
      .filter((req) =>
        (req.type === "unpaid" || String(req.type).toLowerCase().includes("loss of pay")) &&
        (req.status === "approved" || req.status === "pending") &&
        String(req.employeeId) === String(user?.id)
      )
      .reduce((acc, req) => {
        return acc + calculateLeaveDays(new Date(req.startDate), new Date(req.endDate));
      }, 0);
  }, [leaveRequests, user?.id]);

  // Calculate total columns for tabs based on user permissions
  const colsClass = useMemo(() => {
    let count = 1; // Start with 'Leave Calendar' which is always visible
    if (canApply) count++;
    if (canApproveLeaves || canViewTeamLeaves) count++;

    switch (count) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-2";
      case 3:
        return "grid-cols-3";
      default:
        return "grid-cols-3";
    }
  }, [canApply, canApproveLeaves, canViewTeamLeaves]);

  return (
    <div className="w-full space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-xl mt-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
            <CalendarDays className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-[30px] font-black tracking-tight text-black dark:text-white" style={{}}>
              Leave Management
            </h1>
            <p className="text-[14px] text-black dark:text-white font-bold flex items-center gap-2 mt-1" style={{}}>
              <Clock className="h-4 w-4 text-indigo-500" />
              Manage leave requests and view calendar
            </p>
          </div>
        </div>

        {canExport && (
          <Button
            onClick={() => setIsExportDialogOpen(true)}
            className="relative overflow-hidden group px-6 py-6 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none uppercase tracking-wider flex items-center gap-3"
          >
            <Download className="h-5 w-5 animate-bounce group-hover:animate-none" />
            <span>Export Report</span>
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid w-full ${colsClass} h-14 bg-white dark:bg-gray-900 border-2 border-[#000000] rounded-2xl p-1 gap-1 shadow-lg`}
        >
          {canApply && (
            <TabsTrigger
              value="request"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold text-black dark:text-white data-[state=inactive]:font-bold text-[14px] transition-all duration-300 rounded-md"
              style={{}}
            >
              Apply Leave
            </TabsTrigger>
          )}
          {(canApproveLeaves || canViewTeamLeaves) && (
            <TabsTrigger
              value="approvals"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold text-black dark:text-white data-[state=inactive]:font-bold text-[14px] transition-all duration-300 rounded-md"
              style={{}}
            >
              {canApproveLeaves ? "Approvals" : "Team Leaves"}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="calendar"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold text-black dark:text-white data-[state=inactive]:font-bold text-[14px] transition-all duration-300 rounded-md"
            style={{}}
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
                  label: "Total Leaves",
                  value: `${totalRemaining}/${totalAllocated}`,
                  icon: CalendarDays,
                  iconColor: "text-blue-600",
                  iconBg: "bg-blue-50",
                },
                {
                  label: "Sick Leave",
                  value: `${leaveBalance.sick.remaining}/${leaveBalance.sick.allocated}`,
                  icon: AlertCircle,
                  iconColor: "text-rose-600",
                  iconBg: "bg-rose-50",
                },
                {
                  label: "Casual Leave",
                  value: `${leaveBalance.casual.remaining}/${leaveBalance.casual.allocated}`,
                  icon: Clock,
                  iconColor: "text-emerald-600",
                  iconBg: "bg-emerald-50",
                },
                {
                  label: "Unpaid Leave",
                  value: Math.max(leaveBalance.unpaid.used, totalUnpaidApplied),
                  icon: FileText,
                  iconColor: "text-slate-600",
                  iconBg: "bg-slate-100",
                },
              ].map((item, i) => (
                <SummaryCard
                  key={i}
                  title={item.label}
                  value={item.value}
                  icon={item.icon}
                  iconColor={item.iconColor}
                  iconBg={item.iconBg}
                />
              ))}
            </div>

            {/* Leave Request Form */}
            <Card className="border-2 border-[#000000] shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
                <CardTitle className="text-[16px] font-bold text-black dark:text-white" style={{}}>
                  Request Leave
                </CardTitle>
                <div className="mt-2 space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-[14px] text-black dark:text-white" style={{}}>
                      <strong style={{ color: '#1E40AF' }}>Note:</strong> Sick and Casual leave requests will
                      deduct from your Annual Leave balance. Only Unpaid Leave
                      does not affect your Annual Leave balance.
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-[14px] text-black dark:text-white flex items-center gap-2 mb-2" style={{}}>
                      <AlertCircle className="h-4 w-4" />
                      <strong style={{ color: '#92400E' }}>Leave Restrictions:</strong>
                    </p>
                    <div className="text-[14px] text-black dark:text-white space-y-2 pl-1 font-medium" style={{}}>
                      {/* Sick Leave Warning Removed */}
                      <div className="flex items-start gap-2">
                        <div className="h-1 w-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        <p>
                          <strong>Other Leaves:</strong> must be applied at
                          least 24 hours in advance.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>Leave Type</Label>
                    <Select
                      value={formData.type === "unpaid" ? `unpaid:${formData.unpaidSubType}` : formData.type}
                      onValueChange={(value) => {
                        if (value.startsWith("unpaid:")) {
                          const subType = value.split(":")[1] as "full_day" | "half_day_before_lunch" | "half_day_after_lunch";
                          setFormData({ ...formData, type: "unpaid", unpaidSubType: subType });
                        } else {
                          setFormData({ ...formData, type: value, unpaidSubType: "full_day" });
                        }
                      }}
                    >
                      <SelectTrigger className="text-[14px] text-black dark:text-white font-medium border-2 border-[#000000]" style={{}}>
                        <SelectValue placeholder="Select Leave Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="sick"
                          disabled={isLeaveTypeDisabled("sick", leaveBalance)}
                        >
                          Sick Leave{" "}
                          {leaveBalance.sick.remaining <= 0
                            ? "(No balance)"
                            : `(${leaveBalance.sick.remaining} days)`}
                        </SelectItem>
                        <SelectItem
                          value="casual"
                          disabled={isLeaveTypeDisabled("casual", leaveBalance)}
                        >
                          Casual Leave{" "}
                          {leaveBalance.casual.remaining <= 0
                            ? "(No balance)"
                            : `(${leaveBalance.casual.remaining} days)`}
                        </SelectItem>
                        <SelectItem value="maternity">
                          Maternity Leave
                        </SelectItem>
                        <SelectItem value="paternity">
                          Paternity Leave
                        </SelectItem>

                        <SelectGroup>
                          <SelectItem value="unpaid:full_day">
                            Unpaid Leave (Full Day)
                          </SelectItem>
                          <SelectItem value="unpaid:half_day_before_lunch">
                            Unpaid Leave (Half Day Before Lunch)
                          </SelectItem>
                          <SelectItem value="unpaid:half_day_after_lunch">
                            Unpaid Leave (Half Day After Lunch)
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>Duration</Label>
                    <div className="flex gap-2 text-[14px] text-black dark:text-white font-medium" style={{}}>
                      <div className="flex-1">
                        <DatePicker
                          date={formData.startDate}
                          onDateChange={(date) =>
                            date &&
                            setFormData({ ...formData, startDate: date })
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <DatePicker
                          date={formData.endDate}
                          onDateChange={(date) =>
                            date && setFormData({ ...formData, endDate: date })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dynamic validation feedback */}
                {(() => {
                  const leaveDays =
                    Math.ceil(
                      (formData.endDate.getTime() -
                        formData.startDate.getTime()) /
                      (1000 * 60 * 60 * 24),
                    ) + 1;
                  const now = new Date();
                  const startDate = new Date(formData.startDate);
                  const timeDifference = startDate.getTime() - now.getTime();
                  const hoursDifference = timeDifference / (1000 * 60 * 60);

                  const validationMessages: {
                    type: "error" | "success";
                    message: string;
                  }[] = [];

                  // Check advance notice requirements
                  if (formData.type === "sick") {
                    // For non-admin roles, skip the minimum 3 days requirement check entirely
                    const officeStartTime = new Date(formData.startDate);
                    officeStartTime.setHours(9, 30, 0, 0);
                    const diffToOfficeHours =
                      (officeStartTime.getTime() - now.getTime()) /
                      (1000 * 60 * 60);

                    // Admin: enforce 3-day minimum; HR/Manager/TeamLead/Employee: skip this check
                    // Sick leave warning removed
                    if (user?.role === "admin" && leaveDays < 3) {
                      // Logic kept for admin but warning removed for others
                    }
                  } else {
                    // Other leaves require 24 hours advance notice
                    if (hoursDifference < 24 && hoursDifference >= 0) {
                      const hoursRemaining = Math.ceil(24 - hoursDifference);
                      validationMessages.push({
                        type: "error",
                        message: `Leave must be applied 24 hours in advance. Please select a date at least ${hoursRemaining} hours from now.`,
                      });
                    }
                  }

                  // Show success message when valid
                  if (validationMessages.length === 0 && leaveDays > 0) {
                    if (formData.type === "sick") {
                      const officeStartTime = new Date(formData.startDate);
                      officeStartTime.setHours(9, 30, 0, 0);
                      const diffToOfficeHours =
                        (officeStartTime.getTime() - now.getTime()) /
                        (1000 * 60 * 60);
                      validationMessages.push({
                        type: "success",
                        message: `Valid sick leave request for ${leaveDays} day${leaveDays === 1 ? "" : "s"}. Applied ${diffToOfficeHours.toFixed(1)} hours before office hours.`,
                      });
                    } else if (hoursDifference >= 24) {
                      validationMessages.push({
                        type: "success",
                        message: `Valid leave request with ${Math.floor(hoursDifference)} hours advance notice.`,
                      });
                    }
                  }

                  return validationMessages.length > 0 ? (
                    <div className="space-y-2">
                      {validationMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border-2 border-[#000000] text-sm flex items-center gap-2 ${msg.type === "error"
                            ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                            : "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                            }`}
                        >
                          {msg.type === "error" ? (
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="h-4 w-4 flex-shrink-0" />
                          )}
                          {msg.message}
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>Reason *</Label>
                  <Textarea
                    maxLength={200}
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reason: e.target.value.replace(
                          /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                          "",
                        ),
                      })
                    }
                    placeholder="Please provide a reason for your leave request (minimum 10 characters)."
                    rows={3}
                    className={cn(
                      "text-[14px] text-black dark:text-white font-medium border-2 border-[#000000]",
                      formData.reason.trim().length > 0 &&
                        formData.reason.trim().length < 10
                        ? "border-red-500"
                        : ""
                    )}
                    style={{}}
                  />
                  <div className="flex justify-between text-sm">
                    <span
                      className={`text-[12px] font-bold ${formData.reason.trim().length < 10 ? "text-[#EF4444]" : "text-[#16A34A]"}`}
                      style={{}}
                    >
                      {formData.reason.trim().length < 10
                        ? `${formData.reason.trim().length}/10 characters (minimum required)`
                        : `${formData.reason.trim().length}/200 characters`}
                    </span>
                    {formData.reason.trim().length < 10 &&
                      formData.reason.trim().length > 0 && (
                        <span className="text-red-500 text-xs">
                          Minimum 10 characters required
                        </span>
                      )}
                  </div>
                </div>
                <Button
                  onClick={handleSubmitRequest}
                  disabled={isSubmitting || formData.reason.trim().length < 10}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md disabled:opacity-50 text-[14px]"
                  style={{}}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </CardContent>
            </Card>

            {/* My Leave History - Premium UI */}
            <Card className="border-2 border-[#000000] shadow-xl rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <CalendarDays className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-[16px] font-black text-black dark:text-white" style={{}}>
                        My Leave History
                      </CardTitle>
                      <p className="text-[14px] text-black dark:text-white font-bold mt-1" style={{}}>
                        Track all your leave requests and their status
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={leaveHistoryPeriod}
                      onValueChange={(value) => setLeaveHistoryPeriod(value)}
                    >
                      <SelectTrigger className="w-[180px] bg-white dark:bg-slate-800 border-2 border-[#000000] shadow-md hover:shadow-lg transition-all text-[14px] text-black dark:text-white font-bold" style={{}}>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All History</SelectItem>
                        <SelectItem value="current_month">Current Month</SelectItem>
                        <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                        <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                        <SelectItem value="last_1_year">Last 1 Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                    {leaveHistoryPeriod === "custom" && (
                      <>
                        <Input
                          type="date"
                          placeholder="From date"
                          value={
                            leaveHistoryCustomStartDate
                              ? format(leaveHistoryCustomStartDate, "yyyy-MM-dd")
                              : ""
                          }
                          onChange={(e) => {
                            if (e.target.value) {
                              const [y, m, d] = e.target.value.split("-").map(Number);
                              setLeaveHistoryCustomStartDate(new Date(y, m - 1, d));
                            } else {
                              setLeaveHistoryCustomStartDate(undefined);
                            }
                          }}
                          className="h-10 w-[160px] border-2 border-[#000000] focus:ring-2 focus:ring-violet-500 transition-all text-[13px] font-bold text-black dark:text-white"
                        />
                        <Input
                          type="date"
                          placeholder="To date"
                          value={
                            leaveHistoryCustomEndDate
                              ? format(leaveHistoryCustomEndDate, "yyyy-MM-dd")
                              : ""
                          }
                          onChange={(e) => {
                            if (e.target.value) {
                              const [y, m, d] = e.target.value.split("-").map(Number);
                              setLeaveHistoryCustomEndDate(new Date(y, m - 1, d));
                            } else {
                              setLeaveHistoryCustomEndDate(undefined);
                            }
                          }}
                          min={
                            leaveHistoryCustomStartDate
                              ? format(leaveHistoryCustomStartDate, "yyyy-MM-dd")
                              : undefined
                          }
                          className="h-10 w-[160px] border-2 border-[#000000] focus:ring-2 focus:ring-violet-500 transition-all text-[13px] font-bold text-black dark:text-white"
                        />
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {getFilteredLeaveRequests.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="h-12 w-12 text-indigo-500 dark:text-indigo-400 opacity-50" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      No Leave History
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      No leave requests found for the selected period.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getFilteredLeaveRequests
                      .slice(
                        (myLeaveCurrentPage - 1) * myLeaveItemsPerPage,
                        myLeaveCurrentPage * myLeaveItemsPerPage,
                      )
                      .map((request) => {
                        const daysCount =
                          Math.ceil(
                            (request.endDate.getTime() -
                              request.startDate.getTime()) /
                            (1000 * 60 * 60 * 24),
                          ) + 1;
                        const statusConfig = {
                          pending: {
                            bg: "bg-amber-50 dark:bg-amber-950",
                            border: "border-amber-200 dark:border-amber-800",
                            icon: Clock,
                            iconColor: "text-amber-600 dark:text-amber-400",
                          },
                          approved: {
                            bg: "bg-emerald-50 dark:bg-emerald-950",
                            border:
                              "border-emerald-200 dark:border-emerald-800",
                            icon: CheckCircle,
                            iconColor: "text-emerald-600 dark:text-emerald-400",
                          },
                          rejected: {
                            bg: "bg-red-50 dark:bg-red-950",
                            border: "border-red-200 dark:border-red-800",
                            icon: XCircle,
                            iconColor: "text-red-600 dark:text-red-400",
                          },
                        };
                        const config =
                          statusConfig[request.status] || statusConfig.pending;
                        const StatusIcon = config.icon;

                        return (
                          <div
                            key={request.id}
                            className={`flex items-start justify-between gap-4 rounded-xl border-2 border-[#000000] bg-white dark:bg-slate-900 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div
                                className={`mt-1 h-9 w-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}
                              >
                                <StatusIcon
                                  className={`h-4 w-4 ${config.iconColor}`}
                                />
                              </div>
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {format(request.startDate, "dd MMM yyyy")}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    to
                                  </span>
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {format(request.endDate, "dd MMM yyyy")}
                                  </span>
                                  <Badge
                                    className={`${getLeaveTypeColor(request.type)} text-[10px] font-semibold capitalize`}
                                  >
                                    {request.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Timer className="h-3 w-3" />
                                    {daysCount}{" "}
                                    {daysCount === 1 ? "day" : "days"}
                                  </span>
                                </div>
                                <p className="text-[12px] font-bold text-black dark:text-white flex items-start gap-2" style={{}}>
                                  <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="line-clamp-2 break-words overflow-wrap-anywhere whitespace-pre-wrap">
                                    {request.reason}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-row items-center gap-1.5 flex-shrink-0">
                              {request.status === "pending" && (
                                <>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleEditLeave(request)}
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteLeave(request);
                                    }}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                              <div className="flex flex-col items-end gap-0.5">
                                <Badge
                                  className={`min-w-[82px] justify-center px-3 py-1 text-[12px] font-bold capitalize ${getStatusBadgeStyle(request.status)}`}
                                  style={{}}
                                >
                                  {request.status}
                                </Badge>
                                {request.approvedBy && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>by {request.approvedBy}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {getFilteredLeaveRequests.length > 0 && (
                      <div className="mt-6 px-2">
                        <Pagination
                          currentPage={myLeaveCurrentPage}
                          totalPages={Math.ceil(
                            getFilteredLeaveRequests.length /
                            myLeaveItemsPerPage,
                          )}
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
          <Card className="border-2 border-[#000000] shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <CardTitle className="text-[16px] font-black text-black dark:text-white" style={{}}>
                Leave Calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Admin holiday management UI */}
              {user?.role === "admin" && (
                <div className="mb-6 space-y-6 mt-4">
                  {/* Leave Allocation Configuration Panel */}
                  <div className="p-6 border-2 border-[#000000] rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950 dark:via-indigo-950 dark:to-blue-950 shadow-lg">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-[16px] font-black text-black dark:text-white mb-1 flex items-center gap-2" style={{}}>
                          <FileText className="h-6 w-6 text-purple-600" />
                          Leave Allocation Configuration
                        </h3>
                        <p className="text-[14px] text-black dark:text-white font-medium" style={{}}>
                          Set the total annual leave and distribute it across
                          different leave types. Changes apply to all users
                          immediately.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
                      <div className="space-y-2">
                        <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>
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
                        <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>
                          Sick Leave
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="365"
                          value={leaveAllocationConfig.sick_leave_allocation === 0 ? "" : leaveAllocationConfig.sick_leave_allocation}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
                            setLeaveAllocationConfig((prev) => ({
                              ...prev,
                              sick_leave_allocation: val,
                              total_annual_leave:
                                val + prev.casual_leave_allocation,
                            }));
                          }}
                          className="border-2 border-[#000000] focus:border-red-500"
                          placeholder="e.g., 10"
                        />
                        <p className="text-xs text-muted-foreground">
                          Days allocated
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>
                          Casual Leave
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="365"
                          value={leaveAllocationConfig.casual_leave_allocation === 0 ? "" : leaveAllocationConfig.casual_leave_allocation}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
                            setLeaveAllocationConfig((prev) => ({
                              ...prev,
                              casual_leave_allocation: val,
                              total_annual_leave:
                                prev.sick_leave_allocation + val,
                            }));
                          }}
                          className="border-2 border-[#000000] focus:border-green-500"
                          placeholder="e.g., 5"
                        />
                        <p className="text-xs text-muted-foreground">
                          Days allocated
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>
                          Other Leave
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="365"
                          value={leaveAllocationConfig.other_leave_allocation === 0 ? "" : leaveAllocationConfig.other_leave_allocation}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
                            setLeaveAllocationConfig((prev) => ({
                              ...prev,
                              other_leave_allocation: val,
                              total_annual_leave:
                                prev.sick_leave_allocation +
                                prev.casual_leave_allocation,
                            }));
                          }}
                          className="border-2 border-[#000000] focus:border-gray-500"
                          placeholder="e.g., 0"
                        />
                        <p className="text-xs text-muted-foreground">
                          Days allocated
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-[14px] text-black dark:text-white font-medium" style={{}}>
                        <span className="text-[#1E40AF] font-black">Note:</span> Sick and Casual leave requests will deduct from
                        the Total Annual Leave balance. The individual
                        allocations (Sick and Casual) are for reference and
                        tracking purposes.
                      </p>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                      <Button
                        onClick={handleSaveLeaveAllocationConfig}
                        disabled={isSavingLeaveConfig}
                        className="gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-lg"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {isSavingLeaveConfig
                          ? "Saving..."
                          : "Save Configuration"}
                      </Button>
                      <p className="text-[14px] text-black dark:text-white font-bold" style={{}}>
                        Changes will apply to all users immediately
                      </p>
                    </div>
                  </div>

                  {user?.role === "admin" && (
                    <div className="p-6 border-2 border-[#000000] rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 shadow-md">
                      <h3 className="text-[16px] font-black text-black dark:text-white mb-3 flex items-center gap-2" style={{}}>
                        Set Company Holidays
                      </h3>
                      <div className="space-y-3">
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                          <div className="flex-shrink-0 mx-auto md:mx-0">
                            <HolidayCalendar
                              mode="multiple"
                              date={holidayForm.dates}
                              onDateChange={(dates) =>
                                setHolidayForm({
                                  ...holidayForm,
                                  dates: dates || [],
                                })
                              }
                              className="w-[280px]"
                            />
                          </div>
                          <div className="flex-1 space-y-4 w-full">
                            <div className="space-y-2">
                              <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>Holiday Name</Label>
                              <Input
                                type="text"
                                placeholder="e.g., Diwali, New Year"
                                value={holidayForm.name}
                                onChange={(e) =>
                                  setHolidayForm({
                                    ...holidayForm,
                                    name: e.target.value.replace(
                                      /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                                      "",
                                    ),
                                  })
                                }
                                className="bg-white dark:bg-slate-900 border-2 border-[#000000]"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>Description</Label>
                              <Textarea
                                placeholder="Description (optional) - e.g., Festival of Lights celebration"
                                value={holidayForm.description || ""}
                                onChange={(e) =>
                                  setHolidayForm({
                                    ...holidayForm,
                                    description: e.target.value.replace(
                                      /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                                      "",
                                    ),
                                  })
                                }
                                rows={3}
                                className="resize-none bg-white dark:bg-slate-900 border-2 border-[#000000]"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>Recurring</Label>
                              <Select
                                value={holidayForm.is_recurring ? "yes" : "no"}
                                onValueChange={(value) =>
                                  setHolidayForm({
                                    ...holidayForm,
                                    is_recurring: value === "yes",
                                  })
                                }
                              >
                                <SelectTrigger className="bg-white dark:bg-slate-900 border-2 border-[#000000]">
                                  <SelectValue placeholder="Is Recurring?" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              onClick={handleAddHoliday}
                              className="w-full gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-md"
                            >
                              Add Holiday
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <h4 className="text-[16px] font-black text-black dark:text-white mb-2" style={{}}>Current Holidays:</h4>
                        {holidays.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No holidays configured yet.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {holidays.map((h) => (
                              <li
                                key={h.id || h.date.toISOString()}
                                className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-800 rounded border-2 border-[#000000]"
                              >
                                <span className="flex-1 text-[14px] text-black dark:text-white font-bold" style={{}}>
                                  {h.name} -{" "}
                                  <span className="font-medium">{format(h.date, "MMMM dd, yyyy")}</span>
                                  {h.description && (
                                    <span className="text-[14px] text-black dark:text-white font-medium ml-2">
                                      ({h.description})
                                    </span>
                                  )}
                                  {h.is_recurring && (
                                    <Badge
                                      variant="secondary"
                                      className="ml-2 text-[12px] text-black dark:text-white font-medium bg-slate-100 dark:bg-slate-700"
                                      style={{}}
                                    >
                                      Recurring
                                    </Badge>
                                  )}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                  onClick={() =>
                                    h.id && handleRemoveHoliday(h.id)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-6 border-2 border-[#000000] rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950 shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[16px] font-black text-black dark:text-white mb-1 flex items-center gap-2" style={{}}>
                          Department Week-off Planner
                        </h3>
                        <p className="text-[14px] text-black dark:text-white font-medium" style={{}}>
                          Define weekly off days for each department to keep
                          schedules aligned.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>Department</Label>
                        {departmentOptions.length > 0 ? (
                          <Select
                            value={weekOffForm.department}
                            onValueChange={(value) =>
                              setWeekOffForm((prev) => ({
                                ...prev,
                                department: value,
                              }))
                            }
                          >
                            <SelectTrigger className="border-2 border-[#000000]">
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
                              setWeekOffForm((prev) => ({
                                ...prev,
                                department: e.target.value.replace(
                                  /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                                  "",
                                ),
                              }))
                            }
                          />
                        )}
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[14px] font-bold text-black dark:text-white" style={{}}>Weekly Off Days</Label>
                        <div className="flex flex-wrap gap-2">
                          {weekDayOptions.map((day) => {
                            const isSelected = weekOffForm.days.includes(
                              day.value,
                            );
                            return (
                              <button
                                key={day.value}
                                type="button"
                                onClick={() =>
                                  setWeekOffForm((prev) => {
                                    const exists = prev.days.includes(
                                      day.value,
                                    );
                                    const isAdminOrHR = [
                                      "admin",
                                      "hr",
                                    ].includes(user?.role || "");
                                    const limit = isAdminOrHR ? 7 : 2;

                                    const nextDays = exists
                                      ? prev.days.filter((d) => d !== day.value)
                                      : prev.days.length >= limit
                                        ? prev.days
                                        : [...prev.days, day.value];

                                    if (!exists && prev.days.length >= limit) {
                                      toast({
                                        title: "Limit reached",
                                        description: isAdminOrHR
                                          ? "You can select up to 7 weekly off days."
                                          : "You can only select up to two weekly off days.",
                                      });
                                    }
                                    return { ...prev, days: nextDays };
                                  })
                                }
                                className={`rounded-full px-3 py-1 text-[14px] font-bold border transition ${isSelected
                                  ? "border-[#0284C7] bg-white text-[#0284C7] shadow-sm"
                                  : "border-slate-300 text-black dark:text-white hover:bg-white"
                                  }`}
                                style={{}}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[12px] text-black dark:text-white font-medium" style={{}}>
                          Tip: Select up to two days if the department enjoys a
                          long weekend.
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
                      <h4 className="text-[16px] font-black text-black dark:text-white mb-2" style={{}}>
                        Active Week-off Rules
                      </h4>
                      {Object.keys(weekOffConfig).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No department-specific week-offs defined yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(weekOffConfig).map(
                            ([dept, config]) => (
                              <div
                                key={dept}
                                className="flex items-center justify-between rounded-lg border-2 border-[#000000] bg-white/70 dark:bg-slate-950/60 px-3 py-2 text-sm"
                              >
                                <div>
                                  <p className="text-[14px] font-black text-black dark:text-white" style={{}}>
                                    {dept}
                                  </p>
                                  <p className="text-[12px] text-black dark:text-white font-medium" style={{}}>
                                    Weekly off:{" "}
                                    {config.days
                                      .map((day) => {
                                        const cleanDay = day
                                          .replace(/[^\p{L}]/gu, "")
                                          .toLowerCase();
                                        return (
                                          weekDayLabels[cleanDay] ||
                                          day.replace(/[^\p{L}]/gu, "")
                                        );
                                      })
                                      .join(", ")}
                                  </p>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                  onClick={() => handleRemoveWeekOff(dept)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Calendar with holidays highlighted */}
              <div className="xl:col-span-12 space-y-6">
                <div className="relative group p-0 rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#000000] shadow-2xl shadow-indigo-100 dark:shadow-none transition-all duration-300">
                  <div className="relative">
                    <CalendarWithSelect
                      key={`calendar-${holidays.length}-${Object.keys(weekOffConfig).length}`}
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDayClick}
                      currentMonth={displayedMonth}
                      onMonthChange={setDisplayedMonth}
                      className="rounded-2xl bg-transparent w-full"
                      classNames={{
                        months: "w-full",
                        month: "w-full space-y-4",
                        table: "w-full",
                        head_row: "flex w-full",
                        head_cell: "flex-1 h-12 text-base font-black border-b-2 border-black/5",
                        row: "flex w-full",
                        cell: "flex-1 h-24 md:h-32 border-b border-r border-black/5 relative p-0",
                        day: "h-full w-full rounded-none flex flex-col items-end p-2 text-lg font-black hover:bg-slate-50 transition-all",
                      }}
                      modifiers={{
                        holiday: holidays.flatMap((h) => {
                          const dates: Date[] = [h.date];
                          if (h.is_recurring) {
                            // Add occurrence in the currently displayed year
                            const displayedYear = displayedMonth.getFullYear();
                            const recurringDate = new Date(displayedYear, h.date.getMonth(), h.date.getDate());
                            // Also add current calendar year if different
                            const currentYear = new Date().getFullYear();
                            if (displayedYear !== h.date.getFullYear()) {
                              dates.push(recurringDate);
                            }
                            if (currentYear !== h.date.getFullYear() && currentYear !== displayedYear) {
                              dates.push(new Date(currentYear, h.date.getMonth(), h.date.getDate()));
                            }
                          }
                          return dates;
                        }),
                        weekOff: (date) =>
                          userWeekOffDays.some(
                            (day) =>
                              weekDayIndexMap[day.toLowerCase()] ===
                              date.getDay(),
                          ),
                        leave: leaveRequests
                          .filter((r) => r.status === "approved")
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
                          "bg-gradient-to-br from-rose-50 to-red-50 text-rose-600 border-l-4 border-l-rose-500",
                        weekOff:
                          "bg-slate-50/50 text-slate-400 border-l-4 border-l-slate-300",
                        leave:
                          "bg-indigo-50 text-indigo-600 border-l-4 border-l-indigo-500",
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Legend */}
                  <div className="md:col-span-4">
                    <Card className="rounded-2xl border-2 border-[#000000] shadow-xl bg-white dark:bg-slate-900 overflow-hidden h-full">
                      <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30">
                        <CardTitle className="text-[16px] font-black text-black dark:text-white flex items-center gap-2 uppercase tracking-widest" style={{}}>
                          <AlertCircle className="h-4 w-4 text-black dark:text-white" />
                          Color Guide
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-4 rounded bg-rose-500 shadow-sm" />
                          <span className="text-[14px] text-black dark:text-white font-black uppercase tracking-wider" style={{}}>
                            Company Holidays
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-4 rounded border-2 border-dashed border-black dark:border-white bg-slate-100" />
                          <span className="text-[14px] text-black dark:text-white font-black uppercase tracking-wider" style={{}}>
                            Weekly-Off Days
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-4 rounded bg-indigo-500" />
                          <span className="text-[14px] text-black dark:text-white font-black uppercase tracking-wider" style={{}}>
                            Your Approved Leaves
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Holiday List */}
                  <div className="md:col-span-8">
                    <Card className="rounded-2xl border-2 border-[#000000] shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                      <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-[16px] font-black text-black dark:text-white flex items-center gap-2" style={{}}>
                            <CalendarIcon className="h-5 w-5 text-red-500" />
                            Upcoming Festivals & Holidays
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {(() => {
                          // Expand recurring holidays to the currently displayed year before filtering
                          const displayedYear = displayedMonth.getFullYear();
                          const expandedHolidays = holidays.map((h) => {
                            if (
                              h.is_recurring &&
                              h.date.getFullYear() !== displayedYear
                            ) {
                              return {
                                ...h,
                                date: new Date(displayedYear, h.date.getMonth(), h.date.getDate()),
                              };
                            }
                            return h;
                          });

                          const monthHolidays = expandedHolidays
                            .filter(
                              (h) =>
                                h.date.getMonth() === displayedMonth.getMonth() &&
                                h.date.getFullYear() === displayedYear,
                            )
                            .sort((a, b) => a.date.getTime() - b.date.getTime());

                          if (monthHolidays.length === 0) {
                            return (
                              <div className="flex flex-col items-center justify-center py-6 text-center">
                                <p className="text-[14px] text-black dark:text-white font-medium" style={{}}>
                                  No company holidays scheduled for this month
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {monthHolidays.map((h) => (
                                <div
                                  key={h.date.toISOString()}
                                  className="group flex items-center gap-4 p-3 rounded-xl border-2 border-[#000000] bg-white dark:bg-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
                                  onClick={() => {
                                    setSelectedHoliday(h);
                                    setIsHolidayDialogOpen(true);
                                  }}
                                >
                                  <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-slate-50 border-2 border-[#000000]">
                                    <span className="text-[10px] font-bold uppercase">{format(h.date, "MMM")}</span>
                                    <span className="text-[18px] font-black leading-none">{format(h.date, "dd")}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-[14px] font-black truncate">{h.name}</h4>
                                    <p className="text-[12px] opacity-70">{format(h.date, "EEEE")}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {(canApproveLeaves || canViewTeamLeaves) && (
          <TabsContent value="approvals">
            <Card className="border-2 border-[#000000] shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
                <CardTitle className="text-[16px] font-bold text-black dark:text-white" style={{}}>
                  {canApproveLeaves
                    ? "Leave Approval Requests"
                    : "Team Leave Requests"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {approvalRequests.length === 0 ? (
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
                          className="border-2 border-[#000000] rounded-lg p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-900 hover:shadow-md"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                            <div className="space-y-3 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <User className="h-4 w-4 flex-shrink-0" />
                                <span className="text-[14px] font-black text-black dark:text-white" style={{}}>
                                  {request.employeeName}
                                </span>
                                {request.role && (
                                  <Badge
                                    variant="outline"
                                    className="text-[12px] uppercase font-bold text-black dark:text-white border-black/10"
                                    style={{}}
                                  >
                                    {request.role}
                                  </Badge>
                                )}
                                <Badge
                                  className={cn(getLeaveTypeColor(request.type), "text-[12px] font-bold bg-transparent border-0 p-0 text-black dark:text-white shadow-none")}
                                  style={{}}
                                >
                                  {request.type}
                                </Badge>
                                <span className="text-[12px] text-black dark:text-white font-bold" style={{}}>
                                  ID: {request.employeeId}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-[12px] text-black dark:text-white font-bold flex-wrap" style={{}}>
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  <span>{request.department}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  <span>
                                    {format(request.startDate, "MMM dd")} -{" "}
                                    {format(request.endDate, "MMM dd, yyyy")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {Math.ceil(
                                      (request.endDate.getTime() -
                                        request.startDate.getTime()) /
                                      (1000 * 60 * 60 * 24),
                                    ) + 1}{" "}
                                    days
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm">
                                <div className="flex items-start gap-2">
                                  <span className="text-[14px] font-bold text-black dark:text-white whitespace-nowrap" style={{}}>Reason:</span>
                                  <div className="text-black dark:text-white text-[12px] font-bold line-clamp-2" style={{}}>
                                    <TruncatedText
                                      text={request.reason}
                                      maxLength={200}
                                      textClassName="whitespace-pre-wrap break-words"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {request.status === "pending" &&
                                canApproveLeaves ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="w-28 px-4 h-9 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-[12px]"
                                    style={{}}
                                    onClick={() =>
                                      handleApproveReject(
                                        request.id,
                                        "approved",
                                      )
                                    }
                                    disabled={approvingLeaveId === request.id}
                                  >
                                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                                    <span className="whitespace-nowrap">
                                      {approvingLeaveId === request.id
                                        ? "Processing..."
                                        : "Approve"}
                                    </span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="w-28 px-4 h-9 gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-[12px]"
                                    style={{}}
                                    onClick={() =>
                                      handleApproveReject(
                                        request.id,
                                        "rejected",
                                      )
                                    }
                                    disabled={approvingLeaveId === request.id}
                                  >
                                    <XCircle className="h-4 w-4 flex-shrink-0" />
                                    <span className="whitespace-nowrap">
                                      {approvingLeaveId === request.id
                                        ? "Processing..."
                                        : "Reject"}
                                    </span>
                                  </Button>
                                </>
                              ) : (
                                <div className="flex flex-col gap-2 w-full">
                                  <Badge
                                    className={`w-full px-4 py-1.5 text-[12px] font-bold capitalize transition-all duration-300 text-center ${getStatusBadgeStyle(request.status)}`}
                                    style={{}}
                                  >
                                    {request.status.charAt(0).toUpperCase() +
                                      request.status.slice(1)}
                                  </Badge>
                                  {request.status !== "pending" &&
                                    request.approvedBy && (
                                      <span className="text-[12px] text-black dark:text-white font-bold text-center" style={{}}>
                                        by {request.approvedBy}
                                      </span>
                                    )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

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
                    <h3 className="text-[16px] font-black text-black dark:text-white mb-3" style={{}}>Recent Decisions</h3>
                    {/* Filters row with labels below heading */}
                    <div className="flex flex-wrap items-end gap-3 mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Duration</span>
                        <div className="flex items-center gap-2">
                          <Select
                            value={historyFilter}
                            onValueChange={setHistoryFilter}
                          >
                            <SelectTrigger className="w-[160px] h-9 bg-white dark:bg-gray-950 text-[14px] text-black dark:text-white font-bold border-2 border-[#000000]" style={{}}>
                              <SelectValue placeholder="Select period" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All History</SelectItem>
                              <SelectItem value="current_month">Current Month</SelectItem>
                              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                              <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                              <SelectItem value="last_1_year">Last 1 Year</SelectItem>
                              <SelectItem value="custom">Custom Range</SelectItem>
                            </SelectContent>
                          </Select>
                          {historyFilter === "custom" && (
                            <>
                              <Input
                                type="date"
                                placeholder="Start date"
                                value={customHistoryStartDate ? format(customHistoryStartDate, "yyyy-MM-dd") : ""}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const [y, m, d] = e.target.value.split("-").map(Number);
                                    setCustomHistoryStartDate(new Date(y, m - 1, d));
                                  } else {
                                    setCustomHistoryStartDate(undefined);
                                  }
                                }}
                                className="h-9 w-[150px] border-2 border-[#000000] text-[13px] font-bold text-black dark:text-white"
                              />
                              <Input
                                type="date"
                                placeholder="End date"
                                value={customHistoryEndDate ? format(customHistoryEndDate, "yyyy-MM-dd") : ""}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const [y, m, d] = e.target.value.split("-").map(Number);
                                    setCustomHistoryEndDate(new Date(y, m - 1, d));
                                  } else {
                                    setCustomHistoryEndDate(undefined);
                                  }
                                }}
                                min={customHistoryStartDate ? format(customHistoryStartDate, "yyyy-MM-dd") : undefined}
                                className="h-9 w-[150px] border-2 border-[#000000] text-[13px] font-bold text-black dark:text-white"
                              />
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
                        <Select
                          value={historyStatusFilter}
                          onValueChange={(val: any) => setHistoryStatusFilter(val)}
                        >
                          <SelectTrigger className="w-[130px] h-9 bg-white dark:bg-gray-950 text-[14px] text-black dark:text-white font-bold border-2 border-[#000000]" style={{}}>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role</span>
                        <Select
                          value={historyRoleFilter}
                          onValueChange={(val: any) => setHistoryRoleFilter(val)}
                        >
                          <SelectTrigger className="w-[130px] h-9 bg-white dark:bg-gray-950 text-[14px] text-black dark:text-white font-bold border-2 border-[#000000]" style={{}}>
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {user?.role === "admin" && (
                              <SelectItem value="hr">HR</SelectItem>
                            )}
                            {(user?.role === "admin" || user?.role === "hr") && (
                              <SelectItem value="manager">Manager</SelectItem>
                            )}
                            {(user?.role === "admin" || user?.role === "hr" || user?.role === "manager") && (
                              <SelectItem value="team_lead">Team Lead</SelectItem>
                            )}
                            {(user?.role === "admin" || user?.role === "hr" || user?.role === "manager") && (
                              <SelectItem value="employee">Employee</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {getFilteredApprovalHistory.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          No decisions found for the selected period.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="space-y-3">
                          {paginatedApprovalHistory.map((request, idx) => (
                            <div
                              key={`hist-${request.isWFH ? "wfh" : "leave"}-${request.id}-${idx}`}
                              className="border-2 border-[#000000] rounded-lg p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                            >
                              <div className="text-sm flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[14px] font-black text-black dark:text-white" style={{}}>
                                    {request.employeeName}
                                  </span>
                                  {request.role && (
                                    <span className="text-[12px] uppercase font-bold text-black dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded" style={{}}>
                                      {request.role}
                                    </span>
                                  )}
                                  <Badge
                                    className={cn(getLeaveTypeColor(request.type), "text-[12px] font-bold bg-transparent border-0 p-0 text-black dark:text-white shadow-none")}
                                    style={{}}
                                  >
                                    {request.type}
                                  </Badge>
                                </div>
                                <div className="text-black dark:text-white text-[12px] font-bold" style={{}}>
                                  {format(request.startDate, "MMM dd")} -{" "}
                                  {format(request.endDate, "MMM dd, yyyy")} •{" "}
                                  {request.department}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={`px-4 py-1.5 text-[12px] font-bold capitalize transition-all duration-300 flex items-center gap-2 ${getStatusBadgeStyle(request.status)}`}
                                  style={{}}
                                >
                                  {request.status === "approved" ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                  {request.status.charAt(0).toUpperCase() +
                                    request.status.slice(1)}
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

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-2xl border-2 border-black rounded-3xl p-0 overflow-hidden bg-white dark:bg-gray-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <DialogHeader className="p-6 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-b-2 border-black">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <Download className="h-7 w-7 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">Export Leave Report</DialogTitle>
                <DialogDescription className="text-sm font-bold text-slate-600 dark:text-slate-400 mt-1 uppercase tracking-wider">Configure and Generate Leave Data Report</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-black text-black dark:text-white uppercase tracking-wider">Start Date</Label>
                <Input
                  type="date"
                  value={leaveStartDate}
                  onChange={(e) => setLeaveStartDate(e.target.value)}
                  className="h-12 bg-white dark:bg-slate-950 text-sm text-black dark:text-white font-bold border-2 border-black focus:ring-0 focus:border-orange-500 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-black text-black dark:text-white uppercase tracking-wider">End Date</Label>
                <Input
                  type="date"
                  value={leaveEndDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                  className="h-12 bg-white dark:bg-slate-950 text-sm text-black dark:text-white font-bold border-2 border-black focus:ring-0 focus:border-orange-500 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-black text-black dark:text-white uppercase tracking-wider">Department</Label>
                <Select
                  value={leaveDepartment}
                  onValueChange={setLeaveDepartment}
                >
                  <SelectTrigger className="h-12 bg-white dark:bg-slate-950 text-sm text-black dark:text-white font-bold border-2 border-black focus:ring-0 focus:border-orange-500 rounded-xl">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent className="border-2 border-black">
                    <SelectItem value="all">All Departments</SelectItem>
                    {availableDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-black text-black dark:text-white uppercase tracking-wider">Format</Label>
                <Select
                  value={leaveFormat}
                  onValueChange={(val: "pdf" | "csv") => setLeaveFormat(val)}
                >
                  <SelectTrigger className="h-12 bg-white dark:bg-slate-950 text-sm text-black dark:text-white font-bold border-2 border-black focus:ring-0 focus:border-orange-500 rounded-xl">
                    <SelectValue placeholder="PDF" />
                  </SelectTrigger>
                  <SelectContent className="border-2 border-black">
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t-2 border-black flex sm:justify-between items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setIsExportDialogOpen(false)}
              className="flex-1 h-12 border-2 border-black font-black uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              Cancel
            </Button>
            <Button
              disabled={isExportLoading}
              onClick={async () => {
                try {
                  setIsExportLoading(true);
                  const blob = await apiService.exportLeaveReport({
                    format: leaveFormat,
                    start_date: leaveStartDate,
                    end_date: leaveEndDate,
                    department: leaveDepartment === "all" ? undefined : leaveDepartment,
                  });

                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `leave_report_${leaveStartDate}_to_${leaveEndDate}.${leaveFormat}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);

                  toast({
                    title: "Report Generated",
                    description: "The leave report has been downloaded successfully.",
                  });
                  setIsExportDialogOpen(false);
                } catch (error) {
                  console.error("Export Error:", error);
                  toast({
                    title: "Export Failed",
                    description: "Something went wrong while generating the report.",
                    variant: "destructive",
                  });
                } finally {
                  setIsExportLoading(false);
                }
              }}
              className="flex-[2] h-12 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black uppercase tracking-wider rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none flex items-center justify-center gap-2"
            >
              {isExportLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              <span>{isExportLoading ? "Generating..." : "Generate & Download"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
        <DialogContent className="max-w-lg border-2 border-[#000000]">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
            <DialogDescription>
              Update your leave dates or reason. Only pending requests can be
              modified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Start Date</Label>
                <DatePicker
                  date={editFormData.startDate}
                  onDateChange={(date) =>
                    date &&
                    setEditFormData((prev) => ({ ...prev, startDate: date }))
                  }
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">End Date</Label>
                <DatePicker
                  date={editFormData.endDate}
                  onDateChange={(date) =>
                    date &&
                    setEditFormData((prev) => ({ ...prev, endDate: date }))
                  }
                  placeholder="Select end date"
                />
              </div>
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea
                maxLength={200}
                value={editFormData.reason}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    reason: e.target.value.replace(
                      /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                      "",
                    ),
                  }))
                }
                rows={4}
                placeholder="Update the reason for your leave request (minimum 10 characters)."
                className={
                  editFormData.reason.trim().length > 0 &&
                    editFormData.reason.trim().length < 10
                    ? "border-red-500"
                    : ""
                }
              />
              <div className="flex justify-between text-sm mt-1">
                <span
                  className={`${editFormData.reason.trim().length < 10 ? "text-red-500" : "text-green-600"}`}
                >
                  {editFormData.reason.trim().length < 10
                    ? `${editFormData.reason.trim().length}/10 characters (minimum required)`
                    : `${editFormData.reason.trim().length}/200 characters`}
                </span>
                {editFormData.reason.trim().length < 10 &&
                  editFormData.reason.trim().length > 0 && (
                    <span className="text-red-500 text-xs">
                      Minimum 10 characters required
                    </span>
                  )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isUpdatingLeave}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={
                isUpdatingLeave || editFormData.reason.trim().length < 10
              }
            >
              {isUpdatingLeave ? "Saving..." : "Save Changes"}
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
        <AlertDialogContent className="sm:max-w-md border-2 border-[#000000]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
                <Trash2 className="h-5 w-5 text-white" />
              </div>
              Delete Leave Request
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete this leave request? This action
              cannot be undone.
              {leaveToDelete && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 rounded-lg border-2 border-[#000000] space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                      Leave Details
                    </p>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mt-1">
                      {format(leaveToDelete.startDate, "MMM dd, yyyy")} to{" "}
                      {format(leaveToDelete.endDate, "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                      Type
                    </p>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mt-1">
                      {leaveToDelete.type.charAt(0).toUpperCase() +
                        leaveToDelete.type.slice(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                      Reason
                    </p>
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
        <DialogContent className="sm:max-w-md border-2 border-[#000000]">
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
              <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 rounded-lg p-4 border-2 border-[#000000]">
                <h3 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">
                  {selectedHoliday.name}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <CalendarDays className="h-4 w-4" />
                  <span className="font-semibold">
                    {format(selectedHoliday.date, "EEEE, MMMM dd, yyyy")}
                  </span>
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
                  This is a scheduled holiday. All operations will be closed.
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
    </div >
  );
}

