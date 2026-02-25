import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    Calendar,
    CheckCircle2,
    Clock,
    XCircle,
    UserPlus,
    UserMinus,
    ClipboardList,
    ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { formatDateIST } from '@/utils/timezone';

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────
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
    assigned_to: number;
    assigned_to_name?: string;
    due_date?: string;
    status: 'pending' | 'completed' | 'cancelled';
}

interface Project {
    project_id: number;
    name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    pic_id?: number;
    pic_name?: string;
    members?: ProjectMember[];
    tasks?: ProjectTask[];
    created_at?: string;
}

interface Employee {
    user_id: number;
    name: string;
    email?: string;
    role?: string;
    department?: string;
}

const TASK_STATUSES = ['pending', 'completed', 'cancelled'] as const;

// ─────────────────────────────────────────────
// Status badge helpers
// ─────────────────────────────────────────────
const getTaskStatusBadge = (status: string) => {
    switch (status) {
        case 'completed':
            return (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Completed
                </Badge>
            );
        case 'cancelled':
            return (
                <Badge className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1">
                    <XCircle className="h-3 w-3" /> Cancelled
                </Badge>
            );
        default:
            return (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 gap-1">
                    <Clock className="h-3 w-3" /> Pending
                </Badge>
            );
    }
};

const getProjectStatusColor = (status?: string) => {
    switch (status) {
        case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        case 'cancelled': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
        case 'on-hold': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
};

// ─────────────────────────────────────────────
// Empty task template
// ─────────────────────────────────────────────
const emptyTask = (): ProjectTask => ({
    task_name: '',
    description: '',
    assigned_to: 0,
    due_date: '',
    status: 'pending',
});

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function ProjectManagement() {
    const { user } = useAuth();

    // ── State ──
    const [projects, setProjects] = useState<Project[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);

    // ── Selected / Dialog states ──
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

    // ── Form data ──
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'active',
    });

    const [memberUserId, setMemberUserId] = useState('');
    const [taskList, setTaskList] = useState<ProjectTask[]>([emptyTask()]);

    // ── Fetch projects ──
    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getProjects();
            setProjects(Array.isArray(data) ? data : data?.projects || []);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to load projects', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    // ── Fetch employees ──
    const fetchEmployees = async () => {
        try {
            const data = await apiService.getEmployees();
            const mapped: Employee[] = (Array.isArray(data) ? data : []).map((e: any) => ({
                user_id: e.user_id || e.id,
                name: e.name,
                email: e.email,
                role: e.role,
                department: e.department,
            }));
            setEmployees(mapped);
        } catch (_) { }
    };

    useEffect(() => {
        fetchProjects();
        fetchEmployees();
    }, []);

    // ── Filtered projects ──
    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ── Reset form ──
    const resetForm = () => {
        setFormData({ name: '', description: '', start_date: '', end_date: '', status: 'active' });
        setTaskList([emptyTask()]);
        setMemberUserId('');
    };

    // ── Open edit dialog ──
    const openEdit = (project: Project) => {
        setSelectedProject(project);
        setFormData({
            name: project.name,
            description: project.description || '',
            start_date: project.start_date?.split('T')[0] || '',
            end_date: project.end_date?.split('T')[0] || '',
            status: project.status || 'active',
        });
        setIsEditDialogOpen(true);
    };

    // ── Create Project ──
    const handleCreate = async () => {
        if (!formData.name.trim()) {
            toast({ title: 'Error', description: 'Project name is required', variant: 'destructive' });
            return;
        }
        setIsCreating(true);
        try {
            const tasks = taskList.filter(t => t.task_name.trim() && t.assigned_to);
            await apiService.createProject({ ...formData, tasks });
            toast({ title: 'Success', description: 'Project created successfully' });
            setIsCreateDialogOpen(false);
            resetForm();
            fetchProjects();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to create project', variant: 'destructive' });
        } finally {
            setIsCreating(false);
        }
    };

    // ── Update Project ──
    const handleUpdate = async () => {
        if (!selectedProject) return;
        if (!formData.name.trim()) {
            toast({ title: 'Error', description: 'Project name is required', variant: 'destructive' });
            return;
        }
        setIsUpdating(true);
        try {
            await apiService.updateProject(selectedProject.project_id, formData);
            toast({ title: 'Success', description: 'Project updated successfully' });
            setIsEditDialogOpen(false);
            setSelectedProject(null);
            resetForm();
            fetchProjects();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to update project', variant: 'destructive' });
        } finally {
            setIsUpdating(false);
        }
    };

    // ── Delete Project ──
    const handleDelete = async (projectId: number) => {
        if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
        setIsDeleting(projectId);
        try {
            await apiService.deleteProject(projectId);
            toast({ title: 'Success', description: 'Project deleted successfully' });
            fetchProjects();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to delete project', variant: 'destructive' });
        } finally {
            setIsDeleting(null);
        }
    };

    // ── Add Member ──
    const handleAddMember = async () => {
        if (!selectedProject || !memberUserId) {
            toast({ title: 'Error', description: 'Please select an employee', variant: 'destructive' });
            return;
        }
        try {
            await apiService.addProjectMember(selectedProject.project_id, Number(memberUserId));
            toast({ title: 'Success', description: 'Member added successfully' });
            setMemberUserId('');
            const updated = await apiService.getProject(selectedProject.project_id);
            setSelectedProject(updated);
            fetchProjects();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to add member', variant: 'destructive' });
        }
    };

    // ── Remove Member ──
    const handleRemoveMember = async (userId: number) => {
        if (!selectedProject) return;
        try {
            await apiService.removeProjectMember(selectedProject.project_id, userId);
            toast({ title: 'Success', description: 'Member removed' });
            const updated = await apiService.getProject(selectedProject.project_id);
            setSelectedProject(updated);
            fetchProjects();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to remove member', variant: 'destructive' });
        }
    };

    // ── Assign Tasks ──
    const handleAssignTasks = async () => {
        if (!selectedProject) return;
        const validTasks = taskList.filter(t => t.task_name.trim() && t.assigned_to);
        if (!validTasks.length) {
            toast({ title: 'Error', description: 'Please add at least one valid task', variant: 'destructive' });
            return;
        }
        setIsUpdating(true);
        try {
            for (const task of validTasks) {
                await apiService.createProjectTask(selectedProject.project_id, task);
            }
            toast({ title: 'Success', description: 'Tasks assigned successfully' });
            setIsTaskDialogOpen(false);
            setTaskList([emptyTask()]);
            const updated = await apiService.getProject(selectedProject.project_id);
            setSelectedProject(updated);
            fetchProjects();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to assign tasks', variant: 'destructive' });
        } finally {
            setIsUpdating(false);
        }
    };

    // ── Update Task Status ──
    const handleUpdateTaskStatus = async (projectId: number, taskId: number, status: string) => {
        try {
            await apiService.updateProjectTaskStatus(projectId, taskId, status);
            toast({ title: 'Success', description: 'Task status updated' });
            const updated = await apiService.getProject(projectId);
            setSelectedProject(updated);
            fetchProjects();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to update task status', variant: 'destructive' });
        }
    };

    // ── Task list helpers ──
    const addTaskRow = () => setTaskList(prev => [...prev, emptyTask()]);
    const updateTaskRow = (index: number, field: keyof ProjectTask, value: any) => {
        setTaskList(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
    };
    const removeTaskRow = (index: number) => {
        if (taskList.length === 1) return;
        setTaskList(prev => prev.filter((_, i) => i !== index));
    };

    const isAdminOrHR = user?.role === 'admin' || user?.role === 'hr';

    // ─────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────
    return (
        <div className="space-y-6 relative min-h-screen">
            {/* ── Header ── */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-violet-600 dark:bg-violet-500 flex items-center justify-center flex-shrink-0">
                            <FolderKanban className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Project Management</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                Create and manage projects, assign tasks to team members.
                            </p>
                        </div>
                    </div>
                    {isAdminOrHR && (
                        <Button
                            className="gap-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white"
                            onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}
                        >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">New Project</span>
                            <span className="sm:hidden">New</span>
                        </Button>
                    )}
                </div>

                {/* ── Search ── */}
                <div className="mt-4 flex gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search projects..."
                            className="pl-9 rounded-xl"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Projects', value: projects.length, color: 'bg-violet-500', icon: FolderKanban },
                    { label: 'Active', value: projects.filter(p => !p.status || p.status === 'active').length, color: 'bg-blue-500', icon: Clock },
                    { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: 'bg-emerald-500', icon: CheckCircle2 },
                    { label: 'Total Members', value: projects.reduce((acc, p) => acc + (p.members?.length || 0), 0), color: 'bg-orange-500', icon: Users },
                ].map(s => (
                    <Card key={s.label} className="border-0 shadow-md rounded-2xl">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className={`${s.color} h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0`}>
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

            {/* ── Projects Table ── */}
            <Card className="border-0 shadow-md rounded-3xl overflow-hidden">
                <CardHeader className="pb-0 px-6 pt-5">
                    <CardTitle className="text-base font-semibold">All Projects</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <FolderKanban className="h-12 w-12 mb-3 opacity-30" />
                            <p className="text-sm">No projects found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                        <TableHead className="pl-6">Project Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Start Date</TableHead>
                                        <TableHead>End Date</TableHead>
                                        <TableHead>Members</TableHead>
                                        <TableHead>Tasks</TableHead>
                                        <TableHead className="text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProjects.map(project => (
                                        <TableRow key={project.project_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition-colors">
                                            <TableCell className="pl-6 font-medium text-slate-900 dark:text-white max-w-[200px]">
                                                <div className="truncate">{project.name}</div>
                                                {project.description && (
                                                    <div className="text-xs text-slate-400 truncate mt-0.5">{project.description}</div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`capitalize border-0 text-xs ${getProjectStatusColor(project.status)}`}>
                                                    {project.status || 'Active'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                                                {project.start_date ? formatDateIST(project.start_date, 'MMM dd, yyyy') : '-'}
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                                                {project.end_date ? formatDateIST(project.end_date, 'MMM dd, yyyy') : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Users className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-sm text-slate-600 dark:text-slate-300">{project.members?.length || 0}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-sm text-slate-600 dark:text-slate-300">{project.tasks?.length || 0}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-violet-50 hover:text-violet-600"
                                                        title="View Details"
                                                        onClick={() => { setSelectedProject(project); setIsViewDialogOpen(true); }}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {isAdminOrHR && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                                                                title="Manage Members"
                                                                onClick={() => { setSelectedProject(project); setIsMemberDialogOpen(true); }}
                                                            >
                                                                <UserPlus className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 hover:bg-amber-50 hover:text-amber-600"
                                                                title="Assign Tasks"
                                                                onClick={() => { setSelectedProject(project); setTaskList([emptyTask()]); setIsTaskDialogOpen(true); }}
                                                            >
                                                                <ClipboardList className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 hover:bg-green-50 hover:text-green-600"
                                                                title="Edit Project"
                                                                onClick={() => openEdit(project)}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                                                                title="Delete Project"
                                                                disabled={isDeleting === project.project_id}
                                                                onClick={() => handleDelete(project.project_id)}
                                                            >
                                                                {isDeleting === project.project_id
                                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                    : <Trash2 className="h-4 w-4" />
                                                                }
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ══════════════════════════════════════
          Create Project Dialog
         ══════════════════════════════════════ */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderKanban className="h-5 w-5 text-violet-500" />
                            Create New Project
                        </DialogTitle>
                        <DialogDescription>Fill in the project details and optionally assign initial tasks.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="proj_name">Project Name *</Label>
                            <Input
                                id="proj_name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Website Redesign"
                            />
                        </div>
                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="proj_desc">Description</Label>
                            <Textarea
                                id="proj_desc"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief project overview..."
                                rows={3}
                            />
                        </div>
                        {/* Dates */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="proj_start">Start Date</Label>
                                <Input
                                    id="proj_start"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="proj_end">End Date</Label>
                                <Input
                                    id="proj_end"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>
                        {/* Status */}
                        <div className="space-y-2">
                            <Label>Project Status</Label>
                            <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="on-hold">On Hold</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Initial Tasks */}
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Initial Tasks (Optional)</Label>
                                <Button variant="outline" size="sm" onClick={addTaskRow} className="gap-1 h-7 text-xs">
                                    <Plus className="h-3 w-3" /> Add Task
                                </Button>
                            </div>
                            {taskList.map((task, index) => (
                                <div key={index} className="grid grid-cols-1 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <Input
                                            placeholder="Task name *"
                                            value={task.task_name}
                                            onChange={e => updateTaskRow(index, 'task_name', e.target.value)}
                                        />
                                        <Select
                                            value={task.assigned_to ? String(task.assigned_to) : ''}
                                            onValueChange={v => updateTaskRow(index, 'assigned_to', Number(v))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Assign to..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.map(e => (
                                                    <SelectItem key={e.user_id} value={String(e.user_id)}>{e.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <Input
                                            placeholder="Description (optional)"
                                            value={task.description || ''}
                                            onChange={e => updateTaskRow(index, 'description', e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                            <Input
                                                type="date"
                                                value={task.due_date || ''}
                                                onChange={e => updateTaskRow(index, 'due_date', e.target.value)}
                                                className="flex-1"
                                            />
                                            {taskList.length > 1 && (
                                                <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 hover:bg-red-50 hover:text-red-600" onClick={() => removeTaskRow(index)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={isCreating} className="bg-violet-600 hover:bg-violet-700">
                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════
          Edit Project Dialog
         ══════════════════════════════════════ */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5 text-blue-500" />
                            Edit Project
                        </DialogTitle>
                        <DialogDescription>Update details for: {selectedProject?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit_proj_name">Project Name *</Label>
                            <Input
                                id="edit_proj_name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_proj_desc">Description</Label>
                            <Textarea
                                id="edit_proj_desc"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="on-hold">On Hold</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
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
          View Project Dialog
         ══════════════════════════════════════ */}
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderKanban className="h-5 w-5 text-violet-500" />
                            {selectedProject?.name}
                        </DialogTitle>
                        <DialogDescription>{selectedProject?.description || 'No description provided.'}</DialogDescription>
                    </DialogHeader>
                    {selectedProject && (
                        <div className="space-y-5">
                            {/* Meta */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Status', value: <Badge className={`capitalize border-0 text-xs ${getProjectStatusColor(selectedProject.status)}`}>{selectedProject.status || 'Active'}</Badge> },
                                    { label: 'Start Date', value: selectedProject.start_date ? formatDateIST(selectedProject.start_date, 'MMM dd, yyyy') : '-' },
                                    { label: 'End Date', value: selectedProject.end_date ? formatDateIST(selectedProject.end_date, 'MMM dd, yyyy') : '-' },
                                    { label: 'Members', value: selectedProject.members?.length || 0 },
                                ].map(item => (
                                    <div key={item.label} className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                                        <div className="text-sm font-semibold">{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Members */}
                            {selectedProject.members && selectedProject.members.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Users className="h-4 w-4 text-blue-500" /> Team Members
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedProject.members.map(m => (
                                            <Badge key={m.user_id} variant="secondary" className="text-xs px-3 py-1">
                                                {m.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tasks */}
                            {selectedProject.tasks && selectedProject.tasks.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <ClipboardList className="h-4 w-4 text-amber-500" /> Tasks
                                    </h4>
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                                                    <TableHead className="pl-4">Task</TableHead>
                                                    <TableHead>Assigned To</TableHead>
                                                    <TableHead>Due Date</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    {isAdminOrHR && <TableHead>Update Status</TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedProject.tasks.map((task, idx) => {
                                                    const taskId = task.task_id || task.id || idx;
                                                    return (
                                                        <TableRow key={taskId}>
                                                            <TableCell className="pl-4">
                                                                <div className="font-medium text-sm">{task.task_name}</div>
                                                                {task.description && <div className="text-xs text-muted-foreground">{task.description}</div>}
                                                            </TableCell>
                                                            <TableCell className="text-sm">{task.assigned_to_name || '-'}</TableCell>
                                                            <TableCell className="text-sm">
                                                                {task.due_date ? formatDateIST(task.due_date, 'MMM dd, yyyy') : '-'}
                                                            </TableCell>
                                                            <TableCell>{getTaskStatusBadge(task.status)}</TableCell>
                                                            {isAdminOrHR && (
                                                                <TableCell>
                                                                    <Select
                                                                        value={task.status}
                                                                        onValueChange={(v) => handleUpdateTaskStatus(selectedProject.project_id, Number(taskId), v)}
                                                                    >
                                                                        <SelectTrigger className="h-8 w-36 text-xs">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {TASK_STATUSES.map(s => (
                                                                                <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </TableCell>
                                                            )}
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {(!selectedProject.tasks || selectedProject.tasks.length === 0) && (
                                <p className="text-sm text-muted-foreground text-center py-4">No tasks assigned to this project yet.</p>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════
          Manage Members Dialog
         ══════════════════════════════════════ */}
            <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-500" />
                            Manage Members
                        </DialogTitle>
                        <DialogDescription>Add or remove members from: {selectedProject?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Add member */}
                        <div className="flex gap-2">
                            <Select value={memberUserId} onValueChange={setMemberUserId}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select employee to add..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees
                                        .filter(e => !selectedProject?.members?.some(m => m.user_id === e.user_id))
                                        .map(e => (
                                            <SelectItem key={e.user_id} value={String(e.user_id)}>
                                                {e.name} {e.role ? `(${e.role})` : ''}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleAddMember} className="gap-1 bg-blue-600 hover:bg-blue-700">
                                <UserPlus className="h-4 w-4" /> Add
                            </Button>
                        </div>

                        {/* Current members */}
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Current Members ({selectedProject?.members?.length || 0})</Label>
                            {!selectedProject?.members?.length ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No members added yet.</p>
                            ) : (
                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                    {selectedProject.members.map(m => (
                                        <div key={m.user_id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div>
                                                <p className="text-sm font-medium">{m.name}</p>
                                                {m.role && <p className="text-xs text-muted-foreground capitalize">{m.role}</p>}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                                                onClick={() => handleRemoveMember(m.user_id)}
                                            >
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
          Assign Tasks Dialog
         ══════════════════════════════════════ */}
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-amber-500" />
                            Assign Tasks
                        </DialogTitle>
                        <DialogDescription>Assign tasks for project: {selectedProject?.name}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        {taskList.map((task, index) => (
                            <div key={index} className="grid gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <Input
                                        placeholder="Task name *"
                                        value={task.task_name}
                                        onChange={e => updateTaskRow(index, 'task_name', e.target.value)}
                                    />
                                    <Select
                                        value={task.assigned_to ? String(task.assigned_to) : ''}
                                        onValueChange={v => updateTaskRow(index, 'assigned_to', Number(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Assign to..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {employees.map(e => (
                                                <SelectItem key={e.user_id} value={String(e.user_id)}>{e.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <Input
                                        placeholder="Description (optional)"
                                        value={task.description || ''}
                                        onChange={e => updateTaskRow(index, 'description', e.target.value)}
                                        className="md:col-span-1"
                                    />
                                    <Input
                                        type="date"
                                        value={task.due_date || ''}
                                        onChange={e => updateTaskRow(index, 'due_date', e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Select
                                            value={task.status}
                                            onValueChange={v => updateTaskRow(index, 'status', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TASK_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {taskList.length > 1 && (
                                            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 hover:bg-red-50 hover:text-red-600" onClick={() => removeTaskRow(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addTaskRow} className="gap-1 w-full">
                            <Plus className="h-3.5 w-3.5" /> Add Another Task
                        </Button>
                    </div>

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
