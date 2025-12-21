# Holiday Calendar Implementation

## Overview
Implemented a global holiday calendar system that displays holidays across all dashboards and leave calendars. When an admin sets a holiday in the admin dashboard, it automatically appears in all leave calendars throughout the application.

## Architecture

### 1. HolidayContext (`src/contexts/HolidayContext.tsx`)
- **Purpose**: Centralized state management for company holidays
- **Features**:
  - Global holiday storage using localStorage
  - Automatic persistence across browser sessions
  - Methods to add, remove, and query holidays
  - Real-time synchronization across all components

### 2. Holiday Provider
- **Location**: `src/App.tsx`
- **Placement**: Wrapped around all child components to ensure global availability
- **Storage Key**: `companyHolidays` in localStorage

### 3. Enhanced Calendar Components

#### CalendarWithSelect (`src/components/ui/calendar-with-select.tsx`)
- **Enhancement**: Added holiday highlighting
- **Features**:
  - Displays holidays with red/orange gradient background
  - Shows a small red dot indicator on holiday dates
  - Automatically syncs with HolidayContext
  - Used in LeaveManagement page

#### CalendarWithHolidays (`src/components/ui/calendar-with-holidays.tsx`)
- **Purpose**: Reusable calendar component with holiday support
- **Features**:
  - Can be used in any dashboard or page
  - Configurable holiday indicator display
  - Responsive design with dark mode support

### 4. LeaveManagement Updates (`src/pages/leaves/LeaveManagement.tsx`)
- **Changes**:
  - Removed local holiday state management
  - Now uses `useHolidays()` hook from HolidayContext
  - Holiday operations (add/remove) use context methods
  - Automatic persistence through context

## How It Works

### Adding a Holiday
1. Admin navigates to Admin Dashboard → Leaves Calendar
2. Admin enters holiday name and date
3. Holiday is added via `addHoliday()` from HolidayContext
4. Holiday is automatically saved to localStorage
5. All calendars across the app update in real-time

### Displaying Holidays
1. Any component using `useHolidays()` hook gets access to holidays
2. CalendarWithSelect automatically highlights holiday dates
3. Holiday dates show:
   - Red/orange gradient background
   - Small red dot indicator at the bottom
   - Hover effects for better visibility

### Data Flow
```
Admin Dashboard (LeaveManagement)
    ↓
HolidayContext.addHoliday()
    ↓
localStorage.setItem('companyHolidays', ...)
    ↓
All components using useHolidays() hook
    ↓
CalendarWithSelect displays holidays
    ↓
Employee/Manager/Team Lead Dashboards
```

## Usage in Components

### Using the HolidayContext
```typescript
import { useHolidays } from '@/contexts/HolidayContext';

function MyComponent() {
  const { holidays, addHoliday, removeHoliday, isHoliday, getHolidayName } = useHolidays();
  
  // Check if a date is a holiday
  const isHolidayDate = isHoliday(new Date(2025, 0, 1));
  
  // Get holiday name
  const holidayName = getHolidayName(new Date(2025, 0, 1));
  
  // Add a holiday
  addHoliday({
    date: new Date(2025, 0, 1),
    name: 'New Year',
    description: 'New Year celebration'
  });
  
  // Remove a holiday
  removeHoliday(new Date(2025, 0, 1));
}
```

### Using CalendarWithSelect
```typescript
import { CalendarWithSelect } from '@/components/ui/calendar-with-select';

function MyCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>();
  
  return (
    <CalendarWithSelect
      mode="single"
      selected={selectedDate}
      onSelect={setSelectedDate}
      showHolidayIndicator={true}
    />
  );
}
```

## Holiday Display Features

### Visual Indicators
- **Background**: Red/orange gradient (light mode) or darker gradient (dark mode)
- **Border**: Subtle red border around holiday dates
- **Indicator Dot**: Small red dot at the bottom of the date cell
- **Hover Effect**: Enhanced visibility on hover

### Responsive Design
- Works on all screen sizes
- Dark mode support
- Accessible color contrasts
- Touch-friendly on mobile devices

## Storage Format

### localStorage Structure
```json
{
  "companyHolidays": [
    {
      "date": "2025-01-01T00:00:00.000Z",
      "name": "New Year",
      "description": "New Year celebration"
    },
    {
      "date": "2025-01-26T00:00:00.000Z",
      "name": "Republic Day",
      "description": "National holiday"
    }
  ]
}
```

## Default Holidays
The system comes with two default holidays:
- **New Year**: January 1, 2025
- **Republic Day**: February 26, 2025

These can be modified or removed by the admin.

## Features

### ✅ Implemented
- Global holiday management
- Real-time synchronization across all dashboards
- Holiday highlighting in calendars
- Persistent storage
- Add/remove holidays
- Query holidays by date
- Dark mode support
- Responsive design

### 🔄 Automatic Updates
- When a holiday is added/removed in one place, it updates everywhere
- No page refresh needed
- Real-time synchronization

### 🛡️ Data Validation
- Prevents duplicate holidays on the same date
- Validates holiday names
- Prevents past date holidays

## Files Modified/Created

### Created
- `src/contexts/HolidayContext.tsx` - Holiday context and provider
- `src/components/ui/calendar-with-holidays.tsx` - Calendar component with holiday support

### Modified
- `src/App.tsx` - Added HolidayProvider
- `src/components/ui/calendar-with-select.tsx` - Added holiday highlighting
- `src/pages/leaves/LeaveManagement.tsx` - Updated to use HolidayContext

## Testing Scenarios

### Scenario 1: Add Holiday
1. Go to Admin Dashboard → Leaves Calendar
2. Add a new holiday (e.g., "Diwali" on Oct 20)
3. Verify it appears in all leave calendars
4. Refresh the page - holiday persists

### Scenario 2: Remove Holiday
1. Go to Admin Dashboard → Leaves Calendar
2. Remove an existing holiday
3. Verify it disappears from all calendars
4. Refresh the page - removal persists

### Scenario 3: View Holiday in Different Dashboards
1. Add a holiday in Admin Dashboard
2. Check Employee Dashboard - holiday visible
3. Check Manager Dashboard - holiday visible
4. Check Team Lead Dashboard - holiday visible

### Scenario 4: Dark Mode
1. Enable dark mode
2. View calendar with holidays
3. Verify holiday styling is visible and readable

## Future Enhancements

- Backend API integration for holiday management
- Recurring holidays (annual holidays)
- Holiday categories (national, company, regional)
- Holiday notifications
- Holiday calendar export (iCal format)
- Multi-year holiday planning
