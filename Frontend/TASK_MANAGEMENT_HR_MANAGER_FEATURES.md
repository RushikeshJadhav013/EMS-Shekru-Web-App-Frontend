# Task Management - HR & Manager Features

## Overview
Extended the "All Tasks" view to HR and Manager roles with department-based filtering and commenting capabilities.

## New Features

### 1. All Tasks View for HR & Manager
- **HR Users**: Can view all tasks across all departments
- **Manager Users**: Can view all tasks within their department by default
- Both roles can now see complete task information including who assigned and who received tasks

### 2. Department Filtering
- **Department Dropdown**: Appears when viewing "All Tasks"
- **HR**: Can select "All Departments" or filter by specific department
- **Manager**: Automatically filtered to their department (cannot see other departments)
- **Dynamic Filtering**: Shows tasks where either creator or assignee belongs to selected department

### 3. Commenting on Any Task
- **Admin, HR, Manager**: Can comment on any task in the system
- **Team Lead, Employee**: Can comment on tasks they're involved with
- Comments are visible to all users who can view the task
- Real-time comment posting with user role badges

## Implementation Details

### Filter Options by Role

#### Admin
```
[Created] [All Tasks]
```
- **Created**: Tasks created by admin
- **All Tasks**: All tasks in system + Department dropdown (All Departments available)

#### HR
```
[Created] [All Tasks]
```
- **Created**: Tasks created by HR
- **All Tasks**: All tasks in system + Department dropdown (All Departments available)

#### Manager
```
[Created] [All Tasks]
```
- **Created**: Tasks created by manager
- **All Tasks**: All tasks in their department + Department dropdown (Only their department)

#### Team Lead / Employee
```
[Received] [Created]
```
- **Received**: Tasks assigned to them
- **Created**: Tasks they created
- No "All Tasks" option

### Department Filter Logic

```typescript
// Manager: Auto-set to their department
if (user?.role === 'manager' && user?.department) {
  setSelectedDepartmentFilter(user.department);
}

// HR/Admin: Can select any department
if (user?.role === 'hr' || user?.role === 'admin') {
  setSelectedDepartmentFilter('all'); // Can see all
}
```

### Task Filtering Algorithm

```typescript
// Filter tasks by department
if (taskOwnershipFilter === 'all' && selectedDepartmentFilter !== 'all') {
  return tasks.filter(task => {
    const creator = employees.find(emp => emp.userId === task.assignedBy);
    const assignees = task.assignedTo.map(id => 
      employees.find(emp => emp.userId === id)
    );
    
    // Show task if creator OR any assignee is in selected department
    return creator?.department === selectedDepartmentFilter || 
           assignees.some(assignee => 
             assignee?.department === selectedDepartmentFilter
           );
  });
}
```

## User Experience

### HR User Workflow

#### Step 1: View All Tasks
```
1. Navigate to Task Management
2. Click "All Tasks" button
3. See all tasks across organization
4. Department dropdown appears
```

#### Step 2: Filter by Department
```
1. Click Department dropdown
2. Select "All Departments" (default) or specific department
3. Tasks filtered to show only selected department
4. See who created and who received each task
```

#### Step 3: Comment on Any Task
```
1. Click on any task to view details
2. Go to "Comments" tab
3. Type comment and click "Post"
4. Comment appears with HR role badge
5. All users involved can see the comment
```

### Manager User Workflow

#### Step 1: View Department Tasks
```
1. Navigate to Task Management
2. Click "All Tasks" button
3. Automatically filtered to manager's department
4. Department dropdown shows only their department
```

#### Step 2: View Task Details
```
1. See all tasks in department
2. View who assigned tasks (could be HR, Admin, other managers)
3. View who received tasks (team leads, employees)
4. View task status and progress
```

#### Step 3: Comment and Collaborate
```
1. Click on any task in department
2. View all comments and history
3. Add comments to provide guidance
4. Comments visible to task creator and assignee
```

## Visual Guide

### HR Dashboard - All Tasks View

```
┌─────────────────────────────────────────────────────────────────┐
│  Task Management                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Search...] [Status ▼] [Created] [All Tasks] [Department ▼]   │
│                                                                  │
│  Department: [All Departments ▼]                                │
│              - Engineering                                       │
│              - Sales                                             │
│              - Marketing                                         │
│              - HR                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Manager Dashboard - All Tasks View

```
┌─────────────────────────────────────────────────────────────────┐
│  Task Management                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Search...] [Status ▼] [Created] [All Tasks] [Department ▼]   │
│                                                                  │
│  Department: [Engineering ▼] (Fixed to manager's department)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### All Tasks Table View

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Task            │ Assigned By  │ Assigned To    │ Department  │ Status       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Fix API bug     │ Tech Lead    │ Developer A    │ Engineering │ In Progress  │
│ Sales report    │ HR Manager   │ Sales Manager  │ Sales       │ Todo         │
│ Marketing plan  │ Admin        │ Marketing Lead │ Marketing   │ Review       │
│ Code review     │ Manager      │ Team Lead      │ Engineering │ Completed    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Comment Section (Any Task)

```
┌─────────────────────────────────────────────────────────────────┐
│  Comments                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  👤 John Doe (Employee)                          2 hours ago    │
│  Started working on this task                                   │
│                                                                  │
│  👤 HR Manager (HR)                              1 hour ago     │
│  Great! Let me know if you need any resources                   │
│                                                                  │
│  👤 Manager (Manager)                            30 mins ago    │
│  Please prioritize this for today's sprint                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Type your message...                          [Post]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Permission Matrix

### View Permissions

| Role      | View Own Tasks | View Created Tasks | View All Tasks | Filter by Department |
|-----------|---------------|-------------------|----------------|---------------------|
| Admin     | ✅ Yes        | ✅ Yes            | ✅ Yes (All)   | ✅ Yes (All Depts)  |
| HR        | ✅ Yes        | ✅ Yes            | ✅ Yes (All)   | ✅ Yes (All Depts)  |
| Manager   | ✅ Yes        | ✅ Yes            | ✅ Yes (Dept)  | ✅ Yes (Own Dept)   |
| Team Lead | ✅ Yes        | ✅ Yes            | ❌ No          | ❌ No               |
| Employee  | ✅ Yes        | ✅ Yes            | ❌ No          | ❌ No               |

### Comment Permissions

| Role      | Comment on Own Tasks | Comment on Created Tasks | Comment on Any Task |
|-----------|---------------------|-------------------------|---------------------|
| Admin     | ✅ Yes              | ✅ Yes                  | ✅ Yes              |
| HR        | ✅ Yes              | ✅ Yes                  | ✅ Yes              |
| Manager   | ✅ Yes              | ✅ Yes                  | ✅ Yes (In Dept)    |
| Team Lead | ✅ Yes              | ✅ Yes                  | ❌ No               |
| Employee  | ✅ Yes              | ✅ Yes                  | ❌ No               |

### Delete Permissions (Unchanged)

| Role      | Delete Own Tasks (Todo) | Delete Own Tasks (Started) | Delete Others' Tasks |
|-----------|------------------------|---------------------------|---------------------|
| Admin     | ✅ Yes                 | ❌ No                     | ❌ No               |
| HR        | ✅ Yes                 | ❌ No                     | ❌ No               |
| Manager   | ✅ Yes                 | ❌ No                     | ❌ No               |
| Team Lead | ✅ Yes                 | ❌ No                     | ❌ No               |
| Employee  | ✅ Yes                 | ❌ No                     | ❌ No               |

## Use Cases

### Use Case 1: HR Monitors Cross-Department Task

**Scenario**: HR wants to check task progress across departments

```
1. HR logs in
2. Goes to Task Management
3. Clicks "All Tasks"
4. Selects "All Departments" (default)
5. Sees tasks from Engineering, Sales, Marketing, etc.
6. Clicks on a task to view details
7. Sees task is "In Progress"
8. Adds comment: "Great progress! Keep it up!"
9. Comment visible to task creator and assignee
```

### Use Case 2: Manager Reviews Department Tasks

**Scenario**: Engineering Manager wants to review all tasks in their department

```
1. Manager logs in
2. Goes to Task Management
3. Clicks "All Tasks"
4. Automatically filtered to "Engineering" department
5. Sees all tasks where:
   - Creator is in Engineering, OR
   - Assignee is in Engineering
6. Reviews task statuses
7. Adds comments to provide guidance
8. Cannot see tasks from other departments
```

### Use Case 3: HR Investigates Delayed Task

**Scenario**: HR notices a task is overdue and wants to investigate

```
1. HR clicks "All Tasks"
2. Filters by "Sales" department
3. Finds overdue task
4. Views task details and history
5. Sees task was passed between team members
6. Adds comment: "Please prioritize this task"
7. Notifies task assignee through comment
```

### Use Case 4: Manager Coordinates Cross-Team Work

**Scenario**: Manager needs to coordinate with team lead on task

```
1. Manager views "All Tasks" (Engineering dept)
2. Finds task assigned to Team Lead
3. Views task progress and comments
4. Adds comment: "Please coordinate with QA team"
5. Team Lead receives notification
6. Team Lead responds in comments
7. Manager monitors progress
```

## Technical Implementation

### State Management

```typescript
// New state for department filter
const [selectedDepartmentFilter, setSelectedDepartmentFilter] = 
  useState<string>('all');

// Auto-set manager's department
useEffect(() => {
  if (user?.role === 'manager' && user?.department) {
    setSelectedDepartmentFilter(user.department);
  }
}, [user?.role, user?.department]);
```

### Filter Logic

```typescript
const visibleTasks = useMemo(() => {
  let baseTasks = /* ... get base tasks ... */;
  
  // Apply department filter for "All Tasks" view
  if (taskOwnershipFilter === 'all' && 
      selectedDepartmentFilter !== 'all') {
    return baseTasks.filter(task => {
      const creator = employees.find(emp => 
        emp.userId === task.assignedBy
      );
      const assignees = task.assignedTo.map(id => 
        employees.find(emp => emp.userId === id)
      );
      
      return creator?.department === selectedDepartmentFilter || 
             assignees.some(assignee => 
               assignee?.department === selectedDepartmentFilter
             );
    });
  }
  
  return baseTasks;
}, [/* dependencies */]);
```

## Benefits

### For HR
1. **Complete Visibility**: See all tasks across organization
2. **Department Insights**: Filter by department to analyze workload
3. **Proactive Support**: Comment on tasks to provide guidance
4. **Resource Planning**: Identify bottlenecks and resource needs
5. **Performance Monitoring**: Track task completion across teams

### For Managers
1. **Department Overview**: See all tasks in their department
2. **Team Coordination**: Monitor team member workloads
3. **Quick Intervention**: Comment on tasks to provide direction
4. **Progress Tracking**: View task status and history
5. **Collaboration**: Communicate with team through comments

### For Organization
1. **Transparency**: Clear visibility of task distribution
2. **Accountability**: Track who assigned what to whom
3. **Communication**: Centralized task-related discussions
4. **Efficiency**: Faster problem resolution through comments
5. **Data Integrity**: Tasks protected from accidental deletion

## Testing Checklist

### HR User Tests
- [ ] "All Tasks" button appears for HR users
- [ ] Can view all tasks across all departments
- [ ] Department dropdown shows all departments
- [ ] Can select "All Departments"
- [ ] Can filter by specific department
- [ ] Can view task details for any task
- [ ] Can comment on any task
- [ ] Comments appear with HR role badge
- [ ] Cannot delete tasks created by others
- [ ] Can only delete own tasks with 'todo' status

### Manager User Tests
- [ ] "All Tasks" button appears for managers
- [ ] Automatically filtered to manager's department
- [ ] Department dropdown shows only their department
- [ ] Cannot select other departments
- [ ] Can view all tasks in their department
- [ ] Can see tasks created by others in department
- [ ] Can comment on any task in department
- [ ] Comments appear with Manager role badge
- [ ] Cannot view tasks from other departments
- [ ] Can only delete own tasks with 'todo' status

### Cross-Department Tests
- [ ] HR can switch between departments
- [ ] Manager cannot switch to other departments
- [ ] Tasks appear in correct department filter
- [ ] Tasks with cross-department assignees show correctly
- [ ] Comments visible to all relevant users

## Future Enhancements

1. **Task Analytics**: Department-wise task completion metrics
2. **Workload Balancing**: Identify overloaded team members
3. **Bulk Operations**: Assign multiple tasks at once
4. **Task Templates**: Create reusable task templates
5. **Notifications**: Real-time notifications for comments
6. **Task Dependencies**: Link related tasks
7. **Time Tracking**: Track time spent on tasks
8. **Custom Fields**: Add department-specific fields

---

**Implementation Date**: December 4, 2025
**Status**: ✅ Complete
**Build**: ✅ Passing
**Tested**: ⏳ Pending Manual Testing
