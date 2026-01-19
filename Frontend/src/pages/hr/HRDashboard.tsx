import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Home,
  Timer,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatTimeIST, formatIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

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
  const { user } = useAuth();
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

  // WFH Requests state
  const [wfhRequests, setWfhRequests] = useState<any[]>([]);
  const [isLoadingWfhRequests, setIsLoadingWfhRequests] = useState(false);
  const [isProcessingWfhRequest, setIsProcessingWfhRequest] = useState(false);
  const [selectedWfhRequest, setSelectedWfhRequest] = useState<any>(null);
  const [showWfhRequestDialog, setShowWfhRequestDialog] = useState(false);
  const [wfhRejectionReason, setWfhRejectionReason] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadDashboard = async () => {
      try {
        const data = await apiService.getHRDashboard();
        if (!isMounted || !data) return;
        const { recentActivities: activityFeed = [], ...statSnapshot } = data;

        setStats((prev) => ({ ...prev, ...statSnapshot }));

        // Filter for Today's activities only
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        const todaysActivities = (Array.isArray(activityFeed) ? activityFeed : []).filter((activity: HRActivity) => {
          if (!activity.time) return false;
          const activityTime = new Date(activity.time);
          return activityTime >= startOfDay && activityTime <= endOfDay;
        });

        // Sort by time (most recent first)
        todaysActivities.sort((a, b) => {
          const timeA = a.time ? new Date(a.time).getTime() : 0;
          const timeB = b.time ? new Date(b.time).getTime() : 0;
          return timeB - timeA;
        });

        setRecentActivities(todaysActivities);
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

  // Load WFH requests for HR (both own and employee/team lead requests)
  useEffect(() => {
    const loadWFHRequests = async () => {
      setIsLoadingWfhRequests(true);
      try {
        // Fetch all WFH requests using the new API method
        const response = await apiService.getAllWFHRequests();

        // Handle response - it's always an array
        let requests = Array.isArray(response) ? response : [];

        // Transform API response to match our UI format
        // The API returns requests with fields like: wfh_id, user_id, start_date, end_date, wfh_type, reason, status, employee_id, name, department, role, approver_name
        const formattedRequests = requests.map((req: any) => ({
          id: req.wfh_id || req.id,
          user_id: req.user_id,
          user_name: req.name || req.employee_name || 'Unknown',
          employee_id: req.employee_id || '',
          start_date: req.start_date,
          end_date: req.end_date,
          reason: req.reason,
          wfh_type: (req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day',
          status: (req.status || 'Pending').toLowerCase(),
          created_at: req.created_at,
          updated_at: req.updated_at,
          rejection_reason: req.rejection_reason,
          approved_by: req.approver_name || req.approved_by,
          department: req.department || 'Unknown',
          user_role: (req.role || 'employee').toLowerCase(),
        }));
        setWfhRequests(formattedRequests);
      } catch (error) {
        // Silently fail - endpoint may not be implemented yet
        // The API method already handles errors gracefully
        setWfhRequests([]);
      } finally {
        setIsLoadingWfhRequests(false);
      }
    };

    loadWFHRequests();
  }, []);

  const safePercentage = (value: number, total: number): number => {
    if (!total || total <= 0) return 0;
    const percent = (value / total) * 100;
    if (!Number.isFinite(percent)) return 0;
    return Math.min(100, Math.max(0, percent));
  };

  // Handle WFH request approval/rejection for HR
  const handleWfhRequestAction = async (requestId: number, action: 'approve' | 'reject', reason?: string) => {
    setIsProcessingWfhRequest(true);
    try {
      const approved = action === 'approve';
      await apiService.approveWFHRequest(requestId, approved, reason);

      // Update local state optimistically
      const currentTime = new Date();
      setWfhRequests(prev =>
        prev.map(req =>
          req.id === requestId
            ? {
              ...req,
              status: action === 'approve' ? 'approved' : 'rejected',
              updated_at: currentTime.toISOString(),
              approved_by: user?.name || 'HR',
              rejection_reason: action === 'reject' ? reason : undefined
            }
            : req
        )
      );

      toast({
        title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `WFH request has been ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
        variant: 'default',
      });

      setShowWfhRequestDialog(false);
      setSelectedWfhRequest(null);
      setWfhRejectionReason('');
    } catch (error) {
      console.error('Error processing WFH request:', error);
      toast({
        title: 'Action Failed',
        description: `Failed to ${action} the request. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingWfhRequest(false);
    }
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
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-none">
            <Users className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              {t.common.welcome}, <span className="text-purple-600">{user?.name}</span>
            </h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <CalendarDays className="h-4 w-4 text-purple-500" />
              {formatIST(new Date(), 'EEEE, MMMM dd, yyyy')}
            </p>
          </div>
        </div>

        <div className="relative flex gap-3">
          <Button
            onClick={() => navigate('/hr/employees/new')}
            size="lg"
            className="rounded-xl px-6 h-12 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200 dark:shadow-none transition-all active:scale-95 gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {t.employee.addEmployee}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: t.dashboard.totalEmployees,
            value: stats.totalEmployees,
            sub: 'View All Employees',
            icon: Users,
            color: 'blue',
            bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
            cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
            borderColor: 'border-blue-300/80 dark:border-blue-700/50',
            hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400',
            path: '/hr/employees'
          },
          {
            label: t.dashboard.presentToday,
            value: stats.presentToday,
            sub: 'View Attendance',
            icon: UserCheck,
            color: 'emerald',
            bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
            cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
            borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
            hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400',
            path: '/hr/attendance',
            pathState: { viewMode: 'employee' }
          },
          {
            label: t.dashboard.pendingApprovals,
            value: stats.pendingLeaves,
            sub: 'Review Requests',
            icon: AlertCircle,
            color: 'amber',
            bg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
            cardBg: 'bg-amber-50/40 dark:bg-amber-950/10',
            borderColor: 'border-amber-300/80 dark:border-amber-700/50',
            hoverBorder: 'group-hover:border-amber-500 dark:group-hover:border-amber-400',
            path: '/hr/leaves',
            pathState: { viewMode: 'approvals' }
          },
          {
            label: 'Active Tasks',
            value: stats.activeTasks,
            sub: `${stats.completedTasks} Completed Today`,
            icon: ClipboardList,
            color: 'purple',
            bg: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
            cardBg: 'bg-purple-50/40 dark:bg-purple-950/10',
            borderColor: 'border-purple-300/80 dark:border-purple-700/50',
            hoverBorder: 'group-hover:border-purple-500 dark:group-hover:border-purple-400',
            path: '/hr/tasks'
          }
        ].map((item, i) => (
          <Card
            key={i}
            className={`border-2 ${item.borderColor} ${item.hoverBorder} shadow-sm ${item.cardBg} backdrop-blur-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative cursor-pointer`}
            onClick={() => navigate(item.path, { state: item.pathState })}
          >
            {/* Background Accent */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${item.bg.split(' ')[0]}`} />

            <CardContent className="p-4 relative">
              <div className="flex justify-between items-start mb-2">
                <div className={`p-2.5 rounded-xl ${item.bg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{item.label}</h3>
                <div className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{item.value}</div>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/50 dark:bg-gray-900/30 border border-black/5 dark:border-white/5">
                  <div className={`h-1.5 w-1.5 rounded-full ${item.color === 'blue' ? 'bg-blue-500' :
                    item.color === 'emerald' ? 'bg-emerald-500' :
                      item.color === 'amber' ? 'bg-amber-500' :
                        'bg-purple-500'
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
              <Progress value={safePercentage(stats.newJoinersThisMonth, stats.totalEmployees || 10)} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">On Leave</span>
                <span className="font-medium">{stats.onLeave}</span>
              </div>
              <Progress
                value={safePercentage(stats.onLeave, stats.totalEmployees || 10)}
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


    </div>
  );
};

export default HRDashboard;