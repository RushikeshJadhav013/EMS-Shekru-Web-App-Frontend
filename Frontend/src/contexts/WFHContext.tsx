import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';

interface WFHRequest {
  id: number;
  user_id: number;
  employee_name?: string;
  requester_role?: string;
  start_date: string;
  end_date: string;
  reason: string;
  wfh_type: 'full_day' | 'half_day';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  approved_by?: string;
  manager_approval?: 'pending' | 'approved' | 'rejected';
  hr_approval?: 'pending' | 'approved' | 'rejected';
  admin_approval?: 'pending' | 'approved' | 'rejected';
  approval_log?: {
    role: string;
    action: 'approve' | 'reject';
    timestamp: string;
  }[];
}

interface WFHDecision {
  id: number;
  user_id: number;
  employee_name?: string;
  start_date: string;
  end_date: string;
  reason: string;
  wfh_type: 'full_day' | 'half_day';
  status: 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
}

interface WFHContextType {
  wfhRequests: WFHRequest[];
  pendingApprovals: WFHRequest[];
  recentDecisions: WFHDecision[];
  isLoading: boolean;
  isLoadingDecisions: boolean;
  isLoadingPending: boolean;
  loadWFHRequests: () => Promise<void>;
  refreshWFHRequests: () => Promise<void>;
  loadRecentDecisions: () => Promise<void>;
  refreshRecentDecisions: () => Promise<void>;
  loadPendingApprovals: () => Promise<void>;
  approveRequest: (id: number) => Promise<void>;
  rejectRequest: (id: number, reason: string) => Promise<void>;
}

const WFHContext = createContext<WFHContextType | undefined>(undefined);

export const WFHProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [wfhRequests, setWfhRequests] = useState<WFHRequest[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<WFHDecision[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<WFHRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDecisions, setIsLoadingDecisions] = useState(false);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

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

  const loadRecentDecisions = useCallback(async () => {
    if (!user?.id) return;

    const privilegedRoles = ['admin', 'hr', 'manager', 'team_lead'];
    if (!privilegedRoles.includes(user.role || '')) {
      setRecentDecisions([]);
      return;
    }

    setIsLoadingDecisions(true);
    try {
      const response = await apiService.getWFHApprovals();
      let requests = [];

      if (Array.isArray(response)) {
        requests = response;
      } else if (response && typeof response === 'object') {
        if (response.data && Array.isArray(response.data)) {
          requests = response.data;
        } else if (response.requests && Array.isArray(response.requests)) {
          requests = response.requests;
        }
      }

      const decisions = requests
        .filter((req: any) => {
          const status = (req.status || 'pending').toLowerCase();
          return status === 'approved' || status === 'rejected';
        })
        .map((req: any) => ({
          id: req.wfh_id || req.id,
          user_id: req.user_id,
          employee_name: req.employee_name || req.name || 'Unknown',
          start_date: req.start_date,
          end_date: req.end_date,
          reason: req.reason,
          wfh_type: ((req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day') as 'full_day' | 'half_day',
          status: ((req.status || 'pending').toLowerCase()) as 'approved' | 'rejected',
          created_at: req.created_at,
          updated_at: req.updated_at,
          rejection_reason: req.rejection_reason,
          approved_by: req.approved_by,
          approved_at: req.updated_at,
        }))
        .sort((a: WFHDecision, b: WFHDecision) => {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

      setRecentDecisions(decisions);
    } catch (error) {
      console.error('Failed to load WFH decisions:', error);
      setRecentDecisions([]);
    } finally {
      setIsLoadingDecisions(false);
    }
  }, [user?.id, user?.role]);

  const loadPendingApprovals = useCallback(async () => {
    if (!user?.id) return;

    const privilegedRoles = ['admin', 'hr', 'manager', 'team_lead'];
    if (!privilegedRoles.includes(user.role || '')) {
      setPendingApprovals([]);
      return;
    }

    setIsLoadingPending(true);
    try {
      const response = await apiService.getWFHApprovals();
      let requests = [];

      if (Array.isArray(response)) {
        requests = response;
      } else if (response && typeof response === 'object') {
        if (response.data && Array.isArray(response.data)) {
          requests = response.data;
        } else if (response.requests && Array.isArray(response.requests)) {
          requests = response.requests;
        }
      }

      const formattedPending = requests
        .filter((req: any) => (req.status || 'pending').toLowerCase() === 'pending')
        .map((req: any) => ({
          id: req.wfh_id || req.id,
          user_id: req.user_id,
          employee_name: req.employee_name || req.name || 'Unknown',
          requester_role: req.role || req.requester_role || 'employee',
          start_date: req.start_date,
          end_date: req.end_date,
          reason: req.reason,
          wfh_type: ((req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day') as 'full_day' | 'half_day',
          status: 'pending' as const,
          created_at: req.created_at,
          updated_at: req.updated_at,
          rejection_reason: req.rejection_reason,
          approved_by: req.approved_by,
          manager_approval: req.manager_approval || 'pending',
          hr_approval: req.hr_approval || 'pending',
          admin_approval: req.admin_approval || 'pending',
        }));

      setPendingApprovals(formattedPending);
    } catch (error) {
      console.error('Failed to load pending WFH approvals:', error);
      setPendingApprovals([]);
    } finally {
      setIsLoadingPending(false);
    }
  }, [user?.id, user?.role]);

  const approveRequest = async (id: number) => {
    try {
      await apiService.approveWFHRequest(id, true);
      await Promise.all([
        loadWFHRequests(),
        loadRecentDecisions(),
        loadPendingApprovals()
      ]);
    } catch (error) {
      console.error('Failed to approve WFH request:', error);
      throw error;
    }
  };

  const rejectRequest = async (id: number, reason: string) => {
    try {
      await apiService.approveWFHRequest(id, false, reason);
      await Promise.all([
        loadWFHRequests(),
        loadRecentDecisions(),
        loadPendingApprovals()
      ]);
    } catch (error) {
      console.error('Failed to reject WFH request:', error);
      throw error;
    }
  };

  const refreshWFHRequests = useCallback(async () => {
    await loadWFHRequests();
  }, [loadWFHRequests]);

  const refreshRecentDecisions = useCallback(async () => {
    await loadRecentDecisions();
  }, [loadRecentDecisions]);

  // Load WFH requests when user is authenticated
  useEffect(() => {
    if (!user?.id) {
      setWfhRequests([]);
      setRecentDecisions([]);
      return;
    }

    loadWFHRequests();
    loadRecentDecisions();
    loadPendingApprovals();

    // Also reload when the page becomes visible (tab focus)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadWFHRequests();
        loadRecentDecisions();
        loadPendingApprovals();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.id]);

  const value = {
    wfhRequests,
    pendingApprovals,
    recentDecisions,
    isLoading,
    isLoadingDecisions,
    isLoadingPending,
    loadWFHRequests,
    refreshWFHRequests,
    loadRecentDecisions,
    refreshRecentDecisions,
    loadPendingApprovals,
    approveRequest,
    rejectRequest,
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
