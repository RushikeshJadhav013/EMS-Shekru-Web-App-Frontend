import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Clock, Send, Timer, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface OnlineStatusToggleProps {
  isOnline: boolean;
  onStatusChange: (isOnline: boolean, reason?: string) => Promise<void>;
  workingHours: string;
  totalOfflineTime?: string;
  currentSessionOfflineTime?: string;
  isVisible: boolean;
  attendanceId?: number;
  userId?: number;
}

export const OnlineStatusToggle: React.FC<OnlineStatusToggleProps> = ({
  isOnline,
  onStatusChange,
  workingHours,
  totalOfflineTime = '0 hrs - 0 mins',
  currentSessionOfflineTime = '0:00:00',
  isVisible,
  attendanceId,
  userId
}) => {
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [offlineReason, setOfflineReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);







  if (!isVisible) return null;

  const handleToggle = () => {
    if (isOnline) {
      // Going offline - show reason dialog
      setShowReasonDialog(true);
    } else {
      // Going online - no reason needed
      handleGoOnline();
    }
  };

  const handleGoOnline = async () => {
    setIsSubmitting(true);
    try {
      await onStatusChange(true);
      toast({
        variant: 'success',
        title: 'Status Updated',
        description: 'You are now online. Work hours tracking resumed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoOffline = async () => {
    if (!offlineReason.trim() || offlineReason.trim().length < 10) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason (minimum 10 characters).',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onStatusChange(false, offlineReason.trim());
      setShowReasonDialog(false);
      setOfflineReason('');
      toast({
        variant: 'success',
        title: 'Status Updated',
        description: 'You are now offline. Work hours tracking paused.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Status Toggle Card */}
      <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Status Icon */}
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
              isOnline 
                ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                : 'bg-gradient-to-br from-slate-400 to-slate-600'
            }`}>
              {isOnline ? (
                <Wifi className="h-8 w-8 text-white" strokeWidth={2.5} />
              ) : (
                <WifiOff className="h-8 w-8 text-white" strokeWidth={2.5} />
              )}
            </div>

            {/* Status Info */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-black dark:text-slate-100">
                  Work Status
                </h3>
                <Badge 
                  className={`${
                    isOnline 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-slate-500 hover:bg-slate-600'
                  } text-white border-0 text-[14px] font-bold`}
                  style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <div className="space-y-2 mt-2">
                {/* Online Working Hours */}
                <div className="flex items-center gap-2 text-sm text-black dark:text-slate-400">
                  <Clock className="h-4 w-4" style={{ color: '#15803D' }} />
                  <span className="text-[12px] font-bold" style={{ color: '#15803D', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    Online Time: <strong className="font-mono text-[18px]" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>{workingHours}</strong>
                  </span>
                </div>
                
                {/* Total Offline Time */}
                {totalOfflineTime !== '0 hrs - 0 mins' && (
                  <div className="flex items-center gap-2 text-[14px] text-black dark:text-slate-100">
                    <History className="h-4 w-4 text-black dark:text-slate-400" />
                    <span className="text-[12px] font-bold" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                      Total Offline: <strong className="font-mono text-[18px]" style={{ color: '#000000' }}>{totalOfflineTime}</strong>
                    </span>
                  </div>
                )}
                
                {/* Current Offline Session */}
                {!isOnline && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-amber-500 animate-pulse" />
                      <span className="text-[14px] font-bold" style={{ color: '#DC2626', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                        Current Offline Session: <strong className="font-mono text-[14px]" style={{ color: '#DC2626' }}>
                          {currentSessionOfflineTime}
                        </strong>
                      </span>
                    </div>
                    <p className="text-[12px] font-medium mt-1 flex items-center gap-1" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                      <span>⚠️</span>
                      <span>Work hours tracking is paused</span>
                    </p>
                  </div>
                )}
                
                {/* Online Status Info */}
                {isOnline && (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-green-900 dark:text-green-300 font-bold">
                        Working hours tracking is active
                      </span>
                    </div>
                    <p className="text-xs text-green-900 dark:text-green-300 font-medium mt-1">
                      Only online time counts towards working hours
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Toggle Button */}
          <Button
            onClick={handleToggle}
            disabled={isSubmitting}
            className={`h-12 px-6 gap-2 font-semibold shadow-lg transition-all duration-300 ${
              isOnline
                ? 'bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700'
                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Updating...
              </>
            ) : (
              <>
                {isOnline ? (
                  <>
                    <WifiOff className="h-5 w-5" />
                    Go Offline
                  </>
                ) : (
                  <>
                    <Wifi className="h-5 w-5" />
                    Go Online
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Time Summary Card */}
      <div className="mt-4 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h4 className="text-[14px] font-bold text-black dark:text-white mb-3 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
          <Clock className="h-4 w-4 text-black dark:text-white" />
          Today's Time Breakdown
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Online Time */}
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#15803D' }}></div>
              <span className="text-[12px] font-bold" style={{ color: '#15803D', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Online Time</span>
            </div>
            <div className="text-[18px] font-bold font-mono" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
              {workingHours}
            </div>
            <p className="text-[12px] font-medium" style={{ color: '#16A34A', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Started from 0 hrs - 0 mins on check-in</p>
          </div>
          
          {/* Offline Time */}
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-black"></div>
              <span className="text-[12px] font-bold" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Offline Time</span>
            </div>
            <div className="text-[18px] font-bold font-mono" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
              {totalOfflineTime}
            </div>
            <p className="text-[12px] font-medium" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Break time (not counted)</p>
          </div>
        </div>
        
        {/* Current Session Info */}
        {!isOnline && currentSessionOfflineTime !== '0:00:00' && (
          <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-amber-600 animate-pulse" />
                <span className="text-[14px] font-bold" style={{ color: '#DC2626', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Current Break</span>
              </div>
              <div className="text-[14px] font-bold font-mono" style={{ color: '#DC2626', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                {currentSessionOfflineTime}
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-[14px] font-bold text-center" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            💡 Timer starts from 0 hrs - 0 mins on check-in and counts only online time
          </p>
        </div>
      </div>

      {/* Offline Reason Dialog */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <WifiOff className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-[20px] font-bold" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Going Offline</DialogTitle>
                <DialogDescription className="mt-1 text-[12px] font-medium" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                  Please provide a reason for going offline
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Warning Message */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-[14px] font-medium" style={{ color: '#DC2626', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                <strong style={{ color: '#DC2626' }}>Note:</strong> Work hours tracking will be paused while you're offline. 
                Your reason will be recorded for attendance records.
              </p>
            </div>

            {/* Reason Input */}
            <div className="space-y-2">
              <Label htmlFor="offlineReason" className="text-[14px] font-bold flex items-center gap-2" style={{ color: '#000000', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                <div className="h-2 w-2 rounded-full bg-black"></div>
                Reason for Going Offline <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="offlineReason"
                value={offlineReason}
                onChange={(e) => setOfflineReason(e.target.value)}
                placeholder="e.g., Lunch break, Meeting, Personal work, etc. (minimum 10 characters)"
                rows={4}
                className="resize-none border-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 text-[14px] placeholder:text-black dark:placeholder:text-slate-100"
                style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                autoFocus
              />
              <div className="flex items-center justify-between text-xs">
                <p 
                  className={`font-bold text-[14px] ${offlineReason.length >= 10 ? 'text-green-600' : 'text-black dark:text-slate-300'}`}
                  style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                >
                  {offlineReason.length} / 10 characters minimum
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReasonDialog(false);
                  setOfflineReason('');
                }}
                disabled={isSubmitting}
                className="flex-1 h-11 text-[14px] font-bold text-black border-slate-300 hover:bg-slate-50"
                style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGoOffline}
                disabled={isSubmitting || offlineReason.length < 10}
                className="flex-1 h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-100 dark:shadow-none text-[14px] font-bold"
                style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Go Offline
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OnlineStatusToggle;
