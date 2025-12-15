import React from 'react';
import { useEffect, useMemo, useState } from 'react';
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
  AlertCircle,
  ChevronRight,
  Activity,
  FileText,
  UserCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatTimeIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';

type HRActivity = {
  id: string | number;
  type: string;
  user: string;
  time?: string;
  status?: string;
  description?: string;
};

const HRDashboard: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    lateArrivals: 0,
    pendingLeaves: 0,
    newJoinersThisMonth: 0,
    exitingThisMonth: 0,
    openPositions: 0,
    activeTasks: 0,
    completedTasks: 0,
  });
  const [recentActivities, setRecentActivities] = useState<HRActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const ACTIVITIES_PER_PAGE = 15;

  useEffect(() => {
    let isMounted = true;
    const loadDashboard = async () => {
      try {
        const data = await apiService.getHRDashboard();
        if (!isMounted || !data) return;
        const { recentActivities: activityFeed = [], ...statSnapshot } = data;
        setStats((prev) => ({ ...prev, ...statSnapshot }));
        setRecentActivities(Array.isArray(activityFeed) ? activityFeed : []);
      } catch (error) {
        console.error('Failed to load HR dashboard', error);
      } finally {
        if (isMounted) {
          setIsLoadingActivities(false);
        }
      }
    };

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const safePercentage = (value: number, total: number): number => {
    if (!total || total <= 0) return 0;
    const percent = (value / total) * 100;
    if (!Number.isFinite(percent)) return 0;
    return Math.min(100, Math.max(0, percent));
  };

  const formatActivityTime = (value?: string) => {
    if (!value) return '—';
    // Parse the ISO string and convert to IST, then format time only
    return formatTimeIST(value, 'hh:mm a');
  };

  const formatActivityDescription = (activity: HRActivity) => {
    if (activity.description) return activity.description;
    if (activity.type === 'leave') return 'Leave request';
    if (activity.type === 'join') return 'New employee joined';
    if (activity.type === 'attendance') return 'Checked in';
    if (activity.type === 'document') return 'Document update';
    return 'Activity update';
  };

  const formatStatusLabel = (status?: string) =>
    status ? status.replace(/[-_]/g, ' ') : 'update';

  // Calculate correct attendance status based on check-in time and grace period
  const getCorrectAttendanceStatus = (activity: HRActivity) => {
    if (activity.type !== 'attendance') {
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

  const getActivityBadgeVariant = (status?: string) => {
    const normalized = (status || '').toLowerCase();
    if (['approved', 'new-joiner', 'completed', 'on-time'].includes(normalized)) {
      return 'default' as const;
    }
    if (['pending', 'submitted', 'requested'].includes(normalized)) {
      return 'secondary' as const;
    }
    if (['late', 'rejected', 'cancelled'].includes(normalized)) {
      return 'destructive' as const;
    }
    return 'outline' as const;
  };

  const getActivityIconClasses = (type: string) => {
    switch (type) {
      case 'leave':
        return 'bg-gradient-to-br from-amber-400 to-orange-500';
      case 'join':
        return 'bg-gradient-to-br from-green-400 to-emerald-500';
      case 'attendance':
        return 'bg-gradient-to-br from-blue-400 to-indigo-500';
      case 'document':
        return 'bg-gradient-to-br from-cyan-400 to-blue-500';
      default:
        return 'bg-gradient-to-br from-slate-400 to-gray-500';
    }
  };

  const renderActivityIcon = (type: string) => {
    switch (type) {
      case 'leave':
        return <CalendarDays className="h-5 w-5 text-white" />;
      case 'join':
        return <UserPlus className="h-5 w-5 text-white" />;
      case 'attendance':
        return <Clock className="h-5 w-5 text-white" />;
      case 'document':
        return <FileText className="h-5 w-5 text-white" />;
      default:
        return <Activity className="h-5 w-5 text-white" />;
    }
  };

  const activityFeedContent = useMemo(() => {
    if (isLoadingActivities) {
      return (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Loading recent activities...
        </div>
      );
    }

    if (!recentActivities.length) {
      return (
        <div className="p-6 text-center text-muted-foreground text-sm">
          No recent activities available yet.
        </div>
      );
    }

    const paginatedActivities = recentActivities.slice(
      (activitiesPage - 1) * ACTIVITIES_PER_PAGE,
      activitiesPage * ACTIVITIES_PER_PAGE
    );

    return (
      <>
        {paginatedActivities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${getActivityIconClasses(
                activity.type,
              )}`}
            >
              {renderActivityIcon(activity.type)}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{activity.user}</p>
              <p className="text-xs text-muted-foreground">
                {formatActivityDescription(activity)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {formatActivityTime(activity.time)}
              </p>
              <Badge
                variant={getActivityBadgeVariant(getCorrectAttendanceStatus(activity))}
                className="text-xs mt-1 capitalize"
              >
                {formatStatusLabel(getCorrectAttendanceStatus(activity))}
              </Badge>
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
    );
  }, [isLoadingActivities, recentActivities, activitiesPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="h-7 w-7 text-white" />
            </div>
            {t.common.welcome}, HR!
          </h1>
          <p className="text-purple-100 mt-2 ml-15">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => navigate('/hr/employees/new')} className="gap-2 bg-white text-purple-700 hover:bg-purple-50">
          <UserPlus className="h-4 w-4" />
          {t.employee.addEmployee}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/hr/employees')}>
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
                navigate('/hr/employees');
              }}
            >
              <span className="text-sm">View all</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/hr/attendance')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-50">
              {t.dashboard.presentToday}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.presentToday}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto mt-2 text-white hover:text-green-100" 
              onClick={(e) => {
                e.stopPropagation();
                navigate('/hr/attendance');
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
            <Button variant="link" className="p-0 h-auto mt-2 text-white hover:text-amber-100" onClick={() => navigate('/hr/leaves')}>
              <span className="text-sm">Review requests</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/hr/tasks')}>
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
            <div className="flex items-center gap-1 mt-2">
              <span className="text-sm text-purple-100">{stats.completedTasks} completed</span>
            </div>
            <Button 
              variant="link" 
              className="p-0 h-auto mt-1 text-white hover:text-purple-100" 
              onClick={(e) => {
                e.stopPropagation();
                navigate('/hr/tasks');
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
        {/* Recent Activities */}
        <Card className="lg:col-span-2 border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              {t.dashboard.recentActivities}
            </CardTitle>
            <CardDescription className="text-base">Latest HR activities and requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">{activityFeedContent}</CardContent>
        </Card>

        {/* Quick Stats Summary */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              Employee Metrics
            </CardTitle>
            <CardDescription className="text-base">This month's overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">New Joiners</span>
                <span className="font-medium">{stats.newJoinersThisMonth}</span>
              </div>
              <Progress value={(stats.newJoinersThisMonth / 10) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Exits</span>
                <span className="font-medium">{stats.exitingThisMonth}</span>
              </div>
              <Progress value={(stats.exitingThisMonth / 10) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">On Leave</span>
                <span className="font-medium">{stats.onLeave}</span>
              </div>
              <Progress
                value={safePercentage(stats.onLeave, stats.totalEmployees)}
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Late Arrivals Today</span>
                <span className="font-medium">{stats.lateArrivals}</span>
              </div>
              <Progress
                value={safePercentage(
                  stats.lateArrivals,
                  stats.presentToday || stats.totalEmployees || 1,
                )}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.quickActions}</CardTitle>
          <CardDescription>Frequently used HR actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/hr/employees')}>
              <Users className="h-5 w-5" />
              <span className="text-xs">Manage Employees</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/hr/attendance')}>
              <Clock className="h-5 w-5" />
              <span className="text-xs">View Attendance</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/hr/leaves')}>
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs">Process Leaves</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/hr/hiring')}>
              <UserPlus className="h-5 w-5" />
              <span className="text-xs">Hiring Management</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/hr/reports')}>
              <FileText className="h-5 w-5" />
              <span className="text-xs">Generate Reports</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HRDashboard;