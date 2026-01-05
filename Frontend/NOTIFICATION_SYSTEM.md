# Notification System Documentation

## Overview
The notification system provides real-time feedback for all important actions in the EMS application. Notifications are displayed in the notification bell icon in the top-right corner and organized by type.

## Notification Types

### 1. **Leave Notifications** 📅
Triggered in the following scenarios:

#### When Employee Applies for Leave
- **Title**: "Leave Request Submitted"
- **Message**: Shows leave type, date range, and status
- **Trigger**: When user submits a leave request
- **Location**: `Frontend/src/pages/leaves/LeaveManagement.tsx` - `handleSubmitLeave` function
- **Example**: "Your Sick leave request from Jan 15 to Jan 17 has been submitted for approval"

#### When Leave is Approved
- **Title**: "Leave Approved"
- **Message**: Shows leave type, date range, and approver name
- **Trigger**: When HR/Manager/Admin approves a leave request
- **Location**: `Frontend/src/pages/leaves/LeaveManagement.tsx` - `handleApproveReject` function
- **Example**: "Your Annual leave request from Jan 20 to Jan 25 has been approved by John Doe"

#### When Leave is Rejected
- **Title**: "Leave Rejected"
- **Message**: Shows leave type, date range, and rejector name
- **Trigger**: When HR/Manager/Admin rejects a leave request
- **Location**: `Frontend/src/pages/leaves/LeaveManagement.tsx` - `handleApproveReject` function
- **Example**: "Your Casual leave request from Jan 10 to Jan 12 has been rejected by Jane Smith"

---

### 2. **Task Notifications** 📋
Triggered in the following scenarios:

#### When Task is Created for Self
- **Title**: "Task Created"
- **Message**: Shows task title and deadline
- **Trigger**: When user creates a task and assigns it to themselves
- **Location**: `Frontend/src/pages/tasks/TaskManagement.tsx` - `handleCreateTask` function
- **Example**: "You created a new task: 'Complete Project Report' - Due: Jan 25, 2025"

#### When Task is Assigned to Another User
- **Title**: "New Task Assigned"
- **Message**: Shows assigner name and task title
- **Trigger**: When admin/manager assigns a task to an employee
- **Location**: `Frontend/src/pages/tasks/TaskManagement.tsx` - `handleCreateTask` function
- **Example**: "Admin assigned you a new task: 'Review Documentation'"

#### When Task is Passed to Another User
- **Title**: "Task Passed to You"
- **Message**: Shows who passed it, task title, and any notes
- **Trigger**: When a task is passed from one user to another
- **Location**: `Frontend/src/pages/tasks/TaskManagement.tsx` - `handlePassTask` function
- **Example**: "John Doe passed you the task: 'Update Database' - Note: Please prioritize this"

#### When Task is Reassigned
- **Title**: "Task Reassigned"
- **Message**: Shows who reassigned it and task title
- **Trigger**: When a task is reassigned to a different user
- **Location**: `Frontend/src/pages/tasks/TaskManagement.tsx` - `handleReassignTask` function
- **Example**: "Manager reassigned you a task: 'Client Meeting Preparation'"

---

### 3. **Shift Notifications** ⏰
Triggered when shift assignments are made (backend-managed)

---

## Notification Display

### Notification Bell Icon
- Located in the top-right corner of the dashboard
- Shows unread count badge (red circle with number)
- Animates when new notifications arrive
- Click to open notification panel

### Notification Panel Features
- **Tabbed Organization**: All, Leave, Tasks, Shifts, Other
- **Color-Coded**: Each type has distinct colors
- **Count Badges**: Shows number of notifications per type
- **Time Stamps**: Shows when notification was created
- **Quick Actions**: 
  - Click notification to navigate to relevant page
  - Dismiss individual notifications
  - Mark all as read
  - Scroll through notification history

### Notification Routing
When clicking a notification, users are directed to:
- **Leave Notifications** → Leave Management page (Approvals tab)
- **Task Notifications** → Task Management page (with task ID)
- **Shift Notifications** → Team page

---

## Technical Implementation

### Files Modified
1. **Frontend/src/contexts/NotificationContext.tsx**
   - Manages notification state
   - Handles backend polling for notifications
   - Provides `addNotification()` hook

2. **Frontend/src/components/notifications/NotificationBell.tsx**
   - Displays notification bell icon
   - Shows notification panel with tabs
   - Handles notification interactions

3. **Frontend/src/pages/leaves/LeaveManagement.tsx**
   - Triggers notifications on leave submission
   - Triggers notifications on leave approval/rejection

4. **Frontend/src/pages/tasks/TaskManagement.tsx**
   - Triggers notifications on task creation
   - Triggers notifications on task passing
   - Triggers notifications on task reassignment

### Hook Usage
```typescript
const { addNotification } = useNotifications();

addNotification({
  title: 'Notification Title',
  message: 'Notification message',
  type: 'leave' | 'task' | 'shift' | 'info' | 'warning',
  metadata: {
    leaveId?: string,
    taskId?: string,
    requesterId?: string,
    requesterName?: string,
  }
});
```

---

## User Experience Flow

### Example: Employee Applies for Leave
1. Employee navigates to Leave Management
2. Fills in leave details and submits
3. **Notification appears** in bell icon: "Leave Request Submitted"
4. Employee can click notification to view leave status
5. When HR approves, **new notification appears**: "Leave Approved"
6. Employee sees updated leave balance

### Example: Admin Assigns Task to HR
1. Admin navigates to Task Management
2. Creates new task and assigns to HR user
3. **Notification appears in HR's bell icon**: "New Task Assigned"
4. HR can click notification to view task details
5. HR can pass task to team member
6. **New notification appears**: "Task Passed to You"

---

## Notification Settings

Users can enable/disable notifications via:
- Local storage key: `notificationsEnabled`
- Default: Enabled (true)
- Can be toggled in user settings (if implemented)

---

## Future Enhancements

- [ ] Sound notifications
- [ ] Browser push notifications
- [ ] Email notifications for critical actions
- [ ] Notification preferences per type
- [ ] Notification history/archive
- [ ] Notification filtering by date range
- [ ] Bulk notification actions
