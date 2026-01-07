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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatIST, nowIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';

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

  const [myTasks, setMyTasks] = useState<any[]>([]);

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

        setStats({
          ...dashboardData,
          tasksAssigned,
          tasksCompleted,
          tasksPending,
        });
        setMyTasks(tasksData);
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



  const recentActivities = [
    { id: 1, action: 'Completed task', description: 'Code Review - PR #234', time: '1 hour ago', type: 'success' },
    { id: 2, action: 'Checked in', description: 'On time at 09:00 AM', time: '3 hours ago', type: 'info' },
    { id: 3, action: 'Leave approved', description: 'Casual leave on 15th Oct', time: 'Yesterday', type: 'success' },
    { id: 4, action: 'New task assigned', description: 'Bug Fix - Login Issue', time: '2 days ago', type: 'warning' },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-rose-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-pink-500/5 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-200 dark:shadow-none">
            <Award className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              {t.common.welcome}, <span className="text-rose-600">{user?.name}!</span>
            </h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <CalendarDays className="h-4 w-4 text-rose-500" />
              {formatIST(nowIST(), 'EEEE, MMMM dd, yyyy')}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: t.dashboard.myTasks,
            value: stats.tasksAssigned,
            sub: `${stats.tasksCompleted} Completed`,
            icon: ClipboardList,
            color: 'indigo',
            bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
            cardBg: 'bg-indigo-50/40 dark:bg-indigo-950/10',
            borderColor: 'border-indigo-300/80 dark:border-indigo-700/50',
            hoverBorder: 'group-hover:border-indigo-500 dark:group-hover:border-indigo-400',
            path: '/employee/tasks'
          },
          {
            label: t.dashboard.attendanceRate,
            value: `${stats.attendancePercentage}%`,
            sub: 'Monthly Performance',
            icon: Target,
            color: 'emerald',
            bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
            cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
            borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
            hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400',
            path: '/employee/attendance'
          },
          {
            label: t.dashboard.leavesAvailable,
            value: leaveBalance.annual.remaining,
            sub: `${leaveBalance.annual.used} Used This Year`,
            icon: CalendarDays,
            color: 'cyan',
            bg: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400',
            cardBg: 'bg-cyan-50/40 dark:bg-cyan-950/10',
            borderColor: 'border-cyan-300/80 dark:border-cyan-700/50',
            hoverBorder: 'group-hover:border-cyan-500 dark:group-hover:border-cyan-400',
            path: '/employee/leaves'
          },
          {
            label: t.dashboard.workHoursThisMonth,
            value: formatWorkHours(stats.currentMonthHours),
            sub: 'On Track',
            icon: Clock,
            color: 'rose',
            bg: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
            cardBg: 'bg-rose-50/40 dark:bg-rose-950/10',
            borderColor: 'border-rose-300/80 dark:border-rose-700/50',
            hoverBorder: 'group-hover:border-rose-500 dark:group-hover:border-rose-400',
            isMono: true
          }
        ].map((item, i) => (
          <Card
            key={i}
            className={`border-2 ${item.borderColor} ${item.hoverBorder} shadow-sm ${item.cardBg} backdrop-blur-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative ${item.path ? 'cursor-pointer' : ''}`}
            onClick={() => item.path && navigate(item.path)}
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
                <div className={`text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight ${item.isMono ? 'font-mono' : ''}`}>{item.value}</div>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/50 dark:bg-gray-900/30 border border-black/5 dark:border-white/5">
                  <div className={`h-1.5 w-1.5 rounded-full ${item.color === 'indigo' ? 'bg-indigo-500' :
                    item.color === 'emerald' ? 'bg-emerald-500' :
                      item.color === 'cyan' ? 'bg-cyan-500' :
                        'bg-rose-500'
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
        {/* My Tasks */}
        <Card className="lg:col-span-2 border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              {t.dashboard.myTasks}
            </CardTitle>
            <CardDescription className="text-base">{t.dashboard.currentAssignments}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {myTasks.map((task, index) => (
              <div key={task.id ?? `task-${index}`} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{task.title}</p>
                      <Badge
                        variant={
                          task.priority === 'urgent' ? 'destructive' :
                            task.priority === 'high' ? 'default' :
                              'secondary'
                        }
                        className="text-xs"
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.dashboard.due}: {task.dueDate}</p>
                  </div>
                  <Badge
                    variant={
                      task.status === 'completed' ? 'default' :
                        task.status === 'in-progress' ? 'outline' :
                          'secondary'
                    }
                  >
                    {task.status}
                  </Badge>
                </div>
                {task.status !== 'completed' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t.task.progress}</span>
                      <span className="font-medium">{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-1" />
                  </div>
                )}
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => navigate('/employee/tasks')}>
              {t.dashboard.viewAllTasks}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              {t.dashboard.recentActivity}
            </CardTitle>
            <CardDescription className="text-base">{t.dashboard.recentUpdates}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${activity.type === 'success' ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
                  activity.type === 'warning' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                    'bg-gradient-to-br from-blue-400 to-indigo-500'
                  }`}>
                  {activity.type === 'success' && <CheckCircle2 className="h-5 w-5 text-white" />}
                  {activity.type === 'warning' && <AlertCircle className="h-5 w-5 text-white" />}
                  {activity.type === 'info' && <Activity className="h-5 w-5 text-white" />}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default EmployeeDashboard;