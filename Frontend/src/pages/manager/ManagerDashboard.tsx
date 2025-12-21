import React from 'react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import {
  Users,
  Clock,
  CalendarDays,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Activity,
  Target,
  CheckCircle2,
  Home,
  FileText,
  Timer,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatTimeIST, formatIST, nowIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface TeamMemberStatus {
  name: string;
  status: 'present' | 'on-leave' | 'absent';
  task: string;
  progress: number;
  userId: string;
}

const ManagerDashboard: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    teamMembers: 0,
    presentToday: 0,
    onLeave: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingApprovals: 0,
    teamPerformancePercent: 0,
    overdueItems: 0,
  });

  const [teamActivities, setTeamActivities] = useState<{id: string; type: string; user: string; time: string; description: string; status: string;}[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<{team: string; lead: string; members: number; completion: number;}[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberStatus[]>([]);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(false);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const ACTIVITIES_PER_PAGE = 15;

  // WFH Requests state
  const [wfhRequests, setWfhRequests] = useState<any[]>([]);
  const [isLoadingWfhRequests, setIsLoadingWfhRequests] = useState(false);
  const [isProcessingWfhRequest, setIsProcessingWfhRequest] = useState(false);
  const [selectedWfhRequest, setSelectedWfhRequest] = useState<any>(null);
  const [showWfhRequestDialog, setShowWfhRequestDialog] = useState(false);
  const [wfhRejectionReason, setWfhRejectionReason] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await apiService.getManagerDashboard();
        
        // If activeTasks is 0, try to get actual count from tasks API
        let activeTasks = data.activeTasks || 0;
        let pendingApprovals = data.pendingApprovals || 0;
        
        if (activeTasks === 0) {
          try {
            const tasks = await apiService.getMyTasks();
            // Count tasks that are not completed
            activeTasks = tasks.filter((task: any) => 
              task.status !== 'Completed' && 
              task.status !== 'completed' &&
              task.status !== 'Cancelled' &&
              task.status !== 'cancelled'
            ).length;
          } catch (error) {
            console.log('Could not fetch tasks for count');
          }
        }
        
        setStats({
          teamMembers: data.teamMembers || 0,
          presentToday: data.presentToday || 0,
          onLeave: data.onLeave || 0,
          activeTasks,
          completedTasks: data.completedTasks || 0,
          pendingApprovals,
          teamPerformancePercent: data.teamPerformancePercent || 0,
          overdueItems: data.overdueItems || 0,
        });
        setTeamActivities(data.teamActivities || []);
        setTeamPerformance(data.teamPerformance || []);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    };
    
    loadDashboard();
  }, []);

  useEffect(() => {
    const fetchTeamMembersWithStatus = async () => {
      if (!user?.department) return;
      
      setIsLoadingTeamMembers(true);
      try {
        // Fetch all employees
        const employees = await apiService.getEmployees();
        
        // Filter by department and exclude managers/admins
        const departmentEmployees = employees.filter((emp: any) => 
          emp.department === user.department && 
          emp.role?.toLowerCase() !== 'manager' && 
          emp.role?.toLowerCase() !== 'admin' &&
          emp.is_active !== false
        );

        // Fetch all tasks
        const tasks = await apiService.getMyTasks();
        
        // Process team members with their status and tasks
        const teamMembersData: TeamMemberStatus[] = await Promise.all(
          departmentEmployees.map(async (emp: any) => {
            const userId = String(emp.id || emp.user_id || '');
            
            // Get tasks assigned to this employee
            const employeeTasks = tasks.filter((task: any) => {
              const assignedTo = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
              return assignedTo.includes(userId);
            });

            // Get active tasks (not completed)
            const activeTasks = employeeTasks.filter((task: any) => 
              task.status !== 'completed' && task.status !== 'cancelled'
            );

            // Calculate progress based on completed vs total tasks
            const totalTasks = employeeTasks.length;
            const completedTasks = employeeTasks.filter((task: any) => task.status === 'completed').length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            // Get the most recent active task title
            const currentTask = activeTasks.length > 0 
              ? activeTasks[0].title || 'No active task'
              : completedTasks > 0 
                ? 'All tasks completed'
                : 'No tasks assigned';

            // Determine status (simplified - we'll assume present if they have tasks)
            let status: 'present' | 'on-leave' | 'absent' = 'present';
            if (activeTasks.length === 0 && completedTasks === 0) {
              status = 'absent';
            }

            return {
              name: emp.name || 'Unknown',
              status,
              task: currentTask,
              progress,
              userId,
            };
          })
        );

        setTeamMembers(teamMembersData);
      } catch (error) {
        console.error('Failed to fetch team members:', error);
      } finally {
        setIsLoadingTeamMembers(false);
      }
    };

    fetchTeamMembersWithStatus();
  }, [user?.department]);

  // Load WFH requests for manager (both own and team members)
  useEffect(() => {
    const loadWFHRequests = async () => {
      setIsLoadingWfhRequests(true);
      try {
        // Fetch all WFH requests using the new API method
        const response = await apiService.getAllWFHRequests();
        
        // Handle response - it's always an array
        let requests = Array.isArray(response) ? response : [];
        
        // Transform API response to match our UI format
        // The API returns requests with fields like: wfh_id, user_id, start_date, end_date, wfh_type, reason, status, employee_id, name, department, role, approver_name
        const formattedRequests = requests.map((req: any) => ({
          id: req.wfh_id || req.id,
          user_id: req.user_id,
          user_name: req.name || req.employee_name || 'Unknown',
          employee_id: req.employee_id || '',
          start_date: req.start_date,
          end_date: req.end_date,
          reason: req.reason,
          wfh_type: (req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day',
          status: (req.status || 'Pending').toLowerCase(),
          created_at: req.created_at,
          updated_at: req.updated_at,
          rejection_reason: req.rejection_reason,
          approved_by: req.approver_name || req.approved_by,
          department: req.department || 'Unknown',
          user_role: (req.role || 'employee').toLowerCase(),
        }));
        setWfhRequests(formattedRequests);
      } catch (error) {
        // Silently fail - endpoint may not be implemented yet
        // The API method already handles errors gracefully
        setWfhRequests([]);
      } finally {
        setIsLoadingWfhRequests(false);
      }
    };

    loadWFHRequests();
  }, [user?.department]);

  // Handle WFH request approval/rejection for Manager
  const handleWfhRequestAction = async (requestId: number, action: 'approve' | 'reject', reason?: string) => {
    setIsProcessingWfhRequest(true);
    try {
      const approved = action === 'approve';
      await apiService.approveWFHRequest(requestId, approved, reason);

      // Update local state optimistically
      const currentTime = new Date();
      setWfhRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { 
                ...req, 
                status: action === 'approve' ? 'approved' : 'rejected',
                updated_at: currentTime.toISOString(),
                approved_by: user?.name || 'Manager',
                rejection_reason: action === 'reject' ? reason : undefined
              }
            : req
        )
      );

      toast({
        title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `WFH request has been ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
        variant: 'default',
      });

      setShowWfhRequestDialog(false);
      setSelectedWfhRequest(null);
      setWfhRejectionReason('');
    } catch (error) {
      console.error('Error processing WFH request:', error);
      toast({
        title: 'Action Failed',
        description: `Failed to ${action} the request. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingWfhRequest(false);
    }
  };

  // Calculate correct attendance status based on check-in time and grace period
  const getCorrectAttendanceStatus = (activity: any) => {
    if (activity.type !== 'check-in') {
      return activity.status;
    }

    // Default scheduled check-in time is 10:00 AM
    const SCHEDULED_CHECK_IN_HOUR = 10;
    const SCHEDULED_CHECK_IN_MINUTE = 0;
    const GRACE_PERIOD_MINUTES = 15;

    try {
      if (!activity.time) {
        return activity.status;
      }

      // Parse the check-in time
      const checkInDate = new Date(activity.time);
      const checkInHour = checkInDate.getHours();
      const checkInMinute = checkInDate.getMinutes();

      // Calculate scheduled check-in time in minutes
      const scheduledTimeInMinutes = SCHEDULED_CHECK_IN_HOUR * 60 + SCHEDULED_CHECK_IN_MINUTE;
      const checkInTimeInMinutes = checkInHour * 60 + checkInMinute;
      const gracePeriodEndInMinutes = scheduledTimeInMinutes + GRACE_PERIOD_MINUTES;

      // Determine status
      if (checkInTimeInMinutes <= gracePeriodEndInMinutes) {
        return 'on-time';
      } else {
        return 'late';
      }
    } catch (error) {
      return activity.status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-700 to-blue-800 text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Target className="h-7 w-7 text-white" />
            </div>
            {t.common.welcome}, Manager!
          </h1>
          <p className="text-teal-100 mt-2 ml-15">
            {formatIST(nowIST(), 'EEEE, MMMM dd, yyyy')}
          </p>
        </div>
        <Button onClick={() => navigate('/manager/tasks')} className="gap-2 bg-white text-teal-700 hover:bg-teal-50">
          <ClipboardList className="h-4 w-4" />
          Assign Task
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-50">
              Total Members
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.teamMembers}</div>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/manager/attendance')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-50">
              Present Today
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.presentToday}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto mt-2 text-white hover:text-green-100" 
              onClick={(e) => {
                e.stopPropagation();
                navigate('/manager/attendance');
              }}
            >
              <span className="text-sm">View all</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyan-50">
              Active Tasks
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeTasks}</div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-sm text-cyan-100">{stats.completedTasks} completed</span>
            </div>
            <Button variant="link" className="p-0 h-auto mt-1 text-white hover:text-cyan-100" onClick={() => navigate('/manager/tasks')}>
              <span className="text-sm">Manage tasks</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/manager/leaves')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-50">
              Pending Approvals
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingApprovals}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto mt-2 text-white hover:text-amber-100" 
              onClick={(e) => {
                e.stopPropagation();
                navigate('/manager/leaves');
              }}
            >
              <span className="text-sm">View all</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Activities */}
        <Card className="lg:col-span-2 border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              {t.navigation.teamActivities}
            </CardTitle>
            <CardDescription className="text-base">Recent updates from your team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamActivities.length > 0 ? (
              <>
                {teamActivities
                  .slice((activitiesPage - 1) * ACTIVITIES_PER_PAGE, activitiesPage * ACTIVITIES_PER_PAGE)
                  .map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                        activity.type === 'task' ? 'bg-gradient-to-br from-blue-400 to-indigo-500' :
                        activity.type === 'leave' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                        'bg-gradient-to-br from-green-400 to-emerald-500'
                      }`}>
                        {activity.type === 'task' && <ClipboardList className="h-5 w-5 text-white" />}
                        {activity.type === 'leave' && <CalendarDays className="h-5 w-5 text-white" />}
                        {activity.type === 'check-in' && <Clock className="h-5 w-5 text-white" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{activity.user}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.description || ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatTimeIST(activity.time, 'hh:mm a')}
                        </p>
                        <Badge 
                          variant={
                            getCorrectAttendanceStatus(activity) === 'completed' || getCorrectAttendanceStatus(activity) === 'on-time' ? 'default' :
                            getCorrectAttendanceStatus(activity) === 'pending' ? 'secondary' :
                            getCorrectAttendanceStatus(activity) === 'late' ? 'destructive' :
                            'outline'
                          }
                          className={`text-xs mt-1 ${
                            getCorrectAttendanceStatus(activity) === 'late' ? 'bg-red-500' : ''
                          }`}
                        >
                          {getCorrectAttendanceStatus(activity) === 'on-time' ? 'On Time' :
                           getCorrectAttendanceStatus(activity) === 'late' ? 'Late' :
                           getCorrectAttendanceStatus(activity)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                {teamActivities.length > ACTIVITIES_PER_PAGE && (
                  <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivitiesPage(p => Math.max(1, p - 1))}
                      disabled={activitiesPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.ceil(teamActivities.length / ACTIVITIES_PER_PAGE) }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={activitiesPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActivitiesPage(page)}
                        className="h-8 w-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivitiesPage(p => Math.min(Math.ceil(teamActivities.length / ACTIVITIES_PER_PAGE), p + 1))}
                      disabled={activitiesPage === Math.ceil(teamActivities.length / ACTIVITIES_PER_PAGE)}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activities</p>
            )}
          </CardContent>
        </Card>

        {/* Team Leads Performance */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Target className="h-5 w-5 text-white" />
              </div>
              {t.navigation.teamPerformance}
            </CardTitle>
            <CardDescription className="text-base">Task completion by team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamPerformance.length > 0 ? teamPerformance.map((team) => (
              <div key={`${team.team}-${team.lead}`} className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{team.team}</p>
                    <p className="text-xs text-muted-foreground">{team.lead} • {team.members} members</p>
                  </div>
                  <span className="text-sm font-semibold">{team.completion}%</span>
                </div>
                <Progress value={team.completion} className="h-2" />
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No performance data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Members Current Status */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            {t.navigation.teamMembers} Current Status
          </CardTitle>
          <CardDescription className="text-base">Current status and task progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingTeamMembers ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t.common.loadingTeamMembers}</p>
          ) : teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t.common.noTeamMembers}</p>
          ) : (
            teamMembers.map((member) => (
              <div key={member.userId} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      member.status === 'present' ? 'bg-green-500' : 
                      member.status === 'on-leave' ? 'bg-amber-500' : 
                      'bg-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.task}</p>
                    </div>
                  </div>
                  <Badge variant={
                    member.status === 'present' ? 'default' : 
                    member.status === 'on-leave' ? 'secondary' : 
                    'outline'
                  }>
                    {member.status === 'present' ? 'Active' : 
                     member.status === 'on-leave' ? 'On Leave' : 
                     'Absent'}
                  </Badge>
                </div>
                {member.status === 'present' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{member.progress}%</span>
                    </div>
                    <Progress value={member.progress} className="h-1" />
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* WFH Requests */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Home className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">My WFH Requests</CardTitle>
                <CardDescription className="text-base">Your work from home requests</CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/manager/wfh')}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingWfhRequests ? (
            <div className="flex items-center justify-center py-8">
              <Timer className="h-6 w-6 animate-spin text-orange-600" />
              <span className="ml-2 text-muted-foreground">Loading requests...</span>
            </div>
          ) : wfhRequests.length === 0 ? (
            <div className="text-center py-8">
              <Home className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground">No WFH requests yet</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/manager/wfh')}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Submit Request
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {wfhRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="border rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{request.user_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {request.user_role}
                        </Badge>
                        <Badge 
                          variant={
                            request.status === 'approved' ? 'default' :
                            request.status === 'rejected' ? 'destructive' :
                            'secondary'
                          }
                          className={request.status === 'approved' ? 'bg-green-500' : ''}
                        >
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        <span>{request.start_date} to {request.end_date}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{request.reason}</p>
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                          onClick={() => handleWfhRequestAction(request.id, 'approve')}
                          disabled={isProcessingWfhRequest}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => {
                            setSelectedWfhRequest(request);
                            setShowWfhRequestDialog(true);
                          }}
                          disabled={isProcessingWfhRequest}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {wfhRequests.length > 3 && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/manager/wfh')}
                >
                  View all {wfhRequests.length} requests
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.quickActions}</CardTitle>
          <CardDescription>Frequently used manager actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/manager/shift-schedule')}>
              <Clock className="h-5 w-5" />
              <span className="text-xs">{t.navigation.shiftSchedule}</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/manager/teams')}>
              <Users className="h-5 w-5" />
              <span className="text-xs">{t.navigation.viewTeam}</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/manager/attendance', { state: { viewMode: 'employee' } })}>
              <Clock className="h-5 w-5" />
              <span className="text-xs">{t.navigation.teamAttendance}</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/manager/leaves', { state: { tab: 'approvals' } })}>
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs">Approve Leaves</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/manager/tasks')}>
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs">Manage Tasks</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WFH Request Rejection Dialog */}
      <Dialog open={showWfhRequestDialog} onOpenChange={setShowWfhRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject WFH Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this work from home request
            </DialogDescription>
          </DialogHeader>
          {selectedWfhRequest && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg space-y-2">
                <p className="text-sm"><strong>Employee:</strong> {selectedWfhRequest.user_name}</p>
                <p className="text-sm"><strong>Date:</strong> {selectedWfhRequest.start_date} to {selectedWfhRequest.end_date}</p>
                <p className="text-sm"><strong>Reason:</strong> {selectedWfhRequest.reason}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Please provide a reason for rejection..."
                  value={wfhRejectionReason}
                  onChange={(e) => setWfhRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWfhRequestDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedWfhRequest && wfhRejectionReason.trim()) {
                  handleWfhRequestAction(selectedWfhRequest.id, 'reject', wfhRejectionReason);
                } else {
                  toast({
                    title: 'Error',
                    description: 'Please provide a rejection reason',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={isProcessingWfhRequest || !wfhRejectionReason.trim()}
            >
              {isProcessingWfhRequest ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;