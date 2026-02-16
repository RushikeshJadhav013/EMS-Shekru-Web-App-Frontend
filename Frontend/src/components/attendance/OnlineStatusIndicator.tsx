import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, Timer, History, User } from 'lucide-react';
import { formatDateTimeIST } from '@/utils/timezone';

interface OnlineStatusIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  clickable?: boolean;
  attendanceId?: number;
  userId?: number;
  userName?: string;
}

interface StatusHistoryItem {
  id: number;
  is_online: boolean;
  reason?: string;
  timestamp: string;
}

export const OnlineStatusIndicator: React.FC<OnlineStatusIndicatorProps> = ({
  isOnline,
  size = 'md',
  showLabel = false,
  clickable = false,
  attendanceId,
  userId,
  userName
}) => {
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [workingHours, setWorkingHours] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  const dotSize = sizeClasses[size];

  const loadStatusHistory = async () => {
    if (!attendanceId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Load status history
      const historyResponse = await fetch(`https://testing.staffly.space/attendance/online-status/${attendanceId}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setStatusHistory(historyData.status_history || []);
      }

      // Load working hours calculation
      const hoursResponse = await fetch(`https://testing.staffly.space/attendance/working-hours/${attendanceId}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (hoursResponse.ok) {
        const hoursData = await hoursResponse.json();
        setWorkingHours(hoursData);
      }
    } catch (error) {
      console.error('Failed to load status data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (clickable && attendanceId) {
      loadStatusHistory();
      setShowHistoryDialog(true);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatWorkingHours = (decimalHours: number): string => {
    if (!decimalHours || decimalHours === 0) {
      return '0 hrs - 0 mins';
    }

    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);

    if (hours === 0 && minutes === 0) {
      return '0 hrs - 0 mins';
    } else if (hours === 0) {
      return `0 hrs - ${minutes} mins`;
    } else if (minutes === 0) {
      return `${hours} hrs - 0 mins`;
    } else {
      return `${hours} hrs - ${minutes} mins`;
    }
  };

  const formatDateTime = (timestamp: string): string => {
    return formatDateTimeIST(timestamp, 'dd MMM HH:mm:ss');
  };

  return (
    <>
      <div
        className={`flex items-center gap-1.5 ${clickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={handleClick}
      >
        {/* Status dot with pulse animation for online */}
        <div className="relative">
          <div
            className={`${dotSize} rounded-full transition-colors duration-300 ${isOnline
              ? 'bg-green-500'
              : 'bg-gray-400 dark:bg-gray-600'
              }`}
          />
          {isOnline && (
            <div className={`${dotSize} rounded-full bg-green-500 absolute top-0 left-0 animate-ping opacity-75`} />
          )}
        </div>

        {showLabel && (
          <span
            className={`text-xs font-medium ${isOnline
              ? 'text-green-600 dark:text-green-400'
              : 'text-gray-500 dark:text-gray-400'
              }`}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        )}
      </div>

      {/* Status History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-semibold">{userName}'s Online Status</div>
                <div className="text-sm text-muted-foreground">Today's activity timeline</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Working Hours Summary */}
              {workingHours && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl border">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-600">Working Hours</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {formatWorkingHours(workingHours.working_hours)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Timer className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-600">Status</span>
                    </div>
                    <Badge className={`${workingHours.is_currently_online ? 'bg-green-500' : 'bg-gray-500'} text-white`}>
                      {workingHours.is_currently_online ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Status History */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-slate-600" />
                  <span className="font-medium">Status Timeline</span>
                </div>

                <div className="h-[300px] overflow-y-auto pr-4">
                  {statusHistory.length > 0 ? (
                    <div className="space-y-3">
                      {statusHistory.map((item, index) => (
                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                          <div className="flex flex-col items-center">
                            <div className={`h-3 w-3 rounded-full ${item.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {index < statusHistory.length - 1 && (
                              <div className="w-px h-8 bg-border mt-2" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant={item.is_online ? 'default' : 'secondary'}
                                className={`text-xs ${item.is_online ? 'bg-green-500' : 'bg-gray-500'} text-white`}
                              >
                                {item.is_online ? 'Went Online' : 'Went Offline'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(item.timestamp)}
                              </span>
                            </div>

                            {item.reason && (
                              <div className="text-sm text-muted-foreground bg-muted p-2 rounded mt-2">
                                <strong>Reason:</strong> {item.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No status changes recorded yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OnlineStatusIndicator;
