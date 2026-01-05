# Leave History Features - Complete Documentation

## Overview
The Leave Management system now displays a comprehensive leave history with full management capabilities including viewing, editing, and deleting leave requests.

## Leave History Display

### Information Shown for Each Leave Request

#### 1. **Leave Dates**
- Start date and end date displayed in readable format (e.g., "Jan 15, 2025 → Jan 17, 2025")
- Calendar icon for visual identification
- Formatted using IST timezone

#### 2. **Leave Type Badge**
- Color-coded badge showing leave type
- Types: Annual, Sick, Casual, Maternity, Paternity, Unpaid
- Each type has distinct color scheme

#### 3. **Duration**
- Number of days calculated automatically
- Shows "X days" or "1 day" for single day leaves
- Timer icon for visual identification

#### 4. **Leave Reason**
- Full reason text displayed
- Wrapped with proper line breaks
- FileText icon for visual identification

#### 5. **Status Badge**
- Shows current status: Pending, Approved, or Rejected
- Color-coded:
  - **Pending**: Amber/Yellow
  - **Approved**: Green/Emerald
  - **Rejected**: Red/Rose
- Bold, capitalized text

#### 6. **Approver Information**
- Shows who approved/rejected the request
- Format: "by [Approver Name]"
- Only displayed if request has been approved/rejected
- User icon for visual identification

#### 7. **Request Date**
- Sorted by most recent first (descending order)
- Automatically calculated from request submission time

### Visual Design

#### Card Layout
- Rounded corners with border
- Hover effects with shadow and scale animation
- Color-coded borders matching status
- Gradient background matching status
- Decorative gradient overlay in corner

#### Responsive Design
- Full width on mobile
- Proper spacing and padding
- Buttons stack on mobile, inline on desktop
- Text truncation handled gracefully

#### Icons Used
- 📅 Calendar icon for dates
- ⏱️ Timer icon for duration
- 📄 FileText icon for reason
- 👤 User icon for approver
- ✏️ Pencil icon for edit button
- 🗑️ Trash icon for delete button

---

## Leave Request Management

### Edit Leave Request

#### When Can You Edit?
- ✅ Only **pending** leave requests can be edited
- ❌ Approved or rejected requests cannot be edited

#### What Can Be Edited?
1. **Start Date** - Change the leave start date
2. **End Date** - Change the leave end date
3. **Reason** - Update the reason for leave (minimum 10 characters)

#### Edit Dialog Features
- Modal dialog with clear title and description
- Date picker for start and end dates
- Textarea for reason with character counter
- Real-time validation:
  - Minimum 10 characters for reason
  - Visual feedback (red for invalid, green for valid)
  - Character count display
- Cancel and Save buttons
- Loading state during submission

#### Edit Validations
1. **Sick Leave Duration**: Minimum 3 days required
2. **Advance Notice**:
   - Sick leave: Minimum 2 hours advance notice
   - Other leaves: Minimum 24 hours advance notice
3. **Reason Length**: Minimum 10 characters required
4. **Date Range**: End date must be after start date

#### Edit Button Location
- Visible only for **pending** requests
- Located in top-right corner of leave card
- Blue gradient button with pencil icon
- Responsive: Shows text on desktop, icon only on mobile

---

### Delete Leave Request

#### When Can You Delete?
- ✅ Only **pending** leave requests can be deleted
- ❌ Approved or rejected requests cannot be deleted

#### Delete Confirmation Dialog
- Alert dialog with warning icon
- Shows leave details:
  - Date range
  - Leave type
  - Duration
- Clear warning message about permanent deletion
- Cancel and Delete buttons
- Loading state during deletion

#### Delete Button Location
- Visible only for **pending** requests
- Located next to Edit button
- Red gradient button with trash icon
- Responsive: Shows text on desktop, icon only on mobile

#### Delete Process
1. Click Delete button
2. Confirmation dialog appears
3. Review leave details
4. Click "Delete Request" to confirm
5. Leave is permanently removed
6. Leave balance is restored (if applicable)
7. Success notification appears

---

## Leave History Filtering

### View Options
- **Current Month**: Shows leaves in current month
- **Last 3 Months**: Shows leaves from last 3 months
- **Last 6 Months**: Shows leaves from last 6 months
- **Last Year**: Shows leaves from last year
- **All Time**: Shows all leave requests

### Sorting
- Automatically sorted by request date
- Most recent requests appear first
- Descending order (newest to oldest)

### Filtering by Status
- All statuses displayed together
- Color-coded for easy identification
- Can be filtered by status using status badges

---

## Leave History Tabs

### Tab Organization
1. **Request Tab** (Employees only)
   - Apply for new leave
   - View own leave requests
   - Edit/delete pending requests

2. **Approvals Tab** (HR/Manager/Admin)
   - View pending leave requests from team
   - Approve or reject requests
   - Add comments

3. **Calendar Tab** (All users)
   - Visual calendar view
   - Holiday management (Admin)
   - Week-off configuration (Admin)
   - Leave allocation settings (Admin)

---

## User Experience Flow

### Scenario 1: Employee Views Leave History
1. Navigate to Leave Management
2. Click "Request" tab
3. Scroll through leave history
4. See all leave requests with status
5. For pending requests:
   - Click Edit to modify dates/reason
   - Click Delete to remove request
6. For approved/rejected requests:
   - View details only (no edit/delete)

### Scenario 2: Employee Edits Pending Leave
1. Find pending leave request
2. Click Edit button
3. Update dates and/or reason
4. System validates changes
5. Click Save Changes
6. Leave is updated
7. Success notification appears
8. Leave history refreshes

### Scenario 3: Employee Deletes Pending Leave
1. Find pending leave request
2. Click Delete button
3. Confirmation dialog appears
4. Review leave details
5. Click Delete Request
6. Leave is permanently removed
7. Success notification appears
8. Leave balance restored
9. Leave history refreshes

---

## Technical Implementation

### Files Involved
- `Frontend/src/pages/leaves/LeaveManagement.tsx` - Main component
- `Frontend/src/lib/api.ts` - API service methods
- `Frontend/src/utils/timezone.ts` - Date formatting utilities

### State Management
```typescript
// Leave history state
const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

// Edit dialog state
const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
const [editFormData, setEditFormData] = useState({...});
const [isUpdatingLeave, setIsUpdatingLeave] = useState(false);

// Delete dialog state
const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null);
const [isDeletingLeave, setIsDeletingLeave] = useState(false);
```

### API Methods Used
- `apiService.getLeaveRequests(period)` - Fetch leave history
- `apiService.updateLeaveRequest(id, data)` - Update leave request
- `apiService.deleteLeaveRequest(id)` - Delete leave request
- `apiService.getLeaveBalance()` - Get updated balance after changes

### Key Functions
- `handleEditLeave(leave)` - Open edit dialog
- `handleEditSubmit()` - Submit edit changes
- `handleDeleteLeave(leave)` - Open delete confirmation
- `confirmDeleteLeave()` - Confirm and execute deletion
- `loadLeaveRequests(period)` - Fetch and display leave history

---

## Validation Rules

### Edit Validations
- ✅ Reason must be at least 10 characters
- ✅ Sick leave must be minimum 3 days
- ✅ Sick leave requires 2 hours advance notice
- ✅ Other leaves require 24 hours advance notice
- ✅ End date must be after start date

### Delete Validations
- ✅ Only pending requests can be deleted
- ✅ Approved/rejected requests cannot be deleted
- ✅ Confirmation required before deletion
- ✅ Permanent deletion (cannot be undone)

---

## Error Handling

### Edit Errors
- Invalid date range
- Insufficient advance notice
- Invalid leave duration
- Reason too short
- API errors with user-friendly messages

### Delete Errors
- Cannot delete non-pending requests
- API errors with user-friendly messages
- Network errors with retry option

### Success Messages
- "Leave Updated" - After successful edit
- "Leave Request Deleted" - After successful deletion
- Shows leave details in success message

---

## Testing Checklist

- [ ] View leave history with multiple requests
- [ ] Verify all leave information displays correctly
- [ ] Edit pending leave request
- [ ] Verify edit validations work
- [ ] Delete pending leave request
- [ ] Verify delete confirmation dialog
- [ ] Verify cannot edit approved/rejected leaves
- [ ] Verify cannot delete approved/rejected leaves
- [ ] Check responsive design on mobile
- [ ] Verify leave balance updates after changes
- [ ] Check error messages display correctly
- [ ] Verify success notifications appear
- [ ] Test with different leave types
- [ ] Test with different time periods

---

## Future Enhancements

- [ ] Bulk edit multiple leave requests
- [ ] Export leave history to PDF/CSV
- [ ] Leave request templates
- [ ] Recurring leave requests
- [ ] Leave request comments/notes
- [ ] Email notifications on edit/delete
- [ ] Audit trail for changes
- [ ] Leave request approval workflow
