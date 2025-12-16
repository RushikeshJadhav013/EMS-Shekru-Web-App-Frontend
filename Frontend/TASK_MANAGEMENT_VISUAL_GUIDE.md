# Task Management - Visual Guide

## Admin Dashboard - Task Management Page

### Filter Buttons (Admin View)

```
┌─────────────────────────────────────────────────────────┐
│  Task Management                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Search...]  [Status ▼]  ┌──────────────────────┐     │
│                            │ [Created] [All Tasks]│     │
│                            └──────────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Filter Buttons (Non-Admin View)

```
┌─────────────────────────────────────────────────────────┐
│  Task Management                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Search...]  [Status ▼]  ┌──────────────────────┐     │
│                            │ [Received] [Created] │     │
│                            └──────────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## All Tasks View - Table Layout

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Task              │ Assigned By  │ Assigned To  │ Priority │ Deadline   │ Status      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Fix login bug     │ Admin User   │ John Doe     │ High     │ Dec 10     │ In Progress │
│ Update docs       │ HR Manager   │ Jane Smith   │ Medium   │ Dec 15     │ Todo        │
│ Code review       │ Admin User   │ Bob Johnson  │ Low      │ Dec 20     │ Review      │
│ Deploy feature    │ Tech Lead    │ Alice Brown  │ High     │ Dec 08     │ Completed   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## Delete Button States

### State 1: Can Delete (Status = Todo, Creator viewing)
```
┌──────────────────────────────────────────┐
│ Task: Update documentation               │
│ Status: Todo                             │
│ Created by: You                          │
│                                          │
│ [Edit]  [Delete] ← Enabled (Blue)       │
└──────────────────────────────────────────┘
```

### State 2: Cannot Delete (Status = In Progress)
```
┌──────────────────────────────────────────┐
│ Task: Fix login bug                      │
│ Status: In Progress                      │
│ Created by: You                          │
│                                          │
│ [Edit]  [Delete] ← Disabled (Gray)      │
│         ↑                                │
│         └─ Tooltip: "Cannot delete       │
│            task once work has started"   │
└──────────────────────────────────────────┘
```

### State 3: Cannot Delete (Not Creator)
```
┌──────────────────────────────────────────┐
│ Task: Deploy feature                     │
│ Status: Todo                             │
│ Created by: Tech Lead                    │
│                                          │
│ (No Edit/Delete buttons shown)           │
└──────────────────────────────────────────┘
```

## Task Status Flow with Delete Permission

```
┌─────────┐
│  TODO   │ ← Can Delete ✅
└────┬────┘
     │
     ▼
┌─────────────┐
│ IN PROGRESS │ ← Cannot Delete ❌
└──────┬──────┘
       │
       ▼
┌────────┐
│ REVIEW │ ← Cannot Delete ❌
└────┬───┘
     │
     ▼
┌───────────┐
│ COMPLETED │ ← Cannot Delete ❌
└───────────┘

     OR
     
┌───────────┐
│ CANCELLED │ ← Cannot Delete ❌
└───────────┘
```

## User Scenarios

### Scenario 1: Admin Creates and Deletes Task (Before Work Starts)

```
Step 1: Admin creates task
┌──────────────────────────────────┐
│ Create Task                      │
│ Title: Update API docs           │
│ Assign to: Developer A           │
│ Status: Todo                     │
│                                  │
│ [Create Task]                    │
└──────────────────────────────────┘

Step 2: Admin views in "Created" tab
┌──────────────────────────────────┐
│ Update API docs                  │
│ Status: Todo                     │
│ Assigned to: Developer A         │
│                                  │
│ [Edit] [Delete] ← Can delete ✅  │
└──────────────────────────────────┘

Step 3: Admin deletes task
✅ Task deleted successfully
```

### Scenario 2: Admin Creates Task, Developer Starts Work (Cannot Delete)

```
Step 1: Admin creates task
┌──────────────────────────────────┐
│ Create Task                      │
│ Title: Fix payment bug           │
│ Assign to: Developer B           │
│ Status: Todo                     │
└──────────────────────────────────┘

Step 2: Developer B starts work
┌──────────────────────────────────┐
│ Developer B changes status       │
│ Todo → In Progress               │
└──────────────────────────────────┘

Step 3: Admin tries to delete
┌──────────────────────────────────┐
│ Fix payment bug                  │
│ Status: In Progress              │
│ Assigned to: Developer B         │
│                                  │
│ [Edit] [Delete] ← Disabled ❌    │
│         ↑                        │
│         └─ "Cannot delete task   │
│            once work has started"│
└──────────────────────────────────┘

❌ Delete button is disabled
```

### Scenario 3: Admin Views Another Admin's Task (All Tasks View)

```
Step 1: Admin A creates task
┌──────────────────────────────────┐
│ Admin A creates:                 │
│ "Prepare monthly report"         │
│ Assigned to: HR Manager          │
└──────────────────────────────────┘

Step 2: Admin B views in "All Tasks"
┌──────────────────────────────────┐
│ Prepare monthly report           │
│ Created by: Admin A              │
│ Assigned to: HR Manager          │
│ Status: Todo                     │
│                                  │
│ (No Edit/Delete buttons)         │
│ [View Details] only              │
└──────────────────────────────────┘

❌ Admin B cannot edit or delete
✅ Admin B can view all details
```

## Grid View Layout

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ Fix login bug       │  │ Update docs         │  │ Code review         │
│ ─────────────────── │  │ ─────────────────── │  │ ─────────────────── │
│ By: Admin User      │  │ By: HR Manager      │  │ By: Admin User      │
│ To: John Doe        │  │ To: Jane Smith      │  │ To: Bob Johnson     │
│ Status: In Progress │  │ Status: Todo        │  │ Status: Review      │
│ Priority: High      │  │ Priority: Medium    │  │ Priority: Low       │
│                     │  │                     │  │                     │
│ [Edit] [Delete]     │  │ (View only)         │  │ [Edit] [Delete]     │
│        ↑ Disabled   │  │                     │  │        ↑ Disabled   │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

## Color Coding

### Status Badges
- **Todo**: Gray/Neutral
- **In Progress**: Blue
- **Review**: Yellow/Orange
- **Completed**: Green
- **Cancelled**: Red

### Priority Badges
- **Low**: Gray
- **Medium**: Yellow
- **High**: Red

### Action Buttons
- **Edit**: Outline/Secondary
- **Delete (Enabled)**: Red/Destructive
- **Delete (Disabled)**: Gray/Muted with tooltip

## Responsive Behavior

### Desktop View (> 1024px)
- Full table with all columns visible
- Filter buttons in a row
- Actions column on the right

### Tablet View (768px - 1024px)
- Table with scrolling
- Some columns may wrap
- Filter buttons remain visible

### Mobile View (< 768px)
- Switches to card/grid view automatically
- Stacked layout
- Touch-friendly buttons

## Accessibility Features

1. **Keyboard Navigation**
   - Tab through filter buttons
   - Enter to activate
   - Arrow keys for dropdowns

2. **Screen Readers**
   - Proper ARIA labels
   - Status announcements
   - Button state descriptions

3. **Visual Indicators**
   - Color + icon for status
   - Disabled state clearly visible
   - Tooltips for additional context

4. **Focus Management**
   - Clear focus indicators
   - Logical tab order
   - Skip links available

---

**Note**: All screenshots and diagrams are ASCII representations. Actual UI uses modern design with gradients, shadows, and smooth animations.
