import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Task as BaseTask, UserRole } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import TruncatedText from '@/components/ui/TruncatedText';
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
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { formatIST, formatDateTimeIST, formatDateIST, todayIST, parseToIST, nowIST } from '@/utils/timezone';
import { apiService, API_BASE_URL } from '@/lib/api';

const ROLE_ORDER: UserRole[] = ['admin', 'hr', 'manager', 'team_lead', 'employee'];

const CORE_DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'HR',
  'Human Resources',
  'Finance',
  'Operations',
  'Legal',
  'Customer Support',
  'IT',
  'Administration',
  'Management'
];

type BackendTask = {
  task_id: number;
  title: string;
  description?: string | null;
  status?: string | null;
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
};

type TaskWithPassMeta = BaseTask & {
  lastPassedBy?: string;
  lastPassedTo?: string;
  lastPassNote?: string;
  lastPassedAt?: string;
  assignedToName?: string;
  assignedByName?: string;
  assignedToRole?: UserRole;
  assignedByRole?: UserRole;
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
    case 'admin':
      return 'admin';
    case 'hr':
      return 'hr';
    case 'manager':
      return 'manager';
    case 'teamlead':
    case 'team_lead':
    case 'teamlead ': // handle accidental spacing
      return 'team_lead';
    case 'employee':
    default:
      return 'employee';
  }
};

const backendToFrontendPriority: Record<string, BaseTask['priority']> = {
  low: 'low',
  Low: 'low',
  medium: 'medium',
  Medium: 'medium',
  high: 'high',
  High: 'high',
  urgent: 'urgent',
  Urgent: 'urgent',
};

const frontendToBackendPriority: Record<BaseTask['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const backendToFrontendStatus: Record<string, BaseTask['status']> = {
  pending: 'todo',
  Pending: 'todo',
  'in progress': 'in-progress',
  'In Progress': 'in-progress',
  overdue: 'overdue',
  Overdue: 'overdue',
  completed: 'completed',
  Completed: 'completed',
  cancelled: 'cancelled',
  Cancelled: 'cancelled',
};

const frontendToBackendStatus: Record<BaseTask['status'], string> = {
  'todo': 'Pending',
  'in-progress': 'In Progress',
  'overdue': 'Overdue',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
};

const mapBackendTaskToFrontend = (task: BackendTask): TaskWithPassMeta => {
  const nowIso = new Date().toISOString();
  const createdAt = task.created_at ?? nowIso;
  const updatedAt = task.updated_at ?? createdAt;
  const deadlineIso = task.due_date ? new Date(task.due_date).toISOString() : '';
  const priority = backendToFrontendPriority[task.priority ?? 'Medium'] ?? 'medium';
  const status = backendToFrontendStatus[task.status ?? 'Pending'] ?? 'todo';
  const assignedTo = task.assigned_to !== undefined && task.assigned_to !== null
    ? [String(task.assigned_to)]
    : [];
  const assignedBy = task.assigned_by !== undefined && task.assigned_by !== null
    ? String(task.assigned_by)
    : '';
  const lastPassedBy = task.last_passed_by !== undefined && task.last_passed_by !== null ? String(task.last_passed_by) : undefined;
  const lastPassedTo = task.last_passed_to !== undefined && task.last_passed_to !== null ? String(task.last_passed_to) : undefined;
  const lastPassedAt = task.last_passed_at ? new Date(task.last_passed_at).toISOString() : undefined;

  return {
    id: String(task.task_id),
    title: task.title,
    description: task.description ?? '',
    assignedTo,
    assignedBy,
    priority,
    status,
    deadline: deadlineIso,
    startDate: createdAt,
    completedDate: status === 'completed' ? updatedAt : undefined,
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
    assignedToRole: task.assigned_to_role ? normalizeRole(task.assigned_to_role) : undefined,
    assignedByRole: task.assigned_by_role ? normalizeRole(task.assigned_by_role) : undefined,
  };
};

const formatDisplayDate = (date?: string | null) => {
  if (!date) return 'No deadline';
  const parsed = parseToIST(date);
  if (!parsed) return 'No deadline';
  return formatDateIST(parsed, 'MMM dd, yyyy');
};

const formatDateForInput = (date?: string | null) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatRoleLabel = (role?: UserRole) => {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'hr':
      return 'HR';
    case 'manager':
      return 'Manager';
    case 'team_lead':
      return 'Team Lead';
    case 'employee':
      return 'Employee';
    default:
      return undefined;
  }
};

// WhatsApp-style time formatting for comments
const getCommentTimeDisplay = (createdAt?: string): string => {
  if (!createdAt) return '';

  const commentDate = parseToIST(createdAt);
  if (!commentDate) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const commentDateOnly = new Date(commentDate.getFullYear(), commentDate.getMonth(), commentDate.getDate());

  // If today, show time only
  if (commentDateOnly.getTime() === today.getTime()) {
    return formatDateTimeIST(commentDate, 'hh:mm a');
  }

  // If yesterday, show "Yesterday"
  if (commentDateOnly.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  // If within last 7 days, show day name
  const daysDiff = Math.floor((today.getTime() - commentDateOnly.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return formatDateTimeIST(commentDate, 'EEEE');
  }

  // Otherwise show date
  return formatDateTimeIST(commentDate, 'MMM dd, yyyy');
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
  const commentDateOnly = new Date(commentDate.getFullYear(), commentDate.getMonth(), commentDate.getDate());

  // If today
  if (commentDateOnly.getTime() === today.getTime()) {
    return 'Today';
  }

  // If yesterday
  if (commentDateOnly.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  // Otherwise show date
  return formatDateTimeIST(commentDate, 'MMM dd, yyyy');
};

const TaskManagement: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const [tasks, setTasks] = useState<TaskWithPassMeta[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithPassMeta | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [taskOwnershipFilter, setTaskOwnershipFilter] = useState<'all' | 'received' | 'created'>('received');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('all');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: [] as string[],
    priority: 'medium' as BaseTask['priority'],
    deadline: '',
    department: '',
    employeeId: '',
  });
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [assignRoleFilter, setAssignRoleFilter] = useState<'all' | UserRole>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [userCache, setUserCache] = useState<Map<string, EmployeeSummary>>(new Map());
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isOverdueFilterActive, setIsOverdueFilterActive] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithPassMeta | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    deadline: '',
  });
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [isPassDialogOpen, setIsPassDialogOpen] = useState(false);
  const [passTaskTarget, setPassTaskTarget] = useState<TaskWithPassMeta | null>(null);
  const [passAssignee, setPassAssignee] = useState('');
  const [passNote, setPassNote] = useState('');
  const [isPassingTask, setIsPassingTask] = useState(false);
  const [taskHistory, setTaskHistory] = useState<Record<string, TaskHistoryEntry[]>>({});
  const [isFetchingHistory, setIsFetchingHistory] = useState<string | null>(null);

  // Pass History Dialog State
  const [isPassHistoryDialogOpen, setIsPassHistoryDialogOpen] = useState(false);
  const [passHistoryTask, setPassHistoryTask] = useState<TaskWithPassMeta | null>(null);

  // Reassign Dialog State
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [reassignTask, setReassignTask] = useState<TaskWithPassMeta | null>(null);
  const [reassignForm, setReassignForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    deadline: '',
    priority: 'medium' as BaseTask['priority'],
  });
  const [isReassigning, setIsReassigning] = useState(false);

  // Task Comments State
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);

  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const commentsEndRef = React.useRef<HTMLDivElement>(null);


  // Export states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [exportDateRange, setExportDateRange] = useState<'1month' | '3months' | '6months' | 'custom' | 'all'>('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportDepartmentFilter, setExportDepartmentFilter] = useState<string>('all');
  const [exportUserFilter, setExportUserFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Pagination states
  const [taskCurrentPage, setTaskCurrentPage] = useState(1);
  const [taskItemsPerPage, setTaskItemsPerPage] = useState(10);

  const isCreateDisabled = !newTask.title.trim() || !newTask.description.trim() || !newTask.assignedTo.length || isSubmitting;

  const userId = useMemo(() => {
    if (user?.id === undefined || user?.id === null) return null;
    return String(user.id);
  }, [user?.id]);

  const [authToken, setAuthToken] = useState<string>(() => {
    const storedToken = localStorage.getItem('token') || '';
    if (!storedToken) return '';
    return storedToken.startsWith('Bearer ') ? storedToken : `Bearer ${storedToken}`;
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      // Admin defaults to "created" section and has "all tasks" section
      setTaskOwnershipFilter('created');
    } else {
      // All other roles (hr, manager, team_lead, employee) default to "received" section
      setTaskOwnershipFilter('received');
      // Set manager's department as default filter if applicable
      if (user?.role === 'manager' && user?.department) {
        setSelectedDepartmentFilter(user.department);
      }
    }
  }, [user?.role, user?.department]);

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || '';
    if (!storedToken) {
      setAuthToken('');
      return;
    }
    setAuthToken(storedToken.startsWith('Bearer ') ? storedToken : `Bearer ${storedToken}`);
  }, [user?.id]);

  const authorizedHeaders = useMemo(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers.Authorization = authToken;
    }

    return headers;
  }, [authToken]);

  const fetchAndStoreHistory = useCallback(async (taskId: string) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/history`, {
        headers: authorizedHeaders,
      });
      if (!response.ok) {
        throw new Error(`Failed to load history (${response.status})`);
      }
      const data: TaskHistoryEntry[] = await response.json();
      setTaskHistory((prev) => ({ ...prev, [taskId]: data }));
    } catch (error) {
      console.error('Failed to fetch task history', error);
    }
  }, [authToken, authorizedHeaders]);

  useEffect(() => {
    if (!selectedTask) return;
    const alreadyLoaded = taskHistory[selectedTask.id];
    if (!alreadyLoaded && authToken) {
      setIsFetchingHistory(selectedTask.id);
      fetchAndStoreHistory(selectedTask.id).finally(() => setIsFetchingHistory(null));
    }
  }, [authToken, fetchAndStoreHistory, selectedTask, taskHistory]);

  const fetchEmployees = useCallback(async () => {
    if (!authToken) {
      toast({
        title: 'Authentication required',
        description: 'Please log in again to load employees.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Only fetch all employees if user has a management role
      if (user?.role === 'employee') {
        console.log('Skipping employee list fetch - current user is an employee');
        setEmployees([]);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/employees/`, {
        headers: authorizedHeaders,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch employees: ${response.status}`);
      }
      let data = await response.json();
      if (!Array.isArray(data) && data?.employees) {
        data = data.employees;
      } else if (!Array.isArray(data)) {
        data = [];
      }
      const formatted = data.map((emp) => ({
        userId: String(emp.user_id),
        employeeId: emp.employee_id ? String(emp.employee_id) : '',
        name: emp.name,
        email: emp.email,
        department: emp.department ?? undefined,
        role: normalizeRole(emp.role),
        photo_url: emp.photo_url ?? undefined,
      }));
      setEmployees(formatted);

      const uniqueDepartments = new Set<string>();
      formatted.forEach((emp) => {
        if (emp.department) uniqueDepartments.add(emp.department);
      });
      if (user?.department) uniqueDepartments.add(user.department);
      setDepartments(Array.from(uniqueDepartments));
    } catch (error) {
      console.error('Failed to fetch employees', error);
      toast({
        title: 'Employee fetch failed',
        description: 'Unable to load employees from server.',
        variant: 'destructive',
      });
    }
  }, [authToken, authorizedHeaders, toast, user?.department]);



  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    if (!authToken) {
      setTasks([]);
      toast({
        title: 'Authentication required',
        description: 'Please log in again to load your tasks.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoadingTasks(true);
    try {
      const data: BackendTask[] = await apiService.getMyTasks();

      // Update user cache with names and roles provided in task data
      setUserCache(prev => {
        const next = new Map(prev);
        let changed = false;
        data.forEach(t => {
          if (t.assigned_to && t.assigned_to_name) {
            const tid = String(t.assigned_to);
            // Find employee in list for role lookup
            const employeeFromList = employees.find(emp => emp.userId === tid);

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
            if (!existing || (assignedToRole && existing.role !== assignedToRole) || (!existing.role && assignedToRole)) {
              next.set(tid, {
                userId: tid,
                employeeId: existing?.employeeId || employeeFromList?.employeeId || '',
                name: t.assigned_to_name,
                email: existing?.email || employeeFromList?.email || '',
                role: assignedToRole || existing?.role || 'employee', // Only use employee as last resort
              });
              changed = true;
            }
          }
          if (t.assigned_by && t.assigned_by_name) {
            const bid = String(t.assigned_by);
            // Find employee in list for role lookup
            const employeeFromList = employees.find(emp => emp.userId === bid);

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
            if (!existing || (assignedByRole && existing.role !== assignedByRole) || (!existing.role && assignedByRole)) {
              next.set(bid, {
                userId: bid,
                employeeId: existing?.employeeId || employeeFromList?.employeeId || '',
                name: t.assigned_by_name,
                email: existing?.email || employeeFromList?.email || '',
                role: assignedByRole || existing?.role || 'employee', // Only use employee as last resort
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
      const updatedConverted = converted.map(task => {
        // If task is not completed/cancelled and deadline has passed, mark as overdue
        // Fix: Compare dates only, allowing the entire deadline day to pass before marking as overdue
        if (task.status !== 'completed' && task.status !== 'cancelled' &&
          task.deadline && task.status !== 'overdue') {

          const deadlineDate = new Date(task.deadline);
          const now = new Date();

          // Reset check to midnight so we compare purely based on the calendar date
          const dMidnight = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
          const nMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

          // Only overdue if today's date is strictly AFTER the deadline date
          if (nMidnight > dMidnight) {
            tasksToUpdate.push(task);
            return { ...task, status: 'overdue' as BaseTask['status'] };
          }
        }
        return task;
      });

      // Update overdue tasks on the backend using the proper endpoints
      for (const task of tasksToUpdate) {
        try {
          // Use formatted status for backend
          const backendStatus = frontendToBackendStatus['overdue'];
          await fetch(`${API_BASE_URL}/tasks/${task.id}/status?status=${encodeURIComponent(backendStatus)}`, {
            method: 'PUT',
            headers: authorizedHeaders,
          });
        } catch (error) {
          console.error(`Failed to update task ${task.id} to overdue status`, error);
        }
      }

      // Sort tasks by status priority first, then by deadline within each status
      const sortedTasks = updatedConverted.sort((a, b) => {
        // Define status priority order: todo -> in-progress -> overdue -> completed -> cancelled
        const statusOrder = { 'todo': 0, 'in-progress': 1, 'overdue': 2, 'completed': 3, 'cancelled': 4 };
        const aStatusPriority = statusOrder[a.status] ?? 999;
        const bStatusPriority = statusOrder[b.status] ?? 999;

        // First sort by status priority
        if (aStatusPriority !== bStatusPriority) {
          return aStatusPriority - bStatusPriority;
        }

        // Within same status, sort by deadline (earliest first)
        // Tasks without deadline go to the end
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;

        return aDeadline - bDeadline;
      });
      setTasks(sortedTasks);
      setTaskHistory({});
      await Promise.all(sortedTasks.map((task) => fetchAndStoreHistory(task.id)));
    } catch (error) {
      console.error('Failed to fetch tasks', error);
      toast({
        title: 'Task fetch failed',
        description: 'Unable to load tasks from server.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingTasks(false);
    }
  }, [authToken, authorizedHeaders, employees, fetchAndStoreHistory, toast, userId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Check if user can assign tasks to others
  const canAssignTasks = () => Boolean(userId);

  const extendedEmployees = useMemo(() => {
    if (!userId || !user) return employees;
    const exists = employees.some((emp) => emp.userId === userId);
    if (exists) return employees;
    return [
      ...employees,
      {
        userId,
        employeeId: '',
        name: user.name,
        email: user.email,
        department: user.department || undefined,
        role: user.role,
      },
    ];
  }, [employees, user, userId]);

  const assignableEmployees = useMemo(() => {
    if (!user || !userId) return [];

    return extendedEmployees.filter((emp) => {
      if (emp.userId === userId) return true;

      const sameDepartment = !user.department || !emp.department || emp.department === user.department;

      switch (user.role) {
        case 'admin':
          // Admin can assign tasks to anyone
          return true;
        case 'hr':
          // HR can assign tasks to managers, team leads, and employees across all departments
          return ['manager', 'team_lead', 'employee'].includes(emp.role);
        case 'manager':
          return sameDepartment && ['team_lead', 'employee'].includes(emp.role);
        case 'team_lead':
          return sameDepartment && emp.role === 'employee';
        case 'employee':
          return false;
        default:
          return false;
      }
    });
  }, [extendedEmployees, user, userId]);

  const passEligibleEmployees = useMemo(() => {
    if (!user || !userId) return [] as EmployeeSummary[];
    const currentIndex = ROLE_ORDER.indexOf(user.role);
    return extendedEmployees.filter((emp) => {
      // Filter out current user (self)
      if (emp.userId === userId || String(emp.userId) === String(userId)) return false;

      const targetIndex = ROLE_ORDER.indexOf(emp.role);
      if (targetIndex === -1) return false;

      // Can only pass to lower hierarchy (higher index in ROLE_ORDER)
      if (targetIndex <= currentIndex) return false;

      // Non-admin users can only pass within their department
      if (user.role !== 'admin' && user.department && emp.department && emp.department !== user.department) {
        return false;
      }
      return true;
    });
  }, [extendedEmployees, user, userId]);

  // Group pass eligible employees by department with role hierarchy
  const passEligibleByDepartment = useMemo(() => {
    const grouped = new Map<string, EmployeeSummary[]>();

    passEligibleEmployees.forEach((emp) => {
      const dept = emp.department || 'No Department';
      if (!grouped.has(dept)) {
        grouped.set(dept, []);
      }
      grouped.get(dept)!.push(emp);
    });

    // Sort employees within each department by role hierarchy
    // Include 'admin' in the role order for proper sorting
    const roleOrder: UserRole[] = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
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
    return new Map([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [passEligibleEmployees]);

  const assignableDepartments = useMemo(() => {
    if (!user || !userId) return departments;
    // Admin and HR can select any department
    if (user.role === 'admin' || user.role === 'hr') return departments;
    if (!user.department) return departments;
    return departments.filter((dept) => dept === user.department);
  }, [departments, user, userId]);

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
        employeeId: '',
        name: user.name,
        email: user.email,
        department: user.department || undefined,
        role: user.role,
      });
    }
    return map;
  }, [employees, user, userId, userCache]);

  const getAssigneeLabel = useCallback((assigneeId: string) => {
    if (!assigneeId) return 'Self';
    if (userId && assigneeId === userId) {
      return user?.name || 'Self';
    }
    const assignee = employeesById.get(assigneeId);
    if (assignee) {
      const identifier = assignee.employeeId || assignee.email;
      return `${assignee.name}${identifier ? ` (${identifier})` : ''}`;
    }
    return assigneeId;
  }, [employeesById, user, userId]);

  const getAssignedByInfo = useCallback((assignedById: string, role?: UserRole) => {
    if (!assignedById) {
      return { name: 'Unknown', roleLabel: undefined };
    }

    // Priority 1: Backend-provided role from task (most reliable)
    if (role) {
      const assigner = employeesById.get(assignedById);
      const cachedUser = userCache.get(assignedById);
      const name = assigner?.name || cachedUser?.name || (userId && assignedById === userId ? user?.name : undefined) || `User #${assignedById}`;
      const finalName = name === `User #${assignedById}` && userId && assignedById === userId ? (user?.name || 'Self') : name;
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
        name: user?.name || 'Self',
        roleLabel: formatRoleLabel(user?.role),
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
  }, [employeesById, user?.name, user?.role, userId, userCache]);

  const getAssignedToInfo = useCallback((assignedToId: string, role?: UserRole) => {
    if (!assignedToId) {
      return { name: 'Unassigned', roleLabel: undefined };
    }

    // Priority 1: Backend-provided role from task (most reliable)
    if (role) {
      const assignee = employeesById.get(assignedToId);
      const cachedUser = userCache.get(assignedToId);
      const name = assignee?.name || cachedUser?.name || (userId && assignedToId === userId ? user?.name : undefined) || `User #${assignedToId}`;
      const finalName = name === `User #${assignedToId}` && userId && assignedToId === userId ? (user?.name || 'Self') : name;
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
        name: user?.name || 'Self',
        roleLabel: formatRoleLabel(user?.role),
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
  }, [employeesById, user?.name, user?.role, userId, userCache]);

  // Add current user to cache if they're an admin or not in employees list
  useEffect(() => {
    if (user && userId && !userCache.has(userId)) {
      setUserCache((prev) => new Map(prev).set(userId, {
        userId,
        employeeId: '',
        name: user.name,
        email: user.email,
        department: user.department || undefined,
        role: user.role,
      }));
    }
  }, [user, userId, userCache]);

  // Update user cache with correct roles from employees list when employees are loaded
  useEffect(() => {
    if (employees.length === 0) return;

    setUserCache((prev) => {
      const next = new Map(prev);
      let changed = false;

      // Update cached users with correct roles from employees list
      prev.forEach((cachedUser, cachedUserId) => {
        const employee = employees.find(emp => emp.userId === cachedUserId);
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
        department: user.department || prev.department,
      }));
    }
  }, [isCreateDialogOpen, newTask.assignedTo.length, user, userId]);

  useEffect(() => {
    if (!user || !userId) return;
    const currentAssigneeId = newTask.assignedTo[0];
    const assignee = currentAssigneeId ? employeesById.get(currentAssigneeId) : null;

    // Auto-update department only when an assignee is actually chosen
    // Admin/HR can change department manually, so we don't force overwrite if no assignee is set
    const nextDepartment = (assignee && assignee.userId !== userId)
      ? (assignee.department || newTask.department || user.department || '')
      : newTask.department;

    const nextEmployeeId = assignee?.employeeId || '';

    if (newTask.department !== nextDepartment || newTask.employeeId !== nextEmployeeId) {
      setNewTask((prev) => ({
        ...prev,
        department: nextDepartment,
        employeeId: nextEmployeeId,
      }));
    }
  }, [employeesById, newTask.assignedTo, user, userId]); // Removed department from dependency to avoid infinite loops and fight with user choice

  // Filter tasks based on search and status
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;

      const isVisible = userId && user ? (
        task.assignedBy === userId ||
        task.assignedTo.includes(userId) ||
        user.role === 'admin'
      ) : false;

      return matchesSearch && matchesStatus && Boolean(isVisible);
    });
  }, [filterStatus, searchQuery, tasks, user, userId]);

  // Get task counts by status (for stat cards) - without status filter
  const taskCountsByStatus = useMemo(() => {
    const searchFiltered = tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());

      const isVisible = userId && user ? (
        task.assignedBy === userId ||
        task.assignedTo.includes(userId) ||
        user.role === 'admin'
      ) : false;

      return matchesSearch && Boolean(isVisible);
    });

    return {
      total: searchFiltered.length,
      inProgress: searchFiltered.filter(t => t.status === 'in-progress').length,
      completed: searchFiltered.filter(t => t.status === 'completed').length,
      overdue: searchFiltered.filter(t => t.status === 'overdue').length,
      cancelled: searchFiltered.filter(t => t.status === 'cancelled').length,
    };
  }, [searchQuery, tasks, user, userId]);

  const filteredReceivedTasks = useMemo(() => {
    if (!userId) return [] as TaskWithPassMeta[];
    return filteredTasks.filter((task) => task.assignedTo.includes(userId));
  }, [filteredTasks, userId]);

  const filteredCreatedTasks = useMemo(() => {
    if (!userId) return [] as TaskWithPassMeta[];
    return filteredTasks.filter((task) => task.assignedBy === userId);
  }, [filteredTasks, userId]);

  const visibleTasks = useMemo(() => {
    let baseTasks: TaskWithPassMeta[] = [];

    if (taskOwnershipFilter === 'all') {
      baseTasks = filteredTasks;
    } else if (taskOwnershipFilter === 'created') {
      baseTasks = filteredCreatedTasks;
    } else {
      baseTasks = filteredReceivedTasks;
    }

    // Apply department filter for "All Tasks" view
    if (taskOwnershipFilter === 'all' && selectedDepartmentFilter !== 'all') {
      baseTasks = baseTasks.filter(task => {
        // Get task creator and assignee info
        const creator = employees.find(emp => emp.userId === task.assignedBy);
        const assignees = task.assignedTo.map(id => employees.find(emp => emp.userId === id));

        // Check if task belongs to selected department
        return creator?.department === selectedDepartmentFilter ||
          assignees.some(assignee => assignee?.department === selectedDepartmentFilter);
      });
    }

    // Apply overdue filter if active
    if (isOverdueFilterActive) {
      baseTasks = baseTasks.filter(task => task.status === 'overdue');
    }

    // Re-sort tasks by status priority first, then by deadline within each status
    // This ensures consistent ordering regardless of when tasks were updated
    return baseTasks.sort((a, b) => {
      // Define status priority order: todo -> in-progress -> overdue -> completed -> cancelled
      const statusOrder = { 'todo': 0, 'in-progress': 1, 'overdue': 2, 'completed': 3, 'cancelled': 4 };
      const aStatusPriority = statusOrder[a.status] ?? 999;
      const bStatusPriority = statusOrder[b.status] ?? 999;

      // First sort by status priority
      if (aStatusPriority !== bStatusPriority) {
        return aStatusPriority - bStatusPriority;
      }

      // Within same status, sort by creation date (newest first for "created" view, oldest first for others)
      if (taskOwnershipFilter === 'created') {
        // For created tasks, show newest first
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated; // Descending order (newest first)
      } else {
        // For received and all tasks, sort by deadline (earliest first)
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        return aDeadline - bDeadline;
      }
    });
  }, [filteredCreatedTasks, filteredReceivedTasks, filteredTasks, taskOwnershipFilter, selectedDepartmentFilter, employees, isOverdueFilterActive]);

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
  }, [taskOwnershipFilter, filterStatus, searchQuery, selectedDepartmentFilter, isOverdueFilterActive]);

  const selectedTaskAssignerInfo = useMemo(() => {
    if (!selectedTask) return null;
    return getAssignedByInfo(selectedTask.assignedBy, selectedTask.assignedByRole);
  }, [getAssignedByInfo, selectedTask]);

  const selectedTaskAssigneeInfo = useMemo(() => {
    if (!selectedTask) return null;
    return getAssignedToInfo(selectedTask.assignedTo[0] || '', selectedTask.assignedToRole);
  }, [getAssignedToInfo, selectedTask]);

  const selectedTaskHistory = useMemo(() => {
    if (!selectedTask) return [];
    return taskHistory[selectedTask.id] ?? [];
  }, [selectedTask, taskHistory]);

  // Get pass history entries for a specific task
  const getPassHistoryEntries = useCallback((taskId: string) => {
    const history = taskHistory[taskId] ?? [];
    return history.filter(entry => entry.action === 'passed').reverse(); // Most recent first
  }, [taskHistory]);

  // Open pass history dialog
  const openPassHistoryDialog = useCallback((task: TaskWithPassMeta) => {
    setPassHistoryTask(task);
    setIsPassHistoryDialogOpen(true);
    // Ensure history is loaded
    if (!taskHistory[task.id]) {
      fetchAndStoreHistory(task.id);
    }
  }, [fetchAndStoreHistory, taskHistory]);

  // Create new task
  const canAssignToSelection = useMemo(() => {
    if (!user || !userId) return [];
    return assignableEmployees;
  }, [assignableEmployees, user, userId]);

  const departmentOptions = useMemo(() => {
    const sanitized = assignableDepartments.filter((dept) => dept && dept.trim().length > 0);
    if (sanitized.length) return sanitized;
    if (user?.department) return [user.department];
    return [];
  }, [assignableDepartments, user?.department]);

  const handleCreateTask = async () => {
    if (!user || !userId) return;

    // Validate deadline is required
    if (!newTask.deadline) {
      toast({
        title: 'Deadline required',
        description: 'Please set a deadline for the task.',
        variant: 'destructive',
      });
      return;
    }

    // Validate deadline is not in the past
    const selectedDate = new Date(newTask.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

    if (selectedDate < today) {
      toast({
        title: 'Invalid deadline',
        description: 'Task deadline cannot be in the past. Please select today or a future date.',
        variant: 'destructive',
      });
      return;
    }

    const assignees = newTask.assignedTo.length > 0 ? newTask.assignedTo : [userId];

    setIsSubmitting(true);
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      for (const assigneeIdIdRaw of assignees) {
        if (!assigneeIdIdRaw) continue;

        const selectedEmployee = assignableEmployees.find((emp) => emp.userId === assigneeIdIdRaw || emp.email === assigneeIdIdRaw);
        const assignedToIdRaw = selectedEmployee?.userId ?? assigneeIdIdRaw;
        const assignedByIdRaw = userId;

        const assignedToBackend = Number(assignedToIdRaw);
        const assignedByBackend = Number(assignedByIdRaw);

        if (!Number.isFinite(assignedToBackend) || !Number.isFinite(assignedByBackend)) {
          errors.push(`Invalid identifier for ${selectedEmployee?.name || assigneeIdIdRaw}`);
          failedCount++;
          continue;
        }

        const payload = {
          title: newTask.title,
          description: newTask.description,
          priority: frontendToBackendPriority[newTask.priority],
          due_date: newTask.deadline || null,
          assigned_to: assignedToBackend,
          assigned_by: assignedByBackend,
        };

        try {
          const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: authorizedHeaders,
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const detail = Array.isArray(errorData?.detail)
              ? errorData.detail.map((item: any) => (typeof item === 'string' ? item : item.msg || JSON.stringify(item))).join(', ')
              : typeof errorData?.detail === 'string'
                ? errorData.detail
                : JSON.stringify(errorData || {});
            throw new Error(detail || `Failed (${response.status})`);
          }

          const createdTask: BackendTask = await response.json();
          const convertedTask = mapBackendTaskToFrontend(createdTask);

          // Add to local state
          setTasks((prev) => [convertedTask, ...prev]);

          // Trigger notification
          if (convertedTask.assignedTo[0] && userId) {
            if (convertedTask.assignedTo[0] !== userId) {
              addNotification({
                title: 'New Task Assigned',
                message: `${user.name} assigned you a new task: "${convertedTask.title}"`,
                type: 'task',
                metadata: {
                  taskId: convertedTask.id,
                  requesterId: user.id,
                  requesterName: user.name,
                }
              });
            } else {
              addNotification({
                title: 'Task Created',
                message: `You created a new task: "${convertedTask.title}" - Due: ${convertedTask.deadline || 'No deadline'}`,
                type: 'task',
                metadata: {
                  taskId: convertedTask.id,
                  requesterId: user.id,
                  requesterName: user.name,
                }
              });
            }
          }
          successCount++;
        } catch (err: any) {
          failedCount++;
          errors.push(`${selectedEmployee?.name || assigneeIdIdRaw}: ${err.message}`);
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Tasks Created',
          description: `Successfully created ${successCount} task(s).${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
        });

        setIsCreateDialogOpen(false);
        setNewTask({
          title: '',
          description: '',
          assignedTo: [],
          priority: 'medium',
          deadline: '',
          department: '',
          employeeId: ''
        });
        setAssigneeSearchQuery('');
      }

      if (failedCount > 0) {
        toast({
          title: 'Some tasks failed',
          description: errors.join('\n'),
          variant: 'destructive',
        });
      }

    } catch (err: unknown) {
      console.error('Failed to create tasks', err);
      const message = err instanceof Error ? err.message : 'Unable to create tasks. Please try again.';
      toast({
        title: 'Task creation failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPassDialog = useCallback((task: TaskWithPassMeta) => {
    setPassTaskTarget(task);
    const eligible = passEligibleEmployees;
    const fallbackAssignee = eligible.find((emp) => emp.userId === task.assignedTo[0]);
    if (fallbackAssignee) {
      setPassAssignee(fallbackAssignee.userId);
    } else if (eligible.length > 0) {
      setPassAssignee(eligible[0].userId);
    } else {
      setPassAssignee('');
    }
    setPassNote('');
    setIsPassDialogOpen(true);
  }, [passEligibleEmployees]);

  const closePassDialog = useCallback(() => {
    setIsPassDialogOpen(false);
    setPassTaskTarget(null);
    setPassAssignee('');
    setPassNote('');
    setIsPassingTask(false);
  }, []);

  const handlePassTask = useCallback(async () => {
    if (!passTaskTarget || !authToken) {
      toast({
        title: 'Unable to pass task',
        description: 'Authentication missing or task not selected.',
        variant: 'destructive',
      });
      return;
    }

    if (!passAssignee) {
      toast({
        title: 'Select assignee',
        description: 'Please choose a team member to pass the task to.',
        variant: 'destructive',
      });
      return;
    }

    setIsPassingTask(true);
    try {
      const payload = {
        new_assignee_id: Number(passAssignee),
        note: passNote.trim() || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/tasks/${passTaskTarget.id}/pass`, {
        method: 'POST',
        headers: authorizedHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData?.detail ?? `Failed to pass task (${response.status})`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      const updatedTask: BackendTask = await response.json();
      const converted = mapBackendTaskToFrontend(updatedTask);
      setTasks((prev) => prev.map((task) => (task.id === converted.id ? converted : task)));
      setSelectedTask((prev) => (prev && prev.id === converted.id ? converted : prev));

      await fetchAndStoreHistory(converted.id);

      // ✅ Trigger notification for the new assignee
      if (converted.assignedTo[0] && user && converted.assignedTo[0] !== user.id) {
        addNotification({
          title: 'Task Passed to You',
          message: `${user.name} passed you the task: "${converted.title}"${passNote ? ` - Note: ${passNote}` : ''}`,
          type: 'task',
          metadata: {
            taskId: converted.id,
            requesterId: user.id,
            requesterName: user.name,
          }
        });
      }

      toast({
        title: 'Task passed successfully',
        description: `Task is now assigned to ${getAssigneeLabel(converted.assignedTo[0] || '')}.`,
      });

      closePassDialog();
    } catch (error) {
      console.error('Failed to pass task', error);
      const message = error instanceof Error ? error.message : 'Unable to pass the task. Please try again.';
      toast({
        title: 'Task pass failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsPassingTask(false);
    }
  }, [authToken, authorizedHeaders, closePassDialog, fetchAndStoreHistory, getAssigneeLabel, passAssignee, passNote, passTaskTarget, toast]);

  // Task Comments Functions
  const loadTaskComments = useCallback(async (taskId: number) => {
    setIsLoadingComments(true);
    try {
      const data = await apiService.getTaskComments(taskId);
      setTaskComments(data || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
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
      setTaskComments(prevComments => {
        const existingIds = new Set(prevComments.map(c => c.id));
        const newComments = data.filter(c => !existingIds.has(c.id));

        // If there are new comments, add them without replacing the entire list
        if (newComments.length > 0) {
          return [...prevComments, ...newComments];
        }

        // If no new comments, return the same reference to prevent re-renders
        return prevComments;
      });
    } catch (error) {
      console.error('Failed to sync comments:', error);
      // Silently fail - don't disrupt the user experience
    }
  }, []);

  const handlePostComment = useCallback(async () => {
    if ((!newComment.trim() && attachedFiles.length === 0) || !selectedTask) return;

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
            file
          );
        }
      } else {
        // Just text comment
        await apiService.addTaskComment(
          Number(selectedTask.id),
          newComment.trim()
        );
      }

      setNewComment('');
      setAttachedFiles([]);


      // Sync comments immediately after posting (only adds new comments, no blinking)
      await syncTaskComments(Number(selectedTask.id));

      toast({
        title: 'Success',
        description: 'Comment posted successfully',
      });
      // Scroll to bottom after posting
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Failed to post comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive',
      });
    } finally {
      setIsPostingComment(false);
    }
  }, [newComment, attachedFiles, selectedTask, toast, syncTaskComments]);



  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const removeAttachedFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);



  const handleDeleteComment = useCallback(async (commentId: number) => {
    if (!selectedTask) return;

    try {
      await apiService.deleteTaskComment(Number(selectedTask.id), commentId);
      setTaskComments(prev => prev.filter(c => c.id !== commentId));
      toast({
        title: 'Success',
        description: 'Comment deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    }
  }, [selectedTask, toast]);

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
      setNewComment('');
    }
  }, [selectedTask, loadTaskComments, syncTaskComments]);

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    if (taskComments.length > 0) {
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [taskComments]);

  const resetEditState = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditingTask(null);
    setEditTaskForm({
      title: '',
      description: '',
      assignedTo: '',
      deadline: '',
    });
    setIsUpdatingTask(false);
  }, []);

  const handleEditClick = useCallback((task: TaskWithPassMeta) => {
    setEditingTask(task);
    setEditTaskForm({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo[0] || '',
      deadline: formatDateForInput(task.deadline),
    });
    setIsEditDialogOpen(true);
  }, []);

  const handleReassignClick = useCallback((task: TaskWithPassMeta) => {
    setReassignTask(task);
    // Set default deadline to today if no existing deadline or if existing deadline is in the past
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const existingDeadline = formatDateForInput(task.deadline);
    const defaultDeadline = existingDeadline && new Date(existingDeadline) >= today ? existingDeadline : todayString;

    setReassignForm({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo[0] || '',
      deadline: defaultDeadline,
      priority: task.priority,
    });
    setIsReassignDialogOpen(true);
  }, []);

  const resetReassignState = useCallback(() => {
    setIsReassignDialogOpen(false);
    setReassignTask(null);
    setReassignForm({
      title: '',
      description: '',
      assignedTo: '',
      deadline: new Date().toISOString().split('T')[0], // Reset to today's date
      priority: 'medium',
    });
    setIsReassigning(false);
  }, []);

  const handleReassignTask = useCallback(async () => {
    if (!reassignTask) return;
    if (!authToken) {
      toast({
        title: 'Authentication required',
        description: 'Please log in again to reassign tasks.',
        variant: 'destructive',
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
          title: 'Invalid deadline',
          description: 'Task deadline cannot be in the past. Please select today or a future date.',
          variant: 'destructive',
        });
        return;
      }
    }

    const trimmedTitle = reassignForm.title.trim();
    const trimmedDescription = reassignForm.description.trim();
    if (!trimmedTitle) {
      toast({
        title: 'Title required',
        description: 'Task title cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    if (!trimmedDescription) {
      toast({
        title: 'Description required',
        description: 'Task description cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    if (!reassignForm.assignedTo) {
      toast({
        title: 'Assignee required',
        description: 'Please choose who the task should be assigned to.',
        variant: 'destructive',
      });
      return;
    }

    const assignedToNumber = Number(reassignForm.assignedTo);
    if (!Number.isFinite(assignedToNumber)) {
      toast({
        title: 'Invalid assignee',
        description: 'Unable to determine the selected assignee.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: trimmedDescription,
      assigned_to: assignedToNumber,
      due_date: reassignForm.deadline || null,
      status: 'Pending', // Reset status to Pending when reassigning
    };

    setIsReassigning(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${reassignTask.id}`, {
        method: 'PUT',
        headers: authorizedHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData?.detail ?? `Failed to reassign task (${response.status})`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      const updatedTask: BackendTask = await response.json();
      let converted = mapBackendTaskToFrontend(updatedTask);

      // Reset status to 'todo' (Pending) when reassigning, regardless of previous status
      converted = { ...converted, status: 'todo' };

      setTasks((prev) => prev.map((task) => (task.id === converted.id ? converted : task)));
      setSelectedTask((prev) => (prev && prev.id === converted.id ? converted : prev));

      await fetchAndStoreHistory(converted.id);

      // Send notification to the new assignee
      if (converted.assignedTo[0] && userId && converted.assignedTo[0] !== userId) {
        addNotification({
          title: 'Task Reassigned',
          message: `${user?.name} reassigned you a task: "${converted.title}"`,
          type: 'task',
          metadata: {
            taskId: converted.id,
            requesterId: user?.id,
            requesterName: user?.name,
          }
        });
      }

      toast({
        title: 'Task reassigned successfully',
        description: `Task "${converted.title}" has been reassigned to ${getAssigneeLabel(converted.assignedTo[0] || '')} and reset to To Do.`,
      });

      resetReassignState();
    } catch (error) {
      console.error('Failed to reassign task', error);
      const message = error instanceof Error ? error.message : 'Unable to reassign the task. Please try again.';
      toast({
        title: 'Task reassignment failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsReassigning(false);
    }
  }, [authToken, authorizedHeaders, fetchAndStoreHistory, getAssigneeLabel, reassignForm, reassignTask, resetReassignState, toast, user, userId, addNotification]);

  const handleUpdateTask = useCallback(async () => {
    if (!editingTask) return;
    if (!authToken) {
      toast({
        title: 'Authentication required',
        description: 'Please log in again to update tasks.',
        variant: 'destructive',
      });
      return;
    }

    // Validate deadline is required
    if (!editTaskForm.deadline) {
      toast({
        title: 'Deadline required',
        description: 'Please set a deadline for the task.',
        variant: 'destructive',
      });
      return;
    }

    // Validate deadline is not in the past
    const selectedDate = new Date(editTaskForm.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

    if (selectedDate < today) {
      toast({
        title: 'Invalid deadline',
        description: 'Task deadline cannot be in the past. Please select today or a future date.',
        variant: 'destructive',
      });
      return;
    }

    const trimmedTitle = editTaskForm.title.trim();
    const trimmedDescription = editTaskForm.description.trim();
    if (!trimmedTitle) {
      toast({
        title: 'Title required',
        description: 'Task title cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    if (!trimmedDescription) {
      toast({
        title: 'Description required',
        description: 'Task description cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    const currentAssignee = editingTask.assignedTo[0] || '';
    const nextAssignee = editTaskForm.assignedTo || currentAssignee;
    if (!nextAssignee) {
      toast({
        title: 'Assignee required',
        description: 'Please choose who the task should be assigned to.',
        variant: 'destructive',
      });
      return;
    }

    const assignedToNumber = Number(nextAssignee);
    if (!Number.isFinite(assignedToNumber)) {
      toast({
        title: 'Invalid assignee',
        description: 'Unable to determine the selected assignee.',
        variant: 'destructive',
      });
      return;
    }

    const payload: Record<string, unknown> = {};
    if (trimmedTitle !== editingTask.title) {
      payload.title = trimmedTitle;
    }
    if (trimmedDescription !== editingTask.description) {
      payload.description = trimmedDescription;
    }
    if (nextAssignee !== currentAssignee) {
      payload.assigned_to = assignedToNumber;
    }

    const originalDeadline = editingTask.deadline ? formatDateForInput(editingTask.deadline) : '';
    if (editTaskForm.deadline !== originalDeadline) {
      payload.due_date = editTaskForm.deadline || null;
    }

    if (Object.keys(payload).length === 0) {
      toast({
        title: 'No changes detected',
        description: 'Update at least one field before saving.',
        variant: 'default',
      });
      return;
    }

    setIsUpdatingTask(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: authorizedHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData?.detail ?? `Failed to update task (${response.status})`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      const updatedTask: BackendTask = await response.json();
      const converted = mapBackendTaskToFrontend(updatedTask);
      setTasks((prev) => prev.map((task) => (task.id === converted.id ? converted : task)));
      setSelectedTask((prev) => (prev && prev.id === converted.id ? converted : prev));

      await fetchAndStoreHistory(converted.id);

      toast({
        title: 'Task updated',
        description: `Task "${converted.title}" has been updated successfully.`,
      });

      resetEditState();
    } catch (error) {
      console.error('Failed to update task', error);
      const message = error instanceof Error ? error.message : 'Unable to update the task. Please try again.';
      toast({
        title: 'Task update failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingTask(false);
    }
  }, [authToken, authorizedHeaders, editTaskForm.deadline, editTaskForm.description, editTaskForm.assignedTo, editTaskForm.title, editingTask, fetchAndStoreHistory, resetEditState, toast]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!authToken) {
      toast({
        title: 'Authentication required',
        description: 'Please log in again to delete tasks.',
        variant: 'destructive',
      });
      return;
    }

    const confirmDelete = window.confirm('Are you sure you want to delete this task?');
    if (!confirmDelete) return;

    setDeletingTaskId(taskId);
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: authorizedHeaders,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData?.detail ?? `Failed to delete task (${response.status})`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      setSelectedTask((prev) => (prev && prev.id === taskId ? null : prev));
      setTaskHistory((prev) => {
        if (!(taskId in prev)) return prev;
        const next = { ...prev };
        delete next[taskId];
        return next;
      });

      toast({
        title: 'Task deleted',
        description: 'The task has been removed successfully.',
      });
    } catch (error) {
      console.error('Failed to delete task', error);
      const message = error instanceof Error ? error.message : 'Unable to delete the task. Please try again.';
      toast({
        title: 'Task deletion failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingTaskId(null);
    }
  }, [authToken, authorizedHeaders, toast]);

  // Helper function to check if task is overdue
  const isTaskOverdue = useCallback((task: TaskWithPassMeta): boolean => {
    return task.status === 'overdue';
  }, []);

  // Helper function to check if a status transition is allowed
  const isStatusTransitionAllowed = useCallback((currentStatus: BaseTask['status'], newStatus: BaseTask['status']): boolean => {
    // Define status hierarchy
    const statusHierarchy: BaseTask['status'][] = ['todo', 'in-progress', 'overdue', 'completed', 'cancelled'];
    const currentIndex = statusHierarchy.indexOf(currentStatus);
    const newIndex = statusHierarchy.indexOf(newStatus);

    // Special rules:
    // 1. Can move from 'todo' to 'in-progress' and back
    if (currentStatus === 'todo' || (currentStatus === 'in-progress' && newStatus === 'todo')) {
      return true;
    }

    // 2. Overdue tasks are locked - status cannot be changed directly
    // Users must reassign the task to reset the status/deadline
    if (currentStatus === 'overdue') {
      return false;
    }

    // 3. Can move from 'in-progress' to 'overdue' (automatic or manual)
    if (currentStatus === 'in-progress' && newStatus === 'overdue') {
      return true;
    }

    // 4. Once completed or cancelled, cannot go back to previous statuses
    if (currentIndex >= 4 && newIndex < 4) {
      return false;
    }

    // 5. Can always move forward or stay at current status
    if (newIndex >= currentIndex) {
      return true;
    }

    return false;
  }, []);

  // Check if task can be deleted/cancelled
  // Task can only be deleted by creator if status is 'todo' (not started)
  // Once assignee changes status to 'in-progress' or beyond, creator cannot delete
  const canDeleteTask = useCallback((task: TaskWithPassMeta): boolean => {
    if (!userId) return false;

    // Only the creator can delete
    const isCreator = task.assignedBy === userId;
    if (!isCreator) return false;

    // Can only delete if task is still in 'todo' status (not started)
    return task.status === 'todo';
  }, [userId]);

  // Check if task can be reassigned
  // Task can be reassigned by creator if status is 'completed' or 'cancelled'
  const canReassignTask = useCallback((task: TaskWithPassMeta): boolean => {
    if (!userId) return false;

    // Only the creator can reassign
    const isCreator = task.assignedBy === userId;
    if (!isCreator) return false;

    // Can only reassign if task is completed, cancelled, or overdue
    return task.status === 'completed' || task.status === 'cancelled' || task.status === 'overdue';
  }, [userId]);

  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: BaseTask['status']) => {
    setUpdatingTaskId(taskId);
    try {
      const backendStatus = frontendToBackendStatus[newStatus];
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/status?status=${encodeURIComponent(backendStatus)}`, {
        method: 'PUT',
        headers: authorizedHeaders,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to update status (${response.status})`);
      }

      const updatedTask: BackendTask = await response.json();
      const convertedTask = mapBackendTaskToFrontend(updatedTask);

      // Update tasks list immediately
      setTasks((prev) => prev.map((task) => (task.id === taskId ? convertedTask : task)));

      // Update selected task if it's the one being updated
      setSelectedTask((prev) => (prev && prev.id === taskId ? convertedTask : prev));

      await fetchAndStoreHistory(convertedTask.id);

      toast({
        title: 'Status updated successfully',
        description: `Task marked as ${newStatus.replace('-', ' ')}`,
      });
    } catch (err: unknown) {
      console.error('Failed to update task status', err);
      const message = err instanceof Error ? err.message : 'Unable to update task status. Please try again.';
      toast({
        title: 'Status update failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Get status color
  const getStatusColor = (status: BaseTask['status']) => {
    switch (status) {
      case 'todo': return 'bg-slate-500';
      case 'in-progress': return 'bg-blue-500';
      case 'overdue': return 'bg-orange-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: BaseTask['priority']) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800';
      case 'medium': return 'bg-gray-100 text-gray-800';
      case 'high': return 'bg-gray-100 text-gray-800';
      case 'urgent': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Capitalize priority text
  const capitalizePriority = (priority: BaseTask['priority']) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  // Export functions
  const getFilteredTasksForExport = useCallback(() => {
    let filteredTasks = [...tasks];

    // Apply date range filter
    if (exportDateRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (exportDateRange) {
        case '1month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '3months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case '6months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
          break;
        case 'custom':
          if (exportStartDate) {
            startDate = new Date(exportStartDate);
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          }
          break;
        default:
          startDate = new Date(now.getFullYear(), 0, 1);
      }

      const endDate = exportEndDate ? new Date(exportEndDate) : new Date();
      filteredTasks = filteredTasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate >= startDate && taskDate <= endDate;
      });
    }

    // Apply department filter
    if (exportDepartmentFilter !== 'all') {
      filteredTasks = filteredTasks.filter(task => {
        const assignee = employeesById.get(task.assignedTo[0] || '');
        const assigner = employeesById.get(task.assignedBy);
        return (assignee?.department === exportDepartmentFilter) || (assigner?.department === exportDepartmentFilter);
      });
    }

    // Apply user filter
    if (exportUserFilter !== 'all') {
      filteredTasks = filteredTasks.filter(task =>
        task.assignedTo.includes(exportUserFilter) ||
        task.assignedBy === exportUserFilter
      );
    }

    // Apply department filter for non-admin users
    if (user?.role !== 'admin' && user?.department) {
      filteredTasks = filteredTasks.filter(task => {
        const assignee = employeesById.get(task.assignedTo[0] || '');
        const assigner = employeesById.get(task.assignedBy);
        return (assignee?.department === user.department) || (assigner?.department === user.department);
      });
    }

    return filteredTasks;
  }, [tasks, exportDateRange, exportStartDate, exportEndDate, exportDepartmentFilter, exportUserFilter, user, employeesById]);

  const exportToCSV = useCallback(() => {
    const filteredTasks = getFilteredTasksForExport();

    const headers = [
      'Task ID',
      'Title',
      'Description',
      'Status',
      'Priority',
      'Assigned By',
      'Assigned To',
      'Created Date',
      'Due Date',
      'Completed Date',
      'Department',
      'Last Passed By',
      'Last Passed To',
      'Last Pass Note'
    ];

    const csvData = filteredTasks.map(task => {
      const assignee = employeesById.get(task.assignedTo[0] || '');
      const assigner = employeesById.get(task.assignedBy);
      const lastPassedBy = task.lastPassedBy ? employeesById.get(task.lastPassedBy) : null;
      const lastPassedTo = task.lastPassedTo ? employeesById.get(task.lastPassedTo) : null;

      return [
        task.id,
        `"${task.title.replace(/"/g, '""')}"`,
        `"${task.description.replace(/"/g, '""')}"`,
        task.status.replace('-', ' ').toUpperCase(),
        task.priority.toUpperCase(),
        assigner?.name || 'Unknown',
        assignee?.name || 'Unknown',
        task.createdAt ? formatDateTimeIST(task.createdAt, 'MMM dd, yyyy HH:mm') : '',
        task.deadline ? formatDateIST(parseToIST(task.deadline) || new Date(), 'MMM dd, yyyy') : '',
        task.completedDate ? formatDateTimeIST(task.completedDate, 'MMM dd, yyyy HH:mm') : '',
        assignee?.department || assigner?.department || 'Unknown',
        lastPassedBy?.name || '',
        lastPassedTo?.name || '',
        `"${(task.lastPassNote || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const dateRange = exportDateRange === 'custom'
      ? `${exportStartDate || 'start'}_${exportEndDate || 'end'}`
      : exportDateRange;
    const userFilter = exportUserFilter !== 'all' ? `_user_${exportUserFilter}` : '';

    link.setAttribute('href', url);
    link.setAttribute('download', `task_report_${dateRange}${userFilter}_${formatDateIST(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [getFilteredTasksForExport, employeesById, exportDateRange, exportStartDate, exportEndDate, exportUserFilter]);

  const exportToPDF = useCallback(async () => {
    const filteredTasks = getFilteredTasksForExport();

    // Simple PDF export using window.print() styled for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Export Failed',
        description: 'Please allow popups for this site to export PDF.',
        variant: 'destructive',
      });
      return;
    }

    const dateRange = exportDateRange === 'custom'
      ? `${exportStartDate || 'start'} - ${exportEndDate || 'end'}`
      : exportDateRange === 'all' ? 'All Time' : exportDateRange;
    const userFilter = exportUserFilter !== 'all'
      ? employeesById.get(exportUserFilter)?.name || 'Unknown User'
      : 'All Users';

    const tableRows = filteredTasks.map(task => {
      const assignee = employeesById.get(task.assignedTo[0] || '');
      const assigner = employeesById.get(task.assignedBy);
      const lastPassedBy = task.lastPassedBy ? employeesById.get(task.lastPassedBy) : null;
      const lastPassedTo = task.lastPassedTo ? employeesById.get(task.lastPassedTo) : null;

      return `
        <tr>
          <td>${task.id}</td>
          <td>${task.title}</td>
          <td>${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</td>
          <td><span class="status-${task.status}">${task.status.replace('-', ' ').toUpperCase()}</span></td>
          <td><span class="priority-${task.priority}">${task.priority.toUpperCase()}</span></td>
          <td>${assigner?.name || 'Unknown'}</td>
          <td>${assignee?.name || 'Unknown'}</td>
          <td>${task.createdAt ? formatDateTimeIST(task.createdAt, 'MMM dd, yyyy HH:mm') : ''}</td>
          <td>${task.deadline ? formatDateIST(parseToIST(task.deadline) || new Date(), 'MMM dd, yyyy') : ''}</td>
          <td>${task.completedDate ? formatDateTimeIST(task.completedDate, 'MMM dd, yyyy HH:mm') : ''}</td>
          <td>${assignee?.department || assigner?.department || 'Unknown'}</td>
          <td>${lastPassedBy?.name || ''}</td>
          <td>${lastPassedTo?.name || ''}</td>
          <td>${task.lastPassNote || ''}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Task Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #4F46E5; }
            .header-info { margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4F46E5; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .status-todo { background: #94a3b8; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
            .status-in-progress { background: #3b82f6; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
            .status-completed { background: #10b981; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
            .priority-low { background: #10b981; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
            .priority-medium { background: #f59e0b; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
            .priority-high { background: #ef4444; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
            .priority-urgent { background: #dc2626; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
            @media print { body { margin: 10px; } }
          </style>
        </head>
        <body>
          <h1>Task Management Report</h1>
          <div class="header-info">
            <p><strong>Date Range:</strong> ${dateRange}</p>
            <p><strong>User Filter:</strong> ${userFilter}</p>
            <p><strong>Total Tasks:</strong> ${filteredTasks.length}</p>
            <p><strong>Generated on:</strong> ${formatDateTimeIST(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned By</th>
                <th>Assigned To</th>
                <th>Created</th>
                <th>Due Date</th>
                <th>Completed</th>
                <th>Department</th>
                <th>Last Passed By</th>
                <th>Last Passed To</th>
                <th>Pass Note</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Wait for the content to load before printing
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }, [getFilteredTasksForExport, employeesById, exportDateRange, exportStartDate, exportEndDate, exportUserFilter]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      if (exportFormat === 'csv') {
        exportToCSV();
      } else {
        await exportToPDF();
      }

      toast({
        title: 'Export Successful',
        description: `Task report exported as ${exportFormat.toUpperCase()}`,
      });

      setIsExportDialogOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export task report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [exportFormat, exportToCSV, exportToPDF, toast]);

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800 rounded-2xl p-6 shadow-sm border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <ListTodo className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Task Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage and track all tasks across your organization
              </p>
            </div>
          </div>

          {canAssignTasks() && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md">
                  <Plus className="h-4 w-4" />
                  Create Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 shadow-2xl">
                <DialogHeader className="pb-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 -m-6 mb-0 p-6 rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <Plus className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-bold">Create New Task</DialogTitle>
                      <DialogDescription className="mt-1">
                        Assign a new task to team members
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-5 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-semibold flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600"></div>
                      Task Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') })}
                      placeholder="Enter task title"
                      className="h-11 border-2 focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-semibold flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600"></div>
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') })}
                      placeholder="Enter task description"
                      rows={4}
                      className="resize-none border-2 focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority" className="text-sm font-semibold flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-violet-600" />
                        Priority
                      </Label>
                      <Select
                        value={newTask.priority}
                        onValueChange={(value: BaseTask['priority']) =>
                          setNewTask({ ...newTask, priority: value })
                        }
                      >
                        <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-2 shadow-xl" side="bottom">
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
                      <Label htmlFor="deadline" className="text-sm font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-violet-600" />
                        Deadline <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="deadline"
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={newTask.deadline}
                        onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                        className="h-11 border-2 focus:ring-2 focus:ring-violet-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {['admin', 'hr', 'manager'].includes(user?.role || '') && (
                      <div className={['admin', 'hr'].includes(user?.role || '') ? "space-y-2" : "space-y-2 col-span-full"}>
                        <Label htmlFor="assignRoleFilter" className="text-sm font-semibold flex items-center gap-2">
                          <Filter className="h-4 w-4 text-violet-600" />
                          Filter Role
                        </Label>
                        <Select
                          value={assignRoleFilter}
                          onValueChange={(value: 'all' | UserRole) => setAssignRoleFilter(value)}
                        >
                          <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                            <SelectValue placeholder="All Roles" />
                          </SelectTrigger>
                          <SelectContent className="border-2 shadow-xl" side="bottom">
                            <SelectItem value="all">All Roles</SelectItem>
                            {user?.role === 'admin' && (
                              <>
                                <SelectItem value="hr">HR</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="team_lead">Team Lead</SelectItem>
                                <SelectItem value="employee">Employee</SelectItem>
                              </>
                            )}
                            {user?.role === 'hr' && (
                              <>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="team_lead">Team Lead</SelectItem>
                                <SelectItem value="employee">Employee</SelectItem>
                              </>
                            )}
                            {user?.role === 'manager' && (
                              <>
                                <SelectItem value="team_lead">Team Lead</SelectItem>
                                <SelectItem value="employee">Employee</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {['admin', 'hr'].includes(user?.role || '') && (
                      <div className="space-y-2">
                        <Label htmlFor="assignDeptFilter" className="text-sm font-semibold flex items-center gap-2">
                          <Building2 className="h-4.4 w-4.5 text-violet-600" />
                          Filter Department
                        </Label>
                        <Select
                          value={newTask.department || 'all'}
                          onValueChange={(value) => setNewTask({ ...newTask, department: value === 'all' ? '' : value })}
                        >
                          <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                            <SelectValue placeholder="All Departments" />
                          </SelectTrigger>
                          <SelectContent className="border-2 shadow-xl" side="bottom">
                            <SelectItem value="all">All Departments</SelectItem>
                            {CORE_DEPARTMENTS
                              .slice()
                              .sort((a, b) => a.localeCompare(b))
                              .map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="assignTo" className="text-sm font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-violet-600" />
                      Assign To <span className="text-red-500">*</span>
                    </Label>

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

                    <div className="border-2 rounded-xl p-4 max-h-[250px] overflow-y-auto space-y-2.5 bg-white dark:bg-gray-950 shadow-inner custom-scrollbar border-violet-50">
                      {/* Select All Option */}
                      <div className="flex items-center space-x-3 pb-3 mb-1 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-gray-950 z-10">
                        <Checkbox
                          id="select-all-employees"
                          checked={
                            canAssignToSelection
                              .filter((emp) => emp.userId !== userId)
                              .filter((emp) => assignRoleFilter === 'all' || emp.role === assignRoleFilter)
                              .filter((emp) => !newTask.department || (emp.department && emp.department.trim().toLowerCase() === newTask.department.trim().toLowerCase()))
                              .filter((emp) => {
                                const search = assigneeSearchQuery.toLowerCase();
                                return emp.name.toLowerCase().includes(search) ||
                                  emp.email.toLowerCase().includes(search) ||
                                  emp.employeeId.toLowerCase().includes(search);
                              })
                              .every(emp => newTask.assignedTo.includes(emp.userId)) &&
                            canAssignToSelection
                              .filter((emp) => emp.userId !== userId)
                              .filter((emp) => assignRoleFilter === 'all' || emp.role === assignRoleFilter)
                              .filter((emp) => !newTask.department || (emp.department && emp.department.trim().toLowerCase() === newTask.department.trim().toLowerCase()))
                              .filter((emp) => {
                                const search = assigneeSearchQuery.toLowerCase();
                                return emp.name.toLowerCase().includes(search) ||
                                  emp.email.toLowerCase().includes(search) ||
                                  emp.employeeId.toLowerCase().includes(search);
                              }).length > 0
                          }
                          onCheckedChange={(checked) => {
                            const filteredEmps = canAssignToSelection
                              .filter((emp) => emp.userId !== userId)
                              .filter((emp) => assignRoleFilter === 'all' || emp.role === assignRoleFilter)
                              .filter((emp) => !newTask.department || (emp.department && emp.department.trim().toLowerCase() === newTask.department.trim().toLowerCase()))
                              .filter((emp) => {
                                const search = assigneeSearchQuery.toLowerCase();
                                return emp.name.toLowerCase().includes(search) ||
                                  emp.email.toLowerCase().includes(search) ||
                                  emp.employeeId.toLowerCase().includes(search);
                              });

                            if (checked) {
                              const newIds = Array.from(new Set([...newTask.assignedTo, ...filteredEmps.map(e => e.userId)]));
                              setNewTask(prev => ({ ...prev, assignedTo: newIds }));
                            } else {
                              const idsToRemove = filteredEmps.map(e => e.userId);
                              setNewTask(prev => ({ ...prev, assignedTo: prev.assignedTo.filter(id => !idsToRemove.includes(id)) }));
                            }
                          }}
                        />
                        <Label htmlFor="select-all-employees" className="text-sm cursor-pointer font-bold text-violet-600 dark:text-violet-400">
                          Select All Visible
                        </Label>
                        <span className="text-[10px] bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 px-2 py-0.5 rounded-full font-bold ml-auto">
                          {newTask.assignedTo.length} Selected
                        </span>
                      </div>

                      {/* Current User (Self) */}
                      {userId && user && (
                        (!assigneeSearchQuery || user.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) || user.email.toLowerCase().includes(assigneeSearchQuery.toLowerCase())) && (
                          <div className="flex items-center space-x-3 py-2 px-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                            <Checkbox
                              id={`emp-${userId}`}
                              checked={newTask.assignedTo.includes(userId)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewTask(prev => ({ ...prev, assignedTo: [...prev.assignedTo, userId] }));
                                } else {
                                  setNewTask(prev => ({ ...prev, assignedTo: prev.assignedTo.filter(id => id !== userId) }));
                                }
                              }}
                            />
                            <Label htmlFor={`emp-${userId}`} className="text-sm cursor-pointer font-semibold flex-1 flex items-center justify-between">
                              <span>{user.name} <span className="text-violet-500 font-bold ml-1">(Self)</span></span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{formatRoleLabel(user.role)}</span>
                            </Label>
                          </div>
                        )
                      )}

                      {/* Filtered Employees List */}
                      {canAssignToSelection
                        .filter((emp) => emp.userId !== userId)
                        .filter((emp) => assignRoleFilter === 'all' || emp.role === assignRoleFilter)
                        .filter((emp) => !newTask.department || (emp.department && emp.department.trim().toLowerCase() === newTask.department.trim().toLowerCase()))
                        .filter((emp) => {
                          const search = assigneeSearchQuery.toLowerCase();
                          return emp.name.toLowerCase().includes(search) ||
                            emp.email.toLowerCase().includes(search) ||
                            emp.employeeId.toLowerCase().includes(search);
                        })
                        .map((emp) => (
                          <div key={emp.userId} className="flex items-center space-x-3 py-2 px-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                            <Checkbox
                              id={`emp-${emp.userId}`}
                              checked={newTask.assignedTo.includes(emp.userId)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewTask(prev => ({ ...prev, assignedTo: [...prev.assignedTo, emp.userId] }));
                                } else {
                                  setNewTask(prev => ({ ...prev, assignedTo: prev.assignedTo.filter(id => id !== emp.userId) }));
                                }
                              }}
                            />
                            <Label htmlFor={`emp-${emp.userId}`} className="text-sm cursor-pointer flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-800 dark:text-slate-200">{emp.name}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground uppercase tracking-widest font-semibold">{formatRoleLabel(emp.role)}</span>
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
                      {isSubmitting ? 'Creating...' : 'Create Task'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards - Clickable Filters */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <Card
          onClick={() => {
            setFilterStatus('all');
            setIsOverdueFilterActive(false);
          }}
          className={`border-2 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${filterStatus === 'all' && !isOverdueFilterActive
            ? 'border-slate-600 dark:border-slate-400 bg-slate-100 dark:bg-slate-800'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600'
            }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-700 dark:text-slate-300">Total Tasks</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
              <ListTodo className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {taskCountsByStatus.total}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterStatus('in-progress');
            setIsOverdueFilterActive(false);
          }}
          className={`border-2 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${filterStatus === 'in-progress' && !isOverdueFilterActive
            ? 'border-blue-600 dark:border-blue-400 bg-blue-100 dark:bg-blue-900'
            : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 hover:border-blue-400 dark:hover:border-blue-600'
            }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-blue-700 dark:text-blue-300">In Progress</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {taskCountsByStatus.inProgress}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterStatus('completed');
            setIsOverdueFilterActive(false);
          }}
          className={`border-2 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${filterStatus === 'completed' && !isOverdueFilterActive
            ? 'border-green-600 dark:border-green-400 bg-green-100 dark:bg-green-900'
            : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 hover:border-green-400 dark:hover:border-green-600'
            }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-green-700 dark:text-green-300">Completed</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-green-200 dark:bg-green-800 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {taskCountsByStatus.completed}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterStatus('all');
            setIsOverdueFilterActive(true);
          }}
          className={`border-2 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${isOverdueFilterActive
            ? 'border-orange-600 dark:border-orange-400 bg-orange-100 dark:bg-orange-900'
            : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950 hover:border-orange-400 dark:hover:border-orange-600'
            }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-orange-700 dark:text-orange-300">Overdue</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-orange-200 dark:bg-orange-800 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {taskCountsByStatus.overdue}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterStatus('cancelled');
            setIsOverdueFilterActive(false);
          }}
          className={`border-2 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${filterStatus === 'cancelled' && !isOverdueFilterActive
            ? 'border-gray-600 dark:border-gray-400 bg-gray-100 dark:bg-gray-800'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-gray-700 dark:text-gray-300">Cancelled</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {taskCountsByStatus.cancelled}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Filter className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-xl font-semibold">Task Management</CardTitle>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 w-full sm:w-[200px] h-10 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-violet-500"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-[150px] h-10 bg-white dark:bg-gray-950">
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
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter</Label>
                <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1 h-10">
                  {user?.role === 'admin' ? (
                    <>
                      <Button
                        size="sm"
                        variant={taskOwnershipFilter === 'created' ? 'default' : 'outline'}
                        onClick={() => setTaskOwnershipFilter('created')}
                        className={taskOwnershipFilter === 'created' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md' : 'h-8'}
                      >
                        Created
                      </Button>
                      <Button
                        size="sm"
                        variant={taskOwnershipFilter === 'all' ? 'default' : 'outline'}
                        onClick={() => {
                          setTaskOwnershipFilter('all');
                          setSelectedDepartmentFilter('all');
                        }}
                        className={taskOwnershipFilter === 'all' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md' : 'h-8'}
                      >
                        All Tasks
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant={taskOwnershipFilter === 'received' ? 'default' : 'outline'}
                        onClick={() => setTaskOwnershipFilter('received')}
                        className={taskOwnershipFilter === 'received' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md' : 'h-8'}
                      >
                        Received
                      </Button>
                      <Button
                        size="sm"
                        variant={taskOwnershipFilter === 'created' ? 'default' : 'outline'}
                        onClick={() => setTaskOwnershipFilter('created')}
                        className={taskOwnershipFilter === 'created' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md' : 'h-8'}
                      >
                        Created
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Department Filter - Show when viewing All Tasks for Admin only */}
              {taskOwnershipFilter === 'all' && user?.role === 'admin' && (
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</Label>
                  <Select
                    value={selectedDepartmentFilter}
                    onValueChange={setSelectedDepartmentFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[180px] h-10 bg-white dark:bg-gray-950">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {user?.role === 'admin' && (
                        <SelectItem value="all">All Departments</SelectItem>
                      )}
                      {departments
                        .filter(dept => CORE_DEPARTMENTS.some(core => core.toLowerCase() === dept.toLowerCase()))
                        .sort((a, b) => a.localeCompare(b))
                        .map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'bg-gradient-to-r from-violet-600 to-purple-600' : ''}
                >
                  <ListTodo className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className={viewMode === 'grid' ? 'bg-gradient-to-r from-violet-600 to-purple-600' : ''}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </div>

              {/* Export Buttons */}
              {canAssignTasks() && (
                <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-800 pl-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsExportDialogOpen(true)}
                    className="gap-2 h-10 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-md hover:shadow-violet-200 dark:hover:shadow-violet-900/50 transition-all duration-200"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {viewMode === 'list' ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Task</TableHead>
                      <TableHead>Assigned By</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pass</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingTasks ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Loading tasks...
                        </TableCell>
                      </TableRow>
                    ) : visibleTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {taskOwnershipFilter === 'all'
                            ? 'No tasks found in the system'
                            : taskOwnershipFilter === 'created'
                              ? user?.role === 'admin'
                                ? 'No tasks created yet. Create your first task to get started.'
                                : 'No tasks created by you yet'
                              : 'No tasks assigned to you yet'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTasks.map((task) => {
                        const assignedByInfo = getAssignedByInfo(task.assignedBy, task.assignedByRole);
                        const assignedToInfo = getAssignedToInfo(task.assignedTo[0] || '', task.assignedToRole);
                        // In "All Tasks" view, admin can only manage tasks they created
                        const canManageTask = Boolean(userId && task.assignedBy === userId);
                        const isReceivedTask = Boolean(userId && task.assignedTo.includes(userId));
                        // Don't allow passing completed, cancelled, or overdue tasks
                        const canPassTask = isReceivedTask && task.assignedTo[0] === userId && passEligibleEmployees.length > 0 && task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'overdue';
                        const lastPassByLabel = task.lastPassedBy ? getAssigneeLabel(task.lastPassedBy) : null;
                        const lastPassToLabel = task.lastPassedTo ? getAssigneeLabel(task.lastPassedTo) : null;
                        const lastPassTimestamp = task.lastPassedAt ? formatDateTimeIST(task.lastPassedAt, 'MMM dd, yyyy HH:mm') : null;
                        return (
                          <TableRow key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                            <TableCell
                              className="cursor-pointer group hover:bg-violet-50/30 dark:hover:bg-violet-900/10 transition-colors"
                              onClick={() => setSelectedTask(task)}
                            >
                              <div className="max-w-[300px] py-1">
                                <div className="mb-1">
                                  <TruncatedText
                                    text={task.title}
                                    maxLength={40}
                                    showToggle={false}
                                    textClassName="font-semibold text-sm group-hover:text-violet-600 transition-colors"
                                  />
                                </div>
                                <TruncatedText
                                  text={task.description}
                                  maxLength={80}
                                  showToggle={false}
                                  textClassName="text-xs text-muted-foreground leading-relaxed"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{assignedByInfo.name}</span>
                                  {assignedByInfo.roleLabel ? (
                                    <span className="text-xs text-muted-foreground mt-0.5">{assignedByInfo.roleLabel}</span>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{assignedToInfo.name}</span>
                                  {assignedToInfo.roleLabel ? (
                                    <span className="text-xs text-muted-foreground mt-0.5">{assignedToInfo.roleLabel}</span>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPriorityColor(task.priority)}>
                                {capitalizePriority(task.priority)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {formatDisplayDate(task.deadline)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(task.status as string) === 'completed' || (task.status as string) === 'cancelled' || (task.status as string) === 'overdue' ? (
                                <div className={`w-[170px] h-10 bg-white dark:bg-gray-950 border-2 rounded-md flex items-center px-3 gap-2 ${(task.status as string) === 'overdue' ? 'border-orange-200 dark:border-orange-800' : 'border-violet-200 dark:border-violet-800'
                                  }`}>
                                  <div className={`h-3 w-3 rounded-full ${(task.status as string) === 'cancelled' ? 'bg-gradient-to-br from-red-400 to-rose-600' :
                                    (task.status as string) === 'overdue' ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                                      'bg-gradient-to-br from-green-400 to-emerald-600'
                                    } shadow-md flex-shrink-0`} />
                                  <span className="font-medium text-sm">
                                    {(task.status as string) === 'cancelled' ? 'Cancelled' :
                                      (task.status as string) === 'overdue' ? 'Overdue' : 'Completed'}
                                  </span>
                                  {(task.status as string) === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0 ml-auto" />}
                                  {(task.status as string) === 'cancelled' && <XCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 ml-auto" />}
                                  {(task.status as string) === 'overdue' && <AlertCircle className="h-3.5 w-3.5 text-orange-600 flex-shrink-0 ml-auto" />}
                                </div>
                              ) : (
                                <Select
                                  value={task.status}
                                  onValueChange={(value: BaseTask['status']) => {
                                    if (isStatusTransitionAllowed(task.status, value)) {
                                      updateTaskStatus(task.id, value);
                                    } else {
                                      toast({
                                        title: 'Invalid Status Change',
                                        description: 'Cannot move back to this status once the task has progressed further.',
                                        variant: 'destructive',
                                      });
                                    }
                                  }}
                                  disabled={updatingTaskId === task.id}
                                >
                                  <SelectTrigger className="w-[170px] h-10 bg-white dark:bg-gray-950 border-2 hover:border-violet-300 dark:hover:border-violet-700 transition-all duration-300 hover:shadow-md">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="border-2 shadow-2xl min-w-[200px]">
                                    {/* Show "To Do" only if allowed */}
                                    {isStatusTransitionAllowed(task.status, 'todo') && (
                                      <SelectItem value="todo" className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors py-2.5">
                                        <div className="flex items-center gap-3">
                                          <div className="h-3 w-3 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 shadow-md animate-pulse flex-shrink-0" />
                                          <span className="font-medium text-sm">To Do</span>
                                        </div>
                                      </SelectItem>
                                    )}
                                    {/* Show "In Progress" only if allowed */}
                                    {isStatusTransitionAllowed(task.status, 'in-progress') && (
                                      <SelectItem value="in-progress" className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors py-2.5">
                                        <div className="flex items-center gap-3">
                                          <div className="h-3 w-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-md animate-pulse flex-shrink-0" />
                                          <span className="font-medium text-sm">In Progress</span>
                                        </div>
                                      </SelectItem>
                                    )}

                                    {/* Show "Completed" only if allowed */}
                                    {isStatusTransitionAllowed(task.status, 'completed') && (
                                      <SelectItem value="completed" className="cursor-pointer hover:bg-green-50 dark:hover:bg-green-950 transition-colors py-2.5">
                                        <div className="flex items-center gap-3">
                                          <div className="h-3 w-3 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-md flex-shrink-0" />
                                          <span className="font-medium text-sm flex-1">Completed</span>
                                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                                        </div>
                                      </SelectItem>
                                    )}
                                    {/* Show Cancel option to task creator for any status except already cancelled/completed */}
                                    {canManageTask && (task.status as string) !== 'cancelled' && (task.status as string) !== 'completed' && (
                                      <SelectItem value="cancelled" className="cursor-pointer hover:bg-red-50 dark:hover:bg-red-950 transition-colors py-2.5">
                                        <div className="flex items-center gap-3">
                                          <div className="h-3 w-3 rounded-full bg-gradient-to-br from-red-400 to-rose-600 shadow-md flex-shrink-0" />
                                          <span className="font-medium text-sm flex-1">Cancelled</span>
                                          <XCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                                        </div>
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
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
                                  className="h-8 px-3 gap-2 text-xs border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950 hover:border-violet-300 dark:hover:border-violet-700 transition-all"
                                >
                                  <Share2 className="h-3.5 w-3.5 text-violet-600" />
                                  View History
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className={`flex flex-wrap items-center gap-2 ${task.status === 'completed' ? 'justify-center' : ''}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedTask(task)}
                                  className="hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950 p-2 h-auto"
                                  title="View task details"
                                >
                                  👁
                                </Button>
                                {task.status !== 'completed' && canPassTask && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openPassDialog(task)}
                                    className="flex items-center gap-1"
                                  >
                                    <Share2 className="h-4 w-4" />
                                    Pass
                                  </Button>
                                )}
                                {task.status !== 'completed' && (task.status as string) !== 'cancelled' && canManageTask && (
                                  <>
                                    {(task.status as string) !== 'overdue' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditClick(task)}
                                        className="hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950 p-2 h-auto"
                                        title="Edit task"
                                      >
                                        ✏️
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteTask(task.id)}
                                      disabled={deletingTaskId === task.id || !canDeleteTask(task)}
                                      className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 p-2 h-auto disabled:opacity-50"
                                      title={!canDeleteTask(task) ? 'Cannot delete task once work has started' : 'Delete task'}
                                    >
                                      {deletingTaskId === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '🗑'}
                                    </Button>
                                  </>
                                )}
                                {canReassignTask(task) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReassignClick(task)}
                                    className="flex items-center gap-1 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
                                  >
                                    <RefreshCcw className="h-4 w-4" />
                                    Reassign
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
                <div className="mt-6 px-2">
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
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {paginatedTasks.map((task) => {
                  const assignedByInfo = getAssignedByInfo(task.assignedBy, task.assignedByRole);
                  const assignedToInfo = getAssignedToInfo(task.assignedTo[0] || '', task.assignedToRole);
                  // In "All Tasks" view, admin can only manage tasks they created
                  const canManageTask = Boolean(userId && task.assignedBy === userId);
                  const isReceivedTask = Boolean(userId && task.assignedTo.includes(userId));
                  // Don't allow passing completed, cancelled, or overdue tasks
                  const canPassTask = isReceivedTask && task.assignedTo[0] === userId && passEligibleEmployees.length > 0 && task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'overdue';
                  const lastPassByLabel = task.lastPassedBy ? getAssigneeLabel(task.lastPassedBy) : null;
                  const lastPassToLabel = task.lastPassedTo ? getAssigneeLabel(task.lastPassedTo) : null;
                  return (
                    <Card
                      key={task.id}
                      className={`border transition-all duration-300 cursor-pointer transform hover:scale-[1.02] shadow-sm hover:shadow-xl group relative overflow-hidden ${isTaskOverdue(task)
                        ? 'border-orange-200 bg-orange-50/30 dark:border-orange-900/50 dark:bg-orange-900/10'
                        : 'border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-950/50'
                        }`}
                      onClick={() => setSelectedTask(task)}
                    >
                      {/* Status Indicator Strip */}
                      <div className={`absolute top-0 left-0 w-1 h-full ${task.status === 'completed' ? 'bg-green-500' :
                        task.status === 'cancelled' ? 'bg-red-500' :
                          task.status === 'overdue' ? 'bg-orange-500' :
                            task.status === 'in-progress' ? 'bg-blue-500' :
                              'bg-slate-400'
                        }`} />

                      <CardHeader className="p-4 pb-0">
                        <div className="flex justify-between items-start gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`${getPriorityColor(task.priority)} text-[10px] px-1.5 h-5 border-0 font-bold uppercase tracking-wider`}>
                                {task.priority}
                              </Badge>
                              {isTaskOverdue(task) && (
                                <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-[10px] px-1.5 h-5 border-0 font-bold uppercase tracking-wider">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            <div className="text-base font-bold leading-tight pr-1">
                              <TruncatedText
                                text={task.title}
                                maxLength={30}
                                showToggle={false}
                                textClassName="text-gray-900 dark:text-gray-100"
                              />
                            </div>
                          </div>
                          {/* Progress Ring or Simple Status Icon */}
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${task.status === 'completed' ? 'border-green-100 bg-green-50 text-green-600 dark:border-green-900/30 dark:bg-green-900/20' :
                            task.status === 'in-progress' ? 'border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/30 dark:bg-blue-900/20' :
                              'border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900'
                            }`}>
                            {typeof task.progress === 'number' && task.progress > 0 ? (
                              <span className="text-[10px] font-bold">{task.progress}%</span>
                            ) : (
                              <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor(task.status)}`} />
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 pt-3 space-y-4">
                        <div className="text-xs text-muted-foreground leading-relaxed">
                          <TruncatedText
                            text={task.description || "No description provided."}
                            maxLength={70}
                            showToggle={false}
                          />
                        </div>

                        {/* Compact Metadata Grid */}
                        <div className="grid grid-cols-1 gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/50">
                          {/* Assignee Row */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <User className="h-3.5 w-3.5" />
                              <span>To:</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[120px]" title={assignedToInfo.name}>{assignedToInfo.name}</span>
                              {assignedToInfo.roleLabel && (
                                <span className="text-[10px] text-muted-foreground">{assignedToInfo.roleLabel}</span>
                              )}
                            </div>
                          </div>

                          {/* Assigner Row */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>By:</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                                {assignedByInfo.name}
                              </span>
                              {assignedByInfo.roleLabel && (
                                <span className="text-[10px] text-muted-foreground">{assignedByInfo.roleLabel}</span>
                              )}
                            </div>
                          </div>

                          {/* Deadline Row */}
                          <div className="flex items-center justify-between text-xs border-t border-slate-200 dark:border-slate-700/50 pt-2 mt-0.5">
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Due:</span>
                            </div>
                            <span className={`font-medium ${isTaskOverdue(task) ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-200'}`}>
                              {formatDisplayDate(task.deadline)}
                            </span>
                          </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-1">
                          {/* Left Side: Pass History Info (Subtle) */}
                          <div className="flex items-center">
                            {task.lastPassedBy ? (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 border border-violet-100 dark:border-violet-900/30 cursor-pointer hover:bg-violet-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); openPassHistoryDialog(task); }}>
                                <Share2 className="h-3 w-3" />
                                <span className="text-[10px] font-medium">History</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground px-1 italic opacity-50">
                                No history
                              </div>
                            )}
                          </div>

                          {/* Right Side: Action Buttons */}
                          <div className="flex items-center gap-1">
                            {/* Reassign Button */}
                            {canReassignTask(task) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleReassignClick(task); }}
                                className="h-7 w-7 p-0 rounded-full hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 text-slate-400"
                                title="Reassign Task"
                              >
                                <RefreshCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Pass Button */}
                            {task.status !== 'completed' && canPassTask && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); openPassDialog(task); }}
                                className="h-7 w-7 p-0 rounded-full hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-900/30 dark:hover:text-violet-400 text-slate-400"
                                title="Pass Task"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Edit Button */}
                            {task.status !== 'completed' && (task.status as string) !== 'cancelled' && canManageTask && (task.status as string) !== 'overdue' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleEditClick(task); }}
                                className="h-7 w-7 p-0 rounded-full hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 text-slate-400"
                                title="Edit Task"
                              >
                                <div className="h-3.5 w-3.5">✏️</div>
                              </Button>
                            )}

                            {/* Delete Button */}
                            {task.status !== 'completed' && (task.status as string) !== 'cancelled' && canManageTask && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                disabled={deletingTaskId === task.id || !canDeleteTask(task)}
                                className="h-7 w-7 p-0 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 text-slate-400 disabled:opacity-30"
                                title={!canDeleteTask(task) ? 'Cannot delete started task' : 'Delete Task'}
                              >
                                {deletingTaskId === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '🗑'}
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
                <div className="mt-6 px-2">
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

      {/* Pass Task Dialog */}
      <Dialog open={isPassDialogOpen} onOpenChange={(open) => {
        if (!open) {
          closePassDialog();
        } else {
          setIsPassDialogOpen(true);
        }
      }}>
        <DialogContent className="max-w-xl border-2 shadow-2xl">
          <DialogHeader className="pb-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 -m-6 mb-0 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Share2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Pass Task</DialogTitle>
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
              <Select
                value={passAssignee}
                onValueChange={setPassAssignee}
              >
                <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                  <SelectValue placeholder="Choose team member" />
                </SelectTrigger>
                <SelectContent className="border-2 shadow-xl max-h-96 overflow-auto">
                  {passEligibleEmployees.length === 0 && (
                    <div className="py-3 px-4 text-sm text-muted-foreground">
                      No eligible team members found.
                    </div>
                  )}
                  {Array.from(passEligibleByDepartment.entries()).map(([department, employees]) => (
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
                  ))}
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
                onChange={(e) => setPassNote(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
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
                  'Pass Task'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          resetEditState();
        } else {
          setIsEditDialogOpen(true);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 shadow-2xl">
          <DialogHeader className="pb-4 border-b bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950 dark:to-slate-950 -m-6 mb-0 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Pencil className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Edit Task</DialogTitle>
                <DialogDescription className="mt-1">
                  Update task details and assignment
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label htmlFor="edit-title" className="text-sm font-semibold flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                Task Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-title"
                value={editTaskForm.title}
                onChange={(e) => setEditTaskForm((prev) => ({ ...prev, title: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                placeholder="Enter task title"
                className="h-11 border-2 focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-sm font-semibold flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="edit-description"
                value={editTaskForm.description}
                onChange={(e) => setEditTaskForm((prev) => ({ ...prev, description: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                placeholder="Enter task description"
                rows={4}
                className="resize-none border-2 focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-assignTo" className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  Assign To
                </Label>
                <Select
                  value={editTaskForm.assignedTo || ''}
                  onValueChange={(value) => setEditTaskForm((prev) => ({ ...prev, assignedTo: value }))}
                >
                  <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent className="border-2 shadow-xl">
                    {userId && user && (
                      <SelectItem value={userId} className="cursor-pointer">
                        {user.name} (Self)
                      </SelectItem>
                    )}
                    {assignableEmployees
                      .filter((emp) => emp.userId !== userId)
                      .map((emp) => (
                        <SelectItem key={emp.userId} value={emp.userId} className="cursor-pointer">
                          {emp.name}
                          {emp.department ? ` • ${emp.department}` : ''}
                          {emp.employeeId ? ` (${emp.employeeId})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-deadline" className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Deadline <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-deadline"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={editTaskForm.deadline}
                  onChange={(e) => setEditTaskForm((prev) => ({ ...prev, deadline: e.target.value }))}
                  className="h-11 border-2 focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
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
                {isUpdatingTask ? 'Updating...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Task Dialog */}
      <Dialog open={isReassignDialogOpen} onOpenChange={(open) => {
        if (!open) {
          resetReassignState();
        } else {
          setIsReassignDialogOpen(true);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 shadow-2xl">
          <DialogHeader className="pb-4 border-b bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 -m-6 mb-0 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <RefreshCcw className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Reassign Task</DialogTitle>
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
                  onChange={(e) => setReassignForm(prev => ({ ...prev, title: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                  placeholder="Enter task title"
                  className="mt-1.5 h-11 bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400"
                />
              </div>

              <div>
                <Label htmlFor="reassign-description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="reassign-description"
                  value={reassignForm.description}
                  onChange={(e) => setReassignForm(prev => ({ ...prev, description: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                  placeholder="Describe the task requirements"
                  className="mt-1.5 min-h-[100px] bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reassign-assignee" className="text-sm font-medium">
                    Assign To
                  </Label>
                  <Select
                    value={reassignForm.assignedTo}
                    onValueChange={(value) => setReassignForm(prev => ({ ...prev, assignedTo: value }))}
                  >
                    <SelectTrigger className="mt-1.5 h-11 bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400">
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableEmployees.map((employee) => (
                        <SelectItem key={employee.userId} value={employee.userId}>
                          {employee.name} ({employee.role})
                          {employee.department && ` - ${employee.department}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reassign-priority" className="text-sm font-medium">
                    Priority
                  </Label>
                  <Select
                    value={reassignForm.priority}
                    onValueChange={(value: BaseTask['priority']) => setReassignForm(prev => ({ ...prev, priority: value }))}
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

              <div>
                <Label htmlFor="reassign-deadline" className="text-sm font-medium">
                  Deadline (Optional)
                </Label>
                <Input
                  id="reassign-deadline"
                  type="date"
                  value={reassignForm.deadline}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setReassignForm(prev => ({ ...prev, deadline: e.target.value }))}
                  className="mt-1.5 h-11 bg-white dark:bg-gray-950 border-2 focus:border-green-500 dark:focus:border-green-400"
                />
              </div>
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
          <Dialog open={Boolean(selectedTask)} onOpenChange={() => setSelectedTask(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="text-2xl font-bold whitespace-pre-wrap break-words">{selectedTask.title}</DialogTitle>
                <DialogDescription>
                  Detailed view of task assignments and progress
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-4 flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid grid-cols-3 gap-2 bg-muted/50 flex-shrink-0">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-4 overflow-y-auto flex-1">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-white" />
                          </div>
                          Description
                        </h4>
                        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{selectedTask.description}</p>
                      </div>

                      <div className="p-4 rounded-lg border bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <UserCheck className="h-4 w-4 text-violet-600" />
                          Assigned By
                        </h4>
                        <p className="text-muted-foreground font-medium">
                          {selectedTaskAssignerInfo?.name || 'Unknown'}
                          {selectedTaskAssignerInfo?.roleLabel && (
                            <span className="block text-xs text-muted-foreground">{selectedTaskAssignerInfo.roleLabel}</span>
                          )}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-violet-600" />
                          Assigned To
                        </h4>
                        <p className="text-muted-foreground font-medium">
                          {selectedTaskAssigneeInfo?.name || 'Unassigned'}
                          {selectedTaskAssigneeInfo?.roleLabel && (
                            <span className="block text-xs text-muted-foreground">{selectedTaskAssigneeInfo.roleLabel}</span>
                          )}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-violet-600" />
                          Priority
                        </h4>
                        <Badge className={getPriorityColor(selectedTask.priority)}>
                          {capitalizePriority(selectedTask.priority)}
                        </Badge>
                      </div>

                      <div className="p-4 rounded-lg border bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-violet-600" />
                          Deadline
                        </h4>
                        <p className="text-muted-foreground font-medium">
                          {formatDisplayDate(selectedTask.deadline)}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-violet-600" />
                          Assigned Date
                        </h4>
                        <p className="text-muted-foreground font-medium">
                          {selectedTask.createdAt ? formatDateIST(parseToIST(selectedTask.createdAt) || new Date(), 'MMM dd, yyyy') : 'N/A'}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border bg-white dark:bg-gray-950 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-violet-600" />
                          Status
                        </h4>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${getStatusColor(selectedTask.status)} shadow-md`} />
                          <span className="capitalize font-medium">{selectedTask.status.replace('-', ' ')}</span>
                        </div>
                      </div>
                    </div>

                    {selectedTask.tags && selectedTask.tags.length > 0 && (
                      <div className="p-4 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 border">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Paperclip className="h-4 w-4 text-white" />
                          </div>
                          Tags
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedTask.tags.map(tag => (
                            <Badge key={tag} className="bg-white dark:bg-gray-900 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-6 overflow-y-auto flex-1">
                  <div className="space-y-4">
                    {isFetchingHistory && selectedTask && isFetchingHistory === selectedTask.id ? (
                      <div className="flex justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : selectedTaskHistory.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 to-gray-200 dark:from-slate-800 dark:to-gray-900 flex items-center justify-center mx-auto mb-3">
                          <Clock className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">No history entries yet</p>
                      </div>
                    ) : (
                      selectedTaskHistory.map((entry) => {
                        const actor = employeesById.get(String(entry.user_id));
                        const actorName = actor?.name ?? (entry.user_id ? `User #${entry.user_id}` : 'Unknown');
                        const actorRole = actor?.role;
                        const actorInfo = getAssignedByInfo(String(entry.user_id), actorRole);
                        const entryTime = formatDateTimeIST(entry.created_at, 'MMM dd, yyyy HH:mm');
                        const details = entry.details || {};

                        const renderDetails = () => {
                          if (!details) return null;
                          if (entry.action === 'passed') {
                            const fromId = details.from ? String(details.from) : '';
                            const toId = details.to ? String(details.to) : '';
                            const fromInfo = fromId ? getAssignedToInfo(fromId) : { name: 'Unknown', roleLabel: undefined };
                            const toInfo = toId ? getAssignedToInfo(toId) : { name: 'Unknown', roleLabel: undefined };
                            const toName = typeof details.to_name === 'string' ? details.to_name : null;
                            const note = typeof details.note === 'string' && details.note.trim().length > 0 ? details.note : null;
                            return (
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>
                                  From: <span className="font-medium text-foreground">{fromInfo.name}</span>
                                  {fromInfo.roleLabel && <span className="text-xs ml-1">({fromInfo.roleLabel})</span>}
                                </div>
                                <div>
                                  To: <span className="font-medium text-foreground">{toName || toInfo.name}</span>
                                  {toInfo.roleLabel && <span className="text-xs ml-1">({toInfo.roleLabel})</span>}
                                </div>
                                {note && <div className="italic whitespace-pre-wrap break-words">"{note}"</div>}
                              </div>
                            );
                          }

                          if (entry.action === 'status_changed') {
                            const from = typeof details.from === 'string' ? details.from : 'Unknown';
                            const to = typeof details.to === 'string' ? details.to : 'Unknown';
                            return (
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>Status changed from <span className="font-medium text-foreground">{from}</span> to <span className="font-medium text-foreground">{to}</span></div>
                              </div>
                            );
                          }

                          if (entry.action === 'updated') {
                            const changes = details.changes as Record<string, { from: unknown; to: unknown }> | undefined;
                            if (!changes) return null;
                            return (
                              <div className="text-sm text-muted-foreground space-y-1">
                                {Object.entries(changes).map(([field, change]) => (
                                  <div key={field}>
                                    <span className="font-medium text-foreground capitalize">{field.replace('_', ' ')}:</span> {String(change.from)} → {String(change.to)}
                                  </div>
                                ))}
                              </div>
                            );
                          }

                          if (entry.action === 'created') {
                            const assignedToId = String(details.assigned_to ?? '');
                            const assignedToInfo = assignedToId ? getAssignedToInfo(assignedToId) : { name: 'Unassigned', roleLabel: undefined };
                            return (
                              <div className="text-sm text-muted-foreground">
                                Task assigned to <span className="font-medium text-foreground">{assignedToInfo.name}</span>
                                {assignedToInfo.roleLabel && <span className="text-xs ml-1">({assignedToInfo.roleLabel})</span>}
                              </div>
                            );
                          }

                          return null;
                        };

                        const actionLabelMap: Record<string, string> = {
                          created: 'Task Created',
                          passed: 'Task Passed',
                          status_changed: 'Status Changed',
                          updated: 'Task Updated',
                        };

                        const actionLabel = actionLabelMap[entry.action] ?? entry.action;
                        const actionIcon = (() => {
                          switch (entry.action) {
                            case 'created':
                              return <PlayCircle className="h-6 w-6 text-white" />;
                            case 'passed':
                              return <Share2 className="h-6 w-6 text-white" />;
                            case 'status_changed':
                              return <RefreshCcw className="h-6 w-6 text-white" />;
                            case 'updated':
                              return <Pencil className="h-6 w-6 text-white" />;
                            default:
                              return <Clock className="h-6 w-6 text-white" />;
                          }
                        })();

                        const gradientClass = (() => {
                          switch (entry.action) {
                            case 'created':
                              return 'from-blue-500 to-indigo-600';
                            case 'passed':
                              return 'from-violet-500 to-purple-600';
                            case 'status_changed':
                              return 'from-amber-500 to-orange-600';
                            case 'updated':
                              return 'from-emerald-500 to-teal-600';
                            default:
                              return 'from-slate-500 to-gray-600';
                          }
                        })();

                        return (
                          <div
                            key={entry.id}
                            className="flex items-start gap-4 p-4 rounded-lg border bg-white dark:bg-gray-950 hover:shadow-md transition-all"
                          >
                            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-lg flex-shrink-0`}>
                              {actionIcon}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <p className="font-semibold text-lg">{actionLabel}</p>
                                <div className="flex flex-col items-end">
                                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <User className="h-3.5 w-3.5" />
                                    {actorInfo.name}
                                  </p>
                                  {actorInfo.roleLabel && (
                                    <p className="text-xs text-muted-foreground">{actorInfo.roleLabel}</p>
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

                <TabsContent value="comments" className="mt-4 flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
                  {/* Comments Header */}
                  <div className="p-3 rounded-lg border bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 flex-shrink-0">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-violet-600" />
                      Task Discussion
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Chat with team members about this task
                    </p>
                  </div>

                  {/* Comments List with Scrolling - WhatsApp Style */}
                  <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-[#efeae2] dark:bg-slate-900 rounded-lg my-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#a78bfa #e2e8f0', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23efeae2\' fill-opacity=\'0.4\'/%3E%3Cpath d=\'M50 0L0 50M100 0L50 50M100 50L50 100M50 50L0 100\' stroke=\'%23d1ccc0\' stroke-width=\'0.5\' opacity=\'0.3\'/%3E%3C/svg%3E")' }}>
                    {isLoadingComments ? (
                      <div className="text-center py-12">
                        <Loader2 className="h-10 w-10 animate-spin mx-auto text-violet-600" />
                        <p className="text-base text-muted-foreground mt-3">Loading comments...</p>
                      </div>
                    ) : taskComments.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900 flex items-center justify-center mx-auto mb-4">
                          <MessageSquare className="h-10 w-10 text-violet-600 dark:text-violet-400" />
                        </div>
                        <p className="text-base text-muted-foreground font-medium">No comments yet</p>
                        <p className="text-sm text-muted-foreground mt-2">Start the conversation!</p>
                      </div>
                    ) : (
                      <>
                        {taskComments.map((comment, index) => {
                          const isOwnComment = comment.user_id === user?.id;
                          const commentUser = employeesById.get(String(comment.user_id));
                          const userPhotoUrl = commentUser?.photo_url;
                          const userInitials = comment.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

                          // Use WhatsApp-style time formatting
                          const formattedTime = getCommentTimeDisplay(comment.created_at);
                          const dateSeparator = getDateSeparator(comment.created_at);

                          // Check if we need to show date separator (different from previous comment's date)
                          const previousComment = index > 0 ? taskComments[index - 1] : null;
                          const previousDateSeparator = previousComment ? getDateSeparator(previousComment.created_at) : null;
                          const showDateSeparator = dateSeparator && dateSeparator !== previousDateSeparator;

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
                                className={`flex gap-2 ${isOwnComment ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-2`}
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
                                <div className={`max-w-[70%] ${isOwnComment ? 'items-end' : 'items-start'} flex flex-col`}>
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
                                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-tr-none'
                                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                                      }`}
                                  >
                                    {/* Role badge for own messages (inside bubble) */}
                                    {isOwnComment && (
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <span className="text-xs font-semibold text-white/90">You</span>
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
                                          ? 'bg-white/10 hover:bg-white/20'
                                          : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
                                          }`}
                                      >
                                        {comment.file_type?.startsWith('image/') ? (
                                          <div className="flex flex-col gap-1">
                                            <img
                                              src={`${API_BASE_URL}${comment.file_url}`}
                                              alt={comment.file_name || 'Attachment'}
                                              className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
                                            />
                                            <span className={`text-xs ${isOwnComment ? 'text-white/80' : 'text-slate-600 dark:text-slate-400'}`}>
                                              {comment.file_name}
                                            </span>
                                          </div>
                                        ) : (
                                          <>
                                            {comment.file_type?.includes('pdf') ? (
                                              <FileText className={`h-5 w-5 ${isOwnComment ? 'text-white' : 'text-red-500'}`} />
                                            ) : comment.file_type?.includes('spreadsheet') || comment.file_type?.includes('excel') || comment.file_name?.endsWith('.csv') ? (
                                              <FileSpreadsheet className={`h-5 w-5 ${isOwnComment ? 'text-white' : 'text-green-500'}`} />
                                            ) : comment.file_type?.includes('word') || comment.file_name?.endsWith('.doc') || comment.file_name?.endsWith('.docx') ? (
                                              <FileText className={`h-5 w-5 ${isOwnComment ? 'text-white' : 'text-blue-500'}`} />
                                            ) : (
                                              <FileIcon className={`h-5 w-5 ${isOwnComment ? 'text-white' : 'text-slate-500'}`} />
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <p className={`text-sm font-medium truncate ${isOwnComment ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                                {comment.file_name}
                                              </p>
                                              {comment.file_size && (
                                                <p className={`text-xs ${isOwnComment ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                                                  {(comment.file_size / 1024).toFixed(1)} KB
                                                </p>
                                              )}
                                            </div>
                                            <Download className={`h-4 w-4 ${isOwnComment ? 'text-white/70' : 'text-slate-400'}`} />
                                          </>
                                        )}
                                      </a>
                                    )}

                                    {/* Text Comment */}
                                    {comment.comment && (
                                      <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${isOwnComment ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {comment.comment}
                                      </p>
                                    )}
                                    <div className="flex items-center justify-end gap-2 mt-1">
                                      <span className={`text-xs ${isOwnComment ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {formattedTime}
                                      </span>
                                      {isOwnComment && (
                                        <button
                                          onClick={() => handleDeleteComment(comment.id)}
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
                          <div key={index} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border text-xs shadow-sm">
                            <Paperclip className="h-3 w-3 text-violet-600" />
                            <span className="font-medium truncate max-w-[100px]">{file.name}</span>
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
                          onChange={(e) => setNewComment(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
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
                        disabled={(!newComment.trim() && attachedFiles.length === 0) || isPostingComment}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 shadow-2xl">
          <DialogHeader className="pb-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 -m-6 mb-0 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Download className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Export Task Report</DialogTitle>
                <DialogDescription className="mt-1">
                  Generate and download task reports in various formats
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            {/* Export Format */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"></div>
                Export Format
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={exportFormat === 'pdf' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('pdf')}
                  className="gap-2 h-12 border-2"
                >
                  <FileDown className="h-4 w-4" />
                  PDF Report
                </Button>
                <Button
                  variant={exportFormat === 'csv' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('csv')}
                  className="gap-2 h-12 border-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV Data
                </Button>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                Date Range
              </Label>
              <Select value={exportDateRange} onValueChange={(value: any) => setExportDateRange(value)}>
                <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 shadow-xl">
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="1month">Last 1 Month</SelectItem>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {exportDateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label htmlFor="start-date" className="text-xs font-medium">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="h-10 border-2 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date" className="text-xs font-medium">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="h-10 border-2 mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Department Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Department Filter
              </Label>
              <Select value={exportDepartmentFilter} onValueChange={setExportDepartmentFilter}>
                <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 shadow-xl max-h-72 overflow-auto">
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments
                    .filter(dept => CORE_DEPARTMENTS.some(core => core.toLowerCase() === dept.toLowerCase()))
                    .map((dept) => (
                      <SelectItem key={dept} value={dept} className="cursor-pointer">
                        {dept}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                User Filter
              </Label>
              <Select value={exportUserFilter} onValueChange={setExportUserFilter}>
                <SelectTrigger className="h-11 border-2 bg-white dark:bg-gray-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 shadow-xl max-h-72 overflow-auto">
                  <SelectItem value="all">All Users</SelectItem>
                  {extendedEmployees.map((emp) => (
                    <SelectItem key={emp.userId} value={emp.userId} className="cursor-pointer">
                      {emp.name}
                      {emp.department ? ` • ${emp.department}` : ''}
                      {emp.employeeId ? ` (${emp.employeeId})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export Summary */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border">
              <h4 className="font-semibold mb-2">Export Summary</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Format: <span className="font-medium text-foreground">{exportFormat.toUpperCase()}</span></p>
                <p>• Date Range: <span className="font-medium text-foreground">
                  {exportDateRange === 'all' ? 'All Time' :
                    exportDateRange === 'custom' ? `${exportStartDate || 'Not set'} - ${exportEndDate || 'Not set'}` :
                      `Last ${exportDateRange.replace('months', ' Months').replace('1month', '1 Month')}`}
                </span></p>
                <p>• Department Filter: <span className="font-medium text-foreground">
                  {exportDepartmentFilter === 'all' ? 'All Departments' : exportDepartmentFilter}
                </span></p>
                <p>• User Filter: <span className="font-medium text-foreground">
                  {exportUserFilter === 'all' ? 'All Users' :
                    employeesById.get(exportUserFilter)?.name || 'Unknown User'}
                </span></p>
                <p>• Total Tasks: <span className="font-medium text-foreground">{getFilteredTasksForExport().length}</span></p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(false)}
                className="h-11 px-6 border-2 hover:shadow-lg hover:border-slate-400 dark:hover:border-slate-600 transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting || getFilteredTasksForExport().length === 0}
                className="h-11 px-6 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export {exportFormat.toUpperCase()}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pass History Dialog */}
      <Dialog open={isPassHistoryDialogOpen} onOpenChange={(open) => {
        // Only allow closing via the Close button, not the X button
        if (!open) {
          setIsPassHistoryDialogOpen(false);
        }
      }}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col border-2 shadow-2xl [&>button]:hidden p-0 overflow-hidden">
          <DialogHeader className="pb-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Share2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Pass History</DialogTitle>
                <DialogDescription className="mt-1">
                  Complete history of task reassignments
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {passHistoryTask && (() => {
              const passEntries = getPassHistoryEntries(passHistoryTask.id);

              if (passEntries.length === 0) {
                return (
                  <div className="text-center py-12">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-slate-100 to-gray-200 dark:from-slate-800 dark:to-gray-900 flex items-center justify-center mx-auto mb-4">
                      <Share2 className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-lg">No pass history available</p>
                    <p className="text-sm text-muted-foreground mt-2">This task has not been passed yet</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {passEntries.map((entry, index) => {
                    const details = entry.details as Record<string, unknown> | undefined;
                    const fromId = details?.from ? String(details.from) : '';
                    const toId = details?.to ? String(details.to) : '';
                    const fromInfo = fromId ? getAssignedToInfo(fromId) : { name: 'Unknown', roleLabel: undefined };
                    const toInfo = toId ? getAssignedToInfo(toId) : { name: 'Unknown', roleLabel: undefined };
                    const toName = typeof details?.to_name === 'string' ? details.to_name : toInfo.name;
                    const note = typeof details?.note === 'string' && details.note.trim().length > 0 ? details.note : null;
                    const actor = employeesById.get(String(entry.user_id));
                    const actorRole = actor?.role;
                    const actorInfo = getAssignedByInfo(String(entry.user_id), actorRole);
                    const timestamp = formatDateTimeIST(entry.created_at, 'MMM dd, yyyy HH:mm');

                    return (
                      <div
                        key={entry.id}
                        className="p-4 rounded-lg border-2 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">Pass #{index + 1}</div>
                              <div className="text-xs text-muted-foreground">
                                by {actorInfo.name}
                                {actorInfo.roleLabel && <span className="ml-1">({actorInfo.roleLabel})</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timestamp}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-1 p-3 rounded-md bg-white dark:bg-gray-900 border">
                            <div className="text-xs text-muted-foreground mb-1">From</div>
                            <div className="font-medium text-sm">{fromInfo.name}</div>
                            {fromInfo.roleLabel && (
                              <div className="text-xs text-muted-foreground mt-0.5">{fromInfo.roleLabel}</div>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            <ChevronRight className="h-5 w-5 text-violet-600" />
                          </div>
                          <div className="flex-1 p-3 rounded-md bg-white dark:bg-gray-900 border">
                            <div className="text-xs text-muted-foreground mb-1">To</div>
                            <div className="font-medium text-sm">{toName}</div>
                            {toInfo.roleLabel && (
                              <div className="text-xs text-muted-foreground mt-0.5">{toInfo.roleLabel}</div>
                            )}
                          </div>
                        </div>

                        {note && (
                          <div className="mt-3 p-3 rounded-md bg-white dark:bg-gray-900 border">
                            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              Note
                            </div>
                            <div className="text-sm italic text-foreground whitespace-pre-wrap break-words">"{note}"</div>
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