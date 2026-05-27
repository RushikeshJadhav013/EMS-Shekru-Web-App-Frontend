import React from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLeaveBalance } from '@/contexts/LeaveBalanceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CalendarDays,
  ClipboardList,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  Award,
  Target,
  Circle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatIST, nowIST, todayIST, parseToIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';
import { cn } from '@/lib/utils';
import SummaryCard from '@/components/ui/SummaryCard';

import TruncatedText from '@/components/ui/TruncatedText';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { leaveBalance } = useLeaveBalance();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    tasksAssigned: 0,
    tasksCompleted: 0,
    tasksPending: 0,
    leavesAvailable: 0,
    leavesTaken: 0,
    attendancePercentage: 0,
    currentMonthHours: 0,
  });

  interface ActivityItem {
    id: string | number;
    action: string;
    description: string;
    time: string;
    type: 'success' | 'warning' | 'info' | 'error';
    timestamp: number; // For sorting
  }

  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [dashboardData, tasksData] = await Promise.all([
          apiService.getEmployeeDashboard(),
          apiService.getMyTasks()
        ]);

        // If task counts are 0, calculate from actual tasks
        let tasksAssigned = dashboardData.tasksAssigned || 0;
        let tasksCompleted = dashboardData.tasksCompleted || 0;
        let tasksPending = dashboardData.tasksPending || 0;

        if (tasksAssigned === 0 && tasksData.length > 0) {
          tasksAssigned = tasksData.length;
          tasksCompleted = tasksData.filter((task: any) =>
            task.status === 'Completed' || task.status === 'completed'
          ).length;
          tasksPending = tasksData.filter((task: any) =>
            task.status !== 'Completed' &&
            task.status !== 'completed' &&
            task.status !== 'Cancelled' &&
            task.status !== 'cancelled'
          ).length;
        }

        // Recalculate attendance rate if it seems incorrect (e.g., > 100%) or as a standard fetch
        let attendancePercentage = dashboardData.attendancePercentage || 0;
        try {
          const userIdNum = user?.id ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : null;
          if (userIdNum) {
            const attendSummary = await apiService.getWorkingHoursSummary({
              user_id: userIdNum,
              period: 'current_month'
            });
            if (attendSummary && attendSummary.days && attendSummary.days.length > 0) {
              const presentDays = attendSummary.days.filter(d => d.working_hours > 0).length;
              const totalDaysSoFar = attendSummary.days.length;
              attendancePercentage = Math.round((presentDays / totalDaysSoFar) * 100);
            }
          }
        } catch (e) {
          console.error("Error recalibrating attendance rate:", e);
          // Fallback to capping at 100 if the re-calculation fails
          if (attendancePercentage > 100) attendancePercentage = 100;
        }

        setStats({
          ...dashboardData,
          tasksAssigned,
          tasksCompleted,
          tasksPending,
          attendancePercentage,
        });

        // Sort tasks to show latest first (use task_id as ID field name in raw data)
        const sortedTasks = [...tasksData].sort((a, b) => {
          const idA = a.id || a.task_id || 0;
          const idB = b.id || b.task_id || 0;
          return Number(idB) - Number(idA);
        });
        setMyTasks(sortedTasks);

        // --- Fetch & Build Recent Activities (for Today) ---
        const today = todayIST(); // YYYY-MM-DD
        const activities: ActivityItem[] = [];

        // 1. Attendance
        try {
          // We try to get today's attendance record
          // We can reuse getAttendanceRecords or maybe getAttendanceStatus is better/faster
          const attendanceResp = await apiService.getAttendanceRecords({ date: today });
          let todayRecord: any = null;

          if (Array.isArray(attendanceResp)) {
            todayRecord = attendanceResp.find((r: any) => r.date === today || (r.check_in && r.check_in.startsWith(today)));
          } else if (attendanceResp?.data && Array.isArray(attendanceResp.data)) {
            todayRecord = attendanceResp.data.find((r: any) => r.date === today || (r.check_in && r.check_in.startsWith(today)));
          }

          if (todayRecord) {
            // Check In
            if (todayRecord.check_in) {
              const checkInTime = new Date(todayRecord.check_in);
              activities.push({
                id: `check-in-${todayRecord.id}`,
                action: 'Checked In',
                description: 'Marked attendance',
                time: formatIST(checkInTime, 'hh:mm a'),
                type: 'info',
                timestamp: checkInTime.getTime()
              });
            }
            // Check Out
            if (todayRecord.check_out) {
              const checkOutTime = new Date(todayRecord.check_out);
              activities.push({
                id: `check-out-${todayRecord.id}`,
                action: 'Checked Out',
                description: 'Marked attendance',
                time: formatIST(checkOutTime, 'hh:mm a'),
                type: 'info',
                timestamp: checkOutTime.getTime()
              });
            }
          }
        } catch (e) {
          console.error("Error fetching attendance activity", e);
        }

        // 2. Tasks (Updated or Created Today)
        try {
          // Filter tasks where updated_at or created_at is today
          // Note: tasksData is already fetched
          const todaysTasks = tasksData.filter((t: any) => {
            const updated = t.updated_at ? t.updated_at.split('T')[0] : '';
            const created = t.created_at ? t.created_at.split('T')[0] : '';
            return updated === today || created === today;
          });

          todaysTasks.forEach((t: any) => {
            const isCreatedToday = t.created_at && t.created_at.startsWith(today);
            const isUpdatedToday = t.updated_at && t.updated_at.startsWith(today);

            // Time to display
            const rawTime = isUpdatedToday ? t.updated_at : t.created_at;
            const timeObj = rawTime ? new Date(rawTime) : new Date();
            const timeStr = formatIST(timeObj, 'hh:mm a');

            if (isCreatedToday) {
              activities.push({
                id: `task-new-${t.id}`,
                action: 'New Task Assigned',
                description: t.title,
                time: timeStr,
                type: 'warning',
                timestamp: timeObj.getTime()
              });
            } else if (isUpdatedToday && (t.status === 'completed' || t.status === 'Completed')) {
              activities.push({
                id: `task-comp-${t.id}`,
                action: 'Task Completed',
                description: t.title,
                time: timeStr,
                type: 'success',
                timestamp: timeObj.getTime()
              });
            } else if (isUpdatedToday) {
              activities.push({
                id: `task-upd-${t.id}`,
                action: 'Task Updated',
                description: `${t.title} - ${t.status}`,
                time: timeStr,
                type: 'info',
                timestamp: timeObj.getTime()
              });
            }
          });
        } catch (e) {
          console.error("Error processing task activity", e);
        }

        // 3. Leaves (Applied Today)
        try {
          const empId = (user as any)?.employee_id || (user as any)?.employeeId || user?.id;
          if (empId) {
            const leaves = await apiService.getLeaveRequestsByEmployee(String(empId));
            // Filter for leaves applied today (created_at)
            const todaysLeaves = leaves.filter((l: any) => l.created_at && l.created_at.startsWith(today));

            todaysLeaves.forEach((l: any) => {
              const timeObj = new Date(l.created_at);
              activities.push({
                id: `leave-${l.id}`,
                action: 'Leave Request',
                description: `Applied for ${l.leave_type}`,
                time: formatIST(timeObj, 'hh:mm a'),
                type: 'warning',
                timestamp: timeObj.getTime()
              });
            });
          }
        } catch (e) {
          console.error("Error fetching leave activity", e);
        }

        // 4. Interviews (Scheduled for Today)
        try {
          const empId = user?.id;
          if (empId) {
            // Convert to number for API compatibility
            const memberId = typeof empId === 'string' ? parseInt(empId) : empId;

            // Using a simple check to see if we have interview records
            const data = await apiService.getInterviews({ panel_member_id: memberId });
            const interviews = Array.isArray(data) ? data : (data?.interviews || []);

            // Filter for interviews today
            const todaysInterviews = interviews.filter((i: any) =>
              i.start_time && i.start_time.startsWith(today)
            );

            todaysInterviews.forEach((i: any) => {
              const timeObj = new Date(i.start_time);
              activities.push({
                id: `interview-${i.id || i.interview_id}`,
                action: 'Interview Schedule',
                description: `${i.candidate_name || 'Candidate'} - ${i.round_type || 'Technical'}`,
                time: formatIST(timeObj, 'hh:mm a'),
                type: 'info',
                timestamp: timeObj.getTime()
              });
            });
          }
        } catch (e) {
          console.error("Error fetching interview activity", e);
        }

        // Sort by timestamp descending
        activities.sort((a, b) => b.timestamp - a.timestamp);
        setRecentActivities(activities);

      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    };

    loadDashboard();
  }, []);

  const formatWorkHours = (hours: number) => {
    if (!hours || hours === 0) {
      return '0 hrs - 0 mins';
    }

    const parsed = Number(hours);
    if (Number.isNaN(parsed)) return '0 hrs - 0 mins';

    const totalHours = Math.floor(parsed);
    const minutes = Math.round((parsed - totalHours) * 60);

    if (totalHours === 0 && minutes === 0) {
      return '0 hrs - 0 mins';
    } else if (totalHours === 0) {
      return `0 hrs - ${minutes} mins`;
    } else if (minutes === 0) {
      return `${totalHours} hrs - 0 mins`;
    } else {
      return `${totalHours} hrs - ${minutes} mins`;
    }
  };






  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-md mt-1 mb-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-200 dark:shadow-none">
            <Award className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#000000' }}>
              {t.common.welcome}, <span style={{ color: '#E11D48' }}>{user?.name}!</span>
            </h1>
            <p className="font-medium flex items-center gap-2 mt-1 text-sm" style={{ color: '#000000' }}>
              <CalendarDays className="h-4 w-4" style={{ color: '#000000' }} />
              {formatIST(nowIST(), 'EEEE, MMMM dd, yyyy | hh:mm a')}
            </p>
          </div>
        </div>

        <div className="relative flex gap-3">
          <Button
            onClick={() => navigate('/employee/attendance')}
            size="lg"
            className="rounded-xl px-6 h-12 bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 dark:shadow-none transition-all active:scale-95 gap-2"
          >
            <Clock className="h-4 w-4" />
            {t.dashboard.markAttendance}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="border-2 border-[#000000] p-4 rounded-2xl bg-white/50 mb-8 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: t.dashboard.myTasks,
              value: stats.tasksAssigned,
              icon: ClipboardList,
              iconColor: 'text-indigo-600',
              iconBg: 'bg-indigo-50',
              path: '/employee/tasks'
            },
            {
              label: t.dashboard.attendanceRate,
              value: `${stats.attendancePercentage}%`,
              icon: Target,
              iconColor: 'text-emerald-600',
              iconBg: 'bg-emerald-50',
              path: '/employee/attendance'
            },
            {
              label: t.dashboard.leavesAvailable,
              value: leaveBalance.annual.remaining,
              icon: CalendarDays,
              iconColor: 'text-cyan-600',
              iconBg: 'bg-cyan-50',
              path: '/employee/leaves'
            },
            {
              label: t.dashboard.workHoursThisMonth,
              value: formatWorkHours(stats.currentMonthHours),
              icon: Clock,
              iconColor: 'text-rose-600',
              iconBg: 'bg-rose-50',
              path: undefined
            }
          ].map((item, i) => (
            <SummaryCard
              key={i}
              title={item.label}
              value={item.value}
              icon={item.icon}
              iconColor={item.iconColor}
              iconBg={item.iconBg}
              onClick={() => item.path && navigate(item.path)}
            />
          ))}

        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* My Tasks */}
        <Card className="lg:col-span-3 border-2 border-[#000000] shadow-xl bg-white rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: '#000000' }}>{t.dashboard.myTasks}</h3>
                  <p className="text-[14px] font-normal" style={{ color: '#000000' }}>{t.dashboard.currentAssignments}</p>
                </div>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/employee/tasks')}
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
              >
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {myTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="bg-gray-50 dark:bg-gray-800/50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-8 w-8 text-gray-400" />
                  </div>
                  <p style={{ color: '#000000' }}>No tasks assigned yet!</p>
                </div>
              ) : (
                myTasks.slice(0, 5).map((task, index) => {
                  const status = (task.status || 'todo').toLowerCase();
                  const isCompleted = status === 'completed';
                  const isCancelled = status === 'cancelled';
                  const isInProgress = status === 'in-progress' || status === 'inprogress';

                  // Date logic
                  const today = todayIST();
                  const rawDueDate = task.dueDate || task.due_date;
                  const dueDate = rawDueDate ? rawDueDate.split('T')[0] : null;
                  const isDueToday = dueDate === today;
                  const isOverdue = dueDate && dueDate < today && !isCompleted && !isCancelled;

                  const getStatusBadge = () => {
                    if (isCompleted) return (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 gap-1.5 pl-1.5 pr-2.5 py-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Completed
                      </Badge>
                    );
                    if (isCancelled) return (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 gap-1.5 pl-1.5 pr-2.5 py-0.5">
                        <XCircle className="h-3.5 w-3.5" />
                        Cancelled
                      </Badge>
                    );
                    if (isInProgress) return (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 gap-1.5 pl-1.5 pr-2.5 py-0.5">
                        <Activity className="h-3.5 w-3.5 animate-pulse" />
                        In Progress
                      </Badge>
                    );
                    if (isOverdue) return (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 gap-1.5 pl-1.5 pr-2.5 py-0.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Overdue
                      </Badge>
                    );
                    return (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 gap-1.5 pl-1.5 pr-2.5 py-0.5">
                        <Circle className="h-3.5 w-3.5" />
                        To Do
                      </Badge>
                    );
                  };

                  const getPriorityColor = (p: string) => {
                    switch (p?.toLowerCase()) {
                      case 'urgent': return 'text-red-600 border-red-200';
                      case 'high': return 'text-yellow-600 border-yellow-200';
                      case 'medium': return 'text-blue-600 border-blue-200';
                      case 'low': return 'text-green-600 border-green-200';
                      default: return 'text-green-600 border-green-200';
                    }
                  };

                  return (
                    <div key={task.id ?? `task-${index}`} className="p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                      <div className="flex items-start gap-4">
                        {/* Status Icon/Indicator */}
                        <div className={cn(
                          "mt-1 h-3 w-3 rounded-full flex-shrink-0",
                          isCompleted ? "bg-emerald-500 shadow-sm shadow-emerald-200" :
                            isCancelled ? "bg-red-500 shadow-sm shadow-red-200" :
                              isOverdue ? "bg-red-500 shadow-sm shadow-red-200 animate-pulse" :
                                isInProgress ? "bg-blue-500 shadow-sm shadow-blue-200 animate-pulse" :
                                  "bg-slate-300 dark:bg-slate-600"
                        )} />

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <TruncatedText
                                text={task.title}
                                maxLength={35}
                                showToggle={false}
                                textClassName={cn(
                                  "font-bold text-sm",
                                  !isCompleted && "text-black",
                                  isCompleted && "text-muted-foreground line-through decoration-slate-400"
                                )}
                                style={!isCompleted ? { color: '#000000' } : undefined}
                              />
                              <div className="mt-1">
                                <TruncatedText
                                  text={task.description}
                                  maxLength={60}
                                  showToggle={false}
                                  textClassName="text-xs"
                                  style={{ color: '#000000' }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {getStatusBadge()}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                            {/* Priority */}
                            <span className={cn(
                              "text-[12px] font-medium uppercase tracking-wider border-0",
                              getPriorityColor(task.priority)
                            )}>
                              {task.priority || 'Normal'}
                            </span>

                            {/* Due Date Info */}
                            <div className={cn(
                              "flex items-center gap-1.5 font-medium",
                              isOverdue ? "text-red-600 dark:text-red-500" : "text-emerald-600 dark:text-emerald-500"
                            )}>
                              {isDueToday || isOverdue ? (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              ) : (
                                <Calendar className="h-3.5 w-3.5" />
                              )}
                              <span>
                                {isDueToday ? "Due Today" :
                                  isOverdue && dueDate ? `Deadline: ${formatIST(dueDate, 'MMM dd, yyyy')}` :
                                    dueDate ? `Deadline: ${formatIST(dueDate, 'MMM dd, yyyy')}` :
                                      "No Deadline"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
          {myTasks.length > 5 && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 rounded-b-xl">
              <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:text-indigo-600" onClick={() => navigate('/employee/tasks')}>
                View {myTasks.length - 5} more tasks
              </Button>
            </div>
          )}
        </Card>

        {/* Recent Activities */}
        <Card className="lg:col-span-3 border-2 border-[#000000] shadow-xl bg-white rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <CardTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <span className="text-[16px] font-bold" style={{ color: '#000000' }}>{t.dashboard.recentActivity}</span>
            </CardTitle>
            <CardDescription className="text-[14px]" style={{ color: '#000000' }}>{t.dashboard.recentUpdates}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.length === 0 ? (
              <div className="p-6 text-center" style={{ color: '#000000' }}>
                <p className="text-sm">No activity recorded today</p>
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${activity.type === 'success' ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
                    activity.type === 'warning' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                      'bg-gradient-to-br from-blue-400 to-indigo-500'
                    }`}>
                    {activity.type === 'success' && <CheckCircle2 className="h-5 w-5 text-white" />}
                    {activity.type === 'warning' && <AlertCircle className="h-5 w-5 text-white" />}
                    {activity.type === 'info' && <Activity className="h-5 w-5 text-white" />}
                    {activity.type === 'error' && <XCircle className="h-5 w-5 text-white" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-bold" style={{ color: '#000000' }}>{activity.action}</p>
                    <div className="text-xs" style={{ color: '#000000' }}>
                      <TruncatedText
                        text={activity.description}
                        maxLength={50}
                        showToggle={false}
                      />
                    </div>
                    <p className="text-[12px]" style={{ color: '#000000' }}>{activity.time}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default EmployeeDashboard;
