# WFH Request API Integration Update

## Overview
Updated the WFH (Work From Home) request API integration across Admin, HR, and Manager dashboards to properly fetch and display WFH requests using the correct API endpoint.

## API Endpoint
**Endpoint**: `GET /wfh/requests`

**Response Format**:
```json
{
  "wfh_id": 305,
  "user_id": 9,
  "start_date": "2025-12-18",
  "end_date": "2025-12-18",
  "wfh_type": "Full Day",
  "reason": "Home power maintenance work",
  "status": "Pending",
  "approved_by": null,
  "approved_at": null,
  "rejection_reason": null,
  "created_at": "2025-12-17T09:45:00",
  "updated_at": "2025-12-17T09:45:00",
  "employee_id": "EMP009",
  "name": "Nilesh Kulkarni",
  "department": "Engineering",
  "role": "Software Engineer",
  "approver_name": null
}
```

## Changes Made

### 1. API Service (`src/lib/api.ts`)

#### Updated `getWFHRequests()` method:
- Now properly calls the `/wfh/requests` endpoint
- Includes error handling for failed requests
- Returns empty array on error instead of throwing

#### Added `getAllWFHRequests()` method:
- New alias method for better naming clarity
- Calls `getWFHRequests()` internally
- Provides consistent interface across dashboards

### 2. Admin Dashboard - Attendance Manager (`src/pages/attendance/AttendanceManager.tsx`)

#### Updated `loadAdminWfhRequests()` function:
- Now uses `apiService.getAllWFHRequests()` instead of `getWFHApprovals()`
- Properly maps API response fields:
  - `wfh_id` → `id`
  - `name` → `submittedBy`
  - `employee_id` → `employeeId`
  - `role` → `role`
  - `approver_name` → `processedBy`
  - `wfh_type` → `type` (normalized to lowercase)
  - `status` → `status` (normalized to lowercase)
- Handles both "Full Day" and "Half Day" wfh_type values
- Removed filtering by role (now shows all requests)

### 3. HR Dashboard (`src/pages/hr/HRDashboard.tsx`)

#### Updated WFH requests loading:
- Now uses `apiService.getAllWFHRequests()` instead of `getWFHRequests()`
- Properly maps API response fields to match UI expectations
- Handles both "Full Day" and "Half Day" wfh_type values
- Removed role-based filtering (now shows all requests)
- Added `employee_id` field mapping

### 4. Manager Dashboard (`src/pages/manager/ManagerDashboard.tsx`)

#### Updated WFH requests loading:
- Now uses `apiService.getAllWFHRequests()` instead of `getWFHRequests()`
- Properly maps API response fields
- Handles both "Full Day" and "Half Day" wfh_type values
- Removed department-based filtering (now shows all requests)
- Added `employee_id` field mapping

## Data Mapping

### API Response → UI Format

| API Field | UI Field | Notes |
|-----------|----------|-------|
| wfh_id | id | Converted to string |
| user_id | submittedById | Converted to string |
| name | submittedBy | Employee name |
| employee_id | employeeId | Employee ID |
| start_date | startDate | Date string |
| end_date | endDate | Date string |
| wfh_type | type | Normalized: "Full Day" → "full_day", "Half Day" → "half_day" |
| reason | reason | Request reason |
| status | status | Normalized to lowercase: "Pending" → "pending", etc. |
| department | department | Department name |
| role | role | Employee role |
| created_at | submittedAt | Submission timestamp |
| updated_at | processedAt | Processing timestamp |
| approver_name | processedBy | Approver name |
| rejection_reason | rejectionReason | Rejection reason if applicable |

## Error Handling

- **404 Errors**: Silently handled (endpoint may not be implemented yet)
- **Other Errors**: Toast notification displayed to user
- **Empty Response**: Returns empty array to prevent UI errors

## Files Modified

1. `src/lib/api.ts` - Updated WFH API methods
2. `src/pages/attendance/AttendanceManager.tsx` - Updated admin WFH loading
3. `src/pages/hr/HRDashboard.tsx` - Updated HR WFH loading
4. `src/pages/manager/ManagerDashboard.tsx` - Updated manager WFH loading

## Testing Checklist

- [ ] Admin dashboard loads WFH requests correctly
- [ ] HR dashboard loads WFH requests correctly
- [ ] Manager dashboard loads WFH requests correctly
- [ ] WFH requests display with correct employee information
- [ ] Status values are properly normalized (lowercase)
- [ ] WFH type values are properly normalized (full_day/half_day)
- [ ] Employee ID is displayed correctly
- [ ] Department information is displayed correctly
- [ ] Approval/rejection information is displayed correctly
- [ ] Error handling works for failed API calls
- [ ] Empty state displays when no requests available

## Notes

- The API endpoint returns all WFH requests regardless of role
- Filtering by role/department can be done on the frontend if needed
- The `approver_name` field is used for the processed by information
- Both "Full Day" and "Half Day" formats are supported
- Status values are normalized to lowercase for consistency
