# Notification Recipient Fix

## Overview
Fixed the notification system to ensure notifications are delivered only to the intended recipient(s) and prevent self-notifications.

## Problem
Previously, the notification system had the following issues:
1. Backend endpoints (`/tasks/notifications`, `/leave/notifications`, `/shift/notifications`) were returning all notifications regardless of the current user
2. Self-notifications were being shown to users who initiated actions (e.g., a manager assigning a task to themselves)
3. No filtering was done on the frontend to validate that notifications were intended for the current user

## Solution

### 1. Backend Notification Filtering (Frontend-side)
Added recipient validation in `src/contexts/NotificationContext.tsx`:

#### Task Notifications
- **Before**: All task notifications were shown to all users
- **After**: Only notifications where `notification.user_id === currentUserId` are shown
- **Self-notification prevention**: If the sender (`from` field) matches the recipient, the notification is filtered out

#### Leave Notifications
- **Before**: All leave notifications were shown to all users
- **After**: Only notifications where `notification.user_id === currentUserId` are shown

#### Shift Notifications
- **Before**: All shift notifications were shown to all users
- **After**: Only notifications where `notification.user_id === currentUserId` are shown

### 2. Frontend Notification Prevention
Updated `addNotification()` function to prevent self-notifications:

#### Task Assignments
- Checks if `requesterId` (the person assigning the task) matches the current user
- If they match, the notification is not added to the local notification list
- This prevents managers from seeing notifications when they assign tasks to themselves

#### Leave Approvals
- Checks if `requesterId` (the person applying for leave) matches the current user
- If they match, the notification is not added
- This prevents employees from seeing notifications when they apply for their own leave

### 3. Existing Frontend Checks
The following checks were already in place and remain unchanged:

#### Task Assignment (TaskManagement.tsx)
```typescript
if (convertedTask.assignedTo[0] && userId && convertedTask.assignedTo[0] !== userId) {
  addNotification({...});
}
```
- Only sends notification if assignee is different from current user

#### Task Reassignment (TaskManagement.tsx)
```typescript
if (converted.assignedTo[0] && userId && converted.assignedTo[0] !== userId) {
  addNotification({...});
}
```
- Only sends notification if new assignee is different from current user

## Implementation Details

### Modified Functions in NotificationContext.tsx

1. **mapBackendTaskNotification()**
   - Added `currentUserId` parameter
   - Returns `null` if notification is not for current user
   - Returns `null` if sender and recipient are the same
   - Returns `Notification` object if all checks pass

2. **mapBackendLeaveNotification()**
   - Added `currentUserId` parameter
   - Returns `null` if notification is not for current user
   - Returns `Notification` object if check passes

3. **mapBackendShiftNotification()**
   - Added `currentUserId` parameter
   - Returns `null` if notification is not for current user
   - Returns `Notification` object if check passes

4. **fetchBackendNotifications()**
   - Updated to pass `user.id` to mapping functions
   - Added `.filter((n): n is Notification => n !== null)` to remove filtered notifications

5. **addNotification()**
   - Added check for task notifications: prevents if `requesterId === user.id`
   - Added check for leave notifications: prevents if `requesterId === user.id`
   - Returns early if self-notification is detected

## Notification Flow

### Task Assignment
1. Manager assigns task to Employee A
2. Frontend checks: `assignedTo !== currentUserId` ✓
3. Notification sent to Employee A with `requesterId = Manager.id`
4. Employee A receives notification
5. Manager does NOT receive notification

### Task Reassignment
1. Manager reassigns task from Employee A to Employee B
2. Frontend checks: `assignedTo !== currentUserId` ✓
3. Notification sent to Employee B with `requesterId = Manager.id`
4. Employee B receives notification
5. Employee A and Manager do NOT receive notification

### Leave Application
1. Employee applies for leave
2. Backend creates notification for Manager (approver)
3. Frontend filters: `notification.user_id === currentUserId` ✓
4. Manager receives notification
5. Employee does NOT receive notification (unless they're also an approver)

### Self-Assignment Prevention
1. Manager assigns task to themselves
2. Frontend checks: `assignedTo === currentUserId` ✗
3. Notification is NOT sent
4. Manager does NOT receive self-notification

## Testing Scenarios

### Scenario 1: Task Assignment to Another User
- ✓ Assignee receives notification
- ✓ Assigner does NOT receive notification
- ✓ Other users do NOT receive notification

### Scenario 2: Task Self-Assignment
- ✓ No notification is sent
- ✓ Assigner does NOT receive self-notification

### Scenario 3: Leave Application
- ✓ Approver receives notification
- ✓ Applicant does NOT receive notification
- ✓ Other users do NOT receive notification

### Scenario 4: Leave Approval
- ✓ Applicant receives notification
- ✓ Approver does NOT receive notification (unless they're also an applicant)

## Files Modified
- `src/contexts/NotificationContext.tsx` - Added recipient filtering and self-notification prevention

## Backward Compatibility
- All changes are backward compatible
- Existing notification metadata structure remains unchanged
- No breaking changes to the notification API
