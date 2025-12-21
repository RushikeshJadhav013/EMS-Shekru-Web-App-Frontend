# WFH Request Approval/Rejection Implementation

## Overview
Added WFH (Work From Home) request approval and rejection functionality to the Admin (Attendance Manager), HR, and Manager dashboards. Users can now approve or reject pending WFH requests directly from their dashboards.

## API Endpoint
**Endpoint**: `PUT /wfh/requests/{wfh_id}/approve`

**Request Body**:
```json
{
  "approved": true/false,
  "rejection_reason": "optional reason for rejection"
}
```

**Response**:
```json
{
  "wfh_id": 305,
  "user_id": 9,
  "start_date": "2025-12-18",
  "end_date": "2025-12-18",
  "wfh_type": "Full Day",
  "reason": "Home power maintenance work",
  "status": "Approved",
  "approved_by": 2,
  "approved_at": "2025-12-18T10:15:00",
  "rejection_reason": null,
  "created_at": "2025-12-17T09:45:00",
  "updated_at": "2025-12-18T10:15:00",
  "employee_id": "EMP009",
  "name": "Nilesh Kulkarni",
  "department": "Engineering",
  "role": "Software Engineer",
  "approver_name": "Rushikesh Jadhav"
}
```

## Changes Made

### 1. Admin Dashboard - Attendance Manager (`src/pages/attendance/AttendanceManager.tsx`)
**Already Implemented** - The approval/rejection functionality was already present in the Attendance Manager.

### 2. HR Dashboard (`src/pages/hr/HRDashboard.tsx`)

#### Added State:
- `isProcessingWfhRequest` - Loading state during approval/rejection
- `selectedWfhRequest` - Currently selected request for rejection
- `showWfhRequestDialog` - Dialog visibility state
- `wfhRejectionReason` - Rejection reason text

#### Added Handler Function:
```typescript
const handleWfhRequestAction = async (
  requestId: number, 
  action: 'approve' | 'reject', 
  reason?: string
)
```
- Calls `apiService.approveWFHRequest()`
- Updates local state optimistically
- Shows success/error toast notifications
- Closes dialog after action

#### Updated UI:
- Added Approve/Reject buttons to pending WFH requests
- Approve button: Green outline, immediate action
- Reject button: Red outline, opens dialog for reason input
- Rejection dialog with textarea for reason input

### 3. Manager Dashboard (`src/pages/manager/ManagerDashboard.tsx`)

#### Added Imports:
- `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
- `Label`, `Textarea`
- `toast` hook

#### Added State:
- `isProcessingWfhRequest` - Loading state during approval/rejection
- `selectedWfhRequest` - Currently selected request for rejection
- `showWfhRequestDialog` - Dialog visibility state
- `wfhRejectionReason` - Rejection reason text

#### Added Handler Function:
- Same as HR Dashboard implementation
- Handles both approval and rejection
- Updates local state and shows notifications

#### Updated UI:
- Added Approve/Reject buttons to pending WFH requests
- Rejection dialog with reason input
- Disabled state during processing

## User Workflow

### Approval Flow:
1. User sees pending WFH request in dashboard
2. Clicks "Approve" button
3. Request is immediately approved via API
4. Local state updates
5. Success toast notification shown
6. Request status changes to "Approved"

### Rejection Flow:
1. User sees pending WFH request in dashboard
2. Clicks "Reject" button
3. Rejection dialog opens with request details
4. User enters rejection reason
5. Clicks "Reject Request" button
6. Request is rejected via API with reason
7. Local state updates
8. Success toast notification shown
9. Request status changes to "Rejected"

## Features

### Approval Button:
- Green outline styling
- Immediate action (no dialog)
- Disabled during processing
- Shows success notification

### Rejection Button:
- Red outline styling
- Opens dialog for reason input
- Disabled during processing
- Requires reason before submission

### Rejection Dialog:
- Shows request details (employee, dates, reason)
- Textarea for rejection reason
- Cancel and Reject buttons
- Disabled submit if reason is empty
- Shows loading state during submission

## Error Handling

- API errors show error toast notification
- User-friendly error messages
- Graceful fallback on failure
- Maintains UI state on error

## Optimistic Updates

- Local state updates immediately after action
- Provides instant feedback to user
- Reverts on API error
- Reloads data on error for consistency

## Files Modified

1. `src/pages/hr/HRDashboard.tsx` - Added approval/rejection functionality
2. `src/pages/manager/ManagerDashboard.tsx` - Added approval/rejection functionality
3. `src/pages/attendance/AttendanceManager.tsx` - Already had functionality

## Testing Checklist

- [ ] HR can approve pending WFH requests
- [ ] HR can reject pending WFH requests with reason
- [ ] Manager can approve pending WFH requests
- [ ] Manager can reject pending WFH requests with reason
- [ ] Admin can approve pending WFH requests (Attendance Manager)
- [ ] Admin can reject pending WFH requests with reason (Attendance Manager)
- [ ] Approved requests show "Approved" status
- [ ] Rejected requests show "Rejected" status
- [ ] Rejection reason is displayed in request details
- [ ] Buttons are disabled during processing
- [ ] Success notifications appear after action
- [ ] Error notifications appear on failure
- [ ] Dialog closes after successful rejection
- [ ] Rejection reason is required before submission
- [ ] Request list updates after action

## Notes

- The API endpoint uses `approved` boolean instead of action string
- Rejection reason is optional in API but required in UI
- Status values are normalized to lowercase
- Approver name is returned in response
- Optimistic updates provide better UX
- All three dashboards now have consistent approval/rejection UI
