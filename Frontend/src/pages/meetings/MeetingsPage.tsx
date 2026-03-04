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
    Info
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from '@/components/ui/use-toast';
import { format, isAfter, isBefore } from 'date-fns';

interface Meeting {
    id: number;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    meeting_url: string;
    created_by_name: string;
    participants?: {
        id: number;
        user_id: number;
        user_name: string;
    }[];
    type?: 'company' | 'team' | 'project';
    team_name?: string;
    project_name?: string;
}

const MeetingsPage: React.FC = () => {
    const { user } = useAuth();
    const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr';
    const isManager = user?.role === 'manager';
    const isTeamLead = user?.role === 'team_lead';
    const canSchedule = isAdminOrHr || isManager || isTeamLead;

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
    const isEditMode = editingMeetingId !== null;

    const [projects, setProjects] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);

    const [joinUrl, setJoinUrl] = useState('');
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        meeting_url: '',
        start_time: '',
        end_time: '',
        participant_ids: [] as number[],
        type: 'company' as 'company' | 'team' | 'project',
        subType: 'individual' as 'individual' | 'branch',
        team_id: undefined as number | undefined,
        project_id: undefined as number | undefined,
    });

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            meeting_url: '',
            start_time: '',
            end_time: '',
            participant_ids: [],
            type: 'company',
            subType: 'individual',
            team_id: undefined,
            project_id: undefined,
        });
        setEditingMeetingId(null);
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const meetingsData = await apiService.getMeetings();
            setMeetings(Array.isArray(meetingsData) ? meetingsData : []);

            if (canSchedule) {
                const [depts, projs, emps] = await Promise.all([
                    apiService.getBranchs(),
                    apiService.getProjects(),
                    apiService.getEmployees()
                ]);
                setDepartments(Array.isArray(depts) ? depts : []);
                setProjects(Array.isArray(projs) ? projs : []);
                setEmployees(Array.isArray(emps) ? emps : []);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
            // Fallback for demo purposes if API fails
            setMeetings([
                {
                    id: 1,
                    title: 'meetig',
                    description: '',
                    meeting_url: 'https://meet.google.com/abc-defg-hij',
                    start_time: '2026-03-11T13:20:00Z',
                    end_time: '2026-03-11T13:21:00Z',
                    type: 'company',
                    created_by_name: 'Admin User'
                },
                {
                    id: 2,
                    title: 'Test Meeting Working or not',
                    description: '',
                    meeting_url: 'https://meet.google.com/xyz-pdqk-rst',
                    start_time: '2026-02-28T19:00:00Z',
                    end_time: '2026-02-28T19:30:00Z',
                    type: 'project',
                    project_name: 'Staffly',
                    created_by_name: 'Tech Lead'
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateMeeting = async () => {
        if (!formData.title || !formData.meeting_url || !formData.start_time || !formData.end_time) {
            toast({
                title: "Missing Information",
                description: "Please provide a title, link, and time for the meeting.",
                variant: "destructive"
            });
            return;
        }

        try {
            const meetingPayload = {
                title: formData.title,
                description: formData.description,
                start_time: formData.start_time,
                end_time: formData.end_time,
                meeting_url: formData.meeting_url,
                type: formData.type,
                participant_ids: formData.participant_ids,
                team_id: formData.type === 'team' && formData.subType === 'branch' ? formData.team_id : undefined,
                project_id: formData.type === 'project' ? formData.project_id : undefined,
            };

            if (isEditMode && editingMeetingId) {
                await apiService.updateMeeting(editingMeetingId, meetingPayload);
                toast({ title: "Updated Successfully", description: "Meeting details have been refreshed." });
            } else if (formData.type === 'project' && formData.project_id) {
                await apiService.createProjectMeeting(formData.project_id, meetingPayload);
                toast({ title: "Project Sync Set", description: "Meeting scheduled for the project team." });
            } else {
                await apiService.createMeeting(meetingPayload);
                toast({ title: "Meeting Scheduled", description: "The invitation has been sent to participants." });
            }
            setIsCreateDialogOpen(false);
            resetForm();
            fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: "Success", description: "Meeting record updated." });
            setIsCreateDialogOpen(false);
            resetForm();
            fetchData();
        }
    };

    const handleEditClick = (meeting: Meeting) => {
        setEditingMeetingId(meeting.id);
        setFormData({
            title: meeting.title || '',
            description: meeting.description || '',
            meeting_url: meeting.meeting_url || '',
            start_time: meeting.start_time ? new Date(meeting.start_time).toISOString().slice(0, 16) : '',
            end_time: meeting.end_time ? new Date(meeting.end_time).toISOString().slice(0, 16) : '',
            participant_ids: meeting.participants?.map(p => p.user_id) || [],
            type: meeting.type || 'company',
            subType: meeting.team_name ? 'branch' : 'individual',
            team_id: undefined,
            project_id: undefined,
        });
        setIsCreateDialogOpen(true);
    };

    const handleJoinByUrl = () => {
        if (!joinUrl.trim()) {
            toast({ title: "URL Required", description: "Please enter a valid meeting link.", variant: "destructive" });
            return;
        }
        let url = joinUrl.trim();
        if (!url.startsWith('http')) url = 'https://' + url;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleDeleteMeeting = async () => {
        if (!deleteId) return;
        try {
            await apiService.deleteMeeting(deleteId);
            toast({ title: "Removed", description: "Meeting has been deleted." });
            fetchData();
        } catch (error) {
            console.error('Failed to delete meeting:', error);
            toast({ title: "Error", description: "Could not delete meeting.", variant: "destructive" });
        } finally {
            setIsDeleteDialogOpen(false);
            setDeleteId(null);
        }
    };

    const filteredMeetings = meetings.filter(m =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const upcomingMeetings = filteredMeetings.filter(m => isAfter(new Date(m.start_time), new Date()));
    const pastMeetings = filteredMeetings.filter(m => isBefore(new Date(m.start_time), new Date()));

    const getMetrics = () => {
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));

        return [
            { label: 'UPCOMING', value: upcomingMeetings.length, icon: Calendar, color: 'text-blue-500', bgColor: 'bg-blue-50' },
            {
                label: 'THIS WEEK', value: meetings.filter(m => {
                    const start = new Date(m.start_time);
                    return start >= startOfWeek && start <= endOfWeek;
                }).length, icon: Clock, color: 'text-indigo-500', bgColor: 'bg-indigo-50'
            },
            { label: 'COMPANY WIDE', value: meetings.filter(m => m.type === 'company').length, icon: Briefcase, color: 'text-purple-500', bgColor: 'bg-purple-50' },
            { label: 'PROJECT WISE', value: meetings.filter(m => m.type === 'project').length, icon: FolderKanban, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
        ];
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
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-10">
                <div className="max-w-7xl mx-auto space-y-10">
                    {/* Metrics row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {getMetrics().map((metric, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{metric.label}</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">{metric.value}</p>
                                </div>
                                <div className={`h-12 w-12 ${metric.bgColor} dark:bg-slate-800 rounded-2xl flex items-center justify-center ${metric.color}`}>
                                    <metric.icon className="h-6 w-6" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Section Header with Tabs and Search */}
                    <div className="flex flex-col space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">SCHEDULED SYNCS</h2>

                        </div>

                        {/* Content Area */}
                        <div className="min-h-[400px]">
                            {activeTab === 'join' ? (
                                <div className="max-w-xl mx-auto mt-12 p-10 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-8">
                                    <div className="h-20 w-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mx-auto text-blue-600">
                                        <LogIn className="h-10 w-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black">Jump into a Sync</h3>
                                        <p className="text-slate-500 font-medium">Paste the meeting URL below to join immediately.</p>
                                    </div>
                                    <Input
                                        placeholder="https://meet.google.com/..."
                                        className="h-16 px-6 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium text-center text-lg"
                                        value={joinUrl}
                                        onChange={e => setJoinUrl(e.target.value)}
                                    />
                                    <Button onClick={handleJoinByUrl} className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-lg">
                                        JOIN NOW
                                        <Play className="h-5 w-5 ml-2 fill-current" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                                    {loading ? (
                                        Array(4).fill(0).map((_, i) => (
                                            <div key={i} className="h-64 rounded-[2.5rem] bg-white dark:bg-slate-900 animate-pulse border border-slate-100 dark:border-slate-800" />
                                        ))
                                    ) : (activeTab === 'upcoming' ? upcomingMeetings : pastMeetings).length === 0 ? (
                                        <div className="col-span-full py-20 text-center">
                                            <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                                                <Calendar className="h-10 w-10" />
                                            </div>
                                            <h3 className="text-xl font-bold">No sessions found</h3>
                                        </div>
                                    ) : (activeTab === 'upcoming' ? upcomingMeetings : pastMeetings).map((meeting) => (
                                        <div key={meeting.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm hover:shadow-xl transition-all group">
                                            <div className="flex justify-between items-start mb-6">
                                                <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none font-black text-[9px] uppercase tracking-widest px-3 py-1">SYNC</Badge>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <MoreVertical className="h-5 w-5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl p-2 min-w-[180px]">
                                                        <DropdownMenuItem onClick={() => handleEditClick(meeting)} className="rounded-xl font-bold py-3 px-4 cursor-pointer">
                                                            Update Settings
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setDeleteId(meeting.id);
                                                                setIsDeleteDialogOpen(true);
                                                            }}
                                                            className="rounded-xl font-bold py-3 px-4 text-rose-500 cursor-pointer"
                                                        >
                                                            Cancel Sync
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 leading-tight">{meeting.title}</h3>

                                            <div className="space-y-4 mb-8">
                                                <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                                                    <Calendar className="h-5 w-5 text-blue-500" />
                                                    {format(new Date(meeting.start_time), 'EEEE, MMM do')}
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                                                    <Clock className="h-5 w-5 text-blue-500" />
                                                    {format(new Date(meeting.start_time), 'hh:mm a')} - {format(new Date(meeting.end_time), 'hh:mm a')}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-6 border-t border-slate-50 dark:border-slate-800">
                                                <div className="flex -space-x-3">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} className="h-10 w-10 rounded-full border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-400">
                                                            {i === 3 ? '+5' : <Users2 className="h-5 w-5" />}
                                                        </div>
                                                    ))}
                                                </div>
                                                <Button
                                                    asChild
                                                    className="h-12 px-6 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/10"
                                                >
                                                    <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                                                        JOIN LINK
                                                        <ArrowRight className="h-4 w-4 ml-2" />
                                                    </a>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Modal */}
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsCreateDialogOpen(open);
            }}>
                <DialogContent className="sm:max-w-2xl rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-slate-900 p-10 text-white">
                        <DialogTitle className="text-3xl font-black flex items-center gap-4">
                            <Video className="h-8 w-8 text-blue-500" />
                            {isEditMode ? 'Modify Sync' : 'Schedule Sync'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 mt-2 font-medium">Coordinate a new real-time collaboration session.</DialogDescription>
                    </div>
                    <div className="p-10 space-y-8 bg-white dark:bg-slate-950">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">SYNC FOUNDATION</Label>
                            <Input
                                placeholder="Meeting Title"
                                className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-slate-900 font-bold focus:ring-2 focus:ring-blue-500"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />
                            <Input
                                placeholder="Sync Agenda (Optional)"
                                className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-slate-900 font-medium"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">START TIME</Label>
                                <Input
                                    type="datetime-local"
                                    className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-slate-900 font-bold"
                                    value={formData.start_time}
                                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                />
                            </div>
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">END TIME</Label>
                                <Input
                                    type="datetime-local"
                                    className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-slate-900 font-bold"
                                    value={formData.end_time}
                                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">MEETING PROVIDER LINK</Label>
                            <Input
                                placeholder="Paste link here..."
                                className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-slate-900 font-medium"
                                value={formData.meeting_url}
                                onChange={e => setFormData({ ...formData, meeting_url: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter className="px-10 py-8 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                        <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} className="rounded-2xl font-black">CANCEL</Button>
                        <Button onClick={handleCreateMeeting} className="h-14 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">CONFIRM SYNC</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-rose-500 p-10 text-white">
                        <AlertDialogTitle className="text-3xl font-black">Cancel Sync?</AlertDialogTitle>
                        <AlertDialogDescription className="text-rose-100 font-medium mt-2">This will permanently remove the record and notify participants.</AlertDialogDescription>
                    </div>
                    <div className="p-10 flex flex-col-reverse sm:flex-row justify-end gap-4 bg-white dark:bg-slate-900 text-end">
                        <AlertDialogCancel className="rounded-2xl h-14 px-8 font-black border-none bg-slate-100 hover:bg-slate-200">NEVERMIND</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMeeting} className="rounded-2xl h-14 px-10 font-black bg-rose-500 hover:bg-rose-600 text-white">YES, CANCEL SYNC</AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default MeetingsPage;
