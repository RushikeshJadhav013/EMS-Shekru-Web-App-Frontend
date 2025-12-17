import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiService } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Calendar, CalendarDays, Clock, Users, Plus, Edit, Trash2, UserPlus, ArrowRight, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { formatIST, formatDateIST, nowIST } from '@/utils/timezone';

interface Shift {
  shift_id: number;
  name: string;
  start_time: string;
  end_time: string;
  department: string | null;
  description: string | null;
  is_active: boolean;
}

interface User {
  user_id: number;
  name: string;
  email: string;
  employee_id: string | null;
  department: string | null;
  designation: string | null;
}

interface ShiftAssignment {
  assignment_id: number;
  user_id: number;
  shift_id: number;
  assignment_date: string;
  assigned_by: number | null;
  notes: string | null;
  is_reassigned: boolean;
  user?: User;
  shift?: Shift;
}

interface DepartmentSchedule {
  department: string;
  date: string;
  shifts: Array<{
    shift: Shift;
    assignments: ShiftAssignment[];
    total_assigned: number;
  }>;
  users_on_leave: User[];
  unassigned_users: User[];
}

interface DepartmentScheduleRange {
  department: string;
  start_date: string;
  end_date: string;
  days: DepartmentSchedule[];
}

export default function ShiftScheduleManagement() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedule, setSchedule] = useState<DepartmentSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateIST(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [weekStartDate, setWeekStartDate] = useState<string>(formatDateIST(new Date(), 'yyyy-MM-dd'));
  const [weekEndDate, setWeekEndDate] = useState<string>(formatDateIST(addDays(new Date(), 6), 'yyyy-MM-dd'));
  const [weeklySchedule, setWeeklySchedule] = useState<DepartmentScheduleRange | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  
  // Dialogs
  const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);
  const [isEditShiftDialogOpen, setIsEditShiftDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<ShiftAssignment | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  
  // Form data
  const [shiftFormData, setShiftFormData] = useState({
    name: '',
    start_time: '09:00',
    end_time: '18:00',
    description: '',
    is_active: true,
  });
  
  const [assignFormData, setAssignFormData] = useState({
    shift_id: 0,
    assignment_date: selectedDate,
    notes: '',
  });

  useEffect(() => {
    loadShifts();
    loadSchedule();
  }, [selectedDate]);

  const loadShifts = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getShifts();
      setShifts(data.filter((s: Shift) => s.is_active));
    } catch (error: any) {
      // Only show toast for non-network errors
      if (error.message && !error.message.includes('Cannot connect to backend')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load shifts',
          variant: 'destructive',
        });
      }
      // Set empty array on error to prevent UI issues
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchedule = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getDepartmentSchedule(selectedDate);
      setSchedule(data);
    } catch (error: any) {
      // Only show toast for non-network errors
      if (error.message && !error.message.includes('Cannot connect to backend')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load schedule',
          variant: 'destructive',
        });
      }
      // Set null on error to prevent UI issues
      setSchedule(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWeeklySchedule = async () => {
    if (!weekStartDate) {
      toast({
        title: 'Validation Error',
        description: 'Please select a start date for the week',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsWeeklyLoading(true);
      const data = await apiService.getDepartmentScheduleWeek(weekStartDate, weekEndDate);
      setWeeklySchedule(data);
    } catch (error: any) {
      if (error.message && !error.message.includes('Cannot connect to backend')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load weekly schedule',
          variant: 'destructive',
        });
      }
      setWeeklySchedule(null);
    } finally {
      setIsWeeklyLoading(false);
    }
  };

  const validateShiftData = () => {
    if (!shiftFormData.name || !shiftFormData.start_time || !shiftFormData.end_time) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return false;
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(shiftFormData.start_time) || !timeRegex.test(shiftFormData.end_time)) {
      toast({
        title: 'Validation Error',
        description: 'Please enter valid time in HH:MM format',
        variant: 'destructive',
      });
      return false;
    }

    // Validate shift duration (supports overnight shifts)
    const [startHour, startMin] = shiftFormData.start_time.split(':').map(Number);
    const [endHour, endMin] = shiftFormData.end_time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    let durationMinutes = endMinutes - startMinutes;

    if (durationMinutes <= 0) {
      durationMinutes += 24 * 60; // allow overnight shifts by wrapping to next day
    }

    if (durationMinutes <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Shift duration must be greater than 0 minutes',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const resetShiftForm = () => {
    setShiftFormData({
      name: '',
      start_time: '09:00',
      end_time: '18:00',
      description: '',
      is_active: true,
    });
    setSelectedShift(null);
  };

  const openEditDialog = (shift: Shift) => {
    setSelectedShift(shift);
    setShiftFormData({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      description: shift.description || '',
      is_active: shift.is_active,
    });
    setIsEditShiftDialogOpen(true);
  };

  const handleCreateShift = async () => {
    if (!validateShiftData()) return;

    try {
      setIsCreating(true);
      console.log('Creating shift with data:', shiftFormData);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout: Backend server may not be responding')), 10000)
      );
      
      const createPromise = apiService.createShift(shiftFormData);
      const result = await Promise.race([createPromise, timeoutPromise]);
      
      console.log('Shift created successfully:', result);
      toast({
        title: 'Success',
        description: 'Shift created successfully',
      });
      setIsShiftDialogOpen(false);
      resetShiftForm();
      loadShifts();
    } catch (error: any) {
      console.error('Error creating shift:', error);
      const errorMessage = error.message || 'Failed to create shift';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateShift = async () => {
    if (!selectedShift || !validateShiftData()) return;

    try {
      setIsUpdating(true);
      console.log('Updating shift:', selectedShift.shift_id, shiftFormData);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout: Backend server may not be responding')), 10000)
      );
      
      const updatePromise = apiService.updateShift(selectedShift.shift_id, shiftFormData);
      const result = await Promise.race([updatePromise, timeoutPromise]);
      
      console.log('Shift updated successfully:', result);
      toast({
        title: 'Success',
        description: 'Shift updated successfully',
      });
      setIsEditShiftDialogOpen(false);
      resetShiftForm();
      loadShifts();
    } catch (error: any) {
      console.error('Error updating shift:', error);
      const errorMessage = error.message || 'Failed to update shift';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    if (!confirm('Are you sure you want to delete this shift? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(shiftId);
      await apiService.deleteShift(shiftId);
      toast({
        title: 'Success',
        description: 'Shift deleted successfully',
      });
      loadShifts();
    } catch (error: any) {
      console.error('Error deleting shift:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete shift',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleAssignShift = async () => {
    if (!assignFormData.shift_id || !selectedUsers.length) {
      toast({
        title: 'Validation Error',
        description: 'Please select a shift and at least one user',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);
      if (selectedUsers.length === 1) {
        await apiService.assignShift({
          user_id: selectedUsers[0],
          shift_id: assignFormData.shift_id,
          assignment_date: assignFormData.assignment_date,
          notes: assignFormData.notes || undefined,
        });
      } else {
        await apiService.bulkAssignShift({
          user_ids: selectedUsers,
          shift_id: assignFormData.shift_id,
          assignment_date: assignFormData.assignment_date,
          notes: assignFormData.notes || undefined,
        });
      }
      toast({
        title: 'Success',
        description: 'Shift assigned successfully',
      });
      setIsAssignDialogOpen(false);
      setSelectedUsers([]);
      setAssignFormData({
        shift_id: 0,
        assignment_date: selectedDate,
        notes: '',
      });
      loadSchedule();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign shift',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleReassignShift = async (assignmentId: number, newShiftId: number) => {
    try {
      await apiService.updateShiftAssignment(assignmentId, {
        shift_id: newShiftId,
      });
      toast({
        title: 'Success',
        description: 'Shift reassigned successfully',
      });
      setIsReassignDialogOpen(false);
      loadSchedule();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reassign shift',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!assignmentId || assignmentId <= 0) {
      toast({
        title: 'Error',
        description: 'Invalid assignment ID',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('Are you sure you want to remove this shift assignment?')) {
      return;
    }

    try {
      console.log('Deleting assignment with ID:', assignmentId);
      await apiService.deleteShiftAssignment(assignmentId);
      toast({
        title: 'Success',
        description: 'Assignment removed successfully',
      });
      loadSchedule();
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove assignment',
        variant: 'destructive',
      });
    }
  };

  const openAssignDialog = (shiftId?: number) => {
    if (shiftId) {
      setAssignFormData({ ...assignFormData, shift_id: shiftId });
    }
    // Ensure shifts are loaded before opening dialog
    if (shifts.length === 0) {
      loadShifts();
    }
    setIsAssignDialogOpen(true);
  };

  const openReassignDialog = (assignment: ShiftAssignment) => {
    setSelectedAssignment(assignment);
    setIsReassignDialogOpen(true);
  };

  const getAvailableUsers = () => {
    if (!schedule) return [];
    const assignedUserIds = new Set(
      schedule.shifts.flatMap(s => s.assignments.map(a => a.user_id))
    );
    return schedule.unassigned_users.filter(u => !assignedUserIds.has(u.user_id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" />
            Shift Schedule Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage shift schedules and assignments for your department
          </p>
        </div>
        <Dialog open={isShiftDialogOpen} onOpenChange={(open) => {
          setIsShiftDialogOpen(open);
          if (!open) resetShiftForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
              <Plus className="h-4 w-4" />
              Create Shift
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Shift</DialogTitle>
              <DialogDescription>
                Define a new shift for your department
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Shift Name *</Label>
                <Input
                  id="name"
                  value={shiftFormData.name}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, name: e.target.value })}
                  placeholder="e.g., Morning Shift, Evening Shift"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={shiftFormData.start_time}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time *</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={shiftFormData.end_time}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={shiftFormData.description}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setIsShiftDialogOpen(false);
                  resetShiftForm();
                }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateShift} disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Shift'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Shift Dialog */}
        <Dialog open={isEditShiftDialogOpen} onOpenChange={(open) => {
          setIsEditShiftDialogOpen(open);
          if (!open) resetShiftForm();
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Shift</DialogTitle>
              <DialogDescription>
                Update shift details for your department
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_name">Shift Name *</Label>
                <Input
                  id="edit_name"
                  value={shiftFormData.name}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, name: e.target.value })}
                  placeholder="e.g., Morning Shift, Evening Shift"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_start_time">Start Time *</Label>
                  <Input
                    id="edit_start_time"
                    type="time"
                    value={shiftFormData.start_time}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_end_time">End Time *</Label>
                  <Input
                    id="edit_end_time"
                    type="time"
                    value={shiftFormData.end_time}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_description">Description</Label>
                <Input
                  id="edit_description"
                  value={shiftFormData.description}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={shiftFormData.is_active}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit_is_active" className="cursor-pointer">
                  Active Shift
                </Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setIsEditShiftDialogOpen(false);
                  resetShiftForm();
                }}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateShift} disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Update Shift'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'daily' | 'weekly')} className="space-y-6">
        <TabsList>
          <TabsTrigger value="daily">Daily View</TabsTrigger>
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          {/* Date Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="max-w-xs"
                />
                <Button onClick={loadSchedule} variant="outline">
                  Load Schedule
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Empty State - No Schedule Data */}
          {!schedule && !isLoading && (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Schedule Data</h3>
                <p className="text-muted-foreground mb-4">
                  Unable to load shift schedule. Please check your connection and try again.
                </p>
                <Button onClick={() => { loadShifts(); loadSchedule(); }} variant="outline">
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Schedule View */}
          {schedule && (
            <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList>
            <TabsTrigger value="schedule">Shift Schedule</TabsTrigger>
            <TabsTrigger value="leaves">On Leave</TabsTrigger>
            <TabsTrigger value="unassigned">Unassigned Users</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
            {schedule.shifts.map((shiftData) => (
              <Card key={shiftData.shift.shift_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {shiftData.shift.name}
                      </CardTitle>
                      <CardDescription>
                        {shiftData.shift.start_time} - {shiftData.shift.end_time}
                        {shiftData.shift.description && ` • ${shiftData.shift.description}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {shiftData.total_assigned} assigned
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAssignDialog(shiftData.shift.shift_id)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Assign Users
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {shiftData.assignments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Employee ID</TableHead>
                          <TableHead>Designation</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shiftData.assignments.map((assignment) => (
                          <TableRow key={assignment.assignment_id}>
                            <TableCell className="font-medium">
                              {assignment.user?.name || 'Unknown'}
                            </TableCell>
                            <TableCell>{assignment.user?.employee_id || 'N/A'}</TableCell>
                            <TableCell>{assignment.user?.designation || 'N/A'}</TableCell>
                            <TableCell>{assignment.notes || '-'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openReassignDialog(assignment)}
                                >
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  Reassign
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteAssignment(assignment.assignment_id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No assignments for this shift
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="leaves">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Users on Leave
                </CardTitle>
                <CardDescription>
                  Users who are on approved leave for {formatDateIST(selectedDate, 'MMM dd, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schedule.users_on_leave.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.users_on_leave.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.employee_id || 'N/A'}</TableCell>
                          <TableCell>{user.designation || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-orange-600">
                              On Leave
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No users on leave for this date
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unassigned">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Unassigned Users
                </CardTitle>
                <CardDescription>
                  Users who are not assigned to any shift for {formatDateIST(selectedDate, 'MMM dd, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schedule.unassigned_users.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.unassigned_users.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.employee_id || 'N/A'}</TableCell>
                          <TableCell>{user.designation || 'N/A'}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUsers([user.user_id]);
                                setIsAssignDialogOpen(true);
                              }}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Assign
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    All users are assigned to shifts
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Select Week Range
              </CardTitle>
              <CardDescription>
                Choose the start and end dates to generate a weekly calendar of shifts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="week_start">Week Start *</Label>
                  <Input
                    id="week_start"
                    type="date"
                    value={weekStartDate}
                    onChange={(e) => {
                      setWeekStartDate(e.target.value);
                      if (!weekEndDate) {
                        setWeekEndDate(format(addDays(new Date(e.target.value), 6), 'yyyy-MM-dd'));
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="week_end">Week End</Label>
                  <Input
                    id="week_end"
                    type="date"
                    value={weekEndDate}
                    min={weekStartDate}
                    onChange={(e) => setWeekEndDate(e.target.value)}
                  />
                </div>
                <Button onClick={loadWeeklySchedule} disabled={isWeeklyLoading}>
                  {isWeeklyLoading ? 'Loading...' : 'Load Weekly Schedule'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {isWeeklyLoading && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
                Generating weekly schedule...
              </CardContent>
            </Card>
          )}

          {!isWeeklyLoading && weeklySchedule && (
            <div className="space-y-4">
              <Card className="border border-dashed">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    {formatDateIST(weeklySchedule.start_date, 'MMM dd, yyyy')} - {formatDateIST(weeklySchedule.end_date, 'MMM dd, yyyy')}
                  </CardTitle>
                  <CardDescription>
                    {weeklySchedule.days.length} days of coverage • {weeklySchedule.department} department
                  </CardDescription>
                </CardHeader>
              </Card>

              {weeklySchedule.days.map((day) => (
                <Card key={day.date}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          {formatDateIST(day.date, 'EEEE, MMM dd')}
                        </CardTitle>
                        <CardDescription>
                          {day.shifts.length} shifts • {day.users_on_leave.length} on leave
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">
                        {day.unassigned_users.length} unassigned
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {day.shifts.map((shiftData) => (
                      <div key={`${day.date}-${shiftData.shift.shift_id}`} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{shiftData.shift.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {shiftData.shift.start_time} - {shiftData.shift.end_time}
                              {shiftData.shift.description && ` • ${shiftData.shift.description}`}
                            </p>
                          </div>
                          <Badge variant="outline">{shiftData.total_assigned} assigned</Badge>
                        </div>
                        {shiftData.assignments.length > 0 ? (
                          <div className="space-y-2">
                            {shiftData.assignments.map((assignment) => (
                              <div key={assignment.assignment_id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                                <div>
                                  <p className="font-medium">{assignment.user?.name || 'Unknown'}</p>
                                  <p className="text-muted-foreground text-xs">
                                    {assignment.user?.designation || 'N/A'}
                                  </p>
                                </div>
                                <span className="text-xs text-muted-foreground">{assignment.user?.employee_id || 'N/A'}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No assignments for this shift</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isWeeklyLoading && !weeklySchedule && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a start date and generate a weekly schedule to see coverage.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* All Shifts List */}
      <Card className="border-2 border-blue-100 dark:border-blue-900 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                All Shifts ({shifts.length})
              </CardTitle>
              <CardDescription className="mt-2">
                View and manage all shifts for your department
              </CardDescription>
            </div>
            <Button onClick={loadShifts} variant="outline" size="sm" disabled={isLoading} className="shadow-sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
              <p>Loading shifts...</p>
            </div>
          ) : shifts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shifts.map((shift) => (
                <Card key={shift.shift_id} className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-900 dark:to-blue-950/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold">{shift.name}</CardTitle>
                      <Badge variant={shift.is_active ? "default" : "secondary"} className="shadow-sm">
                        {shift.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm">
                      {shift.department || "Global Shift"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-lg">
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-blue-700 dark:text-blue-300">{shift.start_time}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="font-semibold text-blue-700 dark:text-blue-300">{shift.end_time}</span>
                      </div>
                      {shift.description && (
                        <p className="text-sm text-muted-foreground italic">{shift.description}</p>
                      )}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(shift)}
                          className="flex-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteShift(shift.shift_id)}
                          disabled={isDeleting === shift.shift_id}
                          className="flex-1 hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {isDeleting === shift.shift_id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No shifts created yet</p>
              <p className="text-sm">Create your first shift to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Users Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Users to Shift</DialogTitle>
            <DialogDescription>
              Select users to assign to a shift
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shift_select">Shift *</Label>
              {shifts.length === 0 ? (
                <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    No shifts available. Please create a shift first.
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={loadShifts}
                    className="mt-2"
                  >
                    Reload Shifts
                  </Button>
                </div>
              ) : (
                <Select
                  value={assignFormData.shift_id.toString()}
                  onValueChange={(value) => setAssignFormData({ ...assignFormData, shift_id: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.shift_id} value={shift.shift_id.toString()}>
                        {shift.name} ({shift.start_time} - {shift.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment_date">Date *</Label>
              <Input
                id="assignment_date"
                type="date"
                value={assignFormData.assignment_date}
                onChange={(e) => setAssignFormData({ ...assignFormData, assignment_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Available Users</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                {getAvailableUsers().map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.employee_id || 'N/A'} • {user.designation || 'N/A'}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedUsers.includes(user.user_id) ? 'default' : 'outline'}
                      onClick={() => {
                        if (selectedUsers.includes(user.user_id)) {
                          setSelectedUsers(selectedUsers.filter(id => id !== user.user_id));
                        } else {
                          setSelectedUsers([...selectedUsers, user.user_id]);
                        }
                      }}
                    >
                      {selectedUsers.includes(user.user_id) ? 'Selected' : 'Select'}
                    </Button>
                  </div>
                ))}
                {getAvailableUsers().length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    No available users
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={assignFormData.notes}
                onChange={(e) => setAssignFormData({ ...assignFormData, notes: e.target.value })}
                placeholder="Optional notes about this assignment"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignShift} disabled={isCreating || !selectedUsers.length}>
                {isCreating ? 'Assigning...' : `Assign ${selectedUsers.length} User(s)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Shift</DialogTitle>
            <DialogDescription>
              Move this user to a different shift
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAssignment && (
              <>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium">{selectedAssignment.user?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Currently assigned to: {selectedAssignment.shift?.name}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>New Shift *</Label>
                  <Select
                    onValueChange={(value) => {
                      if (selectedAssignment) {
                        handleReassignShift(selectedAssignment.assignment_id, parseInt(value));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a new shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts
                        .filter(s => s.shift_id !== selectedAssignment.shift_id)
                        .map((shift) => (
                          <SelectItem key={shift.shift_id} value={shift.shift_id.toString()}>
                            {shift.name} ({shift.start_time} - {shift.end_time})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

