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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-700 to-purple-800 text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Award className="h-7 w-7 text-white" />
            </div>
            {t.common.welcome}, {user?.name}!
          </h1>
          <p className="text-rose-100 mt-2 ml-15">
            {formatIST(nowIST(), 'EEEE, MMMM dd, yyyy')}
          </p>
        </div>
        <Button onClick={() => navigate('/employee/attendance')} className="gap-2 bg-white text-rose-700 hover:bg-rose-50">
          <Clock className="h-4 w-4" />
          {t.dashboard.markAttendance}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover border-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-indigo-50">
              {t.dashboard.myTasks}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.tasksAssigned}</div>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-100" />
              <span className="text-sm text-indigo-100">{stats.tasksCompleted} completed</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-50">
              {t.dashboard.attendanceRate}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Target className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.attendancePercentage}%</div>
            <Progress value={stats.attendancePercentage} className="mt-2 h-2 bg-white/30" />
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyan-50">
              {t.dashboard.leavesAvailable}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{leaveBalance.annual.remaining}</div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-sm text-cyan-100">{leaveBalance.annual.used} {t.dashboard.usedThisYear}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-rose-50">
              {t.dashboard.workHoursThisMonth}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatWorkHours(stats.currentMonthHours)}</div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-4 w-4 text-rose-100" />
              <span className="text-sm text-rose-100">{t.dashboard.onTrack}</span>
            </div>
          </CardContent>
        </Card>
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
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  activity.type === 'success' ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.quickActions}</CardTitle>
          <CardDescription>{t.dashboard.frequentlyUsed}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/employee/attendance')}>
              <Clock className="h-5 w-5" />
              <span className="text-xs">{t.navigation.attendance}</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/employee/leaves')}>
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs">{t.dashboard.applyLeave}</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/employee/tasks')}>
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs">{t.dashboard.myTasks}</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/employee/profile')}>
              <Award className="h-5 w-5" />
              <span className="text-xs">{t.dashboard.myProfile}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDashboard;