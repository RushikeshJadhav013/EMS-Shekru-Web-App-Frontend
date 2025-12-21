# WFH Request Approval API Endpoint Fix

## Issue
The WFH request approval/rejection was returning a 404 Not Found error:
```
Error: Not Found
PUT https://staffly.space/wfh/request/16/approve [HTTP/1.1 404 Not Found]
```

## Root Cause
The API endpoint path was incorrect in the `approveWFHRequest()` method:
- **Incorrect**: `/wfh/request/{wfhId}/approve` (singular "request")
- **Correct**: `/wfh/requests/{wfhId}/approve` (plural "requests")

## Solution
Updated the endpoint in `src/lib/api.ts`:

### Before:
```typescript
async approveWFHRequest(wfhId: number, approved: boolean, rejectionReason?: string) {
  return this.request(`/wfh/request/${wfhId}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ 
      approved,
      ...(rejectionReason && { rejection_reason: rejectionReason })
    }),
  });
}
```

### After:
```typescript
async approveWFHRequest(wfhId: number, approved: boolean, rejectionReason?: string) {
  return this.request(`/wfh/requests/${wfhId}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ 
      approved,
      ...(rejection_reason: rejectionReason })
    }),
  });
}
```

## Changes
- Changed endpoint from `/wfh/request/` to `/wfh/requests/` (added 's')
- This matches the API documentation provided

## Affected Functionality
This fix enables:
- ✅ Admin dashboard (Attendance Manager) - Approve/Reject WFH requests
- ✅ HR dashboard - Approve/Reject WFH requests
- ✅ Manager dashboard - Approve/Reject WFH requests

## Testing
After this fix, the approval/rejection should work correctly:
1. Click "Approve" button on pending WFH request
2. Request should be approved successfully
3. Status should change to "Approved"
4. Click "Reject" button on pending WFH request
5. Enter rejection reason in dialog
6. Request should be rejected successfully
7. Status should change to "Rejected"

## Files Modified
- `src/lib/api.ts` - Fixed endpoint path in `approveWFHRequest()` method

## API Endpoint Details
- **Method**: PUT
- **Endpoint**: `/wfh/requests/{wfh_id}/approve`
- **Request Body**: 
  ```json
  {
    "approved": true/false,
    "rejection_reason": "optional reason for rejection"
  }
  ```
- **Response**: Updated WFH request object with approval details
