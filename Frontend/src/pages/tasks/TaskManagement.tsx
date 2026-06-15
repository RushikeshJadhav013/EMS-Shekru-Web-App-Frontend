import React, { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "../../lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { Task as BaseTask, UserRole } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import SummaryCard from '@/components/ui/SummaryCard';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import TruncatedText from "@/components/ui/TruncatedText";
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pause,
  PlayCircle,
  Calendar,
  User,
  Filter,
  Search,
  MessageSquare,
  Paperclip,
  ChevronRight,
  ListTodo,
  Grid3x3,
  FileText,
  XCircle,
  UserCheck,
  Pencil,
  Trash2,
  Share2,
  Loader2,
  RefreshCcw,
  Download,
  FileSpreadsheet,
  FileDown,
  Send,
  Image as ImageIcon,
  File as FileIcon,
  Building2,
  FolderKanban,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  LayoutGrid,
} from "lucide-react";
import { format } from "date-fns";
import {
  formatIST,
  formatDateTimeIST,
  formatDateIST,
  todayIST,
  parseToIST,
  nowIST,
} from "@/utils/timezone";
import { apiService, API_BASE_URL } from "@/lib/api";

const ROLE_ORDER: UserRole[] = [
  "admin",
  "hr",
  "manager",
  "team_lead",
  "employee",
];

type BackendTask = {
  task_id: number;
  title: string;
  description?: string | null;
  status?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  priority?: string | null;
  assigned_to: number | string;
  assigned_by: number | string;
  created_at?: string | null;
  updated_at?: string | null;
  last_passed_by?: number | null;
  last_passed_to?: number | null;
  last_pass_note?: string | null;
  last_passed_at?: string | null;
  assigned_to_name?: string | null;
  assigned_by_name?: string | null;
  assigned_to_role?: string | null;
  assigned_by_role?: string | null;
  project_id?: number | null;
};

type TaskWithPassMeta = Omit<BaseTask, "projectId"> & {
  lastPassedBy?: string;
  lastPassedTo?: string;
  lastPassNote?: string;
  lastPassedAt?: string;
  assignedToName?: string;
  assignedByName?: string;
  assignedToRole?: UserRole;
  assignedByRole?: UserRole;
  projectId?: number | null;
};

type BackendEmployee = {
  user_id: number | string;
  employee_id?: string | null;
  name: string;
  email: string;
  role: string;
  department?: string;
  photo_url?: string | null;
};

type EmployeeSummary = {
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  photo_url?: string;
};

type TaskHistoryEntry = {
  id: number;
  task_id: number;
  user_id: number;
  action: string;
  details?: Record<string, unknown> | null;
  created_at: string;
};

const normalizeRole = (role: string | null | undefined): UserRole => {
  const normalized = role?.trim().toLowerCase();
  switch (normalized) {
    case "admin":
      return "admin";
    case "hr":
      return "hr";
    case "manager":
      return "manager";
    case "teamlead":
    case "team_lead":
    case "teamlead ": // handle accidental spacing
      return "team_lead";
    case "employee":
    default:
      return "employee";
  }
};

const backendToFrontendPriority: Record<string, BaseTask["priority"]> = {
  low: "low",
  Low: "low",
  medium: "medium",
  Medium: "medium",
  high: "high",
  High: "high",
  urgent: "urgent",
  Urgent: "urgent",
};

const frontendToBackendPriority: Record<BaseTask["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const backendToFrontendStatus: Record<string, BaseTask["status"]> = {
  pending: "todo",
  Pending: "todo",
  "in progress": "in-progress",
  "In Progress": "in-progress",
  overdue: "overdue",
  Overdue: "overdue",
  completed: "completed",
  Completed: "completed",
  cancelled: "cancelled",
  Cancelled: "cancelled",
};

const frontendToBackendStatus: Record<BaseTask["status"], string> = {
  todo: "Pending",
  "in-progress": "In Progress",
  overdue: "Overdue",
  completed: "Completed",
  cancelled: "Cancelled",
};

const mapBackendTaskToFrontend = (task: BackendTask): TaskWithPassMeta => {
  const nowIso = new Date().toISOString();
  const createdAt = task.created_at ?? nowIso;
  const updatedAt = task.updated_at ?? createdAt;
  const deadlineIso = task.due_date
    ? new Date(task.due_date).toISOString()
    : "";
  const priority =
    backendToFrontendPriority[task.priority ?? "Medium"] ?? "medium";
  const statusRaw = backendToFrontendStatus[task.status ?? "Pending"] ?? "todo";

  // Automatically determine if task is overdue based on deadline
  let status = statusRaw;
  if (statusRaw !== "completed" && statusRaw !== "cancelled" && task.due_date) {
    const deadlineDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deadlineDate < today) {
      status = "overdue";
    }
  }

  const assignedTo =
    task.assigned_to !== undefined && task.assigned_to !== null
      ? [String(task.assigned_to)]
      : [];
  const assignedBy =
    task.assigned_by !== undefined && task.assigned_by !== null
      ? String(task.assigned_by)
      : "";
  const lastPassedBy =
    task.last_passed_by !== undefined && task.last_passed_by !== null
      ? String(task.last_passed_by)
      : undefined;
  const lastPassedTo =
    task.last_passed_to !== undefined && task.last_passed_to !== null
      ? String(task.last_passed_to)
      : undefined;
  const lastPassedAt = task.last_passed_at
    ? new Date(task.last_passed_at).toISOString()
    : undefined;

  return {
    id: String(task.task_id),
    title: task.title,
    description: task.description ?? "",
    assignedTo,
    assignedBy,
    priority,
    status,
    deadline: deadlineIso,
    startDate: task.start_date ? new Date(task.start_date).toISOString() : createdAt,
    completedDate: status === "completed" ? updatedAt : undefined,
    tags: [],
    progress: 0,
    createdAt,
    updatedAt,
    lastPassedBy,
    lastPassedTo,
    lastPassNote: task.last_pass_note ?? undefined,
    lastPassedAt,
    assignedToName: task.assigned_to_name ?? undefined,
    assignedByName: task.assigned_by_name ?? undefined,
    assignedToRole: task.assigned_to_role
      ? normalizeRole(task.assigned_to_role)
      : undefined,
    assignedByRole: task.assigned_by_role
      ? normalizeRole(task.assigned_by_role)
      : undefined,
    projectId: task.project_id ?? (task as any).projectId ?? (task as any).project?.project_id ?? (task as any).project?._id ?? null,
  };
};

const formatDisplayDate = (date?: string | null) => {
  if (!date) return "No deadline";
  const parsed = parseToIST(date);
  if (!parsed) return "No deadline";
  return formatDateIST(parsed, "MMM dd, yyyy");
};

const getStatusBadge = (status: BaseTask["status"] | string) => {
  const s = typeof status === "string" ? status.toLowerCase().trim().replace(/[-_\s]+/g, "") : status;

  const getStatusInfo = (type: string) => {
    switch (type) {
      case "completed":
      case "done":
        return { label: "Completed", color: "bg-emerald-500", text: "text-black dark:text-white" };
      case "inprogress":
      case "active":
      case "in-progress":
        return { label: "In Progress", color: "bg-blue-500", text: "text-black dark:text-white" };
      case "todo":
      case "pending":
        return { label: "To Do", color: "bg-slate-400", text: "text-black dark:text-white" };
      case "overdue":
        return { label: "Overdue", color: "bg-rose-500", text: "text-black dark:text-white" };
      case "cancelled":
      case "canceled":
        return { label: "Cancelled", color: "bg-red-500", text: "text-black dark:text-white" };
      default:
        return { label: String(status), color: "bg-slate-400", text: "text-black dark:text-white" };
    }
  };

  const info = getStatusInfo(s || "");

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-2 border-0 bg-transparent px-0 py-1 flex items-center w-fit shadow-none transition-all duration-200",
        info.text
      )}
      style={{}}
    >
      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.1)]", info.color)} />
      <span className="text-[14px] font-bold capitalize whitespace-nowrap">{info.label}</span>
    </Badge>
  );
};

const formatDateForInput = (date?: string | null) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatRoleLabel = (role?: UserRole) => {
  switch (role) {
    case "admin":
      return "Admin";
    case "hr":
      return "HR";
    case "manager":
      return "Manager";
    case "team_lead":
      return "Team Lead";
    case "employee":
      return "Employee";
    default:
      return undefined;
  }
};

// WhatsApp-style time formatting for comments
const getCommentTimeDisplay = (createdAt?: string): string => {
  if (!createdAt) return "";

  const commentDate = parseToIST(createdAt);
  if (!commentDate) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const commentDateOnly = new Date(
    commentDate.getFullYear(),
    commentDate.getMonth(),
    commentDate.getDate(),
  );

  // If today, show time only
  if (commentDateOnly.getTime() === today.getTime()) {
    return formatDateTimeIST(commentDate, "hh:mm a");
  }

  // If yesterday, show "Yesterday"
  if (commentDateOnly.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  // If within last 7 days, show day name
  const daysDiff = Math.floor(
    (today.getTime() - commentDateOnly.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysDiff < 7) {
    return formatDateTimeIST(commentDate, "EEEE");
  }

  // Otherwise show date
  return formatDateTimeIST(commentDate, "MMM dd, yyyy");
};

// Get date separator for WhatsApp-style grouping
const getDateSeparator = (createdAt?: string): string | null => {
  if (!createdAt) return null;

  const commentDate = parseToIST(createdAt);
  if (!commentDate) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const commentDateOnly = new Date(
    commentDate.getFullYear(),
    commentDate.getMonth(),
    commentDate.getDate(),
  );

  // If today
  if (commentDateOnly.getTime() === today.getTime()) {
    return "Today";
  }

  // If yesterday
  if (commentDateOnly.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  // Otherwise show date
  return formatDateTimeIST(commentDate, "MMM dd, yyyy");
};

const TaskManagement: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const location = useLocation();
  const { addNotification } = useNotifications();
  const [tasks, setTasks] = useState<TaskWithPassMeta[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isOverdueFilterActive, setIsOverdueFilterActive] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithPassMeta | null>(
    null,
  );
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [taskOwnershipFilter, setTaskOwnershipFilter] = useState<
    "all" | "received" | "created"
  >("received");
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] =
    useState<string>("all");
  const [activeViewTab, setActiveViewTab] = useState<"all" | "project">("all");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: [] as string[],
    priority: "medium" as BaseTask["priority"],
    startDate: "",
    deadline: "",
    department: "",
    employeeId: "",
    projectId: "",
  });
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");

  // Handle auto-opening task creation dialog from navigation state
  useEffect(() => {
    if (location.state?.createFor) {
      const targetUserId = String(location.state.createFor);
      setNewTask((prev) => ({
        ...prev,
        assignedTo: [targetUserId],
      }));
      setIsCreateDialogOpen(true);

      // Clear location state to prevent dialog reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const [assignRoleFilter, setAssignRoleFilter] = useState<"all" | UserRole>(
    "all",
  );
  const [departments, setDepartments] = useState<string[]>([]);
  const [showAllDepartments, setShowAllDepartments] = useState(true);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [userCache, setUserCache] = useState<Map<string, EmployeeSummary>>(
    new Map(),
  );
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithPassMeta | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    startDate: "",
    deadline: "",
    priority: "medium" as BaseTask["priority"],
    projectId: "",
  });
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [isPassDialogOpen, setIsPassDialogOpen] = useState(false);
  const [passTaskTarget, setPassTaskTarget] = useState<TaskWithPassMeta | null>(
    null,
  );
  const [passAssignee, setPassAssignee] = useState("");
  const [passNote, setPassNote] = useState("");
  const [isPassingTask, setIsPassingTask] = useState(false);
  const [taskHistory, setTaskHistory] = useState<
    Record<string, TaskHistoryEntry[]>
  >({});
  const [isFetchingHistory, setIsFetchingHistory] = useState<string | null>(
    null,
  );

  // Pass History Dialog State
  const [isPassHistoryDialogOpen, setIsPassHistoryDialogOpen] = useState(false);
  const [passHistoryTask, setPassHistoryTask] =
    useState<TaskWithPassMeta | null>(null);

  // Reassign Dialog State
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [reassignTask, setReassignTask] = useState<TaskWithPassMeta | null>(
    null,
  );
  const [reassignForm, setReassignForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    startDate: "",
    deadline: "",
    priority: "medium" as BaseTask["priority"],
    projectId: "",
  });

  const [isReassigning, setIsReassigning] = useState(false);

  // Task Comments State
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);

  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const commentsEndRef = React.useRef<HTMLDivElement>(null);

  // Export states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf">("pdf");
  const [exportPeriodType, setExportPeriodType] = useState<
    "all" | "monthly" | "quarterly" | "custom"
  >("all");
  const [exportMonth, setExportMonth] = useState<string>(
    String(new Date().getMonth() + 1),
  );
  const [exportQuarter, setExportQuarter] = useState<string>("1");
  const [exportYear, setExportYear] = useState<string>(
    String(new Date().getFullYear()),
  );
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportStatusFilter, setExportStatusFilter] = useState<string>("all");
  const [exportDepartmentFilter, setExportDepartmentFilter] =
    useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  // Pagination states
  const [taskCurrentPage, setTaskCurrentPage] = useState(1);
  const [taskItemsPerPage, setTaskItemsPerPage] = useState(10);
  const [projectCurrentPage, setProjectCurrentPage] = useState(1);
  const [projectItemsPerPage, setProjectItemsPerPage] = useState(10);
  const [activeScopeError, setActiveScopeError] = useState(false);
  const [debugBranchId, setDebugBranchId] = useState(localStorage.getItem('branchId') || '');
  const [debugCompanyId, setDebugCompanyId] = useState(localStorage.getItem('companyId') || '');

  const toggleProject = useCallback((projectId: string) => {
    setProjects((prevProjects) =>
      prevProjects.map((p) =>
        p.project_id === projectId || p.id === projectId
          ? { ...p, isExpanded: !p.isExpanded }
          : p
      )
    );
  }, []);

  const isCreateDisabled =
    !newTask.title.trim() || !newTask.description.trim() || isSubmitting;

  const userId = useMemo(() => {
    if (user?.id === undefined || user?.id === null) return null;
    return String(user.id);
  }, [user?.id]);



  const normalizedUserRole = useMemo(
    () => normalizeRole(user?.role),
    [user?.role],
  );

  const canSeeAdminFilters = useMemo(() => {
    return ["admin", "hr", "manager", "team_lead"].includes(normalizedUserRole || "");
  }, [normalizedUserRole]);

  const [authToken, setAuthToken] = useState<string>(() => {
    const storedToken = localStorage.getItem("token") || "";
    if (!storedToken) return "";
    return storedToken.startsWith("Bearer ")
      ? storedToken
      : `Bearer ${storedToken}`;
  });

  useEffect(() => {
    if (
      normalizedUserRole === "admin" ||
      normalizedUserRole === "hr" ||
      normalizedUserRole === "manager" ||
      normalizedUserRole === "team_lead"
    ) {
      // Admin, HR, Manager, Team Lead default to "all" and can see other sections
      setTaskOwnershipFilter("all");
    } else {
      // Employee defaults to "received" section
      setTaskOwnershipFilter("received");
    }
  }, [normalizedUserRole]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token") || "";
    if (!storedToken) {
      setAuthToken("");
      return;
    }
    setAuthToken(
      storedToken.startsWith("Bearer ") ? storedToken : `Bearer ${storedToken}`,
    );
  }, [user?.id]);

  const authorizedHeaders = useMemo(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authToken) {
      headers.Authorization = authToken;
    }

    return headers;
  }, [authToken]);

  const fetchAndStoreHistory = useCallback(
    async (taskId: string) => {
      try {
        const data = await apiService.getTaskHistory(taskId);
        setTaskHistory((prev) => ({ ...prev, [taskId]: data }));
      } catch (error) {
        console.error("Failed to fetch task history", error);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedTask) return;
    const alreadyLoaded = taskHistory[selectedTask.id];
    if (!alreadyLoaded && authToken) {
      setIsFetchingHistory(selectedTask.id);
      fetchAndStoreHistory(selectedTask.id).finally(() =>
        setIsFetchingHistory(null),
      );
    }
  }, [authToken, fetchAndStoreHistory, selectedTask, taskHistory]);

  const fetchEmployees = useCallback(async () => {
    if (!authToken) {
      toast({
        title: "Authentication required",
        description: "Please log in again to load employees.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Now all roles including employee can fetch (at least their own list or filtered list if required)
      // Removed role check to allow employee role to load necessary data for task creation

      const data = await apiService.getEmployees();
      const formatted = data.map((emp: any) => ({
        userId: String(emp.user_id),
        employeeId: emp.employee_id ? String(emp.employee_id) : "",
        name: emp.name,
        email: emp.email,
        department: emp.department ?? undefined,
        role: normalizeRole(emp.role),
        photo_url: emp.photo_url ?? undefined,
      }));
      setEmployees(formatted);

      const uniqueDepartments = new Set<string>();
      formatted.forEach((emp) => {
        if (emp.department) {
          emp.department.split(",").forEach((d) => {
            const trimmed = d.trim();
            if (trimmed) uniqueDepartments.add(trimmed);
          });
        }
      });
      if (user?.department) {
        user.department.split(",").forEach((d) => {
          const trimmed = d.trim();
          if (trimmed) uniqueDepartments.add(trimmed);
        });
      }
      setDepartments(Array.from(uniqueDepartments));
    } catch (error: any) {
      console.error("Failed to fetch employees", error);

      const errorMessage = error.message || "";
      if (error.status === 409 || errorMessage.includes("409") || errorMessage.includes("Scope conflict") || errorMessage.includes("Multiple company")) {
        setActiveScopeError(true);
      }

      if (normalizedUserRole && normalizedUserRole !== "employee") {
        toast({
          title: "Employee fetch failed",
          description: error.message || "Unable to load employees from server.",
          variant: "destructive",
        });
      }
    }
  }, [
    authToken,
    authorizedHeaders,
    toast,
    user?.department,
    normalizedUserRole,
  ]);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    if (!authToken) {
      setTasks([]);
      toast({
        title: "Authentication required",
        description: "Please log in again to load your tasks.",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingTasks(true);
    try {
      const data: BackendTask[] = await apiService.getMyTasks();

      // Update user cache with names and roles provided in task data
      setUserCache((prev) => {
        const next = new Map(prev);
        let changed = false;
        data.forEach((t) => {
          if (t.assigned_to && t.assigned_to_name) {
            const tid = String(t.assigned_to);
            // Find employee in list for role lookup
            const employeeFromList = employees.find(
              (emp) => emp.userId === tid,
            );

            // Prioritize: backend role (from API) > employees list role > existing cache role
            // Only default to 'employee' if we truly have no role information
            let assignedToRole: UserRole | undefined;
            if (t.assigned_to_role) {
              // Backend provided role - use it (most reliable)
              assignedToRole = normalizeRole(t.assigned_to_role);
            } else if (employeeFromList?.role) {
              // Use role from employees list
              assignedToRole = employeeFromList.role;
            } else if (prev.get(tid)?.role) {
              // Use existing cached role
              assignedToRole = prev.get(tid)!.role;
            }
            // Don't default to 'employee' - let it be undefined if we don't know

            // Always update if role changed or user doesn't exist
            const existing = next.get(tid);
            if (
              !existing ||
              (assignedToRole && existing.role !== assignedToRole) ||
              (!existing.role && assignedToRole)
            ) {
              next.set(tid, {
                userId: tid,
                employeeId:
                  existing?.employeeId || employeeFromList?.employeeId || "",
                name: t.assigned_to_name,
                email: existing?.email || employeeFromList?.email || "",
                role: assignedToRole || existing?.role || "employee", // Only use employee as last resort
              });
              changed = true;
            }
          }
          if (t.assigned_by && t.assigned_by_name) {
            const bid = String(t.assigned_by);
            // Find employee in list for role lookup
            const employeeFromList = employees.find(
              (emp) => emp.userId === bid,
            );

            // Prioritize: backend role (from API) > employees list role > existing cache role
            // Only default to 'employee' if we truly have no role information
            let assignedByRole: UserRole | undefined;
            if (t.assigned_by_role) {
              // Backend provided role - use it (most reliable)
              assignedByRole = normalizeRole(t.assigned_by_role);
            } else if (employeeFromList?.role) {
              // Use role from employees list
              assignedByRole = employeeFromList.role;
            } else if (prev.get(bid)?.role) {
              // Use existing cached role
              assignedByRole = prev.get(bid)!.role;
            }
            // Don't default to 'employee' - let it be undefined if we don't know

            // Always update if role changed or user doesn't exist
            const existing = next.get(bid);
            if (
              !existing ||
              (assignedByRole && existing.role !== assignedByRole) ||
              (!existing.role && assignedByRole)
            ) {
              next.set(bid, {
                userId: bid,
                employeeId:
                  existing?.employeeId || employeeFromList?.employeeId || "",
                name: t.assigned_by_name,
                email: existing?.email || employeeFromList?.email || "",
                role: assignedByRole || existing?.role || "employee", // Only use employee as last resort
              });
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });

      const converted = data.map(mapBackendTaskToFrontend);

      // Check and update overdue tasks
      // Check and update overdue tasks
      const tasksToUpdate: TaskWithPassMeta[] = [];
      const updatedConverted = converted.map((task) => {
        // If task is not completed/cancelled and deadline has passed, mark as overdue
        // Fix: Compare dates only, allowing the entire deadline day to pass before marking as overdue
        if (
          task.status !== "completed" &&
          task.status !== "cancelled" &&
          task.deadline &&
          task.status !== "overdue"
        ) {
          const deadlineDate = new Date(task.deadline);
          const now = new Date();

          // Reset check to midnight so we compare purely based on the calendar date
          const dMidnight = new Date(
            deadlineDate.getFullYear(),
            deadlineDate.getMonth(),
            deadlineDate.getDate(),
          );
          const nMidnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );

          // Only overdue if today's date is strictly AFTER the deadline date
          if (nMidnight > dMidnight) {
            tasksToUpdate.push(task);
            return { ...task, status: "overdue" as BaseTask["status"] };
          }
        }
        return task;
      });

      // Update overdue tasks on the backend using the proper endpoints
      for (const task of tasksToUpdate) {
        try {
          // Use formatted status for backend
          const backendStatus = frontendToBackendStatus["overdue"];
          await apiService.updateTaskStatus(task.id, backendStatus, {
            title: task.title,
            assigned_to: task.assignedTo[0]
          });
        } catch (error) {
          console.error(
            `Failed to update task ${task.id} to overdue status`,
            error,
          );
        }
      }

      // Sort tasks by status priority first, then by deadline within each status
      const sortedTasks = updatedConverted.sort((a, b) => {
        // Define status priority order: todo -> in-progress -> overdue -> completed -> cancelled
        const statusOrder = {
          todo: 0,
          "in-progress": 1,
          overdue: 2,
          completed: 3,
          cancelled: 4,
        };
        const aStatusPriority = statusOrder[a.status] ?? 999;
        const bStatusPriority = statusOrder[b.status] ?? 999;

        // First sort by status priority
        if (aStatusPriority !== bStatusPriority) {
          return aStatusPriority - bStatusPriority;
        }

        // Within same status, sort by ID (latest first) to show newest tasks at the top
        return Number(b.id) - Number(a.id);
      });
      setTasks(sortedTasks);
      setTaskHistory({});
      await Promise.all(
        sortedTasks.map((task) => fetchAndStoreHistory(task.id)),
      );
    } catch (error) {
      console.error("Failed to fetch tasks", error);
      toast({
        title: "Task fetch failed",
        description: "Unable to load tasks from server.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTasks(false);
    }
  }, [
    authToken,
    authorizedHeaders,
    employees,
    fetchAndStoreHistory,
    toast,
    userId,
  ]);

  useEffect(() => {
    fetchEmployees();
    setIsProjectsLoading(true);
    apiService.getProjects().then(async data => {
      const projectList = Array.isArray(data) ? data : (data as any)?.projects || (data as any)?.data || [];
      const normalizedProjects = await Promise.all(projectList.map(async (p: any) => {
        let members = p.members || [];
        let projectTasks: any[] = [];
        const pid = p.project_id || p.id;

        if (pid) {
          try {
            // Fetch members if not present
            if (!members.length) {
              members = await apiService.getProjectMembers(pid);
            }
            // Fetch tasks specifically linked to this project
            const tasksData = await apiService.getProjectTasks(pid);
            projectTasks = Array.isArray(tasksData) ? tasksData : (tasksData as any)?.tasks || [];
          } catch (e) {
            console.error(`Failed to fetch supplementary data for project ${pid}`, e);
          }
        }

        return {
          ...p,
          project_id: pid,
          name: p.name || "Untitled Project",
          task_count: p.task_count || projectTasks.length || 0,
          members: Array.isArray(members) ? members : [],
          tasks: projectTasks.map(mapBackendTaskToFrontend),
          isExpanded: false,
        };
      }));

      setProjects(normalizedProjects);

      // Also merge all project tasks into the main tasks state to ensure they show up in stats and global list if visible
      const allProjectTasks = normalizedProjects.flatMap(p => p.tasks || []);
      if (allProjectTasks.length > 0) {
        setTasks(prev => {
          const combined = [...prev];
          allProjectTasks.forEach(pt => {
            if (!combined.some(t => t.id === pt.id)) {
              combined.push(pt);
            }
          });
          return combined;
        });
      }
    }).catch(err => console.error("Failed to fetch projects", err))
      .finally(() => setIsProjectsLoading(false));
  }, [fetchEmployees]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Check if user can assign tasks to others
  const canAssignTasks = () => {
    if (!normalizedUserRole) return false;
    // All roles including 'employee' should be able to create tasks (perhaps for self)
    // following the latest feedback that even employees should be able to create tasks
    return ["admin", "hr", "manager", "team_lead", "employee"].includes(
      normalizedUserRole,
    );
  };

  const extendedEmployees = useMemo(() => {
    if (!userId || !user) return employees;
    const exists = employees.some((emp) => emp.userId === userId);
    if (exists) return employees;
    return [
      ...employees,
      {
        userId,
        employeeId: "",
        name: user.name,
        email: user.email,
        department: user.department || undefined,
        role: normalizedUserRole,
      },
    ];
  }, [employees, user, userId, normalizedUserRole]);

  const assignableEmployees = useMemo(() => {
    if (!user || !userId) return [];

    const currentIndex = ROLE_ORDER.indexOf(normalizedUserRole);

    return extendedEmployees.filter((emp) => {
      // Always allow self
      if (emp.userId === userId) return true;

      // 1. Role Hierarchy Check
      const targetIndex = ROLE_ORDER.indexOf(emp.role);
      // Only allow assigning to lower hierarchy (higher index in ROLE_ORDER index)
      if (
        currentIndex !== -1 &&
        targetIndex !== -1 &&
        targetIndex <= currentIndex
      ) {
        return false;
      }

      // 2. Department Check (for Manager/Team Lead if applicable)
      if (
        (normalizedUserRole === "manager" ||
          normalizedUserRole === "team_lead") &&
        !showAllDepartments
      ) {
        const managerDepts = (user.department || "")
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);
        const empDepts = (emp.department || "")
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);

        const sameDepartment =
          managerDepts.length === 0 ||
          empDepts.length === 0 ||
          empDepts.some((ed) => managerDepts.includes(ed));

        if (!sameDepartment) return false;
      }

      return true;
    });
  }, [extendedEmployees, user, userId, normalizedUserRole, showAllDepartments]);

  const passEligibleEmployees = useMemo(() => {
    if (!user || !userId) return [] as EmployeeSummary[];
    const currentIndex = ROLE_ORDER.indexOf(normalizedUserRole);
    return extendedEmployees.filter((emp) => {
      // Filter out current user (self)
      if (emp.userId === userId || String(emp.userId) === String(userId))
        return false;

      const targetIndex = ROLE_ORDER.indexOf(emp.role);
      if (targetIndex === -1) return false;

      // Can only pass to lower hierarchy (higher index in ROLE_ORDER)
      if (targetIndex <= currentIndex) return false;

      // Non-admin users can only pass within their department
      if (normalizedUserRole !== "admin") {
        const managerDepts = (user.department || "")
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);
        const empDepts = (emp.department || "")
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);

        const hasOverlap =
          managerDepts.length === 0 ||
          empDepts.length === 0 ||
          empDepts.some((ed) => managerDepts.includes(ed));

        if (!hasOverlap) return false;
      }
      return true;
    });
  }, [extendedEmployees, user, userId, normalizedUserRole]);

  // Group pass eligible employees by department with role hierarchy
  const passEligibleByDepartment = useMemo(() => {
    const grouped = new Map<string, EmployeeSummary[]>();

    passEligibleEmployees.forEach((emp) => {
      const dept = emp.department || "No Department";
      if (!grouped.has(dept)) {
        grouped.set(dept, []);
      }
      grouped.get(dept)!.push(emp);
    });

    // Sort employees within each department by role hierarchy
    // Include 'admin' in the role order for proper sorting
    const roleOrder: UserRole[] = [
      "admin",
      "hr",
      "manager",
      "team_lead",
      "employee",
    ];
    grouped.forEach((employees, dept) => {
      employees.sort((a, b) => {
        const aIndex = roleOrder.indexOf(a.role);
        const bIndex = roleOrder.indexOf(b.role);
        // Handle roles not in the list (put them at the end)
        const aPos = aIndex === -1 ? roleOrder.length : aIndex;
        const bPos = bIndex === -1 ? roleOrder.length : bIndex;

        if (aPos !== bPos) {
          return aPos - bPos;
        }
        // If same role, sort alphabetically by name
        return a.name.localeCompare(b.name);
      });
    });

    // Sort departments alphabetically
    return new Map(
      [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    );
  }, [passEligibleEmployees]);

  const assignableDepartments = useMemo(() => {
    if (!user || !userId) return departments;
    // Admin and HR can select any department
    if (normalizedUserRole === "admin" || normalizedUserRole === "hr")
      return departments;
    if (!user.department) return departments;
    const userDepts = user.department.split(",").map((d) => d.trim());
    return departments.filter((dept) => userDepts.includes(dept));
  }, [departments, user, userId, normalizedUserRole]);


  const employeesById = useMemo(() => {
    const map = new Map<string, EmployeeSummary>();
    employees.forEach((emp) => {
      map.set(emp.userId, emp);
    });
    // Add cached users (including admin)
    userCache.forEach((user, userId) => {
      if (!map.has(userId)) {
        map.set(userId, user);
      }
    });
    if (user && userId && !map.has(userId)) {
      map.set(userId, {
        userId,
        employeeId: "",
        name: user.name,
        email: user.email,
        department: user.department || undefined,
        role: normalizedUserRole,
      });
    }
    return map;
  }, [employees, user, userId, userCache, normalizedUserRole]);

  const getAssigneeLabel = useCallback(
    (assigneeId: string) => {
      if (!assigneeId) return "Self";
      if (userId && assigneeId === userId) {
        return user?.name || "Self";
      }
      const assignee = employeesById.get(assigneeId);
      if (assignee) {
        const identifier = assignee.employeeId || assignee.email;
        return `${assignee.name}${identifier ? ` (${identifier})` : ""}`;
      }
      return assigneeId;
    },
    [employeesById, user, userId],
  );

  const getAssignedByInfo = useCallback(
    (assignedById: string, role?: UserRole, directName?: string) => {
      if (!assignedById) {
        return { name: "Unknown", roleLabel: undefined };
      }

      // Priority 0: Direct name from backend task payload (assigned_by_name) - most reliable
      // But only if it's not just a numeric ID
      if (directName && isNaN(Number(directName))) {
        const assigner = employeesById.get(assignedById);
        const cachedUser = userCache.get(assignedById);
        const resolvedRole = role || assigner?.role || cachedUser?.role;
        return {
          name: directName,
          roleLabel: resolvedRole ? formatRoleLabel(resolvedRole) : undefined,
        };
      }

      // Priority 1: Backend-provided role from task (most reliable)
      if (role) {
        const assigner = employeesById.get(assignedById);
        const cachedUser = userCache.get(assignedById);
        const name =
          assigner?.name ||
          cachedUser?.name ||
          (userId && assignedById === userId ? user?.name : undefined) ||
          `User #${assignedById}`;
        const finalName =
          name === `User #${assignedById}` && userId && assignedById === userId
            ? user?.name || "Self"
            : name;
        return {
          name: finalName,
          roleLabel: formatRoleLabel(role),
        };
      }

      // Priority 2: Check employees list (authoritative source)
      const assigner = employeesById.get(assignedById);
      if (assigner) {
        return {
          name: assigner.name,
          roleLabel: formatRoleLabel(assigner.role),
        };
      }

      // Priority 3: Current user (if self)
      if (userId && assignedById === userId) {
        return {
          name: user?.name || "Self",
          roleLabel: formatRoleLabel(normalizedUserRole),
        };
      }

      // Priority 4: Check user cache (populated from backend task data)
      const cachedUser = userCache.get(assignedById);
      if (cachedUser && cachedUser.role) {
        return {
          name: cachedUser.name,
          roleLabel: formatRoleLabel(cachedUser.role),
        };
      }

      // If we can't determine role, don't show a default - show undefined
      // This prevents showing incorrect "Employee" for users who might be Managers, etc.
      return {
        name: cachedUser?.name || `User #${assignedById}`,
        roleLabel: undefined,
      };
    },
    [employeesById, user?.name, userId, userCache, normalizedUserRole],
  );

  const getAssignedToInfo = useCallback(
    (assignedToId: string, role?: UserRole, directName?: string) => {
      if (!assignedToId) {
        return { name: "Unassigned", roleLabel: undefined };
      }

      // Priority 0: Direct name from backend task payload (assigned_to_name) - most reliable
      // But only if it's not just a numeric ID
      if (directName && isNaN(Number(directName))) {
        const assignee = employeesById.get(assignedToId);
        const cachedUser = userCache.get(assignedToId);
        const resolvedRole = role || assignee?.role || cachedUser?.role;
        return {
          name: directName,
          roleLabel: resolvedRole ? formatRoleLabel(resolvedRole) : undefined,
        };
      }

      // Priority 1: Backend-provided role from task (most reliable)
      if (role) {
        const assignee = employeesById.get(assignedToId);
        const cachedUser = userCache.get(assignedToId);
        const name =
          assignee?.name ||
          cachedUser?.name ||
          (userId && assignedToId === userId ? user?.name : undefined) ||
          `User #${assignedToId}`;
        const finalName =
          name === `User #${assignedToId}` && userId && assignedToId === userId
            ? user?.name || "Self"
            : name;
        return {
          name: finalName,
          roleLabel: formatRoleLabel(role),
        };
      }

      // Priority 2: Check employees list (authoritative source)
      const assignee = employeesById.get(assignedToId);
      if (assignee) {
        return {
          name: assignee.name,
          roleLabel: formatRoleLabel(assignee.role),
        };
      }

      // Priority 3: Current user (if self)
      if (userId && assignedToId === userId) {
        return {
          name: user?.name || "Self",
          roleLabel: formatRoleLabel(normalizedUserRole),
        };
      }

      // Priority 4: Check user cache (populated from backend task data)
      const cachedUser = userCache.get(assignedToId);
      if (cachedUser && cachedUser.role) {
        return {
          name: cachedUser.name,
          roleLabel: formatRoleLabel(cachedUser.role),
        };
      }

      // If we can't determine role, don't show a default - show undefined
      // This prevents showing incorrect "Employee" for users who might be Managers, etc.
      return {
        name: cachedUser?.name || `User #${assignedToId}`,
        roleLabel: undefined,
      };
    },
    [employeesById, user?.name, userId, userCache, normalizedUserRole],
  );

  // Add current user to cache if they're an admin or not in employees list
  useEffect(() => {
    if (user && userId && !userCache.has(userId)) {
      setUserCache((prev) =>
        new Map(prev).set(userId, {
          userId,
          employeeId: "",
          name: user.name,
          email: user.email,
          department: user.department || undefined,
          role: normalizedUserRole,
        }),
      );
    }
  }, [user, userId, userCache, normalizedUserRole]);

  // Update user cache with correct roles from employees list when employees are loaded
  useEffect(() => {
    if (employees.length === 0) return;

    setUserCache((prev) => {
      const next = new Map(prev);
      let changed = false;

      // Update cached users with correct roles from employees list
      prev.forEach((cachedUser, cachedUserId) => {
        const employee = employees.find((emp) => emp.userId === cachedUserId);
        if (employee) {
          // Always update role from employees list if it exists (employees list is authoritative)
          if (cachedUser.role !== employee.role) {
            next.set(cachedUserId, {
              ...cachedUser,
              role: employee.role,
              name: employee.name, // Also update name in case it changed
              email: employee.email || cachedUser.email, // Update email if available
              employeeId: employee.employeeId || cachedUser.employeeId,
              department: employee.department || cachedUser.department,
            });
            changed = true;
          }
        }
      });

      // Add any employees that aren't in cache yet
      employees.forEach((emp) => {
        if (!next.has(emp.userId)) {
          next.set(emp.userId, {
            userId: emp.userId,
            employeeId: emp.employeeId,
            name: emp.name,
            email: emp.email,
            department: emp.department,
            role: emp.role,
            photo_url: emp.photo_url,
          });
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [employees]);

  useEffect(() => {
    if (!user || !userId || !isCreateDialogOpen) return;
    if (!newTask.assignedTo.length) {
      setNewTask((prev) => ({
        ...prev,
        assignedTo: [userId],
        department: "", // Default to "All Departments" as requested
      }));
    }
  }, [isCreateDialogOpen, newTask.assignedTo.length, user, userId]);

  useEffect(() => {
    if (!user || !userId) return;
    const currentAssigneeId = newTask.assignedTo[0];
    const assignee = currentAssigneeId
      ? employeesById.get(currentAssigneeId)
      : null;

    // Auto-update department only if it's currently empty and an assignee is chosen.
    // If the user has manually selected a department, we respect that choice.
    let nextDepartment = newTask.department;
    if (!newTask.department && assignee && assignee.userId !== userId) {
      nextDepartment = assignee.department || user.department || "";
    }

    const nextEmployeeId = assignee?.employeeId || "";

    if (
      newTask.department !== nextDepartment ||
      newTask.employeeId !== nextEmployeeId
    ) {
      setNewTask((prev) => ({
        ...prev,
        department: nextDepartment,
        employeeId: nextEmployeeId,
      }));
    }
  }, [employeesById, newTask.assignedTo, user, userId]); // Removed department from dependency to avoid infinite loops and fight with user choice

  // Visibility helper for consistent role-based access
  const isTaskVisible = useCallback((task: TaskWithPassMeta) => {
    if (!userId || !user) return false;
    if (normalizedUserRole === "admin") return true;

    // Direct involvement
    if (String(task.assignedBy) === String(userId) ||
      task.assignedTo.some(id => String(id) === String(userId))) {
      return true;
    }

    // Project-based visibility: If user is a member of the project, they should see the task
    if (task.projectId && projects.length > 0) {
      const project = projects.find(p => String(p.project_id || p.id) === String(task.projectId));
      if (project && project.members?.some((m: any) => String(m.user_id || m.userId || m.id) === String(userId))) {
        return true;
      }
    }

    // Role-based organizational access
    if (normalizedUserRole === "manager" && user.department) {
      const userDepts = user.department.split(",").map(d => d.trim().toLowerCase());

      const creator = employees.find(emp => String(emp.userId) === String(task.assignedBy));
      const assignees = task.assignedTo.map(id => employees.find(emp => String(emp.userId) === String(id)));

      const creatorInDept = creator?.department?.split(",").some(d => userDepts.includes(d.trim().toLowerCase()));
      const anyAssigneeInDept = assignees.some(assignee =>
        assignee?.department?.split(",").some(d => userDepts.includes(d.trim().toLowerCase()))
      );

      if (creatorInDept || anyAssigneeInDept) return true;
    }

    if (normalizedUserRole === "team_lead" && user.department) {
      // Team leads see tasks within their department
      const userDepts = user.department.split(",").map(d => d.trim().toLowerCase());
      const creator = employees.find(emp => String(emp.userId) === String(task.assignedBy));
      const assignees = task.assignedTo.map(id => employees.find(emp => String(emp.userId) === String(id)));

      const creatorInDept = creator?.department?.split(",").some(d => userDepts.includes(d.trim().toLowerCase()));
      const anyAssigneeInDept = assignees.some(assignee =>
        assignee?.department?.split(",").some(d => userDepts.includes(d.trim().toLowerCase()))
      );

      if (creatorInDept || anyAssigneeInDept) return true;
    }

    if (normalizedUserRole === "hr") {
      return true;
    }

    return false;
  }, [userId, user, normalizedUserRole, employees, projects]);

  // 1. Base Visibility & Search Filter (Status-independent)
  const baseVisibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch && isTaskVisible(task);
    });
  }, [searchQuery, tasks, isTaskVisible]);

  // 2. Ownership & Department Scoped Filter (Status-independent)
  const scopedTasks = useMemo(() => {
    let base = [...baseVisibleTasks];

    // Ownership filter
    if (taskOwnershipFilter === "created") {
      base = base.filter((task) => String(task.assignedBy) === String(userId));
    } else if (taskOwnershipFilter === "received") {
      base = base.filter((task) => task.assignedTo.some(id => String(id) === String(userId)));
    }

    // Department filter
    if (
      taskOwnershipFilter === "all" &&
      selectedDepartmentFilter !== "all" &&
      (normalizedUserRole === "admin" ||
        normalizedUserRole === "manager" ||
        normalizedUserRole === "hr" ||
        normalizedUserRole === "team_lead")
    ) {
      base = base.filter((task) => {
        const creator = employees.find((emp) => String(emp.userId) === String(task.assignedBy));
        const assignees = task.assignedTo.map((id) =>
          employees.find((emp) => String(emp.userId) === String(id)),
        );

        const creatorDepts =
          creator?.department?.split(",").map((d) => d.trim().toLowerCase()) || [];
        const anyAssigneeMatch = assignees.some((assignee) =>
          assignee?.department
            ?.split(",")
            .map((d) => d.trim().toLowerCase())
            .includes(selectedDepartmentFilter.toLowerCase()),
        );

        return (
          creatorDepts.includes(selectedDepartmentFilter.toLowerCase()) || anyAssigneeMatch
        );
      });
    }

    return base;
  }, [baseVisibleTasks, taskOwnershipFilter, selectedDepartmentFilter, userId, normalizedUserRole, employees]);

  // 3. Stats derived from scoped tasks
  const taskCountsByStatus = useMemo(() => {
    return {
      total: scopedTasks.length,
      todo: scopedTasks.filter((t: any) => t.status === "todo").length,
      inProgress: scopedTasks.filter((t: any) => t.status === "in-progress" || t.status === "Pending").length,
      completed: scopedTasks.filter((t: any) => t.status === "completed").length,
      overdue: scopedTasks.filter((t: any) => t.status === "overdue").length,
      cancelled: scopedTasks.filter((t: any) => t.status === "cancelled").length,
    };
  }, [scopedTasks]);

  // 4. Final Visible Tasks (Status + Sorting)
  const visibleTasks = useMemo(() => {
    let base = [...scopedTasks];

    // Status filter
    if (filterStatus !== "all") {
      base = base.filter((t) => t.status === filterStatus);
    }

    // Explicit Overdue filter
    if (isOverdueFilterActive) {
      base = base.filter((t) => t.status === "overdue");
    }

    // Sort tasks
    return base.sort((a, b) => {
      const statusOrder = {
        todo: 0,
        "in-progress": 1,
        overdue: 2,
        completed: 3,
        cancelled: 4,
      };
      const aStatusPriority = statusOrder[a.status] ?? 999;
      const bStatusPriority = statusOrder[b.status] ?? 999;

      if (aStatusPriority !== bStatusPriority) {
        return aStatusPriority - bStatusPriority;
      }

      // Within same status, sort by deadline
      return Number(b.id) - Number(a.id);
    });
  }, [scopedTasks, filterStatus, isOverdueFilterActive]);

  // Paginated tasks
  const paginatedTasks = useMemo(() => {
    const startIndex = (taskCurrentPage - 1) * taskItemsPerPage;
    const endIndex = startIndex + taskItemsPerPage;
    return visibleTasks.slice(startIndex, endIndex);
  }, [visibleTasks, taskCurrentPage, taskItemsPerPage]);

  const taskTotalPages = Math.ceil(visibleTasks.length / taskItemsPerPage);

  // Reset pagination when filters change
  useEffect(() => {
    setTaskCurrentPage(1);
  }, [
    taskOwnershipFilter,
    filterStatus,
    searchQuery,
    selectedDepartmentFilter,
  ]);

  // 6. Selected Task Info Helpers
  const selectedTaskAssignerInfo = useMemo(() => {
    if (!selectedTask) return null;
    return getAssignedByInfo(
      selectedTask.assignedBy,
      selectedTask.assignedByRole,
      selectedTask.assignedByName,
    );
  }, [getAssignedByInfo, selectedTask]);

  const selectedTaskAssigneeInfo = useMemo(() => {
    if (!selectedTask) return null;
    return getAssignedToInfo(
      selectedTask.assignedTo[0] || "",
      selectedTask.assignedToRole,
      selectedTask.assignedToName,
    );
  }, [getAssignedToInfo, selectedTask]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return projects
      .map((p) => {
        const projectMatchesSearch =
          (p.name || "").toLowerCase().includes(query) ||
          (p.description || "").toLowerCase().includes(query);

        // Filter tasks within this project based on current filters AND visibility
        const projectTasksFromMain = tasks.filter(t => t.projectId && String(t.projectId) === String(p.project_id || p.id));
        const filteredProjectTasks = projectTasksFromMain.filter((task: any) => {
          // 1. Visibility Check
          if (!isTaskVisible(task)) return false;

          // 2. Ownership Filter - For project view, we might want to be more inclusive if "all" is selected
          if (taskOwnershipFilter === "created") {
            if (String(task.assignedBy) !== String(userId)) return false;
          } else if (taskOwnershipFilter === "received") {
            if (!task.assignedTo.some((id: any) => String(id) === String(userId))) return false;
          }

          // 3. Status filter
          if (filterStatus !== "all" && task.status !== filterStatus) return false;

          // 4. Overdue filter
          if (isOverdueFilterActive && task.status !== "overdue") return false;

          // 5. Search filter
          if (query && !task.title.toLowerCase().includes(query) && !task.description.toLowerCase().includes(query)) {
            return false;
          }

          return true;
        });

        return {
          ...p,
          filteredTasks: filteredProjectTasks,
          projectMatchesSearch,
        };
      })
      .filter((p) => p.projectMatchesSearch || p.filteredTasks.length > 0);
  }, [projects, tasks, searchQuery, filterStatus, isOverdueFilterActive, isTaskVisible, taskOwnershipFilter, userId]);

  // Paginated projects
  const paginatedProjects = useMemo(() => {
    const startIndex = (projectCurrentPage - 1) * projectItemsPerPage;
    const endIndex = startIndex + projectItemsPerPage;
    return filteredProjects.slice(startIndex, endIndex);
  }, [filteredProjects, projectCurrentPage, projectItemsPerPage]);

  const projectTotalPages = Math.ceil(filteredProjects.length / projectItemsPerPage);

  // Reset project pagination when filters change
  useEffect(() => {
    setProjectCurrentPage(1);
  }, [searchQuery, filterStatus, taskOwnershipFilter]);

  // Counts for the Project View stat cards
  const projectCounts = useMemo(() => {
    const allProjectTasks = filteredProjects.flatMap((p) => p.filteredTasks);
    return {
      total: allProjectTasks.length,
      todo: allProjectTasks.filter((t: any) => t.status === "todo").length,
      inProgress: allProjectTasks.filter((t: any) => t.status === "in-progress").length,
      completed: allProjectTasks.filter((t: any) => t.status === "completed").length,
      overdue: allProjectTasks.filter((t: any) => t.status === "overdue").length,
      cancelled: allProjectTasks.filter((t: any) => t.status === "cancelled").length,
    };
  }, [filteredProjects]);

  const selectedTaskHistory = useMemo(() => {
    if (!selectedTask) return [];
    return taskHistory[selectedTask.id] ?? [];
  }, [selectedTask, taskHistory]);

  // Get pass history entries for a specific task
  const getPassHistoryEntries = useCallback(
    (taskId: string) => {
      const history = taskHistory[taskId] ?? [];
      return history.filter((entry) => entry.action === "passed").reverse(); // Most recent first
    },
    [taskHistory],
  );

  // Open pass history dialog
  const openPassHistoryDialog = useCallback(
    (task: TaskWithPassMeta) => {
      setPassHistoryTask(task);
      setIsPassHistoryDialogOpen(true);
      // Ensure history is loaded
      if (!taskHistory[task.id]) {
        fetchAndStoreHistory(task.id);
      }
    },
    [fetchAndStoreHistory, taskHistory],
  );

  // Create new task
  const canAssignToEdit = useMemo(() => {
    let base = assignableEmployees;
    if (editTaskForm.projectId) {
      const selectedProject = projects.find(p => String(p.project_id || p.id) === String(editTaskForm.projectId));
      if (selectedProject?.members) {
        const memberIds = selectedProject.members.map((m: any) => String(m.user_id || m.userId || m.id || ''));
        base = base.filter(emp => memberIds.includes(String(emp.userId)));
      }
    }
    return base;
  }, [assignableEmployees, editTaskForm.projectId, projects]);

  const canAssignToReassign = useMemo(() => {
    let base = assignableEmployees;
    if (reassignForm.projectId) {
      const selectedProject = projects.find(p => String(p.project_id || p.id) === String(reassignForm.projectId));
      if (selectedProject?.members) {
        const memberIds = selectedProject.members.map((m: any) => String(m.user_id || m.userId || m.id || ''));
        base = base.filter(emp => memberIds.includes(String(emp.userId)));
      }
    }
    return base;
  }, [assignableEmployees, reassignForm.projectId, projects]);

  const canAssignToSelection = useMemo(() => {
    if (!user || !userId) return [];
    let base = assignableEmployees;
    if (newTask.projectId) {
      const selectedProject = projects.find(p => String(p.project_id || p.id) === String(newTask.projectId));
      if (selectedProject?.members) {
        const memberIds = selectedProject.members.map((m: any) => String(m.user_id || m.userId || m.id || ''));
        base = base.filter(emp => memberIds.includes(String(emp.userId)));
      }
    }
    return base;
  }, [assignableEmployees, user, userId, newTask.projectId, projects]);

  const departmentOptions = useMemo(() => {
    const sanitized = assignableDepartments.filter(
      (dept) => dept && dept.trim().length > 0,
    );
    if (sanitized.length) return sanitized;
    if (user?.department) return [user.department];
    return [];
  }, [assignableDepartments, user?.department]);

  const handleCreateTask = async () => {
    if (!user || !userId) return;

    // Validate deadline is required
    if (!newTask.deadline) {
      toast({
        title: "Deadline required",
        description: "Please set a deadline for the task.",
        variant: "destructive",
      });
      return;
    }

    // One assignee is required (can default to self but let's be explicit from UI selection if any)
    const assignees =
      newTask.assignedTo.length > 0 ? newTask.assignedTo : [userId];
    const assigneeIdsNormalized = assignees
      .map((id) => Number(id))
      .filter((id) => !isNaN(id));

    if (assigneeIdsNormalized.length === 0) {
      toast({
        title: "No valid assignees",
        description: "Please select valid employees to assign tasks to.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build the POST /tasks/bulk payload as per user's latest requirement
      const payload: any = {
        title: newTask.title,
        description: newTask.description,
        status: "Pending",
        due_date: newTask.deadline || null,
        start_date: newTask.startDate || null,
        priority: frontendToBackendPriority[newTask.priority],
        assigned_to_ids: assigneeIdsNormalized,
        project_id: newTask.projectId ? Number(newTask.projectId) : null,
      };

      // Call POST /tasks/bulk with the new data structure
      const createdTasks: BackendTask[] =
        await apiService.assignBulkTasks(payload);

      const convertedTasks = (
        Array.isArray(createdTasks) ? createdTasks : []
      ).map(mapBackendTaskToFrontend);

      // Add all newly created tasks to local state
      setTasks((prev) => [...convertedTasks, ...prev]);

      // Also update project tasks if they belong to a project and that project is already loaded/expanded
      convertedTasks.forEach(task => {
        if (task.projectId) {
          setProjects(prev => prev.map(p => {
            const pid = p.project_id || p.id;
            if (String(pid) === String(task.projectId)) {
              const existingTasks = p.tasks || [];
              const taskExists = existingTasks.some(et => String(et.id) === String(task.id));
              if (taskExists) return p;
              return {
                ...p,
                tasks: [task, ...existingTasks],
                task_count: (p.task_count || 0) + 1
              };
            }
            return p;
          }));
        }
      });

      // Send notifications for each created task
      convertedTasks.forEach((convertedTask) => {
        if (convertedTask.assignedTo[0] && userId) {
          if (convertedTask.assignedTo[0] !== userId) {
            addNotification({
              title: "New Task Assigned",
              message: `${user.name} assigned you a new task: "${convertedTask.title}"`,
              type: "task",
              metadata: {
                taskId: convertedTask.id,
                requesterId: user.id,
                requesterName: user.name,
              },
            });
          } else {
            addNotification({
              title: "Task Created",
              message: `You created a new task: "${convertedTask.title}" - Due: ${convertedTask.deadline || "No deadline"}`,
              type: "task",
              metadata: {
                taskId: convertedTask.id,
                requesterId: user.id,
                requesterName: user.name,
              },
            });
          }
        }
      });

      toast({
        title: "Tasks Created",
        description: `Successfully created ${convertedTasks.length} task(s).`,
      });

      setIsCreateDialogOpen(false);
      setNewTask({
        title: "",
        description: "",
        assignedTo: [],
        priority: "medium",
        startDate: "",
        deadline: "",
        department: "",
        employeeId: "",
        projectId: "",
      });
      setAssigneeSearchQuery("");
    } catch (err: unknown) {
      console.error("Failed to create tasks via POST bulk endpoint", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to create tasks. Please try again.";
      toast({
        title: "Task creation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPassDialog = useCallback(
    (task: TaskWithPassMeta) => {
      setPassTaskTarget(task);
      const eligible = passEligibleEmployees;
      const fallbackAssignee = eligible.find(
        (emp) => emp.userId === task.assignedTo[0],
      );
      if (fallbackAssignee) {
        setPassAssignee(fallbackAssignee.userId);
      } else if (eligible.length > 0) {
        setPassAssignee(eligible[0].userId);
      } else {
        setPassAssignee("");
      }
      setPassNote("");
      setIsPassDialogOpen(true);
    },
    [passEligibleEmployees],
  );

  const closePassDialog = useCallback(() => {
    setIsPassDialogOpen(false);
    setPassTaskTarget(null);
    setPassAssignee("");
    setPassNote("");
    setIsPassingTask(false);
  }, []);

  const handlePassTask = useCallback(async () => {
    if (!passTaskTarget || !authToken) {
      toast({
        title: "Unable to pass task",
        description: "Authentication missing or task not selected.",
        variant: "destructive",
      });
      return;
    }

    if (!passAssignee) {
      toast({
        title: "Select assignee",
        description: "Please choose a team member to pass the task to.",
        variant: "destructive",
      });
      return;
    }

    setIsPassingTask(true);
    try {
      const payload = {
        new_assignee_id: Number(passAssignee),
        note: passNote.trim() || undefined,
      };

      const updatedTask: BackendTask = await apiService.passTask(passTaskTarget.id, payload);
      const converted = mapBackendTaskToFrontend(updatedTask);
      setTasks((prev) =>
        prev.map((task) => (task.id === converted.id ? converted : task)),
      );
      setSelectedTask((prev) =>
        prev && prev.id === converted.id ? converted : prev,
      );

      setProjects(prev => prev.map(p => {
        const pid = String(p.project_id || p.id);
        if (converted.projectId && String(pid) === String(converted.projectId)) {
          return {
            ...p,
            tasks: (p.tasks || []).map(t => String(t.id) === String(converted.id) ? converted : t)
          };
        }
        return p;
      }));

      await fetchAndStoreHistory(converted.id);

      // ✅ Trigger notification for the new assignee
      if (
        converted.assignedTo[0] &&
        user &&
        converted.assignedTo[0] !== user.id
      ) {
        addNotification({
          title: "Task Passed to You",
          message: `${user.name} passed you the task: "${converted.title}"${passNote ? ` - Note: ${passNote}` : ""}`,
          type: "task",
          metadata: {
            taskId: converted.id,
            requesterId: user.id,
            requesterName: user.name,
          },
        });
      }

      toast({
        title: "Task passed successfully",
        description: `Task is now assigned to ${getAssigneeLabel(converted.assignedTo[0] || "")}.`,
      });

      closePassDialog();
    } catch (error) {
      console.error("Failed to pass task", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to pass the task. Please try again.";
      toast({
        title: "Task pass failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsPassingTask(false);
    }
  }, [
    authToken,
    authorizedHeaders,
    closePassDialog,
    fetchAndStoreHistory,
    getAssigneeLabel,
    passAssignee,
    passNote,
    passTaskTarget,
    toast,
    user,
    addNotification,
  ]);

  // Task Comments Functions
  const loadTaskComments = useCallback(async (taskId: number) => {
    setIsLoadingComments(true);
    try {
      const data = await apiService.getTaskComments(taskId);
      setTaskComments(data || []);
    } catch (error) {
      console.error("Failed to load comments:", error);
      // Silently handle errors - user may not have access to this task's comments
      // This can happen when viewing a task they don't have access to
      setTaskComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  }, []);

  // Optimized function to sync comments without blinking - only adds new comments
  const syncTaskComments = useCallback(async (taskId: number) => {
    try {
      const data = await apiService.getTaskComments(taskId);
      if (!data) return;

      // Only update if there are new comments (compare by ID)
      setTaskComments((prevComments) => {
        const existingIds = new Set(prevComments.map((c) => c.id));
        const newComments = data.filter((c) => !existingIds.has(c.id));

        // If there are new comments, add them without replacing the entire list
        if (newComments.length > 0) {
          return [...prevComments, ...newComments];
        }

        // If no new comments, return the same reference to prevent re-renders
        return prevComments;
      });
    } catch (error) {
      console.error("Failed to sync comments:", error);
      // Silently fail - don't disrupt the user experience
    }
  }, []);

  const handlePostComment = useCallback(async () => {
    if ((!newComment.trim() && attachedFiles.length === 0) || !selectedTask)
      return;

    setIsPostingComment(true);
    try {
      // If there are files, send them one by one with the comment
      if (attachedFiles.length > 0) {
        for (let i = 0; i < attachedFiles.length; i++) {
          const file = attachedFiles[i];
          const commentText = i === 0 ? newComment.trim() : undefined; // Only send text with first file
          await apiService.addTaskComment(
            Number(selectedTask.id),
            commentText,
            file,
          );
        }
      } else {
        // Just text comment
        await apiService.addTaskComment(
          Number(selectedTask.id),
          newComment.trim(),
        );
      }

      setNewComment("");
      setAttachedFiles([]);

      // Sync comments immediately after posting (only adds new comments, no blinking)
      await syncTaskComments(Number(selectedTask.id));

      toast({
        title: "Success",
        description: "Comment posted successfully",
      });
      // Scroll to bottom after posting
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      console.error("Failed to post comment:", error);
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    } finally {
      setIsPostingComment(false);
    }
  }, [newComment, attachedFiles, selectedTask, toast, syncTaskComments]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        const newFiles = Array.from(files);
        setAttachedFiles((prev) => [...prev, ...newFiles]);
      }
    },
    [],
  );

  const removeAttachedFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      if (!selectedTask) return;

      try {
        await apiService.deleteTaskComment(Number(selectedTask.id), commentId);
        setTaskComments((prev) => prev.filter((c) => c.id !== commentId));
        toast({
          title: "Success",
          description: "Comment deleted successfully",
        });
      } catch (error) {
        console.error("Failed to delete comment:", error);
        toast({
          title: "Error",
          description: "Failed to delete comment",
          variant: "destructive",
        });
      }
    },
    [selectedTask, toast],
  );

  // Load comments when task is selected
  useEffect(() => {
    if (selectedTask) {
      loadTaskComments(Number(selectedTask.id));

      // Set up polling to sync new comments every 1 second for instant real-time updates
      // Uses syncTaskComments instead of loadTaskComments to avoid blinking
      const commentPollInterval = setInterval(() => {
        syncTaskComments(Number(selectedTask.id));
      }, 1000);

      return () => clearInterval(commentPollInterval);
    } else {
      setTaskComments([]);
      setNewComment("");
    }
  }, [selectedTask, loadTaskComments, syncTaskComments]);

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    if (taskComments.length > 0) {
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [taskComments]);

  const resetEditState = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditingTask(null);
    setEditTaskForm({
      title: "",
      description: "",
      assignedTo: "",
      startDate: "",
      deadline: "",
      priority: "medium",
      projectId: "",
    });
    setIsUpdatingTask(false);
  }, []);

  const handleEditClick = useCallback((task: TaskWithPassMeta) => {
    setEditingTask(task);
    setEditTaskForm({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo[0] || "",
      startDate: formatDateForInput(task.startDate),
      deadline: formatDateForInput(task.deadline),
      priority: task.priority || "medium",
      projectId: task.projectId ? String(task.projectId) : "",
    });
    setIsEditDialogOpen(true);
  }, []);

  const handleReassignClick = useCallback((task: TaskWithPassMeta) => {
    setReassignTask(task);
    // Set default deadline and start date
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];
    const existingDeadline = formatDateForInput(task.deadline);
    const existingStartDate = formatDateForInput(task.startDate);

    const defaultDeadline =
      existingDeadline && new Date(existingDeadline) >= today
        ? existingDeadline
        : todayString;

    setReassignForm({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo[0] || "",
      startDate: existingStartDate || todayString,
      deadline: defaultDeadline,
      priority: task.priority,
      projectId: task.projectId ? String(task.projectId) : "",
    });
    setIsReassignDialogOpen(true);
  }, []);

  const resetReassignState = useCallback(() => {
    setIsReassignDialogOpen(false);
    setReassignTask(null);
    setReassignForm({
      title: "",
      description: "",
      assignedTo: "",
      startDate: new Date().toISOString().split("T")[0],
      deadline: new Date().toISOString().split("T")[0], // Reset to today's date
      priority: "medium",
      projectId: "",
    });
    setIsReassigning(false);
  }, []);

  const handleReassignTask = useCallback(async () => {
    if (!reassignTask) return;
    if (!authToken) {
      toast({
        title: "Authentication required",
        description: "Please log in again to reassign tasks.",
        variant: "destructive",
      });
      return;
    }

    // Validate deadline is not in the past
    if (reassignForm.deadline) {
      const selectedDate = new Date(reassignForm.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

      if (selectedDate < today) {
        toast({
          title: "Invalid deadline",
          description:
            "Task deadline cannot be in the past. Please select today or a future date.",
          variant: "destructive",
        });
        return;
      }
    }

    const trimmedTitle = reassignForm.title.trim();
    const trimmedDescription = reassignForm.description.trim();
    if (!trimmedTitle) {
      toast({
        title: "Title required",
        description: "Task title cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (!trimmedDescription) {
      toast({
        title: "Description required",
        description: "Task description cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (!reassignForm.assignedTo) {
      toast({
        title: "Assignee required",
        description: "Please choose who the task should be assigned to.",
        variant: "destructive",
      });
      return;
    }

    const assignedToNumber = Number(reassignForm.assignedTo);
    if (!Number.isFinite(assignedToNumber)) {
      toast({
        title: "Invalid assignee",
        description: "Unable to determine the selected assignee.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: trimmedDescription,
      assigned_to: assignedToNumber,
      start_date: reassignForm.startDate || null,
      due_date: reassignForm.deadline || null,
      priority: frontendToBackendPriority[reassignForm.priority || "medium"],
      status: "Pending", // Reset status to Pending when reassigning
      project_id: reassignForm.projectId
        ? Number(reassignForm.projectId)
        : null,
    };

    setIsReassigning(true);
    try {
      const updatedTask: BackendTask = await apiService.updateTask(reassignTask.id, payload);

      // Explicitly update status to 'Pending' (todo) via the dedicated status endpoint
      // This is necessary because the general update endpoint might not process status changes for overdue tasks
      try {
        await apiService.updateTaskStatus(reassignTask.id, "Pending", {
          title: trimmedTitle,
          assigned_to: assignedToNumber
        });
      } catch (statusError) {
        console.warn(
          "Failed to explicitly reset status during reassignment:",
          statusError,
        );
        // We continue anyway as the main update might have worked or we'll optimistic update locally
      }

      let converted = mapBackendTaskToFrontend(updatedTask);

      // Force status to 'todo' (Pending) in local state for immediate feedback
      converted = { ...converted, status: "todo" };

      setTasks((prev) =>
        prev.map((task) => (task.id === converted.id ? converted : task)),
      );
      setSelectedTask((prev) =>
        prev && prev.id === converted.id ? converted : prev,
      );

      await fetchAndStoreHistory(converted.id);

      // Send notification to the new assignee
      if (
        converted.assignedTo[0] &&
        userId &&
        converted.assignedTo[0] !== userId
      ) {
        addNotification({
          title: "Task Reassigned",
          message: `${user?.name} reassigned you a task: "${converted.title}"`,
          type: "task",
          metadata: {
            taskId: converted.id,
            requesterId: user?.id,
            requesterName: user?.name,
          },
        });
      }

      toast({
        title: "Task reassigned successfully",
        description: `Task "${converted.title}" has been reassigned to ${getAssigneeLabel(converted.assignedTo[0] || "")} and reset to To Do.`,
      });

      resetReassignState();
    } catch (error) {
      console.error("Failed to reassign task", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to reassign the task. Please try again.";
      toast({
        title: "Task reassignment failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsReassigning(false);
    }
  }, [
    authToken,
    authorizedHeaders,
    fetchAndStoreHistory,
    getAssigneeLabel,
    reassignForm,
    reassignTask,
    resetReassignState,
    toast,
    user,
    userId,
    addNotification,
  ]);

  const handleUpdateTask = useCallback(async () => {
    if (!editingTask) return;
    if (!authToken) {
      toast({
        title: "Authentication required",
        description: "Please log in again to update tasks.",
        variant: "destructive",
      });
      return;
    }

    // Validate deadline is required
    if (!editTaskForm.deadline) {
      toast({
        title: "Deadline required",
        description: "Please set a deadline for the task.",
        variant: "destructive",
      });
      return;
    }

    // Validate deadline is not in the past
    const selectedDate = new Date(editTaskForm.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

    if (selectedDate < today) {
      toast({
        title: "Invalid deadline",
        description:
          "Task deadline cannot be in the past. Please select today or a future date.",
        variant: "destructive",
      });
      return;
    }

    const trimmedTitle = editTaskForm.title.trim();
    const trimmedDescription = editTaskForm.description.trim();
    if (!trimmedTitle) {
      toast({
        title: "Title required",
        description: "Task title cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (!trimmedDescription) {
      toast({
        title: "Description required",
        description: "Task description cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    const currentAssignee = editingTask.assignedTo[0] || "";
    const nextAssignee = editTaskForm.assignedTo || currentAssignee;
    if (!nextAssignee) {
      toast({
        title: "Assignee required",
        description: "Please choose who the task should be assigned to.",
        variant: "destructive",
      });
      return;
    }

    const assignedToNumber = Number(nextAssignee);
    if (!Number.isFinite(assignedToNumber)) {
      toast({
        title: "Invalid assignee",
        description: "Unable to determine the selected assignee.",
        variant: "destructive",
      });
      return;
    }

    const payload: Record<string, unknown> = {
      task_id: Number(editingTask.id),
      title: trimmedTitle,
      description: trimmedDescription,
      assigned_to: assignedToNumber,
      priority: frontendToBackendPriority[editTaskForm.priority || editingTask.priority || "medium"],
      due_date: editTaskForm.deadline || null,
      start_date: editTaskForm.startDate || null,
      // Always send project_id — null when task has no project (API spec requires the field)
      project_id: editTaskForm.projectId
        ? Number(editTaskForm.projectId)
        : (editingTask.projectId ? Number(editingTask.projectId) : null),
    };

    setIsUpdatingTask(true);
    try {
      const updatedTask: BackendTask = await apiService.updateTask(editingTask.id, payload);
      const converted = mapBackendTaskToFrontend(updatedTask);
      setTasks((prev) =>
        prev.map((task) => (task.id === converted.id ? converted : task)),
      );
      setSelectedTask((prev) =>
        prev && prev.id === converted.id ? converted : prev,
      );

      setProjects(prev => prev.map(p => {
        const pid = String(p.project_id || p.id);
        const currentTasks = p.tasks || [];
        const taskExistsInThisProject = currentTasks.some(t => String(t.id) === String(converted.id));
        const belongsInThisProject = converted.projectId !== null &&
          converted.projectId !== undefined &&
          String(pid) === String(converted.projectId);

        if (taskExistsInThisProject && !belongsInThisProject) {
          // Task was moved to another project OR project was removed
          return {
            ...p,
            tasks: currentTasks.filter(t => String(t.id) !== String(converted.id)),
            task_count: Math.max(0, (p.task_count || 0) - 1)
          };
        } else if (!taskExistsInThisProject && belongsInThisProject) {
          // Task was moved from another project (or none) into this one
          return {
            ...p,
            tasks: [converted, ...currentTasks],
            task_count: (p.task_count || 0) + 1
          };
        } else if (taskExistsInThisProject && belongsInThisProject) {
          // Task is still in the same project, just update its data
          return {
            ...p,
            tasks: currentTasks.map(t => String(t.id) === String(converted.id) ? converted : t)
          };
        }
        return p;
      }));

      await fetchAndStoreHistory(converted.id);

      toast({
        title: "Task updated",
        description: `Task "${converted.title}" has been updated successfully.`,
      });

      resetEditState();
    } catch (error) {
      console.error("Failed to update task", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update the task. Please try again.";
      toast({
        title: "Task update failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingTask(false);
    }
  }, [
    authToken,
    authorizedHeaders,
    editTaskForm.deadline,
    editTaskForm.description,
    editTaskForm.assignedTo,
    editTaskForm.title,
    editingTask,
    fetchAndStoreHistory,
    resetEditState,
    toast,
  ]);

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (!authToken) {
        toast({
          title: "Authentication required",
          description: "Please log in again to delete tasks.",
          variant: "destructive",
        });
        return;
      }

      const confirmDelete = window.confirm(
        "Are you sure you want to delete this task?",
      );
      if (!confirmDelete) return;

      setDeletingTaskId(taskId);
      try {
        await apiService.deleteTask(taskId);

        setTasks((prev) => prev.filter((task) => task.id !== taskId));
        // Also remove from project tasks if present
        setProjects((prev) =>
          prev.map(p => {
            const pid = String(p.project_id || p.id);
            const currentProjectTasks = p.tasks || [];
            const taskExistsInProject = currentProjectTasks.some((t: any) => String(t.id || t.task_id) === taskId);

            if (taskExistsInProject) {
              return {
                ...p,
                tasks: currentProjectTasks.filter((t: any) => String(t.id || t.task_id) !== taskId),
                task_count: Math.max(0, (p.task_count || 0) - 1)
              };
            }
            return p;
          })
        );
        setSelectedTask((prev) => (prev && prev.id === taskId ? null : prev));
        setTaskHistory((prev) => {
          if (!(taskId in prev)) return prev;
          const next = { ...prev };
          delete next[taskId];
          return next;
        });

        toast({
          title: "Task deleted",
          description: "The task has been removed successfully.",
        });
      } catch (error) {
        console.error("Failed to delete task", error);
        const message =
          error instanceof Error
            ? error.message
            : "Unable to delete the task. Please try again.";
        toast({
          title: "Task deletion failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setDeletingTaskId(null);
      }
    },
    [authToken, authorizedHeaders, toast],
  );

  // Helper function to check if task is overdue
  const isTaskOverdue = useCallback((task: TaskWithPassMeta): boolean => {
    return task.status === "overdue";
  }, []);

  // Helper function to check if a status transition is allowed
  const isStatusTransitionAllowed = useCallback(
    (
      currentStatus: BaseTask["status"],
      newStatus: BaseTask["status"],
    ): boolean => {
      // 1. If task is overdue, it cannot be changed anymore
      if (currentStatus === "overdue") {
        return false;
      }

      // 2. All other transitions allowed
      return true;

      // Define status hierarchy
      const statusHierarchy: BaseTask["status"][] = [
        "todo",
        "in-progress",
        "overdue",
        "completed",
        "cancelled",
      ];
      const currentIndex = statusHierarchy.indexOf(currentStatus);
      const newIndex = statusHierarchy.indexOf(newStatus);

      // 2. Can always stay at current status
      if (currentStatus === newStatus) return true;

      // 3. Can move from 'todo' to 'in-progress' and back
      if (
        (currentStatus === "todo" && newStatus === "in-progress") ||
        (currentStatus === "in-progress" && newStatus === "todo")
      ) {
        return true;
      }

      // 4. Allow moving from 'overdue' to 'in-progress' or 'completed'
      if (currentStatus === "overdue") {
        return ["in-progress", "completed", "cancelled"].includes(newStatus);
      }

      // 5. Once completed or cancelled, can go back to 'in-progress' or 'todo' (reopening)
      if (currentStatus === "completed" || currentStatus === "cancelled") {
        return ["todo", "in-progress"].includes(newStatus);
      }

      // 6. Can move forward in hierarchy
      if (newIndex > currentIndex) {
        return true;
      }

      return false;
    },
    [normalizedUserRole],
  );

  // Check if task can be deleted/cancelled
  // Task can only be deleted by creator if status is 'todo' (not started)
  // Once assignee changes status to 'in-progress' or beyond, creator cannot delete
  const canDeleteTask = useCallback(
    (task: TaskWithPassMeta): boolean => {
      if (!userId) return false;

      // Creator and Admin/HR can delete
      const isCreator = task.assignedBy === userId;
      const isAdminOrHR = ["admin", "hr"].includes(normalizedUserRole);

      return isCreator || isAdminOrHR;
    },
    [userId, normalizedUserRole],
  );

  // Check if task can be reassigned
  // Task can be reassigned by creator if status is 'completed' or 'cancelled'
  const canReassignTask = useCallback(
    (task: TaskWithPassMeta): boolean => {
      if (!userId) return false;

      // Creator and Admin/HR can reassign
      const isCreator = task.assignedBy === userId;
      const isAdminOrHR = ["admin", "hr"].includes(normalizedUserRole);

      return isCreator || isAdminOrHR;
    },
    [userId, normalizedUserRole],
  );

  // Update task status
  const updateTaskStatus = async (
    taskId: string,
    newStatus: BaseTask["status"],
  ) => {
    setUpdatingTaskId(taskId);
    try {
      const backendStatus = frontendToBackendStatus[newStatus];

      const foundTask = tasks.find(t => t.id === taskId);
      // Guard: If task is overdue, block ANY change
      if (foundTask && (foundTask.status as string) === "overdue") {
        toast({
          title: "Status Locked",
          description: "Overdue tasks cannot be changed to any other status.",
          variant: "destructive"
        });
        setUpdatingTaskId(null);
        return;
      }

      // Find the task to get required backend fields (title + assigned_to)
      let taskTitle: string | undefined;
      let taskAssignedTo: string | undefined;
      if (foundTask) {
        taskTitle = foundTask.title;
        taskAssignedTo = foundTask.assignedTo?.[0] || String(foundTask.assignedBy || "");
      } else {
        // Search in projects as fallback
        for (const project of projects) {
          const ptask = (project.tasks || []).find((t: any) => String(t.id || t.task_id) === taskId);
          if (ptask) {
            taskTitle = ptask.title || ptask.task_name || ptask.taskTitle || "Task";
            taskAssignedTo = ptask.assignedTo?.[0] ?? String(ptask.assigned_to ?? ptask.user_id ?? "");
            break;
          }
        }
      }

      // Final fallback if still not found
      if (!taskTitle) taskTitle = "Task";
      if (taskAssignedTo === undefined) taskAssignedTo = "";

      const updatedTask: BackendTask = await apiService.updateTaskStatus(
        taskId,
        backendStatus,
        {
          title: taskTitle,
          assigned_to: taskAssignedTo,
          priority: foundTask?.priority || "Medium",
          description: foundTask?.description || ""
        }
      );
      const convertedTask = mapBackendTaskToFrontend(updatedTask);

      // Update tasks list immediately
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? convertedTask : task)),
      );

      // Update selected task if it's the one being updated
      setSelectedTask((prev) =>
        prev && prev.id === taskId ? convertedTask : prev,
      );

      // Also update project tasks if they belong to a project and are loaded
      setProjects(prev => prev.map(p => {
        const pid = String(p.project_id || p.id);
        if (convertedTask.projectId && String(pid) === String(convertedTask.projectId)) {
          return {
            ...p,
            tasks: (p.tasks || []).map(t => String(t.id) === String(convertedTask.id) ? convertedTask : t)
          };
        }
        return p;
      }));

      await fetchAndStoreHistory(convertedTask.id);

      toast({
        title: "Status updated successfully",
        description: `Task marked as ${newStatus.replace("-", " ")}`,
      });
    } catch (err: unknown) {
      console.error("Failed to update task status", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to update task status. Please try again.";
      toast({
        title: "Status update failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Get status color
  const getStatusColor = (status: BaseTask["status"]) => {
    switch (status) {
      case "todo":
        return "bg-slate-500";
      case "in-progress":
        return "bg-blue-500";
      case "overdue":
        return "bg-orange-500";
      case "completed":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  // Get priority color
  const getPriorityColor = (priority: BaseTask["priority"]) => {
    switch (priority) {
      case "low":
        return "bg-emerald-500 text-white";
      case "medium":
        return "bg-blue-500 text-white";
      case "high":
        return "bg-yellow-500 text-black";
      case "urgent":
        return "bg-red-500 text-white";
      default:
        return "bg-slate-400 text-white";
    }
  };

  // Capitalize priority text
  const capitalizePriority = (priority: BaseTask["priority"]) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  // Export function — calls backend API
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params: Parameters<typeof apiService.getTaskManagementReport>[0] =
        {};

      if (exportPeriodType !== "all") {
        params.period_type = exportPeriodType;
        if (exportPeriodType === "monthly") {
          params.month = Number(exportMonth);
          params.year = Number(exportYear);
        } else if (exportPeriodType === "quarterly") {
          params.quarter = Number(exportQuarter);
          params.year = Number(exportYear);
        } else if (exportPeriodType === "custom") {
          if (exportStartDate) params.start_date = exportStartDate;
          if (exportEndDate) params.end_date = exportEndDate;
        }
      }

      if (exportStatusFilter !== "all") {
        params.status = exportStatusFilter;
      }

      if (exportDepartmentFilter !== "all") {
        params.department = exportDepartmentFilter;
      }

      const blob = await apiService.getTaskManagementReport(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `task_management_report_${formatDateIST(new Date(), "yyyy-MM-dd")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Task Management Report downloaded as PDF.",
      });
      setIsExportDialogOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to export report. Please try again.";
      toast({
        title: "Export Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    exportPeriodType,
    exportMonth,
    exportQuarter,
    exportYear,
    exportStartDate,
    exportEndDate,
    exportStatusFilter,
    exportDepartmentFilter,
    toast,
  ]);

  return (
    <div className="w-full space-y-6">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800 rounded-2xl p-6 shadow-sm border-2 border-[#000000]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-[30px] font-black text-black dark:text-white tracking-tight">
              Task Management
            </h1>
            <p className="text-[14px] text-black dark:text-white font-medium mt-1">
              Efficiently organize, track, and manage all your tasks in one place
            </p>
          </div>
          <div className="flex items-center gap-3">


            {canAssignTasks() && (
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="h-9 px-6 rounded-full font-bold gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md text-white transition-all" style={{ fontSize: "14px" }}>
                    <Plus className="h-4 w-4" />
                    Create Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-2 shadow-2xl p-0">
                  <DialogHeader className="pb-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 -m-6 mb-0 p-6 rounded-t-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Plus className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-bold">
                          Create New Task
                        </DialogTitle>
                        <DialogDescription className="mt-1">
                          Assign a new task to team members
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="space-y-5 mt-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="title"
                        className="text-sm font-semibold flex items-center gap-2"
                      >
                        <div className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600"></div>
                        Task Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="title"
                        value={newTask.title}
                        onChange={(e) =>
                          setNewTask({
                            ...newTask,
                            title: e.target.value.replace(
                              /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                              "",
                            ),
                          })
                        }
                        placeholder="Enter task title"
                        className="h-11 border-2 focus:ring-2 focus:ring-violet-500 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="description"
                        className="text-sm font-semibold flex items-center gap-2"
                      >
                        <div className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600"></div>
                        Description <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="description"
                        value={newTask.description}
                        onChange={(e) =>
                          setNewTask({
                            ...newTask,
                            description: e.target.value.replace(
                              /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                              "",
                            ),
                          })
                        }
                        placeholder="Enter task description"
                        rows={4}
                        className="resize-none border-2 focus:ring-2 focus:ring-violet-500 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="priority"
                          className="text-sm font-semibold flex items-center gap-2"
                        >
                          <AlertCircle className="h-4 w-4 text-violet-600" />
                          Priority
                        </Label>
                        <Select
                          value={newTask.priority}
                          onValueChange={(value: BaseTask["priority"]) =>
                            setNewTask({ ...newTask, priority: value })
                          }
                        >
                          <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            className="border-2 shadow-xl"
                            side="bottom"
                          >
                            <SelectItem value="low" className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                Low
                              </div>
                            </SelectItem>
                            <SelectItem value="medium" className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                                Medium
                              </div>
                            </SelectItem>
                            <SelectItem value="high" className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                                High
                              </div>
                            </SelectItem>
                            <SelectItem value="urgent" className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                Urgent
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="startDate"
                          className="text-sm font-semibold flex items-center gap-2"
                        >
                          <Calendar className="h-4 w-4 text-violet-600" />
                          Start Date
                        </Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={newTask.startDate}
                          onChange={(e) =>
                            setNewTask({ ...newTask, startDate: e.target.value })
                          }
                          className="h-11 border-2 focus:ring-2 focus:ring-violet-500 transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="deadline"
                          className="text-sm font-semibold flex items-center gap-2"
                        >
                          <Calendar className="h-4 w-4 text-violet-600" />
                          Deadline <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="deadline"
                          type="date"
                          value={newTask.deadline}
                          onChange={(e) =>
                            setNewTask({ ...newTask, deadline: e.target.value })
                          }
                          className="h-11 border-2 focus:ring-2 focus:ring-violet-500 transition-all"
                        />
                      </div>
                    </div>

                    {canSeeAdminFilters && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="projectId"
                            className="text-sm font-semibold flex items-center gap-2"
                          >
                            <FileText className="h-4 w-4 text-violet-600" />
                            Project (Optional)
                          </Label>
                          <Select
                            value={newTask.projectId || "none"}
                            onValueChange={(value) =>
                              setNewTask({
                                ...newTask,
                                projectId: value === "none" ? "" : value,
                              })
                            }
                          >
                            <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                              <SelectValue placeholder="Select Project" />
                            </SelectTrigger>
                            <SelectContent className="border-2 shadow-xl" side="bottom">
                              <SelectItem value="none">None</SelectItem>
                              {projects.map((p: any) => (
                                <SelectItem key={p.project_id || p.id} value={(p.project_id || p.id)?.toString()}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {canSeeAdminFilters && normalizedUserRole !== "team_lead" && (
                        <>
                          <div className="space-y-2">
                            <Label
                              htmlFor="assignRoleFilter"
                              className="text-sm font-semibold flex items-center gap-2"
                            >
                              <Filter className="h-4 w-4 text-violet-600" />
                              Filter Role
                            </Label>
                            <Select
                              value={assignRoleFilter}
                              onValueChange={(value: "all" | UserRole) =>
                                setAssignRoleFilter(value)
                              }
                            >
                              <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                                <SelectValue placeholder="All Roles" />
                              </SelectTrigger>
                              <SelectContent
                                className="border-2 shadow-xl"
                                side="bottom"
                              >
                                <SelectItem value="all">All Roles</SelectItem>
                                {normalizedUserRole === "admin" && (
                                  <SelectItem value="hr">HR</SelectItem>
                                )}
                                {(normalizedUserRole === "admin" ||
                                  normalizedUserRole === "hr") && (
                                    <SelectItem value="manager">Manager</SelectItem>
                                  )}
                                <SelectItem value="team_lead">Team Lead</SelectItem>
                                <SelectItem value="employee">Employee</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label
                              htmlFor="assignDepartmentFilter"
                              className="text-sm font-semibold flex items-center gap-2"
                            >
                              <Building2 className="h-4 w-4 text-violet-600" />
                              Filter Department
                            </Label>
                            <Select
                              value={newTask.department || "all"}
                              onValueChange={(value) =>
                                setNewTask({
                                  ...newTask,
                                  department: value === "all" ? "" : value,
                                })
                              }
                            >
                              <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                                <SelectValue placeholder="All Departments" />
                              </SelectTrigger>
                              <SelectContent
                                className="border-2 shadow-xl"
                                side="bottom"
                              >
                                <SelectItem value="all">
                                  All Departments
                                </SelectItem>
                                {departmentOptions.map((dept) => (
                                  <SelectItem key={dept} value={dept}>
                                    {dept}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <Label
                          htmlFor="assignTo"
                          className="text-sm font-semibold flex items-center gap-2"
                        >
                          <User className="h-4 w-4 text-violet-600" />
                          Assign To <span className="text-red-500">*</span>
                        </Label>
                        {/* Show All Departments toggle removed as per request */}
                      </div>

                      {/* Assign To Filter / Search */}
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search employees by name, ID or email..."
                          className="pl-9 h-10 border-2 border-violet-100 focus:border-violet-500 transition-all text-sm rounded-xl"
                          value={assigneeSearchQuery}
                          onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                        />
                      </div>

                      <div className="border-2 rounded-xl max-h-[280px] overflow-y-auto bg-white dark:bg-gray-950 shadow-inner custom-scrollbar border-violet-50 relative">
                        {/* Select All Option */}
                        <div className="flex items-center space-x-3 pb-3 mb-2 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-gray-950 z-20 px-4 pt-3 shadow-sm">
                          <div className="flex items-center space-x-3 flex-1">
                            <Checkbox
                              id="select-all-employees"
                              checked={
                                canAssignToSelection
                                  .filter((emp) => emp.userId !== userId)
                                  .filter(
                                    (emp) =>
                                      assignRoleFilter === "all" ||
                                      emp.role === assignRoleFilter,
                                  )
                                  .filter(
                                    (emp) =>
                                      !newTask.department ||
                                      (emp.department &&
                                        emp.department
                                          .split(",")
                                          .map((d) => d.trim().toLowerCase())
                                          .includes(
                                            newTask.department
                                              .trim()
                                              .toLowerCase(),
                                          )),
                                  )
                                  .filter((emp) => {
                                    const search =
                                      assigneeSearchQuery.toLowerCase();
                                    return (
                                      emp.name.toLowerCase().includes(search) ||
                                      emp.email.toLowerCase().includes(search) ||
                                      emp.employeeId
                                        .toLowerCase()
                                        .includes(search)
                                    );
                                  })
                                  .every((emp) =>
                                    newTask.assignedTo.includes(emp.userId),
                                  ) &&
                                canAssignToSelection
                                  .filter((emp) => emp.userId !== userId)
                                  .filter(
                                    (emp) =>
                                      assignRoleFilter === "all" ||
                                      emp.role === assignRoleFilter,
                                  )
                                  .filter(
                                    (emp) =>
                                      !newTask.department ||
                                      (emp.department &&
                                        emp.department
                                          .split(",")
                                          .map((d) => d.trim().toLowerCase())
                                          .includes(
                                            newTask.department
                                              .trim()
                                              .toLowerCase(),
                                          )),
                                  )
                                  .filter((emp) => {
                                    const search =
                                      assigneeSearchQuery.toLowerCase();
                                    return (
                                      emp.name.toLowerCase().includes(search) ||
                                      emp.email.toLowerCase().includes(search) ||
                                      emp.employeeId
                                        .toLowerCase()
                                        .includes(search)
                                    );
                                  }).length > 0
                              }
                              onCheckedChange={(checked) => {
                                const filteredEmps = canAssignToSelection
                                  .filter((emp) => emp.userId !== userId)
                                  .filter(
                                    (emp) =>
                                      assignRoleFilter === "all" ||
                                      emp.role === assignRoleFilter,
                                  )
                                  .filter(
                                    (emp) =>
                                      !newTask.department ||
                                      (emp.department &&
                                        emp.department
                                          .split(",")
                                          .map((d) => d.trim().toLowerCase())
                                          .includes(
                                            newTask.department
                                              .trim()
                                              .toLowerCase(),
                                          )),
                                  )
                                  .filter((emp) => {
                                    const search =
                                      assigneeSearchQuery.toLowerCase();
                                    return (
                                      emp.name.toLowerCase().includes(search) ||
                                      emp.email.toLowerCase().includes(search) ||
                                      emp.employeeId
                                        .toLowerCase()
                                        .includes(search)
                                    );
                                  });

                                if (checked) {
                                  const newIds = Array.from(
                                    new Set([
                                      ...newTask.assignedTo,
                                      ...filteredEmps.map((e) => e.userId),
                                    ]),
                                  );
                                  setNewTask((prev) => ({
                                    ...prev,
                                    assignedTo: newIds,
                                  }));
                                } else {
                                  const idsToRemove = filteredEmps.map(
                                    (e) => e.userId,
                                  );
                                  setNewTask((prev) => ({
                                    ...prev,
                                    assignedTo: prev.assignedTo.filter(
                                      (id) => !idsToRemove.includes(id),
                                    ),
                                  }));
                                }
                              }}
                            />
                            <Label
                              htmlFor="select-all-employees"
                              className="text-sm cursor-pointer font-bold text-violet-600 dark:text-violet-400"
                            >
                              Select All Visible
                            </Label>
                          </div>
                          <span className="text-[10px] bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 px-2 py-0.5 rounded-full font-bold">
                            {newTask.assignedTo.length} Selected
                          </span>
                        </div>

                        {/* Current User (Self) */}
                        {userId &&
                          user &&
                          canAssignToSelection.some((e) => e.userId === userId) &&
                          (!assigneeSearchQuery ||
                            user.name
                              .toLowerCase()
                              .includes(assigneeSearchQuery.toLowerCase()) ||
                            user.email
                              .toLowerCase()
                              .includes(assigneeSearchQuery.toLowerCase())) && (
                            <div className="flex items-center space-x-3 py-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                              <Checkbox
                                id={`emp-${userId}`}
                                checked={newTask.assignedTo.includes(userId)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewTask((prev) => ({
                                      ...prev,
                                      assignedTo: [...prev.assignedTo, userId],
                                    }));
                                  } else {
                                    setNewTask((prev) => ({
                                      ...prev,
                                      assignedTo: prev.assignedTo.filter(
                                        (id) => id !== userId,
                                      ),
                                    }));
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`emp-${userId}`}
                                className="text-sm cursor-pointer font-semibold flex-1 flex items-center justify-between"
                              >
                                <span>
                                  {user.name}{" "}
                                  <span className="text-violet-500 font-bold ml-1">
                                    (Self)
                                  </span>
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                  {formatRoleLabel(normalizedUserRole)}
                                </span>
                              </Label>
                            </div>
                          )}

                        {/* Filtered Employees List */}
                        {canAssignToSelection
                          .filter((emp) => emp.userId !== userId)
                          .filter(
                            (emp) =>
                              assignRoleFilter === "all" ||
                              emp.role === assignRoleFilter,
                          )
                          .filter(
                            (emp) =>
                              !newTask.department ||
                              (emp.department &&
                                emp.department
                                  .split(",")
                                  .map((d) => d.trim().toLowerCase())
                                  .includes(
                                    newTask.department.trim().toLowerCase(),
                                  )),
                          )
                          .filter((emp) => {
                            const search = assigneeSearchQuery.toLowerCase();
                            return (
                              emp.name.toLowerCase().includes(search) ||
                              emp.email.toLowerCase().includes(search) ||
                              emp.employeeId.toLowerCase().includes(search)
                            );
                          })
                          .map((emp) => (
                            <div
                              key={emp.userId}
                              className="flex items-center space-x-3 py-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                            >
                              <Checkbox
                                id={`emp-${emp.userId}`}
                                checked={newTask.assignedTo.includes(emp.userId)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewTask((prev) => ({
                                      ...prev,
                                      assignedTo: [
                                        ...prev.assignedTo,
                                        emp.userId,
                                      ],
                                    }));
                                  } else {
                                    setNewTask((prev) => ({
                                      ...prev,
                                      assignedTo: prev.assignedTo.filter(
                                        (id) => id !== emp.userId,
                                      ),
                                    }));
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`emp-${emp.userId}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {emp.name}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground uppercase tracking-widest font-semibold">
                                    {formatRoleLabel(emp.role)}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                  {emp.department && (
                                    <span className="flex items-center gap-1">
                                      <Building2 className="h-2.5 w-2.5 text-violet-400" />
                                      {emp.department}
                                    </span>
                                  )}
                                  {emp.employeeId && (
                                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded italic border border-slate-200 dark:border-slate-700">
                                      ID: {emp.employeeId}
                                    </span>
                                  )}
                                </div>
                              </Label>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                      <Button
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                        className="h-11 px-6 border-2 hover:shadow-lg hover:border-slate-400 dark:hover:border-slate-600 transition-all"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateTask}
                        disabled={isCreateDisabled}
                        className="h-11 px-6 gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-5 w-5" />
                        {isSubmitting ? "Creating..." : "Create Task"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeViewTab} onValueChange={(value) => setActiveViewTab(value as "all" | "project")} className="w-full">
        <TabsList
          className="grid w-full grid-cols-2 h-14 bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg p-1 gap-1 shadow-sm"
        >
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold text-black dark:text-white data-[state=inactive]:font-bold text-[14px] transition-all duration-300 rounded-md"
          >
            All Tasks
          </TabsTrigger>
          <TabsTrigger
            value="project"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold text-black dark:text-white data-[state=inactive]:font-bold text-[14px] transition-all duration-300 rounded-md"
          >
            Project Tasks
          </TabsTrigger>

        </TabsList>



        <TabsContent value="all" className="space-y-6 mt-6">
          {/* Stats Cards - Clickable Filters */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            {[
              {
                title: "Total Tasks",
                value: taskCountsByStatus.total,
                icon: ListTodo,
                iconColor: "text-slate-600",
                iconBg: "bg-slate-100",
                statusKey: "all",
              },
              {
                title: "In Progress",
                value: taskCountsByStatus.inProgress,
                icon: Clock,
                iconColor: "text-blue-600",
                iconBg: "bg-blue-100",
                statusKey: "in-progress",
              },
              {
                title: "Completed",
                value: taskCountsByStatus.completed,
                icon: CheckCircle2,
                iconColor: "text-green-600",
                iconBg: "bg-green-100",
                statusKey: "completed",
              },
              {
                title: "Overdue",
                value: taskCountsByStatus.overdue,
                icon: AlertCircle,
                iconColor: "text-rose-600",
                iconBg: "bg-rose-100",
                statusKey: "overdue",
              },
              {
                title: "Cancelled",
                value: taskCountsByStatus.cancelled,
                icon: XCircle,
                iconColor: "text-slate-600",
                iconBg: "bg-slate-100",
                statusKey: "cancelled",
              },
            ].map((stat, i) => (
              <SummaryCard
                key={i}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                iconColor={stat.iconColor}
                iconBg={stat.iconBg}
                onClick={() => {
                  setFilterStatus(stat.statusKey as any);
                  if (stat.statusKey === "overdue") setIsOverdueFilterActive(true);
                  else setIsOverdueFilterActive(false);
                }}
              />
            ))}
          </div>


          {/* Filters and Search */}
          <Card className="border-2 border-[#000000] shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="border-b-2 border-[#000000] bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 pb-6">
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-950 dark:bg-slate-50 flex items-center justify-center">
                    <Filter className="h-5 w-5 text-white dark:text-black" />
                  </div>
                  <CardTitle className="text-[20px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>
                    All Tasks Filters
                  </CardTitle>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-2">
                      <Label className="text-[14px] font-black text-black dark:text-white" style={{}}>
                        Search
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-black dark:text-white" />
                        <Input
                          className="pl-9 w-full sm:w-[200px] h-11 bg-white dark:bg-gray-950 border-2 border-black/20 dark:border-white/20 text-[14px] text-black dark:text-white font-medium focus:ring-1 focus:ring-black rounded-lg shadow-sm"
                          placeholder="Search tasks..."
                          style={{}}
                          value={searchQuery}
                          onChange={(e) =>
                            setSearchQuery(
                              e.target.value.replace(
                                /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                                "",
                              ),
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-[14px] font-black text-black dark:text-white" style={{}}>
                        Status
                      </Label>
                      <Select value={filterStatus} onValueChange={(val) => {
                        setFilterStatus(val);
                        setIsOverdueFilterActive(val === "overdue");
                      }}>
                        <SelectTrigger className="w-full sm:w-[150px] h-11 bg-white dark:bg-gray-950 border-2 border-black/20 dark:border-white/20 rounded-lg shadow-sm" style={{ color: '#000000', fontSize: '14px' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-[14px] font-black text-black dark:text-white" style={{}}>
                        Task Filter
                      </Label>
                      <Select
                        value={taskOwnershipFilter}
                        onValueChange={(val: any) => {
                          setTaskOwnershipFilter(val);
                          if (val === "all") setSelectedDepartmentFilter("all");
                          setIsOverdueFilterActive(false);
                        }}
                      >
                        <SelectTrigger className="w-full sm:w-[150px] h-11 bg-white dark:bg-gray-950 border-2 border-black/20 dark:border-white/20 rounded-lg shadow-sm" style={{ color: '#000000', fontSize: '14px' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(normalizedUserRole === "admin" ||
                            normalizedUserRole === "hr" ||
                            normalizedUserRole === "manager" ||
                            normalizedUserRole === "team_lead") && (
                              <SelectItem value="all">All Tasks</SelectItem>
                            )}
                          {(normalizedUserRole === "admin" ||
                            normalizedUserRole === "hr" ||
                            normalizedUserRole === "manager" ||
                            normalizedUserRole === "team_lead" ||
                            normalizedUserRole === "employee") && (
                              <SelectItem value="created">Created Tasks</SelectItem>
                            )}
                          {(normalizedUserRole === "hr" ||
                            normalizedUserRole === "manager" ||
                            normalizedUserRole === "team_lead" ||
                            normalizedUserRole === "employee") && (
                              <SelectItem value="received">Received Tasks</SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="flex flex-col gap-2">
                      <Label className="text-[14px] font-black text-black dark:text-white" style={{}}>View Mode</Label>
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border-2 border-black/10 dark:border-white/10 shadow-inner h-11">
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className={cn(
                            "rounded-lg h-full px-4 transition-all duration-200",
                            viewMode === "list"
                              ? "bg-gradient-to-r from-slate-900 to-black text-white shadow-md font-black"
                              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                          )}
                        >
                          <ListTodo className="h-4 w-4 mr-2" />
                          List
                        </Button>
                        <Button
                          variant={viewMode === "grid" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("grid")}
                          className={cn(
                            "rounded-lg h-full px-4 transition-all duration-200",
                            viewMode === "grid"
                              ? "bg-gradient-to-r from-slate-900 to-black text-white shadow-md font-black"
                              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                          )}
                        >
                          <Grid3x3 className="h-4 w-4 mr-2" />
                          Grid
                        </Button>
                      </div>
                    </div>

                    {/* Export Buttons */}
                    {user && (
                      <div className="flex flex-col gap-2">
                        <Label className="text-[14px] font-black text-black dark:text-white" style={{}}>Actions</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsExportDialogOpen(true)}
                          className="gap-2 h-11 bg-white dark:bg-gray-950 border-2 border-black/20 dark:border-white/20 text-black dark:text-white text-[14px] font-black hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-200 rounded-lg shadow-sm px-6"
                          style={{}}
                        >
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {viewMode === "list" ? (
                <div className="space-y-6">
                  <div className="rounded-xl border-2 border-[#000000] shadow-lg overflow-hidden bg-white dark:bg-gray-950">
                    <div className="w-full overflow-x-auto pb-4 [&>div]:border-0 [&>div]:shadow-none [&>div]:rounded-none">
                      <Table>
                        <TableHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-b-2 border-black/10">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>TASK</TableHead>
                            <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>ASSIGNED BY</TableHead>
                            <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>ASSIGNED TO</TableHead>
                            <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>PRIORITY</TableHead>
                            <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>DEADLINE</TableHead>
                            <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>STATUS</TableHead>
                            <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>PASS</TableHead>
                            <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>ACTIONS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoadingTasks ? (
                            <TableRow>
                              <TableCell
                                colSpan={9}
                                className="text-center py-8 text-muted-foreground"
                              >
                                Loading tasks...
                              </TableCell>
                            </TableRow>
                          ) : visibleTasks.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={9}
                                className="text-center py-8 text-muted-foreground"
                              >
                                {taskOwnershipFilter === "all"
                                  ? "No tasks found in the system"
                                  : taskOwnershipFilter === "created"
                                    ? normalizedUserRole === "admin"
                                      ? "No tasks created yet. Create your first task to get started."
                                      : "No tasks created by you yet"
                                    : "No tasks assigned to you yet"}
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedTasks.map((task) => {
                              const assignedByInfo = getAssignedByInfo(
                                task.assignedBy,
                                task.assignedByRole,
                                task.assignedByName,
                              );
                              const assignedToInfo = getAssignedToInfo(
                                task.assignedTo[0] || "",
                                task.assignedToRole,
                              );
                              const isCreator = task.assignedBy === userId;
                              const canManageTask = Boolean(
                                userId && (isCreator || ["admin", "hr", "manager", "team_lead"].includes(normalizedUserRole)),
                              );
                              const isReceivedTask = Boolean(
                                userId && task.assignedTo.includes(userId),
                              );
                              // Creators can pass tasks too
                              const canPassTask =
                                (isReceivedTask || isCreator) &&
                                passEligibleEmployees.length > 0 &&
                                task.status !== "completed" &&
                                task.status !== "cancelled" &&
                                task.status !== "overdue";
                              const lastPassByLabel = task.lastPassedBy
                                ? getAssigneeLabel(task.lastPassedBy)
                                : null;
                              const lastPassToLabel = task.lastPassedTo
                                ? getAssigneeLabel(task.lastPassedTo)
                                : null;
                              const lastPassTimestamp = task.lastPassedAt
                                ? formatDateTimeIST(
                                  task.lastPassedAt,
                                  "MMM dd, yyyy HH:mm",
                                )
                                : null;
                              return (
                                <TableRow
                                  key={task.id}
                                  className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                >
                                  <TableCell
                                    className="cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    <div className="max-w-[300px] py-1">
                                      <div className="mb-1">
                                        <TruncatedText
                                          text={task.title}
                                          maxLength={40}
                                          showToggle={false}
                                          textClassName="text-[14px] font-bold text-black dark:text-white group-hover:underline transition-colors"
                                        />
                                      </div>
                                      <TruncatedText
                                        text={task.description}
                                        maxLength={80}
                                        showToggle={false}
                                        textClassName="text-[12px] text-black dark:text-slate-400 font-medium leading-relaxed"
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <UserCheck className="h-4 w-4 text-black dark:text-white" />
                                      <div className="flex flex-col">
                                        <span className="text-[14px] font-bold text-black dark:text-white" style={{}}>
                                          {assignedByInfo.name}
                                        </span>
                                        {assignedByInfo.roleLabel ? (
                                          <span className="text-[12px] text-black dark:text-slate-400 font-medium mt-0.5" style={{}}>
                                            {assignedByInfo.roleLabel}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4 text-black dark:text-white" />
                                      <div className="flex flex-col">
                                        <span className="text-[14px] font-bold text-black dark:text-white" style={{}}>
                                          {assignedToInfo.name}
                                        </span>
                                        {assignedToInfo.roleLabel ? (
                                          <span className="text-[12px] text-black dark:text-slate-400 font-medium mt-0.5" style={{}}>
                                            {assignedToInfo.roleLabel}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={cn(getPriorityColor(task.priority), "text-[12px] font-bold uppercase tracking-wider border-0 shadow-sm")}
                                      style={{}}
                                    >
                                      {capitalizePriority(task.priority)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2 text-black dark:text-white">
                                      <Calendar className="h-4 w-4" />
                                      <span className="text-[14px] font-bold" style={{}}>
                                        {formatDisplayDate(task.deadline)}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={task.status}
                                      onValueChange={(value: BaseTask["status"]) =>
                                        updateTaskStatus(task.id, value)
                                      }
                                      disabled={updatingTaskId === task.id || (task.status as string) === "overdue"}
                                    >
                                      <SelectTrigger
                                        className={`w-[170px] h-10 border-2 bg-white dark:bg-gray-950 px-3 transition-all text-[14px] font-bold text-black dark:text-white border-black/10 dark:border-white/10 shadow-sm`}
                                        style={{}}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor(task.status)} shadow-sm`} />
                                          <SelectValue />
                                        </div>
                                      </SelectTrigger>
                                      <SelectContent className="border-2 shadow-xl">
                                        <SelectItem value="todo" disabled={!isStatusTransitionAllowed(task.status, "todo")}>To Do</SelectItem>
                                        <SelectItem value="in-progress" disabled={!isStatusTransitionAllowed(task.status, "in-progress")}>In Progress</SelectItem>
                                        {task.status === "overdue" && (
                                          <SelectItem value="overdue" disabled>Overdue</SelectItem>
                                        )}
                                        <SelectItem value="completed" disabled={!isStatusTransitionAllowed(task.status, "completed")}>Completed</SelectItem>
                                        <SelectItem value="cancelled" disabled={!isStatusTransitionAllowed(task.status, "cancelled")}>Cancel Task</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    {task.lastPassedBy && task.lastPassedTo ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openPassHistoryDialog(task);
                                        }}
                                        className="h-8 px-3 gap-2 text-[14px] font-bold text-black dark:text-white border-black/10 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                                        style={{}}
                                      >
                                        <Share2 className="h-3.5 w-3.5" />
                                        View History
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div
                                      className={`flex flex-wrap items-center gap-2 ${task.status === "completed" ? "justify-center" : ""}`}
                                    >
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSelectedTask(task)}
                                        className="h-8 w-8 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                                        title="View task details"
                                      >
                                        👁
                                      </Button>
                                      {canPassTask && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => openPassDialog(task)}
                                          className="h-8 w-8 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                                          title="Pass task"
                                        >
                                          <Share2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {((task.status !== "completed" &&
                                        (task.status as string) !== "cancelled") || isCreator) &&
                                        canManageTask && (
                                          <>
                                            {(task.status as string) !==
                                              "overdue" && (
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleEditClick(task)}
                                                  className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                  title="Edit task"
                                                >
                                                  <Pencil className="h-4 w-4" />
                                                </Button>
                                              )}
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                handleDeleteTask(task.id)
                                              }
                                              disabled={
                                                deletingTaskId === task.id ||
                                                !canDeleteTask(task)
                                              }
                                              className="h-8 w-8 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                              title={
                                                !canDeleteTask(task)
                                                  ? "Cannot delete task once work has started"
                                                  : "Delete task"
                                              }
                                            >
                                              {deletingTaskId === task.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-4 w-4" />
                                              )}
                                            </Button>
                                          </>
                                        )}
                                      {canReassignTask(task) && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleReassignClick(task)}
                                          className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                                          title="Reassign task"
                                        >
                                          <RefreshCcw className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {visibleTasks.length > 0 && (
                      <div className="border-t-2 border-[#000000] px-6 py-4 w-full overflow-x-auto bg-slate-50 dark:bg-slate-900">
                        <Pagination
                          currentPage={taskCurrentPage}
                          totalPages={taskTotalPages}
                          totalItems={visibleTasks.length}
                          itemsPerPage={taskItemsPerPage}
                          onPageChange={setTaskCurrentPage}
                          onItemsPerPageChange={setTaskItemsPerPage}
                          showItemsPerPage={true}
                          showEntriesInfo={true}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {paginatedTasks.map((task) => {
                      const assignedByInfo = getAssignedByInfo(
                        task.assignedBy,
                        task.assignedByRole,
                        task.assignedByName,
                      );
                      const assignedToInfo = getAssignedToInfo(
                        task.assignedTo[0] || "",
                        task.assignedToRole,
                        task.assignedToName,
                      );
                      const isCreator = task.assignedBy === userId;
                      const canManageTask = Boolean(
                        userId && (isCreator || ["admin", "hr", "manager", "team_lead"].includes(normalizedUserRole)),
                      );
                      const isReceivedTask = Boolean(
                        userId && task.assignedTo.includes(userId),
                      );
                      // Creators can pass tasks too
                      const canPassTask =
                        (isReceivedTask || isCreator) &&
                        passEligibleEmployees.length > 0 &&
                        task.status !== "completed" &&
                        task.status !== "cancelled" &&
                        task.status !== "overdue";
                      const lastPassByLabel = task.lastPassedBy
                        ? getAssigneeLabel(task.lastPassedBy)
                        : null;
                      const lastPassToLabel = task.lastPassedTo
                        ? getAssigneeLabel(task.lastPassedTo)
                        : null;
                      return (
                        <Card
                          key={task.id}
                          className={`border-2 border-[#000000] transition-all duration-300 cursor-pointer transform hover:scale-[1.01] shadow-sm hover:shadow-xl group relative overflow-hidden ${isTaskOverdue(task)
                            ? "bg-rose-50/10 dark:bg-rose-900/10"
                            : "bg-white dark:bg-gray-950/50"
                            }`}
                          onClick={() => setSelectedTask(task)}
                        >
                          {/* Status Indicator Strip */}
                          <div
                            className={`absolute top-0 left-0 w-1 h-full ${task.status === "completed"
                              ? "bg-green-500"
                              : task.status === "cancelled"
                                ? "bg-red-500"
                                : task.status === "overdue"
                                  ? "bg-orange-500"
                                  : task.status === "in-progress"
                                    ? "bg-blue-500"
                                    : "bg-slate-400"
                              }`}
                          />

                          <CardHeader className="p-4 pb-0">
                            <div className="flex justify-between items-start gap-3">
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(getPriorityColor(task.priority), "text-[12px] px-1.5 h-5 border-0 font-bold uppercase tracking-wider")}
                                  >
                                    {task.priority}
                                  </Badge>
                                  {isTaskOverdue(task) && (
                                    <Badge className="bg-rose-500 text-white text-[12px] px-1.5 h-5 border-0 font-bold uppercase tracking-wider">
                                      Overdue
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[14px] font-black leading-tight pr-1 text-black dark:text-white" style={{}}>
                                  <TruncatedText
                                    text={task.title}
                                    maxLength={30}
                                    showToggle={false}
                                    textClassName="text-black dark:text-white"
                                  />
                                </div>
                              </div>
                              {/* Interactive Status Select */}
                              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Select
                                  value={task.status}
                                  onValueChange={(value: BaseTask["status"]) =>
                                    updateTaskStatus(task.id, value)
                                  }
                                  disabled={updatingTaskId === task.id || (task.status as string) === "overdue"}
                                >
                                  <SelectTrigger
                                    className="h-8 border-2 bg-white dark:bg-gray-950 px-2 transition-all text-[11px] font-bold text-black dark:text-white border-black/10 dark:border-white/10 shadow-sm w-auto min-w-[100px]"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <div className={`h-2 w-2 rounded-full ${getStatusColor(task.status)} shadow-sm`} />
                                      <SelectValue />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent className="border-2 shadow-xl">
                                    <SelectItem value="todo" disabled={!isStatusTransitionAllowed(task.status, "todo")}>To Do</SelectItem>
                                    <SelectItem value="in-progress" disabled={!isStatusTransitionAllowed(task.status, "in-progress")}>In Progress</SelectItem>
                                    {task.status === "overdue" && (
                                      <SelectItem value="overdue" disabled>Overdue</SelectItem>
                                    )}
                                    <SelectItem value="completed" disabled={!isStatusTransitionAllowed(task.status, "completed")}>Completed</SelectItem>
                                    <SelectItem value="cancelled" disabled={!isStatusTransitionAllowed(task.status, "cancelled")}>Cancel Task</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-4 pt-3 space-y-4">
                            <div className="text-[12px] text-black dark:text-slate-400 font-medium leading-relaxed" style={{}}>
                              <TruncatedText
                                text={
                                  task.description || "No description provided."
                                }
                                maxLength={70}
                                showToggle={false}
                              />
                            </div>

                            {/* Compact Metadata Grid */}
                            <div className="grid grid-cols-1 gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/50">
                              {/* Assignee Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-black dark:text-white font-medium text-[14px]" style={{}}>
                                  <User className="h-3.5 w-3.5" />
                                  <span>To:</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span
                                    className="text-[14px] font-black text-black dark:text-white truncate max-w-[120px]"
                                    style={{}}
                                    title={assignedToInfo.name}
                                  >
                                    {assignedToInfo.name}
                                  </span>
                                  {assignedToInfo.roleLabel && (
                                    <span className="text-[12px] text-black dark:text-slate-400 font-medium" style={{}}>
                                      {assignedToInfo.roleLabel}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Assigner Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-black dark:text-white font-medium text-[14px]" style={{}}>
                                  <UserCheck className="h-3.5 w-3.5" />
                                  <span>By:</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[14px] font-black text-black dark:text-white truncate max-w-[120px]" style={{}}>
                                    {assignedByInfo.name}
                                  </span>
                                  {assignedByInfo.roleLabel && (
                                    <span className="text-[12px] text-black dark:text-slate-400 font-medium" style={{}}>
                                      {assignedByInfo.roleLabel}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Deadline Row */}
                              <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-2 mt-0.5">
                                <div className="flex items-center gap-1.5 text-black dark:text-white font-medium text-[14px]" style={{}}>
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>Due:</span>
                                </div>
                                <span
                                  className={`text-[14px] font-black ${isTaskOverdue(task) ? "text-rose-600" : "text-black dark:text-white"}`}
                                  style={{}}
                                >
                                  {formatDisplayDate(task.deadline)}
                                </span>
                              </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between pt-1">
                              {/* Left Side: Pass History Info */}
                              <div className="flex items-center">
                                {task.lastPassedBy ? (
                                  <div
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-blue-600 text-[12px] font-black cursor-pointer hover:underline transition-all"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPassHistoryDialog(task);
                                    }}
                                    style={{}}
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                    View History
                                  </div>
                                ) : (
                                  <span className="text-[12px] text-black/40 font-medium">—</span>
                                )}
                              </div>

                              {/* Right Side: Action Buttons */}
                              <div className="flex items-center gap-1">
                                {/* View Details Button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTask(task);
                                  }}
                                  className="h-8 w-8 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="View task details"
                                >
                                  👁
                                </Button>

                                {/* Pass Button */}
                                {canPassTask && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPassDialog(task);
                                    }}
                                    className="h-8 w-8 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                                    title="Pass task"
                                  >
                                    ↪️
                                  </Button>
                                )}

                                {/* Edit Button */}
                                {((task.status !== "completed" &&
                                  (task.status as string) !== "cancelled") || isCreator) &&
                                  canManageTask &&
                                  ((task.status as string) !== "overdue" || isCreator) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(task);
                                      }}
                                      className="h-8 w-8 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                                      title="Edit Task"
                                    >
                                      ✏️
                                    </Button>
                                  )}

                                {/* Reassign Button */}
                                {canReassignTask(task) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReassignClick(task);
                                    }}
                                    className="h-8 w-8 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                                    title="Reassign Task"
                                  >
                                    🔄
                                  </Button>
                                )}

                                {/* Delete Button */}
                                {((task.status !== "completed" &&
                                  (task.status as string) !== "cancelled") || isCreator) &&
                                  canManageTask && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTask(task.id);
                                      }}
                                      disabled={
                                        deletingTaskId === task.id ||
                                        !canDeleteTask(task)
                                      }
                                      className="h-8 w-8 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                                      title={
                                        !canDeleteTask(task)
                                          ? "Cannot delete started task"
                                          : "Delete Task"
                                      }
                                    >
                                      {deletingTaskId === task.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        "🗑"
                                      )}
                                    </Button>
                                  )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  {visibleTasks.length > 0 && (
                    <div className="mt-6 px-2 w-full overflow-x-auto pb-2">
                      <Pagination
                        currentPage={taskCurrentPage}
                        totalPages={taskTotalPages}
                        totalItems={visibleTasks.length}
                        itemsPerPage={taskItemsPerPage}
                        onPageChange={setTaskCurrentPage}
                        onItemsPerPageChange={setTaskItemsPerPage}
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
        <TabsContent value="project" className="space-y-6 mt-6">
          <div className="space-y-6">
            {/* Project View Stats */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
              <Card onClick={() => { setFilterStatus("all"); setIsOverdueFilterActive(false); }} className={`border-2 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md ${filterStatus === "all" && !isOverdueFilterActive ? "border-slate-950 dark:border-slate-50 bg-slate-50 dark:bg-slate-800" : "border-2 border-[#000000] bg-white dark:bg-gray-950 hover:border-slate-400"}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="uppercase tracking-wider font-bold" style={{ color: '#000000', fontSize: '12px' }}>Total Tasks</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <ListTodo className="h-4 w-4 text-black dark:text-white" />
                  </div>
                </CardHeader>
                <CardContent><div className="font-bold" style={{ color: '#000000', fontSize: '24px', fontWeight: 'bold' }}>{projectCounts.total}</div></CardContent>
              </Card>
              <Card onClick={() => { setFilterStatus("todo"); setIsOverdueFilterActive(false); }} className={`border-2 border-[#000000] transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md ${filterStatus === "todo" ? "bg-slate-100 dark:bg-slate-800" : "bg-white dark:bg-gray-950 hover:bg-slate-50"}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="uppercase tracking-wider font-bold" style={{ color: '#000000', fontSize: '12px' }}>To Do</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-black dark:text-white" />
                  </div>
                </CardHeader>
                <CardContent><div className="font-bold" style={{ color: '#000000', fontSize: '24px', fontWeight: 'bold' }}>{projectCounts.todo}</div></CardContent>
              </Card>
              <Card onClick={() => { setFilterStatus("in-progress"); setIsOverdueFilterActive(false); }} className={`border-2 border-[#000000] transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md ${filterStatus === "in-progress" ? "bg-blue-50 dark:bg-blue-900/40" : "bg-white dark:bg-gray-950 hover:bg-slate-50"}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="uppercase tracking-wider font-bold" style={{ color: '#000000', fontSize: '12px' }}>In Progress</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent><div className="font-bold" style={{ color: '#000000', fontSize: '24px', fontWeight: 'bold' }}>{projectCounts.inProgress}</div></CardContent>
              </Card>
              <Card onClick={() => { setFilterStatus("completed"); setIsOverdueFilterActive(false); }} className={`border-2 border-[#000000] transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md ${filterStatus === "completed" ? "bg-green-50 dark:bg-green-900/40" : "bg-white dark:bg-gray-950 hover:bg-slate-50"}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="uppercase tracking-wider font-bold" style={{ color: '#000000', fontSize: '12px' }}>Completed</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                </CardHeader>
                <CardContent><div className="font-bold" style={{ color: '#000000', fontSize: '24px', fontWeight: 'bold' }}>{projectCounts.completed}</div></CardContent>
              </Card>
              <Card onClick={() => { setFilterStatus("overdue"); setIsOverdueFilterActive(true); }} className={`border-2 border-[#000000] transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md ${isOverdueFilterActive ? "bg-rose-50 dark:bg-rose-900/40" : "bg-white dark:bg-gray-950 hover:bg-slate-50"}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="uppercase tracking-wider font-bold" style={{ color: '#000000', fontSize: '12px' }}>Overdue</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                </CardHeader>
                <CardContent><div className="font-bold" style={{ color: '#000000', fontSize: '24px', fontWeight: 'bold' }}>{projectCounts.overdue}</div></CardContent>
              </Card>
              <Card onClick={() => { setFilterStatus("cancelled"); setIsOverdueFilterActive(false); }} className={`border-2 border-[#000000] transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md ${filterStatus === "cancelled" ? "bg-slate-100 dark:bg-slate-800" : "bg-white dark:bg-gray-950 hover:bg-slate-50"}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="uppercase tracking-wider font-bold" style={{ color: '#000000', fontSize: '12px' }}>Cancelled</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <XCircle className="h-4 w-4 text-black dark:text-white" />
                  </div>
                </CardHeader>
                <CardContent><div className="font-bold" style={{ color: '#000000', fontSize: '24px', fontWeight: 'bold' }}>{projectCounts.cancelled}</div></CardContent>
              </Card>
            </div>

            <Card className="border-2 border-[#000000] shadow-lg rounded-xl overflow-hidden">
              <CardHeader className="border-b-2 border-[#000000] bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 pb-6">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-4">
                    <div className="h-10 w-10 rounded-lg bg-slate-950 dark:bg-slate-50 flex items-center justify-center">
                      <Filter className="h-5 w-5 text-white dark:text-black" />
                    </div>
                    <CardTitle className="text-[20px] font-black text-black dark:text-white uppercase tracking-wider" style={{}}>Filter Projects</CardTitle>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-2">
                      <Label className="text-[14px] font-black text-black dark:text-white" style={{}}>Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black dark:text-white" />
                        <Input
                          className="pl-9 w-full sm:w-[200px] h-11 bg-white dark:bg-gray-950 border-2 border-black/20 dark:border-white/20 focus:ring-1 focus:ring-black rounded-lg shadow-sm"
                          placeholder="Search projects or tasks..."
                          style={{ color: '#000000', fontSize: '14px' }}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-[14px] font-black text-black dark:text-white" style={{}}>Status</Label>
                      <Select value={filterStatus} onValueChange={(val) => { setFilterStatus(val); setIsOverdueFilterActive(val === "overdue"); }}>
                        <SelectTrigger className="w-full sm:w-[150px] h-11 bg-white dark:bg-gray-950 border-2 border-black/20 dark:border-white/20 text-[14px] text-black dark:text-white font-medium rounded-lg shadow-sm" style={{}}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-[14px] font-black text-black dark:text-white" style={{}}>Ownership</Label>
                      <Select
                        value={taskOwnershipFilter}
                        onValueChange={(value: "all" | "received" | "created") =>
                          setTaskOwnershipFilter(value)
                        }
                      >
                        <SelectTrigger className="w-full sm:w-[150px] h-11 bg-white dark:bg-gray-950 border-2 border-black/20 dark:border-white/20 text-[14px] text-black dark:text-white font-medium rounded-lg shadow-sm" style={{}}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">Assigned to Me</SelectItem>
                          <SelectItem value="created">Created by Me</SelectItem>
                          <SelectItem value="all">Entire View</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {isProjectsLoading ? (
                  <div className="p-8 space-y-4">
                    {[1, 2, 3].map((i) => (<div key={i} className="h-24 w-full rounded-2xl bg-slate-50 dark:bg-slate-900 animate-pulse" />))}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="p-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed">
                    <FolderKanban className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold">No projects found</h3>
                    <p className="text-slate-500 mt-2">Adjust your filters or search query.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {paginatedProjects.map((project) => (
                        <div key={project.project_id} className="group transition-all">
                          <div className={`p-5 cursor-pointer rounded-2xl transition-all border-2 border-[#000000] ${project.isExpanded ? "bg-violet-50/50" : "bg-white hover:bg-slate-50"}`} onClick={() => toggleProject(project.project_id)}>
                            <div className="flex items-center justify-between gap-6">
                              <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className={`h-14 w-14 rounded-xl flex items-center justify-center transition-all shadow-md ${project.isExpanded ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white" : "bg-slate-100 text-slate-400 group-hover:text-violet-500"}`}>
                                  <FolderKanban className="h-7 w-7" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider">{project.name}</h4>
                                  <div className="flex flex-wrap items-center gap-4 mt-2">
                                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-full border-2 border-black/5" style={{ color: '#000000', fontSize: '12px' }}>
                                      <ClipboardList className="h-3.5 w-3.5" />
                                      {project.task_count} Tasks
                                    </div>
                                    <div className={`flex items-center gap-1.5 uppercase tracking-widest px-3 py-1 rounded-full border-2 ${(project.status || '').toLowerCase().includes('progress') ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-black/5'}`} style={{ fontSize: '12px', color: (project.status || '').toLowerCase().includes('progress') ? '#2563EB' : (project.status || '').toLowerCase().includes('completed') ? '#16A34A' : (project.status || '').toLowerCase().includes('cancelled') ? '#DC2626' : (project.status || '').toLowerCase().includes('archived') ? '#EAB308' : '#000000' }}>
                                      {project.status || 'Active'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {project.isExpanded ? <ChevronUp className="h-6 w-6 text-violet-600" /> : <ChevronDown className="h-6 w-6 text-slate-400" />}
                            </div>
                          </div>
                          {project.isExpanded && (
                            <div className="px-3 pb-8 pt-2 animate-in slide-in-from-top-4 duration-500">
                              <div className="bg-white dark:bg-gray-950 rounded-2xl border-2 border-[#000000] overflow-hidden shadow-xl">
                                <Table>
                                  <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b-2 border-black/10">
                                    <TableRow>
                                      <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider">TASK</TableHead>
                                      <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider">ASSIGNED BY</TableHead>
                                      <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider">ASSIGNED TO</TableHead>
                                      <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider">PRIORITY</TableHead>
                                      <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider">DEADLINE</TableHead>
                                      <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider">STATUS</TableHead>
                                      <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider">PASS</TableHead>
                                      <TableHead className="text-[14px] font-black text-black dark:text-white uppercase tracking-wider">ACTIONS</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {project.filteredTasks && project.filteredTasks.length > 0 ? (
                                      project.filteredTasks.map((task: any) => {
                                        const assignedByInfo = getAssignedByInfo(task.assignedBy, task.assignedByRole, task.assignedByName);
                                        const assignedToInfo = getAssignedToInfo(task.assignedTo[0] || "", task.assignedToRole, task.assignedToName);
                                        const isCreator = task.assignedBy === userId;
                                        const canManageTask = Boolean(userId && (isCreator || ["admin", "hr", "manager", "team_lead"].includes(normalizedUserRole)));
                                        const isReceivedTask = Boolean(userId && task.assignedTo.includes(userId));
                                        const canPassTask = (isReceivedTask || isCreator) && passEligibleEmployees.length > 0 &&
                                          task.status !== "completed" && task.status !== "cancelled" && task.status !== "overdue";

                                        return (
                                          <TableRow key={task.id} className="hover:bg-violet-50/30 cursor-pointer" onClick={() => setSelectedTask(task)}>
                                            <TableCell className="py-4">
                                              <div className="flex flex-col">
                                                <span className="text-[14px] font-bold text-black dark:text-white">{task.title}</span>
                                                {task.description && <span className="text-[12px] text-black dark:text-slate-400 font-medium line-clamp-2 mt-1">{task.description}</span>}
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex items-center gap-2">
                                                <UserCheck className="h-4 w-4 text-black/40" />
                                                <div className="flex flex-col">
                                                  <span className="text-[14px] font-bold text-black dark:text-white">{assignedByInfo.name}</span>
                                                  <span className="text-[10px] uppercase font-black text-black/40 tracking-widest">{assignedByInfo.roleLabel}</span>
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-black/40" />
                                                <div className="flex flex-col">
                                                  <span className="text-[14px] font-bold text-black dark:text-white">{assignedToInfo.name}</span>
                                                  <span className="text-[10px] uppercase font-black text-black/40 tracking-widest">{assignedToInfo.roleLabel}</span>
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant="outline" className={cn(getPriorityColor(task.priority), "text-[12px] font-black uppercase tracking-widest border-0 shadow-sm")}>
                                                {task.priority || 'Medium'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex items-center gap-2 text-black dark:text-white">
                                                <Calendar className="h-3.5 w-3.5 text-black/40" />
                                                <span className="text-[14px] font-bold">{task.deadline ? formatDateIST(task.deadline, "MMM dd, yyyy") : "No deadline"}</span>
                                              </div>
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                              <Select
                                                value={task.status}
                                                onValueChange={(value: BaseTask["status"]) =>
                                                  updateTaskStatus(task.id, value)
                                                }
                                                disabled={updatingTaskId === task.id || (task.status as string) === "overdue"}
                                              >
                                                <SelectTrigger
                                                  className={`w-[160px] h-9 border-2 bg-white dark:bg-gray-950 px-3 transition-all text-[14px] font-bold text-black dark:text-white border-black/10 dark:border-white/10 shadow-sm`}
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <div className={`h-2 w-2 rounded-full ${getStatusColor(task.status)} shadow-sm`} />
                                                    <SelectValue />
                                                  </div>
                                                </SelectTrigger>
                                                <SelectContent className="border-2 shadow-xl">
                                                  <SelectItem value="todo" disabled={!isStatusTransitionAllowed(task.status, "todo")}>To Do</SelectItem>
                                                  <SelectItem value="in-progress" disabled={!isStatusTransitionAllowed(task.status, "in-progress")}>In Progress</SelectItem>
                                                  <SelectItem value="overdue" disabled={!isStatusTransitionAllowed(task.status, "overdue")}>Overdue</SelectItem>
                                                  <SelectItem value="completed" disabled={!isStatusTransitionAllowed(task.status, "completed")}>Completed</SelectItem>
                                                  <SelectItem value="cancelled" disabled={!isStatusTransitionAllowed(task.status, "cancelled")}>Cancel Task</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </TableCell>
                                            <TableCell>
                                              {task.lastPassedBy ? (
                                                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openPassHistoryDialog(task); }} className="h-8 px-3 gap-2 text-[12px] font-black text-blue-600 border-blue-100 hover:bg-blue-50 transition-all uppercase tracking-widest shadow-sm">
                                                  <Share2 className="h-3 w-3" />
                                                  History
                                                </Button>
                                              ) : <span className="text-[12px] text-black/20">—</span>}
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                              <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => setSelectedTask(task)} className="h-8 w-8 text-black dark:text-white hover:bg-slate-100" title="View details">👁</Button>
                                                {canPassTask && <Button variant="ghost" size="icon" onClick={() => openPassDialog(task)} className="h-8 w-8 text-black hover:bg-slate-100" title="Pass task"><Share2 className="h-4 w-4" /></Button>}
                                                {((task.status !== "completed" && task.status !== "cancelled") || isCreator) && canManageTask && (
                                                  <Button variant="ghost" size="icon" onClick={() => handleEditClick(task)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="Edit task"><Pencil className="h-4 w-4" /></Button>
                                                )}
                                                {canReassignTask(task) && (
                                                  <Button variant="ghost" size="icon" onClick={() => handleReassignClick(task)} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Reassign task"><RefreshCcw className="h-4 w-4" /></Button>
                                                )}
                                                {((task.status !== "completed" && task.status !== "cancelled") || isCreator) && canManageTask && canDeleteTask(task) && (
                                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} disabled={deletingTaskId === task.id} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete task">
                                                    {deletingTaskId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                  </Button>
                                                )}
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })
                                    ) : (
                                      <TableRow>
                                        <TableCell colSpan={8} className="h-40 text-center text-[14px] font-black text-black/40 uppercase tracking-widest">No matching tasks found in this project.</TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {filteredProjects.length > 0 && (
                      <div className="mt-8 border-t-2 border-black/5 pt-6 font-bold">
                        <Pagination
                          currentPage={projectCurrentPage}
                          totalPages={projectTotalPages}
                          totalItems={filteredProjects.length}
                          itemsPerPage={projectItemsPerPage}
                          onPageChange={setProjectCurrentPage}
                          onItemsPerPageChange={setProjectItemsPerPage}
                          showItemsPerPage={true}
                          showEntriesInfo={true}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div >
        </TabsContent >
      </Tabs >

      {/* Pass Task Dialog */}
      < Dialog
        open={isPassDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePassDialog();
          } else {
            setIsPassDialogOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-xl border-2 shadow-2xl">
          <DialogHeader className="pb-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 -m-6 mb-0 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Share2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  Pass Task
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Reassign this task to a lower hierarchy member
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-violet-600" />
                Select Assignee
              </Label>
              <Select value={passAssignee} onValueChange={setPassAssignee}>
                <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                  <SelectValue placeholder="Choose team member" />
                </SelectTrigger>
                <SelectContent className="border-2 shadow-xl max-h-96 overflow-auto">
                  {passEligibleEmployees.length === 0 && (
                    <div className="py-3 px-4 text-sm text-muted-foreground">
                      No eligible team members found.
                    </div>
                  )}
                  {Array.from(passEligibleByDepartment.entries()).map(
                    ([department, employees]) => (
                      <div key={department}>
                        <div className="px-2 py-2 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 sticky top-0 z-10 border-b">
                          {department}
                        </div>
                        {employees.map((emp) => (
                          <SelectItem
                            key={emp.userId}
                            value={emp.userId}
                            className="cursor-pointer pl-6"
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="font-medium">{emp.name}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-medium">
                                  {formatRoleLabel(emp.role)}
                                </span>
                                {emp.employeeId && (
                                  <span className="text-muted-foreground">
                                    {emp.employeeId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-600" />
                Reason / Notes
              </Label>
              <Textarea
                value={passNote}
                onChange={(e) =>
                  setPassNote(
                    e.target.value.replace(
                      /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                      "",
                    ),
                  )
                }
                placeholder="Add context about why you're passing the task or partial progress made"
                rows={4}
                className="resize-none border-2 focus:ring-2 focus:ring-violet-500 transition-all"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-6">
              <Button
                variant="outline"
                onClick={closePassDialog}
                className="h-11 px-6 border-2 hover:shadow-lg hover:border-slate-400 dark:hover:border-slate-600 transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePassTask}
                disabled={isPassingTask || !passAssignee}
                className="h-11 px-6 gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPassingTask ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Passing...
                  </>
                ) : (
                  "Pass Task"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetEditState();
          } else {
            setIsEditDialogOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 shadow-2xl">
          <DialogHeader className="pb-4 border-b bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950 dark:to-slate-950 -m-6 mb-0 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Pencil className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  Edit Task
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Update task details and assignment
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label
                htmlFor="edit-title"
                className="text-sm font-semibold flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                Task Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-title"
                value={editTaskForm.title}
                onChange={(e) =>
                  setEditTaskForm((prev) => ({
                    ...prev,
                    title: e.target.value.replace(
                      /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                      "",
                    ),
                  }))
                }
                placeholder="Enter task title"
                className="h-11 border-2 focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="edit-description"
                className="text-sm font-semibold flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="edit-description"
                value={editTaskForm.description}
                onChange={(e) =>
                  setEditTaskForm((prev) => ({
                    ...prev,
                    description: e.target.value.replace(
                      /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                      "",
                    ),
                  }))
                }
                placeholder="Enter task description"
                rows={4}
                className="resize-none border-2 focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="edit-assignTo"
                  className="text-sm font-semibold flex items-center gap-2"
                >
                  <User className="h-4 w-4 text-blue-600" />
                  Assign To
                </Label>
                <Select
                  value={editTaskForm.assignedTo || ""}
                  onValueChange={(value) =>
                    setEditTaskForm((prev) => ({ ...prev, assignedTo: value }))
                  }
                >
                  <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent className="border-2 shadow-xl">
                    {userId && user && canAssignToEdit.some(e => e.userId === userId) && (
                      <SelectItem value={userId} className="cursor-pointer">
                        {user.name} (Self)
                      </SelectItem>
                    )}
                    {canAssignToEdit
                      .filter((emp) => emp.userId !== userId)
                      .map((emp) => (
                        <SelectItem
                          key={emp.userId}
                          value={emp.userId}
                          className="cursor-pointer"
                        >
                          {emp.name}
                          {emp.department ? ` • ${emp.department}` : ""}
                          {emp.employeeId ? ` (${emp.employeeId})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="edit-startDate"
                  className="text-sm font-semibold flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Start Date
                </Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  value={editTaskForm.startDate}
                  onChange={(e) =>
                    setEditTaskForm((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="h-11 border-2 focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="edit-deadline"
                  className="text-sm font-semibold flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Deadline <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-deadline"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={editTaskForm.deadline}
                  onChange={(e) =>
                    setEditTaskForm((prev) => ({
                      ...prev,
                      deadline: e.target.value,
                    }))
                  }
                  className="h-11 border-2 focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="edit-priority"
                  className="text-sm font-semibold flex items-center gap-2"
                >
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  Priority
                </Label>
                <Select
                  value={editTaskForm.priority || "medium"}
                  onValueChange={(value: BaseTask["priority"]) =>
                    setEditTaskForm((prev) => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950 uppercase font-bold text-xs tracking-widest">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent className="border-2 shadow-xl">
                    <SelectItem value="low" className="text-blue-600 font-bold uppercase tracking-widest text-[10px]">Low</SelectItem>
                    <SelectItem value="medium" className="text-yellow-600 font-bold uppercase tracking-widest text-[10px]">Medium</SelectItem>
                    <SelectItem value="high" className="text-orange-600 font-bold uppercase tracking-widest text-[10px]">High</SelectItem>
                    <SelectItem value="urgent" className="text-red-600 font-bold uppercase tracking-widest text-[10px]">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {canSeeAdminFilters && (
                <div className="space-y-2">
                  <Label
                    htmlFor="edit-projectId"
                    className="text-sm font-semibold flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4 text-blue-600" />
                    Project (Optional)
                  </Label>
                  <Select
                    value={editTaskForm.projectId || "none"}
                    onValueChange={(value) =>
                      setEditTaskForm((prev) => ({
                        ...prev,
                        projectId: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                      <SelectValue placeholder="Select Project" />
                    </SelectTrigger>
                    <SelectContent className="border-2 shadow-xl" side="bottom">
                      <SelectItem value="none">None</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.project_id || p.id} value={(p.project_id || p.id)?.toString()}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-6">
              <Button
                variant="outline"
                onClick={resetEditState}
                className="h-11 px-6 border-2 hover:shadow-lg hover:border-slate-400 dark:hover:border-slate-600 transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTask}
                disabled={isUpdatingTask}
                className="h-11 px-6 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingTask ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Task Dialog */}
      <Dialog
        open={isReassignDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetReassignState();
          } else {
            setIsReassignDialogOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 shadow-2xl">
          <DialogHeader className="pb-4 border-b bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 -m-6 mb-0 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <RefreshCcw className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  Reassign Task
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Reassign this completed/cancelled task to someone else
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 p-6 -m-6 mt-0">
            <div className="space-y-4">
              <div>
                <Label htmlFor="reassign-title" className="text-sm font-medium">
                  Task Title
                </Label>
                <Input
                  id="reassign-title"
                  value={reassignForm.title}
                  onChange={(e) =>
                    setReassignForm((prev) => ({
                      ...prev,
                      title: e.target.value.replace(
                        /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                        "",
                      ),
                    }))
                  }
                  placeholder="Enter task title"
                  className="mt-1.5 h-11 bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400"
                />
              </div>

              <div>
                <Label
                  htmlFor="reassign-description"
                  className="text-sm font-medium"
                >
                  Description
                </Label>
                <Textarea
                  id="reassign-description"
                  value={reassignForm.description}
                  onChange={(e) =>
                    setReassignForm((prev) => ({
                      ...prev,
                      description: e.target.value.replace(
                        /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                        "",
                      ),
                    }))
                  }
                  placeholder="Describe the task requirements"
                  className="mt-1.5 min-h-[100px] bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="reassign-assignee"
                    className="text-sm font-medium"
                  >
                    Assign To
                  </Label>
                  <Select
                    value={reassignForm.assignedTo}
                    onValueChange={(value) =>
                      setReassignForm((prev) => ({
                        ...prev,
                        assignedTo: value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-11 bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400">
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {canAssignToReassign.map((employee) => (
                        <SelectItem
                          key={employee.userId}
                          value={employee.userId}
                        >
                          {employee.name} ({employee.role})
                          {employee.department && ` - ${employee.department}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label
                    htmlFor="reassign-priority"
                    className="text-sm font-medium"
                  >
                    Priority
                  </Label>
                  <Select
                    value={reassignForm.priority}
                    onValueChange={(value: BaseTask["priority"]) =>
                      setReassignForm((prev) => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-11 bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="reassign-startDate"
                    className="text-sm font-medium"
                  >
                    Start Date
                  </Label>
                  <Input
                    id="reassign-startDate"
                    type="date"
                    value={reassignForm.startDate}
                    onChange={(e) =>
                      setReassignForm((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="reassign-deadline"
                    className="text-sm font-medium"
                  >
                    Deadline
                  </Label>
                  <Input
                    id="reassign-deadline"
                    type="date"
                    value={reassignForm.deadline}
                    min={reassignForm.startDate || new Date().toISOString().split("T")[0]}
                    onChange={(e) =>
                      setReassignForm((prev) => ({
                        ...prev,
                        deadline: e.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400"
                  />
                </div>
              </div>

              {canSeeAdminFilters && (
                <div>
                  <Label
                    htmlFor="reassign-projectId"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4 text-green-600" />
                    Project (Optional)
                  </Label>
                  <Select
                    value={reassignForm.projectId || "none"}
                    onValueChange={(value) =>
                      setReassignForm((prev) => ({
                        ...prev,
                        projectId: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-11 bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400">
                      <SelectValue placeholder="Select Project" />
                    </SelectTrigger>
                    <SelectContent className="border-2 shadow-xl" side="bottom">
                      <SelectItem value="none">None</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.project_id || p.id} value={(p.project_id || p.id)?.toString()}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                variant="outline"
                onClick={resetReassignState}
                className="h-11 px-6 border-2 hover:shadow-lg hover:border-slate-400 dark:hover:border-slate-600 transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReassignTask}
                disabled={isReassigning}
                className="h-11 px-6 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReassigning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reassigning...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4" />
                    Reassign Task
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      {
        selectedTask && (
          <Dialog
            open={Boolean(selectedTask)}
            onOpenChange={() => setSelectedTask(null)}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="text-2xl font-bold whitespace-pre-wrap break-words">
                  {selectedTask.title}
                </DialogTitle>
                <DialogDescription>
                  Detailed view of task assignments and progress
                </DialogDescription>
              </DialogHeader>

              <Tabs
                defaultValue="details"
                className="mt-4 flex-1 flex flex-col overflow-hidden"
              >
                <TabsList className="grid grid-cols-3 gap-2 bg-muted/50 flex-shrink-0">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                </TabsList>

                <TabsContent
                  value="details"
                  className="mt-4 overflow-y-auto flex-1"
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-2 border-[#000000]">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-white" />
                          </div>
                          Description
                        </h4>
                        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {selectedTask.description}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border-2 border-[#000000] bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <UserCheck className="h-4 w-4 text-violet-600" />
                          Assigned By
                        </h4>
                        <p className="text-muted-foreground font-medium">
                          {selectedTaskAssignerInfo?.name || "Unknown"}
                          {selectedTaskAssignerInfo?.roleLabel && (
                            <span className="block text-xs text-muted-foreground">
                              {selectedTaskAssignerInfo.roleLabel}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border-2 border-[#000000] bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-violet-600" />
                          Assigned To
                        </h4>
                        <p className="text-muted-foreground font-medium">
                          {selectedTaskAssigneeInfo?.name || "Unassigned"}
                          {selectedTaskAssigneeInfo?.roleLabel && (
                            <span className="block text-xs text-muted-foreground">
                              {selectedTaskAssigneeInfo.roleLabel}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border-2 border-[#000000] bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-violet-600" />
                          Priority
                        </h4>
                        <Badge
                          className={getPriorityColor(selectedTask.priority)}
                        >
                          {capitalizePriority(selectedTask.priority)}
                        </Badge>
                      </div>

                      <div className="p-4 rounded-lg border-2 border-[#000000] bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-violet-600" />
                          Start Date
                        </h4>
                        <p className="text-muted-foreground font-medium">
                          {selectedTask.startDate
                            ? formatDateIST(
                              parseToIST(selectedTask.startDate) || new Date(),
                              "MMM dd, yyyy",
                            )
                            : "N/A"}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border-2 border-[#000000] bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-violet-600" />
                          Deadline
                        </h4>
                        <p className="text-muted-foreground font-medium">
                          {formatDisplayDate(selectedTask.deadline)}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border-2 border-[#000000] bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-violet-600" />
                          Assigned Date
                        </h4>
                        <p className="text-muted-foreground font-medium">
                          {selectedTask.createdAt
                            ? formatDateIST(
                              parseToIST(selectedTask.createdAt) || new Date(),
                              "MMM dd, yyyy",
                            )
                            : "N/A"}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border-2 border-[#000000] bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-violet-600" />
                          Status
                        </h4>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-3 w-3 rounded-full ${getStatusColor(selectedTask.status)} shadow-md`}
                          />
                          <span className="capitalize font-medium">
                            {selectedTask.status.replace("-", " ")}
                          </span>
                        </div>
                      </div>

                      {selectedTask.projectId && (
                        <div className="p-4 rounded-lg border-2 border-[#000000] bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                          <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                            <FolderKanban className="h-4 w-4 text-violet-600" />
                            Project
                          </h4>
                          <Badge
                            variant="secondary"
                            className="font-medium bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-100"
                          >
                            {projects.find(p => (p.project_id || p.id) === selectedTask.projectId)?.name || "Project Task"}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {selectedTask.tags && selectedTask.tags.length > 0 && (
                      <div className="p-4 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 border-2 border-[#000000]">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Paperclip className="h-4 w-4 text-white" />
                          </div>
                          Tags
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedTask.tags.map((tag) => (
                            <Badge
                              key={tag}
                              className="bg-white dark:bg-gray-900 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="activity"
                  className="mt-6 overflow-y-auto flex-1"
                >
                  <div className="space-y-4">
                    {isFetchingHistory &&
                      selectedTask &&
                      isFetchingHistory === selectedTask.id ? (
                      <div className="flex justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : selectedTaskHistory.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 to-gray-200 dark:from-slate-800 dark:to-gray-900 flex items-center justify-center mx-auto mb-3">
                          <Clock className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          No history entries yet
                        </p>
                      </div>
                    ) : (
                      selectedTaskHistory.map((entry) => {
                        const actor = employeesById.get(String(entry.user_id));
                        const actorName =
                          actor?.name ??
                          (entry.user_id ? `User #${entry.user_id}` : "Unknown");
                        const actorRole = actor?.role;
                        const actorInfo = getAssignedByInfo(
                          String(entry.user_id),
                          actorRole,
                        );
                        const entryTime = formatDateTimeIST(
                          entry.created_at,
                          "MMM dd, yyyy HH:mm",
                        );
                        const details = entry.details || {};

                        const renderDetails = () => {
                          if (!details) return null;
                          if (entry.action === "passed") {
                            const fromId = details.from
                              ? String(details.from)
                              : "";
                            const toId = details.to ? String(details.to) : "";
                            const fromInfo = fromId
                              ? getAssignedToInfo(fromId)
                              : { name: "Unknown", roleLabel: undefined };
                            const toInfo = toId
                              ? getAssignedToInfo(toId)
                              : { name: "Unknown", roleLabel: undefined };
                            const toName =
                              typeof details.to_name === "string"
                                ? details.to_name
                                : null;
                            const note =
                              typeof details.note === "string" &&
                                details.note.trim().length > 0
                                ? details.note
                                : null;
                            return (
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>
                                  From:{" "}
                                  <span className="font-medium text-foreground">
                                    {fromInfo.name}
                                  </span>
                                  {fromInfo.roleLabel && (
                                    <span className="text-xs ml-1">
                                      ({fromInfo.roleLabel})
                                    </span>
                                  )}
                                </div>
                                <div>
                                  To:{" "}
                                  <span className="font-medium text-foreground">
                                    {toName || toInfo.name}
                                  </span>
                                  {toInfo.roleLabel && (
                                    <span className="text-xs ml-1">
                                      ({toInfo.roleLabel})
                                    </span>
                                  )}
                                </div>
                                {note && (
                                  <div className="whitespace-pre-wrap break-words">
                                    "{note}"
                                  </div>
                                )}
                              </div>
                            );
                          }

                          if (entry.action === "status_changed") {
                            const from =
                              typeof details.from === "string"
                                ? details.from
                                : "Unknown";
                            const to =
                              typeof details.to === "string"
                                ? details.to
                                : "Unknown";
                            return (
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>
                                  Status changed from{" "}
                                  <span className="font-medium text-foreground">
                                    {from}
                                  </span>{" "}
                                  to{" "}
                                  <span className="font-medium text-foreground">
                                    {to}
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          if (entry.action === "updated") {
                            const changes = details.changes as
                              | Record<string, { from: unknown; to: unknown }>
                              | undefined;
                            if (!changes) return null;
                            return (
                              <div className="text-sm text-muted-foreground space-y-1">
                                {Object.entries(changes).map(
                                  ([field, change]) => (
                                    <div key={field}>
                                      <span className="font-medium text-foreground capitalize">
                                        {field.replace("_", " ")}:
                                      </span>{" "}
                                      {String(change.from)} → {String(change.to)}
                                    </div>
                                  ),
                                )}
                              </div>
                            );
                          }

                          if (entry.action === "created") {
                            const assignedToId = String(
                              details.assigned_to ?? "",
                            );
                            const assignedToInfo = assignedToId
                              ? getAssignedToInfo(assignedToId)
                              : { name: "Unassigned", roleLabel: undefined };
                            return (
                              <div className="text-sm text-muted-foreground">
                                Task assigned to{" "}
                                <span className="font-medium text-foreground">
                                  {assignedToInfo.name}
                                </span>
                                {assignedToInfo.roleLabel && (
                                  <span className="text-xs ml-1">
                                    ({assignedToInfo.roleLabel})
                                  </span>
                                )}
                              </div>
                            );
                          }

                          return null;
                        };

                        const actionLabelMap: Record<string, string> = {
                          created: "Task Created",
                          passed: "Task Passed",
                          status_changed: "Status Changed",
                          updated: "Task Updated",
                        };

                        const actionLabel =
                          actionLabelMap[entry.action] ?? entry.action;
                        const actionIcon = (() => {
                          switch (entry.action) {
                            case "created":
                              return (
                                <PlayCircle className="h-6 w-6 text-white" />
                              );
                            case "passed":
                              return <Share2 className="h-6 w-6 text-white" />;
                            case "status_changed":
                              return (
                                <RefreshCcw className="h-6 w-6 text-white" />
                              );
                            case "updated":
                              return <Pencil className="h-6 w-6 text-white" />;
                            default:
                              return <Clock className="h-6 w-6 text-white" />;
                          }
                        })();

                        const gradientClass = (() => {
                          switch (entry.action) {
                            case "created":
                              return "from-blue-500 to-indigo-600";
                            case "passed":
                              return "from-violet-500 to-purple-600";
                            case "status_changed":
                              return "from-amber-500 to-orange-600";
                            case "updated":
                              return "from-emerald-500 to-teal-600";
                            default:
                              return "from-slate-500 to-gray-600";
                          }
                        })();

                        return (
                          <div
                            key={entry.id}
                            className="flex items-start gap-4 p-4 rounded-lg border-2 border-[#000000] bg-white dark:bg-gray-950 hover:shadow-md transition-all"
                          >
                            <div
                              className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-lg flex-shrink-0`}
                            >
                              {actionIcon}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <p className="font-semibold text-lg">
                                  {actionLabel}
                                </p>
                                <div className="flex flex-col items-end">
                                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <User className="h-3.5 w-3.5" />
                                    {actorInfo.name}
                                  </p>
                                  {actorInfo.roleLabel && (
                                    <p className="text-xs text-muted-foreground">
                                      {actorInfo.roleLabel}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {entryTime}
                              </p>
                              {renderDetails()}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="comments"
                  className="mt-4 flex flex-col h-[calc(100vh-280px)] min-h-[500px]"
                >
                  {/* Comments Header */}
                  <div className="p-3 rounded-lg border-2 border-[#000000] bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 flex-shrink-0">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-violet-600" />
                      Task Discussion
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Chat with team members about this task
                    </p>
                  </div>

                  {/* Comments List with Scrolling - WhatsApp Style */}
                  <div
                    className="flex-1 overflow-y-auto space-y-3 p-4 bg-[#efeae2] dark:bg-slate-900 rounded-lg my-3"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "#a78bfa #e2e8f0",
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h100v100H0z' fill='%23efeae2' fill-opacity='0.4'/%3E%3Cpath d='M50 0L0 50M100 0L50 50M100 50L50 100M50 50L0 100' stroke='%23d1ccc0' stroke-width='0.5' opacity='0.3'/%3E%3C/svg%3E\")",
                    }}
                  >
                    {isLoadingComments ? (
                      <div className="text-center py-12">
                        <Loader2 className="h-10 w-10 animate-spin mx-auto text-violet-600" />
                        <p className="text-base text-muted-foreground mt-3">
                          Loading comments...
                        </p>
                      </div>
                    ) : taskComments.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900 flex items-center justify-center mx-auto mb-4">
                          <MessageSquare className="h-10 w-10 text-violet-600 dark:text-violet-400" />
                        </div>
                        <p className="text-base text-muted-foreground font-medium">
                          No comments yet
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Start the conversation!
                        </p>
                      </div>
                    ) : (
                      <>
                        {taskComments.map((comment, index) => {
                          const isOwnComment = comment.user_id === user?.id;
                          const commentUser = employeesById.get(
                            String(comment.user_id),
                          );
                          const userPhotoUrl = commentUser?.photo_url;
                          const userInitials =
                            comment.user_name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "?";

                          // Use WhatsApp-style time formatting
                          const formattedTime = getCommentTimeDisplay(
                            comment.created_at,
                          );
                          const dateSeparator = getDateSeparator(
                            comment.created_at,
                          );

                          // Check if we need to show date separator (different from previous comment's date)
                          const previousComment =
                            index > 0 ? taskComments[index - 1] : null;
                          const previousDateSeparator = previousComment
                            ? getDateSeparator(previousComment.created_at)
                            : null;
                          const showDateSeparator =
                            dateSeparator &&
                            dateSeparator !== previousDateSeparator;

                          return (
                            <div key={comment.id}>
                              {/* Date Separator */}
                              {showDateSeparator && (
                                <div className="flex items-center gap-3 my-4">
                                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                                    {dateSeparator}
                                  </span>
                                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                                </div>
                              )}

                              {/* Comment */}
                              <div
                                className={`flex gap-2 ${isOwnComment ? "flex-row-reverse" : "flex-row"} animate-in slide-in-from-bottom-2`}
                              >
                                {/* Profile Photo */}
                                <div className="flex-shrink-0">
                                  {userPhotoUrl ? (
                                    <img
                                      src={userPhotoUrl}
                                      alt={comment.user_name}
                                      className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm border-2 border-white dark:border-slate-700">
                                      {userInitials}
                                    </div>
                                  )}
                                </div>

                                {/* Message Bubble */}
                                <div
                                  className={`max-w-[70%] ${isOwnComment ? "items-end" : "items-start"} flex flex-col`}
                                >
                                  {/* Name & Role (only for others' messages) */}
                                  {!isOwnComment && (
                                    <div className="flex items-center gap-2 mb-1 px-2">
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {comment.user_name}
                                      </span>
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 font-medium">
                                        {comment.user_role}
                                      </span>
                                    </div>
                                  )}

                                  {/* Message Content */}
                                  <div
                                    className={`rounded-lg px-3 py-2 shadow-sm ${isOwnComment
                                      ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-tr-none"
                                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-none"
                                      }`}
                                  >
                                    {/* Role badge for own messages (inside bubble) */}
                                    {isOwnComment && (
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <span className="text-xs font-semibold text-white/90">
                                          You
                                        </span>
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 text-white font-medium">
                                          {comment.user_role}
                                        </span>
                                      </div>
                                    )}

                                    {/* File Attachment */}
                                    {comment.file_url && (
                                      <a
                                        href={`${API_BASE_URL}${comment.file_url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={comment.file_name}
                                        className={`flex items-center gap-2 p-2 rounded-lg mb-2 transition-colors ${isOwnComment
                                          ? "bg-white/10 hover:bg-white/20"
                                          : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                                          }`}
                                      >
                                        {comment.file_type?.startsWith(
                                          "image/",
                                        ) ? (
                                          <div className="flex flex-col gap-1">
                                            <img
                                              src={`${API_BASE_URL}${comment.file_url}`}
                                              alt={
                                                comment.file_name || "Attachment"
                                              }
                                              className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
                                            />
                                            <span
                                              className={`text-xs ${isOwnComment ? "text-white/80" : "text-slate-600 dark:text-slate-400"}`}
                                            >
                                              {comment.file_name}
                                            </span>
                                          </div>
                                        ) : (
                                          <>
                                            {comment.file_type?.includes(
                                              "pdf",
                                            ) ? (
                                              <FileText
                                                className={`h-5 w-5 ${isOwnComment ? "text-white" : "text-red-500"}`}
                                              />
                                            ) : comment.file_type?.includes(
                                              "spreadsheet",
                                            ) ||
                                              comment.file_type?.includes(
                                                "excel",
                                              ) ||
                                              comment.file_name?.endsWith(
                                                ".csv",
                                              ) ? (
                                              <FileSpreadsheet
                                                className={`h-5 w-5 ${isOwnComment ? "text-white" : "text-green-500"}`}
                                              />
                                            ) : comment.file_type?.includes(
                                              "word",
                                            ) ||
                                              comment.file_name?.endsWith(
                                                ".doc",
                                              ) ||
                                              comment.file_name?.endsWith(
                                                ".docx",
                                              ) ? (
                                              <FileText
                                                className={`h-5 w-5 ${isOwnComment ? "text-white" : "text-blue-500"}`}
                                              />
                                            ) : (
                                              <FileIcon
                                                className={`h-5 w-5 ${isOwnComment ? "text-white" : "text-slate-500"}`}
                                              />
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <p
                                                className={`text-sm font-medium truncate ${isOwnComment ? "text-white" : "text-slate-800 dark:text-slate-200"}`}
                                              >
                                                {comment.file_name}
                                              </p>
                                              {comment.file_size && (
                                                <p
                                                  className={`text-xs ${isOwnComment ? "text-white/70" : "text-slate-500 dark:text-slate-400"}`}
                                                >
                                                  {(
                                                    comment.file_size / 1024
                                                  ).toFixed(1)}{" "}
                                                  KB
                                                </p>
                                              )}
                                            </div>
                                            <Download
                                              className={`h-4 w-4 ${isOwnComment ? "text-white/70" : "text-slate-400"}`}
                                            />
                                          </>
                                        )}
                                      </a>
                                    )}

                                    {/* Text Comment */}
                                    {comment.comment && (
                                      <p
                                        className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${isOwnComment ? "text-white" : "text-slate-800 dark:text-slate-200"}`}
                                      >
                                        {comment.comment}
                                      </p>
                                    )}
                                    <div className="flex items-center justify-end gap-2 mt-1">
                                      <span
                                        className={`text-xs ${isOwnComment ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}
                                      >
                                        {formattedTime}
                                      </span>
                                      {isOwnComment && (
                                        <button
                                          onClick={() =>
                                            handleDeleteComment(comment.id)
                                          }
                                          className="opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded p-0.5 transition-all"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={commentsEndRef} />
                      </>
                    )}
                  </div>

                  {/* WhatsApp-style Comment Input */}
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
                    {/* Attached Files Preview */}
                    {attachedFiles.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2 px-2">
                        {attachedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border text-xs shadow-sm"
                          >
                            <Paperclip className="h-3 w-3 text-violet-600" />
                            <span className="font-medium truncate max-w-[100px]">
                              {file.name}
                            </span>
                            <button
                              onClick={() => removeAttachedFile(index)}
                              className="hover:bg-red-100 dark:hover:bg-red-900 rounded-full p-0.5"
                            >
                              <XCircle className="h-3 w-3 text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* WhatsApp-style Input Row */}
                    <div className="flex items-center gap-2">
                      {/* File Upload Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                        title="Attach file"
                      >
                        <Paperclip className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.ppt,.pptx,.zip,.rar"
                      />

                      {/* Input Field */}
                      <div className="flex-1 bg-white dark:bg-slate-800 rounded-full px-4 py-2 border border-slate-300 dark:border-slate-700 focus-within:border-violet-500 transition-colors">
                        <input
                          type="text"
                          placeholder="Type a message"
                          value={newComment}
                          onChange={(e) =>
                            setNewComment(
                              e.target.value.replace(
                                /[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu,
                                "",
                              ),
                            )
                          }
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handlePostComment();
                            }
                          }}
                          className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>

                      {/* Send Button */}
                      <button
                        onClick={handlePostComment}
                        disabled={
                          (!newComment.trim() && attachedFiles.length === 0) ||
                          isPostingComment
                        }
                        className="p-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        title="Send message"
                      >
                        {isPostingComment ? (
                          <Loader2 className="h-5 w-5 text-white animate-spin" />
                        ) : (
                          <Send className="h-5 w-5 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )
      }

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border-2 shadow-2xl p-0">
          <DialogHeader className="pb-3 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 p-4 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Download className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Export Task Report
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs">
                  Generate and download task reports
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 p-4">
            {/* Period Type */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                Period Type
              </Label>
              <Select
                value={exportPeriodType}
                onValueChange={(value: any) => setExportPeriodType(value)}
              >
                <SelectTrigger className="h-8 border-2 bg-white dark:bg-gray-950 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 shadow-xl">
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {/* Monthly sub-options */}
              {exportPeriodType === "monthly" && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-[10px] font-medium">Month</Label>
                    <Select value={exportMonth} onValueChange={setExportMonth}>
                      <SelectTrigger className="h-8 border-2 mt-1 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "January",
                          "February",
                          "March",
                          "April",
                          "May",
                          "June",
                          "July",
                          "August",
                          "September",
                          "October",
                          "November",
                          "December",
                        ].map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-medium">Year</Label>
                    <Select value={exportYear} onValueChange={setExportYear}>
                      <SelectTrigger className="h-8 border-2 mt-1 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2023, 2024, 2025, 2026].map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Quarterly sub-options */}
              {exportPeriodType === "quarterly" && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-[10px] font-medium">Quarter</Label>
                    <Select
                      value={exportQuarter}
                      onValueChange={setExportQuarter}
                    >
                      <SelectTrigger className="h-9 border-2 mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Q1 (Jan–Mar)</SelectItem>
                        <SelectItem value="2">Q2 (Apr–Jun)</SelectItem>
                        <SelectItem value="3">Q3 (Jul–Sep)</SelectItem>
                        <SelectItem value="4">Q4 (Oct–Dec)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-medium">Year</Label>
                    <Select value={exportYear} onValueChange={setExportYear}>
                      <SelectTrigger className="h-9 border-2 mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2023, 2024, 2025, 2026].map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Custom date range */}
              {exportPeriodType === "custom" && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label
                      htmlFor="export-start-date"
                      className="text-[10px] font-medium"
                    >
                      Start Date
                    </Label>
                    <Input
                      id="export-start-date"
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="h-9 border-2 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="export-end-date"
                      className="text-[10px] font-medium"
                    >
                      End Date
                    </Label>
                    <Input
                      id="export-end-date"
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="h-9 border-2 mt-1 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-emerald-600" />
                Status Filter
              </Label>
              <Select
                value={exportStatusFilter}
                onValueChange={setExportStatusFilter}
              >
                <SelectTrigger className="h-9 border-2 bg-white dark:bg-gray-950 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 shadow-xl">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>



            {/* Export Summary */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border-2 border-[#000000]">
              <h4 className="text-xs font-bold mb-2">Summary</h4>
              <div className="text-[10px] text-muted-foreground space-y-1">
                <p>
                  • Format: <span className="font-bold text-foreground">PDF</span>
                </p>
                <p>
                  • Period:{" "}
                  <span className="font-bold text-foreground">
                    {exportPeriodType === "all"
                      ? "All Time"
                      : exportPeriodType === "monthly"
                        ? `Month ${exportMonth}, ${exportYear}`
                        : exportPeriodType === "quarterly"
                          ? `Q${exportQuarter} ${exportYear}`
                          : `${exportStartDate || "—"} → ${exportEndDate || "—"}`}
                  </span>
                </p>
                <p>
                  • Status:{" "}
                  <span className="font-bold text-foreground">
                    {exportStatusFilter === "all"
                      ? "All Statuses"
                      : exportStatusFilter}
                  </span>
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(false)}
                className="h-9 px-4 border-2 text-[11px] font-bold hover:shadow-lg transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="h-9 px-4 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg text-[11px] font-bold transition-all disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Exporting
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    Export PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pass History Dialog */}
      <Dialog
        open={isPassHistoryDialogOpen}
        onOpenChange={(open) => {
          // Only allow closing via the Close button, not the X button
          if (!open) {
            setIsPassHistoryDialogOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col border-2 shadow-2xl [&>button]:hidden p-0 overflow-hidden">
          <DialogHeader className="pb-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Share2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  Pass History
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Complete history of task reassignments
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {passHistoryTask &&
              (() => {
                const passEntries = getPassHistoryEntries(passHistoryTask.id);

                if (passEntries.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-br from-slate-100 to-gray-200 dark:from-slate-800 dark:to-gray-900 flex items-center justify-center mx-auto mb-4">
                        <Share2 className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground text-lg">
                        No pass history available
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        This task has not been passed yet
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {passEntries.map((entry, index) => {
                      const details = entry.details as
                        | Record<string, unknown>
                        | undefined;
                      const fromId = details?.from ? String(details.from) : "";
                      const toId = details?.to ? String(details.to) : "";
                      const fromInfo = fromId
                        ? getAssignedToInfo(fromId)
                        : { name: "Unknown", roleLabel: undefined };
                      const toInfo = toId
                        ? getAssignedToInfo(toId)
                        : { name: "Unknown", roleLabel: undefined };

                      // Prioritize names from backend details if available
                      const fromName =
                        typeof details?.from_name === "string"
                          ? details.from_name
                          : fromInfo.name;

                      const toName =
                        typeof details?.to_name === "string"
                          ? details.to_name
                          : toInfo.name;

                      const actorNameFromBackend =
                        typeof details?.actor_name === "string"
                          ? details.actor_name
                          : typeof details?.user_name === "string"
                            ? details.user_name
                            : null;
                      const note =
                        typeof details?.note === "string" &&
                          details.note.trim().length > 0
                          ? details.note
                          : null;
                      const actor = employeesById.get(String(entry.user_id));
                      const actorRole = actor?.role;
                      const actorInfo = getAssignedByInfo(
                        String(entry.user_id),
                        actorRole,
                      );

                      const displayActorName = actorNameFromBackend || actorInfo.name;

                      const timestamp = formatDateTimeIST(
                        entry.created_at,
                        "MMM dd, yyyy HH:mm",
                      );

                      return (
                        <div
                          key={entry.id}
                          className="p-4 rounded-lg border-2 border-[#000000] bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                {index + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">
                                  Pass #{index + 1}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  by {displayActorName}
                                  {actorInfo.roleLabel && (
                                    <span className="ml-1">
                                      ({actorInfo.roleLabel})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timestamp}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex-1 p-3 rounded-md bg-white dark:bg-gray-900 border-2 border-[#000000]">
                              <div className="text-xs text-muted-foreground mb-1">
                                From
                              </div>
                              <div className="font-medium text-sm">
                                {fromName}
                              </div>
                              {fromInfo.roleLabel && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {fromInfo.roleLabel}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              <ChevronRight className="h-5 w-5 text-violet-600" />
                            </div>
                            <div className="flex-1 p-3 rounded-md bg-white dark:bg-gray-900 border-2 border-[#000000]">
                              <div className="text-xs text-muted-foreground mb-1">
                                To
                              </div>
                              <div className="font-medium text-sm">
                                {toName}
                              </div>
                              {toInfo.roleLabel && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {toInfo.roleLabel}
                                </div>
                              )}
                            </div>
                          </div>

                          {note && (
                            <div className="mt-3 p-3 rounded-md bg-white dark:bg-gray-900 border-2 border-[#000000]">
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                Note
                              </div>
                              <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                                "{note}"
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
          </div>

          <div className="flex-shrink-0 flex justify-end gap-3 p-6 border-t bg-slate-50 dark:bg-slate-950/50">
            <Button
              variant="outline"
              onClick={() => setIsPassHistoryDialogOpen(false)}
              className="h-11 px-6 border-2 hover:shadow-lg hover:border-slate-400 dark:hover:border-slate-600 transition-all bg-white dark:bg-slate-900"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>



    </div >
  );
};

export default TaskManagement;

