# WFH History Persistence Fix

## Problem Statement
The WFH (Work From Home) request history was not persisting across page refreshes. When a user applied for a WFH request, it appeared immediately in the "Your WFH History" section, but disappeared after a page refresh. This happened because the WFH history was maintained only in frontend state and was never reloaded from the backend.

## Root Cause
- WFH requests were stored only in component state (`wfhRequests`)
- No backend API call was made on component mount to fetch the user's WFH history
- When the page was refreshed, the state was reset to an empty array
- The WFH requests were only added to state when the user submitted a new request

## Solution Implemented

### Backend API Integration
Integrated the existing backend API endpoint: `GET /wfh/my-requests`
- This endpoint returns all WFH requests for the logged-in user
- Includes request statuses: Pending, Approved, Rejected
- Provides the single source of truth for WFH history

### Changes Made

#### 1. AttendanceWithToggle.tsx
**Location**: `src/pages/attendance/AttendanceWithToggle.tsx`

**Change**: Added WFH request loading to the `loadFromBackend()` function

**Implementation**:
```typescript
// Load WFH requests from backend
try {
  const wfhResponse = await apiService.getMyWFHRequests();
  let wfhData = [];
  
  // Handle different response formats
  if (Array.isArray(wfhResponse)) {
    wfhData = wfhResponse;
  } else if (wfhResponse && typeof wfhResponse === 'object') {
    // Try different wrapper formats
    if (wfhResponse.data && Array.isArray(wfhResponse.data)) {
      wfhData = wfhResponse.data;
    } else if (wfhResponse.requests && Array.isArray(wfhResponse.requests)) {
      wfhData = wfhResponse.requests;
    } else if (wfhResponse.wfh_requests && Array.isArray(wfhResponse.wfh_requests)) {
      wfhData = wfhResponse.wfh_requests;
    } else if (wfhResponse.results && Array.isArray(wfhResponse.results)) {
      wfhData = wfhResponse.results;
    }
  }
  
  // Format requests to match UI expectations
  const formattedWfhRequests = wfhData.map((req: any) => ({
    id: req.wfh_id || req.id,
    wfhId: req.wfh_id || req.id,
    startDate: req.start_date,
    endDate: req.end_date,
    reason: req.reason,
    type: ((req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day'),
    status: (req.status || 'pending').toLowerCase(),
    submittedAt: req.created_at,
    submittedById: req.user_id,
    rejectionReason: req.rejection_reason,
    approvedBy: req.approved_by,
  }));
  
  setWfhRequests(formattedWfhRequests);
} catch (wfhError) {
  console.error('Failed to load WFH requests:', wfhError);
  setWfhRequests([]);
}
```

**When it runs**: 
- On component mount
- When the page is refreshed
- When the user navigates back to the Attendance page

#### 2. AttendancePage.tsx
**Location**: `src/pages/attendance/AttendancePage.tsx`

**Change**: Added WFH request loading to the initial `useEffect` hook

**Implementation**: Same as AttendanceWithToggle, integrated into the existing useEffect that runs on component mount

**When it runs**:
- On component mount
- When the page is refreshed
- When the user navigates to the Attendance page

### Data Flow

```
User navigates to Attendance page
    ↓
Component mounts / Page refreshes
    ↓
useEffect hook triggers
    ↓
apiService.getMyWFHRequests() called
    ↓
Backend returns all user's WFH requests
    ↓
Response formatted to match UI structure
    ↓
setWfhRequests() updates state
    ↓
"Your WFH History" section displays all requests
    ↓
User can see all their WFH requests (Pending/Approved/Rejected)
```

## Files Modified
1. `src/pages/attendance/AttendanceWithToggle.tsx` - Added WFH loading to loadFromBackend()
2. `src/pages/attendance/AttendancePage.tsx` - Added WFH loading to initial useEffect

## API Endpoint Used
- **Endpoint**: `GET /wfh/my-requests`
- **Method**: GET
- **Authentication**: Required (Bearer token)
- **Response**: Array of WFH request objects with fields:
  - `wfh_id` or `id`: Request ID
  - `start_date`: Start date of WFH
  - `end_date`: End date of WFH
  - `reason`: Reason for WFH request
  - `wfh_type`: Type (Full Day / Half Day)
  - `status`: Status (Pending / Approved / Rejected)
  - `created_at`: Request creation timestamp
  - `user_id`: User ID
  - `rejection_reason`: Reason for rejection (if rejected)
  - `approved_by`: Approver name (if approved)

## Response Format Handling
The implementation handles multiple response formats:
1. Direct array: `[{...}, {...}]`
2. Wrapped in `data`: `{ data: [{...}] }`
3. Wrapped in `requests`: `{ requests: [{...}] }`
4. Wrapped in `wfh_requests`: `{ wfh_requests: [{...}] }`
5. Wrapped in `results`: `{ results: [{...}] }`

## Benefits
✅ **Persistent History**: WFH requests persist across page refreshes
✅ **Real-time Sync**: Always shows latest data from backend
✅ **Consistent State**: Single source of truth from backend
✅ **Error Handling**: Gracefully handles API failures
✅ **Backward Compatible**: No changes to existing business logic
✅ **Cross-Dashboard**: Works across all dashboards (HR, Manager, Team Lead, Employee)

## Testing Checklist
- [x] Apply for WFH request
- [x] Verify request appears in "Your WFH History"
- [x] Refresh the page
- [x] Verify request still appears after refresh
- [x] Navigate away and back to Attendance page
- [x] Verify request still appears
- [x] Test with multiple WFH requests
- [x] Test with different statuses (Pending/Approved/Rejected)
- [x] Test on all dashboards (HR, Manager, Team Lead, Employee)

## Affected Sections
- **Attendance → Apply WFH → Your WFH History** (all dashboards)
- Displays all user's WFH requests with their statuses
- Shows submitted date, reason, type, and status
- Allows editing/deleting pending requests

## No Breaking Changes
- All existing functionality preserved
- No changes to WFH submission logic
- No changes to WFH approval/rejection logic
- No changes to API contracts
- Backward compatible with existing code

## Future Enhancements
1. Add periodic refresh (e.g., every 5 minutes)
2. Add real-time updates via WebSocket
3. Add filtering by status
4. Add search functionality
5. Add export functionality
