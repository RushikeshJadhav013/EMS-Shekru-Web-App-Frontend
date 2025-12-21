import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '@/lib/api';

export interface LeaveBalance {
  annual: { allocated: number; used: number; remaining: number };
  sick: { allocated: number; used: number; remaining: number };
  casual: { allocated: number; used: number; remaining: number };
  unpaid: { allocated: number; used: number; remaining: number };
}

interface LeaveBalanceContextType {
  leaveBalance: LeaveBalance;
  loadLeaveBalance: () => Promise<void>;
  updateLeaveBalance: (type: 'annual' | 'sick' | 'casual' | 'unpaid', days: number, operation: 'deduct' | 'add') => void;
  isLoading: boolean;
}

const LeaveBalanceContext = createContext<LeaveBalanceContextType | undefined>(undefined);

export const LeaveBalanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance>({
    annual: { allocated: 15, used: 0, remaining: 15 },
    sick: { allocated: 10, used: 0, remaining: 10 },
    casual: { allocated: 5, used: 0, remaining: 5 },
    unpaid: { allocated: 0, used: 0, remaining: 0 },
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadLeaveBalance = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await apiService.getLeaveBalance();
      const defaults = {
        annual: { allocated: 15, used: 0, remaining: 15 },
        sick: { allocated: 10, used: 0, remaining: 10 },
        casual: { allocated: 5, used: 0, remaining: 5 },
        unpaid: { allocated: 0, used: 0, remaining: 0 },
      };

      let unpaidCount = 0;

      response.balances.forEach((item: any) => {
        const key = item.leave_type.toLowerCase();
        if (key === 'unpaid') {
          unpaidCount = item.used;
        } else if (key in defaults) {
          defaults[key as keyof typeof defaults] = {
            allocated: item.allocated,
            used: item.used,
            remaining: item.remaining,
          };
        }
      });

      defaults.unpaid = {
        allocated: 0,
        used: unpaidCount,
        remaining: 0,
      };

      setLeaveBalance(defaults);
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateLeaveBalance = useCallback((
    type: 'annual' | 'sick' | 'casual' | 'unpaid',
    days: number,
    operation: 'deduct' | 'add'
  ) => {
    setLeaveBalance(prev => {
      const updated = { ...prev };

      if (type === 'unpaid') {
        // For unpaid leave, only update unpaid counter
        if (operation === 'deduct') {
          updated.unpaid = {
            ...prev.unpaid,
            used: prev.unpaid.used + days,
          };
        } else {
          updated.unpaid = {
            ...prev.unpaid,
            used: Math.max(0, prev.unpaid.used - days),
          };
        }
      } else if (['annual', 'sick', 'casual'].includes(type)) {
        // For other leave types, deduct from both the specific type and annual
        if (operation === 'deduct') {
          // Deduct from specific type
          updated[type] = {
            ...prev[type],
            used: prev[type].used + days,
            remaining: prev[type].remaining - days,
          };
          // Also deduct from annual
          updated.annual = {
            ...prev.annual,
            used: prev.annual.used + days,
            remaining: prev.annual.remaining - days,
          };
        } else {
          // Add back to specific type
          updated[type] = {
            ...prev[type],
            used: Math.max(0, prev[type].used - days),
            remaining: prev[type].remaining + days,
          };
          // Also add back to annual
          updated.annual = {
            ...prev.annual,
            used: Math.max(0, prev.annual.used - days),
            remaining: prev.annual.remaining + days,
          };
        }
      }

      return updated;
    });
  }, []);

  useEffect(() => {
    if (user) {
      loadLeaveBalance();
    }
  }, [user, loadLeaveBalance]);

  return (
    <LeaveBalanceContext.Provider value={{ leaveBalance, loadLeaveBalance, updateLeaveBalance, isLoading }}>
      {children}
    </LeaveBalanceContext.Provider>
  );
};

export const useLeaveBalance = () => {
  const context = useContext(LeaveBalanceContext);
  if (!context) {
    throw new Error('useLeaveBalance must be used within LeaveBalanceProvider');
  }
  return context;
};
