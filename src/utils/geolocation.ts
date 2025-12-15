type LocationData = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  placeName?: string;
  timestamp?: number;
};

const getErrorMessage = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access in your browser.';
    case error.POSITION_UNAVAILABLE:
      return 'Location information is unavailable. Please check your GPS settings.';
    case error.TIMEOUT:
      return 'The request to get user location timed out. Try again from an open area.';
    default:
      return 'Unable to retrieve your location.';
  }
};

const waitForAccuratePosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    const MIN_ACCURACY_METERS = 25;
    const MAX_WAIT_MS = 20000;

    let bestPosition: GeolocationPosition | null = null;
    let watchId: number | null = null;
    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearTimeout(timeoutId);
    };

    const resolveWithPosition = (position: GeolocationPosition) => {
      cleanup();
      resolve(position);
    };

    const timeoutId = window.setTimeout(() => {
      if (bestPosition) {
        resolveWithPosition(bestPosition);
      } else {
        cleanup();
        reject(new Error('Unable to determine precise location. Please retry from an open sky area.'));
      }
    }, MAX_WAIT_MS);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy ?? Number.MAX_SAFE_INTEGER;
        if (!bestPosition || accuracy < (bestPosition.coords.accuracy ?? Number.MAX_SAFE_INTEGER)) {
          bestPosition = position;
        }
        if (accuracy <= MIN_ACCURACY_METERS) {
          resolveWithPosition(position);
        }
      },
      (error) => {
        if (bestPosition) {
          resolveWithPosition(bestPosition);
          return;
        }
        cleanup();
        reject(new Error(getErrorMessage(error)));
      },
      {
        enableHighAccuracy: true,
        timeout: MAX_WAIT_MS,
        maximumAge: 0,
      }
    );
  });
};

/**
 * Get address from coordinates using reverse geocoding
 */
export const getAddressFromCoords = async (
  lat: number,
  lon: number
): Promise<{ address: string; placeName: string }> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch address');
    }
    
    const data = await response.json();
    
    return {
      address: data.display_name || 'Address not available',
      placeName: data.address?.building || data.address?.road || 'Location'
    };
  } catch (error) {
    console.error('Error getting address:', error);
    return {
      address: 'Address not available',
      placeName: 'Location'
    };
  }
};

/**
 * Get current location with validation
 */
export const getCurrentLocation = async (): Promise<LocationData> => {
  try {
    const position = await waitForAccuratePosition();
    const { latitude, longitude, accuracy } = position.coords;
    
    // Get address details
    const { address, placeName } = await getAddressFromCoords(latitude, longitude);
    
    return {
      latitude,
      longitude,
      accuracy,
      address,
      placeName,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
};

/**
 * Get current location immediately (fast, less accurate)
 * This function gets location within milliseconds for immediate use
 */
export const getCurrentLocationFast = async (): Promise<LocationData> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    const options = {
      enableHighAccuracy: true, // Use high accuracy for better results
      timeout: 15000, // 15 second timeout (increased for better reliability)
      maximumAge: 0, // Always get fresh location (no cache)
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        // Fetch address immediately
        try {
          const { address, placeName } = await getAddressFromCoords(latitude, longitude);
          resolve({
            latitude,
            longitude,
            accuracy,
            address,
            placeName,
            timestamp: Date.now()
          });
        } catch (error) {
          // If address fetch fails, return with coordinates
          resolve({
            latitude,
            longitude,
            accuracy,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            placeName: 'Location',
            timestamp: Date.now()
          });
        }
      },
      (error) => {
        reject(new Error(getErrorMessage(error)));
      },
      options
    );
  });
};

/**
 * Get highly accurate location with continuous improvement
 * Returns initial location immediately, then improves accuracy over time
 */
export const getCurrentLocationWithContinuousImprovement = (
  onLocationUpdate: (location: LocationData) => void,
  targetAccuracy: number = 10 // Target accuracy in meters
): { stop: () => void } => {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser');
  }

  let bestAccuracy = Infinity;
  let watchId: number | null = null;
  let addressFetchTimeout: NodeJS.Timeout | null = null;

  const options = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 0, // Always get fresh location
  };

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      
      // Only update if accuracy improved or it's the first reading
      if (accuracy && accuracy < bestAccuracy) {
        bestAccuracy = accuracy;
        
        // Clear previous address fetch timeout
        if (addressFetchTimeout) {
          clearTimeout(addressFetchTimeout);
        }
        
        // Debounce address fetching - wait 500ms before fetching
        addressFetchTimeout = setTimeout(async () => {
          try {
            const { address, placeName } = await getAddressFromCoords(latitude, longitude);
            onLocationUpdate({
              latitude,
              longitude,
              accuracy,
              address,
              placeName,
              timestamp: Date.now()
            });
          } catch (error) {
            // If address fetch fails, still update with coordinates
            onLocationUpdate({
              latitude,
              longitude,
              accuracy,
              address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              placeName: 'Location',
              timestamp: Date.now()
            });
          }
        }, 500);
        
        // Stop watching if we reached target accuracy
        if (accuracy <= targetAccuracy && watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
      }
    },
    (error) => {
      console.error('Location watch error:', error);
    },
    options
  );

  // Return cleanup function
  return {
    stop: () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (addressFetchTimeout) {
        clearTimeout(addressFetchTimeout);
        addressFetchTimeout = null;
      }
    }
  };
};

/**
 * Get location immediately and then improve it in background
 * Returns fast location immediately, then updates with more accurate location
 */
export const getCurrentLocationWithImprovement = async (
  onLocationUpdate?: (location: LocationData) => void
): Promise<LocationData> => {
  try {
    // Get fast location immediately
    const fastLocation = await getCurrentLocationFast();
    
    // Return fast location immediately
    if (onLocationUpdate) {
      onLocationUpdate(fastLocation);
    }
    
    // In background, try to get more accurate location
    try {
      const accurateLocation = await waitForAccuratePosition();
      const { latitude, longitude, accuracy } = accurateLocation.coords;
      
      // Get address for accurate location
      const { address, placeName } = await getAddressFromCoords(latitude, longitude);
      
      const improvedLocation: LocationData = {
        latitude,
        longitude,
        accuracy,
        address,
        placeName,
        timestamp: Date.now()
      };
      
      // Update with improved location
      if (onLocationUpdate) {
        onLocationUpdate(improvedLocation);
      }
      
      return improvedLocation;
    } catch (error) {
      // If accurate location fails, just return the fast location
      console.warn('Could not improve location accuracy:', error);
      return fastLocation;
    }
  } catch (error) {
    // If even fast location fails, throw error
    console.error('Error getting any location:', error);
    throw error;
  }
};
