import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { formatDateIST } from '@/utils/timezone';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://staffly.space';

// Helper component for View Tasks button with proper role-based navigation
const ViewTasksButton: React.FC = () => {
  const { user } = useAuth();

  const handleViewTasks = () => {
    const taskRoute = user?.role ? `/${user.role}/tasks` : '/employee/tasks';
    window.location.href = taskRoute;
  };

  return (
    <Button onClick={handleViewTasks}>
      View Tasks
    </Button>
  );
};

interface TaskWarning {
  task_id: number;
  title: string;
  due_date: string;
  status: string;
  priority: string;
  warning_type: 'overdue' | 'due_today' | 'upcoming';
  message: string;
  days_until_deadline: number;
}

interface TaskDeadlineWarningsProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

const TaskDeadlineWarnings: React.FC<TaskDeadlineWarningsProps> = ({
  isOpen,
  onClose,
  userId
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [warnings, setWarnings] = useState<TaskWarning[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWarnings = async () => {
    if (!user?.id) return;

    const targetUserId = userId || user.id;
    const token = localStorage.getItem('token');

    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'Please log in again to check task deadlines.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/deadline-warnings/${targetUserId}`, {
        headers: {
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch warnings: ${response.status}`);
      }

      const data = await response.json();
      setWarnings(data.warnings || []);
    } catch (error) {
      console.error('Failed to fetch task warnings:', error);
      toast({
        title: 'Warning fetch failed',
        description: 'Unable to load task deadline warnings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWarnings();
    }
  }, [isOpen, user?.id, userId]);

  const getWarningIcon = (warningType: string) => {
    switch (warningType) {
      case 'overdue':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'due_today':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'upcoming':
        return <Calendar className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getWarningColor = (warningType: string) => {
    switch (warningType) {
      case 'overdue':
        return 'bg-red-50 border-red-200';
      case 'due_today':
        return 'bg-orange-50 border-orange-200';
      case 'upcoming':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const priorityColors = {
      'Low': 'bg-green-100 text-green-800',
      'Medium': 'bg-blue-100 text-blue-800',
      'High': 'bg-orange-100 text-orange-800',
      'Urgent': 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={priorityColors[priority as keyof typeof priorityColors] || 'bg-gray-100 text-gray-800'}>
        {priority}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDateIST(dateString, 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const hasWarnings = warnings.length > 0;
  const overdueCount = warnings.filter(w => w.warning_type === 'overdue').length;
  const dueTodayCount = warnings.filter(w => w.warning_type === 'due_today').length;
  const upcomingCount = warnings.filter(w => w.warning_type === 'upcoming').length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Task Deadline Warnings
          </DialogTitle>
          <DialogDescription>
            {hasWarnings
              ? `You have ${warnings.length} task(s) with upcoming or overdue deadlines.`
              : 'All your tasks are on track! No deadline warnings at this time.'
            }
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading warnings...</span>
          </div>
        ) : hasWarnings ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              {overdueCount > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
                    <div className="text-sm text-red-700">Overdue</div>
                  </CardContent>
                </Card>
              )}
              {dueTodayCount > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{dueTodayCount}</div>
                    <div className="text-sm text-orange-700">Due Today</div>
                  </CardContent>
                </Card>
              )}
              {upcomingCount > 0 && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{upcomingCount}</div>
                    <div className="text-sm text-yellow-700">Upcoming</div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Warning List */}
            <div className="space-y-3">
              {warnings.map((warning) => (
                <Card key={warning.task_id} className={`border ${getWarningColor(warning.warning_type)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getWarningIcon(warning.warning_type)}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">
                            {warning.title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-2">
                            {warning.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Due: {formatDate(warning.due_date)}</span>
                            <span>Status: {warning.status}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getPriorityBadge(warning.priority)}
                        {warning.warning_type === 'due_today' && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            Due Today!
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Good!</h3>
            <p className="text-gray-600">
              You don't have any tasks with upcoming deadlines. Keep up the great work!
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {hasWarnings && (
            <ViewTasksButton />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDeadlineWarnings;