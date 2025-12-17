import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiService } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Calendar, Clock, Users, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
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

interface ShiftAssignment {
  assignment_id: number;
  user_id: number;
  shift_id: number;
  assignment_date: string;
  assigned_by: number | null;
  notes: string | null;
  is_reassigned: boolean;
  shift?: Shift;
}

interface UserShiftSchedule {
  user: {
    user_id: number;
    name: string;
    email: string;
    employee_id: string | null;
    department: string | null;
    designation: string | null;
  };
  assignments: ShiftAssignment[];
  upcoming_shifts: ShiftAssignment[];
  past_shifts: ShiftAssignment[];
}

export default function TeamShifts() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [schedule, setSchedule] = useState<UserShiftSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    loadSchedule();
  }, [startDate, endDate]);

  useEffect(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      setStartDate(format(weekStart, 'yyyy-MM-dd'));
      setEndDate(format(weekEnd, 'yyyy-MM-dd'));
    } else {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      setStartDate(format(monthStart, 'yyyy-MM-dd'));
      setEndDate(format(monthEnd, 'yyyy-MM-dd'));
    }
  }, [currentDate, viewMode]);

  const loadSchedule = async () => {
    if (!startDate || !endDate) return;
    
    try {
      setIsLoading(true);
      const data = await apiService.getMyShiftSchedule(startDate, endDate);
      setSchedule(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load shift schedule',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, direction === 'next' ? 7 : -7));
    } else {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      setCurrentDate(newDate);
    }
  };

  const getWeekDays = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate, { weekStartsOn: 1 }) });
  };

  const getMonthDays = () => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  };

  const getAssignmentForDate = (date: Date) => {
    if (!schedule) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    return schedule.assignments.find(a => a.assignment_date === dateStr);
  };

  const getStatusBadge = (assignment: ShiftAssignment | null) => {
    if (!assignment) return null;
    const assignmentDate = new Date(assignment.assignment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    assignmentDate.setHours(0, 0, 0, 0);
    
    if (assignmentDate < today) {
      return <Badge variant="outline" className="bg-gray-100">Past</Badge>;
    } else if (assignmentDate.getTime() === today.getTime()) {
      return <Badge className="bg-blue-500">Today</Badge>;
    } else {
      return <Badge variant="secondary">Upcoming</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-blue-600" />
            My Shift Schedule
          </h1>
          <p className="text-muted-foreground mt-1">
            View your assigned shifts and schedule
          </p>
        </div>
      </div>

      {/* View Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule View
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                Month
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <div className="font-semibold text-lg">
                {viewMode === 'week'
                  ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM dd')}`
                  : format(currentDate, 'MMMM yyyy')}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                className="text-xs"
              >
                Today
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Display */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">Loading schedule...</div>
          </CardContent>
        </Card>
      ) : schedule ? (
        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming Shifts</TabsTrigger>
            <TabsTrigger value="past">Past Shifts</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle>Calendar View</CardTitle>
                <CardDescription>
                  {viewMode === 'week' ? 'Weekly' : 'Monthly'} shift schedule
                </CardDescription>
              </CardHeader>
              <CardContent>
                {viewMode === 'week' ? (
                  <div className="grid grid-cols-7 gap-2">
                    {getWeekDays().map((day) => {
                      const assignment = getAssignmentForDate(day);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div
                          key={day.toISOString()}
                          className={`border rounded-lg p-3 min-h-[120px] ${
                            isToday ? 'bg-blue-50 dark:bg-blue-950 border-blue-300' : ''
                          }`}
                        >
                          <div className="text-sm font-medium mb-2">
                            {format(day, 'EEE')}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {format(day, 'MMM dd')}
                          </div>
                          {assignment ? (
                            <div className="space-y-1">
                              <div className="text-xs font-semibold">
                                {assignment.shift?.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {assignment.shift?.start_time} - {assignment.shift?.end_time}
                              </div>
                              {getStatusBadge(assignment)}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">No shift</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    <div className="col-span-7 grid grid-cols-7 gap-2 mb-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <div key={day} className="text-center text-sm font-semibold py-2">
                          {day}
                        </div>
                      ))}
                    </div>
                    {getMonthDays().map((day) => {
                      const assignment = getAssignmentForDate(day);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div
                          key={day.toISOString()}
                          className={`border rounded-lg p-2 min-h-[80px] ${
                            isToday ? 'bg-blue-50 dark:bg-blue-950 border-blue-300' : ''
                          }`}
                        >
                          <div className="text-xs font-medium mb-1">
                            {format(day, 'd')}
                          </div>
                          {assignment && (
                            <div className="text-xs">
                              <div className="font-semibold truncate">
                                {assignment.shift?.name}
                              </div>
                              <div className="text-muted-foreground">
                                {assignment.shift?.start_time}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upcoming">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Upcoming Shifts
                </CardTitle>
                <CardDescription>
                  Your scheduled shifts in the future
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schedule.upcoming_shifts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.upcoming_shifts.map((assignment) => (
                        <TableRow key={assignment.assignment_id}>
                          <TableCell className="font-medium">
                            {formatDateIST(assignment.assignment_date, 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>{assignment.shift?.name || 'N/A'}</TableCell>
                          <TableCell>
                            {assignment.shift?.start_time} - {assignment.shift?.end_time}
                          </TableCell>
                          <TableCell>{assignment.notes || '-'}</TableCell>
                          <TableCell>{getStatusBadge(assignment)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No upcoming shifts scheduled
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="past">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Past Shifts
                </CardTitle>
                <CardDescription>
                  Your completed shift assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schedule.past_shifts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.past_shifts.map((assignment) => (
                        <TableRow key={assignment.assignment_id}>
                          <TableCell className="font-medium">
                            {formatDateIST(assignment.assignment_date, 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>{assignment.shift?.name || 'N/A'}</TableCell>
                          <TableCell>
                            {assignment.shift?.start_time} - {assignment.shift?.end_time}
                          </TableCell>
                          <TableCell>{assignment.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No past shifts found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">No shift schedule available</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

