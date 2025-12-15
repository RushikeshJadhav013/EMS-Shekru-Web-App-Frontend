# Task Management - All Tasks View for Admin

## Overview
Added a new "All Tasks" view in the Admin Dashboard's Task Management page that allows admins to see all tasks in the system with controlled delete permissions.

## Changes Made

### 1. New "All Tasks" Tab for Admins
- Added a third filter option "All Tasks" that is only visible to admin users
- This view shows all tasks in the system regardless of who created or received them
- Admins can see:
  - Who assigned the task (Assigned By)
  - Who received the task (Assigned To)
  - Task title, description, priority, deadline
  - Current status of each task
  - All task details and history

### 2. Delete Permission Rules
Implemented strict delete rules to protect task integrity:

#### Rule 1: Only Creator Can Delete
- Only the user who created/assigned the task can delete it
- Even admins viewing "All Tasks" can only delete tasks they personally created

#### Rule 2: Status-Based Deletion
- Tasks can **ONLY** be deleted if status is `todo` (not started)
- Once the assignee changes status to `in-progress`, `review`, `completed`, or `cancelled`, the delete button is **disabled**
- This prevents deletion of tasks that work has begun on

### 3. Visual Indicators
- Delete button shows a tooltip: "Cannot delete task once work has started"
- Delete button is visually disabled (grayed out) when deletion is not allowed
- Works in both List View and Grid View

## Implementation Details

### New Function: `canDeleteTask`
```typescript
const canDeleteTask = useCallback((task: TaskWithPassMeta): boolean => {
  if (!userId) return false;
  
  // Only the creator can delete
  const isCreator = task.assignedBy === userId;
  if (!isCreator) return false;
  
  // Can only delete if task is still in 'todo' status (not started)
  return task.status === 'todo';
}, [userId]);
```

### Filter Options
1. **Received** (default for non-admin users)
   - Shows tasks assigned to the user
   
2. **Created** (default for admin users)
   - Shows tasks created by the user
   
3. **All Tasks** (admin only)
   - Shows all tasks in the system
   - Admin can view everything but only manage their own tasks

### Updated Components
- **File**: `Frontend/src/pages/tasks/TaskManagement.tsx`
- **Lines Modified**: 
  - Added "All Tasks" button (line ~1820)
  - Added `canDeleteTask` function (line ~1152)
  - Updated delete button logic in List View (line ~2066)
  - Updated delete button logic in Grid View (line ~2199)
  - Updated `canManageTask` logic for both views

## User Experience

### For Admin Users

#### Viewing All Tasks
1. Navigate to Task Management
2. Click on "All Tasks" button (appears next to "Created" button)
3. See complete list of all tasks in the system
4. View who assigned each task and who it's assigned to

#### Managing Tasks
- **Edit**: Can only edit tasks they created
- **Delete**: Can only delete tasks they created AND only if status is 'todo'
- **View**: Can view all task details, comments, and history
- **Status**: Cannot change status of tasks assigned to others

#### Delete Scenarios

**Scenario 1: Can Delete ✅**
- Admin created a task
- Task status is 'todo' (not started)
- Delete button is enabled

**Scenario 2: Cannot Delete ❌**
- Admin created a task
- Assignee changed status to 'in-progress'
- Delete button is disabled with tooltip

**Scenario 3: Cannot Delete ❌**
- Admin viewing another admin's task in "All Tasks" view
- Delete button is not shown (not the creator)

**Scenario 4: Cannot Delete ❌**
- Admin created a task
- Task status is 'completed' or 'cancelled'
- Delete button is disabled

### For Non-Admin Users
- No changes to existing functionality
- "All Tasks" button is not visible
- Can still view "Received" and "Created" tabs as before

## Benefits

1. **Transparency**: Admins can monitor all tasks across the organization
2. **Accountability**: Clear visibility of who assigned what to whom
3. **Data Protection**: Tasks cannot be deleted once work has started
4. **Audit Trail**: Task history is preserved once work begins
5. **Flexibility**: Admins can still delete tasks they created if not yet started

## Technical Notes

### Status Flow
```
todo → in-progress → review → completed
  ↓
cancelled
```

- **Deletable**: Only `todo` status
- **Protected**: All other statuses

### Permission Matrix

| User Role | View All Tasks | Edit Own Tasks | Delete Own Tasks (todo) | Delete Own Tasks (started) |
|-----------|---------------|----------------|------------------------|---------------------------|
| Admin     | ✅ Yes        | ✅ Yes         | ✅ Yes                 | ❌ No                     |
| HR        | ❌ No         | ✅ Yes         | ✅ Yes                 | ❌ No                     |
| Manager   | ❌ No         | ✅ Yes         | ✅ Yes                 | ❌ No                     |
| Team Lead | ❌ No         | ✅ Yes         | ✅ Yes                 | ❌ No                     |
| Employee  | ❌ No         | ✅ Yes         | ✅ Yes                 | ❌ No                     |

## Testing Checklist

### Admin User Tests
- [ ] "All Tasks" button appears for admin users
- [ ] "All Tasks" view shows all tasks in system
- [ ] Can see tasks created by other users
- [ ] Can see who assigned each task
- [ ] Can see who received each task
- [ ] Can view task details for any task
- [ ] Can only edit tasks they created
- [ ] Can delete own tasks with 'todo' status
- [ ] Cannot delete own tasks with 'in-progress' status
- [ ] Cannot delete tasks created by others
- [ ] Delete button shows tooltip when disabled
- [ ] Works in both List and Grid view

### Non-Admin User Tests
- [ ] "All Tasks" button does not appear
- [ ] Can still use "Received" and "Created" tabs
- [ ] Existing functionality unchanged

### Edge Cases
- [ ] Task with no assignee
- [ ] Task with multiple assignees
- [ ] Task passed between users
- [ ] Task status changed multiple times
- [ ] Deleted user's tasks

## Future Enhancements

Possible future improvements:
1. Add filters for department, priority, date range in "All Tasks" view
2. Add bulk operations for admins
3. Add task analytics and reporting
4. Add task templates
5. Add task dependencies

---

**Implementation Date**: December 4, 2025
**Status**: ✅ Complete
**Build**: ✅ Passing
**Tested**: ⏳ Pending Manual Testing
