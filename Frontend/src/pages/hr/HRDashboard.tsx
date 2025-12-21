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
            {formatIST(new Date(), 'EEEE, MMMM dd, yyyy')}
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

        <Card className="card-hover border-0 bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/hr/attendance', { state: { viewMode: 'employee' } })}>
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
                navigate('/hr/attendance', { state: { viewMode: 'employee' } });
              }}
            >
              <span className="text-sm">View all</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => navigate('/hr/leaves', { state: { viewMode: 'approvals' } })}>
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
            <Button variant="link" className="p-0 h-auto mt-2 text-white hover:text-amber-100" onClick={(e) => {
              e.stopPropagation();
              navigate('/hr/leaves', { state: { viewMode: 'approvals' } });
            }}>
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

      {/* WFH Requests */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Home className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">My WFH Requests</CardTitle>
                <CardDescription className="text-base">Your work from home requests</CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/hr/wfh')}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingWfhRequests ? (
            <div className="flex items-center justify-center py-8">
              <Timer className="h-6 w-6 animate-spin text-orange-600" />
              <span className="ml-2 text-muted-foreground">Loading requests...</span>
            </div>
          ) : wfhRequests.length === 0 ? (
            <div className="text-center py-8">
              <Home className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground">No WFH requests yet</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/hr/wfh')}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Submit Request
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {wfhRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="border rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{request.user_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {request.user_role}
                        </Badge>
                        <Badge 
                          variant={
                            request.status === 'approved' ? 'default' :
                            request.status === 'rejected' ? 'destructive' :
                            'secondary'
                          }
                          className={request.status === 'approved' ? 'bg-green-500' : ''}
                        >
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        <span>{request.start_date} to {request.end_date}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{request.reason}</p>
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                          onClick={() => handleWfhRequestAction(request.id, 'approve')}
                          disabled={isProcessingWfhRequest}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => {
                            setSelectedWfhRequest(request);
                            setShowWfhRequestDialog(true);
                          }}
                          disabled={isProcessingWfhRequest}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {wfhRequests.length > 3 && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/hr/wfh')}
                >
                  View all {wfhRequests.length} requests
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/hr/leaves', { state: { tab: 'approvals' } })}>
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

      {/* WFH Request Rejection Dialog */}
      <Dialog open={showWfhRequestDialog} onOpenChange={setShowWfhRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject WFH Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this work from home request
            </DialogDescription>
          </DialogHeader>
          {selectedWfhRequest && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg space-y-2">
                <p className="text-sm"><strong>Employee:</strong> {selectedWfhRequest.user_name}</p>
                <p className="text-sm"><strong>Date:</strong> {selectedWfhRequest.start_date} to {selectedWfhRequest.end_date}</p>
                <p className="text-sm"><strong>Reason:</strong> {selectedWfhRequest.reason}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Please provide a reason for rejection..."
                  value={wfhRejectionReason}
                  onChange={(e) => setWfhRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWfhRequestDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedWfhRequest && wfhRejectionReason.trim()) {
                  handleWfhRequestAction(selectedWfhRequest.id, 'reject', wfhRejectionReason);
                } else {
                  toast({
                    title: 'Error',
                    description: 'Please provide a rejection reason',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={isProcessingWfhRequest || !wfhRejectionReason.trim()}
            >
              {isProcessingWfhRequest ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRDashboard;