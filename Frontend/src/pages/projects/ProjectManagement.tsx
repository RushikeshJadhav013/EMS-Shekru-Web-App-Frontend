import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
    Plus,
    Edit,
    Trash2,
    Search,
    Eye,
    Loader2,
    FolderKanban,
    Users,
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { formatDateIST } from '@/utils/timezone';

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
    assigned_to_name?: string;
    due_date?: string;
    status: 'pending' | 'in-progress' | 'overdue' | 'completed' | 'cancelled' | 'todo';
}


interface Project {
    project_id: number;
    name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    pic_name?: string;
    members?: ProjectMember[];
    tasks?: ProjectTask[];
}

interface Employee {
    user_id: number;
    name: string;
    email?: string;
    role?: string;
    department?: string;
}

const TASK_STATUSES = ['pending', 'in-progress', 'overdue', 'completed', 'cancelled', 'todo'] as const;
type TaskStatus = typeof TASK_STATUSES[number];

// Form-only type: supports multiple assignees per task row
interface TaskFormRow {
    task_name: string;
    description: string;
    assigned_to_ids: number[];
    due_date: string;
    status: TaskStatus;
}

const emptyTask = (): TaskFormRow => ({
    task_name: '',
    description: '',
    assigned_to_ids: [],
    due_date: '',
    status: 'pending',
});

// ─────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────
function TaskStatusBadge({ status }: { status: string }) {
    if (status === 'todo' || status === 'pending')
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 gap-1 text-[11px]"><Clock className="h-3 w-3" />Pending</Badge>;
    if (status === 'in-progress')
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 gap-1 text-[11px]"><Clock className="h-3 w-3" />In Progress</Badge>;
    if (status === 'overdue')
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1 text-[11px]"><AlertCircle className="h-3 w-3" />Overdue</Badge>;
    if (status === 'completed')
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1 text-[11px]"><CheckCircle2 className="h-3 w-3" />Completed</Badge>;
    if (status === 'cancelled')
        return <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0 gap-1 text-[11px]"><XCircle className="h-3 w-3" />Cancelled</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 gap-1 text-[11px]"><Clock className="h-3 w-3" />Pending</Badge>;
}

function statusColor(s?: string) {
    if (s === 'completed') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (s === 'cancelled') return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    if (s === 'on-hold') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (s === 'archived') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
}

// ─────────────────────────────────────────
// TaskRow sub-component with inline status
// ─────────────────────────────────────────
function TaskRow({
    task,
    canManageProjects,
    onStatusChange,
}: {
    task: ProjectTask;
    canManageProjects: boolean;
    onStatusChange: (taskId: number, status: string) => void;
}) {
    const id = task.task_id ?? task.id ?? 0;

    // Detect overdue automatically
    const isOverdue = useMemo(() => {
        if (task.status === 'completed' || task.status === 'cancelled') return false;
        if (!task.due_date) return false;
        const due = new Date(task.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return due < today;
    }, [task.due_date, task.status]);

    const effectiveStatus = isOverdue ? 'overdue' : (task.status === 'todo' ? 'pending' : task.status);

    return (
        <TableRow className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors">
            <TableCell className="pl-4">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{task.task_name}</p>
                {task.description && <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>}
            </TableCell>
            <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 flex-shrink-0">
                        {task.assigned_to_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    {task.assigned_to_name || 'Unassigned'}
                </div>
            </TableCell>
            <TableCell className="text-sm text-slate-500">
                {task.due_date ? formatDateIST(task.due_date, 'MMM dd, yyyy') : '—'}
            </TableCell>
            <TableCell>
                {canManageProjects ? (
                    <Select
                        value={task.status === 'todo' ? 'pending' : task.status}
                        onValueChange={(v) => onStatusChange(id, v)}
                    >
                        <SelectTrigger className="h-7 w-32 text-xs border-slate-200 dark:border-slate-700">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                            <SelectItem value="pending">
                                <span className="flex items-center gap-1.5 text-amber-600 font-medium"><Clock className="h-3 w-3" />Pending</span>
                            </SelectItem>
                            <SelectItem value="in-progress">
                                <span className="flex items-center gap-1.5 text-blue-600 font-medium"><Clock className="h-3 w-3" />In Progress</span>
                            </SelectItem>
                            <SelectItem value="overdue">
                                <span className="flex items-center gap-1.5 text-red-600 font-medium"><AlertCircle className="h-3 w-3" />Overdue</span>
                            </SelectItem>
                            <SelectItem value="completed">
                                <span className="flex items-center gap-1.5 text-emerald-600 font-medium"><CheckCircle2 className="h-3 w-3" />Completed</span>
                            </SelectItem>
                            <SelectItem value="cancelled">
                                <span className="flex items-center gap-1.5 text-slate-500 font-medium"><XCircle className="h-3 w-3" />Cancelled</span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <TaskStatusBadge status={effectiveStatus} />
                )}
                {isOverdue && task.status !== 'completed' && task.status !== 'cancelled' && !canManageProjects && (
                    <div className="mt-1">
                        <Badge className="bg-red-50 text-red-600 dark:bg-red-900/20 border-0 text-[9px] height-auto py-0 px-1">AUTO OVERDUE</Badge>
                    </div>
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
    onAssignTasks,
    onTaskStatusChange,
}: {
    project: Project;
    canManageProjects: boolean;
    isDeleting: number | null;
    onEdit: () => void;
    onDelete: () => void;
    onManageMembers: () => void;
    onAssignTasks: () => void;
    onTaskStatusChange: (projectId: number, taskId: number, status: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const tasks = project.tasks || [];
    const members = project.members || [];
    const todoCount = tasks.filter(t => t.status === 'todo').length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const cancelledCount = tasks.filter(t => t.status === 'cancelled').length;

    return (
        <Card className="border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <CardContent className="p-0">
                {/* ── Card Header ── */}
                <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">{project.name}</h3>
                                <Badge className={`capitalize border-0 text-[10px] px-2 py-0.5 ${statusColor(project.status)}`}>
                                    {project.status || 'Active'}
                                </Badge>
                            </div>
                            {project.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{project.description}</p>
                            )}
                            {/* Dates */}
                            {(project.start_date || project.end_date) && (
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />
                                        {project.start_date ? formatDateIST(project.start_date, 'MMM dd, yyyy') : '—'}
                                        {' → '}
                                        {project.end_date ? formatDateIST(project.end_date, 'MMM dd, yyyy') : '—'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {canManageProjects && (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" title="Manage Team Members" onClick={onManageMembers}>
                                        <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-50 hover:text-amber-600" title="Assign Tasks" onClick={onAssignTasks}>
                                        <ClipboardList className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-green-50 hover:text-green-600" title="Edit Project" onClick={onEdit}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                                        title="Delete Project"
                                        disabled={isDeleting === project.project_id}
                                        onClick={onDelete}
                                    >
                                        {isDeleting === project.project_id
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Trash2 className="h-4 w-4" />}
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
                                {members.length} Member{members.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Task counts */}
                        {tasks.length > 0 && (
                            <>
                                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
                                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{tasks.filter(t => t.status === 'todo' || t.status === 'pending').length} Pending</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{completedCount} Done</span>
                                </div>
                                {cancelledCount > 0 && (
                                    <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full">
                                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                                        <span className="text-xs font-medium text-red-500 dark:text-red-400">{cancelledCount} Cancelled</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Expand toggle */}
                        {(tasks.length > 0 || members.length > 0) && (
                            <button
                                onClick={() => setExpanded(e => !e)}
                                className="ml-auto flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-semibold hover:underline"
                            >
                                {expanded ? <><ChevronUp className="h-3.5 w-3.5" />Hide details</> : <><ChevronDown className="h-3.5 w-3.5" />View details</>}
                            </button>
                        )}
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
                                    {members.map(m => (
                                        <div key={m.user_id} className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-2.5 py-1 rounded-full">
                                            <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-bold text-white">
                                                {m.name[0]?.toUpperCase()}
                                            </div>
                                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{m.name}</span>
                                            {m.role && <span className="text-[10px] text-blue-400 capitalize">({m.role})</span>}
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
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {tasks.map((task, idx) => (
                                                <TaskRow
                                                    key={task.task_id ?? task.id ?? idx}
                                                    task={task}
                                                    canManageProjects={canManageProjects}
                                                    onStatusChange={(taskId, status) =>
                                                        onTaskStatusChange(project.project_id, taskId, status)
                                                    }
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {tasks.length === 0 && (
                            <div className="py-6 text-center text-xs text-slate-400">No tasks assigned yet.</div>
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
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);

    // Dialogs
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

    // Create/Edit form
    const [formData, setFormData] = useState({ name: '', description: '', start_date: '', end_date: '', status: 'active' });
    // Multi-select members (for create)
    const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
    const [memberSearch, setMemberSearch] = useState('');
    // Task list (for create + assign dialog)
    const [taskList, setTaskList] = useState<TaskFormRow[]>([emptyTask()]);
    // Manage members dialog
    const [addMemberId, setAddMemberId] = useState('');

    // ── Fetch ──
    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getProjects();
            setProjects(Array.isArray(data) ? data : data?.projects || []);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to load projects', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const data = await apiService.getEmployees();
            setEmployees((Array.isArray(data) ? data : []).map((e: any) => ({
                user_id: e.user_id || e.id,
                name: e.name,
                email: e.email,
                role: e.role,
                department: e.department,
            })));
        } catch (_) { }
    };

    useEffect(() => { fetchProjects(); fetchEmployees(); }, []);

    const filteredProjects = useMemo(() =>
        projects.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || (p.status || 'active') === statusFilter;
            return matchesSearch && matchesStatus;
        }), [projects, searchQuery, statusFilter]);

    // ── Helpers ──
    const resetForm = () => {
        setFormData({ name: '', description: '', start_date: '', end_date: '', status: 'active' });
        setSelectedMemberIds([]);
        setMemberSearch('');
        setTaskList([emptyTask()]);
        setAddMemberId('');
    };

    const toggleMember = (id: number) =>
        setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const addTaskRow = () => setTaskList(prev => [...prev, emptyTask()]);
    const updateTaskRow = (index: number, field: keyof TaskFormRow, value: any) =>
        setTaskList(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
    const toggleTaskAssignee = (index: number, userId: number) =>
        setTaskList(prev => prev.map((t, i) => {
            if (i !== index) return t;
            const ids = t.assigned_to_ids.includes(userId)
                ? t.assigned_to_ids.filter(id => id !== userId)
                : [...t.assigned_to_ids, userId];
            return { ...t, assigned_to_ids: ids };
        }));
    const removeTaskRow = (index: number) => {
        if (taskList.length === 1) return;
        setTaskList(prev => prev.filter((_, i) => i !== index));
    };

    const assignableEmployees = useMemo(() => {
        if (!user) return [];
        return employees.filter(e => {
            if (String(e.user_id) === String(user.id)) return true; // Can always assign to self
            if (user.role === 'admin' || user.role === 'hr') return true; // Admin/HR to everyone
            if (user.role === 'manager') return ['team_lead', 'employee'].includes(e.role || ''); // Manager to TL/Emp
            if (user.role === 'team_lead') return e.role === 'employee'; // TL to Emp
            return false; // Employee to no one
        });
    }, [employees, user]);

    const filteredMemberOptions = useMemo(() =>
        assignableEmployees.filter(e => e.name.toLowerCase().includes(memberSearch.toLowerCase())),
        [assignableEmployees, memberSearch]);

    // ── Handlers ──
    const handleCreate = async () => {
        if (!formData.name.trim()) {
            toast({ title: 'Error', description: 'Project name is required', variant: 'destructive' });
            return;
        }
        setIsCreating(true);
        try {
            // Fan-out: one task per (task, assignee) pair
            const expandedTasks: any[] = [];
            for (const t of taskList) {
                if (!t.task_name.trim() || t.assigned_to_ids.length === 0) continue;
                for (const uid of t.assigned_to_ids) {
                    expandedTasks.push({
                        task_name: t.task_name,
                        description: t.description,
                        assigned_to: uid,
                        due_date: t.due_date || undefined,
                        status: t.status,
                    });
                }
            }
            const payload = {
                ...formData,
                member_ids: selectedMemberIds,
                tasks: expandedTasks,
            };
            await apiService.createProject(payload);
            toast({ title: 'Success', description: 'Project created successfully' });
            setIsCreateDialogOpen(false);
            resetForm();
            fetchProjects();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to create project', variant: 'destructive' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedProject || !formData.name.trim()) {
            toast({ title: 'Error', description: 'Project name is required', variant: 'destructive' });
            return;
        }
        setIsUpdating(true);
        try {
            await apiService.updateProject(selectedProject.project_id, formData);
            toast({ title: 'Success', description: 'Project updated' });
            setIsEditDialogOpen(false);
            resetForm();
            fetchProjects();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to update project', variant: 'destructive' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async (projectId: number) => {
        if (!confirm('Delete this project? This cannot be undone.')) return;
        setIsDeleting(projectId);
        try {
            await apiService.deleteProject(projectId);
            toast({ title: 'Success', description: 'Project deleted' });
            fetchProjects();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to delete project', variant: 'destructive' });
        } finally {
            setIsDeleting(null);
        }
    };

    const handleAddMember = async () => {
        if (!selectedProject || !addMemberId) {
            toast({ title: 'Error', description: 'Please select an employee', variant: 'destructive' });
            return;
        }
        try {
            await apiService.addProjectMember(selectedProject.project_id, Number(addMemberId));
            toast({ title: 'Success', description: 'Member added' });
            setAddMemberId('');
            const updated = await apiService.getProject(selectedProject.project_id);
            setSelectedProject(updated);
            fetchProjects();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to add member', variant: 'destructive' });
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!selectedProject) return;
        try {
            await apiService.removeProjectMember(selectedProject.project_id, userId);
            toast({ title: 'Success', description: 'Member removed' });
            const updated = await apiService.getProject(selectedProject.project_id);
            setSelectedProject(updated);
            fetchProjects();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to remove member', variant: 'destructive' });
        }
    };

    const handleAssignTasks = async () => {
        if (!selectedProject) return;
        const validTasks = taskList.filter(t => t.task_name.trim() && t.assigned_to_ids.length > 0);
        if (!validTasks.length) {
            toast({ title: 'Error', description: 'Add at least one task with a name and at least one assignee', variant: 'destructive' });
            return;
        }
        setIsUpdating(true);
        try {
            // Fan-out: one API call per (task, employee) pair
            for (const task of validTasks) {
                for (const uid of task.assigned_to_ids) {
                    await apiService.createProjectTask(selectedProject.project_id, {
                        task_name: task.task_name,
                        description: task.description,
                        assigned_to: uid,
                        due_date: task.due_date || undefined,
                        status: task.status,
                    });
                }
            }
            toast({ title: 'Success', description: 'Tasks assigned successfully' });
            setIsTaskDialogOpen(false);
            setTaskList([emptyTask()]);
            const updated = await apiService.getProject(selectedProject.project_id);
            setSelectedProject(updated);
            fetchProjects();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to assign tasks', variant: 'destructive' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleTaskStatusChange = async (projectId: number, taskId: number, status: string) => {
        try {
            await apiService.updateProjectTaskStatus(projectId, taskId, status);
            toast({ title: 'Success', description: 'Task status updated' });
            fetchProjects();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to update task status', variant: 'destructive' });
        }
    };

    const canManageProjects = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

    // ─────────────────────────────────────────
    // Task form — Admin/HR only, multi-assignee
    // ─────────────────────────────────────────
    const TaskFormSection = ({ teamOnly = false }: { teamOnly?: boolean }) => {
        const assignOptions = teamOnly && selectedMemberIds.length > 0
            ? assignableEmployees.filter(e => selectedMemberIds.includes(e.user_id))
            : assignableEmployees;

        return (
            <div className="space-y-3">
                {taskList.map((task, index) => (
                    <div key={index} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        {/* Row 1: name, due date, status, remove */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <Input
                                placeholder="Task name *"
                                value={task.task_name}
                                onChange={e => updateTaskRow(index, 'task_name', e.target.value)}
                                className="md:col-span-2"
                            />
                            <Input
                                type="date"
                                value={task.due_date || ''}
                                onChange={e => updateTaskRow(index, 'due_date', e.target.value)}
                            />
                            <div className="flex gap-2">
                                <Select value={task.status} onValueChange={v => updateTaskRow(index, 'status', v as TaskStatus)}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">
                                            <span className="flex items-center gap-1.5 text-amber-600"><Clock className="h-3 w-3" />Pending</span>
                                        </SelectItem>
                                        <SelectItem value="in-progress">
                                            <span className="flex items-center gap-1.5 text-blue-600"><Clock className="h-3 w-3" />In Progress</span>
                                        </SelectItem>
                                        <SelectItem value="overdue">
                                            <span className="flex items-center gap-1.5 text-red-600"><AlertCircle className="h-3 w-3" />Overdue</span>
                                        </SelectItem>
                                        <SelectItem value="completed">
                                            <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-3 w-3" />Completed</span>
                                        </SelectItem>
                                        <SelectItem value="cancelled">
                                            <span className="flex items-center gap-1.5 text-slate-500"><XCircle className="h-3 w-3" />Cancelled</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {taskList.length > 1 && (
                                    <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-red-50 hover:text-red-600" onClick={() => removeTaskRow(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {/* Description */}
                        <Input
                            placeholder="Description (optional)"
                            value={task.description || ''}
                            onChange={e => updateTaskRow(index, 'description', e.target.value)}
                        />
                        {/* Multi-employee assignee */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    Assign to employees *
                                    <span className="ml-1 text-slate-400 font-normal">(tick one or more)</span>
                                </p>
                                {task.assigned_to_ids.length > 0 && (
                                    <Badge className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-0">
                                        {task.assigned_to_ids.length} selected
                                    </Badge>
                                )}
                            </div>
                            <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950">
                                {assignOptions.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-3">
                                        {teamOnly ? 'Select team members in Step 2 first.' : 'No employees available.'}
                                    </p>
                                ) : assignOptions.map(emp => (
                                    <label
                                        key={emp.user_id}
                                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors"
                                    >
                                        <Checkbox
                                            checked={task.assigned_to_ids.includes(emp.user_id)}
                                            onCheckedChange={() => toggleTaskAssignee(index, emp.user_id)}
                                            className="data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                                        />
                                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                                            {emp.name[0]?.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{emp.name}</span>
                                            {emp.role && <span className="text-xs text-slate-400 ml-1.5 capitalize">({emp.role})</span>}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={addTaskRow} className="gap-1 w-full border-dashed">
                    <Plus className="h-3.5 w-3.5" /> Add Another Task
                </Button>
            </div>
        );
    };

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
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Project Management</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Build teams, assign tasks, and track progress.</p>
                        </div>
                    </div>
                    {canManageProjects && (
                        <Button
                            className="gap-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 dark:shadow-violet-900"
                            onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}
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
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px] rounded-xl h-10">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Projects</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on-hold">On Hold</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Total Projects', value: projects.length, color: 'from-violet-500 to-purple-600', icon: FolderKanban },
                    { label: 'Active', value: projects.filter(p => !p.status || p.status === 'active').length, color: 'from-blue-500 to-indigo-600', icon: Clock },
                    { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: 'from-emerald-500 to-teal-600', icon: CheckCircle2 },
                    { label: 'Archived', value: projects.filter(p => p.status === 'archived').length, color: 'from-slate-500 to-slate-600', icon: Trash2 },
                    { label: 'Total Tasks', value: projects.reduce((a, p) => a + (p.tasks?.length || 0), 0), color: 'from-amber-500 to-orange-600', icon: ClipboardList },
                ].map(s => (
                    <Card key={s.label} className="border-0 shadow-md rounded-2xl overflow-hidden">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className={`bg-gradient-to-br ${s.color} h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                                <s.icon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
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
                        <Button variant="outline" className="mt-4 gap-1" onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
                            <Plus className="h-4 w-4" /> Create your first project
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredProjects.map(project => (
                        <ProjectCard
                            key={project.project_id}
                            project={project}
                            canManageProjects={canManageProjects}
                            isDeleting={isDeleting}
                            onEdit={() => {
                                setSelectedProject(project);
                                setFormData({
                                    name: project.name,
                                    description: project.description || '',
                                    start_date: project.start_date?.split('T')[0] || '',
                                    end_date: project.end_date?.split('T')[0] || '',
                                    status: project.status || 'active',
                                });
                                setIsEditDialogOpen(true);
                            }}
                            onDelete={() => handleDelete(project.project_id)}
                            onManageMembers={() => { setSelectedProject(project); setIsMemberDialogOpen(true); }}
                            onAssignTasks={() => { setSelectedProject(project); setTaskList([emptyTask()]); setIsTaskDialogOpen(true); }}
                            onTaskStatusChange={handleTaskStatusChange}
                        />
                    ))}
                </div>
            )}

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
                        <DialogDescription>Set up project details, build your team, and assign tasks all in one step.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* ── Project Details ── */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <span className="flex h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 text-xs items-center justify-center font-bold">1</span>
                                Project Details
                            </div>
                            <div className="grid gap-4 pl-7">
                                <div className="space-y-1.5">
                                    <Label htmlFor="cp_name">Project Name *</Label>
                                    <Input id="cp_name" placeholder="e.g., Website Redesign" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Description</Label>
                                    <Textarea placeholder="Brief overview of the project..." rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Start Date</Label>
                                        <Input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>End Date</Label>
                                        <Input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Status</Label>
                                        <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="on-hold">On Hold</SelectItem>
                                                <SelectItem value="completed">Completed</SelectItem>
                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                                <SelectItem value="archived">Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Team Members ── */}
                        <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <span className="flex h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs items-center justify-center font-bold">2</span>
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
                                        onChange={e => setMemberSearch(e.target.value)}
                                    />
                                </div>
                                <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredMemberOptions.length === 0 ? (
                                        <p className="text-xs text-center text-slate-400 py-4">No employees found</p>
                                    ) : filteredMemberOptions.map(emp => (
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
                                                {emp.name[0]?.toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{emp.name}</p>
                                                {(emp.role || emp.department) && (
                                                    <p className="text-xs text-slate-400 truncate capitalize">{[emp.role, emp.department].filter(Boolean).join(' · ')}</p>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Tasks ── */}
                        <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    <span className="flex h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 text-xs items-center justify-center font-bold">3</span>
                                    Assign Tasks <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                                </div>
                            </div>
                            <div className="pl-7">
                                <TaskFormSection teamOnly />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={isCreating} className="bg-violet-600 hover:bg-violet-700">
                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════
          EDIT PROJECT DIALOG
         ══════════════════════════════════════ */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5 text-blue-500" /> Edit Project
                        </DialogTitle>
                        <DialogDescription>Update details for: {selectedProject?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Project Name *</Label>
                            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Start Date</Label>
                                <Input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>End Date</Label>
                                <Input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="on-hold">On Hold</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
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
                        <DialogDescription>Add or remove members from: {selectedProject?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Select value={addMemberId} onValueChange={setAddMemberId}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select employee to add..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableEmployees
                                        .filter(e => !selectedProject?.members?.some(m => m.user_id === e.user_id))
                                        .map(e => (
                                            <SelectItem key={e.user_id} value={String(e.user_id)}>
                                                {e.name} {e.role ? `· ${e.role}` : ''}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleAddMember} className="gap-1 bg-blue-600 hover:bg-blue-700 flex-shrink-0">
                                <UserPlus className="h-4 w-4" /> Add
                            </Button>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-2">
                                Current Members ({selectedProject?.members?.length || 0})
                            </p>
                            {!selectedProject?.members?.length
                                ? <p className="text-sm text-slate-400 text-center py-4">No members yet.</p>
                                : (
                                    <div className="space-y-2 max-h-56 overflow-y-auto">
                                        {selectedProject.members.map(m => (
                                            <div key={m.user_id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                                                        {m.name[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{m.name}</p>
                                                        {m.role && <p className="text-xs text-slate-400 capitalize">{m.role}</p>}
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50 hover:text-red-600" onClick={() => handleRemoveMember(m.user_id)}>
                                                    <UserMinus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>Done</Button>
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
                            {selectedProject.members.map(m => (
                                <Badge key={m.user_id} variant="secondary" className="text-xs">{m.name}</Badge>
                            ))}
                        </div>
                    )}

                    <TaskFormSection teamOnly={false} />

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssignTasks} disabled={isUpdating} className="bg-amber-600 hover:bg-amber-700">
                            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Assign Tasks
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
