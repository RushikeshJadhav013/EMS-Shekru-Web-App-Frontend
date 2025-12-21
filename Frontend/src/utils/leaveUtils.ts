import { LeaveBalance } from '@/contexts/LeaveBalanceContext';

/**
 * Calculate the number of leave days between two dates (inclusive)
 */
export const calculateLeaveDays = (startDate: Date, endDate: Date): number => {
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Determine which leave types should be deducted based on the applied leave type
 */
export const getLeaveDeductionTypes = (
  appliedType: 'annual' | 'sick' | 'casual' | 'maternity' | 'paternity' | 'unpaid'
): ('annual' | 'sick' | 'casual' | 'unpaid')[] => {
  switch (appliedType) {
    case 'annual':
      return ['annual'];
    case 'sick':
      return ['sick', 'annual'];
    case 'casual':
      return ['casual', 'annual'];
    case 'unpaid':
      return ['unpaid'];
    case 'maternity':
    case 'paternity':
      return ['annual'];
    default:
      return ['annual'];
  }
};

/**
 * Check if a leave type option should be disabled based on current balance
 */
export const isLeaveTypeDisabled = (
  leaveType: string,
  leaveBalance: LeaveBalance
): boolean => {
  switch (leaveType) {
    case 'annual':
      return leaveBalance.annual.remaining <= 0;
    case 'sick':
      return leaveBalance.sick.remaining <= 0;
    case 'casual':
      return leaveBalance.casual.remaining <= 0;
    case 'unpaid':
      return false; // Unpaid leave is always available
    default:
      return false;
  }
};

/**
 * Get available leave type options based on current balance
 */
export const getAvailableLeaveTypes = (leaveBalance: LeaveBalance) => {
  const allTypes = [
    { value: 'annual', label: 'Annual Leave' },
    { value: 'sick', label: 'Sick Leave' },
    { value: 'casual', label: 'Casual Leave' },
    { value: 'unpaid', label: 'Unpaid Leave' },
  ];

  // Filter based on availability
  return allTypes.filter(type => !isLeaveTypeDisabled(type.value, leaveBalance));
};

/**
 * Get the reason why a leave type is disabled
 */
export const getDisabledReason = (
  leaveType: string,
  leaveBalance: LeaveBalance
): string => {
  switch (leaveType) {
    case 'annual':
      return 'No Annual Leave balance remaining';
    case 'sick':
      return 'No Sick Leave balance remaining';
    case 'casual':
      return 'No Casual Leave balance remaining';
    default:
      return 'This leave type is not available';
  }
};

/**
 * Validate if a leave request can be made
 */
export const validateLeaveRequest = (
  leaveType: string,
  startDate: Date,
  endDate: Date,
  leaveBalance: LeaveBalance,
  reason: string
): { valid: boolean; error?: string } => {
  // Check reason length
  if (!reason.trim() || reason.trim().length < 10) {
    return { valid: false, error: 'Leave reason must be at least 10 characters long' };
  }

  const leaveDays = calculateLeaveDays(startDate, endDate);

  // Sick leave minimum duration check
  if (leaveType === 'sick' && leaveDays < 3) {
    return {
      valid: false,
      error: 'Sick leave can only be applied for 3 or more days. For shorter periods (1-2 days), please use Casual Leave instead.',
    };
  }

  // Advance notice requirements
  const now = new Date();
  const timeDifference = startDate.getTime() - now.getTime();
  const hoursDifference = timeDifference / (1000 * 60 * 60);

  if (leaveType === 'sick') {
    if (hoursDifference < 2) {
      return {
        valid: false,
        error: 'Sick leave must be applied at least 2 hours before the start date.',
      };
    }
  } else {
    if (hoursDifference < 24) {
      return {
        valid: false,
        error: 'Leave requests must be submitted at least 24 hours in advance.',
      };
    }
  }

  // Check balance for non-unpaid leaves
  if (leaveType !== 'unpaid') {
    if (leaveDays > leaveBalance.annual.remaining) {
      return {
        valid: false,
        error: `You need ${leaveDays} days but only have ${leaveBalance.annual.remaining} days remaining in your Annual Leave balance.`,
      };
    }
  }

  return { valid: true };
};
