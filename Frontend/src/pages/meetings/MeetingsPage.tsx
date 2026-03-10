import React, { useState, useEffect } from 'react';
import {
    Video,
    Plus,
    Calendar,
    Clock,
    MoreVertical,
    Search,
    Filter,
    Briefcase,
    Users2,
    FolderKanban,
    Link2,
    LogIn,
    ArrowRight,
    Play,
    X,
    Trash2,
    Info,
    CalendarDays,
    Edit2,
    ExternalLink,
    Users
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from '@/components/ui/checkbox';
import { format, isValid } from 'date-fns';

interface Meeting {
    id: number;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    meeting_url: string;
    created_by_name: string;
    created_by_id: number;
    participants?: {
        id: number;
        user_id: number;
        user_name: string;
    }[];
    type?: 'company' | 'team' | 'project' | 'one-to-one';
    team_name?: string;
    project_name?: string;
    team_id?: number;
    project_id?: number;
}

const MeetingsPage: React.FC = () => {
    const { user } = useAuth();
    const userRole = user?.role?.toLowerCase();

    // Permission definitions
    const isAdmin = userRole === 'admin';
    const isHR = userRole === 'hr';
    const isManager = userRole === 'manager';
    const isTeamLead = userRole === 'team_lead';

    const canCreateCompany = isAdmin;
    const canCreateTeam = isAdmin || isHR || isManager || isTeamLead;
    const canCreateProject = isAdmin || isHR || isManager || isTeamLead;
    const canCreateOneToOne = true; // All can create

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        meeting_url: '',
        start_time: '',
        end_time: '',
        participant_ids: [] as number[],
        type: 'one-to-one' as 'company' | 'team' | 'project' | 'one-to-one',
        team_id: undefined as number | undefined,
        project_id: undefined as number | undefined,
    });

    const normalizeMeeting = (m: any): Meeting => {
        let type = (m.type || '').toLowerCase();

        // Force type based on ID associations to prevent misclassification
        if (m.project_id || m.project_name) {
            type = 'project';
        } else if (m.team_id || m.team_name) {
            type = 'team';
        }

        // If still missing or generic, use heuristics
        if (!type || type === 'null' || type === 'undefined') {
            if (m.participants && m.participants.length <= 2) type = 'one-to-one';
            else type = 'company';
        }
        return { ...m, type };
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const [meetingsData, depts, projs, emps] = await Promise.all([
                apiService.getMeetings(),
                apiService.getDepartments().catch(() => []),
                apiService.getProjects().catch(() => []),
                apiService.getEmployees().catch(() => [])
            ]);

            const normalizedMeetings = (Array.isArray(meetingsData) ? meetingsData : []).map(normalizeMeeting);
            setMeetings(normalizedMeetings);
            setDepartments(Array.isArray(depts) ? depts : (depts as any)?.departments || []);
            setProjects(Array.isArray(projs) ? projs : (projs as any)?.projects || []);
            setEmployees(Array.isArray(emps) ? emps : (emps as any)?.employees || []);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast({
                title: "Error",
                description: "Failed to sync data from server.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const [dateFilter, setDateFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const filteredMeetings = meetings.filter(m => {
        if (!m || !m.title) return false;
        const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

        // Date filtering
        let matchesDate = true;
        if (dateFilter && m.start_time && typeof m.start_time === 'string') {
            matchesDate = m.start_time.startsWith(dateFilter);
        }

        // Type filtering
        const mType = (m.type || 'one-to-one').toLowerCase();
        let matchesType = false;
        if (typeFilter === 'all') {
            matchesType = true;
        } else {
            matchesType = mType === typeFilter;
        }

        return matchesSearch && matchesDate && matchesType;
    });

    const handleCreateMeeting = async () => {
        if (!formData.title || !formData.meeting_url || !formData.start_time || !formData.end_time) {
            toast({
                title: "Missing Information",
                description: "All fields are required to establish a sync node.",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const startDate = new Date(formData.start_time);
            const endDate = new Date(formData.end_time);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error("Invalid temporal coordinates provided.");
            }

            // Construct payload
            const payload: any = {
                title: formData.title,
                description: formData.description,
                meeting_url: formData.meeting_url,
                start_time: format(startDate, 'yyyy-MM-dd HH:mm:ss'),
                end_time: format(endDate, 'yyyy-MM-dd HH:mm:ss'),
                participant_ids: formData.participant_ids,
                type: formData.type,
            };

            if (formData.type === 'team' && formData.team_id) {
                payload.team_id = formData.team_id;
            }
            if (formData.type === 'project' && formData.project_id) {
                payload.project_id = formData.project_id;
            }

            if (selectedMeeting) {
                if (formData.type === 'project' && formData.project_id) {
                    await apiService.updateProjectMeeting(formData.project_id, selectedMeeting.id, payload);
                } else {
                    await apiService.updateMeeting(selectedMeeting.id, payload);
                }
                toast({
                    title: "Sync Re-authorized",
                    description: "The meeting protocol has been successfully updated.",
                });
            } else {
                if (formData.type === 'project' && formData.project_id) {
                    await apiService.createProjectMeeting(formData.project_id, payload);
                } else {
                    await apiService.createMeeting(payload);
                }
                toast({
                    title: "Sync Authorized",
                    description: "The meeting protocol has been successfully established.",
                });
            }

            setIsCreateDialogOpen(false);
            setTypeFilter(formData.type); // Auto-redirect to the specific tab
            resetForm();
            fetchData();
        } catch (error: any) {
            console.error('Operation failed:', error);
            toast({
                title: "Protocol Failure",
                description: error.message || "Failed to establish sync.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            meeting_url: '',
            start_time: '',
            end_time: '',
            participant_ids: [],
            type: 'one-to-one',
            team_id: undefined,
            project_id: undefined,
        });
        setSelectedMeeting(null);
    };

    const openEditDialog = (meeting: Meeting) => {
        setSelectedMeeting(meeting);
        setFormData({
            title: meeting.title,
            description: meeting.description || '',
            meeting_url: meeting.meeting_url,
            // Format for datetime-local input: YYYY-MM-DDThh:mm in LOCAL time
            start_time: meeting.start_time ? format(new Date(meeting.start_time), "yyyy-MM-dd'T'HH:mm") : '',
            end_time: meeting.end_time ? format(new Date(meeting.end_time), "yyyy-MM-dd'T'HH:mm") : '',
            participant_ids: meeting.participants?.map(p => p.user_id) || [],
            type: (meeting.type || 'one-to-one') as any,
            team_id: meeting.team_id,
            project_id: meeting.project_id,
        });
        setIsCreateDialogOpen(true);
    };

    const handleDeleteMeeting = async (meeting: Meeting) => {
        if (!confirm('Are you sure you want to terminate this sync node?')) return;
        try {
            if (meeting.type === 'project' && meeting.project_id) {
                await apiService.deleteProjectMeeting(meeting.project_id, meeting.id);
            } else {
                await apiService.deleteMeeting(meeting.id);
            }
            toast({
                title: "Node Terminated",
                description: "The meeting protocol has been successfully purged.",
            });
            fetchData();
        } catch (error: any) {
            toast({
                title: "Deletion Failure",
                description: error.message || "Failed to purge node.",
                variant: "destructive"
            });
        }
    };

    const getBadgeColor = (type?: string) => {
        const t = (type || '').toLowerCase();
        switch (t) {
            case 'company': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
            case 'team': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            case 'project': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'one-to-one': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        }
    };

    const getDisplayName = (type?: string) => {
        const t = (type || '').toLowerCase();
        switch (t) {
            case 'company': return 'Townhall Meeting';
            case 'team': return 'Team Specific';
            case 'project': return 'Project Meeting';
            case 'one-to-one': return 'One to One Meeting';
            default: return 'General Meeting';
        }
    };

    const toggleParticipant = (userId: number) => {
        setFormData(prev => {
            const id = Number(userId);
            if (isNaN(id)) return prev;

            const isOneToOne = prev.type === 'one-to-one';
            const has = prev.participant_ids.includes(id);

            let newIds = [...prev.participant_ids];
            if (isOneToOne) {
                // For one-to-one, we only allow one participant (excluding self which is usually assumed or handled by backend)
                newIds = has ? [] : [id];
            } else {
                newIds = has
                    ? prev.participant_ids.filter(item => item !== id)
                    : [...prev.participant_ids, id];
            }

            return {
                ...prev,
                participant_ids: newIds
            };
        });
    };

    // Constraint effect (keep only for 1:1 ensuring constraint stays during selections)
    useEffect(() => {
        if (formData.type === 'one-to-one' && formData.participant_ids.length > 1) {
            setFormData(prev => ({
                ...prev,
                participant_ids: prev.participant_ids.slice(0, 1)
            }));
        }
    }, [formData.type, formData.participant_ids]);

    const selectAllParticipants = async () => {
        if (formData.type === 'team' && formData.team_id) {
            const teamMembers = employees
                .filter(emp => emp.department_id === formData.team_id || emp.department === departments.find(d => d.id === formData.team_id)?.name)
                .map(emp => Number(emp.user_id || emp.id))
                .filter(id => !isNaN(id));
            setFormData(prev => ({ ...prev, participant_ids: teamMembers }));
        } else if (formData.type === 'project' && formData.project_id) {
            try {
                const members = await apiService.getProjectMembers(formData.project_id);
                const memberIds = (Array.isArray(members) ? members : (members?.members || []))
                    .map((m: any) => Number(m.user_id || m.id))
                    .filter((id: number) => !isNaN(id));
                setFormData(prev => ({ ...prev, participant_ids: memberIds }));
            } catch (error) {
                console.error('Failed to fetch project members:', error);
            }
        } else {
            // General select all
            const allIds = employees.map(emp => Number(emp.user_id || emp.id)).filter(id => !isNaN(id));
            setFormData(prev => ({ ...prev, participant_ids: allIds }));
        }
    };

    const deselectAll = () => {
        setFormData(prev => ({ ...prev, participant_ids: [] }));
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#020617] overflow-hidden">
            {/* Simple Header based on image */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-8 py-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                                <Video className="h-8 w-8" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Meetings</h1>
                                <p className="text-slate-500 font-medium">Coordinate and collaborate across the organization</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => {
                                resetForm();
                                setIsCreateDialogOpen(true);
                            }}
                            className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/10 transition-all active:scale-95"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            SCHEDULE SYNC
                        </Button>
                    </div>

                    <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                        setIsCreateDialogOpen(open);
                        if (!open) resetForm();
                    }}>

                        <DialogContent className="sm:max-w-[650px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">
                                    {selectedMeeting ? 'Update Sync' : 'Sync Configuration'}
                                </DialogTitle>
                                <DialogDescription className="text-blue-100 font-medium opacity-80 uppercase text-[10px] tracking-widest mt-1">
                                    {selectedMeeting ? 'Re-authorize communication node.' : 'Establish a new communication node.'}
                                </DialogDescription>
                            </div>

                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Meeting Type</Label>
                                        <Select
                                            value={formData.type || "one-to-one"}
                                            onValueChange={(v: any) => {
                                                const newFormData = { ...formData, type: v, team_id: undefined, project_id: undefined, participant_ids: [] };
                                                if (v === 'company') {
                                                    const allIds = employees.map(emp => Number(emp.user_id || emp.id)).filter(id => !isNaN(id));
                                                    newFormData.participant_ids = allIds;
                                                }
                                                setFormData(newFormData);
                                            }}
                                        >
                                            <SelectTrigger className="rounded-xl h-11 border-slate-200">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {canCreateCompany && <SelectItem value="company">Townhall (Company Wide)</SelectItem>}
                                                {canCreateTeam && <SelectItem value="team"> Team Specific</SelectItem>}
                                                {canCreateProject && <SelectItem value="project">Project Specific</SelectItem>}
                                                {canCreateOneToOne && <SelectItem value="one-to-one">One to One Meeting</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Meeting Title</Label>
                                        <Input
                                            placeholder="Sync Title"
                                            className="rounded-xl h-11 border-slate-200 focus:ring-blue-500"
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Start Time</Label>
                                        <Input
                                            type="datetime-local"
                                            className="rounded-xl h-11 border-slate-200"
                                            value={formData.start_time}
                                            onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">End Time</Label>
                                        <Input
                                            type="datetime-local"
                                            className="rounded-xl h-11 border-slate-200"
                                            value={formData.end_time}
                                            onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {formData.type === 'team' && (
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Select Department</Label>
                                        <Select
                                            value={formData.team_id?.toString() || ""}
                                            onValueChange={(v) => setFormData({ ...formData, team_id: v ? parseInt(v) : undefined })}
                                        >
                                            <SelectTrigger className="rounded-xl h-11">
                                                <SelectValue placeholder="Choose Department" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.isArray(departments) && departments.filter(Boolean).length > 0 ? departments.filter(Boolean).map((d: any) => (
                                                    <SelectItem key={d.id || d.department_id || Math.random()} value={(d.id || d.department_id)?.toString() || ""}>{d.name || "Unnamed Department"}</SelectItem>
                                                )) : (
                                                    <SelectItem disabled value="none">No active department nodes found.</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {formData.type === 'project' && (
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Target Project</Label>
                                        <Select
                                            value={formData.project_id?.toString() || ""}
                                            onValueChange={async (v) => {
                                                const pId = v ? parseInt(v) : undefined;
                                                const newFormData = { ...formData, project_id: pId, participant_ids: [] };
                                                if (pId) {
                                                    try {
                                                        const members = await apiService.getProjectMembers(pId);
                                                        const memberIds = (Array.isArray(members) ? members : (members?.members || []))
                                                            .map((m: any) => Number(m.user_id || m.id))
                                                            .filter((id: number) => !isNaN(id));
                                                        newFormData.participant_ids = memberIds;
                                                    } catch (error) {
                                                        console.error('Failed to fetch project members:', error);
                                                    }
                                                }
                                                setFormData(newFormData);
                                            }}
                                        >
                                            <SelectTrigger className="rounded-xl h-11">
                                                <SelectValue placeholder="Choose Project" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.isArray(projects) && projects.filter(Boolean).length > 0 ? projects.filter(Boolean).map((p: any) => (
                                                    <SelectItem key={p.project_id || p.id || Math.random()} value={(p.project_id || p.id)?.toString() || ""}>{p.name || "Unnamed Project"}</SelectItem>
                                                )) : (
                                                    <SelectItem disabled value="none">No active project nodes found.</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="grid gap-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Transmission URL</Label>
                                    <Input
                                        placeholder="https://meet.google.com/..."
                                        className="rounded-xl h-11 border-slate-200 font-medium"
                                        value={formData.meeting_url}
                                        onChange={e => setFormData({ ...formData, meeting_url: e.target.value })}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Tactical Brief / Agenda</Label>
                                    <Textarea
                                        placeholder="Outline the communication objectives..."
                                        className="rounded-xl border-slate-200 min-h-[80px]"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest flex items-center justify-between">
                                        Assigned Assets / Participants
                                        <div className="flex items-center gap-3">
                                            <span className="text-blue-600 font-black">{formData.participant_ids.length} selected</span>
                                            {formData.type !== 'one-to-one' && (
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={selectAllParticipants}
                                                        className="text-[9px] uppercase font-black text-blue-600 hover:underline"
                                                    >
                                                        Select All
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={deselectAll}
                                                        className="text-[9px] uppercase font-black text-rose-600 hover:underline"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </Label>
                                    <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto p-1 custom-scrollbar">
                                        {employees.filter(Boolean).filter(emp => {
                                            if (formData.type === 'team' && formData.team_id) {
                                                return Number(emp.department_id) === formData.team_id || emp.department === departments.find(d => d.id === formData.team_id)?.name;
                                            }
                                            // For project-specific, we often only want to show project members in the selection list to pick/choose
                                            // However, requirement 5 says "Select Employees Automatically"
                                            // Let's filter the list to making choosing from project members easier if they want to deselect some.
                                            return true; // default show all
                                        }).map((emp: any) => {
                                            const empId = Number(emp.user_id || emp.id);
                                            const isSelected = formData.participant_ids.includes(empId);
                                            return (
                                                <div
                                                    key={emp.id || emp.user_id}
                                                    onClick={() => toggleParticipant(empId)}
                                                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${isSelected
                                                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm'
                                                        : 'hover:bg-slate-50 border-slate-100 dark:hover:bg-slate-800/50 dark:border-slate-800'
                                                        }`}
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleParticipant(empId)}
                                                        className="pointer-events-none"
                                                    />
                                                    <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.name || emp.id}`} alt="" className="h-full w-full object-cover" />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{emp.name || "Unknown User"}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900/50 flex !justify-center gap-3 border-t border-slate-100 dark:border-slate-800">
                                <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} className="rounded-xl h-11 px-6 font-bold text-xs uppercase tracking-widest text-slate-400">Cancel</Button>
                                <Button disabled={isSubmitting} onClick={handleCreateMeeting} className="rounded-xl h-11 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest px-10 shadow-lg shadow-blue-500/20">
                                    {isSubmitting ? 'Processing...' : (selectedMeeting ? 'Re-authorize Sync' : 'Authorize Sync')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
                <div className="max-w-7xl mx-auto px-6 py-8">

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
                        {[
                            { label: 'Upcoming', val: meetings.length, icon: CalendarDays, bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20', text: 'text-blue-600', darkText: 'dark:text-blue-400' },
                            { label: 'Townhall', val: meetings.filter(m => m?.type === 'company').length, icon: Briefcase, bg: 'bg-indigo-50', darkBg: 'dark:bg-indigo-900/20', text: 'text-indigo-600', darkText: 'dark:text-indigo-400' },
                            { label: 'Team Specific', val: meetings.filter(m => m?.type === 'team').length, icon: Users2, bg: 'bg-rose-50', darkBg: 'dark:bg-rose-900/20', text: 'text-rose-600', darkText: 'dark:text-rose-400' },
                            { label: 'Project Specific', val: meetings.filter(m => m?.type === 'project').length, icon: FolderKanban, bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20', text: 'text-blue-600', darkText: 'dark:text-blue-400' },
                            { label: 'One to One', val: meetings.filter(m => m?.type === 'one-to-one').length, icon: Users, bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/20', text: 'text-amber-600', darkText: 'dark:text-amber-400' },
                        ].map((stat, i) => (
                            <Card key={i} className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden hover:shadow-md transition-all duration-300">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">{stat.label}</p>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stat.val}</h3>
                                    </div>
                                    <div className={`h-12 w-12 rounded-2xl ${stat.bg} ${stat.darkBg} flex items-center justify-center ${stat.text} ${stat.darkText}`}>
                                        <stat.icon className="h-6 w-6" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <TabsList className="h-14 p-1.5 rounded-[1.5rem] bg-white dark:bg-slate-900 shadow-sm border-none">
                                <TabsTrigger value="all" className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white">All</TabsTrigger>
                                <TabsTrigger value="company" className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Townhall</TabsTrigger>
                                <TabsTrigger value="team" className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-rose-600 data-[state=active]:text-white">Team Specific</TabsTrigger>
                                <TabsTrigger value="project" className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white">Project Specific</TabsTrigger>
                                <TabsTrigger value="one-to-one" className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-white">One to One</TabsTrigger>
                            </TabsList>

                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search meetings..."
                                        className="pl-9 h-11 w-[200px] rounded-2xl bg-white dark:bg-slate-900 border-none shadow-sm font-medium"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm">
                                    <Calendar className="h-4 w-4 text-slate-400 mx-2" />
                                    <Input
                                        type="date"
                                        className="h-8 w-[130px] border-none bg-transparent font-black text-[10px] uppercase p-0 focus-visible:ring-0"
                                        value={dateFilter}
                                        onChange={e => setDateFilter(e.target.value)}
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border-none"
                                    onClick={() => { setSearchQuery(''); setDateFilter(''); setTypeFilter('all'); }}
                                >
                                    <Filter className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="mt-6">
                            <TabsContent value={typeFilter} className="m-0 focus-visible:ring-0">
                                {loading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-64 rounded-[2.5rem] bg-slate-100 dark:bg-slate-900 animate-pulse border-none" />
                                        ))}
                                    </div>
                                ) : filteredMeetings.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-dashed border-slate-200 dark:border-slate-800">
                                        <div className="h-24 w-24 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-6">
                                            <Video className="h-10 w-10 text-slate-200" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">No Meetings Found</h3>
                                        <p className="text-slate-400 text-sm font-medium mt-2">There are no active {typeFilter === 'all' ? '' : typeFilter} meetings for this selection.</p>
                                        <Button
                                            variant="outline"
                                            onClick={() => { setSearchQuery(''); setDateFilter(''); setTypeFilter('all'); }}
                                            className="mt-8 rounded-2xl border-blue-100 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white h-12 px-8"
                                        >
                                            Clear Filters
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {filteredMeetings.map((meeting) => (
                                            <Card key={meeting.id} className="group relative border-none shadow-sm bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500">
                                                <div className={`absolute top-0 left-0 right-0 h-1.5 ${getBadgeColor(meeting.type).split(' ')[0]}`}></div>
                                                <CardHeader className="p-8 pb-4">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <Badge className={`rounded-full px-4 py-1 font-black text-[9px] uppercase tracking-widest border-none ${getBadgeColor(meeting.type)}`}>
                                                            {getDisplayName(meeting.type)}
                                                        </Badge>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <div className="h-10 w-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:bg-slate-100">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </div>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="rounded-xl border-slate-200">
                                                                {(isAdmin || Number(meeting.created_by_id) === Number(user?.id)) && (
                                                                    <>
                                                                        <DropdownMenuItem onClick={() => openEditDialog(meeting)} className="rounded-lg gap-2 font-bold text-xs uppercase tracking-wider py-3">
                                                                            <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                                                                            Edit Protocol
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleDeleteMeeting(meeting)} className="rounded-lg gap-2 font-bold text-xs uppercase tracking-wider py-3 text-destructive">
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                            Purge Node
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <CardTitle className="text-xl font-black text-slate-900 dark:text-white mb-2 leading-tight tracking-tight">
                                                        {meeting.title}
                                                    </CardTitle>
                                                    <CardDescription className="text-slate-500 dark:text-slate-400 line-clamp-2 text-sm font-medium leading-relaxed">
                                                        {meeting.description}
                                                    </CardDescription>
                                                </CardHeader>

                                                <CardContent className="p-8 pt-0 space-y-6">
                                                    <div className="space-y-3 pt-2">
                                                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                                                            <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                                                                <Calendar className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-xs font-black uppercase tracking-tight">{meeting.start_time && isValid(new Date(meeting.start_time)) ? format(new Date(meeting.start_time), 'EEEE, MMM do') : 'TBD'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                                                            <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
                                                                <Clock className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-xs font-black tracking-tight">{meeting.start_time && isValid(new Date(meeting.start_time)) ? format(new Date(meeting.start_time), 'hh:mm a') : '--:--'} - {meeting.end_time && isValid(new Date(meeting.end_time)) ? format(new Date(meeting.end_time), 'hh:mm a') : '--:--'}</span>
                                                        </div>
                                                        {meeting.project_name && (
                                                            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                                                                <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                                                                    <Briefcase className="h-4 w-4" />
                                                                </div>
                                                                <span className="text-xs font-black tracking-tight uppercase">{meeting.project_name}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                                                        <div className="flex -space-x-3">
                                                            {meeting.participants?.filter(Boolean).slice(0, 3).map((p, i) => (
                                                                <div key={i} className="h-10 w-10 rounded-2xl border-4 border-white dark:border-slate-900 bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                                                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_name || p.id}`} alt="" className="h-full w-full object-cover" />
                                                                </div>
                                                            ))}
                                                            {(meeting.participants?.length || 0) > 3 && (
                                                                <div className="h-10 w-10 rounded-2xl border-4 border-white dark:border-slate-900 bg-slate-900 text-[10px] text-white flex items-center justify-center font-black">
                                                                    +{meeting.participants!.length - 3}
                                                                </div>
                                                            )}
                                                            {(!meeting.participants || meeting.participants.length === 0) && (
                                                                <div className="h-10 w-10 rounded-2xl border-4 border-white dark:border-slate-900 bg-slate-100 flex items-center justify-center text-slate-400">
                                                                    <Users className="h-4 w-4" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <Button
                                                            asChild
                                                            className="rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest px-6 h-11 transition-all shadow-lg shadow-slate-200 dark:shadow-none"
                                                        >
                                                            <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                                                                Join Meeting
                                                                <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
            `}} />
        </div>
    );
};

export default MeetingsPage;
