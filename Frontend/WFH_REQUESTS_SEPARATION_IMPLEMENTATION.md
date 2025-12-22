# WFH Requests Separation Implementation

## Overview
Separated the WFH Requests section in the Admin, HR, and Manager Attendance pages into two distinct sections:
1. **Pending WFH Requests** - Shows only pending requests with Approve/Reject action buttons
2. **Recent Decisions** - Shows approved and rejected requests with filtering options

## Problem Solved
Previously, approved and rejected requests remained visible in the same list as pending requests, causing confusion for approvers. Now:
- Pending requests are clearly separated for action
- Approved/rejected requests are moved to a separate "Recent Decisions" section
- Cleaner UI with better organization

## Files Modified

### 1. `src/pages/attendance/AttendanceWithToggle.tsx`
- **Section**: WFH Requests Management View (viewMode === 'wfh_requests')
- **Changes**:
  - Split single WFH Requests card into two cards
  - First card: "Pending WFH Requests" - shows only pending requests with action buttons
  - Second card: "Recent Decisions" - shows approved/rejected requests with filtering
  - Added History icon import
  - Pending requests display with Approve/Reject buttons
  - Recent decisions sorted by decision date (newest first)
  - Filter dropdown for Recent Decisions (All/Approved/Rejected)

### 2. `src/pages/attendance/AttendanceManager.tsx`
- **Section**: WFH Requests Management for Admin (TabsContent value="wfh-requests")
- **Changes**:
  - Same separation as AttendanceWithToggle
  - First card: "Pending WFH Requests from HR & Managers"
  - Second card: "Recent Decisions"
  - Added History icon import
  - Maintains role-based styling (HR vs Manager badges)
  - Pending count badge only on pending section
  - Decision count display in Recent Decisions section

## UI/UX Improvements

### Pending WFH Requests Section
- ✅ Shows only pending requests
- ✅ Approve/Reject buttons visible for each request
- ✅ Pending badge on each request
- ✅ Pending count badge in header
- ✅ Empty state: "No pending WFH requests - All requests have been processed"

### Recent Decisions Section
- ✅ Shows only approved and rejected requests
- ✅ Sorted by decision date (newest first)
- ✅ Filter dropdown: All Decisions / Approved / Rejected
- ✅ Total decisions counter
- ✅ Rejection reasons displayed for rejected requests
- ✅ No action buttons (read-only view)
- ✅ Empty state: "No decisions yet"

## Features

### Pending Section
- Displays pending requests only
- Shows employee name, role, dates, reason
- Submission timestamp
- Department information
- Approve/Reject buttons for each request
- Pending badge

### Recent Decisions Section
- Displays approved and rejected requests
- Filter by decision type (All/Approved/Rejected)
- Shows submission and decision timestamps
- Displays rejection reasons when applicable
- Status badges (green for approved, red for rejected)
- Sorted by most recent decision first
- Total decisions counter

## Data Flow

1. **On Load**: All WFH requests fetched from API
2. **Pending Section**: Filters requests where status === 'pending'
3. **Recent Decisions Section**: 
   - Filters requests where status !== 'pending'
   - Applies additional filter based on dropdown selection
   - Sorts by processedAt date (descending)

## Styling

### Pending Section
- Purple gradient header (from-purple-50 to-pink-50)
- Purple icon
- Pending badge (red/destructive)

### Recent Decisions Section
- Slate gradient header (from-slate-50 to-gray-50)
- Blue-to-indigo gradient icon
- Status badges (green for approved, red for rejected)

## Benefits

1. **Clearer Organization**: Pending and processed requests are visually separated
2. **Reduced Confusion**: Approvers don't see already-processed requests in the action list
3. **Better Workflow**: Focus on pending requests that need action
4. **History Tracking**: Easy access to recent decisions with filtering
5. **Improved UX**: Cleaner interface with logical grouping

## Testing Checklist

- [ ] Pending requests display correctly
- [ ] Approve/Reject buttons work on pending requests
- [ ] Approved requests move to Recent Decisions
- [ ] Rejected requests move to Recent Decisions
- [ ] Filter works in Recent Decisions (All/Approved/Rejected)
- [ ] Rejection reasons display correctly
- [ ] Empty states show appropriate messages
- [ ] Pending count badge updates correctly
- [ ] Recent decisions sorted by date (newest first)
- [ ] Responsive design works on mobile
- [ ] Dark mode styling works correctly
- [ ] Works in both AttendanceWithToggle and AttendanceManager
