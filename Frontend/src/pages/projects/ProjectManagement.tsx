import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Eye,
  Loader2,
  FolderKanban,
  Users,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  UserPlus,
  UserMinus,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  LayoutGrid,
  ListIcon,
  AlertCircle,
  Briefcase,
  X,
  ArchiveIcon,
  Video,
  RefreshCcw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiService, API_BASE_URL } from "@/lib/api";
import { formatDateIST } from "@/utils/timezone";

const TASK_STATUSES = [
  "Pending",
  "In Progress",
  "Overdue",
  "Completed",
  "Cancelled",
  "todo",
] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

const PRIORITY_OPTIONS = ["Low", "Medium", "High"] as const;
type Priority = (typeof PRIORITY_OPTIONS)[number];

// Form-only type: supports multiple assignees per task row
interface TaskFormRow {
  task_name: string;
  description: string;
  assigned_to_ids: number[];
  start_date: string;
  due_date: string;
  status: TaskStatus;
  priority: Priority;
}

const emptyTask = (): TaskFormRow => ({
  task_name: "",
  description: "",
  assigned_to_ids: [],
  start_date: "",
  due_date: "",
  status: "Pending",
  priority: "Medium",
});

interface Employee {
  user_id: number;
  name: string;
  email?: string;
  role?: string;
  department?: string;
}

// ─────────────────────────────────────────
// Task form component — Multi-assignee
// ─────────────────────────────────────────
interface TaskFormSectionProps {
  taskList: TaskFormRow[];
  assignableEmployees: Employee[];
  updateTaskRow: (index: number, field: keyof TaskFormRow, value: any) => void;
  toggleTaskAssignee: (index: number, userId: number) => void;
  removeTaskRow: (index: number) => void;
  addTaskRow: () => void;
}

const TaskFormSection = ({
  taskList,
  assignableEmployees,
  updateTaskRow,
  toggleTaskAssignee,
  removeTaskRow,
  addTaskRow,
}: TaskFormSectionProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-3 prose-slate">
        {taskList.map((task, index) => (
          <div
            key={index}
            className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight pl-1">Name</p>
                <Input
                  placeholder="Task name *"
                  value={task.task_name}
                  onChange={(e) =>
                    updateTaskRow(index, "task_name", e.target.value)
                  }
                  className="shadow-inner"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight pl-1">Start Date</p>
                <Input
                  type="date"
                  value={task.start_date || ""}
                  onChange={(e) =>
                    updateTaskRow(index, "start_date", e.target.value)
                  }
                  className="shadow-inner"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight pl-1">Due Date</p>
                <Input
                  type="date"
                  value={task.due_date || ""}
                  onChange={(e) =>
                    updateTaskRow(index, "due_date", e.target.value)
                  }
                  className="shadow-inner"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight pl-1">Priority</p>
                <div className="flex gap-2">
                  <Select
                    value={task.priority}
                    onValueChange={(v) => updateTaskRow(index, "priority", v)}
                  >
                    <SelectTrigger className="h-10 text-xs shadow-inner">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {taskList.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 hover:bg-red-50 hover:text-red-600 border border-slate-100 dark:border-slate-800 rounded-lg flex-shrink-0"
                      onClick={() => removeTaskRow(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {/* Description */}
            <Input
              placeholder="Description (optional)"
              value={task.description || ""}
              onChange={(e) =>
                updateTaskRow(index, "description", e.target.value)
              }
              className="text-xs shadow-inner"
            />
            {/* Multi-employee assignee */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Assign to employees *
                </p>
                {task.assigned_to_ids.length > 0 && (
                  <Badge className="text-[10px] bg-violet-600 text-white border-0 px-2 py-0.5">
                    {task.assigned_to_ids.length} selected
                  </Badge>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950 shadow-inner">
                {assignableEmployees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-1">
                    <User className="h-5 w-5 opacity-20" />
                    <p className="text-[10px]">No employees found.</p>
                  </div>
                ) : (
                  assignableEmployees.map((emp) => (
                    <label
                      key={emp.user_id}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={task.assigned_to_ids.includes(emp.user_id)}
                        onCheckedChange={() =>
                          toggleTaskAssignee(index, emp.user_id)
                        }
                        className="h-4 w-4 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                      />
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-sm">
                        {emp.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {emp.name}
                        </p>
                        <p className="text-[10px] text-slate-400 capitalize truncate">
                          {emp.role || "Employee"}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={addTaskRow}
        className="gap-2 w-full border-dashed py-5 border-slate-300 dark:border-slate-600 text-slate-500 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 transition-all rounded-xl"
      >
        <Plus className="h-4 w-4" /> Add Another Task Row
      </Button>
    </div>
  );
};

// ─────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────
interface ProjectMember {
  user_id: number;
  name: string;
  email?: string;
  role?: string;
}

interface ProjectTask {
  task_id?: number;
  id?: number;
  task_name: string;
  description?: string;
  assigned_to?: number;
  user_id?: number | string;
  assigned_to_name?: string;
  start_date?: string;
  due_date?: string;
  assigned_by?: number | string;
  assigned_by_name?: string;
  priority?: "Low" | "Medium" | "High";
  status:
  | "Pending"
  | "In Progress"
  | "Overdue"
  | "Completed"
  | "Cancelled"
  | "todo";
}

interface ProjectMeeting {
  meeting_id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  meeting_url: string;
}

interface Project {
  project_id: number;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  is_active?: boolean;
  pic_name?: string;
  person_in_charge_name?: string;
  pic_id?: number | string;
  person_in_charge_id?: number | string;
  member_count?: number;
  task_count?: number;
  members?: ProjectMember[];
  tasks?: ProjectTask[];
  meetings?: ProjectMeeting[];
}

const normalizeStatus = (s?: string): string => {
  if (!s) return "Pending";
  const low = s.toLowerCase();

  if (low === "pending" || low === "todo" || low === "planned" || low === "on-hold")
    return "Pending";

  if (
    low === "inprogress" ||
    low === "in-progress" ||
    low === "in_progress" ||
    low === "active" ||
    low === "in progress"
  )
    return "In Progress";

  if (low === "completed" || low === "complete" || low === "achieved")
    return "Completed";

  if (low === "cancelled") return "Cancelled";
  if (low === "overdue") return "Overdue";
  if (low === "archived") return "Archived";
  return low;
};

// ─────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────
function TaskStatusBadge({ status }: { status: string }) {
  const norm = normalizeStatus(status);

  if (norm === "Pending")
    return (
      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-0 gap-1 text-[11px]">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );

  if (norm === "In Progress")
    return (
      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 gap-1 text-[11px]">
        <Clock className="h-3 w-3" />
        In Progress
      </Badge>
    );

  if (norm === "Overdue")
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1 text-[11px]">
        <AlertCircle className="h-3 w-3" />
        Overdue
      </Badge>
    );

  if (norm === "Completed")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1 text-[11px]">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>
    );

  if (norm === "Archived")
    return (
      <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0 gap-1 text-[11px]">
        <FolderKanban className="h-3 w-3" />
        Archived
      </Badge>
    );

  if (norm === "Cancelled")
    return (
      <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0 gap-1 text-[11px]">
        <XCircle className="h-3 w-3" />
        Canceled
      </Badge>
    );

  return (
    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-0 gap-1 text-[11px]">
      <Clock className="h-3 w-3" />
      {norm}
    </Badge>
  );
}

function statusColor(s?: string) {
  const status = normalizeStatus(s);
  if (status === "Pending")
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (status === "Completed")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (status === "Cancelled" || status === "Archived")
    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
}

const normalizeRole = (role: string | null | undefined): string => {
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
      return "team_lead";
    case "employee":
    default:
      return "employee";
  }
};

function statusLabel(s?: string) {
  const status = normalizeStatus(s);
  if (status === "Pending") return "Pending";
  if (status === "In Progress") return "In Progress";
  if (status === "Completed") return "Completed";
  if (status === "Archived") return "Archived";
  if (status === "Cancelled") return "Cancelled";
  return status;
}

function TaskRow({
  task,
  project,
  canManageProjects,
  onStatusChange,
  onReassign,
}: {
  task: ProjectTask;
  project?: Project;
  canManageProjects: boolean;
  onStatusChange: (taskId: number, status: string) => void;
  onReassign?: (task: ProjectTask) => void;
}) {
  const id = task.task_id ?? task.id ?? 0;

  // Detect overdue automatically
  const isOverdue = useMemo(() => {
    const status = normalizeStatus(task.status);
    if (status === "Completed" || status === "Cancelled")
      return false;
    if (!task.due_date) return false;
    const due = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }, [task.due_date, task.status]);

  const effectiveStatus = isOverdue
    ? "Overdue"
    : normalizeStatus(task.status) === "todo"
      ? "Pending"
      : normalizeStatus(task.status);

  return (
    <TableRow className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors">
      <TableCell className="pl-4">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {task.task_name}
        </p>
        {task.description && (
          <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
        )}
      </TableCell>
      <TableCell className="text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5 min-w-[120px]">
          <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 flex-shrink-0">
            {task.assigned_to_name?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="truncate">{task.assigned_to_name || "Unassigned"}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 min-w-[120px]">
          <div className="h-6 w-6 rounded-full bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 flex-shrink-0">
            {(() => {
              if (task.assigned_by_name) return task.assigned_by_name[0].toUpperCase();
              return "A";
            })()}
          </div>
          <span className="truncate">{task.assigned_by_name || "Admin"}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5 text-[10px] whitespace-nowrap">
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-black text-slate-400 w-4">ST</span>
            <span className="text-slate-600 dark:text-slate-400 font-bold tabular-nums">
              {task.start_date ? formatDateIST(task.start_date, "MMM dd, yyyy") : "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black text-slate-400 w-4">DU</span>
            <span className={`font-bold tabular-nums ${isOverdue ? 'text-red-600' : 'text-slate-600 dark:text-slate-400'}`}>
              {task.due_date ? formatDateIST(task.due_date, "MMM dd, yyyy") : "—"}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {(!canManageProjects ||
          normalizeStatus(task.status) === "Completed" ||
          normalizeStatus(task.status) === "Cancelled" ||
          isOverdue) ? (
          <TaskStatusBadge status={effectiveStatus} />
        ) : (
          <Select
            value={normalizeStatus(task.status) === "Pending" ? "Pending" : task.status}
            onValueChange={(v) => onStatusChange(id, v)}
          >
            <SelectTrigger className="h-7 w-32 text-xs border-slate-200 dark:border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="bottom" className="shadow-md">
              <SelectItem value="Pending">
                <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                  <Clock className="h-3 w-3" />
                  Pending
                </span>
              </SelectItem>
              <SelectItem value="In Progress">
                <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                  <Clock className="h-3 w-3" />
                  In Progress
                </span>
              </SelectItem>
              <SelectItem value="archived">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <FolderKanban className="h-3 w-3" />
                  Archived
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="text-right pr-4">
        {onReassign && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            onClick={() => onReassign(task)}
            title="Reassign & Update"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────
// Project Card component (expandable)
// ─────────────────────────────────────────
function ProjectCard({
  project,
  canManageProjects,
  isDeleting,
  onEdit,
  onDelete,
  onManageMembers,
  onRemoveMembers,
  onRemoveMember,
  onAssignTasks,
  onTaskStatusChange,
  onProjectStatusChange,
  onToggleActive,
  onView,
  onReassignTask,
}: {
  project: Project;
  canManageProjects: boolean;
  isDeleting: number | null;
  onEdit: () => void;
  onDelete: () => void;
  onManageMembers: () => void;
  onRemoveMembers: () => void;
  onRemoveMember: (userId: number) => void;
  onAssignTasks: () => void;
  onTaskStatusChange: (
    projectId: number,
    taskId: number,
    status: string,
  ) => void;
  onProjectStatusChange: (projectId: number, status: string) => void;
  onToggleActive: (projectId: number, isActive: boolean) => void;
  onView: () => void;
  onReassignTask?: (task: ProjectTask, projectId: number) => void;
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const tasks = project.tasks || [];
  const members = project.members || [];
  const todoCount = tasks.filter((t) => normalizeStatus(t.status) === "Pending" || normalizeStatus(t.status) === "todo").length;
  const completedCount = tasks.filter((t) => normalizeStatus(t.status) === "Completed").length;
  const cancelledCount = tasks.filter((t) => normalizeStatus(t.status) === "Cancelled").length;

  return (
    <Card className="border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-0">
        {/* ── Card Header ── */}
        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
                  {project.name}
                </h3>
                <Badge
                  className={`capitalize border-0 text-[10px] px-2 py-0.5 ${statusColor(project.status)}`}
                >
                  {statusLabel(project.status)}
                </Badge>
              </div>
              {project.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
              {/* Dates */}
              {(project.start_date || project.end_date) && (
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {project.start_date
                      ? formatDateIST(project.start_date, "MMM dd, yyyy")
                      : "—"}
                    {" → "}
                    {project.end_date
                      ? formatDateIST(project.end_date, "MMM dd, yyyy")
                      : "—"}
                  </span>
                </div>
              )}
              {/* Person in Charge */}
              {(project.person_in_charge_name || project.pic_name) && (
                <div className="flex items-center gap-1.5 mt-2 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md w-fit border border-indigo-100 dark:border-indigo-800">
                  <User className="h-3 w-3 text-indigo-500" />
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">
                    PIC: {project.person_in_charge_name || project.pic_name}
                  </span>
                </div>
              )}
            </div>
            {/* Status Dropdown */}
            <div className="flex-1 flex justify-center">
              <Select
                value={normalizeStatus(project.status)}
                onValueChange={(v) =>
                  onProjectStatusChange(project.project_id, v)
                }
                disabled={
                  !canManageProjects ||
                  ["Completed", "Archived", "Cancelled"].includes(
                    normalizeStatus(project.status),
                  )
                }
              >
                <SelectTrigger className="h-7 w-32 text-xs border-slate-200 dark:border-slate-700 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="bottom" className="shadow-md">
                  <SelectItem value="Pending">
                    <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                      <Clock className="h-3 w-3" />
                      Pending
                    </span>
                  </SelectItem>
                  <SelectItem value="In Progress">
                    <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                      <Clock className="h-3 w-3" />
                      In Progress
                    </span>
                  </SelectItem>
                  <SelectItem value="Completed">
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </span>
                  </SelectItem>
                  <SelectItem value="Archived">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <FolderKanban className="h-3 w-3" />
                      Archived
                    </span>
                  </SelectItem>
                  <SelectItem value="cancelled">
                    <span className="flex items-center gap-1.5 text-red-500 dark:text-red-400 font-bold uppercase tracking-tight text-[10px]">
                      <XCircle className="h-3 w-3" />
                      Canceled
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex-1 flex items-center justify-end gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950"
                title="View project details"
                onClick={onView}
              >
                <Eye className="h-4 w-4" />
              </Button>

              {canManageProjects && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                    title="Manage Team Members"
                    onClick={onManageMembers}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                    title="Remove Employee"
                    onClick={onRemoveMembers}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-amber-50 hover:text-amber-600"
                    title="Assign Tasks"
                    onClick={onAssignTasks}
                  >
                    <ClipboardList className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-green-50 hover:text-green-600"
                    title="Edit Project"
                    onClick={onEdit}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                    title="Delete Project"
                    disabled={isDeleting === project.project_id}
                    onClick={onDelete}
                  >
                    {isDeleting === project.project_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${project.is_active === false ? "hover:bg-green-50 hover:text-green-600 text-slate-400" : "hover:bg-orange-50 hover:text-orange-600"}`}
                    title={
                      project.is_active === false
                        ? "Activate Project"
                        : "Deactivate Project"
                    }
                    onClick={() =>
                      onToggleActive(
                        project.project_id,
                        project.is_active === false,
                      )
                    }
                  >
                    {project.is_active === false ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* ── Summary pills ── */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {/* Members */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {project.member_count ?? members.length ?? 0} Member
                {(project.member_count ?? members.length ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Task counts */}
            {tasks.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    {
                      tasks.filter(
                        (t) => normalizeStatus(t.status) === "Pending" || normalizeStatus(t.status) === "todo",
                      ).length
                    }{" "}
                    Pending
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {completedCount} / {project.task_count ?? tasks.length} Done
                  </span>
                </div>
                {cancelledCount > 0 && (
                  <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full">
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs font-medium text-red-500 dark:text-red-400">
                      {cancelledCount} Cancelled
                    </span>
                  </div>
                )}
              </>
            )}
            {/* Meetings */}
            {(project.meetings?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1 rounded-full">
                <Video className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {project.meetings?.length} Meeting
                  {(project.meetings?.length ?? 0) !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Expansion toggle (only if content exists) */}
            {(tasks.length > 0 || members.length > 0) && (
              <button
                onClick={() => {
                  if (!expanded && tasks.length === 0 && (project.task_count || 0) > 0) {
                    onView(); // Trigger load internally which updates projects list
                  }
                  setExpanded((e) => !e);
                }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title={expanded ? "Hide quick view" : "Show quick view"}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Full View Details Link (Always visible for all profiles) */}
            <button
              onClick={onView}
              className="ml-auto flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 font-bold hover:underline decoration-violet-300 underline-offset-4"
            >
              <Eye className="h-3.5 w-3.5" />
              View details
            </button>
          </div>
        </div>

        {/* ── Expanded section ── */}
        {expanded && (
          <div className="border-t border-slate-100 dark:border-slate-800">
            {/* Members row */}
            {members.length > 0 && (
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Team Members
                </p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 pl-2.5 pr-1 py-1 rounded-full group/member"
                    >
                      <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-bold text-white shadow-sm group-hover/member:bg-blue-600 transition-colors">
                        {m.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                        {m.name}
                      </span>
                      {m.role && (
                        <span className="text-[10px] text-blue-400 capitalize bg-white/50 dark:bg-black/10 px-1 rounded-md">
                          ({m.role})
                        </span>
                      )}
                      <button
                        onClick={() => onRemoveMember(m.user_id)}
                        className="ml-0.5 h-4 w-4 rounded-full flex items-center justify-center text-blue-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                        title={`Remove ${m.name} from project`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks table */}
            {tasks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-5 pt-3 mb-2 flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Tasks
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 dark:bg-slate-900/40">
                        <TableHead className="pl-4 text-xs">Task</TableHead>
                        <TableHead className="text-xs">Assigned To</TableHead>
                        <TableHead className="text-xs">Due Date</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task, idx) => (
                        <TaskRow
                          key={task.task_id ?? task.id ?? idx}
                          task={task}
                          project={project}
                          canManageProjects={canManageProjects}
                          onStatusChange={(taskId, status) =>
                            onTaskStatusChange(
                              project.project_id,
                              taskId,
                              status,
                            )
                          }
                          onReassign={(t) =>
                            onReassignTask?.(t, project.project_id)
                          }
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">
                No tasks assigned yet.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────
export default function ProjectManagement() {
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // Dialogs
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isRemoveMemberDialogOpen, setIsRemoveMemberDialogOpen] =
    useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [taskToReassign, setTaskToReassign] = useState<{
    projectId: number;
    task: ProjectTask;
  } | null>(null);
  const [reassignForm, setReassignForm] = useState({
    assigned_to: "",
    status: "",
  });

  // Create/Edit form
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "In Progress",
    person_in_charge_id: "",
  });
  // Multi-select members (for create)
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  // Task list (for create + assign dialog)
  const [taskList, setTaskList] = useState<TaskFormRow[]>([emptyTask()]);
  // Manage members dialog
  const [addMemberId, setAddMemberId] = useState("");

  // ── Fetch ──
  const [isViewTaskDialogOpen, setIsViewTaskDialogOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<ProjectTask | null>(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getProjects();
      const projectList = Array.isArray(data) ? data : data?.projects || [];
      const normalizedProjects = projectList.map((p: any) => ({
        ...p,
        members: (p.members || []).map((m: any) => ({
          ...m,
          name:
            m.name ||
            m.employee_name ||
            m.full_name ||
            m.user_name ||
            (m.first_name
              ? `${m.first_name} ${m.last_name || ""}`.trim()
              : null) ||
            "Unknown Member",
        })),
        tasks: (p.tasks || []).filter((t: any) => {
          const pId = p.project_id || p.id;
          const tPid = t.project_id ?? t.projectId ?? t.project?.id ?? t.project?.project_id;
          // If task has no project ID info, we assume it belongs if it was returned in the project's payload
          if (tPid === undefined || tPid === null) return true;
          return String(tPid) === String(pId);
        }),
      }));
      setProjects(normalizedProjects);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await apiService.getEmployees();
      setEmployees(
        (Array.isArray(data) ? data : []).map((e: any) => {
          const empName =
            e.name ||
            e.employee_name ||
            e.full_name ||
            e.user_name ||
            (e.first_name
              ? `${e.first_name} ${e.last_name || ""}`.trim()
              : null) ||
            "Unknown Member";
          return {
            user_id: e.user_id || e.id,
            name: empName,
            email: e.email,
            role: e.role,
            department: e.department,
          };
        }),
      );
    } catch (_) { }
  };

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
  }, []);

  const filteredProjects = useMemo(
    () =>
      projects.filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || normalizeStatus(p.status) === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [projects, searchQuery, statusFilter],
  );

  // ── Helpers ──
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      start_date: "",
      end_date: "",
      status: "In Progress",
      person_in_charge_id: "",
    });
    setSelectedMemberIds([]);
    setMemberSearch("");
    setTaskList([emptyTask()]);
    setAddMemberId("");
  };

  const toggleMember = (id: number) =>
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const addTaskRow = () => setTaskList((prev) => [...prev, emptyTask()]);
  const updateTaskRow = (index: number, field: keyof TaskFormRow, value: any) =>
    setTaskList((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    );
  const toggleTaskAssignee = (index: number, userId: number) =>
    setTaskList((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const ids = t.assigned_to_ids.includes(userId)
          ? t.assigned_to_ids.filter((id) => id !== userId)
          : [...t.assigned_to_ids, userId];
        return { ...t, assigned_to_ids: ids };
      }),
    );
  const removeTaskRow = (index: number) => {
    if (taskList.length === 1) return;
    setTaskList((prev) => prev.filter((_, i) => i !== index));
  };

  const assignableEmployees = useMemo(() => {
    if (!user) return [];
    const userRole = normalizeRole(user.role);
    const userDepts = (user.department || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

    return employees.filter((e) => {
      const empRole = normalizeRole(e.role);
      const empDepts = (e.department || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      const uId = String(e.user_id);

      // 1. Can always assign to self
      if (uId === String(user.id)) return true;

      // 2. Admin and HR can assign to everyone
      if (userRole === "admin" || userRole === "hr") return true;

      // 3. Managers can assign to anyone in their department(s) or any role below them
      if (userRole === "manager") {
        const sameDept = userDepts.length === 0 || empDepts.some(d => userDepts.includes(d));
        const lowerRole = ["team_lead", "employee"].includes(empRole);
        return sameDept || lowerRole;
      }

      // 4. Team leads can assign to employees in their department or any employee
      if (userRole === "team_lead") {
        const sameDept = userDepts.length === 0 || empDepts.some(d => userDepts.includes(d));
        return empRole === "employee" || sameDept;
      }

      // 5. Employees can assign to self (handled by rule 1)
      return false;
    });
  }, [employees, user]);

  const filteredMemberOptions = useMemo(
    () =>
      assignableEmployees.filter((e) =>
        e.name.toLowerCase().includes(memberSearch.toLowerCase()),
      ),
    [assignableEmployees, memberSearch],
  );

  // ── Handlers ──
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }
    if (!formData.person_in_charge_id) {
      toast({
        title: "Error",
        description: "Person in Charge is required",
        variant: "destructive",
      });
      return;
    }
    setIsCreating(true);
    try {
      const { person_in_charge_id, ...baseData } = formData;
      const payload = {
        ...baseData,
        person_in_charge: Number(person_in_charge_id),
      };
      // status mapping for creation if needed
      if (payload.status === "todo") payload.status = "planned";
      else if (payload.status === "in-progress") payload.status = "in_progress";

      const newProject = await apiService.createProject(payload);
      const projectId = newProject?.project_id || newProject?.id || newProject?.data?.project_id || newProject?.data?.id;

      if (projectId) {
        // 1. Add members first
        if (selectedMemberIds.length > 0) {
          try {
            await apiService.addProjectMembersBulk(
              projectId,
              selectedMemberIds,
            );
          } catch (memberErr) {
            console.error("Failed to add members:", memberErr);
            toast({
              title: "Warning",
              description: "Project created, but failed to add some members.",
              variant: "destructive",
            });
          }
        }

        // 2. Assign tasks using Bulk API
        for (const t of taskList) {
          if (!t.task_name.trim() || t.assigned_to_ids.length === 0) continue;

          try {
            await apiService.assignTasksBulk({
              title: t.task_name,
              description: t.description,
              status: t.status,
              start_date: t.start_date || null,
              due_date: t.due_date || null,
              priority: t.priority,
              assigned_to_ids: t.assigned_to_ids,
              project_id: Number(projectId),
            });
          } catch (taskErr) {
            console.error("Failed to assign project task:", taskErr);
          }
        }

        // 3. Re-fetch full details to sync state
        try {
          await loadFullProjectDetails(projectId);
        } catch (fetchErr) {
          console.error("Failed to refetch project details:", fetchErr);
        }
      }

      toast({ title: "Success", description: "Project created successfully" });
      setIsCreateDialogOpen(false);
      resetForm();
      fetchProjects();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedProject || !formData.name.trim()) {
      toast({
        title: "Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }
    setIsUpdating(true);
    try {
      // Map UI status back to backend-friendly status
      let backendStatus = formData.status;
      if (formData.status === "todo") backendStatus = "planned";
      else if (formData.status === "in-progress") backendStatus = "in_progress";
      else if (formData.status === "completed") backendStatus = "completed";
      else if (formData.status === "cancelled") backendStatus = "cancelled";

      const { person_in_charge_id, ...baseData } = formData;
      const payload = {
        ...baseData,
        status: backendStatus,
        person_in_charge: person_in_charge_id ? Number(person_in_charge_id) : undefined
      };
      await apiService.updateProject(selectedProject.project_id, payload);
      toast({ title: "Success", description: "Project updated" });
      setIsEditDialogOpen(false);
      resetForm();
      fetchProjects();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update project",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (projectId: number) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setIsDeleting(projectId);
    try {
      await apiService.deleteProject(projectId);
      toast({ title: "Success", description: "Project deleted" });
      fetchProjects();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete project",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  // ── Helper to fetch and normalize full project details ──
  const loadFullProjectDetails = async (projectId: number) => {
    try {
      const [projectRes, membersRes, tasksRes, meetingsRes] =
        await Promise.allSettled([
          apiService.getProjectById(projectId),
          apiService.getProjectMembers(projectId),
          apiService.getProjectTasks(projectId),
          apiService.getProjectMeetings(projectId),
        ]);

      // Normalise Project Data
      const projectRaw =
        projectRes.status === "fulfilled" ? projectRes.value : null;
      let projectData: any = projectRaw;
      if (projectRaw?.project && typeof projectRaw.project === "object") {
        projectData = projectRaw.project;
      } else if (projectRaw?.data && typeof projectRaw.data === "object") {
        projectData = projectRaw.data;
      }

      // Normalise Members
      const membersRaw =
        membersRes.status === "fulfilled" ? membersRes.value : null;
      const members = Array.isArray(membersRaw)
        ? membersRaw
        : Array.isArray(membersRaw?.data)
          ? membersRaw.data
          : Array.isArray(membersRaw?.members)
            ? membersRaw.members
            : [];

      // Normalise Tasks
      const tasksRaw = tasksRes.status === "fulfilled" ? tasksRes.value : null;
      const tasksArrRaw = Array.isArray(tasksRaw)
        ? tasksRaw
        : Array.isArray(tasksRaw?.data)
          ? tasksRaw.data
          : Array.isArray(tasksRaw?.tasks)
            ? tasksRaw.tasks
            : [];

      // ✅ Filter logic: explicitly ensure only this project's tasks are included
      const tasksArr = tasksArrRaw.filter((t: any) => {
        const pId = t.project_id ?? t.projectId ?? t.project?.id ?? t.project?.project_id;
        // Since this was fetched from a project-specific query, if pId is missing, 
        // we trust the endpoint returned relevant tasks.
        if (pId === undefined || pId === null) return true;
        return String(pId) === String(projectId);
      });

      // Normalize task field names — backend may use `title` instead of `task_name`,
      // and assignee name may be in several different fields
      const tasks = tasksArr.map((t: any) => ({
        ...t,
        task_id: t.task_id || t.id,
        task_name: t.task_name || t.title || t.name || "Untitled Task",
        assigned_to_name:
          t.assigned_to_name ||
          t.assignee_name ||
          t.assigned_name ||
          t.employee_name ||
          t.user_name ||
          (t.assigned_to_first_name
            ? `${t.assigned_to_first_name} ${t.assigned_to_last_name || ""}`.trim()
            : null) ||
          null,
        status: t.status || "Pending",
      }));

      // Normalise Meetings — getProjectMeetings returns any[] directly
      const meetingsRaw =
        meetingsRes.status === "fulfilled" ? meetingsRes.value : null;
      const meetings: any[] = Array.isArray(meetingsRaw) ? meetingsRaw : [];

      const localProject = projects.find((p) => p.project_id === projectId);

      const normalizedMembers = members.map((m: any) => ({
        ...m,
        name:
          m.name ||
          m.employee_name ||
          m.full_name ||
          m.user_name ||
          (m.first_name
            ? `${m.first_name} ${m.last_name || ""}`.trim()
            : null) ||
          "Unknown Member",
      }));

      const normalized: Project = {
        ...(localProject || {}),
        ...projectData,
        project_id: projectId,
        members:
          membersRes.status === "fulfilled"
            ? normalizedMembers
            : localProject?.members || [],
        tasks: tasksRes.status === "fulfilled" ? tasks : localProject?.tasks || [],
        meetings:
          meetingsRes.status === "fulfilled"
            ? meetings
            : localProject?.meetings || [],
        member_count:
          projectData?.member_count ??
          members.length ??
          localProject?.member_count ??
          0,
        task_count:
          projectData?.task_count ??
          tasks.length ??
          localProject?.task_count ??
          0,
        person_in_charge_name:
          projectData?.person_in_charge_name ||
          projectData?.pic_name ||
          localProject?.person_in_charge_name ||
          localProject?.pic_name,
        person_in_charge_id:
          projectData?.person_in_charge_id ||
          projectData?.person_in_charge ||
          projectData?.pic_id ||
          localProject?.person_in_charge_id ||
          localProject?.pic_id,
      };

      return normalized;
    } catch (err: any) {
      console.error("Failed to load full project details:", err);
      throw err;
    }
  };

  const handleAddMember = async () => {
    if (!selectedProject || selectedMemberIds.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one employee",
        variant: "destructive",
      });
      return;
    }
    try {
      await apiService.addProjectMembersBulk(
        selectedProject.project_id,
        selectedMemberIds,
      );
      toast({ title: "Success", description: "Members added successfully" });
      setSelectedMemberIds([]);

      // Refresh details
      const updated = await loadFullProjectDetails(selectedProject.project_id);
      setSelectedProject(updated);
      setProjects((prev) =>
        prev.map((p) => (p.project_id === selectedProject.project_id ? updated : p)),
      );
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to add members",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (
    userId: number,
    projectIdOverride?: number,
  ) => {
    const projectId = projectIdOverride ?? selectedProject?.project_id;
    if (!projectId) return;
    try {
      await apiService.removeProjectMember(projectId, userId);
      toast({ title: "Success", description: "Member removed" });

      // Refresh details
      const updated = await loadFullProjectDetails(projectId);
      setSelectedProject(updated);
      setProjects((prev) =>
        prev.map((p) => (p.project_id === projectId ? updated : p)),
      );
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleAssignTasks = async () => {
    if (!selectedProject) return;
    const validTasks = taskList.filter(
      (t) => t.task_name.trim() && t.assigned_to_ids.length > 0,
    );
    if (!validTasks.length) {
      toast({
        title: "Error",
        description:
          "Add at least one task with a name and at least one assignee",
        variant: "destructive",
      });
      return;
    }
    setIsUpdating(true);
    try {
      // Use Bulk API: one API call per task row (which can have multiple assignees)
      for (const task of validTasks) {
        await apiService.assignTasksBulk({
          title: task.task_name,
          description: task.description,
          status: task.status,
          start_date: task.start_date || null,
          due_date: task.due_date || null,
          priority: task.priority,
          assigned_to_ids: task.assigned_to_ids,
          project_id: Number(selectedProject.project_id || (selectedProject as any).id),
        });
      }
      toast({ title: "Success", description: "Tasks assigned successfully" });
      setIsTaskDialogOpen(false);
      setTaskList([emptyTask()]);

      // Refresh details
      const updated = await loadFullProjectDetails(selectedProject.project_id);
      setSelectedProject(updated);
      setProjects((prev) =>
        prev.map((p) => (p.project_id === selectedProject.project_id ? updated : p)),
      );
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to assign tasks",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenAssignTasks = async (project: Project) => {
    setSelectedProject(project);
    setTaskList([emptyTask()]);
    setIsTaskDialogOpen(true);
    try {
      const normalized = await loadFullProjectDetails(project.project_id);
      setSelectedProject(normalized);
    } catch (err: any) {
      toast({
        title: "Warning",
        description: "Failed to refresh member list, using local data.",
        variant: "destructive",
      });
    }
  };

  const handleView = async (projectId: number) => {
    // Immediately show whatever we already have locally so the dialog isn't blank
    const localProject =
      projects.find((p) => p.project_id === projectId) || null;
    setSelectedProject(localProject);
    setIsLoadingDetails(true);
    setIsViewDialogOpen(true);
    try {
      const normalized = await loadFullProjectDetails(projectId);
      setSelectedProject(normalized);
      // ✅ Update the main projects list so the card counts are also refreshed
      setProjects((prev) =>
        prev.map((p) => (p.project_id === projectId ? normalized : p)),
      );
    } catch (err: any) {
      // Keep showing the local data on error instead of closing the dialog
      if (!localProject) {
        setIsViewDialogOpen(false);
      }
      toast({
        title: "Error",
        description: err.message || "Failed to load project details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleTaskStatusChange = async (
    projectId: number,
    taskId: number,
    status: string,
  ) => {
    try {
      // Find the project and task from the CURRENT list or selectedProject to get metadata
      const project = projects.find(p => p.project_id === projectId) || (selectedProject?.project_id === projectId ? selectedProject : null);
      if (!project) throw new Error("Project context not found");

      const taskObj: any = project.tasks?.find(t => (t.task_id === taskId || t.id === taskId));

      // Map UI status back to backend-friendly status
      let backendStatus = status;
      if (status === "todo") backendStatus = "Pending";
      else if (status === "in-progress") backendStatus = "In Progress";
      else if (status === "completed") backendStatus = "Completed";
      else if (status === "cancelled") backendStatus = "Cancelled";

      await apiService.updateProjectTaskStatus(projectId, taskId, backendStatus, {
        title: taskObj?.task_name || taskObj?.title || "Project Task",
        assigned_to: taskObj?.assigned_to || null
      });
      toast({ title: "Success", description: "Task status updated" });
      fetchProjects();

      // Also update selected project if open
      if (selectedProject && selectedProject.project_id === projectId) {
        const updated = await loadFullProjectDetails(projectId);
        setSelectedProject(updated);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update task status",
        variant: "destructive",
      });
    }
  };

  const handleOpenReassign = (task: ProjectTask, projectId: number) => {
    // Ensure we have the project members for the select
    const proj = projects.find((p) => p.project_id === projectId);
    if (proj) setSelectedProject(proj);

    setTaskToReassign({ task, projectId });
    setReassignForm({
      assigned_to: String(task.assigned_to || ""),
      status: task.status || "pending",
    });
    setIsReassignDialogOpen(true);
  };

  const handleReassignTask = async () => {
    if (!taskToReassign) return;
    const { task, projectId } = taskToReassign;
    const taskId = task.task_id ?? task.id ?? 0;

    setIsUpdating(true);
    try {
      // Create a complete payload for the generic task update to satisfy backend requirements
      const payload = {
        title: task.task_name || "Task",
        description: task.description || "",
        status: reassignForm.status,
        assigned_to: Number(reassignForm.assigned_to),
        project_id: projectId
      };

      const token = localStorage.getItem("token");
      const authHeader = token
        ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
        : {};

      // 1. Perform the general task PUT which handles assignee and status
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to update task (${response.status})`);
      }

      // 2. Also call the specific project task status endpoint to ensure project-level sync 
      if (reassignForm.status !== task.status) {
        try {
          await apiService.updateProjectTaskStatus(
            projectId,
            taskId,
            reassignForm.status,
          );
        } catch (_) {
          // Swallow status-specific errors if the main update succeeded
        }
      }

      toast({ title: "Success", description: "Task updated successfully" });
      setIsReassignDialogOpen(false);
      fetchProjects();

      if (selectedProject && selectedProject.project_id === projectId) {
        const updated = await loadFullProjectDetails(projectId);
        setSelectedProject(updated);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update task",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProjectStatusChange = async (
    projectId: number,
    status: string,
  ) => {
    try {
      const project = projects.find((p) => p.project_id === projectId);
      if (!project) throw new Error("Project not found");

      const rawProject = project as any;

      let backendStatus = status;
      if (status === "todo") backendStatus = "planned";
      else if (status === "in-progress") backendStatus = "in_progress";
      else if (status === "completed") backendStatus = "completed";
      else if (status === "cancelled") backendStatus = "cancelled";

      // Try PATCH first (status-only, no field requirements)
      // If backend doesn't support PATCH, fall back to full PUT
      try {
        await apiService.patchProjectStatus(projectId, backendStatus);
      } catch (patchErr: any) {
        // If PATCH not supported (405) or any other error, try full PUT
        // Resolve person_in_charge from every possible field the API may return
        const picId =
          rawProject.person_in_charge_id ??
          rawProject.person_in_charge ??
          rawProject.pic_id ??
          rawProject.created_by ??
          null;

        // Spread all raw fields so no backend-required field is lost,
        // then override the ones we control. Remove nested objects the API doesn't expect.
        const payload = {
          ...rawProject,
          project_id: projectId,
          name: project.name,
          description: project.description || "",
          start_date: project.start_date ? project.start_date.split("T")[0] : null,
          end_date: project.end_date ? project.end_date.split("T")[0] : null,
          status: backendStatus,
          person_in_charge: picId,
          members: undefined,
          tasks: undefined,
          meetings: undefined,
        };

        await apiService.updateProject(projectId, payload);
      }

      toast({
        title: "Success",
        description: `Project status updated to ${statusLabel(status)}`,
      });
      fetchProjects();
    } catch (err: any) {
      console.error("Project status update error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update project status",
        variant: "destructive",
      });
    }
  };

  const handleToggleProjectActive = async (
    projectId: number,
    isActive: boolean,
  ) => {
    try {
      await apiService.updateProjectStatus(projectId, isActive);
      toast({
        title: "Success",
        description: isActive ? "Project activated" : "Project deactivated",
      });
      fetchProjects();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update project status",
        variant: "destructive",
      });
    }
  };

  const handleViewTask = (task: ProjectTask) => {
    setViewingTask(task);
    setIsViewTaskDialogOpen(true);
  };


  const canManageProjects =
    ["admin", "hr", "manager"].includes(normalizeRole(user?.role));

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <div className="space-y-6 min-h-screen">
      {/* ── Header Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-200 dark:shadow-violet-900">
              <FolderKanban className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Project Management
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Build teams, assign tasks, and track progress.
              </p>
            </div>
          </div>
          {canManageProjects && (
            <Button
              className="gap-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 dark:shadow-violet-900"
              onClick={() => {
                resetForm();
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] rounded-xl h-10">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Total",
            value: projects.length,
            color: "from-purple-400 to-indigo-500",
            icon: FolderKanban,
          },
          {
            label: "Pending",
            value: projects.filter(
              (p) => normalizeStatus(p.status) === "todo",
            ).length,
            color: "from-amber-400 to-orange-500",
            icon: Briefcase,
          },
          {
            label: "In Progress",
            value: projects.filter(
              (p) => normalizeStatus(p.status) === "in-progress",
            ).length,
            color: "from-blue-400 to-blue-500",
            icon: Clock,
          },
          {
            label: "Complete",
            value: projects.filter(
              (p) => normalizeStatus(p.status) === "completed",
            ).length,
            color: "from-emerald-400 to-teal-500",
            icon: CheckCircle2,
          },
          {
            label: "Cancelled",
            value: projects.filter(
              (p) => normalizeStatus(p.status) === "cancelled",
            ).length,
            color: "from-slate-400 to-slate-500",
            icon: XCircle,
          },
          {
            label: "Archived",
            value: projects.filter(
              (p) => normalizeStatus(p.status) === "archived",
            ).length,
            color: "from-yellow-400 to-yellow-500",
            icon: ArchiveIcon,
          },
        ].map((s) => (
          <Card
            key={s.label}
            className="border-0 shadow-md rounded-2xl overflow-hidden min-w-0"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div
                className={`bg-gradient-to-br ${s.color} h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}
              >
                <s.icon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                  {s.value}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase truncate">
                  {s.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Projects Grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FolderKanban className="h-14 w-14 mb-3 opacity-20" />
          <p className="text-sm font-medium">No projects found</p>
          {canManageProjects && (
            <Button
              variant="outline"
              className="mt-4 gap-1"
              onClick={() => {
                resetForm();
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.project_id}
              project={project}
              canManageProjects={canManageProjects}
              isDeleting={isDeleting}
              onEdit={() => {
                setSelectedProject(project);
                setFormData({
                  name: project.name,
                  description: project.description || "",
                  start_date: project.start_date?.split("T")[0] || "",
                  end_date: project.end_date?.split("T")[0] || "",
                  status: normalizeStatus(project.status),
                  person_in_charge_id: String(project.person_in_charge_id || project.pic_id || ""),
                });
                setIsEditDialogOpen(true);
              }}
              onDelete={() => handleDelete(project.project_id)}
              onManageMembers={async () => {
                setSelectedProject(project);
                setSelectedMemberIds([]);
                setMemberSearch("");
                setIsMemberDialogOpen(true);
                // Load full project details to get the members list
                try {
                  const full = await loadFullProjectDetails(project.project_id);
                  setSelectedProject(full);
                } catch (_) { }
              }}
              onRemoveMembers={async () => {
                setSelectedProject(project);
                setIsRemoveMemberDialogOpen(true);
                // Load full project details to get the members list
                try {
                  const full = await loadFullProjectDetails(project.project_id);
                  setSelectedProject(full);
                } catch (_) { }
              }}
              onRemoveMember={(userId) => {
                setSelectedProject(project);
                // Pass the project_id directly to avoid race condition with async setState
                handleRemoveMember(userId, project.project_id);
              }}
              onAssignTasks={() => handleOpenAssignTasks(project)}
              onTaskStatusChange={handleTaskStatusChange}
              onProjectStatusChange={handleProjectStatusChange}
              onToggleActive={(pid, isActive) =>
                handleToggleProjectActive(pid, isActive)
              }
              onView={() => handleView(project.project_id)}
              onReassignTask={handleOpenReassign}
            />
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════
          PROJECT DETAILS DIALOG
         ══════════════════════════════════════ */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border-0 shadow-2xl p-0">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white relative">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                <FolderKanban className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  {selectedProject?.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className={`${statusColor(selectedProject?.status || "")} border-0 shadow-sm px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider`}
                  >
                    {statusLabel(selectedProject?.status || "")}
                  </Badge>
                  <span className="text-white/60 text-xs flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {selectedProject?.start_date
                      ? new Date(
                        selectedProject.start_date,
                      ).toLocaleDateString()
                      : "N/A"}{" "}
                    -{" "}
                    {selectedProject?.end_date
                      ? new Date(selectedProject.end_date).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-white/80 leading-relaxed text-sm max-w-2xl">
              {selectedProject?.description || "No description provided."}
            </p>
          </div>

          <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-950">
            {isLoadingDetails ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-violet-100 dark:border-violet-900 animate-pulse"></div>
                  <Loader2 className="h-16 w-16 animate-spin text-violet-600 absolute top-0 left-0" />
                </div>
                <p className="text-slate-500 font-medium animate-pulse">
                  Fetching project details...
                </p>
              </div>
            ) : (
              <>
                {/* Project Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        In Charge
                      </p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                        {selectedProject?.person_in_charge_name ||
                          selectedProject?.pic_name ||
                          "Not assigned"}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        Members
                      </p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                        {selectedProject?.member_count ??
                          selectedProject?.members?.length ??
                          0}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        Tasks
                      </p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                        {selectedProject?.task_count ??
                          selectedProject?.tasks?.length ??
                          0}
                      </p>
                    </div>
                  </div>
                  {/* Planned & Done counts removed per user request */}
                </div>

                {/* Team Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      Team Members
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px] px-2 py-0.5 rounded-full ml-1">
                        {selectedProject?.members?.length || 0}
                      </span>
                    </h3>
                  </div>
                  {!selectedProject?.members?.length ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-100 dark:border-slate-800 border-dashed">
                      <Users className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">
                        No members assigned to this project yet.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedProject.members.map((m) => (
                        <div
                          key={m.user_id}
                          className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3 group hover:shadow-md transition-all"
                        >
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            {m.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                              {m.name}
                            </p>
                            <p className="text-[10px] text-slate-400 capitalize bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-md w-fit mt-0.5 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 transition-colors">
                              {m.role || "Member"}
                            </p>
                          </div>

                          {canManageProjects && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-auto h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(`Remove ${m.name} from this project?`)
                                ) {
                                  handleRemoveMember(m.user_id);
                                }
                              }}
                              title="Remove member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Tasks Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-amber-500" />
                      Project Tasks
                      <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-[10px] px-2 py-0.5 rounded-full ml-1">
                        {selectedProject?.tasks?.length || 0}
                      </span>
                    </h3>
                  </div>

                  {!selectedProject?.tasks?.length ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-100 dark:border-slate-800 border-dashed">
                      <ClipboardList className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">
                        No tasks have been created for this project.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 border-0">
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-6">
                              Task Details
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Assignee
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Assigned By
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">
                              Status
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pr-6 text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedProject.tasks.map((task: any) => (
                            <TaskRow
                              key={task.task_id}
                              task={task}
                              canManageProjects={canManageProjects}
                              onStatusChange={(taskId, status) =>
                                handleTaskStatusChange(
                                  selectedProject.project_id,
                                  taskId,
                                  status,
                                )
                              }
                              onReassign={(t) =>
                                handleOpenReassign(
                                  t,
                                  selectedProject.project_id,
                                )
                              }
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>

                {/* Meetings Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Video className="h-5 w-5 text-rose-500" />
                      Project Meetings
                      <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 text-[10px] px-2 py-0.5 rounded-full ml-1">
                        {selectedProject?.meetings?.length || 0}
                      </span>
                    </h3>
                  </div>

                  {!selectedProject?.meetings?.length ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-100 dark:border-slate-800 border-dashed">
                      <Video className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">
                        No meetings scheduled for this project.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedProject.meetings.map((meeting) => (
                        <div
                          key={meeting.meeting_id}
                          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {meeting.title}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase font-bold text-rose-500 border-rose-200 bg-rose-50 dark:bg-rose-900/10"
                                >
                                  Meeting
                                </Badge>
                              </div>
                              {meeting.description && (
                                <p className="text-xs text-slate-400 line-clamp-1 mb-2">
                                  "{meeting.description}"
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {new Date(
                                    meeting.start_time,
                                  ).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Clock className="h-3.5 w-3.5" />
                                  {new Date(
                                    meeting.start_time,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {meeting.meeting_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-full text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50 gap-1.5"
                                  onClick={() =>
                                    window.open(meeting.meeting_url, "_blank")
                                  }
                                >
                                  <Video className="h-3.5 w-3.5" /> Join Meeting
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            <div className="pt-4 flex justify-end">
              <Button
                onClick={() => setIsViewDialogOpen(false)}
                className="rounded-full px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-tight shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          CREATE PROJECT DIALOG
         ══════════════════════════════════════ */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FolderKanban className="h-5 w-5 text-violet-500" />
              Create New Project
            </DialogTitle>
            <DialogDescription>
              Set up project details, build your team, and assign tasks all in
              one step.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* ── Project Details ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 text-xs items-center justify-center font-bold">
                  1
                </span>
                Project Details
              </div>
              <div className="grid gap-4 pl-7">
                <div className="space-y-1.5">
                  <Label htmlFor="cp_name">Project Name *</Label>
                  <Input
                    id="cp_name"
                    placeholder="e.g., Website Redesign"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Brief overview of the project..."
                    rows={2}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                    />
                  </div>
                  {/* Status & PIC */}
                  <div className="space-y-1.5">
                    <Label>Person in Charge *</Label>
                    <Select
                      value={String(formData.person_in_charge_id)}
                      onValueChange={(v) =>
                        setFormData({ ...formData, person_in_charge_id: v })
                      }
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="Select PIC" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableEmployees.map((emp) => (
                          <SelectItem
                            key={emp.user_id}
                            value={String(emp.user_id)}
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                {emp.name?.[0]?.toUpperCase()}
                              </div>
                              <span className="text-xs">{emp.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Team Members ── */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs items-center justify-center font-bold">
                  2
                </span>
                Build Your Team
                {selectedMemberIds.length > 0 && (
                  <Badge className="ml-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0 text-xs">
                    {selectedMemberIds.length} selected
                  </Badge>
                )}
              </div>
              <div className="pl-7 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    className="pl-8 h-9 text-sm"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMemberOptions.length === 0 ? (
                    <p className="text-xs text-center text-slate-400 py-4">
                      No employees found
                    </p>
                  ) : (
                    filteredMemberOptions.map((emp) => (
                      <label
                        key={emp.user_id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedMemberIds.includes(emp.user_id)}
                          onCheckedChange={() => toggleMember(emp.user_id)}
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {emp.name}
                          </p>
                          {(emp.role || emp.department) && (
                            <p className="text-xs text-slate-400 truncate capitalize">
                              {[emp.role, emp.department]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ── Tasks ── */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 text-xs items-center justify-center font-bold">
                    3
                  </span>
                  Assign Tasks{" "}
                  <span className="text-slate-400 font-normal text-xs">
                    (Optional)
                  </span>
                </div>
              </div>
              <div className="pl-7">
                <TaskFormSection
                  taskList={taskList}
                  assignableEmployees={assignableEmployees}
                  updateTaskRow={updateTaskRow}
                  toggleTaskAssignee={toggleTaskAssignee}
                  removeTaskRow={removeTaskRow}
                  addTaskRow={addTaskRow}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          EDIT PROJECT DIALOG
          ...
          (lines 1060-1218 omitted for brevity, but I should be careful)
          Actually, I need to update the TaskFormSection call in the ASSIGN TASKS DIALOG as well.

            {/* ══════════════════════════════════════
          EDIT PROJECT DIALOG
         ══════════════════════════════════════ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-500" /> Edit Project
            </DialogTitle>
            <DialogDescription>
              Update details for: {selectedProject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Project Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Person in Charge *</Label>
              <Select
                value={String(formData.person_in_charge_id)}
                onValueChange={(v) =>
                  setFormData({ ...formData, person_in_charge_id: v })
                }
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select PIC" />
                </SelectTrigger>
                <SelectContent>
                  {assignableEmployees.map((emp) => (
                    <SelectItem key={emp.user_id} value={String(emp.user_id)}>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">
                          {emp.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs">{emp.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
                disabled={["completed", "complete", "achieved"].includes(
                  normalizeStatus(selectedProject?.status),
                )}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Planned</SelectItem>
                  <SelectItem value="in-progress">In-Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          MANAGE MEMBERS DIALOG
         ══════════════════════════════════════ */}
      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" /> Manage Team Members
            </DialogTitle>
            <DialogDescription>
              Add or remove members from: {selectedProject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search employees to add..."
                  className="pl-8 h-9 text-sm"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMemberOptions.filter(
                  (e) =>
                    !selectedProject?.members?.some(
                      (m) => m.user_id === e.user_id,
                    ),
                ).length === 0 ? (
                  <p className="text-xs text-center text-slate-400 py-4">
                    No employees found to add
                  </p>
                ) : (
                  filteredMemberOptions
                    .filter(
                      (e) =>
                        !selectedProject?.members?.some(
                          (m) => m.user_id === e.user_id,
                        ),
                    )
                    .map((emp) => (
                      <label
                        key={emp.user_id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedMemberIds.includes(emp.user_id)}
                          onCheckedChange={() => toggleMember(emp.user_id)}
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {emp.name}
                          </p>
                          {emp.role && (
                            <p className="text-xs text-slate-400 truncate capitalize">
                              {emp.role}
                            </p>
                          )}
                        </div>
                      </label>
                    ))
                )}
              </div>
              <div className="pt-2">
                <Button
                  onClick={handleAddMember}
                  disabled={selectedMemberIds.length === 0}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <UserPlus className="h-4 w-4" /> Add Selected Members (
                  {selectedMemberIds.length})
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-2">
                Current Members ({selectedProject?.members?.length || 0})
              </p>
              {!selectedProject?.members?.length ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  No members yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {selectedProject.members.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                          {m.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.name}</p>
                          {m.role && (
                            <p className="text-xs text-slate-400 capitalize">
                              {m.role}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-red-50 hover:text-red-600 gap-1 rounded-lg"
                        onClick={() => handleRemoveMember(m.user_id)}
                        title="Remove from project"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Remove</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsMemberDialogOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          REMOVE MEMBERS DIALOG
         ══════════════════════════════════════ */}
      <Dialog
        open={isRemoveMemberDialogOpen}
        onOpenChange={setIsRemoveMemberDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-red-500" /> Remove Team Members
            </DialogTitle>
            <DialogDescription>
              Directly remove members from: {selectedProject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-3">
                Current Members ({selectedProject?.members?.length || 0})
              </p>
              {!selectedProject?.members?.length ? (
                <p className="text-sm text-slate-400 text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed">
                  No members yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                  {selectedProject.members.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                          {m.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {m.name}
                          </p>
                          {m.role && (
                            <p className="text-[11px] text-slate-400 capitalize bg-slate-100 dark:bg-slate-800 w-fit px-1.5 py-0.5 rounded-md mt-0.5">
                              {m.role}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                        onClick={() => handleRemoveMember(m.user_id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRemoveMemberDialogOpen(false)}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          ASSIGN TASKS DIALOG
         ══════════════════════════════════════ */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-amber-500" /> Assign Tasks
            </DialogTitle>
            <DialogDescription>
              Assign tasks to team members of: {selectedProject?.name}
            </DialogDescription>
          </DialogHeader>

          {/* Show current members for context */}
          {selectedProject?.members && selectedProject.members.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-3 border-b">
              <span className="text-xs text-slate-400 self-center">Team:</span>
              {selectedProject.members.map((m) => (
                <Badge key={m.user_id} variant="secondary" className="text-xs">
                  {m.name}
                </Badge>
              ))}
            </div>
          )}

          <TaskFormSection
            taskList={taskList}
            assignableEmployees={assignableEmployees}
            updateTaskRow={updateTaskRow}
            toggleTaskAssignee={toggleTaskAssignee}
            removeTaskRow={removeTaskRow}
            addTaskRow={addTaskRow}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTaskDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignTasks}
              disabled={isUpdating}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Tasks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          REASSIGN TASK DIALOG
         ══════════════════════════════════════ */}
      <Dialog
        open={isReassignDialogOpen}
        onOpenChange={setIsReassignDialogOpen}
      >
        <DialogContent className="max-w-md rounded-3xl border-0 shadow-2xl overflow-hidden p-0">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <RefreshCcw className="h-5 w-5" />
                  Reassign & Update Task
                </h3>
                <p className="text-white/70 text-xs mt-1">
                  Modify task ownership and status
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-5 bg-white dark:bg-slate-950">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Task Name
              </Label>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-sm font-medium text-slate-600">
                {taskToReassign?.task.task_name}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Assigned To
              </Label>
              <Select
                value={reassignForm.assigned_to}
                onValueChange={(v) =>
                  setReassignForm((f) => ({ ...f, assigned_to: v }))
                }
              >
                <SelectTrigger className="rounded-xl border-slate-200 h-11 bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] rounded-xl shadow-xl">
                  {selectedProject?.members?.map((m) => (
                    <SelectItem key={m.user_id} value={String(m.user_id)}>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-blue-700">
                          {m.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{m.name}</span>
                        {m.role && <span className="text-[10px] text-slate-400 capitalize">({m.role})</span>}
                      </div>
                    </SelectItem>
                  ))}
                  {(!selectedProject?.members ||
                    selectedProject.members.length === 0) && (
                      <p className="text-xs p-3 text-slate-400 text-center">
                        No members in this project.
                      </p>
                    )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Update Status
              </Label>
              <Select
                value={reassignForm.status}
                onValueChange={(v) =>
                  setReassignForm((f) => ({ ...f, status: v }))
                }
              >
                <SelectTrigger className="rounded-xl border-slate-200 h-11 bg-white dark:bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl">
                  <SelectItem value="Pending">
                    <span className="flex items-center gap-2 text-amber-600 font-medium">
                      <Clock className="h-4 w-4" /> Pending
                    </span>
                  </SelectItem>
                  <SelectItem value="In Progress">
                    <span className="flex items-center gap-2 text-blue-600 font-medium">
                      <Clock className="h-4 w-4" /> In Progress
                    </span>
                  </SelectItem>
                  <SelectItem value="Completed">
                    <span className="flex items-center gap-2 text-emerald-600 font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Completed
                    </span>
                  </SelectItem>
                  <SelectItem value="Archived">
                    <span className="flex items-center gap-2 text-slate-600 font-medium">
                      <FolderKanban className="h-4 w-4" /> Archived
                    </span>
                  </SelectItem>
                  <SelectItem value="Cancelled">
                    <span className="flex items-center gap-2 text-red-500 font-medium">
                      <XCircle className="h-4 w-4" /> Cancelled
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsReassignDialogOpen(false)}
                className="rounded-xl h-11 font-semibold flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReassignTask}
                disabled={isUpdating}
                className="rounded-xl h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-8 font-bold shadow-lg flex-1"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Update Task
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
