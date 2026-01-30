import React from 'react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Clock,
  CalendarDays,
  ClipboardList,
  AlertCircle,
  ChevronRight,
  Activity,
  CheckCircle2,
  TrendingUp,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatIST, todayIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';

interface TeamMemberStatus {
  name: string;
  status: 'present' | 'on-leave' | 'absent';
  task: string;
  taskStatus?: string;
  progress: number;
  userId: string;
  isOnline: boolean;
  taskCount?: number;
  completedTaskCount?: number;
  // Upcoming deadline task information
  hasUpcomingDeadline?: boolean;
  deadlineDate?: string;
  deadlinePriority?: 'today' | 'soon' | null;
  deadlineTaskTitle?: string;
  deadlineTaskStatus?: string;
  daysUntilDeadline?: number;
}

const TeamLeadDashboard: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    teamSize: 0,
    presentToday: 0,
    onLeave: 0,
    tasksInProgress: 0,
    completedToday: 0,
    pendingReviews: 0,
    teamEfficiency: 0,
    employeeCount: 0,
  });

  const [recentActivities, setRecentActivities] = useState<{ id: number; type: string; user: string; time: string; status: string; }[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberStatus[]>([]);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(false);

  useEffect(() => {
    apiService.getTeamLeadDashboard()
      .then((data) => {
        setStats(data);
        setRecentActivities(data.recentActivities || []);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    const fetchTeamMembersWithStatus = async () => {
      if (!user?.department) return;

      setIsLoadingTeamMembers(true);
      try {
        // Fetch all employees
        const employees = await apiService.getEmployees();

        // Filter by department: include only 'Employee' role from fetched list
        let departmentEmployees = employees.filter((emp: any) =>
          emp.department === user.department &&
          emp.role?.toLowerCase() === 'employee' &&
          emp.is_active !== false &&
          emp.id !== user.id // Avoid duplicates if TL is also in employee list
        );

        // Explicitly add the Team Lead (self) to the list for dashboard tracking
        const selfAsMember = {
          id: user.id,
          name: user.name,
          department: user.department,
          role: user.role || 'TeamLead',
          is_active: true
        };

        const allTrackedMembers = [selfAsMember, ...departmentEmployees];

        // Fetch all tasks
        const tasks = await apiService.getMyTasks();

        // Fetch today's attendance for accurate online/offline status
        const todayStr = todayIST(); // Use todayIST() for consistent date format
        console.log('🔍 Fetching attendance for date:', todayStr, 'department:', user.department);

        let todayAttendance: any[] = [];
        try {
          const attendanceResponse = await apiService.getAttendanceRecords({
            date: todayStr,
            department: user.department
          });

          console.log('📥 Raw attendance API response:', attendanceResponse);

          // Handle response format variations (array directly or object with data property)
          if (Array.isArray(attendanceResponse)) {
            todayAttendance = attendanceResponse;
          } else if (attendanceResponse && Array.isArray(attendanceResponse.data)) {
            todayAttendance = attendanceResponse.data;
          } else if (attendanceResponse && Array.isArray(attendanceResponse.attendance)) {
            todayAttendance = attendanceResponse.attendance;
          }

          console.log(`✅ Found ${todayAttendance.length} attendance records for today`);
          if (todayAttendance.length > 0) {
            console.log('📋 Sample attendance record:', todayAttendance[0]);
          }
        } catch (err) {
          console.error("❌ Failed to fetch today's attendance", err);
        }

        // Fetch today's metrics for all tracked members
        const teamMembersData: TeamMemberStatus[] = await Promise.all(
          allTrackedMembers.map(async (emp: any) => {
            const userId = String(emp.id || emp.user_id || emp.userId || '');
            const employeeId = String(emp.employee_id || emp.employeeId || '');

            // Get tasks assigned to this employee
            // Handle different task assignment formats
            const employeeTasks = tasks.filter((task: any) => {
              // Check if task is assigned to this user
              const assignedTo = task.assignedTo || task.assigned_to || task.assignedToId || task.assigned_to_id;
              const assignedToArray = Array.isArray(assignedTo) ? assignedTo : (assignedTo ? [assignedTo] : []);

              // Also check user_id or userId fields
              const taskUserId = task.user_id || task.userId;
              const taskUserIdArray = taskUserId ? [taskUserId] : [];

              // Match by userId string or number
              const allAssignedIds = [...assignedToArray, ...taskUserIdArray].map(id => String(id));
              return allAssignedIds.includes(userId) || allAssignedIds.includes(String(emp.id));
            });

            // Helper function to extract date part (YYYY-MM-DD) from ISO strings
            const extractDate = (dateStr: any): string | null => {
              if (!dateStr) return null;
              if (typeof dateStr === 'string') {
                // Handle ISO format: "2024-01-15T10:30:00" -> "2024-01-15"
                return dateStr.split('T')[0];
              }
              return null;
            };

            // Filter tasks specifically for TODAY's date
            const todayDateStr = todayIST(); // Format: YYYY-MM-DD

            const todayTasks = employeeTasks.filter((task: any) => {
              // Check all possible date fields
              const dueDate = task.due_date || task.dueDate || task.deadline || task.deadline_date;
              const startDate = task.startDate || task.start_date;
              const createdDate = task.created_at || task.createdAt;

              const dueDateStr = extractDate(dueDate);
              const startDateStr = extractDate(startDate);
              const createdDateStr = extractDate(createdDate);

              // Task is for today if:
              // 1. Due date is today
              // 2. Start date is today
              // 3. Created date is today (if no other date exists)
              return dueDateStr === todayDateStr ||
                startDateStr === todayDateStr ||
                (createdDateStr === todayDateStr && !dueDateStr && !startDateStr);
            });

            // Identify upcoming deadline tasks (due date >= today, status != Completed/Cancelled)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = today.getTime();

            // Configurable: next X days for "soon" deadline (default: 7 days)
            const DEADLINE_SOON_DAYS = 7;
            const soonThreshold = new Date(today);
            soonThreshold.setDate(soonThreshold.getDate() + DEADLINE_SOON_DAYS);
            const soonThresholdTimestamp = soonThreshold.getTime();

            const upcomingDeadlineTasks = employeeTasks.filter((task: any) => {
              // Get task status
              const status = (task.status || '').toLowerCase();

              // Exclude completed and cancelled tasks
              if (status === 'completed' || status === 'done' || status === 'cancelled' || status === 'canceled') {
                return false;
              }

              // Check due date
              const dueDate = task.due_date || task.dueDate || task.deadline || task.deadline_date;
              if (!dueDate) return false;

              const dueDateStr = extractDate(dueDate);
              if (!dueDateStr) return false;

              // Parse due date
              const dueDateObj = new Date(dueDateStr);
              dueDateObj.setHours(0, 0, 0, 0);
              const dueDateTimestamp = dueDateObj.getTime();

              // Task is upcoming if due date >= today
              return dueDateTimestamp >= todayTimestamp;
            });

            // Sort upcoming deadline tasks by due date (nearest first)
            upcomingDeadlineTasks.sort((a: any, b: any) => {
              const dateA = extractDate(a.due_date || a.dueDate || a.deadline || a.deadline_date);
              const dateB = extractDate(b.due_date || b.dueDate || b.deadline || b.deadline_date);

              if (!dateA) return 1;
              if (!dateB) return -1;

              return new Date(dateA).getTime() - new Date(dateB).getTime();
            });

            // Get the nearest upcoming deadline task
            const nearestDeadlineTask = upcomingDeadlineTasks.length > 0 ? upcomingDeadlineTasks[0] : null;

            // Calculate deadline information
            let hasUpcomingDeadline = false;
            let deadlineDate: string | undefined = undefined;
            let deadlinePriority: 'today' | 'soon' | null = null;
            let deadlineTaskTitle: string | undefined = undefined;
            let deadlineTaskStatus: string | undefined = undefined;
            let daysUntilDeadline: number | undefined = undefined;

            if (nearestDeadlineTask) {
              hasUpcomingDeadline = true;
              const dueDate = nearestDeadlineTask.due_date || nearestDeadlineTask.dueDate || nearestDeadlineTask.deadline || nearestDeadlineTask.deadline_date;
              deadlineDate = extractDate(dueDate) || undefined;

              if (deadlineDate) {
                const dueDateObj = new Date(deadlineDate);
                dueDateObj.setHours(0, 0, 0, 0);
                const dueDateTimestamp = dueDateObj.getTime();

                // Calculate days until deadline
                const diffTime = dueDateTimestamp - todayTimestamp;
                daysUntilDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Determine priority
                if (daysUntilDeadline === 0) {
                  deadlinePriority = 'today';
                } else if (daysUntilDeadline <= DEADLINE_SOON_DAYS) {
                  deadlinePriority = 'soon';
                }

                // Get task title and status
                deadlineTaskTitle = nearestDeadlineTask.title || nearestDeadlineTask.task_name || nearestDeadlineTask.name || nearestDeadlineTask.description || 'Untitled Task';

                const rawStatus = nearestDeadlineTask.status || 'todo';
                const normalizedStatus = rawStatus.toLowerCase();

                if (normalizedStatus === 'todo' || normalizedStatus === 'pending' || normalizedStatus === 'not_started') {
                  deadlineTaskStatus = 'Todo';
                } else if (normalizedStatus === 'in-progress' || normalizedStatus === 'inprogress' || normalizedStatus === 'in_progress') {
                  deadlineTaskStatus = 'In Progress';
                } else {
                  deadlineTaskStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
                }
              }
            }

            // Calculate progress based on all employee tasks (not just today's)
            const totalTasks = employeeTasks.length;
            const completedTasks = employeeTasks.filter((task: any) => {
              const status = (task.status || '').toLowerCase();
              return status === 'completed' || status === 'done';
            }).length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            // Format task info for TODAY - show task title and status
            let currentTask = 'No task assigned today';
            let taskStatus: string | undefined = undefined;

            if (todayTasks.length > 0) {
              // Show the first task for today (prioritize active tasks)
              const activeTodayTasks = todayTasks.filter((task: any) => {
                const status = (task.status || '').toLowerCase();
                return status !== 'completed' && status !== 'cancelled' && status !== 'done';
              });

              const taskToShow = activeTodayTasks.length > 0 ? activeTodayTasks[0] : todayTasks[0];
              const taskTitle = taskToShow.title || taskToShow.task_name || taskToShow.name || taskToShow.description || 'Untitled Task';

              // Get task status and normalize it
              const rawStatus = taskToShow.status || 'todo';
              const normalizedStatus = rawStatus.toLowerCase();

              // Map status to display format
              if (normalizedStatus === 'todo' || normalizedStatus === 'pending' || normalizedStatus === 'not_started') {
                taskStatus = 'Todo';
              } else if (normalizedStatus === 'in-progress' || normalizedStatus === 'inprogress' || normalizedStatus === 'in_progress') {
                taskStatus = 'In Progress';
              } else if (normalizedStatus === 'completed' || normalizedStatus === 'done') {
                taskStatus = 'Completed';
              } else if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
                taskStatus = 'Cancelled';
              } else {
                taskStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
              }

              // Truncate long task titles
              const maxTitleLength = 35;
              const displayTitle = taskTitle.length > maxTitleLength
                ? `${taskTitle.substring(0, maxTitleLength)}...`
                : taskTitle;

              const additionalCount = todayTasks.length - 1;
              currentTask = additionalCount > 0
                ? `${displayTitle} (+${additionalCount} more)`
                : displayTitle;
            } else {
              // No tasks for today
              currentTask = 'No task assigned today';
            }

            // Determine status based on attendance
            // Find employee's attendance record for today
            console.log(`👤 Checking attendance for ${emp.name}:`, {
              userId,
              employeeId,
              searching: 'in',
              totalRecords: todayAttendance.length
            });

            const empAttendance = todayAttendance.find((record: any) => {
              // Try multiple field name variations for user ID
              const recUserId = String(record.user_id || record.userId || record.user_id || record.id || '');
              const recEmpId = String(record.employee_id || record.employeeId || record.emp_id || '');

              // Match by User ID (preferred) or Employee ID string
              // Ensure we don't match empty strings
              const userIdMatch = userId && recUserId && userId !== '' && recUserId !== '' && userId === recUserId;
              const empIdMatch = employeeId && recEmpId && employeeId !== '' && recEmpId !== '' && employeeId === recEmpId;

              const isMatch = userIdMatch || empIdMatch;

              if (isMatch) {
                console.log(`✅ MATCH FOUND for ${emp.name}:`, {
                  userIdMatch,
                  empIdMatch,
                  searchingUserId: userId,
                  searchingEmpId: employeeId,
                  foundUserId: recUserId,
                  foundEmpId: recEmpId,
                  checkIn: record.check_in || record.checkInTime,
                  checkOut: record.check_out || record.checkOutTime,
                  record
                });
              }

              return isMatch;
            });

            if (!empAttendance) {
              console.log(`❌ NO MATCH for ${emp.name} - All attendance records:`,
                todayAttendance.map(r => ({
                  user_id: r.user_id,
                  userId: r.userId,
                  employee_id: r.employee_id,
                  employeeId: r.employeeId,
                  name: r.userName || r.name
                }))
              );
            }

            let status: 'present' | 'on-leave' | 'absent' = 'absent';
            let isOnline = false;

            if (empAttendance) {
              // Check for on-leave status first (takes priority)
              const attendanceStatus = (empAttendance.status || '').toLowerCase();
              if (attendanceStatus === 'on_leave' || attendanceStatus === 'on-leave' || attendanceStatus === 'on leave') {
                status = 'on-leave';
                isOnline = false; // On leave = Offline
                console.log(`🏖️ ${emp.name} is ON LEAVE`);
              } else {
                // Check check-in and check-out times
                // Backend may use different field names - check all possible variations
                const checkInTime = empAttendance.check_in ||
                  empAttendance.checkInTime ||
                  empAttendance.check_in_time ||
                  empAttendance.checkIn ||
                  empAttendance.checkin ||
                  empAttendance.checkin_time ||
                  null;

                const checkOutTime = empAttendance.check_out ||
                  empAttendance.checkOutTime ||
                  empAttendance.check_out_time ||
                  empAttendance.checkOut ||
                  empAttendance.checkout ||
                  empAttendance.checkout_time ||
                  null;

                // Helper function to validate date string
                const isValidDateString = (dateStr: any): boolean => {
                  if (!dateStr) return false;
                  if (typeof dateStr !== 'string') return false;
                  const trimmed = dateStr.trim();
                  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'None') {
                    return false;
                  }
                  const date = new Date(trimmed);
                  return !isNaN(date.getTime()) && date.getTime() > 0;
                };

                // Validate that times are actual date strings, not empty/null
                const hasCheckIn = isValidDateString(checkInTime);
                const hasCheckOut = isValidDateString(checkOutTime);

                console.log(`📊 Status check for ${emp.name}:`, {
                  checkInTime,
                  checkOutTime,
                  hasCheckIn,
                  hasCheckOut,
                  attendanceStatus: empAttendance.status,
                  rawRecord: empAttendance
                });

                // Determine status based on check-in/check-out
                // Priority: Check-in status determines online/offline
                if (hasCheckIn && !hasCheckOut) {
                  // Checked in and NOT checked out = Online ✅
                  status = 'present';
                  isOnline = true;
                  console.log(`✅ ${emp.name} is ONLINE (checked in at ${checkInTime}, not checked out)`);
                } else if (hasCheckIn && hasCheckOut) {
                  // Checked in AND checked out = Shift Completed (Present)
                  status = 'present';
                  isOnline = false;
                  console.log(`⭕ ${emp.name} is OFFLINE (Shift Completed)`);
                } else {
                  // No check-in = Absent/Offline
                  status = 'absent';
                  isOnline = false;
                  console.log(`❌ ${emp.name} is OFFLINE (no check-in record)`);
                }
              }
            } else {
              // No attendance record found -> Absent/Offline
              status = 'absent';
              isOnline = false;
              console.log(`❌ ${emp.name} is OFFLINE (no attendance record found)`);
            }

            return {
              name: emp.id === user.id ? `${emp.name} (You)` : (emp.name || 'Unknown'),
              status,
              task: currentTask,
              taskStatus: taskStatus,
              progress,
              userId,
              isOnline,
              taskCount: totalTasks,
              completedTaskCount: completedTasks,
              // Upcoming deadline information
              hasUpcomingDeadline,
              deadlineDate,
              deadlinePriority,
              deadlineTaskTitle,
              deadlineTaskStatus,
              daysUntilDeadline,
            };
          })
        );

        // Sort teamMembers: Prioritize employees with nearest deadlines, then 'You' at the top, then alphabetically
        const sortedMembers = [...teamMembersData].sort((a, b) => {
          // 1. Priority: Employees with upcoming deadlines first
          if (a.hasUpcomingDeadline && !b.hasUpcomingDeadline) return -1;
          if (!a.hasUpcomingDeadline && b.hasUpcomingDeadline) return 1;

          // 2. If both have deadlines, sort by deadline priority (today > soon > null)
          if (a.hasUpcomingDeadline && b.hasUpcomingDeadline) {
            const priorityOrder = { 'today': 0, 'soon': 1, null: 2 };
            const aPriority = priorityOrder[a.deadlinePriority || null];
            const bPriority = priorityOrder[b.deadlinePriority || null];

            if (aPriority !== bPriority) {
              return aPriority - bPriority;
            }

            // If same priority, sort by days until deadline (nearest first)
            if (a.daysUntilDeadline !== undefined && b.daysUntilDeadline !== undefined) {
              return a.daysUntilDeadline - b.daysUntilDeadline;
            }
          }

          // 3. Put 'You' at the top (if no deadline priority)
          if (a.userId === String(user.id)) return -1;
          if (b.userId === String(user.id)) return 1;

          // 4. Alphabetical by name
          return a.name.localeCompare(b.name);
        });

        setTeamMembers(sortedMembers);

        // Update stats based on filtered data
        setStats(prev => ({
          ...prev,
          teamSize: allTrackedMembers.length,
          employeeCount: departmentEmployees.length,
          presentToday: teamMembersData.filter(m => m.status === 'present').length
        }));

        // Inject TL activity if not present
        setRecentActivities(prev => {
          const hasTLActivity = prev.some(a => a.user.includes('You'));
          if (!hasTLActivity) {
            return [
              {
                id: Date.now(),
                type: 'info',
                user: `${user.name} (You)`,
                time: 'Just now',
                status: 'Dashboard accessed & team status reviewed'
              },
              ...prev
            ].slice(0, 6); // Keep latest 6
          }
          return prev;
        });

      } catch (error) {
        console.error('Failed to fetch team members:', error);
      } finally {
        setIsLoadingTeamMembers(false);
      }
    };

    fetchTeamMembersWithStatus();

    // Auto-refresh every 30 seconds to update online/offline status and tasks
    // This ensures real-time updates when employees check in/out
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing team members status...');
      fetchTeamMembersWithStatus();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [user?.department]);

  // recentActivities now comes from API via state above

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border shadow-sm p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-teal-500/5 rounded-full blur-3xl" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                {t.common.welcome}, <span className="text-emerald-600">{user?.name}</span>
              </h1>
              <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                <CalendarDays className="h-4 w-4 text-emerald-500" />
                {formatIST(new Date(), 'EEEE, MMMM dd, yyyy')}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/team_lead/tasks')}
            className="rounded-xl px-6 h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 dark:shadow-none transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create New Task
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: t.navigation.teamSize,
            value: stats.teamSize,
            sub: `${stats.employeeCount} Employees + 1 TeamLead`,
            icon: Users,
            color: 'blue',
            bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
            cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
            borderColor: 'border-blue-300/80 dark:border-blue-700/50',
            hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400'
          },
          {
            label: t.navigation.teamEfficiency,
            value: `${stats.teamEfficiency}%`,
            sub: 'Overall Performance',
            icon: TrendingUp,
            color: 'emerald',
            bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
            cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
            borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
            hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400',
            progress: stats.teamEfficiency
          },
          {
            label: 'Active Tasks',
            value: stats.tasksInProgress,
            sub: `${stats.completedToday} Done Today`,
            icon: ClipboardList,
            color: 'indigo',
            bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
            cardBg: 'bg-indigo-50/40 dark:bg-indigo-950/10',
            borderColor: 'border-indigo-300/80 dark:border-indigo-700/50',
            hoverBorder: 'group-hover:border-indigo-500 dark:group-hover:border-indigo-400'
          },
          {
            label: 'Pending Reviews',
            value: stats.pendingReviews,
            sub: 'Requires Attention',
            icon: AlertCircle,
            color: 'amber',
            bg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
            cardBg: 'bg-amber-50/40 dark:bg-amber-950/10',
            borderColor: 'border-amber-300/80 dark:border-amber-700/50',
            hoverBorder: 'group-hover:border-amber-500 dark:group-hover:border-amber-400',
            action: true
          },
        ].map((stat, i) => (
          <Card key={i} className={`border-2 ${stat.borderColor} ${stat.hoverBorder} shadow-sm ${stat.cardBg} backdrop-blur-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative`}>
            {/* Background Accent */}
            <div className={`absolute -right-3 -top-3 w-16 h-16 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${stat.bg.split(' ')[0]}`} />

            <CardContent className="p-4 relative">
              <div className="flex justify-between items-start mb-3">
                <div className={`p-2 rounded-xl ${stat.bg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                {stat.action && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full hover:bg-white/50 dark:hover:bg-black/20" onClick={() => navigate('/team_lead/tasks')}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                <h3 className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</h3>
                <div className="flex items-baseline gap-1">
                  <div className="text-2xl font-black text-gray-900 dark:text-gray-100">{stat.value}</div>
                </div>
                {stat.progress !== undefined ? (
                  <div className="pt-1.5">
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground mb-1">
                      <span>PROGRESS</span>
                      <span>{stat.progress}%</span>
                    </div>
                    <Progress value={stat.progress} className="h-1" />
                  </div>
                ) : (
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/50 dark:bg-gray-900/30 border border-black/5 dark:border-white/5`}>
                    <CheckCircle2 className={`h-2.5 w-2.5 ${stat.color === 'blue' ? 'text-blue-500' :
                      stat.color === 'indigo' ? 'text-indigo-500' :
                        'text-amber-500'
                      }`} />
                    <span className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">{stat.sub}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Team Members Tracker */}
        <Card className="lg:col-span-8 border-none shadow-sm bg-white dark:bg-gray-800/50 overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50 dark:bg-gray-900/50 px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-600" />
                  {t.navigation.teamMembers}
                </CardTitle>
                <CardDescription className="text-sm">Real-time status and task monitoring</CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full px-4 h-7 border-emerald-200 text-emerald-700 bg-emerald-50">
                {teamMembers.length} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingTeamMembers ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-sm text-muted-foreground font-medium">{t.common.loadingTeamMembers}</p>
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-muted-foreground font-medium">{t.common.noTeamMembers}</p>
              </div>
            ) : (
              <div className="divide-y">
                {teamMembers.map((member) => (
                  <div
                    key={member.userId}
                    className={`group transition-colors p-5 ${member.hasUpcomingDeadline && member.deadlinePriority === 'today'
                      ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 border-l-4 border-red-500'
                      : member.hasUpcomingDeadline && member.deadlinePriority === 'soon'
                        ? 'bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/30 border-l-4 border-orange-500'
                        : 'hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10'
                      }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className={`h-12 w-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center border-2 shadow-sm font-bold text-gray-600 dark:text-gray-300 ${member.hasUpcomingDeadline && member.deadlinePriority === 'today'
                            ? 'border-red-500'
                            : member.hasUpcomingDeadline && member.deadlinePriority === 'soon'
                              ? 'border-orange-500'
                              : 'border-white'
                            }`}>
                            {member.name.charAt(0)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors truncate">
                              {member.name}
                            </h4>
                            <div className="flex items-center gap-1.5 ml-1">
                              {member.isOnline ? (
                                <Badge className="bg-green-500 hover:bg-green-600 h-5 px-1.5 text-[10px] animate-pulse">
                                  Online
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] opacity-70">
                                  Offline
                                </Badge>
                              )}
                            </div>
                            {/* Upcoming Deadline Badge */}
                            {member.hasUpcomingDeadline && (
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-2 py-0 h-5 font-bold flex items-center gap-1 ${member.deadlinePriority === 'today'
                                  ? 'bg-red-100 text-red-700 border-red-400 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800'
                                  : 'bg-orange-100 text-orange-700 border-orange-400 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800'
                                  }`}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {member.deadlinePriority === 'today'
                                  ? 'Deadline Today'
                                  : member.daysUntilDeadline !== undefined
                                    ? `Due in ${member.daysUntilDeadline} day${member.daysUntilDeadline !== 1 ? 's' : ''}`
                                    : 'Upcoming Deadline'}
                              </Badge>
                            )}
                          </div>
                          {/* Show upcoming deadline task if exists, otherwise show today's task */}
                          {member.hasUpcomingDeadline && member.deadlineTaskTitle ? (
                            <div className="space-y-1 mt-1">
                              <div className="flex items-center gap-2">
                                <ClipboardList className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                  {member.deadlineTaskTitle}
                                </span>
                                {member.deadlineTaskStatus && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1.5 py-0 h-4 font-bold ${member.deadlineTaskStatus === 'Completed'
                                      ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
                                      : member.deadlineTaskStatus === 'In Progress'
                                        ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'
                                        : 'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800'
                                      }`}
                                  >
                                    {member.deadlineTaskStatus}
                                  </Badge>
                                )}
                              </div>
                              {member.deadlineDate && (
                                <div className="flex items-center gap-1 ml-5">
                                  <CalendarDays className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    Due: {formatIST(new Date(member.deadlineDate), 'MMM dd, yyyy')}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <ClipboardList className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate">
                                {member.task}
                              </span>
                              {member.taskStatus && member.task !== 'No task assigned today' && (
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] px-1.5 py-0 h-4 font-bold ${member.taskStatus === 'Completed'
                                    ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
                                    : member.taskStatus === 'In Progress'
                                      ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'
                                      : member.taskStatus === 'Cancelled'
                                        ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'
                                        : 'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800'
                                    }`}
                                >
                                  {member.taskStatus}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 flex-shrink-0">
                        {member.task !== 'No task assigned today' && member.taskCount !== undefined && member.taskCount > 0 && (
                          <div className="hidden sm:block w-32">
                            <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground mb-1">
                              <span>Progress</span>
                              <span className="text-emerald-600">{member.progress}%</span>
                            </div>
                            <Progress value={member.progress} className="h-1.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm bg-white dark:bg-gray-800/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                Team Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivities.map((activity, i) => (
                <div key={activity.id} className="relative pl-8 pb-4 last:pb-0">
                  {i !== recentActivities.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-100 dark:bg-gray-700" />
                  )}
                  <div className={`absolute left-0 top-1 h-8 w-8 rounded-full flex items-center justify-center shadow-sm z-10 ${activity.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                    activity.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                    {activity.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
                    {activity.type === 'warning' && <AlertCircle className="h-4 w-4" />}
                    {activity.type === 'info' && <Clock className="h-4 w-4" />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{activity.user}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{activity.status}</p>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight pt-1">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground font-medium">No recent updates</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Productivity Tip or Quick Links */}

        </div>
      </div>
    </div>
  );
};

export default TeamLeadDashboard;