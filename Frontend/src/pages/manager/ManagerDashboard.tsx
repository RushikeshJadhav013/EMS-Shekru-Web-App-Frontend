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
  AlertCircle,
  ChevronRight,
  Activity,
  Target,
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

  const [teamActivities, setTeamActivities] = useState<{ id: string; type: string; user: string; time: string; description: string; status: string; }[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<{ team: string; lead: string; members: number; completion: number; }[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberStatus[]>([]);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(false);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const ACTIVITIES_PER_PAGE = 15;

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [dashboardData, employees] = await Promise.all([
          apiService.getManagerDashboard(),
          apiService.getEmployees()
        ]);

        const data = dashboardData || {};

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

        // Create a map for quick lookup: Name -> { role, department, userId }
        const employeeMap: Record<string, { role: string; department: string; userId: string }> = {};
        employees.forEach((emp: any) => {
          const name = (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim();
          const userId = String(emp.user_id || emp.userId || emp.id);
          employeeMap[name] = {
            role: (emp.role || '').toLowerCase(),
            department: (emp.department || '').trim().toLowerCase(),
            userId: userId
          };
          // Also map by User ID just in case
          employeeMap[userId] = employeeMap[name];
        });

        // Current User Info
        const userDept = (user?.department || '').trim().toLowerCase();
        const userId = String(user?.id);

        // Calculate team members count (Self + Employees only)
        // Logic: Count = 1 (Self) + Employees/TeamLeads in department. 
        // Excludes other Managers, Admins, etc.
        let teamMembersCount = data.teamMembers || 0;
        if (userDept) {
          const relevantEmployees = employees.filter((emp: any) => {
            const empDept = (emp.department || '').trim().toLowerCase();
            const role = (emp.role || '').toLowerCase();
            const uId = String(emp.user_id || emp.userId || emp.id);

            // Allow Self
            if (uId === userId) return true;

            // Allow Department + Role constraint
            return empDept === userDept && (role === 'employee' || role === 'team_lead');
          });
          teamMembersCount = relevantEmployees.length;
        }

        setStats({
          teamMembers: teamMembersCount,
          presentToday: data.presentToday || 0,
          onLeave: data.onLeave || 0,
          activeTasks,
          completedTasks: data.completedTasks || 0,
          pendingApprovals,
          teamPerformancePercent: data.teamPerformancePercent || 0,
          overdueItems: data.overdueItems || 0,
        });

        // Filter Team Activities
        const allActivities = data.teamActivities || [];
        const filteredActivities = allActivities.filter((activity: any) => {
          // Identify user from activity (it usually has a 'user' field containing name)
          const userName = (activity.user || '').trim();

          // Use our map to verify role and department
          const empInfo = employeeMap[userName];

          // If we can't find them, default to excluded (security first)
          // Exception: If the name matches current user's name (we might need to fetch user details to know name, 
          // or assume if it's not found in employee list it might be someone else, so safer to hide).
          if (!empInfo) {
            // Try to see if it's self by some other means or just hide
            return false;
          }

          // 1. Allow Self
          if (empInfo.userId === userId) return true;

          // 2. Check Dept & Role
          return empInfo.department === userDept && (empInfo.role === 'employee' || empInfo.role === 'team_lead');
        });

        setTeamActivities(filteredActivities);

        // Filter Team Performance (Teams list)
        // If the 'team' field matches user's department, show it.
        const allPerformance = data.teamPerformance || [];
        const filteredPerformance = allPerformance.filter((p: any) => {
          const pTeam = (p.team || '').trim().toLowerCase();
          return pTeam === userDept;
        });
        setTeamPerformance(filteredPerformance);

      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    };

    loadDashboard();
  }, [user]);

  useEffect(() => {
    const fetchTeamMembersWithStatus = async () => {
      if (!user?.department) return;

      setIsLoadingTeamMembers(true);
      try {
        // Fetch all employees
        const employees = await apiService.getEmployees();
        const userDept = user.department.trim().toLowerCase();
        const userId = String(user.id);

        // Filter by department and STRICT roles (Employee, Team Lead, and Self)
        const departmentEmployees = employees.filter((emp: any) => {
          const empDept = (emp.department || '').trim().toLowerCase();
          const role = (emp.role || '').toLowerCase();
          const uId = String(emp.id || emp.user_id || '');

          // 1. Allow Self (Manager)
          if (uId === userId) return true;

          // 2. Allow Department Members (Employee / Team Lead ONLY)
          return empDept === userDept && (role === 'employee' || role === 'team_lead');
        });

        // Fetch all tasks
        const tasks = await apiService.getMyTasks();

        // Process team members with their status and tasks
        const teamMembersData: TeamMemberStatus[] = await Promise.all(
          departmentEmployees.map(async (emp: any) => {
            const uId = String(emp.id || emp.user_id || '');

            // Get tasks assigned to this employee
            const employeeTasks = tasks.filter((task: any) => {
              // Handle both camelCase (frontend) and snake_case (backend) property names
              const assignedToVal = task.assignedTo !== undefined ? task.assignedTo : task.assigned_to;
              const assignedToList = Array.isArray(assignedToVal) ? assignedToVal : [assignedToVal];

              // Check if employee ID is in the assigned list (converting all to strings for safe comparison)
              return assignedToList.some((id: any) => String(id) === uId);
            });

            // Get active tasks (not completed or cancelled)
            const activeTasks = employeeTasks.filter((task: any) => {
              const status = (task.status || '').toLowerCase();
              return status !== 'completed' && status !== 'cancelled';
            });

            // Sort active tasks by creation date (newest first)
            activeTasks.sort((a: any, b: any) => {
              const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
              const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
              return dateB - dateA;
            });

            // Calculate progress based on completed vs total tasks
            const totalTasks = employeeTasks.length;
            const completedTasks = employeeTasks.filter((task: any) => (task.status || '').toLowerCase() === 'completed').length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            // Get the most recent active task title
            const currentTask = activeTasks.length > 0
              ? activeTasks[0].title || 'No active task'
              : completedTasks > 0
                ? 'All tasks completed'
                : 'No tasks assigned';

            // Determine status (simplified - we'll assume present if they have tasks)
            let status: 'present' | 'on-leave' | 'absent' = 'present';
            // Simple logic: if in list, assume present unless specific leave status api called (which is complex here), 
            // so we keep existing logic but apply strictly to filtered list.
            if (activeTasks.length === 0 && completedTasks === 0) {
              status = 'absent';
            }

            return {
              name: emp.name || 'Unknown',
              status,
              task: currentTask,
              progress,
              userId: uId,
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
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-cyan-500/5 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-200 dark:shadow-none">
            <Target className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              {t.common.welcome}, <span className="text-teal-600">Manager!</span>
            </h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <CalendarDays className="h-4 w-4 text-teal-500" />
              {formatIST(nowIST(), 'EEEE, MMMM dd, yyyy')}
            </p>
          </div>
        </div>

        <div className="relative flex gap-3">
          <Button
            onClick={() => navigate('/manager/tasks')}
            size="lg"
            className="rounded-xl px-6 h-12 bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-200 dark:shadow-none transition-all active:scale-95 gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            Assign Task
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: 'Total Members',
            value: stats.teamMembers,
            sub: 'Department Overview',
            icon: Users,
            color: 'blue',
            bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
            cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
            borderColor: 'border-blue-300/80 dark:border-blue-700/50',
            hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400',
            path: '/manager/employees'
          },
          {
            label: 'Present Today',
            value: stats.presentToday,
            sub: 'Attendance Status',
            icon: Clock,
            color: 'emerald',
            bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
            cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
            borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
            hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400',
            path: '/manager/attendance',
            pathState: { viewMode: 'employee' }
          },
          {
            label: 'Active Tasks',
            value: stats.activeTasks,
            sub: `${stats.completedTasks} Done Today`,
            icon: ClipboardList,
            color: 'indigo',
            bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
            cardBg: 'bg-indigo-50/40 dark:bg-indigo-950/10',
            borderColor: 'border-indigo-300/80 dark:border-indigo-700/50',
            hoverBorder: 'group-hover:border-indigo-500 dark:group-hover:border-indigo-400',
            path: '/manager/tasks'
          },
          {
            label: 'Pending Approvals',
            value: stats.pendingApprovals,
            sub: 'Awaiting Decisions',
            icon: AlertCircle,
            color: 'amber',
            bg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
            cardBg: 'bg-amber-50/40 dark:bg-amber-950/10',
            borderColor: 'border-amber-300/80 dark:border-amber-700/50',
            hoverBorder: 'group-hover:border-amber-500 dark:group-hover:border-amber-400',
            path: '/manager/leaves',
            pathState: { tab: 'approvals' }
          }
        ].map((item, i) => (
          <Card
            key={i}
            className={`border-2 ${item.borderColor} ${item.hoverBorder} shadow-sm ${item.cardBg} backdrop-blur-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative cursor-pointer`}
            onClick={() => navigate(item.path, { state: item.pathState })}
          >
            {/* Background Accent */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${item.bg.split(' ')[0]}`} />

            <CardContent className="p-5 relative">
              <div className="flex justify-between items-start mb-3">
                <div className={`p-2.5 rounded-xl ${item.bg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{item.label}</h3>
                <div className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{item.value}</div>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/50 dark:bg-gray-900/30 border border-black/5 dark:border-white/5">
                  <div className={`h-1.5 w-1.5 rounded-full ${item.color === 'blue' ? 'bg-blue-500' :
                    item.color === 'emerald' ? 'bg-emerald-500' :
                      item.color === 'indigo' ? 'bg-indigo-500' :
                        'bg-amber-500'
                    }`} />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.sub}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${activity.type === 'task' ? 'bg-gradient-to-br from-blue-400 to-indigo-500' :
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
                          className={`text-xs mt-1 ${getCorrectAttendanceStatus(activity) === 'late' ? 'bg-red-500' : ''
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
                    <div className={`h-2 w-2 rounded-full ${member.status === 'present' ? 'bg-green-500' :
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

    </div>
  );
};

export default ManagerDashboard;