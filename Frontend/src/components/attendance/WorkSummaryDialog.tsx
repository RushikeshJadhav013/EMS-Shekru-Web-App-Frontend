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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, FileText, Send } from 'lucide-react';
import { formatDateIST } from '@/utils/timezone';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://staffly.space';

// Allow only letters, numbers, spaces, and new lines (no special characters)
const sanitizeAlphaNumText = (value: string) => value.replace(/[^a-zA-Z0-9 \n]/g, '');

interface OverdueTask {
  task_id: number;
  title: string;
  due_date: string;
  status: string;
  priority: string;
}

interface WorkSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (workSummary: string, deadlineReason?: string) => Promise<void>;
  isSubmitting?: boolean;
}

const WorkSummaryDialog: React.FC<WorkSummaryDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workSummary, setWorkSummary] = useState('');
  const [deadlineReason, setDeadlineReason] = useState('');
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [reasonError, setReasonError] = useState('');

  const fetchOverdueTasks = async () => {
    if (!user?.id) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    setIsLoadingTasks(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/deadline-warnings/${user.id}`, {
        headers: {
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const todayTasks = data.warnings?.filter((w: any) => w.warning_type === 'due_today') || [];
        setOverdueTasks(todayTasks);
      }
    } catch (error) {
      console.error('Failed to fetch overdue tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOverdueTasks();
      setWorkSummary('');
      setDeadlineReason('');
      setReasonError('');
    }
  }, [isOpen, user?.id]);

  const validateDeadlineReason = (reason: string): string => {
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      return 'Please provide a reason for not completing the task(s) due today.';
    }

    if (trimmedReason.length < 15) {
      return 'Reason must be at least 15 characters long.';
    }

    if (/^\d+$/.test(trimmedReason)) {
      return 'Reason cannot contain only numbers. Please provide a meaningful explanation.';
    }

    return '';
  };

  const handleDeadlineReasonChange = (value: string) => {
    const cleaned = sanitizeAlphaNumText(value);
    setDeadlineReason(cleaned);
    if (overdueTasks.length > 0) {
      const error = validateDeadlineReason(cleaned);
      setReasonError(error);
    }
  };

  const handleSubmit = async () => {
    if (!workSummary.trim()) {
      toast({
        title: 'Work summary required',
        description: 'Please provide a summary of your work before checking out.',
        variant: 'destructive',
      });
      return;
    }

    // Validate deadline reason if there are overdue tasks
    if (overdueTasks.length > 0) {
      const error = validateDeadlineReason(deadlineReason);
      if (error) {
        setReasonError(error);
        toast({
          title: 'Deadline reason required',
          description: error,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      await onSubmit(workSummary.trim(), overdueTasks.length > 0 ? deadlineReason.trim() : undefined);
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const hasOverdueTasks = overdueTasks.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Work Summary
          </DialogTitle>
          <DialogDescription>
            Please provide a summary of your work before checking out.
            {hasOverdueTasks && ' You also need to explain why tasks due today are not completed.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overdue Tasks Warning */}
          {hasOverdueTasks && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-5 w-5" />
                  Tasks Due Today
                </CardTitle>
                <CardDescription className="text-orange-700">
                  You have {overdueTasks.length} task(s) due today that are not completed.
                  Please provide a reason below.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {overdueTasks.map((task) => (
                    <div key={task.task_id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{task.title}</h4>
                        <p className="text-sm text-gray-600">
                          Due: {formatDateIST(task.due_date, 'MMM dd, yyyy')} • Status: {task.status}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Work Summary */}
          <div className="space-y-2">
            <Label htmlFor="work-summary" className="text-sm font-medium">
              Work Summary *
            </Label>
            <Textarea
              id="work-summary"
              placeholder="Describe what you accomplished today, key tasks completed, challenges faced, and any important updates..."
              value={workSummary}
              onChange={(e) => setWorkSummary(sanitizeAlphaNumText(e.target.value))}
              className="min-h-[120px] resize-none"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500">
              Provide a brief summary of your work activities for today.
            </p>
          </div>

          {/* Deadline Reason (only if there are overdue tasks) */}
          {hasOverdueTasks && (
            <div className="space-y-2">
              <Label htmlFor="deadline-reason" className="text-sm font-medium text-orange-800">
                Reason for Incomplete Tasks *
              </Label>
              <Textarea
                id="deadline-reason"
                placeholder="Explain why the task(s) due today could not be completed. Be specific about the challenges, dependencies, or circumstances that prevented completion..."
                value={deadlineReason}
                onChange={(e) => handleDeadlineReasonChange(e.target.value)}
                className={`min-h-[100px] resize-none ${reasonError ? 'border-red-300 focus:border-red-500' : ''}`}
                disabled={isSubmitting}
              />
              {reasonError && (
                <p className="text-sm text-red-600">{reasonError}</p>
              )}
              <p className="text-xs text-gray-500">
                Minimum 15 characters required. Cannot contain only numbers.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoadingTasks && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Checking for overdue tasks...</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !workSummary.trim() || (hasOverdueTasks && !!reasonError)}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Checking Out...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Check Out
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkSummaryDialog;