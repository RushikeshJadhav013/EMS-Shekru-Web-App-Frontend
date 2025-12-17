import React from 'react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatTimeIST, formatIST, nowIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';

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
        <Card className="card-hover border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/manager/teams')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-50">
              {t.navigation.teamMembers}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.teamMembers}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto mt-2 text-white hover:text-blue-100" 
              onClick={(e) => {
                e.stopPropagation();
                navigate('/manager/teams');
              }}
            >
              <span className="text-sm">View all</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
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
    </div>
  );
};

export default ManagerDashboard;