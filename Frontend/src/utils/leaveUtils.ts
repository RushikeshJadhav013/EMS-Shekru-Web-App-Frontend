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
    case 'unpaid':
      return false; // Sick and Unpaid leaves are always available as per user request
    case 'casual':
      return leaveBalance.casual.remaining <= 0;
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
  // Unpaid and Sick leaves can be applicable any time and without restrictions as per user request
  if (['sick', 'unpaid'].includes(leaveType)) {
    return { valid: true };
  }

  // Check reason length for other leaves
  if (!reason.trim() || reason.trim().length < 10) {
    return { valid: false, error: 'Leave reason must be at least 10 characters long' };
  }
  if (reason.length > 200) {
    return { valid: false, error: 'Leave reason cannot exceed 200 characters' };
  }

  const leaveDays = calculateLeaveDays(startDate, endDate);

  // Advance notice requirements based on leave types (Relative to 10:00 AM office start)
  const now = new Date();
  const OFFICE_START_HOUR = 10;
  const officeStart = new Date(startDate);
  officeStart.setHours(OFFICE_START_HOUR, 0, 0, 0);

  const timeDifference = officeStart.getTime() - now.getTime();
  const hoursNotice = timeDifference / (1000 * 60 * 60);

  if (['casual', 'maternity', 'paternity', 'annual'].includes(leaveType)) {
    if (hoursNotice < 24) {
      return {
        valid: false,
        error: 'Casual, Maternity, and Paternity leaves must be applied at least 24 hours before the office day starts.',
      };
    }
  }

  // Check balance for specific leave types
  if (leaveType === 'casual') {
    if (leaveDays > leaveBalance.casual.remaining) {
      return {
        valid: false,
        error: `You need ${leaveDays} days but only have ${leaveBalance.casual.remaining} days remaining in your Casual Leave balance.`,
      };
    }
  } else if (!['unpaid', 'sick'].includes(leaveType)) {
    // For other types like Annual (if applicable) or fallbacks, check annual balance
    if (leaveDays > leaveBalance.annual.remaining) {
      return {
        valid: false,
        error: `You need ${leaveDays} days but only have ${leaveBalance.annual.remaining} days remaining in your Total Annual Leave balance.`,
      };
    }
  }

  return { valid: true };
};
