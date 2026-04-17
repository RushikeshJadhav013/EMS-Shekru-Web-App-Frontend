import React, { useState, useEffect } from "react";
import {
    Video,
    Plus,
    Calendar,
    Clock,
    MoreVertical,
    Search,
    Briefcase,
    Users2,
    FolderKanban,
    Trash2,
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
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isValid } from "date-fns";

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
    type?: "company" | "team" | "project" | "one-to-one";
    team_name?: string;
    project_name?: string;
    team_id?: number;
    project_id?: number;
}

const MeetingsPage: React.FC = () => {
    const { user } = useAuth();
    const userRoleRaw = (user?.role || "").toLowerCase();
    const isAdmin = userRoleRaw === "admin";
    const isHR = userRoleRaw === "hr" || userRoleRaw.includes("hr");
    const isManager = userRoleRaw === "manager" || userRoleRaw.includes("manager");
    const isTeamLead = userRoleRaw === "team_lead" || userRoleRaw === "teamlead" || userRoleRaw === "team lead" || userRoleRaw.includes("team") && userRoleRaw.includes("lead");



    const canCreateCompany = isAdmin;
    const canCreateTeam = isAdmin || isHR || isManager || isTeamLead;
    const canCreateProject = isAdmin || isHR || isManager || isTeamLead;
    const canCreateOneToOne = true;

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [myMeetings, setMyMeetings] = useState<Meeting[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mainTab, setMainTab] = useState<"all" | "my">("all");
    const [typeFilter, setTypeFilter] = useState("one-to-one");
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        meeting_url: "",
        start_time: "",
        end_time: "",
        participant_ids: [] as number[],
        type: "one-to-one" as "company" | "team" | "project" | "one-to-one",
        team_id: undefined as number | undefined,
        project_id: undefined as number | undefined,
    });

    const normalizeMeeting = (m: any): Meeting => {
        if (!m) return {} as Meeting;
        
        const id = m.id || m.meeting_id || m.meetingId || m.ID || m.meeting_details?.id;
        const titleText = m.title || m.meeting_title || m.subject || m.display_name || m.name || m.meeting_details?.title || m.description || m.meeting_details?.description || '';
        const titleLower = String(titleText).toLowerCase().trim();

        const deepFind = (obj: any, target: string): any => {
            if (!obj || typeof obj !== 'object') return null;
            if (obj[target]) return obj[target];
            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const found = deepFind(item, target);
                    if (found) return found;
                }
            } else {
                for (const k in obj) {
                    const found = deepFind(obj[k], target);
                    if (found) return found;
                }
            }
            return null;
        };

        const projectId = m.project_id || m.projectId || m.project?.id || deepFind(m, 'project_id') || deepFind(m, 'projectId');
        const projectName = m.project_name || m.projectName || m.project?.name || deepFind(m, 'project_name') || deepFind(m, 'projectName');
        const teamId = m.team_id || m.teamId || m.department_id || m.departmentId || deepFind(m, 'team_id') || deepFind(m, 'department_id');
        const teamName = m.team_name || m.teamName || m.department_name || m.departmentName || deepFind(m, 'team_name') || deepFind(m, 'department_name');

        const rawTypeField = String(m.type || m.meeting_type || m.meetingType || m.category || m.meeting_details?.type || '').toLowerCase();
        
        let finalType: Meeting['type'] = 'company';

        const isProjectKeyword = titleLower.includes('project') || titleLower.includes('prj') || titleLower.includes('sprint') || titleLower.includes('scrum') || titleLower.includes('milestone') || titleLower.includes('development');
        const isTeamKeyword = titleLower.includes('team') || titleLower.includes('dept') || titleLower.includes('standup') || titleLower.includes('stand up') || titleLower.includes('sync') || titleLower.includes('huddle') || titleLower.includes('meeting') && (titleLower.includes('daily') || titleLower.includes('weekly'));

        // 1. Explicit priority for project and team based on IDs or explicit Type fields
        if (rawTypeField === 'project' || (projectId && String(projectId) !== '0' && String(projectId) !== 'null')) {
            finalType = 'project';
        } else if (rawTypeField === 'team' || rawTypeField === 'department' || (teamId && String(teamId) !== '0' && String(teamId) !== 'null')) {
            finalType = 'team';
        } 
        // 2. Name-based matching (if API returns names even without IDs)
        else if (projectName && String(projectName) !== 'null' && String(projectName) !== '') {
            finalType = 'project';
        } else if (teamName && String(teamName) !== 'null' && String(teamName) !== '') {
            finalType = 'team';
        }
        // 3. Keyword-based matching
        else if (isProjectKeyword) {
            finalType = 'project';
        } else if (isTeamKeyword) {
            finalType = 'team';
        } else if (titleLower.includes('1:1') || titleLower.includes('one to one') || rawTypeField === 'one-to-one' || rawTypeField === '1:1') {
            finalType = 'one-to-one';
        } else if (rawTypeField === 'company' || rawTypeField === 'townhall' || titleLower.includes('townhall')) {
            finalType = 'company';
        } 
        // 4. Default heuristics
        else if (m.participants && Array.isArray(m.participants) && m.participants.length > 0 && m.participants.length <= 2) {
            finalType = 'one-to-one';
        } else {
            finalType = 'company';
        }

        return {
            ...m,
            id,
            type: finalType,
            team_id: teamId,
            team_name: teamName,
            project_id: projectId,
            project_name: projectName,
        };
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const [allMeetingsData, participationData, projectMeetingsData, teamMeetingsData, deptsData, projsData, empsData, managersData] = await Promise.all([
                apiService.getMeetings(),
                apiService.getMeetings({ as_creator: 'false' }).catch(() => []),
                apiService.getMeetings({ type: 'project' }).catch(() => []),
                apiService.getMeetings({ type: 'team' }).catch(() => []),
                apiService.getBranchs().catch(() => []),
                apiService.getProjects().catch(() => []),
                apiService.getEmployees().catch(() => []),
                apiService.getBranchManagers().catch(() => [])
            ]);

            const extractMeetings = (res: any) => {
                if (Array.isArray(res)) return res;
                if (res?.data && Array.isArray(res.data)) return res.data;
                if (res?.meetings && Array.isArray(res.meetings)) return res.meetings;
                if (res?.results && Array.isArray(res.results)) return res.results;
                if (res && typeof res === 'object') {
                    const arrays = Object.values(res).filter(v => Array.isArray(v));
                    if (arrays.length === 1) return arrays[0] as any[];
                }
                return [];
            };

            const rawAll = extractMeetings(allMeetingsData);
            const rawMy = extractMeetings(participationData);
            const rawProject = extractMeetings(projectMeetingsData).map(m => ({ ...m, type: 'project' }));
            const rawTeam = extractMeetings(teamMeetingsData).map(m => ({ ...m, type: 'team' }));

            // Merge all sources to ensure distribution is captured from every possible endpoint
            const mergedAll = [...rawAll, ...rawProject, ...rawTeam];
            
            const normalizedAll = mergedAll.map(normalizeMeeting).filter((m: Meeting) => m.id);
            const normalizedMy = rawMy.map(normalizeMeeting).filter((m: Meeting) => m.id);

            // De-duplicate by ID
            const uniqueAll = Array.from(new Map(normalizedAll.map(m => [m.id, m])).values());
            const uniqueMy = Array.from(new Map(normalizedMy.map(m => [m.id, m])).values());

            setMeetings(uniqueAll as Meeting[]);
            setMyMeetings(uniqueMy as Meeting[]);

            // Handle various department response formats
            let finalDepts = [];
            if (Array.isArray(deptsData)) finalDepts = deptsData;
            else if ((deptsData as any)?.departments) finalDepts = (deptsData as any).departments;
            else if ((deptsData as any)?.data) finalDepts = (deptsData as any).data;

            // Fallback for departments if empty
            if (finalDepts.length === 0) {
                try {
                    const names = await apiService.getDepartmentNames();
                    if (Array.isArray(names)) finalDepts = names.map((n: any, idx: number) => ({ id: n.id || n.code || idx, name: n.name }));
                } catch (e) { console.warn("Fallback depts fetch failed", e); }
            }
            setDepartments(finalDepts);

            setProjects(Array.isArray(projsData) ? projsData : (projsData as any)?.projects || (projsData as any)?.data || []);

            // Merge employees and managers for a complete list (Admin, HR, Manager, etc.)
            let allEmployees = Array.isArray(empsData) ? empsData : (empsData as any)?.employees || (empsData as any)?.data || [];
            const allManagers = Array.isArray(managersData) ? managersData : (managersData as any)?.managers || (managersData as any)?.data || [];



            // To Remove Role Hierarchy for all profiles (especially for 1:1 meetings):
            // We fetch employees from each department to gather everyone and bypass role-based list restrictions.
            if (finalDepts.length > 0) {
                try {
                    const deptEmployees = await Promise.all(
                        finalDepts.map(d => apiService.getEmployees(d.name).catch(() => []))
                    );
                    const flatDeptEmps = deptEmployees.flat();
                    if (flatDeptEmps.length > 0) {
                        allEmployees = [...allEmployees, ...flatDeptEmps];
                    }
                } catch (e) {
                    console.warn("Broad employee fetch failed", e);
                }
            }

            // Create a unique list based on ID
            const mergedMap = new Map();
            [...allEmployees, ...allManagers].forEach(person => {
                const id = person.user_id || person.userId || person.id || person.employee_id;
                if (id) {
                    const existing = mergedMap.get(String(id));
                    mergedMap.set(String(id), { ...existing, ...person });
                }
            });

            setEmployees(Array.from(mergedMap.values()));


        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast({
                title: "Error",
                description: "Failed to load meetings data.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const [dateFilter, setDateFilter] = useState("");

    const activeMeetings = mainTab === "my" ? myMeetings : meetings;

    const filteredMeetings = activeMeetings.filter((m) => {
        if (!m || !m.title) return false;
        const matchesSearch =
            m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

        let matchesDate = true;
        if (dateFilter && m.start_time) {
            matchesDate = m.start_time.startsWith(dateFilter);
        }

        const mType = (m.type || "one-to-one").toLowerCase();
        let matchesType = (typeFilter === "all" || mType === typeFilter);

        return matchesSearch && matchesDate && matchesType;
    });

    const handleCreateMeeting = async () => {
        if (!formData.title || !formData.meeting_url || !formData.start_time || !formData.end_time) {
            toast({
                title: "Missing Information",
                description: "Please fill in all required fields.",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const startDate = new Date(formData.start_time);
            const endDate = new Date(formData.end_time);

            const payload: any = {
                title: formData.title,
                description: formData.description,
                meeting_url: formData.meeting_url,
                start_time: format(startDate, "yyyy-MM-dd HH:mm:ss"),
                end_time: format(endDate, "yyyy-MM-dd HH:mm:ss"),
                participant_ids: formData.participant_ids,
                type: formData.type,
            };

            if (formData.type === 'team' && formData.team_id) {
                payload.team_id = formData.team_id;
                payload.department_id = formData.team_id;
                const dept = departments.find((d: any) => d.id === formData.team_id);
                if (dept) payload.team_name = dept.name;
            }
            if (formData.type === 'project' && formData.project_id) {
                payload.project_id = formData.project_id;
            }

            if (selectedMeeting) {
                if (formData.type === "project" && formData.project_id) {
                    await apiService.updateProjectMeeting(formData.project_id, selectedMeeting.id, payload);
                } else {
                    await apiService.updateMeeting(selectedMeeting.id, payload);
                }
                toast({ title: "Meeting Updated", description: "The meeting has been successfully updated." });
            } else {
                if (formData.type === "project" && formData.project_id) {
                    await apiService.createProjectMeeting(formData.project_id, payload);
                } else {
                    await apiService.createMeeting(payload);
                }
                toast({ title: "Meeting Scheduled", description: "The meeting has been successfully created." });
            }

            setIsCreateDialogOpen(false);
            setTypeFilter(formData.type);
            resetForm();
            fetchData();
        } catch (error: any) {
            console.error("Operation failed:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to save the meeting.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            meeting_url: "",
            start_time: "",
            end_time: "",
            participant_ids: [],
            type: "one-to-one",
            team_id: undefined,
            project_id: undefined,
        });
        setSelectedMeeting(null);
    };

    const openEditDialog = (meeting: Meeting) => {
        setSelectedMeeting(meeting);
        setFormData({
            title: meeting.title,
            description: meeting.description || "",
            meeting_url: meeting.meeting_url,
            start_time: meeting.start_time ? format(new Date(meeting.start_time), "yyyy-MM-dd'T'HH:mm") : "",
            end_time: meeting.end_time ? format(new Date(meeting.end_time), "yyyy-MM-dd'T'HH:mm") : "",
            participant_ids: meeting.participants?.map((p) => p.user_id) || [],
            type: (meeting.type || "one-to-one") as any,
            team_id: meeting.team_id,
            project_id: meeting.project_id,
        });
        setIsCreateDialogOpen(true);
    };

    const handleDeleteMeeting = async (meeting: Meeting) => {
        if (!confirm("Are you sure you want to delete this meeting?")) return;
        try {
            if (meeting.type === "project" && meeting.project_id) {
                await apiService.deleteProjectMeeting(meeting.project_id, meeting.id);
            } else {
                await apiService.deleteMeeting(meeting.id);
            }
            toast({ title: "Meeting Deleted", description: "The meeting has been removed." });
            fetchData();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete the meeting.",
                variant: "destructive",
            });
        }
    };

    const getBadgeColor = (type?: string) => {
        const t = (type || "").toLowerCase();
        switch (t) {
            case "company": return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
            case "team": return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
            case "project": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
            case "one-to-one": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
            default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        }
    };

    const getDisplayName = (type?: string) => {
        const t = (type || "").toLowerCase();
        switch (t) {
            case "company": return "Townhall Meeting";
            case "team": return "Team Meeting";
            case "project": return "Project Meeting";
            case "one-to-one": return "1:1 Meeting";
            default: return "General Meeting";
        }
    };

    const toggleParticipant = (userId: number) => {
        setFormData((prev) => {
            const id = Number(userId);
            if (isNaN(id)) return prev;
            const isOneToOne = prev.type === "one-to-one";
            const has = prev.participant_ids.includes(id);
            let newIds = has ? prev.participant_ids.filter((item) => item !== id) : [...prev.participant_ids, id];
            if (isOneToOne) newIds = has ? [] : [id];
            return { ...prev, participant_ids: newIds };
        });
    };

    const selectAllParticipants = async () => {
        if (formData.type === 'team' && formData.team_id) {
            const teamMembers = employees.filter(emp => {
                const dept = departments.find((d: any) => d.id === formData.team_id);
                const deptName = dept?.name || '';
                return Number(emp.department_id) === formData.team_id || emp.branch === deptName || emp.department === deptName;
            }).map(emp => Number(emp.user_id || emp.id)).filter(id => !isNaN(id));
            setFormData(prev => ({ ...prev, participant_ids: teamMembers }));
        } else if (formData.type === 'project' && formData.project_id) {
            try {
                const members = await apiService.getProjectMembers(formData.project_id);
                const memberList = Array.isArray(members) ? members : (members?.members || []);
                const memberIds = memberList.map((m: any) => {
                    const mId = m.user_id || m.userId || m.id || m.employee_id;
                    return Number(mId);
                }).filter((id: number) => !isNaN(id));
                setFormData(prev => ({ ...prev, participant_ids: memberIds }));
            } catch (error) { console.error('Failed to fetch project members:', error); }

        } else {
            const allIds = employees.map(emp => Number(emp.user_id || emp.id)).filter(id => !isNaN(id));
            setFormData(prev => ({ ...prev, participant_ids: allIds }));
        }
    };

    const deselectAll = () => setFormData((prev) => ({ ...prev, participant_ids: [] }));

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#020617] overflow-hidden">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-8 py-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                                <Video className="h-8 w-8" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Meetings</h1>
                                <p className="text-slate-500 font-medium">Schedule and manage your meetings</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}
                            className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/10 transition-all active:scale-95"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Schedule Meeting
                        </Button>
                    </div>

                    <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetForm(); }}>
                        <DialogContent className="sm:max-w-[650px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter">
                                    {selectedMeeting ? 'Edit Meeting' : 'Schedule Meeting'}
                                </DialogTitle>
                                <DialogDescription className="text-blue-100 font-medium opacity-80 uppercase text-[10px] tracking-widest mt-1">
                                    {selectedMeeting ? 'Update meeting details.' : 'Create a new meeting.'}
                                </DialogDescription>
                            </div>

                            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Meeting Type</Label>
                                        <Select
                                            value={formData.type || "one-to-one"}
                                            onValueChange={(v: any) => {
                                                const newFormData = { ...formData, type: v, team_id: undefined, project_id: undefined, participant_ids: [] };

                                                if (v === 'company') {
                                                    newFormData.participant_ids = employees.map(emp => Number(emp.user_id || emp.id)).filter(id => !isNaN(id));
                                                } else if (v === 'team' && isTeamLead && user?.department) {
                                                    // Handle multi-department strings (e.g., "Engineering, HR")
                                                    const userDepts = user.department.split(',').map(d => d.trim().toLowerCase());
                                                    const myDept = departments.find(d => {
                                                        const deptName = (d.name || "").toLowerCase().trim();
                                                        return userDepts.includes(deptName) ||
                                                            ((user as any).department_id && d.id === Number((user as any).department_id));
                                                    });

                                                    if (myDept) {
                                                        newFormData.team_id = myDept.id;
                                                    }
                                                }
                                                setFormData(newFormData);
                                            }}

                                        >
                                            <SelectTrigger className="rounded-xl h-11 border-slate-200">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {canCreateCompany && <SelectItem value="company">Townhall Meeting</SelectItem>}
                                                {canCreateTeam && <SelectItem value="team">Team Meeting</SelectItem>}
                                                {canCreateProject && <SelectItem value="project">Project Meeting</SelectItem>}
                                                {canCreateOneToOne && <SelectItem value="one-to-one">1:1 Meeting</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Meeting Title</Label>
                                        <Input placeholder="Meeting title" className="rounded-xl h-11" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Start Time</Label>
                                        <Input type="datetime-local" className="rounded-xl h-11" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">End Time</Label>
                                        <Input type="datetime-local" className="rounded-xl h-11" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
                                    </div>
                                </div>

                                {formData.type === 'team' && !isTeamLead && (
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Select Department</Label>
                                        <Select value={formData.team_id?.toString() || ""} onValueChange={(v) => setFormData({ ...formData, team_id: v ? parseInt(v) : undefined })}>
                                            <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Choose Department" /></SelectTrigger>
                                            <SelectContent>
                                                {departments.map((d: any) => <SelectItem key={d.id} value={d.id?.toString()}>{d.name || "Unnamed"}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {formData.type === 'project' && (
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Select Project</Label>
                                        <Select
                                            value={formData.project_id?.toString() || ""}
                                            onValueChange={async (v) => {
                                                const pId = v ? parseInt(v) : undefined;
                                                const newFormData = { ...formData, project_id: pId, participant_ids: [] };
                                                if (pId) {
                                                    try {
                                                        const members = await apiService.getProjectMembers(pId);
                                                        const memberList = Array.isArray(members) ? members : (members?.members || []);
                                                        newFormData.participant_ids = memberList.map((m: any) => {
                                                            const mId = m.user_id || m.userId || m.id || m.employee_id;
                                                            return Number(mId);
                                                        }).filter((id: number) => !isNaN(id));
                                                    } catch (e) { console.error('Project member fetch error:', e); }
                                                }

                                                setFormData(newFormData);
                                            }}
                                        >
                                            <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Choose Project" /></SelectTrigger>
                                            <SelectContent>
                                                {projects.map((p: any) => <SelectItem key={p.project_id || p.id} value={(p.project_id || p.id)?.toString()}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="grid gap-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Meeting URL</Label>
                                    <Input placeholder="https://..." className="rounded-xl h-11" value={formData.meeting_url} onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })} />
                                </div>

                                <div className="grid gap-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Agenda</Label>
                                    <Textarea placeholder="Agenda..." className="rounded-xl" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest flex items-center justify-between">
                                        Participants
                                        <div className="flex items-center gap-3">
                                            <span className="text-blue-600 font-black">{formData.participant_ids.length} selected</span>
                                            {formData.type !== 'one-to-one' && (
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={selectAllParticipants} className="text-[9px] uppercase font-black text-blue-600">Select All</button>
                                                    <button type="button" onClick={deselectAll} className="text-[9px] uppercase font-black text-rose-600">Clear</button>
                                                </div>
                                            )}
                                        </div>
                                    </Label>
                                    <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                                        {employees.filter(emp => {
                                            if (formData.type === 'team' && formData.team_id) {
                                                const dept = departments.find((d: any) => d.id === formData.team_id);
                                                const targetDeptName = (dept?.name || "").toLowerCase().trim();

                                                const empDeptId = Number(emp.department_id || emp.departmentId);
                                                if (empDeptId === formData.team_id) return true;

                                                const empDeptStr = (emp.department || emp.department_name || emp.branch || "").toLowerCase();
                                                // Support comma-separated departments (e.g., "Engineering, HR")
                                                const empDepts = empDeptStr.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

                                                return targetDeptName && empDepts.includes(targetDeptName);
                                            }
                                            // Show all employees for other meeting types (Project, 1:1, etc.)
                                            // But exclude the current user as they are the meeting creator.
                                            return Number(emp.user_id || emp.id) !== Number(user?.id);
                                        }).map((emp: any) => {


                                            const empId = Number(emp.user_id || emp.id);
                                            const isSelected = formData.participant_ids.includes(empId);
                                            return (
                                                <div key={empId} onClick={() => toggleParticipant(empId)} className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer border ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-slate-100'}`}>
                                                    <Checkbox checked={isSelected} className="pointer-events-none" />
                                                    <div className="flex flex-col truncate">
                                                        <span className="text-[10px] font-bold truncate">{emp.name}</span>
                                                        {emp.role && <span className="text-[8px] text-slate-400 uppercase font-medium">{emp.role.replace(/_/g, ' ')}</span>}
                                                    </div>
                                                </div>

                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="p-5 bg-slate-50 flex justify-center gap-3 border-t">
                                <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} className="rounded-xl h-11 px-6 font-bold text-xs">Cancel</Button>
                                <Button disabled={isSubmitting} onClick={handleCreateMeeting} className="rounded-xl h-11 bg-blue-600 text-white font-black text-xs px-10">
                                    {isSubmitting ? "Saving..." : selectedMeeting ? "Update Meeting" : "Schedule Meeting"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                        {[
                            { label: "1:1 Meetings", val: meetings.filter(m => m.type === 'one-to-one').length, icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
                            { label: "Townhall Meetings", val: meetings.filter(m => m.type === 'company').length, icon: Briefcase, color: "text-indigo-600", bg: "bg-indigo-50" },
                            { label: "Project Meetings", val: meetings.filter(m => m.type === 'project').length, icon: FolderKanban, color: "text-blue-600", bg: "bg-blue-50" },
                            { label: "Team Meetings", val: meetings.filter(m => m.type === 'team').length, icon: Users2, color: "text-rose-600", bg: "bg-rose-50" },
                        ].map((stat, i) => (
                            <Card key={i} className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[2rem]">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div><p className="text-[10px] uppercase font-black text-slate-400 mb-1">{stat.label}</p><h3 className="text-2xl font-black">{stat.val}</h3></div>
                                    <div className={`h-12 w-12 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}><stat.icon className="h-6 w-6" /></div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 mb-6">
                        <button onClick={() => setMainTab("all")} className={`h-10 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${mainTab === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-500 shadow-sm"}`}>All Meetings</button>
                        <button onClick={() => setMainTab("my")} className={`h-10 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${mainTab === "my" ? "bg-slate-900 text-white" : "bg-white text-slate-500 shadow-sm"}`}>My Meetings {myMeetings.length > 0 && <span className="ml-2 bg-blue-600 text-white px-2 rounded-full">{myMeetings.length}</span>}</button>
                    </div>

                    <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <TabsList className="h-14 p-1.5 rounded-[1.5rem] bg-white dark:bg-slate-900 shadow-sm">
                                <TabsTrigger value="one-to-one" className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-white">1:1 Meeting</TabsTrigger>
                                <TabsTrigger value="company" className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Townhall Meeting</TabsTrigger>
                                <TabsTrigger value="project" className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white">Project Meeting</TabsTrigger>
                                <TabsTrigger value="team" className="rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-rose-600 data-[state=active]:text-white">Team Meeting</TabsTrigger>
                            </TabsList>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input placeholder="Search..." className="pl-9 h-11 rounded-2xl border-none shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                </div>
                                <Input type="date" className="h-11 border-none shadow-sm rounded-2xl w-[150px]" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                            </div>
                        </div>

                        <TabsContent value={typeFilter}>
                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-[2.5rem] bg-slate-100 animate-pulse" />)}
                                </div>
                            ) : filteredMeetings.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed">
                                    <Video className="h-10 w-10 text-slate-200 mb-6" />
                                    <h3 className="text-xl font-black uppercase">No Meetings Found</h3>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {typeFilter === 'all' ? (
                                        (['company', 'team', 'project', 'one-to-one'] as const).map(type => {
                                            const grouped = filteredMeetings.filter(m => m.type === type);
                                            if (grouped.length === 0) return null;
                                            return (
                                                <div key={type} className="space-y-6">
                                                    <div className="flex items-center gap-4">
                                                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">{getDisplayName(type)}s</h2>
                                                        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1 opacity-50" />
                                                        <Badge variant="outline" className="rounded-full px-3 py-0.5 text-[9px] font-black opacity-50">{grouped.length}</Badge>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                        {grouped.map((meeting) => (
                                                            <Card key={meeting.id} className="group relative border-none shadow-sm bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
                                                                <div className={`absolute top-0 left-0 right-0 h-1.5 ${getBadgeColor(meeting.type).split(' ')[0]}`}></div>
                                                                <CardHeader className="p-8 pb-4">
                                                                    <div className="flex justify-between items-start mb-6">
                                                                        <Badge className={`rounded-full px-4 py-1 font-black text-[9px] uppercase tracking-widest ${getBadgeColor(meeting.type)}`}>{getDisplayName(meeting.type)}</Badge>
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild><div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 cursor-pointer"><MoreVertical className="h-4 w-4" /></div></DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end" className="rounded-xl">
                                                                                {(isAdmin || Number(meeting.created_by_id) === Number(user?.id)) && (
                                                                                    <>
                                                                                        <DropdownMenuItem onClick={() => openEditDialog(meeting)} className="gap-2 font-bold text-xs uppercase py-3"><Edit2 className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                                                                                        <DropdownMenuItem onClick={() => handleDeleteMeeting(meeting)} className="gap-2 font-bold text-xs uppercase py-3 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                                                                                    </>
                                                                                )}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </div>
                                                                    <CardTitle className="text-xl font-black mb-2">{meeting.title}</CardTitle>
                                                                    <CardDescription className="line-clamp-2 text-sm">{meeting.description}</CardDescription>
                                                                </CardHeader>
                                                                <CardContent className="p-8 pt-0 space-y-6">
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-3 text-slate-600"><Calendar className="h-4 w-4" /><span className="text-xs font-black uppercase">{meeting.start_time ? format(new Date(meeting.start_time), 'EEEE, MMM do') : 'TBD'}</span></div>
                                                                        <div className="flex items-center gap-3 text-slate-600"><Clock className="h-4 w-4" /><span className="text-xs font-black">{meeting.start_time ? format(new Date(meeting.start_time), 'hh:mm a') : '--:--'} - {meeting.end_time ? format(new Date(meeting.end_time), 'hh:mm a') : '--:--'}</span></div>
                                                                        {meeting.type === 'team' && meeting.team_name && (
                                                                            <div className="flex items-center gap-3 text-rose-600">
                                                                                <Users2 className="h-4 w-4" />
                                                                                <span className="text-xs font-black uppercase">{meeting.team_name}</span>
                                                                            </div>
                                                                        )}
                                                                        {meeting.type === 'project' && meeting.project_name && (
                                                                            <div className="flex items-center gap-3 text-emerald-600">
                                                                                <Briefcase className="h-4 w-4" />
                                                                                <span className="text-xs font-black uppercase">{meeting.project_name}</span>
                                                                            </div>
                                                                        )}
                                                                        {meeting.type === 'one-to-one' && meeting.created_by_name && (
                                                                            <div className="flex items-center gap-3 text-amber-600">
                                                                                <Users className="h-4 w-4" />
                                                                                <span className="text-xs font-black uppercase">{meeting.created_by_name}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="pt-6 border-t flex items-center justify-between">
                                                                        <div className="flex -space-x-3">{meeting.participants?.slice(0, 3).map((p, i) => <div key={i} className="h-10 w-10 rounded-2xl border-4 border-white bg-slate-100 overflow-hidden"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_name || p.id}`} className="h-full w-full object-cover" /></div>)}</div>
                                                                        {meeting.end_time && new Date(meeting.end_time) < new Date() ? (
                                                                            <Button disabled className="rounded-2xl bg-slate-200 text-slate-500 font-black text-[10px] uppercase px-6 h-11 cursor-not-allowed">
                                                                                Expired
                                                                            </Button>
                                                                        ) : (
                                                                            <Button asChild className="rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-black text-[10px] uppercase px-6 h-11">
                                                                                <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                                                                                    Join Meeting <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                                                                </a>
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {filteredMeetings.map((meeting) => (
                                                <Card key={meeting.id} className="group relative border-none shadow-sm bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
                                                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${getBadgeColor(meeting.type).split(' ')[0]}`}></div>
                                                    <CardHeader className="p-8 pb-4">
                                                        <div className="flex justify-between items-start mb-6">
                                                            <Badge className={`rounded-full px-4 py-1 font-black text-[9px] uppercase tracking-widest ${getBadgeColor(meeting.type)}`}>{getDisplayName(meeting.type)}</Badge>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild><div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 cursor-pointer"><MoreVertical className="h-4 w-4" /></div></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="rounded-xl">
                                                                    {(isAdmin || Number(meeting.created_by_id) === Number(user?.id)) && (
                                                                        <>
                                                                            <DropdownMenuItem onClick={() => openEditDialog(meeting)} className="gap-2 font-bold text-xs uppercase py-3"><Edit2 className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                                                                            <DropdownMenuItem onClick={() => handleDeleteMeeting(meeting)} className="gap-2 font-bold text-xs uppercase py-3 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                        <CardTitle className="text-xl font-black mb-2">{meeting.title}</CardTitle>
                                                        <CardDescription className="line-clamp-2 text-sm">{meeting.description}</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="p-8 pt-0 space-y-6">
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-3 text-slate-600"><Calendar className="h-4 w-4" /><span className="text-xs font-black uppercase">{meeting.start_time ? format(new Date(meeting.start_time), 'EEEE, MMM do') : 'TBD'}</span></div>
                                                            <div className="flex items-center gap-3 text-slate-600"><Clock className="h-4 w-4" /><span className="text-xs font-black">{meeting.start_time ? format(new Date(meeting.start_time), 'hh:mm a') : '--:--'} - {meeting.end_time ? format(new Date(meeting.end_time), 'hh:mm a') : '--:--'}</span></div>
                                                            {meeting.type === 'team' && meeting.team_name && (
                                                                <div className="flex items-center gap-3 text-rose-600">
                                                                    <Users2 className="h-4 w-4" />
                                                                    <span className="text-xs font-black uppercase">{meeting.team_name}</span>
                                                                </div>
                                                            )}
                                                            {meeting.type === 'project' && meeting.project_name && (
                                                                <div className="flex items-center gap-3 text-emerald-600">
                                                                    <Briefcase className="h-4 w-4" />
                                                                    <span className="text-xs font-black uppercase">{meeting.project_name}</span>
                                                                </div>
                                                            )}
                                                            {meeting.type === 'one-to-one' && meeting.created_by_name && (
                                                                <div className="flex items-center gap-3 text-amber-600">
                                                                    <Users className="h-4 w-4" />
                                                                    <span className="text-xs font-black uppercase">{meeting.created_by_name}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="pt-6 border-t flex items-center justify-between">
                                                            <div className="flex -space-x-3">{meeting.participants?.slice(0, 3).map((p, i) => <div key={i} className="h-10 w-10 rounded-2xl border-4 border-white bg-slate-100 overflow-hidden"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_name || p.id}`} className="h-full w-full object-cover" /></div>)}</div>
                                                                {meeting.end_time && new Date(meeting.end_time) < new Date() ? (
                                                                    <Button disabled className="rounded-2xl bg-slate-200 text-slate-500 font-black text-[10px] uppercase px-6 h-11 cursor-not-allowed">
                                                                        Expired
                                                                    </Button>
                                                                ) : (
                                                                    <Button asChild className="rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-black text-[10px] uppercase px-6 h-11">
                                                                        <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                                                                            Join Meeting <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                                                        </a>
                                                                    </Button>
                                                                )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }` }} />
        </div>
    );
};

export default MeetingsPage;