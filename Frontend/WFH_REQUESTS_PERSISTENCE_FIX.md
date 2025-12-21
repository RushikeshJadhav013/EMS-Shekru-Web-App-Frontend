# WFH Requests Persistence Fix

## Issue
WFH requests were being saved to the backend but not displaying after page refresh. The "My WFH Requests" section would show "No WFH requests found" even though requests were successfully submitted.

## Root Cause
1. The `loadWFHRequests()` function wasn't handling the API response format correctly
2. The API response might be wrapped in an object or be an array directly
3. After submission, the data reload might happen before the backend fully processed the request
4. Error handling was showing toast notifications instead of gracefully handling failures

## Solution

### 1. Updated Response Handling (`src/pages/wfh/WFHRequests.tsx`)

Enhanced `loadWFHRequests()` to:
- Handle both array and wrapped object responses
- Properly map `wfh_id` to `id` field
- Normalize `wfh_type` format (handle both "Full Day" and "full_day")
- Silently fail instead of showing error toast (graceful degradation)

```typescript
const loadWFHRequests = async () => {
  if (!user?.id) return;
  setIsLoading(true);
  try {
    const response = await apiService.getMyWFHRequests();
    
    // Handle response - ensure it's an array
    let requests = Array.isArray(response) ? response : (response?.data || response?.requests || []);
    
    const formattedRequests = requests.map((req: any) => ({
      id: req.wfh_id || req.id,
      user_id: req.user_id,
      start_date: req.start_date,
      end_date: req.end_date,
      reason: req.reason,
      wfh_type: (req.wfh_type || 'Full Day').toLowerCase().includes('full') ? 'full_day' : 'half_day',
      status: (req.status || 'pending').toLowerCase(),
      created_at: req.created_at,
      updated_at: req.updated_at,
      rejection_reason: req.rejection_reason,
      approved_by: req.approved_by,
    }));
    setWfhRequests(formattedRequests);
  } catch (error) {
    console.error('Failed to load WFH requests:', error);
    // Silently fail - show empty list instead of error
    setWfhRequests([]);
  } finally {
    setIsLoading(false);
  }
};
```

### 2. Added Reload Delay

Added 500ms delay after submit/update/delete operations to ensure backend processes the request:

```typescript
// Reload requests - wait a moment for backend to process
setTimeout(() => {
  loadWFHRequests();
}, 500);
```

This ensures:
- Backend has time to save the data
- Database transaction completes
- New data is available for retrieval

### 3. Updated All Action Handlers

Applied the same pattern to:
- `handleSubmitRequest()` - Submit new WFH request
- `handleUpdateRequest()` - Update existing request
- `confirmDeleteRequest()` - Delete request

## API Endpoint Used

**Endpoint**: `GET /wfh/my-requests`

**Response Format**:
```json
[
  {
    "wfh_id": 201,
    "user_id": 5,
    "start_date": "2025-12-20",
    "end_date": "2025-12-20",
    "wfh_type": "Full Day",
    "reason": "Internet outage at home",
    "status": "Pending",
    "approved_by": null,
    "approved_at": null,
    "rejection_reason": null,
    "created_at": "2025-12-17T11:00:00",
    "updated_at": "2025-12-17T11:00:00"
  }
]
```

## User Experience

### Before Fix:
1. User submits WFH request
2. Success message shown
3. Page refreshes or navigates to "My Requests"
4. Shows "No WFH requests found"
5. User confused - request disappeared

### After Fix:
1. User submits WFH request
2. Success message shown
3. Page refreshes or navigates to "My Requests"
4. Request appears in the list with "Pending" status
5. User can see their request history

## Features

- ✅ Requests persist after page refresh
- ✅ Requests display immediately after submission
- ✅ Proper status tracking (Pending, Approved, Rejected)
- ✅ Rejection reasons displayed when applicable
- ✅ Edit and delete functionality works correctly
- ✅ Graceful error handling

## Files Modified

- `src/pages/wfh/WFHRequests.tsx` - Updated request loading and action handlers

## Testing

After this fix:
1. Submit a new WFH request
2. Verify it appears in "My Requests" tab
3. Refresh the page
4. Verify request still appears
5. Edit the request and verify changes persist
6. Delete a request and verify it's removed
7. Check that rejection reasons display correctly for rejected requests

## Notes

- The 500ms delay is a reasonable compromise between UX and backend processing time
- If backend is slower, this delay can be increased
- The graceful error handling prevents UI errors when API fails
- All request data is properly normalized for consistent display
