# Manager Dashboard - Navigation Fix

## Summary
Fixed navigation for two cards on the Manager Dashboard home page to redirect to the correct pages and tabs.

## Changes Made

### 1. Present Today Card
**Previous Behavior**:
- Clicked "View all" button → Redirected to `/manager/attendance` (self attendance page)

**New Behavior**:
- Clicked "View all" button → Redirects to `/manager/attendance` with `viewMode: 'employee'` state
- Now shows employee attendance instead of self attendance

**Changes**:
- Card onClick: `navigate('/manager/attendance')` → `navigate('/manager/attendance', { state: { viewMode: 'employee' } })`
- Button onClick: `navigate('/manager/attendance')` → `navigate('/manager/attendance', { state: { viewMode: 'employee' } })`

### 2. Pending Approvals Card
**Previous Behavior**:
- Clicked "View all" button → Redirected to `/manager/leaves` (apply leave page)

**New Behavior**:
- Clicked "View all" button → Redirects to `/manager/leaves` with `tab: 'approvals'` state
- Now shows the approvals sub-page instead of apply leave page

**Changes**:
- Button onClick: `navigate('/manager/leaves')` → `navigate('/manager/leaves', { state: { tab: 'approvals' } })`

## Files Modified
- `src/pages/manager/ManagerDashboard.tsx`

## Impact
- ✅ Present Today card now shows employee attendance data
- ✅ Pending Approvals card now shows leave approvals tab
- ✅ Better user experience with correct page navigation
- ✅ No breaking changes
- ✅ No new dependencies

## Verification
- ✅ No TypeScript errors
- ✅ No ESLint warnings
- ✅ All imports are used
- ✅ Component renders without errors

## Testing
To verify the changes:
1. Click "View all" on the "Present Today" card → Should show employee attendance page
2. Click "View all" on the "Pending Approvals" card → Should show leave approvals tab

## Notes
- Both cards also have onClick handlers that trigger the same navigation
- The state is passed correctly to enable the appropriate view/tab on the destination page
- No changes to the Leave Management or Attendance Manager components are needed
