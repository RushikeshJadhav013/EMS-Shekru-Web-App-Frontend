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
import { Calendar, Home, Plus, Trash2, Edit, CheckCircle, XCircle, Clock as ClockIcon, AlertCircle, History } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiService } from '@/lib/api';
import { format } from 'date-fns';
import { formatDateIST, formatDateTimeIST } from '@/utils/timezone';

interface WFHRequest {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  wfh_type: 'full_day' | 'half_day';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  approved_by?: string;
}

const WFHRequests: React.FC = () => {
  const { user } = useAuth();
  const { wfhRequests: contextWfhRequests, isLoading: contextIsLoading, refreshWFHRequests, recentDecisions, isLoadingDecisions, refreshRecentDecisions } = useWFH();

  // State management
  const [wfhRequests, setWfhRequests] = useState<WFHRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-requests' | 'submit' | 'recent-decisions'>('my-requests');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [decisionFilter, setDecisionFilter] = useState<'all' | 'approved' | 'rejected'>('all');

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

  // Load WFH requests on mount and when component becomes visible
  useEffect(() => {
    // Ensure requests are loaded when component mounts
    refreshWFHRequests();
    refreshRecentDecisions();
  }, [refreshWFHRequests, refreshRecentDecisions]);

  const handleSubmitRequest = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User information not found',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.reason.trim() || formData.reason.trim().length < 10) {
      toast({
        title: 'Error',
        description: 'Reason must be at least 10 characters long',
        variant: 'destructive',
      });
      return;
    }

    if (formData.startDate > formData.endDate) {
      toast({
        title: 'Error',
        description: 'Start date must be before end date',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const wfhData = {
        employee_id: String(user.id),
        start_date: format(formData.startDate, 'yyyy-MM-dd'),
        end_date: format(formData.endDate, 'yyyy-MM-dd'),
        reason: formData.reason,
        wfh_type: (formData.type === 'full_day' ? 'Full Day' : 'Half Day') as 'Full Day' | 'Half Day',
      };

      await apiService.submitWFHRequest(wfhData);

      toast({
        title: 'Success',
        description: 'WFH request submitted successfully',
      });

      // Reset form
      setFormData({
        startDate: new Date(),
        endDate: new Date(),
        reason: '',
        type: 'full_day',
      });

      // Reload requests from context
      await refreshWFHRequests();
      
      setActiveTab('my-requests');
    } catch (error) {
      console.error('Error submitting WFH request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit WFH request',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRequest = (request: WFHRequest) => {
    setEditingRequest(request);
    setFormData({
      startDate: new Date(request.start_date),
      endDate: new Date(request.end_date),
      reason: request.reason,
      type: request.wfh_type,
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

    setIsSubmitting(true);
    try {
      const updateData = {
        start_date: format(formData.startDate, 'yyyy-MM-dd'),
        end_date: format(formData.endDate, 'yyyy-MM-dd'),
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
      
      // Reload requests from context
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
      
      // Reload requests from context
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

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return wfhRequests;
    return wfhRequests.filter(req => req.status === statusFilter);
  }, [wfhRequests, statusFilter]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-orange-600 via-red-700 to-pink-800 text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Home className="h-7 w-7 text-white" />
            </div>
            Work From Home Requests
          </h1>
          <p className="text-orange-100 mt-2">Manage your WFH requests and approvals</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-14 bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg p-1 gap-1 shadow-sm">
          <TabsTrigger
            value="my-requests"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
          >
            My Requests
          </TabsTrigger>
          <TabsTrigger
            value="submit"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
          >
            <Plus className="h-4 w-4 mr-2" />
            Submit Request
          </TabsTrigger>
          <TabsTrigger
            value="recent-decisions"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
          >
            <History className="h-4 w-4 mr-2" />
            Recent Decisions
          </TabsTrigger>
        </TabsList>

        {/* My Requests Tab */}
        <TabsContent value="my-requests" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold">My WFH Requests</CardTitle>
                  <CardDescription>View and manage your work from home requests</CardDescription>
                </div>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Requests</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <ClockIcon className="h-8 w-8 animate-spin text-orange-600" />
                  <span className="ml-2 text-muted-foreground">Loading requests...</span>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground">No WFH requests found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-orange-600" />
                              <span className="font-medium">
                                {formatDateIST(new Date(request.start_date), 'dd MMM yyyy')} - {formatDateIST(new Date(request.end_date), 'dd MMM yyyy')}
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
                          {request.rejection_reason && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mt-2">
                              <p className="text-sm text-red-800 dark:text-red-200">
                                <strong>Rejection Reason:</strong> {request.rejection_reason}
                              </p>
                            </div>
                          )}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Submit Request Tab */}
        <TabsContent value="submit" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <CardTitle className="text-xl font-semibold">Submit WFH Request</CardTitle>
              <CardDescription>Request to work from home for specific dates</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
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
                <Label>Reason *</Label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Please provide a reason for your WFH request (minimum 10 characters)..."
                  rows={4}
                />
                <div className="flex justify-between text-sm">
                  <span className={formData.reason.trim().length < 10 ? 'text-red-500' : 'text-green-600'}>
                    {formData.reason.trim().length < 10
                      ? `${10 - formData.reason.trim().length} more characters needed`
                      : `${formData.reason.trim().length}/500 characters`}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSubmitRequest}
                disabled={isSubmitting || formData.reason.trim().length < 10}
                className="gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-md disabled:opacity-50"
              >
                <Home className="h-4 w-4" />
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Decisions Tab */}
        <TabsContent value="recent-decisions" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold">Recent Decisions</CardTitle>
                  <CardDescription>View recently approved and rejected WFH requests</CardDescription>
                </div>
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
            </CardHeader>
            <CardContent className="pt-6">
              {isLoadingDecisions ? (
                <div className="flex items-center justify-center py-8">
                  <ClockIcon className="h-8 w-8 animate-spin text-orange-600" />
                  <span className="ml-2 text-muted-foreground">Loading decisions...</span>
                </div>
              ) : recentDecisions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground">No decisions found yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDecisions
                    .filter(decision => decisionFilter === 'all' || decision.status === decisionFilter)
                    .map((decision) => (
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
                                {formatDateIST(new Date(decision.start_date), 'dd MMM yyyy')} - {formatDateIST(new Date(decision.end_date), 'dd MMM yyyy')}
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
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            >
              {isSubmitting ? 'Updating...' : 'Update Request'}
            </Button>
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
