import React from 'react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import {
  Users,
  UserPlus,
  Clock,
  CalendarDays,
  ClipboardList,

  Building,
  AlertCircle,
  ChevronRight,
  Activity,
  Target,
  Award,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatIST, formatDateTimeIST, formatTimeIST, todayIST, parseToIST, nowIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';

const AdminDashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    lateArrivals: 0,
    pendingLeaves: 0,
    activeTasks: 0,
    completedTasks: 0,
    departments: 0,
  });
  const [departmentPerformance, setDepartmentPerformance] = useState<{ name: string; employees: number; performance: number; }[]>([]);
  const [recentActivities, setRecentActivities] = useState<{ id: number; type: string; user: string; time: string; status: string; }[]>([]);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const ACTIVITIES_PER_PAGE = 15;

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await apiService.getAdminDashboard();

        // If activeTasks is 0, try to get actual count from tasks API
        let activeTasks = data.activeTasks || 0;
        let pendingLeaves = data.pendingLeaves || 0;

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
          ...data,
          activeTasks,
          pendingLeaves,
        });
        setDepartmentPerformance(data.departmentPerformance || []);
        setRecentActivities(data.recentActivities || []);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    };

    loadDashboard();
  }, []);

  const formatActivityTime = (timeString: string) => {
    if (!timeString) return '-';
    // Parse the ISO string and convert to IST, then format time only
    return formatTimeIST(timeString, 'hh:mm a');
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm mt-2">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl -z-10" />

        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center border-2 border-white shadow-lg group">
            <Award className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t.common.welcome}, <span className="text-indigo-600">Admin</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-0.5 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-indigo-400" />
              {formatIST(nowIST(), 'EEEE, MMMM dd, yyyy')}
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/admin/employees/new')}
          className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all text-sm font-bold"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          {t.employee.addEmployee}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: t.dashboard.totalEmployees,
            value: stats.totalEmployees,
            icon: Users,
            color: 'blue',
            bgColor: 'bg-blue-50/60',
            borderColor: 'border-blue-100',
            iconColor: 'text-blue-600',
            path: '/admin/employees',
          },
          {
            title: t.dashboard.presentToday,
            value: stats.presentToday,
            icon: Clock,
            color: 'emerald',
            bgColor: 'bg-emerald-50/60',
            borderColor: 'border-emerald-100',
            iconColor: 'text-emerald-600',
            path: '/admin/attendance',
          },
          {
            title: t.dashboard.pendingApprovals,
            value: stats.pendingLeaves,
            icon: AlertCircle,
            color: 'amber',
            bgColor: 'bg-amber-50/60',
            borderColor: 'border-amber-100',
            iconColor: 'text-amber-600',
            path: '/admin/leaves',
          },
          {
            title: t.dashboard.activeTasks,
            value: stats.activeTasks,
            icon: ClipboardList,
            color: 'purple',
            bgColor: 'bg-purple-50/60',
            borderColor: 'border-purple-100',
            iconColor: 'text-purple-600',
            path: '/admin/tasks',
          },
        ].map((item, index) => (
          <Card
            key={index}
            className={`group relative overflow-hidden bg-white border-slate-100 border hover:shadow-lg hover:border-indigo-100 transition-all duration-300 cursor-pointer rounded-2xl active:scale-95`}
            onClick={() => navigate(item.path)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {item.title}
              </CardTitle>
              <div className={`h-10 w-10 rounded-xl ${item.bgColor} flex items-center justify-center border ${item.borderColor}`}>
                <item.icon className={`h-5 w-5 ${item.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">{item.value}</div>
              <div className={`flex items-center mt-2.5 ${item.iconColor} font-bold text-xs group-hover:translate-x-1 transition-all`}>
                <span>View Details</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Performance */}
        <Card className="lg:col-span-2 border-slate-100 border shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">
                    {t.dashboard.departmentPerformance}
                  </CardTitle>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-4 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
                onClick={() => navigate('/admin/reports?tab=department')}
              >
                VIEW ALL
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid gap-4">
              {departmentPerformance.map((dept) => (
                <div
                  key={dept.name}
                  className="group relative p-4 rounded-xl border border-slate-50 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all duration-300 cursor-pointer"
                  onClick={() => navigate('/admin/reports?tab=department')}
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                        <Target className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{dept.name}</p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {dept.employees} employees
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-slate-900">{dept.performance}%</p>
                      <Badge
                        className={`text-[9px] font-bold px-2 py-0 h-4 rounded-full border-0 ${dept.performance >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          dept.performance >= 60 ? 'bg-blue-100 text-blue-700' :
                            dept.performance >= 40 ? 'bg-amber-100 text-amber-700' :
                              'bg-rose-100 text-rose-700'
                          }`}
                      >
                        {dept.performance >= 80 ? 'EXCELLENT' :
                          dept.performance >= 60 ? 'GOOD' :
                            dept.performance >= 40 ? 'AVERAGE' :
                              'POOR'}
                      </Badge>
                    </div>
                  </div>
                  <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${dept.performance >= 80 ? 'bg-emerald-500' :
                        dept.performance >= 60 ? 'bg-blue-500' :
                          dept.performance >= 40 ? 'bg-amber-500' :
                            'bg-rose-500'
                        }`}
                      style={{ width: `${dept.performance}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="border-slate-100 border shadow-sm bg-white rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
                <Activity className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-900">
                {t.dashboard.recentActivities}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col">
            {recentActivities.length > 0 ? (
              <div className="flex flex-col flex-1">
                <div className="space-y-5 flex-1">
                  {recentActivities
                    .slice((activitiesPage - 1) * ACTIVITIES_PER_PAGE, activitiesPage * ACTIVITIES_PER_PAGE)
                    .map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-all duration-300 border border-transparent hover:border-slate-100">
                        <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${activity.type === 'check-in' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                          activity.type === 'leave' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                            'bg-blue-50 border-blue-100 text-blue-600'
                          }`}>
                          {activity.type === 'check-in' && <Clock className="h-5 w-5" />}
                          {activity.type === 'leave' && <CalendarDays className="h-5 w-5" />}
                          {activity.type === 'task' && <ClipboardList className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate uppercase">{activity.user}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {activity.type === 'check-in' && 'Checked in'}
                            {activity.type === 'leave' && 'Applied for leave'}
                            {activity.type === 'task' && 'Completed task'}
                          </p>
                          <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1">
                            {formatActivityTime(activity.time)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          {activity.type === 'check-in' && (
                            <Badge
                              className={`text-[9px] font-bold px-2 py-0 h-4 rounded-full border-0 ${(getCorrectAttendanceStatus(activity) === 'on-time' || getCorrectAttendanceStatus(activity) === 'on_time') ? 'bg-emerald-100 text-emerald-700' :
                                getCorrectAttendanceStatus(activity) === 'late' ? 'bg-rose-100 text-rose-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}
                            >
                              {(getCorrectAttendanceStatus(activity) === 'on-time' || getCorrectAttendanceStatus(activity) === 'on_time') ? 'ON TIME' :
                                getCorrectAttendanceStatus(activity).toUpperCase()}
                            </Badge>
                          )}
                          {activity.type !== 'check-in' && (
                            <Badge className="text-[9px] font-bold px-2 py-0 h-4 rounded-full bg-slate-100 text-slate-600 border-0">
                              {activity.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {recentActivities.length > ACTIVITIES_PER_PAGE && (
                  <div className="mt-10 pt-8 border-t-2 border-slate-50 flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-black tracking-widest uppercase">
                      Page {activitiesPage} <span className="text-slate-300 mx-2">/</span> {Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE)}
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setActivitiesPage(p => Math.max(1, p - 1))}
                        disabled={activitiesPage === 1}
                        className="h-11 w-11 rounded-[1rem] border-2 border-slate-100 hover:bg-slate-50 transition-all active:scale-90"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setActivitiesPage(p => Math.min(Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE), p + 1))}
                        disabled={activitiesPage === Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE)}
                        className="h-11 w-11 rounded-[1rem] border-2 border-slate-100 hover:bg-slate-50 transition-all active:scale-90"
                      >
                        <ChevronRightIcon className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-slate-300 py-16">
                <div className="h-20 w-20 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-6">
                  <Activity className="h-10 w-10 opacity-20" />
                </div>
                <p className="text-lg font-bold">{t.dashboard.noRecentActivities}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;