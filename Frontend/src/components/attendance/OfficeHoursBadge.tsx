import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Building2 } from 'lucide-react';
import { formatTimeIST } from '@/utils/timezone';
import { API_BASE_URL } from '@/lib/api';

interface OfficeTiming {
  id: number;
  department?: string | null;
  start_time: string;
  end_time: string;
  check_in_grace_minutes: number;
  check_out_grace_minutes: number;
  is_active: boolean;
}

interface OfficeHoursBadgeProps {
  className?: string;
  variant?: 'default' | 'secondary' | 'outline';
}

const OfficeHoursBadge: React.FC<OfficeHoursBadgeProps> = ({
  className = '',
  variant = 'outline'
}) => {
  const [globalOfficeHours, setGlobalOfficeHours] = useState<OfficeTiming | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGlobalOfficeHours();
  }, []);

  const fetchGlobalOfficeHours = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/attendance/office-hours`, {
        headers: {
          'Authorization': token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '',
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const officeTimings: OfficeTiming[] = await response.json();
        // Find global office hours (department is null or empty)
        const globalTiming = officeTimings.find(timing =>
          timing.is_active && (!timing.department || timing.department === '')
        );
        setGlobalOfficeHours(globalTiming || null);
      }
    } catch (error) {
      console.error('Failed to fetch office hours:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Badge variant={variant} className={`${className} animate-pulse`}>
        <Clock className="h-3 w-3 mr-1" />
        Loading...
      </Badge>
    );
  }

  if (!globalOfficeHours) {
    return (
      <Badge variant="secondary" className={`${className} text-muted-foreground`}>
        <Building2 className="h-3 w-3 mr-1" />
        No Global Hours Set
      </Badge>
    );
  }

  // Format time from HH:MM:SS to HH:MM AM/PM
  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return formatTimeIST(date, 'hh:mm a');
    } catch (error) {
      return timeString;
    }
  };

  const startTime = formatTime(globalOfficeHours.start_time);
  const endTime = formatTime(globalOfficeHours.end_time);
  const graceMinutes = globalOfficeHours.check_in_grace_minutes;

  return (
    <Badge
      variant={variant}
      className={`${className} flex items-center gap-1 px-3 py-1`}
      title={`Office Hours: ${startTime} - ${endTime}${graceMinutes > 0 ? ` (${graceMinutes} min grace)` : ''}`}
    >
      <Clock className="h-3 w-3" />
      <span className="hidden sm:inline">Office Hours:</span>
      <span>{startTime} - {endTime}</span>
      {graceMinutes > 0 && (
        <span className="opacity-75 hidden md:inline">
          (+{graceMinutes}m grace)
        </span>
      )}
    </Badge>
  );
};

export default OfficeHoursBadge;