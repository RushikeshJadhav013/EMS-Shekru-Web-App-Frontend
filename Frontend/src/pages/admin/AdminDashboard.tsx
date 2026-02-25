import React from 'react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserPlus,
  Clock,
  CalendarDays,
  ClipboardList,
  Building,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Activity,
  Target,
  Award,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatIST, formatDateTimeIST, formatTimeIST, todayIST, parseToIST, nowIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';

const CORE_DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'HR',
  'Human Resources',
  'Finance',
  'Operations',
  'Legal',
  'Customer Support',
  'IT',
  'Administration',
  'Management'
];

const AdminDashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
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
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const ACTIVITIES_PER_PAGE = 10;

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

        // Fetch detailed department metrics for performance
        try {
          const now = nowIST();
          const metricsData = await apiService.getDepartmentMetrics({
            month: now.getMonth(),
            year: now.getFullYear()
          });

          if (metricsData && metricsData.departments && Array.isArray(metricsData.departments)) {
            const formattedPerformance = metricsData.departments
              .filter((dept: any) => {
                const deptName = dept.department || '';
                return CORE_DEPARTMENTS.some(core => core.toLowerCase() === deptName.toLowerCase());
              })
              .map((dept: any) => ({
                name: dept.department,
                employees: dept.totalEmployees,
                performance: dept.performanceScore || 0
              }));

            // Sort by performance (descending)
            formattedPerformance.sort((a: any, b: any) => b.performance - a.performance);

            setDepartmentPerformance(formattedPerformance);
          } else {
            // Fallback to dashboard data if metrics fail
            const fallbackDepts = (data.departmentPerformance || []).filter((dept: any) => {
              const deptName = dept.name || '';
              return CORE_DEPARTMENTS.some(core => core.toLowerCase() === deptName.toLowerCase());
            });
            setDepartmentPerformance(fallbackDepts);
          }
        } catch (metricsError) {
          console.error('Failed to load department metrics:', metricsError);
          const fallbackDepts = (data.departmentPerformance || []).filter((dept: any) => {
            const deptName = dept.name || '';
            return CORE_DEPARTMENTS.some(core => core.toLowerCase() === deptName.toLowerCase());
          });
          setDepartmentPerformance(fallbackDepts);
        }

        // Enhanced Recent Activities Logic - Strictly Today
        const todayDateStr = todayIST(); // YYYY-MM-DD

        // 1. Filter dashboard activities for today only
        let activities = (data.recentActivities || []).filter((a: any) => {
          if (!a.time) return false;
          // Avoid duplicate check-ins/outs as we fetch fresh ones next
          if (a.type === 'check-in' || a.type === 'check-out') return false;

          const activityDateStr = a.time.split('T')[0];
          return activityDateStr === todayDateStr;
        });

        // 2. Fetch fresh attendance records for today to get accurate check-in AND check-out
        try {
          const attendanceData = await apiService.getAttendanceRecords({ date: todayDateStr });

          const attendanceActivities: any[] = [];

          if (Array.isArray(attendanceData)) {
            attendanceData.forEach((rec: any) => {
              const userName = rec.userName || rec.user?.name || rec.name || 'Unknown User';
              const recId = rec.id || rec.attendance_id;

              const checkInTime = rec.check_in || rec.checkInTime;
              const checkOutTime = rec.check_out || rec.checkOutTime;

              // Add Check-In Activity
              if (checkInTime && checkInTime.split('T')[0] === todayDateStr) {
                attendanceActivities.push({
                  id: `in-${recId}`,
                  type: 'check-in',
                  user: userName,
                  time: checkInTime,
                  status: rec.status || 'present',
                  checkInStatus: rec.checkInStatus || rec.check_in_status,
                });
              }

              // Add Check-Out Activity
              if (checkOutTime && checkOutTime.split('T')[0] === todayDateStr) {
                attendanceActivities.push({
                  id: `out-${recId}`,
                  type: 'check-out',
                  user: userName,
                  time: checkOutTime,
                  status: 'checked_out',
                  checkOutStatus: rec.checkOutStatus || rec.check_out_status,
                });
              }
            });
          }

          // Merge and Sort
          activities = [...activities, ...attendanceActivities];
          activities.sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime());

        } catch (attError) {
          console.error("Failed to fetch fresh attendance for activities", attError);
        }

        setRecentActivities(activities);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    };

    loadDashboard();
  }, []);

  const formatActivityTime = (timeString: string) => {
    if (!timeString) return '-';
    // Parse the ISO string and convert to IST, then format date and time
    // Using formatTimeIST but with a custom format string to include the date
    return formatTimeIST(timeString, 'dd-MM-yyyy hh:mm a');
  };

  // Helper: Format status and color
  const getStatusConfig = (activity: any) => {
    if (activity.type === 'check-in') {
      let isLate = false;
      if (activity.checkInStatus) {
        isLate = activity.checkInStatus.toLowerCase() === 'late';
      } else if (activity.time) {
        try {
          const d = new Date(activity.time);
          // Default Late if after 10:15
          isLate = (d.getHours() * 60 + d.getMinutes()) > (10 * 60 + 15);
        } catch (e) { isLate = false; }
      }

      if (isLate) {
        return { label: 'LATE', className: 'bg-rose-50 text-rose-600 border-rose-100' };
      }
      return { label: 'ON TIME', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    }

    if (activity.type === 'check-out') {
      let isEarly = false;
      if (activity.checkOutStatus) {
        isEarly = activity.checkOutStatus.toLowerCase() === 'early';
      } else if (activity.time) {
        try {
          const d = new Date(activity.time);
          // Default Early if before 19:00 (7 PM)
          isEarly = (d.getHours() * 60 + d.getMinutes()) < (19 * 60);
        } catch (e) { isEarly = false; }
      }

      if (isEarly) {
        return { label: 'EARLY', className: 'bg-amber-50 text-amber-600 border-amber-100' };
      }
      return { label: 'ON TIME', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    }

    return { label: (activity.status || '').toUpperCase(), className: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  const formatName = (name: string) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-white to-blue-50/30 border border-blue-100/50 shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-blue-100/20 rounded-full blur-3xl -z-10" />

        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-100/50 flex items-center justify-center border border-blue-200/50 shadow-sm group transition-all duration-300 hover:scale-110">
            <Award className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {t.common.welcome}, <span className="text-blue-600">{user?.name}</span>
            </h1>
            <p className="text-slate-500 font-bold text-[13px] mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
              {formatIST(nowIST(), 'EEEE, MMMM dd, yyyy')}
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/admin/employees/new/')}
          className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/50 transition-all duration-300 hover:-translate-y-0.5 text-[13px] font-bold gap-2"
        >
          <UserPlus className="h-4 w-4" />
          {t.employee.addEmployee}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: t.dashboard.totalEmployees,
            value: stats.totalEmployees,
            icon: Users,
            color: 'blue',
            bgColor: 'bg-blue-50/50',
            cardBg: 'bg-blue-50/20 hover:bg-blue-50/40',
            borderColor: 'border-blue-300 dark:border-blue-700/50',
            hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-400',
            iconColor: 'text-blue-600',
            path: '/admin/employees',
          },
          {
            title: t.dashboard.presentToday,
            value: stats.presentToday,
            icon: Clock,
            color: 'emerald',
            bgColor: 'bg-emerald-50/50',
            cardBg: 'bg-emerald-50/20 hover:bg-emerald-50/40',
            borderColor: 'border-emerald-300 dark:border-emerald-700/50',
            hoverBorder: 'hover:border-emerald-500 dark:hover:border-emerald-400',
            iconColor: 'text-emerald-600',
            path: '/admin/attendance',
          },
          {
            title: t.dashboard.pendingApprovals,
            value: stats.pendingLeaves,
            icon: AlertCircle,
            color: 'amber',
            bgColor: 'bg-amber-50/50',
            cardBg: 'bg-amber-50/20 hover:bg-amber-50/40',
            borderColor: 'border-amber-300 dark:border-amber-700/50',
            hoverBorder: 'hover:border-amber-500 dark:hover:border-amber-400',
            iconColor: 'text-amber-600',
            path: '/admin/leaves',
          },
          {
            title: t.dashboard.activeTasks,
            value: stats.activeTasks,
            icon: ClipboardList,
            color: 'purple',
            bgColor: 'bg-purple-50/50',
            cardBg: 'bg-purple-50/20 hover:bg-purple-50/40',
            borderColor: 'border-purple-300 dark:border-purple-700/50',
            hoverBorder: 'hover:border-purple-500 dark:hover:border-purple-400',
            iconColor: 'text-purple-600',
            path: '/admin/tasks',
          },
        ].map((item, index) => (
          <Card
            key={index}
            className={`group relative overflow-hidden ${item.cardBg} border-2 ${item.borderColor} ${item.hoverBorder} shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer rounded-xl`}
            onClick={() => navigate(item.path)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
              <CardTitle className={`text-[11px] font-black text-${item.color}-900/60 uppercase tracking-widest leading-none`}>
                {item.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-lg ${item.bgColor} flex items-center justify-center border border-${item.color}-200/50 group-hover:scale-110 transition-transform duration-500`}>
                <item.icon className={`h-4 w-4 ${item.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-3xl font-black text-${item.color}-950 tracking-tight leading-none`}>{item.value}</div>
              <div className={`flex items-center mt-2.5 ${item.iconColor} font-black text-[10px] uppercase tracking-wider group-hover:translate-x-1 transition-all duration-300 opacity-80 group-hover:opacity-100`}>
                <span>View Details</span>
                <ChevronRight className="h-3 w-3 ml-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Performance */}
        <Card className="lg:col-span-2 border-slate-200/60 border shadow-sm bg-white rounded-xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-slate-50/30 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <Building className="h-4.5 w-4.5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    {t.dashboard.departmentPerformance}
                  </CardTitle>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 rounded-lg text-blue-600 hover:bg-blue-50 font-bold text-[11px]"
                onClick={() => navigate('/admin/reports?tab=department')}
              >
                VIEW ALL
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1">
            <div className="grid gap-3">
              {departmentPerformance.map((dept) => (
                <div
                  key={dept.name}
                  className="group relative p-3.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all duration-300 cursor-pointer"
                  onClick={() => navigate('/admin/reports?tab=department')}
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                        <Target className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-[13px] leading-tight">{dept.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                          <Users className="h-2.5 w-2.5 text-slate-400" />
                          <span className="text-blue-600 font-black">{dept.employees}</span>
                          <span className="text-slate-400 font-bold uppercase tracking-tighter">Employees</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-base text-slate-900">{dept.performance}%</p>
                      {(() => {
                        const perf = Number(dept.performance);
                        let statusColor = 'bg-rose-50 text-rose-600';
                        let statusText = 'POOR';

                        if (!isNaN(perf)) {
                          if (perf >= 80) {
                            statusColor = 'bg-emerald-50 text-emerald-600';
                            statusText = 'EXCELLENT';
                          } else if (perf >= 60) {
                            statusColor = 'bg-blue-50 text-blue-600';
                            statusText = 'GOOD';
                          } else if (perf >= 40) {
                            statusColor = 'bg-amber-50 text-amber-600';
                            statusText = 'AVERAGE';
                          }
                        }

                        return (
                          <Badge className={`text-[8px] font-bold px-1.5 h-3.5 rounded-full border-0 ${statusColor}`}>
                            {statusText}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${Number(dept.performance) >= 80 ? 'bg-emerald-500' :
                        Number(dept.performance) >= 60 ? 'bg-blue-500' :
                          Number(dept.performance) >= 40 ? 'bg-amber-500' :
                            'bg-rose-500'
                        }`}
                      style={{ width: `${Math.min(Math.max(Number(dept.performance) || 0, 0), 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="border-slate-200/60 border shadow-sm bg-white rounded-xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-slate-50/30 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <CardTitle className="text-sm font-bold text-slate-900">
                {t.dashboard.recentActivities}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col">
            {recentActivities.length > 0 ? (
              <div className="flex flex-col flex-1">
                <div className="space-y-4 flex-1">
                  {recentActivities
                    .slice((activitiesPage - 1) * ACTIVITIES_PER_PAGE, activitiesPage * ACTIVITIES_PER_PAGE)
                    .map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-100/50 transition-all duration-300 border border-transparent hover:border-slate-200/60">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${activity.type === 'check-in' ? 'bg-emerald-50/80 border-emerald-100/50 text-emerald-600 shadow-sm' :
                          activity.type === 'leave' ? 'bg-amber-50/80 border-amber-100/50 text-amber-600 shadow-sm' :
                            'bg-blue-50/80 border-blue-100/50 text-blue-600 shadow-sm'
                          }`}>
                          {activity.type === 'check-in' && <Clock className="h-4 w-4" />}
                          {activity.type === 'check-out' && <LogOut className="h-4 w-4" />}
                          {activity.type === 'leave' && <CalendarDays className="h-4 w-4" />}
                          {activity.type === 'task' && <ClipboardList className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-slate-900 truncate">{formatName(activity.user)}</p>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {activity.type === 'check-in' && 'Checked in'}
                            {activity.type === 'check-out' && 'Checked out'}
                            {activity.type === 'leave' && 'Applied for leave'}
                            {activity.type === 'task' && 'Completed task'}
                          </p>
                          <p className="text-[9px] text-blue-500 font-bold uppercase mt-1">
                            {formatActivityTime(activity.time)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          <Badge className={`text-[9px] font-bold px-2 py-0.5 h-4 rounded-full border ${getStatusConfig(activity).className}`}>
                            {getStatusConfig(activity).label}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>

                {recentActivities.length > ACTIVITIES_PER_PAGE && (
                  <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">
                      Pg {activitiesPage} <span className="text-slate-300 mx-1">/</span> {Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setActivitiesPage(p => Math.max(1, p - 1))}
                        disabled={activitiesPage === 1}
                        className="h-8 w-8 rounded-lg border-slate-200 hover:bg-slate-50 transition-all active:scale-90"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setActivitiesPage(p => Math.min(Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE), p + 1))}
                        disabled={activitiesPage === Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE)}
                        className="h-8 w-8 rounded-lg border-slate-200 hover:bg-slate-50 transition-all active:scale-90"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-slate-300 py-12">
                <div className="h-16 w-16 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                  <Activity className="h-8 w-8 opacity-20" />
                </div>
                <p className="text-[13px] font-bold">{t.dashboard.noRecentActivities}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;