import React from 'react';
import { useEffect, useState, useCallback } from 'react';
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
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatTimeIST, formatIST, nowIST } from '@/utils/timezone';
import { apiService, API_BASE_URL } from '@/lib/api';
import TruncatedText from '@/components/ui/TruncatedText';
import { cn } from '@/lib/utils';
import SummaryCard from '@/components/ui/SummaryCard';


interface TeamMemberStatus {
  name: string;
  status: 'present' | 'completed' | 'on-leave' | 'absent';
  task: string;
  progress: number;
  userId: string;
  isOnline: boolean;
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const ACTIVITIES_PER_PAGE = 15;

  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      const dashboardData = await apiService.getManagerDashboard();
      const data = dashboardData || {};

      // Handle potential missing activeTasks/completedTasks from dashboard API
      const statSnapshot = {
        teamMembers: data.teamMembers || 0,
        presentToday: data.presentToday || 0,
        onLeave: data.onLeave || 0,
        activeTasks: data.activeTasks, // Keep as undefined if not present
        completedTasks: data.completedTasks, // Keep as undefined if not present
        pendingApprovals: data.pendingApprovals || 0,
        teamPerformancePercent: data.teamPerformancePercent || 0,
        overdueItems: data.overdueItems || 0,
      };

      setStats((prev) => ({
        ...prev,
        ...statSnapshot,
        activeTasks: statSnapshot.activeTasks ?? prev.activeTasks,
        completedTasks: statSnapshot.completedTasks ?? prev.completedTasks
      }));

      // Filter Team Activities
      const allActivities = data.teamActivities || data.recentActivities || [];
      const userDepts = (user?.department || '').split(',').map((d: any) => d.trim().toLowerCase()).filter(Boolean);

      // Simple filter for activities if the API doesn't already filter by manager department
      const filteredActivities = allActivities.slice(0, ACTIVITIES_PER_PAGE);
      setTeamActivities(filteredActivities);

      // Filter Team Performance
      const allPerformance = data.teamPerformance || [];
      setTeamPerformance(allPerformance);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  }, [user]);

  const fetchTeamMembersWithStatus = useCallback(async () => {
    setIsLoadingTeamMembers(true);
    try {
      const [employees, allTasks, attendanceData] = await Promise.all([
        apiService.getEmployees(),
        apiService.getMyTasks(),
        apiService.getTodayAttendance()
      ]);

      const userId = String(user?.id);
      const userDepts = (user?.department || '').split(',').map((d: any) => d.trim().toLowerCase()).filter(Boolean);

      const departmentEmployees = employees.filter((emp: any) => {
        const role = (emp.role || '').toLowerCase();
        const empDepts = (emp.department || '').split(',').map((d: any) => d.trim().toLowerCase()).filter(Boolean);
        const uId = String(emp.user_id || emp.userId || emp.id);

        if (uId === userId) return true;

        // Share any department and role is employee/team_lead
        const hasMatchingDept = userDepts.length === 0 || empDepts.some(d => userDepts.includes(d));
        return hasMatchingDept && (role === 'employee' || role === 'team_lead');
      });

      const attendanceMap: Record<string, any> = {};
      (Array.isArray(attendanceData) ? attendanceData : []).forEach((record: any) => {
        const recordUserId = String(record.user_id || record.userId);
        attendanceMap[recordUserId] = record;
      });

      const tasks = Array.isArray(allTasks) ? allTasks : [];

      const teamMembersData: TeamMemberStatus[] = departmentEmployees.map((emp: any) => {
        const uId = String(emp.user_id || emp.userId || emp.id);

        // Filter tasks assigned to this specific user
        const employeeTasks = tasks.filter((task: any) => {
          const assignedToVal = task.assigned_to_ids || task.assigned_to;
          const assignedToList = Array.isArray(assignedToVal)
            ? assignedToVal.map(String)
            : [String(assignedToVal)];
          return assignedToList.includes(uId);
        });

        const activeCount = employeeTasks.filter((task: any) => {
          const status = (task.status || '').toLowerCase();
          return !['completed', 'cancelled', 'complete', 'achieved'].includes(status);
        }).length;

        const completedCount = employeeTasks.filter((task: any) =>
          ['completed', 'complete', 'achieved'].includes((task.status || '').toLowerCase())
        ).length;

        const totalTasks = employeeTasks.length;
        const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

        let currentStatusText = 'No tasks assigned';
        if (activeCount > 0) {
          const firstTask = employeeTasks.find((task: any) =>
            !['completed', 'cancelled', 'complete', 'achieved'].includes((task.status || '').toLowerCase())
          );
          currentStatusText = firstTask?.title || firstTask?.task_name || 'Active on tasks';
        } else if (completedCount > 0) {
          currentStatusText = 'All tasks completed';
        }

        const attendanceRecord = attendanceMap[uId];
        let status: 'present' | 'completed' | 'on-leave' | 'absent' = 'absent';
        let isOnline = false;

        if (attendanceRecord) {
          const checkOutTime = attendanceRecord.check_out || attendanceRecord.checkOutTime;
          if (checkOutTime && checkOutTime !== 'null' && checkOutTime !== 'None') {
            status = 'completed';
            isOnline = false;
          } else {
            status = 'present';
            isOnline = true;
          }
        }

        return {
          name: emp.name || 'Unknown',
          status,
          task: currentStatusText,
          progress,
          userId: uId,
          isOnline,
        };
      });

      setTeamMembers(teamMembersData);

      // Update team members count in stats if it changed
      setStats(prev => ({
        ...prev,
        teamMembers: departmentEmployees.length
      }));

    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setIsLoadingTeamMembers(false);
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadDashboardData(true), fetchTeamMembersWithStatus()]);
    setIsRefreshing(false);
  }, [loadDashboardData, fetchTeamMembersWithStatus]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    fetchTeamMembersWithStatus();
  }, [fetchTeamMembersWithStatus]);

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
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-cyan-500/5 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-200 dark:shadow-none">
            <Target className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#000000' }}>
              {t.common.welcome}, <span style={{ color: '#0D9488' }}>{user?.name}</span>
            </h1>
            <p className="font-medium flex items-center gap-2 mt-1 text-sm" style={{ color: '#000000' }}>
              <CalendarDays className="h-4 w-4" style={{ color: '#000000' }} />
              {formatIST(nowIST(), 'EEEE, MMMM dd, yyyy | hh:mm a')}
            </p>
          </div>
        </div>

        <div className="relative flex gap-3">
          <Button
            onClick={() => navigate('/manager/employees/', { state: { highlight: true } })}
            className="rounded-xl px-6 h-12 bg-[#2563EB] hover:bg-blue-700 text-white shadow-lg shadow-blue-200 border-2 border-[#2563EB] transition-all active:scale-95 gap-2"
            style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
          >
            <UserPlus className="h-4 w-4" />
            {t.employee.addEmployee}
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="border-2 border-[#000000] p-4 rounded-2xl bg-white/50 mb-8 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {[
            {
              label: 'Total Members',
              value: stats.teamMembers,
              icon: Users,
              iconColor: 'text-blue-600',
              iconBg: 'bg-blue-50',
              path: '/manager/employees',
            },
            {
              label: 'Present Today',
              value: stats.presentToday,
              icon: Clock,
              iconColor: 'text-emerald-600',
              iconBg: 'bg-emerald-50',
              path: '/manager/attendance',
              pathState: { viewMode: 'employee' }
            },
            {
              label: 'Active Tasks',
              value: stats.activeTasks,
              icon: ClipboardList,
              iconColor: 'text-indigo-600',
              iconBg: 'bg-indigo-50',
              path: '/manager/tasks'
            },
            {
              label: 'Pending Approvals',
              value: stats.pendingApprovals,
              icon: AlertCircle,
              iconColor: 'text-amber-600',
              iconBg: 'bg-amber-50',
              path: '/manager/leaves',
              pathState: { tab: 'approvals' }
            }
          ].map((item, i) => (
            <SummaryCard
              key={i}
              title={item.label}
              value={item.value}
              icon={item.icon}
              iconColor={item.iconColor}
              iconBg={item.iconBg}
              onClick={() => item.path && navigate(item.path, { state: item.pathState })}
            />
          ))}

        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Team Activities */}
        <Card className="lg:col-span-3 border-2 border-[#000000] shadow-xl bg-white rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <CardTitle className="flex items-center gap-2 font-bold" style={{ color: '#000000' }}>
              <Activity className="h-5 w-5" style={{ color: '#000000' }} />
              <span className="text-[16px] font-bold">{t.navigation.teamActivities}</span>
            </CardTitle>
            <p className="text-[14px] font-medium" style={{ color: '#000000' }}>Recent updates from your team</p>
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
                        <p className="text-sm font-bold" style={{ color: '#000000' }}>{activity.user}</p>
                        <div className="text-xs" style={{ color: '#000000' }}>
                          <TruncatedText
                            text={activity.description || ''}
                            maxLength={50}
                            showToggle={false}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold" style={{ color: '#000000' }}>
                          {formatTimeIST(activity.time, 'hh:mm a')}
                        </p>
                        <div
                          className="text-xs font-bold uppercase mt-1"
                          style={{
                            color: (getCorrectAttendanceStatus(activity) === 'on-time' || getCorrectAttendanceStatus(activity) === 'completed')
                              ? '#16a34a'
                              : (getCorrectAttendanceStatus(activity) === 'late' || getCorrectAttendanceStatus(activity) === 'overdue')
                                ? '#dc2626'
                                : '#000000'
                          }}
                        >
                          {getCorrectAttendanceStatus(activity) === 'on-time' ? 'On Time' :
                            getCorrectAttendanceStatus(activity).replace('-', ' ')}
                        </div>
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
              <p className="text-sm font-bold" style={{ color: '#000000' }}>No recent activities</p>
            )}
          </CardContent>
        </Card>

        {/* Team Leads Performance */}
        <Card className="lg:col-span-2 border-2 border-[#000000] shadow-xl bg-white rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <CardTitle className="flex items-center gap-2 font-bold" style={{ color: '#000000' }}>
              <Target className="h-5 w-5" style={{ color: '#000000' }} />
              <span className="text-[16px] font-bold">{t.navigation.teamPerformance}</span>
            </CardTitle>
            <p className="text-[14px] font-medium" style={{ color: '#000000' }}>Task completion by team</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamPerformance.length > 0 ? teamPerformance.map((team) => (
              <div key={`${team.team}-${team.lead}`} className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#000000' }}>{team.team}</p>
                    <p className="text-sm" style={{ color: '#000000' }}>
                      <span className="font-bold">{team.lead}</span>
                      <span className="font-normal"> • {team.members} members</span>
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: '#000000' }}>{team.completion}%</span>
                </div>
                <Progress value={team.completion} className="h-2" />
              </div>
            )) : (
              <p className="text-sm font-bold" style={{ color: '#000000' }}>No performance data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Members Current Status */}
      <Card className="border-2 border-[#000000] shadow-xl bg-white rounded-2xl overflow-hidden flex flex-col">
        <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-5">
          <CardTitle className="flex items-center gap-2 font-bold" style={{ color: '#000000' }}>
            <Users className="h-5 w-5" style={{ color: '#000000' }} />
            <span className="text-[16px] font-bold">{t.navigation.teamMembers} Current Status</span>
          </CardTitle>
          <p className="text-[14px] font-medium" style={{ color: '#000000' }}>Current status and task progress</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingTeamMembers ? (
            <p className="text-sm font-bold text-center py-4" style={{ color: '#000000' }}>{t.common.loadingTeamMembers}</p>
          ) : teamMembers.length === 0 ? (
            <p className="text-sm font-bold text-center py-4" style={{ color: '#000000' }}>{t.common.noTeamMembers}</p>
          ) : (
            teamMembers.map((member) => (
              <div key={member.userId} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${member.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm" style={{ color: '#000000' }}>{member.name}</p>
                        <Badge variant="default" className={`text-[12px] ${member.isOnline ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
                          {member.isOnline ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                      <div className="text-xs flex-1 min-w-0" style={{ color: '#000000' }}>
                        <TruncatedText
                          text={member.task}
                          maxLength={35}
                          showToggle={false}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    className="text-xs font-bold uppercase"
                    style={{
                      color: (member.isOnline || member.status === 'present' || member.status === 'completed')
                        ? '#16a34a'
                        : (member.status === 'absent')
                          ? '#dc2626'
                          : '#000000'
                    }}
                  >
                    {member.isOnline ? 'Working' :
                      member.status === 'completed' ? 'Completed' :
                        member.status === 'on-leave' ? 'On Leave' :
                          'Absent'}
                  </div>
                </div>
                {(member.status === 'present' || member.status === 'completed') && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span style={{ color: '#000000' }}>Progress</span>
                      <span style={{ color: '#000000' }}>{member.progress}%</span>
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
