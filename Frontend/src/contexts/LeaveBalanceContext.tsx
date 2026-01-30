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
  isLoading: boolean;
}

const LeaveBalanceContext = createContext<LeaveBalanceContextType | undefined>(undefined);

const initialBalance: LeaveBalance = {
  annual: { allocated: 0, used: 0, remaining: 0 },
  sick: { allocated: 0, used: 0, remaining: 0 },
  casual: { allocated: 0, used: 0, remaining: 0 },
  unpaid: { allocated: 0, used: 0, remaining: 0 },
};

export const LeaveBalanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Initialize from localStorage if available to prevent 0 flicker on refresh
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('leaveBalance');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse leave balance from storage', e);
        }
      }
    }
    return initialBalance;
  });

  const [isLoading, setIsLoading] = useState(false);

  const loadLeaveBalance = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Fetch balance and try multiple allocation endpoints in parallel
      // We attempt to fetch for all roles because some managers/leads might have permission,
      // and we catch errors silently to avoid UI disruption.
      let currentConfig = null;
      let genericConfig = null;

      const balanceResponse = await apiService.getLeaveBalance();

      try {
        [currentConfig, genericConfig] = await Promise.all([
          apiService.getCurrentLeaveAllocation().catch(() => null),
          apiService.getLeaveAllocationConfig().catch(() => null)
        ]);
      } catch (e) {
        // Silently skip if endpoints are restricted
      }

      // Use whichever config is available - handle both object and array responses
      let allocationConfig = currentConfig || genericConfig;
      if (Array.isArray(allocationConfig)) {
        allocationConfig = allocationConfig[0];
      }

      const defaults: LeaveBalance = {
        annual: { allocated: 0, used: 0, remaining: 0 },
        sick: { allocated: 0, used: 0, remaining: 0 },
        casual: { allocated: 0, used: 0, remaining: 0 },
        unpaid: { allocated: 0, used: 0, remaining: 0 },
      };

      let unpaidCount = 0;

      if (balanceResponse && balanceResponse.balances) {
        balanceResponse.balances.forEach((item: any) => {
          // Normalize leave type key
          let key = item.leave_type.toLowerCase().trim();

          if (key.includes('sick')) key = 'sick';
          else if (key.includes('casual')) key = 'casual';
          else if (key.includes('annual') || key.includes('privilege')) key = 'annual';
          else if (key.includes('unpaid') || key.includes('loss of pay')) key = 'unpaid';

          if (key === 'unpaid') {
            unpaidCount = Number(item.used) || 0;
          } else if (key in defaults) {
            defaults[key as keyof typeof defaults] = {
              allocated: Number(item.allocated) || 0,
              used: Number(item.used) || 0,
              // We'll recompute remaining below to avoid negative values / drift
              remaining: 0,
            };
          }
        });
      }

      defaults.unpaid = {
        allocated: 0,
        used: unpaidCount,
        remaining: 0,
      };

      // Apply global allocation config if available (Admin's settings)
      if (allocationConfig) {
        // Handle potential snake_case or camelCase
        const sickAlloc = allocationConfig.sick_leave_allocation ?? allocationConfig.sickLeaveAllocation;
        const casualAlloc = allocationConfig.casual_leave_allocation ?? allocationConfig.casualLeaveAllocation;
        const totalAlloc = allocationConfig.total_annual_leave ?? allocationConfig.totalAnnualLeave;

        if (sickAlloc != null) {
          defaults.sick.allocated = Number(sickAlloc) || 0;
        }

        if (casualAlloc != null) {
          defaults.casual.allocated = Number(casualAlloc) || 0;
        }

        if (totalAlloc != null) {
          // We still honour the configured total for visibility,
          // but the effective "Total Leaves" card will be recomputed from sick+casual below.
          defaults.annual.allocated = Number(totalAlloc) || 0;
        }
      }

      // Normalise and prevent negative balances for paid leave types
      (['annual', 'sick', 'casual'] as const).forEach((key) => {
        const alloc = Math.max(0, defaults[key].allocated);
        const used = Math.max(0, defaults[key].used);
        const remaining = Math.max(0, alloc - used);
        defaults[key] = { allocated: alloc, used, remaining };
      });

      // Unpaid leave: track only "days taken" and never deduct from paid balances
      defaults.unpaid = {
        allocated: 0,
        used: Math.max(0, unpaidCount),
        remaining: 0,
      };

      // Enforce Total Leaves = Sick + Casual (paid leave only, excluding unpaid)
      const totalAllocated = defaults.sick.allocated + defaults.casual.allocated;
      const totalUsed = defaults.sick.used + defaults.casual.used;
      defaults.annual = {
        allocated: totalAllocated,
        used: totalUsed,
        remaining: Math.max(0, totalAllocated - totalUsed),
      };

      setLeaveBalance(defaults);
      localStorage.setItem('leaveBalance', JSON.stringify(defaults));
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load balance when user changes or initially
  useEffect(() => {
    if (user) {
      loadLeaveBalance();
    } else {
      // Clear balance if user logs out
      setLeaveBalance(initialBalance);
      localStorage.removeItem('leaveBalance');
    }
  }, [user, loadLeaveBalance]);

  return (
    <LeaveBalanceContext.Provider value={{ leaveBalance, loadLeaveBalance, isLoading }}>
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
