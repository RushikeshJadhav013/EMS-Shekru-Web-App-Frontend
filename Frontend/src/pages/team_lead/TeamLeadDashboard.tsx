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
  ChevronRight as ChevronRightIcon,
  ChevronLeft,
  Activity,
  CheckCircle2,
  TrendingUp,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatIST, todayIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';
import TruncatedText from '@/components/ui/TruncatedText';
import SummaryCard from '@/components/ui/SummaryCard';


interface TeamMemberStatus {
  name: string;
  designation: string;
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
  const [activitiesPage, setActivitiesPage] = useState(1);
  const ACTIVITIES_PER_PAGE = 10;
  const [teamMembers, setTeamMembers] = useState<TeamMemberStatus[]>([]);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(false);
  const [projectGroups, setProjectGroups] = useState<{ projectId: number; projectName: string; members: TeamMemberStatus[] }[]>([]);

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
        const departmentEmployees = employees.filter((emp: any) =>
          (emp.department || '').trim().toLowerCase() === (user.department || '').trim().toLowerCase() &&
          emp.role?.toLowerCase() === 'employee' &&
          emp.is_active !== false &&
          emp.id !== user.id // Avoid duplicates if TL is also in employee list
        );

        const allTrackedMembers = [...departmentEmployees];

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
              designation: emp.designation || (emp.id === user.id ? 'Team Lead' : 'Employee'),
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

        // Sort teamMembers alphabetically
        const sortedMembers = [...teamMembersData].sort((a, b) => {
          return a.name.localeCompare(b.name);
        });

        setTeamMembers(sortedMembers);

        // ── Group members by project ──
        try {
          const projectsData = await apiService.getProjects();
          const projectList = Array.isArray(projectsData) ? projectsData : projectsData?.projects || [];

          // Build a map: userId -> list of projects
          const userProjectMap: Record<string, { projectId: number; projectName: string }[]> = {};
          const groups: { projectId: number; projectName: string; members: TeamMemberStatus[] }[] = [];

          for (const proj of projectList) {
            // Try to fetch project members
            let projMembers: any[] = proj.members || [];
            if (!projMembers.length) {
              try {
                projMembers = await apiService.getProjectMembers(proj.project_id);
              } catch (_) { projMembers = []; }
            }

            const memberIds = projMembers.map((m: any) => String(m.user_id || m.userId || m.id || ''));

            // Track which project(s) each user belongs to
            memberIds.forEach(uid => {
              if (!userProjectMap[uid]) userProjectMap[uid] = [];
              userProjectMap[uid].push({ projectId: proj.project_id, projectName: proj.name });
            });

            // Match with teamMembers by userId
            const matchedMembers = sortedMembers.filter(m => memberIds.includes(m.userId));
            if (matchedMembers.length > 0) {
              groups.push({
                projectId: proj.project_id,
                projectName: proj.name,
                members: matchedMembers,
              });
            }
          }

          // Members not in any project → "Unassigned" group
          const assignedUserIds = new Set(Object.keys(userProjectMap));
          const unassigned = sortedMembers.filter(m => !assignedUserIds.has(m.userId));
          if (unassigned.length > 0) {
            groups.push({ projectId: -1, projectName: 'Unassigned', members: unassigned });
          }

          setProjectGroups(groups);
        } catch (_) {
          // If project fetch fails, fall back to ungrouped
          setProjectGroups([{ projectId: -1, projectName: 'All Members', members: sortedMembers }]);
        }

        // Calculate aggregate stats for summary cards
        const activeTasks = tasks.filter((t: any) => {
          const s = (t.status || '').toLowerCase().replace(/[-_]/g, ' ');
          return ['pending', 'in progress', 'overdue', 'todo', 'started'].includes(s);
        }).length;

        const totalValidTasks = tasks.filter((t: any) => {
          const s = (t.status || '').toLowerCase();
          return s !== 'cancelled' && s !== 'canceled';
        }).length;

        const completedTasksCount = tasks.filter((t: any) => {
          const s = (t.status || '').toLowerCase();
          return s === 'completed' || s === 'complete' || s === 'achieved' || s === 'done';
        }).length;

        const efficiency = totalValidTasks > 0
          ? Math.round((completedTasksCount / totalValidTasks) * 100)
          : 0;

        // Pending reviews: tasks with status pending, review, or submitted
        const pendingReviewsCount = tasks.filter((t: any) => {
          const s = (t.status || '').toLowerCase();
          return s === 'pending' || s === 'review' || s === 'submitted';
        }).length;

        // Update stats based on filtered data
        setStats(prev => ({
          ...prev,
          teamSize: allTrackedMembers.length,
          employeeCount: departmentEmployees.length,
          presentToday: teamMembersData.filter(m => m.status === 'present').length,
          onLeave: teamMembersData.filter(m => m.status === 'on-leave').length,
          tasksInProgress: activeTasks,
          pendingReviews: pendingReviewsCount,
          teamEfficiency: efficiency
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
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-sm p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-teal-500/5 rounded-full blur-3xl" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#000000' }}>
                {t.common.welcome}, <span style={{ color: '#059669' }}>{user?.name}</span>
              </h1>
              <p className="font-medium flex items-center gap-2 mt-1 text-sm" style={{ color: '#000000' }}>
                <CalendarDays className="h-4 w-4" style={{ color: '#000000' }} />
                {formatIST(new Date(), 'EEEE, MMMM dd, yyyy | hh:mm a')}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/team_lead/tasks')}
            className="rounded-xl px-6 h-12 bg-[#2563EB] hover:bg-blue-700 text-white shadow-lg shadow-blue-200 border-2 border-[#2563EB] transition-all hover:scale-105 active:scale-95"
            style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Task
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="border-2 border-[#000000] p-4 rounded-2xl bg-white/50 mb-8 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: t.navigation.teamSize,
              value: stats.teamSize,
              icon: Users,
              iconColor: 'text-blue-600',
              iconBg: 'bg-blue-50',
            },
            {
              label: 'Active Tasks',
              value: stats.tasksInProgress,
              icon: ClipboardList,
              iconColor: 'text-indigo-600',
              iconBg: 'bg-indigo-50',
              path: '/team_lead/tasks'
            },
            {
              label: 'Pending Reviews',
              value: stats.pendingReviews,
              icon: AlertCircle,
              iconColor: 'text-amber-600',
              iconBg: 'bg-amber-50',
              path: '/team_lead/tasks',
              pathState: { filter: 'review' }
            },
            {
              label: 'Team Efficiency',
              value: `${stats.teamEfficiency}%`,
              icon: TrendingUp,
              iconColor: 'text-emerald-600',
              iconBg: 'bg-emerald-50',
            },
          ].map((stat, i) => (
            <SummaryCard
              key={i}
              title={stat.label}
              value={stat.value}
              icon={stat.icon}
              iconColor={stat.iconColor}
              iconBg={stat.iconBg}
              onClick={() => (stat as any).path && navigate((stat as any).path)}
            />
          ))}

        </div>
      </div>

      {/* Main Content Grid */}
      <div className="space-y-6">
        {/* Team Members Grouped by Project */}
        <Card className="border-2 border-[#000000] shadow-xl bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50 dark:bg-gray-950 px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[16px] font-bold uppercase tracking-tight">{t.navigation.teamMembers}</span>
                </CardTitle>
                <CardDescription className="text-[14px] font-medium mt-1 text-black">Members grouped by project</CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full px-4 h-8 bg-white dark:bg-gray-800 border-2 border-black">
                <span className="text-[14px] font-bold text-black">{teamMembers.length} Total</span>
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
            ) : projectGroups.length === 0 ? (
              /* fallback: flat list while groups are loading */
              <div className="divide-y">
                {teamMembers.map((member) => (
                  <div key={member.userId} className="flex items-center gap-4 p-4 hover:bg-emerald-50/30 transition-colors">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center border-2 border-white shadow-sm font-bold text-emerald-700 flex-shrink-0">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold truncate" style={{ color: '#000000' }}>{member.name}</p>
                      <p className="text-[12px] font-medium text-slate-500">{member.designation}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {projectGroups.map((group) => (
                  <div key={group.projectId}>
                    {/* Project group header */}
                    <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-900/60 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shadow-sm ${group.projectId === -1 ? 'bg-slate-400' : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}>
                        <ClipboardList className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-[13px] font-bold tracking-tight truncate" style={{ color: '#000000' }}>
                        {group.projectName}
                      </span>
                      <Badge className="ml-auto text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border-0 font-bold rounded-full">
                        {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                      </Badge>
                    </div>
                    {/* Members under this project */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-0 divide-y sm:divide-y-0">
                      {group.members.map((member) => (
                        <div
                          key={member.userId}
                          className="flex items-center gap-3 p-4 hover:bg-emerald-50/30 transition-colors border-b border-slate-50 dark:border-slate-800"
                        >
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-800 dark:to-teal-900 flex items-center justify-center border-2 border-white shadow-sm font-bold text-emerald-700 dark:text-emerald-300 text-sm flex-shrink-0">
                            {member.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold truncate" style={{ color: '#000000' }}>
                              {member.name}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 truncate">
                              {member.designation}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="border-2 border-[#000000] shadow-xl bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50 dark:bg-gray-950 px-6 py-4">
            <CardTitle className="flex items-center gap-2" style={{ color: '#000000' }}>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <span className="text-[16px] font-bold uppercase tracking-tight">Team Activity</span>
            </CardTitle>
            <CardDescription className="text-xs font-medium mt-1" style={{ color: '#000000' }}>Recent updates from your team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {recentActivities
              .slice((activitiesPage - 1) * ACTIVITIES_PER_PAGE, activitiesPage * ACTIVITIES_PER_PAGE)
              .map((activity, i) => (
                <div key={activity.id} className="relative pl-8 pb-4 last:pb-0">
                  {i !== (recentActivities.slice((activitiesPage - 1) * ACTIVITIES_PER_PAGE, activitiesPage * ACTIVITIES_PER_PAGE).length - 1) && (
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
                    <p className="text-sm font-bold" style={{ color: '#000000' }}>{activity.user}</p>
                    <div className="text-xs leading-relaxed" style={{ color: '#000000' }}>
                      <TruncatedText text={activity.status} maxLength={50} showToggle={false} />
                    </div>
                    <p className="text-[12px] font-bold uppercase tracking-tight pt-1 text-black">{activity.time}</p>
                  </div>
                </div>
              ))}

            {recentActivities.length > ACTIVITIES_PER_PAGE && (
              <div className="mt-6 pt-4 border-t flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActivitiesPage(p => Math.max(1, p - 1))}
                  disabled={activitiesPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE) }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={activitiesPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActivitiesPage(page)}
                    className="h-8 w-8 p-0"
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActivitiesPage(p => Math.min(Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE), p + 1))}
                  disabled={activitiesPage === Math.ceil(recentActivities.length / ACTIVITIES_PER_PAGE)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
            {recentActivities.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground font-medium">No recent updates</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamLeadDashboard;
