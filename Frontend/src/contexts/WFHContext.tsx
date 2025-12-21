import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';

interface WFHRequest {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  wfh_type: 'full_day' | 'half_day';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  approved_by?: string;
}

interface WFHContextType {
  wfhRequests: WFHRequest[];
  isLoading: boolean;
  loadWFHRequests: () => Promise<void>;
  refreshWFHRequests: () => Promise<void>;
}

const WFHContext = createContext<WFHContextType | undefined>(undefined);

export const WFHProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [wfhRequests, setWfhRequests] = useState<WFHRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadWFHRequests = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const response = await apiService.getMyWFHRequests();
      
      console.log('WFH Requests Raw Response:', response);
      
      // Handle response - ensure it's an array
      let requests = [];
      
      if (Array.isArray(response)) {
        requests = response;
      } else if (response && typeof response === 'object') {
        // Try different possible wrapper formats
        if (response.data && Array.isArray(response.data)) {
          requests = response.data;
        } else if (response.requests && Array.isArray(response.requests)) {
          requests = response.requests;
        } else if (response.wfh_requests && Array.isArray(response.wfh_requests)) {
          requests = response.wfh_requests;
        } else if (response.results && Array.isArray(response.results)) {
          requests = response.results;
        }
      }
      
      const formattedRequests = requests.map((req: any) => ({
        id: req.wfh_id || req.id,
        user_id: req.user_id,
        start_date: req.start_date,
        end_date: req.end_date,
        reason: req.reason,
        wfh_type: ((req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day') as 'full_day' | 'half_day',
        status: ((req.status || 'pending').toLowerCase()) as 'pending' | 'approved' | 'rejected',
        created_at: req.created_at,
        updated_at: req.updated_at,
        rejection_reason: req.rejection_reason,
        approved_by: req.approved_by,
      }));
      
      console.log('Formatted WFH Requests:', formattedRequests);
      setWfhRequests(formattedRequests);
    } catch (error) {
      console.error('Failed to load WFH requests:', error);
      setWfhRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const refreshWFHRequests = useCallback(async () => {
    await loadWFHRequests();
  }, [loadWFHRequests]);

  // Load WFH requests when user is authenticated
  useEffect(() => {
    if (!user?.id) {
      setWfhRequests([]);
      return;
    }
    
    loadWFHRequests();
    
    // Also reload when the page becomes visible (tab focus)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadWFHRequests();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.id]);

  const value = {
    wfhRequests,
    isLoading,
    loadWFHRequests,
    refreshWFHRequests,
  };

  return <WFHContext.Provider value={value}>{children}</WFHContext.Provider>;
};

export const useWFH = () => {
  const context = useContext(WFHContext);
  if (!context) {
    throw new Error('useWFH must be used within a WFHProvider');
  }
  return context;
};
