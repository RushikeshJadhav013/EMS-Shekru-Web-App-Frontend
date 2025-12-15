import React from 'react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import {
  Users,
  UserPlus,
  Clock,
  CalendarDays,
  ClipboardList,
  TrendingUp,
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
  const [departmentPerformance, setDepartmentPerformance] = useState<{name: string; employees: number; performance: number;}[]>([]);
  const [recentActivities, setRecentActivities] = useState<{id: number; type: string; user: string; time: string; status: string;}[]>([]);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-700 to-purple-800 text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Award className="h-7 w-7 text-white" />
            </div>
            {t.common.welcome}, Admin!
          </h1>
          <p className="text-blue-100 mt-2 ml-15">
            {formatIST(nowIST(), 'EEEE, MMMM dd, yyyy')}
          </p>
        </div>
        <Button onClick={() => navigate('/admin/employees/new')} className="gap-2 bg-white text-blue-700 hover:bg-blue-50">
          <UserPlus className="h-4 w-4" />
          {t.employee.addEmployee}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/admin/employees')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-50">
              {t.dashboard.totalEmployees}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>   
            <div className="text-3xl font-bold">{stats.totalEmployees}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto mt-2 text-white hover:text-blue-100" 
              onClick={(e) => {
                e.stopPropagation();
                navigate('/admin/employees');
              }}
            >
              <span className="text-sm">View all</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/admin/attendance')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-50">
              {t.dashboard.presentToday}
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
                navigate('/admin/attendance');
              }}
            >
              <span className="text-sm">View all</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-50">
              {t.dashboard.pendingApprovals}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingLeaves}</div>
            <Button variant="link" className="p-0 h-auto mt-2 text-white hover:text-amber-100" onClick={() => navigate('/admin/leaves')}>
              <span className="text-sm">View all</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/admin/tasks')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-50">
              Active Tasks
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeTasks}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto mt-2 text-white hover:text-purple-100" 
              onClick={(e) => {
                e.stopPropagation();
                navigate('/admin/tasks');
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
        {/* Department Performance */}
        <Card className="lg:col-span-2 card-hover border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Building className="h-5 w-5 text-white" />
                  </div>
                  Department Performance
                </CardTitle>
                <CardDescription className="text-base">Performance metrics by department</CardDescription>
              </div>
              <Button 
                variant="link" 
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300" 
                onClick={() => navigate('/admin/reports?tab=department')}
              >
                <span className="text-sm font-medium">View all</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {departmentPerformance.map((dept) => (
              <div 
                key={dept.name} 
                className="space-y-2 p-3 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 transition-all cursor-pointer"
                onClick={() => navigate('/admin/reports?tab=department')}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                      <Target className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-base">{dept.name}</p>
                      <p className="text-sm text-muted-foreground">{dept.employees} employees</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl">{dept.performance}%</p>
                    <Badge variant={dept.performance >= 90 ? 'default' : 'secondary'} className="text-xs mt-1">
                      {dept.performance >= 90 ? 'Excellent' : 'Good'}
                    </Badge>
                  </div>
                </div>
                <Progress value={dept.performance} className="h-3 bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="card-hover border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              {t.dashboard.recentActivities}
            </CardTitle>
            <CardDescription className="text-base">Latest employee activities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.length > 0 ? (
              <>
                {recentActivities
                  .slice((activitiesPage - 1) * ACTIVITIES_PER_PAGE, activitiesPage * ACTIVITIES_PER_PAGE)
                  .map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                        activity.type === 'check-in' ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
                        activity.type === 'leave' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                        'bg-gradient-to-br from-blue-400 to-indigo-500'
                      }`}>
                        {activity.type === 'check-in' && <Clock className="h-5 w-5 text-white" />}
                        {activity.type === 'leave' && <CalendarDays className="h-5 w-5 text-white" />}
                        {activity.type === 'task' && <ClipboardList className="h-5 w-5 text-white" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{activity.user}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.type === 'check-in' && 'Checked in'}
                          {activity.type === 'leave' && 'Applied for leave'}
                          {activity.type === 'task' && 'Completed task'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatActivityTime(activity.time)}
                        </p>
                        {activity.type === 'check-in' && (
                          <Badge 
                            variant={
                              getCorrectAttendanceStatus(activity) === 'on-time' || getCorrectAttendanceStatus(activity) === 'on_time' ? 'default' :
                              getCorrectAttendanceStatus(activity) === 'late' ? 'destructive' :
                              getCorrectAttendanceStatus(activity) === 'early' ? 'secondary' :
                              'default'
                            }
                            className={`text-xs mt-1 ${
                              getCorrectAttendanceStatus(activity) === 'on-time' || getCorrectAttendanceStatus(activity) === 'on_time' ? 'bg-green-500' :
                              getCorrectAttendanceStatus(activity) === 'late' ? 'bg-red-500' :
                              getCorrectAttendanceStatus(activity) === 'early' ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}
                          >
                            {getCorrectAttendanceStatus(activity) === 'on-time' || getCorrectAttendanceStatus(activity) === 'on_time' ? 'On Time' :
                             getCorrectAttendanceStatus(activity) === 'late' ? 'Late' :
                             getCorrectAttendanceStatus(activity) === 'early' ? 'Early' :
                             getCorrectAttendanceStatus(activity)}
                          </Badge>
                        )}
                        {activity.type === 'leave' && (
                          <Badge 
                            variant={
                              activity.status === 'approved' ? 'default' :
                              activity.status === 'pending' ? 'secondary' :
                              activity.status === 'rejected' ? 'destructive' :
                              'secondary'
                            }
                            className="text-xs mt-1"
                          >
                            {activity.status === 'approved' ? 'Approved' :
                             activity.status === 'pending' ? 'Pending' :
                             activity.status === 'rejected' ? 'Rejected' :
                             activity.status}
                          </Badge>
                        )}
                        {activity.type === 'task' && (
                          <Badge 
                            variant={
                              activity.status === 'completed' ? 'default' :
                              activity.status === 'in-progress' ? 'secondary' :
                              'default'
                            }
                            className={`text-xs mt-1 ${
                              activity.status === 'completed' ? 'bg-green-500' : ''
                            }`}
                          >
                            {activity.status === 'completed' ? 'Completed' :
                             activity.status === 'in-progress' ? 'In Progress' :
                             activity.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                {recentActivities.length > ACTIVITIES_PER_PAGE && (
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
                    {Array.from({ length: Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE) }, (_, i) => i + 1).map((page) => (
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
                      onClick={() => setActivitiesPage(p => Math.min(Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE), p + 1))}
                      disabled={activitiesPage === Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE)}
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
      </div>

      {/* Quick Actions */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>{t.dashboard.quickActions}</CardTitle>
          <CardDescription>Frequently used administrative actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/admin/employees')}>
              <Users className="h-5 w-5" />
              <span className="text-xs">Manage Employees</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/admin/attendance')}>
              <Clock className="h-5 w-5" />
              <span className="text-xs">View Attendance</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/admin/leaves')}>
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs">Approve Leaves</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/admin/hiring')}>
              <UserPlus className="h-5 w-5" />
              <span className="text-xs">Hiring Management</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/admin/reports')}>
              <Award className="h-5 w-5" />
              <span className="text-xs">Generate Reports</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;