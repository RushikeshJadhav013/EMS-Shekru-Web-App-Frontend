import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import AttendanceCamera from '@/components/attendance/AttendanceCamera';
import WorkSummaryDialog from '@/components/attendance/WorkSummaryDialog';
import { Clock, MapPin, Calendar, LogIn, LogOut, FileText, CheckCircle, AlertCircle, Loader2, User, Home, Send, Edit, Trash2 } from 'lucide-react';
import { AttendanceRecord } from '@/types';
import { format } from 'date-fns';
import { formatIST, formatDateTimeIST, formatTimeIST, formatDateIST, todayIST, formatDateTimeComponentsIST, parseToIST, nowIST } from '@/utils/timezone';
import { getCurrentLocation as fetchPreciseLocation, getCurrentLocationFast, getCurrentLocationWithContinuousImprovement } from '@/utils/geolocation';
import { DatePicker } from '@/components/ui/date-picker';
import { Pagination } from '@/components/ui/pagination';
import { apiService, API_BASE_URL } from '@/lib/api';

type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string;
  updatedAt?: number;
};

const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'self' | 'wfh'>('self');
  const [showCamera, setShowCamera] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(true);
  const [showWorkSummaryDialog, setShowWorkSummaryDialog] = useState(false);
  const [todaysWork, setTodaysWork] = useState('');
  const [workPdf, setWorkPdf] = useState<File | null>(null);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [currentAttendance, setCurrentAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [isGettingFastLocation, setIsGettingFastLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationWatcher, setLocationWatcher] = useState<{ stop: () => void } | null>(null);
  const [isImprovingAccuracy, setIsImprovingAccuracy] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // WFH Request state
  const [wfhStartDate, setWfhStartDate] = useState<Date | undefined>(undefined);
  const [wfhEndDate, setWfhEndDate] = useState<Date | undefined>(undefined);
  const [wfhReason, setWfhReason] = useState('');
  const [wfhType, setWfhType] = useState<'full_day' | 'half_day'>('full_day');
  const [isSubmittingWfh, setIsSubmittingWfh] = useState(false);
  const [wfhRequests, setWfhRequests] = useState<any[]>([]);
  const [editingWfhId, setEditingWfhId] = useState<string | null>(null);
  const [isDeletingWfhId, setIsDeletingWfhId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Check if user has approved WFH for today
  const getTodayWfhStatus = () => {
    const today = formatDateIST(new Date(), 'yyyy-MM-dd');
    const todayWfh = wfhRequests.find(req =>
      req.status === 'approved' &&
      req.startDate <= today &&
      req.endDate >= today
    );
    return todayWfh;
  };

  // Format relative time for better user experience
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  // Helper to fetch today's attendance for current user
  const fetchTodayAttendance = async () => {
    if (!user?.id) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/attendance/my-attendance/${user.id}`, {
        headers: {
          'Authorization': token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '',
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch attendance');
      const data = await res.json();

      // Parse backend response and find today's record
      const today = formatDateIST(new Date(), 'yyyy-MM-dd');
      const todayRecord = data.find((rec: any) => {
        const recordDate = formatDateIST(rec.check_in, 'yyyy-MM-dd');
        return recordDate === today;
      });

      if (todayRecord) {
        // Convert backend format to frontend format
        // Use ISO datetime strings for proper timezone handling
        const checkInDate = new Date(todayRecord.check_in);

        const attendance: AttendanceRecord = {
          id: todayRecord.attendance_id.toString(),
          userId: todayRecord.user_id.toString(),
          date: format(checkInDate, 'yyyy-MM-dd'),
          checkInTime: todayRecord.check_in,
          checkOutTime: todayRecord.check_out || undefined,
          checkInLocation: { latitude: 0, longitude: 0, address: todayRecord.gps_location || 'N/A' },
          checkInSelfie: todayRecord.selfie || '',
          status: 'present',
          workHours: todayRecord.total_hours
        };
        setCurrentAttendance(attendance);

        // Store all history
        const history = data
          .map((rec: any) => {
            const checkInDate = rec.check_in;
            const checkOutDate = rec.check_out;
            const recordDateStr = formatDateIST(checkInDate, 'yyyy-MM-dd');
            const todayStr = formatDateIST(new Date(), 'yyyy-MM-dd');

            let status = rec.status || 'present';

            // Core logic: If it's a past date and check-out is missing, mark as absent (forgotten checkout)
            // This applies to all users except Admin
            if (user?.role !== 'admin' && recordDateStr < todayStr && !checkOutDate) {
              status = 'absent';
            }

            return {
              id: rec.attendance_id.toString(),
              userId: rec.user_id.toString(),
              date: recordDateStr,
              checkInTime: rec.check_in,
              checkOutTime: rec.check_out || undefined,
              checkInLocation: { latitude: 0, longitude: 0, address: rec.gps_location || 'N/A' },
              checkInSelfie: rec.selfie || '',
              status: status,
              workHours: rec.total_hours
            };
          })
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAttendanceHistory(history);
      } else {
        setCurrentAttendance(null);
        // Map history even if no record for today
        const history = data
          .map((rec: any) => {
            const checkInDate = rec.check_in;
            const checkOutDate = rec.check_out;
            const recordDateStr = formatDateIST(checkInDate, 'yyyy-MM-dd');
            const todayStr = formatDateIST(new Date(), 'yyyy-MM-dd');

            let status = rec.status || 'present';
            if (user?.role !== 'admin' && recordDateStr < todayStr && !checkOutDate) {
              status = 'absent';
            }

            return {
              id: rec.attendance_id.toString(),
              userId: rec.user_id.toString(),
              date: recordDateStr,
              checkInTime: rec.check_in,
              checkOutTime: rec.check_out || undefined,
              checkInLocation: { latitude: 0, longitude: 0, address: rec.gps_location || 'N/A' },
              checkInSelfie: rec.selfie || '',
              status: status,
              workHours: rec.total_hours
            };
          })
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAttendanceHistory(history);
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
      setCurrentAttendance(null);
    }
  };

  const refreshLocation = useCallback(async (): Promise<GeoLocation> => {
    try {
      const preciseLocation = await fetchPreciseLocation();
      const refreshed: GeoLocation = {
        latitude: preciseLocation.latitude,
        longitude: preciseLocation.longitude,
        accuracy: preciseLocation.accuracy ?? null,
        address:
          preciseLocation.address ||
          `${preciseLocation.latitude.toFixed(6)}, ${preciseLocation.longitude.toFixed(6)}`,
        updatedAt: Date.now(),
      };
      setLocation(refreshed);
      return refreshed;
    } catch (error: any) {
      const errorMessage =
        error?.message || t.attendance.locationRequired || 'Unable to fetch your location';
      toast({
        title: 'Location Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw new Error(errorMessage);
    }
  }, [toast, t.attendance.locationRequired]);

  const stopContinuousLocationImprovement = useCallback(() => {
    if (locationWatcher) {
      locationWatcher.stop();
      setLocationWatcher(null);
      setIsImprovingAccuracy(false);
    }
  }, [locationWatcher]);

  const startContinuousLocationImprovement = useCallback(() => {
    // Stop any existing watcher
    if (locationWatcher) {
      locationWatcher.stop();
    }

    setIsImprovingAccuracy(true);

    try {
      const watcher = getCurrentLocationWithContinuousImprovement(
        (improvedLocation) => {
          const refreshed: GeoLocation = {
            latitude: improvedLocation.latitude,
            longitude: improvedLocation.longitude,
            accuracy: improvedLocation.accuracy ?? null,
            address: improvedLocation.address || `${improvedLocation.latitude.toFixed(6)}, ${improvedLocation.longitude.toFixed(6)}`,
            updatedAt: Date.now(),
          };
          setLocation(refreshed);

          // Stop improving if we get very accurate location (< 10 meters)
          if (improvedLocation.accuracy && improvedLocation.accuracy < 10) {
            setIsImprovingAccuracy(false);
          }
        },
        10 // Target 10 meters accuracy
      );

      setLocationWatcher(watcher);

      // Auto-stop after 30 seconds
      setTimeout(() => {
        watcher.stop();
        setIsImprovingAccuracy(false);
      }, 30000);
    } catch (error) {
      console.error('Failed to start continuous location improvement:', error);
      setIsImprovingAccuracy(false);
    }
  }, [locationWatcher]);

  const refreshLocationFast = useCallback(async (): Promise<GeoLocation> => {
    try {
      setIsGettingFastLocation(true);
      setLocationError(null);
      const fastLocation = await getCurrentLocationFast();
      const refreshed: GeoLocation = {
        latitude: fastLocation.latitude,
        longitude: fastLocation.longitude,
        accuracy: fastLocation.accuracy ?? null,
        address: fastLocation.address || `${fastLocation.latitude.toFixed(6)}, ${fastLocation.longitude.toFixed(6)}`,
        updatedAt: Date.now(),
      };
      setLocation(refreshed);
      setIsGettingFastLocation(false);
      return refreshed;
    } catch (error: any) {
      const errorMessage =
        error?.message || t.attendance.locationRequired || 'Unable to fetch your location';
      setLocationError(errorMessage);
      setIsGettingFastLocation(false);
      toast({
        title: 'Location Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw new Error(errorMessage);
    }
  }, [toast, t.attendance.locationRequired]);

  useEffect(() => {
    fetchTodayAttendance();

    // Load WFH requests from backend
    const loadWFHRequests = async () => {
      if (!user?.id) return;
      try {
        const wfhResponse = await apiService.getMyWFHRequests();
        let wfhData = [];

        if (Array.isArray(wfhResponse)) {
          wfhData = wfhResponse;
        } else if (wfhResponse && typeof wfhResponse === 'object') {
          if (wfhResponse.data && Array.isArray(wfhResponse.data)) {
            wfhData = wfhResponse.data;
          } else if (wfhResponse.requests && Array.isArray(wfhResponse.requests)) {
            wfhData = wfhResponse.requests;
          } else if (wfhResponse.wfh_requests && Array.isArray(wfhResponse.wfh_requests)) {
            wfhData = wfhResponse.wfh_requests;
          } else if (wfhResponse.results && Array.isArray(wfhResponse.results)) {
            wfhData = wfhResponse.results;
          }
        }

        const formattedWfhRequests = wfhData.map((req: any) => ({
          id: req.wfh_id || req.id,
          wfhId: req.wfh_id || req.id,
          // Use backend dates as-is without any client-side transformation
          // Backend is the source of truth for dates
          startDate: req.start_date,
          endDate: req.end_date,
          reason: req.reason,
          type: ((req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day'),
          status: (req.status || 'pending').toLowerCase(),
          submittedAt: req.created_at,
          submittedById: req.user_id,
          rejectionReason: req.rejection_reason,
          approvedBy: req.approved_by,
        }));

        setWfhRequests(formattedWfhRequests);
      } catch (wfhError) {
        console.error('Failed to load WFH requests:', wfhError);
        setWfhRequests([]);
      }
    };

    loadWFHRequests();

    // Get location immediately when page loads
    const initLocation = async () => {
      try {
        setIsGettingFastLocation(true);
        setLocationError(null);

        // Get fast location immediately
        const fastLocation = await getCurrentLocationFast();
        const refreshed: GeoLocation = {
          latitude: fastLocation.latitude,
          longitude: fastLocation.longitude,
          accuracy: fastLocation.accuracy ?? null,
          address: fastLocation.address || `${fastLocation.latitude.toFixed(6)}, ${fastLocation.longitude.toFixed(6)}`,
          updatedAt: Date.now(),
        };
        setLocation(refreshed);
        setIsGettingFastLocation(false);

        // After initial fast location, start continuous improvement
        try {
          const watcher = getCurrentLocationWithContinuousImprovement(
            (improvedLocation) => {
              const improved: GeoLocation = {
                latitude: improvedLocation.latitude,
                longitude: improvedLocation.longitude,
                accuracy: improvedLocation.accuracy ?? null,
                address: improvedLocation.address || `${improvedLocation.latitude.toFixed(6)}, ${improvedLocation.longitude.toFixed(6)}`,
                updatedAt: Date.now(),
              };
              setLocation(improved);

              // Stop improving if we get very accurate location (< 10 meters)
              if (improvedLocation.accuracy && improvedLocation.accuracy < 10) {
                setIsImprovingAccuracy(false);
              }
            },
            10 // Target 10 meters accuracy
          );

          setLocationWatcher(watcher);
          setIsImprovingAccuracy(true);

          // Auto-stop after 30 seconds
          setTimeout(() => {
            watcher.stop();
            setIsImprovingAccuracy(false);
          }, 30000);
        } catch (error) {
          console.error('Failed to start continuous location improvement:', error);
          setIsImprovingAccuracy(false);
        }
      } catch (error) {
        console.error('Initial location fetch failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get location';
        setLocationError(errorMessage);
        setIsGettingFastLocation(false);
      }
    };

    initLocation();

    // Auto-refresh at midnight to reset for new day and mark missing checkouts as absent
    const checkMidnight = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        console.log('Midnight reached. Resetting attendance state...');

        // If user was online (checked in but not checked out) at midnight,
        // and they are not Admin, notify them and force status to offline.
        if (user?.role !== 'admin' && currentAttendance && !currentAttendance.checkOutTime) {
          toast({
            title: "Shift Ended Automatically",
            description: "It's midnight! Since you didn't check out, you've been marked as Absent for yesterday and your status is now Offline.",
            variant: "destructive",
            duration: 10000,
          });
        }

        setCurrentAttendance(null);
        fetchTodayAttendance();
      }
    }, 60000); // Check every minute

    return () => {
      clearInterval(checkMidnight);
      if (locationWatcher) {
        locationWatcher.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user?.id to avoid re-running unnecessarily

  // Add effect to update WFH request timestamps in real-time
  useEffect(() => {
    if (viewMode === 'wfh' && wfhRequests.length > 0) {
      // Force re-render every minute to update relative timestamps
      const renderInterval = setInterval(() => {
        setWfhRequests(prev => [...prev]); // Trigger re-render
      }, 60000);

      return () => clearInterval(renderInterval);
    }
  }, [viewMode, wfhRequests.length]);

  const handleCheckIn = async () => {
    try {
      await refreshLocation();
    } catch (error: any) {
      toast({
        title: 'Location Required',
        description: error?.message || 'Please enable location services and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // First, take a selfie if camera is available
      setShowCamera(true);
      setIsCheckingIn(true);
    } catch (error) {
      console.error('Error initializing camera:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize camera. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      await refreshLocation();
    } catch (error: any) {
      toast({
        title: 'Location Required',
        description: error?.message || t.attendance.locationRequired,
        variant: 'destructive',
      });
      return;
    }
    setShowWorkSummaryDialog(true);
  };

  const handleWorkSummarySubmit = async (workSummary: string, deadlineReason?: string) => {
    setIsSubmittingCheckout(true);
    try {
      const activeLocation = await refreshLocation().catch(() => location);
      if (!activeLocation || !user?.id) throw new Error('Location or user missing');

      const formData = new FormData();
      formData.append('user_id', String(user.id));

      const locationPayload = {
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
        accuracy: activeLocation.accuracy ?? null,
        address: activeLocation.address ?? '',
        timestamp: new Date().toISOString(),
      };
      const locationJson = JSON.stringify(locationPayload);
      formData.append('gps_location', locationJson);
      formData.append('location_data', locationJson);
      formData.append('work_summary', workSummary.trim());

      if (deadlineReason) {
        formData.append('task_deadline_reason', deadlineReason.trim());
      }

      if (workPdf) {
        formData.append('work_report', workPdf, workPdf.name);
      }

      // For now, we'll skip the selfie requirement for checkout
      // In a real implementation, you might want to add selfie capture here
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/attendance/check-out`, {
        method: 'POST',
        headers: {
          'Authorization': token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '',
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Checkout failed');
      }

      // Fetch updated attendance
      await fetchTodayAttendance();

      toast({
        title: 'Success',
        description: 'Successfully checked out!',
        variant: 'default'
      });

      setTodaysWork('');
      setWorkPdf(null);
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Failed',
        description: error instanceof Error ? error.message : 'Failed to check out',
        variant: 'destructive'
      });
      throw error; // Re-throw to prevent dialog from closing
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const handleCameraCapture = async (imageData: string) => {
    setIsLoading(true);
    try {
      const activeLocation = await refreshLocation().catch(() => location);
      if (!activeLocation || !user?.id) throw new Error('Location or user missing');

      const formData = new FormData();
      formData.append('user_id', String(user.id));

      const locationPayload = {
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
        accuracy: activeLocation.accuracy ?? null,
        address: activeLocation.address ?? '',
        timestamp: new Date().toISOString(),
      };
      const locationJson = JSON.stringify(locationPayload);
      formData.append('gps_location', locationJson);
      formData.append('location_data', locationJson);

      if (!isCheckingIn) {
        if (!todaysWork.trim()) {
          throw new Error('Work summary is required to check out.');
        }
        formData.append('work_summary', todaysWork.trim());
        if (workPdf) {
          formData.append('work_report', workPdf, workPdf.name);
        }
      }


      // Convert base64 image to blob and append
      const selfieBlob = await fetch(imageData).then(r => r.blob());
      formData.append('selfie', selfieBlob, 'selfie.jpg');

      let apiUrl = '';
      if (isCheckingIn) apiUrl = `${API_BASE_URL}/attendance/check-in`;
      else apiUrl = `${API_BASE_URL}/attendance/check-out`;

      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '',
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Attendance API error');
      }

      // Fetch updated attendance
      await fetchTodayAttendance();

      toast({
        title: 'Success',
        description: isCheckingIn ? 'Successfully checked in!' : 'Successfully checked out!',
        variant: 'default'
      });
      if (!isCheckingIn) {
        setTodaysWork('');
        setWorkPdf(null);
      }
    } catch (error) {
      console.error('Attendance error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to record attendance',
        variant: 'destructive'
      });
    } finally {
      setShowCamera(false);
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWorkPdf(file);
    }
  };

  const handleWfhSubmit = async () => {
    if (!wfhStartDate || !wfhEndDate || !wfhReason.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (wfhStartDate > wfhEndDate) {
      toast({
        title: 'Invalid Date Range',
        description: 'End date must be after start date.',
        variant: 'destructive',
      });
      return;
    }

    // Check for overlapping requests (not consecutive dates)
    const newStartDate = format(wfhStartDate, 'yyyy-MM-dd');
    const newEndDate = format(wfhEndDate, 'yyyy-MM-dd');

    const hasOverlap = wfhRequests.some(req => {
      // Only check pending and approved requests
      if (req.status !== 'pending' && req.status !== 'approved') {
        return false;
      }

      // Check for actual overlap (same date or within range)
      // Allow consecutive dates (e.g., 04 Jan and 05 Jan are allowed)
      const reqStart = req.startDate;
      const reqEnd = req.endDate;

      // Overlap occurs if:
      // new request starts before existing ends AND new request ends after existing starts
      return newStartDate <= reqEnd && newEndDate >= reqStart;
    });

    if (hasOverlap) {
      toast({
        title: 'Overlapping Request',
        description: 'You already have a WFH request for these dates. Please choose different dates.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingWfh(true);
    try {
      // Call API to submit WFH request
      const wfhTypeLabel = wfhType === 'full_day' ? 'Full Day' : 'Half Day';
      const response = await apiService.submitWFHRequest({
        start_date: newStartDate,
        end_date: newEndDate,
        wfh_type: wfhTypeLabel,
        reason: wfhReason.trim(),
      });

      // Map the API response to our local format
      const newRequest = {
        id: response.wfh_id?.toString() || Date.now().toString(),
        wfhId: response.wfh_id,
        startDate: response.start_date,
        endDate: response.end_date,
        reason: response.reason,
        type: wfhType,
        status: response.status || 'pending',
        submittedAt: response.created_at || new Date().toISOString(),
        submittedBy: user?.name || 'Unknown',
        submittedById: user?.id || '',
        department: user?.department || '',
        role: user?.role || 'employee',
      };

      setWfhRequests(prev => [newRequest, ...prev]);

      toast({
        title: 'WFH Request Submitted',
        description: 'Your work from home request has been submitted for approval.',
        variant: 'default',
      });

      // Reset form
      setWfhStartDate(undefined);
      setWfhEndDate(undefined);
      setWfhReason('');
      setWfhType('full_day');
    } catch (error: any) {
      toast({
        title: 'Submission Failed',
        description: error.message || 'Failed to submit WFH request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingWfh(false);
    }
  };

  const handleEditWfh = (request: any) => {
    setEditingWfhId(request.id || request.wfhId);
    // Parse dates from backend format (YYYY-MM-DD) without timezone conversion
    const startDateParts = request.startDate.split('-');
    const endDateParts = request.endDate.split('-');

    // Create dates in UTC to avoid timezone shifts
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

    setWfhStartDate(startDate);
    setWfhEndDate(endDate);
    setWfhReason(request.reason);
    setWfhType(request.type === 'Full Day' || request.type === 'full_day' ? 'full_day' : 'half_day');
    setIsEditDialogOpen(true);
  };

  const handleUpdateWfh = async () => {
    if (!editingWfhId || !wfhStartDate || !wfhEndDate || !wfhReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (wfhEndDate < wfhStartDate) {
      toast({
        title: 'Error',
        description: 'End date must be after start date.',
        variant: 'destructive',
      });
      return;
    }

    // Check for overlapping requests with other pending/approved requests
    const newStartDate = format(wfhStartDate, 'yyyy-MM-dd');
    const newEndDate = format(wfhEndDate, 'yyyy-MM-dd');

    const hasOverlap = wfhRequests.some(req => {
      // Skip the current request being edited
      if ((req.id || req.wfhId) === editingWfhId) {
        return false;
      }

      // Only check pending and approved requests
      if (req.status !== 'pending' && req.status !== 'approved') {
        return false;
      }

      // Check for actual overlap (same date or within range)
      const reqStart = req.startDate;
      const reqEnd = req.endDate;

      // Overlap occurs if:
      // new request starts before existing ends AND new request ends after existing starts
      return newStartDate <= reqEnd && newEndDate >= reqStart;
    });

    if (hasOverlap) {
      toast({
        title: 'Overlapping Request',
        description: 'You already have a WFH request for these dates. Please choose different dates.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingWfh(true);
    try {
      const wfhTypeLabel = wfhType === 'full_day' ? 'Full Day' : 'Half Day';
      const response = await apiService.updateWFHRequest(parseInt(editingWfhId), {
        start_date: newStartDate,
        end_date: newEndDate,
        wfh_type: wfhTypeLabel,
        reason: wfhReason.trim(),
      });

      setWfhRequests(prev => prev.map(req =>
        (req.id === editingWfhId || req.wfhId === parseInt(editingWfhId))
          ? {
            ...req,
            startDate: response.start_date,
            endDate: response.end_date,
            reason: response.reason,
            type: wfhType,
          }
          : req
      ));

      toast({
        title: 'WFH Request Updated',
        description: 'Your work from home request has been updated successfully.',
        variant: 'default',
      });

      setIsEditDialogOpen(false);
      setEditingWfhId(null);
      setWfhStartDate(undefined);
      setWfhEndDate(undefined);
      setWfhReason('');
      setWfhType('full_day');
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update WFH request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingWfh(false);
    }
  };

  const handleDeleteWfh = async (wfhId: string) => {
    setIsDeletingWfhId(wfhId);
    try {
      await apiService.deleteWFHRequest(parseInt(wfhId));

      setWfhRequests(prev => prev.filter(req => req.id !== wfhId && req.wfhId !== parseInt(wfhId)));

      toast({
        title: 'WFH Request Deleted',
        description: 'Your work from home request has been deleted successfully.',
        variant: 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete WFH request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingWfhId(null);
    }
  };

  const getStatusBadge = (status: string, checkInTime?: string, checkOutTime?: string) => {
    if (status === 'absent') {
      return <Badge variant="destructive" className="bg-red-600">Absent (No Checkout)</Badge>;
    }
    if (status === 'late' || (checkInTime && checkInTime > '09:30:00')) {
      return <Badge variant="destructive">Late</Badge>;
    }
    if (checkOutTime && checkOutTime < '18:00:00') {
      return <Badge variant="outline" className="border-orange-500 text-orange-500">Early</Badge>;
    }
    if (status === 'present') {
      return <Badge variant="default" className="bg-green-500">On Time</Badge>;
    }
    return null;
  };

  const formatAttendanceTime = (dateString: string, timeString?: string) => {
    if (!timeString) return '-';
    return formatDateTimeComponentsIST(dateString, timeString, 'hh:mm a');
  };

  if (showCamera) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {isCheckingIn ? t.attendance.checkIn : t.attendance.checkOut}
          </h2>
        </div>
        <AttendanceCamera
          onCapture={handleCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
        {isLoading && (
          <div className="text-center">
            <p className="text-muted-foreground animate-pulse">Recognizing face...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800 rounded-2xl p-6 shadow-sm border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <Clock className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-black">Attendance Management</h2>
              <p className="text-sm text-muted-foreground mt-1">Mark your daily attendance and apply for WFH</p>
            </div>
          </div>
          <Badge variant="outline" className="text-base px-4 py-2 bg-white dark:bg-gray-950">
            <Calendar className="h-4 w-4 mr-2" />
            {formatDateIST(new Date(), 'dd MMM yyyy')}
          </Badge>
        </div>
      </div>

      {/* Tabs for Self Attendance and WFH */}
      <div className="flex justify-center w-full">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'self' | 'wfh')} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-2 h-14 w-full sm:w-[500px] bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg p-1 gap-1 shadow-sm">
            <TabsTrigger
              value="self"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
            >
              <User className="h-4 w-4 mr-2" />
              Self Attendance
            </TabsTrigger>
            <TabsTrigger
              value="wfh"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-semibold data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-200 dark:data-[state=inactive]:hover:bg-slate-700 transition-all duration-300 rounded-md"
            >
              <Home className="h-4 w-4 mr-2" />
              Apply WFH
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === 'self' ? (
        <>
          {/* Self Attendance View */}
          {/* Location Status Card - Prominent Display */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <CardHeader className="border-b bg-white/50 dark:bg-gray-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Current Location
                  </CardTitle>
                  <CardDescription>Your real-time GPS location</CardDescription>
                </div>
                <div className="flex gap-2">
                  {!isImprovingAccuracy && location && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        startContinuousLocationImprovement();
                        toast({
                          title: 'Improving Accuracy',
                          description: 'Getting more precise location...',
                        });
                      }}
                      disabled={isRefreshingLocation || isGettingFastLocation}
                    >
                      Improve Accuracy
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setIsRefreshingLocation(true);
                      stopContinuousLocationImprovement();
                      try {
                        await refreshLocationFast();
                        startContinuousLocationImprovement();
                        toast({
                          title: 'Location Updated',
                          description: 'Your location has been refreshed successfully',
                        });
                      } catch (error: any) {
                        // Error already handled in refreshLocationFast
                      } finally {
                        setIsRefreshingLocation(false);
                      }
                    }}
                    disabled={isRefreshingLocation || isGettingFastLocation}
                  >
                    {isRefreshingLocation ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isGettingFastLocation ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm font-medium">Detecting your location...</p>
                  <p className="text-xs text-muted-foreground">This should take just a moment</p>
                </div>
              ) : locationError ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <p className="text-sm font-medium text-red-600">{locationError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refreshLocationFast()}
                  >
                    Try Again
                  </Button>
                </div>
              ) : location ? (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-sm">Address</p>
                        <p className="text-sm text-muted-foreground">{location.address}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Latitude</p>
                        <p className="font-mono text-sm font-semibold">{location.latitude.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Longitude</p>
                        <p className="font-mono text-sm font-semibold">{location.longitude.toFixed(6)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Accuracy:</span>
                          <span className={`font-semibold ${location.accuracy && location.accuracy < 10 ? 'text-green-600' :
                            location.accuracy && location.accuracy < 50 ? 'text-yellow-600' :
                              'text-orange-600'
                            }`}>
                            {location.accuracy ? `±${Math.round(location.accuracy)}m` : 'Unknown'}
                          </span>
                        </span>
                        {isImprovingAccuracy && (
                          <Badge variant="outline" className="text-xs py-0 px-2 border-blue-500 text-blue-600">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Improving...
                          </Badge>
                        )}
                      </div>
                      {location.updatedAt && (
                        <span>
                          {formatTimeIST(location.updatedAt, 'HH:mm:ss')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <AlertCircle className="h-8 w-8 text-orange-500" />
                  <p className="text-sm font-medium">Location not available</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refreshLocationFast()}
                  >
                    Get Location
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Status Card */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">{t.attendance.todayStatus}</CardTitle>
                <CardDescription>Your attendance status for today</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {currentAttendance && !currentAttendance.checkOutTime ? (
                  <Badge className="bg-green-500 hover:bg-green-600 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-white mr-2 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                    Online
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="opacity-70">
                    <span className="h-2 w-2 rounded-full bg-gray-400 mr-2" />
                    Offline
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentAttendance ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <LogIn className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Check-in Time</span>
                          {getStatusBadge(currentAttendance.status, currentAttendance.checkInTime)}
                        </div>
                        <p className="text-lg font-semibold">
                          {formatAttendanceTime(currentAttendance.date, currentAttendance.checkInTime)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <LogOut className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium">Check-out Time</span>
                          {currentAttendance.checkOutTime &&
                            getStatusBadge(currentAttendance.status, undefined, currentAttendance.checkOutTime)}
                        </div>
                        <p className="text-lg font-semibold">
                          {currentAttendance.checkOutTime
                            ? formatAttendanceTime(currentAttendance.date, currentAttendance.checkOutTime)
                            : '-'}
                        </p>
                      </div>

                      {currentAttendance.workHours && (
                        <div className="col-span-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">Total Work Hours</span>
                          </div>
                          <p className="text-lg font-semibold">{currentAttendance.workHours} Hrs</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Not checked in yet</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  {!currentAttendance ? (
                    <Button onClick={handleCheckIn} size="lg" className="flex-1 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md">
                      <LogIn className="h-5 w-5" />
                      {t.attendance.checkIn}
                    </Button>
                  ) : !currentAttendance.checkOutTime ? (
                    <Button onClick={handleCheckOut} size="lg" className="flex-1 gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-md">
                      <LogOut className="h-5 w-5" />
                      {t.attendance.checkOut}
                    </Button>
                  ) : (
                    <div className="flex-1 text-center">
                      <Badge className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Attendance Completed for Today
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance History */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <CardTitle className="text-xl font-semibold">{t.attendance.history}</CardTitle>
              <CardDescription>Your recent attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendanceHistory.length > 0 ? (
                  <>
                    {attendanceHistory
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((record) => (
                        <div key={record.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                              <Calendar className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <p className="font-medium">{formatDateIST(record.date, 'dd MMM yyyy')}</p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>In: {formatAttendanceTime(record.date, record.checkInTime)}</span>
                                <span>Out: {formatAttendanceTime(record.date, record.checkOutTime)}</span>
                                {record.workHours && <span>{record.workHours} Hrs</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {record.checkInSelfie && (
                              <img
                                src={record.checkInSelfie.startsWith('http') ? record.checkInSelfie : `${API_BASE_URL}${record.checkInSelfie}`}
                                alt="Check-in Selfie"
                                className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                              />
                            )}
                            {getStatusBadge(record.status, record.checkInTime, record.checkOutTime)}
                          </div>
                        </div>
                      ))}
                    <div className="mt-4">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={Math.ceil(attendanceHistory.length / itemsPerPage)}
                        totalItems={attendanceHistory.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        showItemsPerPage={true}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No attendance history</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Work Summary Dialog with Deadline Reason */}
          <WorkSummaryDialog
            isOpen={showWorkSummaryDialog}
            onClose={() => setShowWorkSummaryDialog(false)}
            onSubmit={handleWorkSummarySubmit}
            isSubmitting={isSubmittingCheckout}
          />
        </>
      ) : (
        <>
          {/* Work From Home Request View */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Home className="h-5 w-5 text-orange-600" />
                Apply for Work From Home
              </CardTitle>
              <CardDescription>Submit a request to work from home</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* WFH Request Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="wfh-start-date">Start Date <span className="text-red-500">*</span></Label>
                    <DatePicker
                      date={wfhStartDate}
                      onDateChange={setWfhStartDate}
                      placeholder="Select start date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wfh-end-date">End Date <span className="text-red-500">*</span></Label>
                    <DatePicker
                      date={wfhEndDate}
                      onDateChange={setWfhEndDate}
                      placeholder="Select end date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wfh-type">Work From Home Type</Label>
                  <Select value={wfhType} onValueChange={(value: 'full_day' | 'half_day') => setWfhType(value)}>
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
                  <Label htmlFor="wfh-reason">Reason for WFH Request <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="wfh-reason"
                    placeholder="Please provide a detailed reason for your work from home request..."
                    value={wfhReason}
                    onChange={(e) => setWfhReason(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">Request Guidelines:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Submit requests at least 24 hours in advance</li>
                        <li>Provide a clear and valid reason for the request</li>
                        <li>Ensure you have necessary equipment and internet connectivity</li>
                        <li>Your request will be reviewed by your {user?.role === 'employee' || user?.role === 'team_lead' ? 'manager and HR' : 'admin'}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleWfhSubmit}
                    disabled={isSubmittingWfh || !wfhStartDate || !wfhEndDate || !wfhReason.trim()}
                    className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                  >
                    {isSubmittingWfh ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit WFH Request
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WFH Request History */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold">Your WFH Requests</CardTitle>
                  <CardDescription>Track the status of your work from home requests</CardDescription>
                </div>
                {wfhRequests.length > 0 && (
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {wfhRequests.length} Request{wfhRequests.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {wfhRequests.length > 0 ? (
                  <div className="space-y-3">
                    {wfhRequests.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">
                                {request.startDate} - {request.endDate}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {request.type === 'full_day' || request.type === 'Full Day' ? 'Full Day' : 'Half Day'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{request.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              Submitted {formatRelativeTime(request.submittedAt)} ({formatDateTimeIST(request.submittedAt, 'dd MMM yyyy, hh:mm a')})
                            </p>
                            {request.status === 'rejected' && request.rejectionReason && (
                              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mt-2">
                                <p className="text-sm text-red-800 dark:text-red-200">
                                  <strong>Rejection Reason:</strong> {request.rejectionReason}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={request.status === 'approved' ? 'default' : request.status === 'rejected' ? 'destructive' : 'secondary'}
                              className={request.status === 'approved' ? 'bg-green-500' : ''}
                            >
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </Badge>
                            {request.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditWfh(request)}
                                  className="h-8 w-8 p-0"
                                  title="Edit request"
                                >
                                  <Edit className="h-4 w-4 text-blue-600 hover:text-blue-700" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteWfh(request.id || request.wfhId)}
                                  disabled={isDeletingWfhId === (request.id || request.wfhId)}
                                  className="h-8 w-8 p-0"
                                  title="Delete request"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No WFH requests submitted yet</p>
                    <p className="text-sm">Submit your first work from home request above</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit WFH Request Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit WFH Request</DialogTitle>
            <DialogDescription>Update your work from home request details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <DatePicker
                  date={wfhStartDate}
                  onDateChange={setWfhStartDate}
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <DatePicker
                  date={wfhEndDate}
                  onDateChange={setWfhEndDate}
                  placeholder="Select end date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-wfh-type">WFH Type *</Label>
              <Select value={wfhType} onValueChange={(value: any) => setWfhType(value)}>
                <SelectTrigger id="edit-wfh-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_day">Full Day</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-wfh-reason">Reason *</Label>
              <Textarea
                id="edit-wfh-reason"
                placeholder="Enter reason for WFH request"
                value={wfhReason}
                onChange={(e) => setWfhReason(e.target.value)}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingWfhId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateWfh}
              disabled={isSubmittingWfh}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isSubmittingWfh ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendancePage;