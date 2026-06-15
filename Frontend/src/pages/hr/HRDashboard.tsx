import React from 'react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Pagination } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import {
  Users,
  UserPlus,
  Clock,
  CalendarDays,
  ClipboardList,
  AlertCircle,
  Activity,
  FileText,
  UserCheck,
  Home,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatTimeIST, formatIST, todayIST, formatDateIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import SummaryCard from '@/components/ui/SummaryCard';

import TruncatedText from '@/components/ui/TruncatedText';

type HRActivity = {
  id: string | number;
  type: string;
  user: string;
  time?: string;
  status?: string;
  description?: string;
  checkInStatus?: string;
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
  const ACTIVITIES_PER_PAGE = 10;

  const [wfhRequests, setWfhRequests] = useState<any[]>([]);
  const [isLoadingWfhRequests, setIsLoadingWfhRequests] = useState(false);
  const [isProcessingWfhRequest, setIsProcessingWfhRequest] = useState(false);
  const [showWfhRequestDialog, setShowWfhRequestDialog] = useState(false);
  const [selectedWfhRequest, setSelectedWfhRequest] = useState<any>(null);
  const [wfhRejectionReason, setWfhRejectionReason] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingActivities(true);
    try {
      const data = await apiService.getHRDashboard();
      if (!data) return;
      const { recentActivities: activityFeed = [], ...statSnapshot } = data;

      setStats((prev) => ({
        ...prev,
        ...statSnapshot,
        activeTasks: (statSnapshot as any).activeTasks ?? prev.activeTasks,
        completedTasks: (statSnapshot as any).completedTasks ?? prev.completedTasks
      }));

      // Enhanced Recent Activities Logic - Fetch today's records for accurate timing
      const todayDateStr = todayIST();

      // 1. Initial filter from dashboard data (tasks, leaves, etc.)
      let activities = (Array.isArray(activityFeed) ? activityFeed : []).filter((a: any) => {
        if (!a.time) return false;
        // Avoid duplicate check-ins/outs as we fetch fresh ones next
        if (a.type === 'attendance') return false; // In HR dashboard, attendance type is used instead of check-in/out

        // Show current day activities only
        return formatDateIST(a.time) === todayDateStr;
      });

      // 2. Fetch fresh attendance records for today to get accurate timings
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
            if (checkInTime && formatDateIST(checkInTime) === todayDateStr) {
              attendanceActivities.push({
                id: `in-${recId}`,
                type: 'attendance',
                user: userName,
                time: checkInTime,
                status: rec.status || 'present',
                checkInStatus: rec.checkInStatus || rec.check_in_status,
              });
            }

            // Add Check-Out Activity
            if (checkOutTime && formatDateIST(checkOutTime) === todayDateStr) {
              attendanceActivities.push({
                id: `out-${recId}`,
                type: 'attendance',
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
        activities.sort((a, b) => {
          const timeA = a.time ? new Date(a.time).getTime() : 0;
          const timeB = b.time ? new Date(b.time).getTime() : 0;
          return timeB - timeA;
        });

      } catch (attError) {
        console.error("Failed to fetch fresh attendance for HR dashboard activities", attError);
      }

      setRecentActivities(activities.slice(0, 100));
    } catch (error) {
      console.error('Failed to load HR dashboard', error);
    } finally {
      if (!isSilent) setIsLoadingActivities(false);
    }
  }, []);

  const loadWFHRequests = useCallback(async () => {
    setIsLoadingWfhRequests(true);
    try {
      const response = await apiService.getAllWFHRequests();
      const requests = Array.isArray(response) ? response : [];
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
      setWfhRequests([]);
    } finally {
      setIsLoadingWfhRequests(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadDashboardData(true), loadWFHRequests()]);
    setIsRefreshing(false);
    toast({
      title: "Dashboard Updated",
      description: "Home page data has been refreshed successfully.",
    });
  }, [loadDashboardData, loadWFHRequests]);

  useEffect(() => {
    loadDashboardData();
    loadWFHRequests();
  }, [loadDashboardData, loadWFHRequests]);

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

      // Re-fetch dashboard data to update stats (like pendingApprovals)
      loadDashboardData(true);
      loadWFHRequests();

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

  const formatShortDate = (value?: string) => {
    if (!value) return '—';
    try {
      return formatIST(new Date(value), 'MMM dd');
    } catch {
      return '—';
    }
  };

  // Calculate correct attendance status based on check-in time and grace period
  const getCorrectAttendanceStatus = (activity: HRActivity) => {
    if (activity.type !== 'attendance') {
      return activity.status;
    }

    // Prioritize backend-provided status if available
    if (activity.checkInStatus) {
      const normalizedStatus = activity.checkInStatus.toLowerCase();
      if (normalizedStatus === 'on-time' || normalizedStatus === 'on_time') return 'on-time';
      if (normalizedStatus === 'late') return 'late';
      return normalizedStatus;
    }

    // Fallback to time-based calculation if no status provided by backend
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
        <div className="p-6 text-center font-bold text-xs" style={{ color: '#000000' }}>
          Loading recent activities...
        </div>
      );
    }

    if (!recentActivities.length) {
      return (
        <div className="p-6 text-center font-bold text-xs" style={{ color: '#000000' }}>
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
              <p className="text-sm font-bold" style={{ color: '#000000' }}>{activity.user}</p>
              <div className="text-xs font-medium" style={{ color: '#000000' }}>
                <TruncatedText
                  text={formatActivityDescription(activity)}
                  maxLength={60}
                  showToggle={false}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium" style={{ color: '#000000' }}>
                {formatActivityTime(activity.time)}
              </p>
              <Badge
                className={`text-white border-0 font-bold uppercase text-[10px] h-5 mt-1 ${getCorrectAttendanceStatus(activity) === 'on-time'
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : getCorrectAttendanceStatus(activity) === 'late'
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : 'bg-amber-500 hover:bg-amber-600'
                  }`}
              >
                {formatStatusLabel(getCorrectAttendanceStatus(activity))}
              </Badge>
            </div>
          </div>
        ))}
        {recentActivities.length > ACTIVITIES_PER_PAGE && (
          <div className="mt-6">
            <Pagination
              currentPage={activitiesPage}
              totalPages={Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE)}
              totalItems={recentActivities.length}
              itemsPerPage={ACTIVITIES_PER_PAGE}
              onPageChange={setActivitiesPage}
              showItemsPerPage={false} // Activities feed usually has fixed limit on dashboard
            />
          </div>
        )}
      </>
    );
  }, [isLoadingActivities, recentActivities, activitiesPage]);

  const wfhSummary = useMemo(() => {
    const total = wfhRequests.length;
    const pending = wfhRequests.filter(r => (r.status || '').toLowerCase() === 'pending').length;
    const approved = wfhRequests.filter(r => (r.status || '').toLowerCase() === 'approved').length;
    const rejected = wfhRequests.filter(r => (r.status || '').toLowerCase() === 'rejected').length;

    const pendingList = wfhRequests
      .filter(r => (r.status || '').toLowerCase() === 'pending')
      .sort((a, b) => {
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tB - tA;
      })
      .slice(0, 5);

    return { total, pending, approved, rejected, pendingList };
  }, [wfhRequests]);

  const openRejectDialog = (req: any) => {
    setSelectedWfhRequest(req);
    setWfhRejectionReason('');
    setShowWfhRequestDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-sm mt-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-none">
            <Users className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#000000' }}>
              {t.common.welcome}, <span style={{ color: '#9333EA' }}>{user?.name}</span>
            </h1>
            <p className="font-medium flex items-center gap-2 mt-1 text-sm" style={{ color: '#000000' }}>
              <CalendarDays className="h-4 w-4" style={{ color: '#000000' }} />
              {formatIST(new Date(), 'EEEE, MMMM dd, yyyy | hh:mm a')}
            </p>
          </div>
        </div>

        <div className="relative flex gap-3">
          <Button
            onClick={() => navigate('/hr/employees/', { state: { highlight: true } })}
            size="lg"
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
              label: t.dashboard.totalEmployees,
              value: stats.totalEmployees,
              icon: Users,
              iconColor: 'text-blue-600',
              iconBg: 'bg-blue-50',
              path: '/hr/employees'
            },
            {
              label: t.dashboard.presentToday,
              value: stats.presentToday,
              icon: UserCheck,
              iconColor: 'text-emerald-600',
              iconBg: 'bg-emerald-50',
              path: '/hr/attendance',
              pathState: { viewMode: 'employee' }
            },
            {
              label: t.dashboard.pendingApprovals,
              value: stats.pendingLeaves,
              icon: AlertCircle,
              iconColor: 'text-amber-600',
              iconBg: 'bg-amber-50',
              path: '/hr/leaves',
              pathState: { viewMode: 'approvals' }
            },
            {
              label: 'Active Tasks',
              value: stats.activeTasks,
              icon: ClipboardList,
              iconColor: 'text-purple-600',
              iconBg: 'bg-purple-50',
              path: '/hr/tasks'
            }
          ].map((item, i) => (
            <SummaryCard
              key={i}
              title={item.label}
              value={item.value}
              icon={item.icon}
              iconColor={item.iconColor}
              iconBg={item.iconBg}
              onClick={() => navigate(item.path, { state: item.pathState })}
            />
          ))}

        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Recent Activities */}
        <Card className="lg:col-span-3 border-2 border-[#000000] shadow-xl bg-white rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <CardTitle className="flex items-center gap-2 font-bold" style={{ color: '#000000' }}>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <span className="text-[16px] font-bold">{t.dashboard.recentActivities}</span>
            </CardTitle>
            <p className="text-[14px] font-medium" style={{ color: '#000000' }}>Latest HR activities and requests</p>
          </CardHeader>
          <CardContent className="space-y-3">{activityFeedContent}</CardContent>
        </Card>

        {/* WFH Requests */}
        <Card className="lg:col-span-2 border-2 border-[#000000] shadow-xl bg-white rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <CardTitle className="flex items-center gap-2 font-bold" style={{ color: '#000000' }}>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Home className="h-5 w-5 text-white" />
              </div>
              <span className="text-[16px] font-bold">WFH Requests</span>
            </CardTitle>
            <p className="text-[14px] font-medium" style={{ color: '#000000' }}>Review pending work-from-home requests</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg border bg-white/60 dark:bg-gray-900/30 p-3">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#000000' }}>Total</div>
                <div className="text-base font-bold" style={{ color: '#000000' }}>{wfhSummary.total}</div>
              </div>
              <div className="rounded-lg border bg-white/60 dark:bg-gray-900/30 p-3">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#000000' }}>Pending</div>
                <div className="text-base font-bold" style={{ color: '#000000' }}>{wfhSummary.pending}</div>
              </div>
              <div className="rounded-lg border bg-white/60 dark:bg-gray-900/30 p-3">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#000000' }}>Approved</div>
                <div className="text-base font-bold" style={{ color: '#000000' }}>{wfhSummary.approved}</div>
              </div>
              <div className="rounded-lg border bg-white/60 dark:bg-gray-900/30 p-3">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#000000' }}>Rejected</div>
                <div className="text-base font-bold" style={{ color: '#000000' }}>{wfhSummary.rejected}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: '#000000' }}>Pending (latest)</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/hr/attendance?tab=wfh_requests')}
                className="h-8 text-blue-600 border-blue-600 hover:bg-blue-50 hover:text-blue-700 font-bold"
              >
                View All
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {isLoadingWfhRequests ? (
              <div className="p-4 text-center font-bold text-xs" style={{ color: '#000000' }}>Loading WFH requests...</div>
            ) : !wfhSummary.pendingList.length ? (
              <div className="p-4 text-center font-bold text-xs" style={{ color: '#000000' }}>No pending requests.</div>
            ) : (
              <div className="space-y-2">
                {wfhSummary.pendingList.map((req: any) => (
                  <div
                    key={req.id}
                    className="rounded-lg border bg-white/60 dark:bg-gray-900/30 p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold truncate" style={{ color: '#000000' }}>{req.user_name}</div>
                        <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 border-0 font-bold uppercase text-[10px] h-5">
                          {formatStatusLabel(req.status)}
                        </Badge>
                      </div>
                      <div className="text-xs font-medium mt-1" style={{ color: '#000000' }}>
                        {formatShortDate(req.start_date)} → {formatShortDate(req.end_date)} • {req.department}
                      </div>
                      {req.reason ? (
                        <div className="text-xs font-medium mt-1" style={{ color: '#000000' }}>
                          <TruncatedText
                            text={req.reason}
                            maxLength={80}
                            showToggle={false}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        disabled={isProcessingWfhRequest}
                        onClick={() => handleWfhRequestAction(Number(req.id), 'approve')}
                        className="h-8 bg-green-600 hover:bg-green-700 text-white font-bold"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        disabled={isProcessingWfhRequest}
                        onClick={() => openRejectDialog(req)}
                        className="h-8 bg-red-600 hover:bg-red-700 text-white font-bold"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showWfhRequestDialog} onOpenChange={setShowWfhRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject WFH Request</DialogTitle>
            <DialogDescription>
              Provide a brief reason. This will be shared with the employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {selectedWfhRequest?.user_name || 'Employee'}
            </div>
            <Textarea
              value={wfhRejectionReason}
              onChange={(e) => setWfhRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="min-h-[110px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowWfhRequestDialog(false);
                setSelectedWfhRequest(null);
                setWfhRejectionReason('');
              }}
              disabled={isProcessingWfhRequest}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isProcessingWfhRequest || !selectedWfhRequest?.id}
              onClick={() =>
                handleWfhRequestAction(Number(selectedWfhRequest.id), 'reject', wfhRejectionReason?.trim() || undefined)
              }
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default HRDashboard;
