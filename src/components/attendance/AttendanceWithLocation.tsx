import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, Clock, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { getCurrentLocation as requestCurrentLocation } from '@/utils/geolocation';
import { nowIST } from '@/utils/timezone';

interface AttendanceWithLocationProps {
  userId: number;
  onCheckIn: (locationData: any) => Promise<{ success: boolean; error?: string }>;
  onCheckOut: (locationData: any) => Promise<{ success: boolean; error?: string }>;
  currentStatus: 'checked-in' | 'checked-out' | 'loading';
}

const AttendanceWithLocation: React.FC<AttendanceWithLocationProps> = ({
  userId,
  onCheckIn,
  onCheckOut,
  currentStatus
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
    placeName?: string;
    accuracy?: number;
    timestamp?: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);

  const fetchLocation = useCallback(async () => {
    try {
      setIsCheckingLocation(true);
      setLocationError(null);
      
      const locationData = await requestCurrentLocation();
      setLocation(locationData);
      return locationData;
    } catch (error: any) {
      console.error('Error getting location:', error);
      const errorMessage = error?.message || 'Failed to get your location';
      setLocationError(errorMessage);
      toast({
        title: 'Location Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsCheckingLocation(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLocation().catch(() => {
      // errors already surfaced via toast
    });
  }, [fetchLocation]);

  const handleCheckIn = async () => {
    try {
      setIsLoading(true);
      const locationData = await fetchLocation();
      if (!locationData) {
        throw new Error('Unable to read your current location');
      }
      
      const result = await onCheckIn({
        userId,
        locationData: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          address: locationData.address,
          placeName: locationData.placeName,
          timestamp: nowIST().toISOString()
        }
      });
      
      if (result.success) {
        toast({
          title: 'Checked In',
          description: 'You have been successfully checked in!',
        });
      } else {
        throw new Error(result.error || 'Failed to check in');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check in',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setIsLoading(true);
      const locationData = await fetchLocation();
      if (!locationData) {
        throw new Error('Unable to read your current location');
      }
      
      const result = await onCheckOut({
        userId,
        locationData: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          address: locationData.address,
          placeName: locationData.placeName,
          timestamp: nowIST().toISOString()
        }
      });
      
      if (result.success) {
        toast({
          title: 'Checked Out',
          description: 'You have been successfully checked out!',
        });
        fetchLocation().catch(() => {
          // ignore refresh errors
        });
      } else {
        throw new Error(result.error || 'Failed to check out');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check out',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderLocationInfo = () => {
    if (isCheckingLocation) {
      return (
        <div className="flex items-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>Detecting your location...</span>
        </div>
      );
    }

    if (locationError) {
      return (
        <div className="flex items-center text-destructive">
          <AlertCircle className="mr-2 h-4 w-4" />
          <span>{locationError}</span>
        </div>
      );
    }

    if (location) {
      return (
        <div className="space-y-2">
          <div className="flex items-center text-green-600">
            <CheckCircle className="mr-2 h-4 w-4" />
            <span>Location detected: {location.placeName || 'Current location'}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="mr-2 h-3.5 w-3.5" />
            <span className="truncate">{location.address || 'Address not available'}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="mr-2 h-3 w-3" />
            <span>Accuracy: {location.accuracy ? `${Math.round(location.accuracy)}m` : 'Unknown'}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="text-muted-foreground">
        <p>Your current location will be captured when you check in/out.</p>
        <p className="text-xs mt-1">Make sure location services are enabled.</p>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        <CardDescription>
          {currentStatus === 'checked-out' 
            ? 'Check in to start tracking your attendance' 
            : currentStatus === 'checked-in' 
              ? 'You are currently checked in' 
              : 'Loading...'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-lg bg-muted/20">
          <h4 className="font-medium mb-2 flex items-center">
            <MapPin className="mr-2 h-4 w-4" />
            Location
          </h4>
          {renderLocationInfo()}
        </div>

        <div className="flex flex-col space-y-2">
          {currentStatus === 'checked-out' && (
            <Button 
              onClick={handleCheckIn}
              disabled={isLoading || isCheckingLocation}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking In...
                </>
              ) : (
                'Check In'
              )}
            </Button>
          )}
          
          {currentStatus === 'checked-in' && (
            <Button 
              onClick={handleCheckOut}
              variant="outline"
              disabled={isLoading || isCheckingLocation}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking Out...
                </>
              ) : (
                'Check Out'
              )}
            </Button>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground text-center">
          <p>Your exact GPS location is required each time you check in or out.</p>
          <p>Enable precise location services on your device for best accuracy.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceWithLocation;
