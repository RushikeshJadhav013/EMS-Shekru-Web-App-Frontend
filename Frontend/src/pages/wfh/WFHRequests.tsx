import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWFH } from '@/contexts/WFHContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Calendar, Home, Trash2, Edit, CheckCircle, XCircle, Clock as ClockIcon, AlertCircle, History } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiService } from '@/lib/api';
import { format } from 'date-fns';
import { formatDateIST, formatDateTimeIST } from '@/utils/timezone';

interface WFHRequest {
  id: number;
  user_id: number;
  employee_name?: string;
  requester_role?: string;
  start_date: string;
  end_date: string;
  reason: string;
  wfh_type: 'full_day' | 'half_day';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  approved_by?: string;
  manager_approval?: 'pending' | 'approved' | 'rejected';
  hr_approval?: 'pending' | 'approved' | 'rejected';
  admin_approval?: 'pending' | 'approved' | 'rejected';
}

const reasonTemplates = [
  "Not feeling well",
  "Personal appointment",
  "Family emergency",
  "Car trouble",
  "Child care",
  "Working from home today"
];

const WFHRequests: React.FC = () => {
  const { user } = useAuth();
  const {
    wfhRequests: contextWfhRequests,
    isLoading: contextIsLoading,
    refreshWFHRequests,
    recentDecisions,
    isLoadingDecisions,
    refreshRecentDecisions,
    pendingApprovals,
    isLoadingPending,
    loadPendingApprovals,
    approveRequest,
    rejectRequest
  } = useWFH();

  // State management
  const [wfhRequests, setWfhRequests] = useState<WFHRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-requests' | 'pending-approvals' | 'recent-decisions'>('my-requests');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [decisionFilter, setDecisionFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'hr' | 'manager' | 'team_lead' | 'employee'>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_year' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({ startDate: null, endDate: null });
  const [isCustomRangeDialogOpen, setIsCustomRangeDialogOpen] = useState(false);

  // Sync context data with local state
  useEffect(() => {
    setWfhRequests(contextWfhRequests);
    setIsLoading(contextIsLoading);
  }, [contextWfhRequests, contextIsLoading]);

  // Form state
  const [formData, setFormData] = useState({
    startDate: new Date(),
    endDate: new Date(),
    reason: '',
    type: 'full_day' as 'full_day' | 'half_day',
  });

  // Dialog states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRequest, setEditingRequest] = useState<WFHRequest | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<WFHRequest | null>(null);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);
  const [isMyRequestsCustomRangeDialogOpen, setIsMyRequestsCustomRangeDialogOpen] = useState(false);

  // Pagination states
  const [myRequestsPage, setMyRequestsPage] = useState(1);
  const [pendingApprovalsPage, setPendingApprovalsPage] = useState(1);
  const [recentDecisionsPage, setRecentDecisionsPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [myRequestsDurationFilter, setMyRequestsDurationFilter] = useState<'all' | 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_year' | 'custom'>('all');
  const [myRequestsCustomDateRange, setMyRequestsCustomDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({ startDate: null, endDate: null });

  // Load WFH requests on mount and when component becomes visible
  useEffect(() => {
    // Ensure requests are loaded when component mounts
    refreshWFHRequests();
    refreshRecentDecisions();
    loadPendingApprovals();
  }, [refreshWFHRequests, refreshRecentDecisions, loadPendingApprovals]);

  const handleEditRequest = (request: WFHRequest) => {
    setEditingRequest(request);
    const startDateParts = request.start_date.split('-');
    const endDateParts = request.end_date.split('-');

    const startDate = new Date(Date.UTC(
      parseInt(startDateParts[0]),
      parseInt(startDateParts[1]) - 1,
      parseInt(startDateParts[2])
    ));
    const endDate = new Date(Date.UTC(
      parseInt(endDateParts[0]),
      parseInt(endDateParts[1]) - 1,
      parseInt(endDateParts[2])
    ));

    setFormData({
      startDate,
      endDate,
      reason: request.reason,
      type: request.wfh_type as 'full_day' | 'half_day',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateRequest = async () => {
    if (!editingRequest) return;

    if (!formData.reason.trim() || formData.reason.trim().length < 10) {
      toast({
        title: 'Error',
        description: 'Reason must be at least 10 characters long',
        variant: 'destructive',
      });
      return;
    }

    const newStartDate = format(formData.startDate, 'yyyy-MM-dd');
    const newEndDate = format(formData.endDate, 'yyyy-MM-dd');

    const hasOverlap = wfhRequests.some(req => {
      if (req.id === editingRequest.id) return false;
      if (req.status !== 'pending' && req.status !== 'approved') return false;
      const reqStart = req.start_date;
      const reqEnd = req.end_date;
      return newStartDate <= reqEnd && newEndDate >= reqStart;
    });

    if (hasOverlap) {
      toast({
        title: 'Overlapping Request',
        description: 'You already have a WFH request for these dates.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData = {
        start_date: newStartDate,
        end_date: newEndDate,
        reason: formData.reason,
        wfh_type: (formData.type === 'full_day' ? 'Full Day' : 'Half Day') as 'Full Day' | 'Half Day',
      };

      await apiService.updateWFHRequest(editingRequest.id, updateData);

      toast({
        title: 'Success',
        description: 'WFH request updated successfully',
      });

      setIsEditDialogOpen(false);
      setEditingRequest(null);
      await refreshWFHRequests();
    } catch (error) {
      console.error('Error updating WFH request:', error);
      toast({
        title: 'Error',
        description: 'Failed to update WFH request',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRequest = (request: WFHRequest) => {
    setRequestToDelete(request);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRequest = async () => {
    if (!requestToDelete) return;

    setIsDeletingRequest(true);
    try {
      await apiService.deleteWFHRequest(requestToDelete.id);
      toast({
        title: 'Success',
        description: 'WFH request deleted successfully',
      });
      setIsDeleteDialogOpen(false);
      setRequestToDelete(null);
      await refreshWFHRequests();
    } catch (error) {
      console.error('Error deleting WFH request:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete WFH request',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingRequest(false);
    }
  };

  const handleApproveRequest = async (id: number) => {
    try {
      await approveRequest(id);
      toast({
        title: 'Success',
        description: 'WFH request approved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve WFH request',
        variant: 'destructive',
      });
    }
  };

  const handleRejectRequest = async (id: number, reason: string) => {
    try {
      await rejectRequest(id, reason);
      toast({
        title: 'Success',
        description: 'WFH request rejected successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject WFH request',
        variant: 'destructive',
      });
    }
  };

  const visiblePendingApprovals = useMemo(() => {
    if (!user?.role) return [];
    const currentUserRole = user.role.toLowerCase();

    return pendingApprovals.filter(req => {
      const requesterRole = req.requester_role?.toLowerCase() || 'employee';

      // Rule 1: HR/Manager requests -> Only Admin can act
      if (requesterRole === 'hr' || requesterRole === 'manager') {
        return currentUserRole === 'admin';
      }

      // Rule 2: TL/Employee requests -> Both Manager and HR can act
      if (requesterRole === 'team_lead' || requesterRole === 'employee') {
        return currentUserRole === 'manager' || currentUserRole === 'hr';
      }

      return false;
    });
  }, [pendingApprovals, user?.role]);

  const filteredRequests = useMemo(() => {
    let filtered = wfhRequests;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    // Apply duration filter
    if (myRequestsDurationFilter !== 'all') {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (myRequestsDurationFilter === 'current_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else if (myRequestsDurationFilter === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      } else if (myRequestsDurationFilter === 'last_3_months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = now;
      } else if (myRequestsDurationFilter === 'last_6_months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        endDate = now;
      } else if (myRequestsDurationFilter === 'last_year') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        endDate = now;
      } else if (myRequestsDurationFilter === 'custom' && myRequestsCustomDateRange.startDate && myRequestsCustomDateRange.endDate) {
        startDate = myRequestsCustomDateRange.startDate;
        endDate = new Date(myRequestsCustomDateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
      }

      if (startDate && endDate) {
        filtered = filtered.filter(req => {
          const reqDate = new Date(req.created_at);
          return reqDate >= startDate! && reqDate <= endDate!;
        });
      }
    }

    return filtered;
  }, [wfhRequests, statusFilter, myRequestsDurationFilter, myRequestsCustomDateRange]);

  const paginatedMyRequests = useMemo(() => {
    const start = (myRequestsPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, myRequestsPage, itemsPerPage]);

  const paginatedPendingApprovals = useMemo(() => {
    const start = (pendingApprovalsPage - 1) * itemsPerPage;
    return visiblePendingApprovals.slice(start, start + itemsPerPage);
  }, [visiblePendingApprovals, pendingApprovalsPage, itemsPerPage]);

  const filteredDecisions = useMemo(() => {
    let filtered = recentDecisions.filter(decision => decisionFilter === 'all' || decision.status === decisionFilter);

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(decision => {
        const role = decision.requester_role;
        const normalizedRole = role ? role.toLowerCase().replace(/\s+/g, '_') : 'employee';
        return normalizedRole === (roleFilter as string);
      });
    }

    // Apply duration filter
    if (durationFilter !== 'all') {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (durationFilter === 'current_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else if (durationFilter === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      } else if (durationFilter === 'last_3_months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = now;
      } else if (durationFilter === 'last_6_months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        endDate = now;
      } else if (durationFilter === 'last_year') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        endDate = now;
      } else if (durationFilter === 'custom' && customDateRange.startDate && customDateRange.endDate) {
        startDate = customDateRange.startDate;
        endDate = new Date(customDateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
      }

      if (startDate && endDate) {
        filtered = filtered.filter(decision => {
          const decisionDate = new Date(decision.updated_at);
          return decisionDate >= startDate! && decisionDate <= endDate!;
        });
      }
    }

    return filtered;
  }, [recentDecisions, decisionFilter, durationFilter, customDateRange, roleFilter]);

  const paginatedRecentDecisions = useMemo(() => {
    const start = (recentDecisionsPage - 1) * itemsPerPage;
    return filteredDecisions.slice(start, start + itemsPerPage);
  }, [filteredDecisions, recentDecisionsPage, itemsPerPage]);

  // Reset pages when filters change
  useEffect(() => { setMyRequestsPage(1); }, [statusFilter, myRequestsDurationFilter, myRequestsCustomDateRange]);
  useEffect(() => { setPendingApprovalsPage(1); }, [visiblePendingApprovals]);
  useEffect(() => { setRecentDecisionsPage(1); }, [decisionFilter, durationFilter, customDateRange, roleFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Home className="h-7 w-7 text-white" />
            </div>
            Work From Home Requests
          </h1>
          <p className="text-blue-100 mt-2">Manage your WFH requests and approvals</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-14 bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg p-1 gap-1 shadow-sm">
          <TabsTrigger
            value="my-requests"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
          >
            My Requests
          </TabsTrigger>
          {['admin', 'hr', 'manager'].includes(user?.role || '') && (
            <TabsTrigger
              value="pending-approvals"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
            >
              <ClockIcon className="h-4 w-4 mr-2" />
              Pending Approvals
              {visiblePendingApprovals.length > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                  {visiblePendingApprovals.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="recent-decisions"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
          >
            <History className="h-4 w-4 mr-2" />
            Recent Decisions
          </TabsTrigger>
        </TabsList>

        {/* My Requests Tab */}
        <TabsContent value="my-requests" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-semibold">My WFH Requests</CardTitle>
                    {wfhRequests.length > 0 && (
                      <Badge variant="outline" className="text-sm">
                        {wfhRequests.length}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>View and manage your work from home requests</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={myRequestsDurationFilter} onValueChange={(value: any) => {
                    setMyRequestsDurationFilter(value);
                    if (value === 'custom') {
                      setIsMyRequestsCustomRangeDialogOpen(true);
                    }
                  }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Duration</SelectItem>
                      <SelectItem value="current_month">Current Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                      <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                      <SelectItem value="last_year">Last 1 Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <ClockIcon className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-muted-foreground">Loading requests...</span>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground">No WFH requests found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedMyRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">
                                {request.start_date} - {request.end_date}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {request.wfh_type === 'full_day' ? 'Full Day' : 'Half Day'}
                            </Badge>
                            {getStatusBadge(request.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{request.reason}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Submitted: {formatDateTimeIST(new Date(request.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                            {request.status !== 'pending' && (
                              <span>Processed: {formatDateTimeIST(new Date(request.updated_at), 'dd MMM yyyy, hh:mm a')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          {request.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditRequest(request)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={() => handleDeleteRequest(request)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {filteredRequests.length > 0 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={myRequestsPage}
                    totalPages={Math.ceil(filteredRequests.length / itemsPerPage)}
                    totalItems={filteredRequests.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setMyRequestsPage}
                    onItemsPerPageChange={setItemsPerPage}
                    showItemsPerPage={true}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Approvals Tab */}
        <TabsContent value="pending-approvals" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <CardTitle className="text-xl font-semibold">Pending Approvals</CardTitle>
              <CardDescription>Review and process work from home requests</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoadingPending ? (
                <div className="flex items-center justify-center py-8">
                  <ClockIcon className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-muted-foreground">Loading pending requests...</span>
                </div>
              ) : visiblePendingApprovals.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending WFH requests to display</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedPendingApprovals.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">{request.employee_name}</span>
                            <Badge variant="secondary" className="capitalize">
                              {request.requester_role}
                            </Badge>
                            <Badge variant="outline">
                              {request.wfh_type === 'full_day' ? 'Full Day' : 'Half Day'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">
                              {request.start_date} - {request.end_date}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Reason: {request.reason}</p>

                          <div className="flex flex-wrap gap-4 mt-2">
                            {request.manager_approval && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-muted-foreground">Manager:</span>
                                <Badge variant={request.manager_approval === 'approved' ? 'default' : 'secondary'} className="text-[10px]">
                                  {request.manager_approval}
                                </Badge>
                              </div>
                            )}
                            {request.hr_approval && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-muted-foreground">HR:</span>
                                <Badge variant={request.hr_approval === 'approved' ? 'default' : 'secondary'} className="text-[10px]">
                                  {request.hr_approval}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApproveRequest(request.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              const reason = prompt("Please enter rejection reason:");
                              if (reason) handleRejectRequest(request.id, reason);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {visiblePendingApprovals.length > 0 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={pendingApprovalsPage}
                    totalPages={Math.ceil(visiblePendingApprovals.length / itemsPerPage)}
                    totalItems={visiblePendingApprovals.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setPendingApprovalsPage}
                    onItemsPerPageChange={setItemsPerPage}
                    showItemsPerPage={true}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Decisions Tab */}
        <TabsContent value="recent-decisions" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-semibold">Recent Decisions</CardTitle>
                    {recentDecisions.length > 0 && (
                      <Badge variant="outline" className="text-sm">
                        {recentDecisions.length}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>View recently approved and rejected WFH requests</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={durationFilter} onValueChange={(value: any) => {
                    setDurationFilter(value);
                    if (value === 'custom') {
                      setIsCustomRangeDialogOpen(true);
                    }
                  }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Duration</SelectItem>
                      <SelectItem value="current_month">Current Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                      <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                      <SelectItem value="last_year">Last 1 Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={decisionFilter} onValueChange={(value: any) => setDecisionFilter(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Decisions</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoadingDecisions ? (
                <div className="flex items-center justify-center py-8">
                  <ClockIcon className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-muted-foreground">Loading decisions...</span>
                </div>
              ) : recentDecisions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground">No decisions found yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedRecentDecisions.map((decision) => (
                    <div key={decision.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-medium text-sm">{decision.employee_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {decision.wfh_type === 'full_day' ? 'Full Day' : 'Half Day'}
                            </Badge>
                            {getStatusBadge(decision.status)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {decision.start_date} - {decision.end_date}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{decision.reason}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Decision: {formatDateTimeIST(new Date(decision.updated_at), 'dd MMM yyyy, hh:mm a')}</span>
                            {decision.approved_by && (
                              <span>By: {decision.approved_by}</span>
                            )}
                          </div>
                          {decision.rejection_reason && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mt-2">
                              <p className="text-sm text-red-800 dark:text-red-200">
                                <strong>Rejection Reason:</strong> {decision.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(decision.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {filteredDecisions.length > 0 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={recentDecisionsPage}
                    totalPages={Math.ceil(filteredDecisions.length / itemsPerPage)}
                    totalItems={filteredDecisions.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setRecentDecisionsPage}
                    onItemsPerPageChange={setItemsPerPage}
                    showItemsPerPage={true}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit WFH Request</DialogTitle>
            <DialogDescription>Update your work from home request details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <DatePicker
                  date={formData.startDate}
                  onDateChange={(date) => date && setFormData({ ...formData, startDate: date })}
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <DatePicker
                  date={formData.endDate}
                  onDateChange={(date) => date && setFormData({ ...formData, endDate: date })}
                  placeholder="Select end date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>WFH Type</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_day">Full Day</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>

              {/* Quick Select Suggestions */}
              <div className="flex flex-wrap gap-2 mb-2">
                {reasonTemplates.map((template, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-blue-100"
                    onClick={() => setFormData({ ...formData, reason: template })}
                  >
                    {template}
                  </Badge>
                ))}
              </div>

              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Reason for WFH request..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRequest}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? 'Updating...' : 'Update Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Date Range Dialog */}
      <Dialog open={isCustomRangeDialogOpen} onOpenChange={setIsCustomRangeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Custom Date Range</DialogTitle>
            <DialogDescription>
              Choose a start and end date to filter the decisions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="start-date" className="text-right">
                Start Date
              </Label>
              <div className="col-span-3">
                <DatePicker
                  date={customDateRange.startDate || undefined}
                  onDateChange={(date) => setCustomDateRange(prev => ({ ...prev, startDate: date || null }))}
                  placeholder="Pick start date"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="end-date" className="text-right">
                End Date
              </Label>
              <div className="col-span-3">
                <DatePicker
                  date={customDateRange.endDate || undefined}
                  onDateChange={(date) => setCustomDateRange(prev => ({ ...prev, endDate: date || null }))}
                  placeholder="Pick end date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCustomRangeDialogOpen(false)}>Apply Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* My Requests Custom Date Range Dialog */}
      <Dialog open={isMyRequestsCustomRangeDialogOpen} onOpenChange={setIsMyRequestsCustomRangeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Custom Date Range</DialogTitle>
            <DialogDescription>
              Choose a start and end date to filter your requests.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="req-start-date" className="text-right">
                Start Date
              </Label>
              <div className="col-span-3">
                <DatePicker
                  date={myRequestsCustomDateRange.startDate || undefined}
                  onDateChange={(date) => setMyRequestsCustomDateRange(prev => ({ ...prev, startDate: date || null }))}
                  placeholder="Pick start date"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="req-end-date" className="text-right">
                End Date
              </Label>
              <div className="col-span-3">
                <DatePicker
                  date={myRequestsCustomDateRange.endDate || undefined}
                  onDateChange={(date) => setMyRequestsCustomDateRange(prev => ({ ...prev, endDate: date || null }))}
                  placeholder="Pick end date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsMyRequestsCustomRangeDialogOpen(false)}>Apply Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete WFH Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this WFH request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRequest}
              disabled={isDeletingRequest}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingRequest ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WFHRequests;
