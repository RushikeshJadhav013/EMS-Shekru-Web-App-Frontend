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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';

interface TeamMemberStatus {
  name: string;
  status: 'present' | 'on-leave' | 'absent';
  task: string;
  progress: number;
  userId: string;
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

        // Fetch today's metrics for all tracked members
        const teamMembersData: TeamMemberStatus[] = await Promise.all(
          allTrackedMembers.map(async (emp: any) => {
            const userId = String(emp.id || emp.user_id || '');

            // Get tasks assigned to this employee
            const employeeTasks = tasks.filter((task: any) => {
              const assignedTo = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
              return assignedTo.includes(userId);
            });

            // Get active tasks (not completed)
            const activeTasks = employeeTasks.filter((task: any) =>
              task.status !== 'completed' && task.status !== 'cancelled'
            );

            // Calculate progress
            const totalTasks = employeeTasks.length;
            const completedTasks = employeeTasks.filter((task: any) => task.status === 'completed').length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            const currentTask = activeTasks.length > 0
              ? activeTasks[0].title || 'No active task'
              : completedTasks > 0
                ? 'All tasks completed'
                : 'No tasks assigned';

            let status: 'present' | 'on-leave' | 'absent' = 'present';
            // Simple status logic: if no tasks and not self, assume absent for demo
            if (activeTasks.length === 0 && completedTasks === 0 && emp.id !== user.id) {
              status = 'absent';
            }

            return {
              name: emp.id === user.id ? `${emp.name} (You)` : (emp.name || 'Unknown'),
              status,
              task: currentTask,
              progress,
              userId,
            };
          })
        );

        // Sort teamMembers: Put 'You' at the top
        const sortedMembers = [...teamMembersData].sort((a, b) => {
          if (a.userId === String(user.id)) return -1;
          if (b.userId === String(user.id)) return 1;
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
            Assign New Task
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${stat.bg.split(' ')[0]}`} />

            <CardContent className="p-6 relative">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${stat.bg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                {stat.action && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-white/50 dark:hover:bg-black/20" onClick={() => navigate('/team_lead/tasks')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</h3>
                <div className="flex items-baseline gap-1">
                  <div className="text-3xl font-black text-gray-900 dark:text-gray-100">{stat.value}</div>
                </div>
                {stat.progress !== undefined ? (
                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-1">
                      <span>PROGRESS</span>
                      <span>{stat.progress}%</span>
                    </div>
                    <Progress value={stat.progress} className="h-1.5" />
                  </div>
                ) : (
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/50 dark:bg-gray-900/30 border border-black/5 dark:border-white/5`}>
                    <CheckCircle2 className={`h-3 w-3 ${stat.color === 'blue' ? 'text-blue-500' :
                      stat.color === 'indigo' ? 'text-indigo-500' :
                        'text-amber-500'
                      }`} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{stat.sub}</span>
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
                  <div key={member.userId} className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center border-2 border-white shadow-sm font-bold text-gray-600 dark:text-gray-300">
                            {member.name.charAt(0)}
                          </div>
                          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${member.status === 'present' ? 'bg-green-500' :
                            member.status === 'on-leave' ? 'bg-amber-500' :
                              'bg-gray-400'
                            }`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">{member.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Active Task</span>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{member.task}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {member.status === 'present' && (
                          <div className="hidden sm:block w-32">
                            <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground mb-1">
                              <span>Progress</span>
                              <span className="text-emerald-600">{member.progress}%</span>
                            </div>
                            <Progress value={member.progress} className="h-1.5" />
                          </div>
                        )}
                        <Badge className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase border-none ${member.status === 'present' ? 'bg-green-100 text-green-700' :
                          member.status === 'on-leave' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                          {member.status === 'present' ? 'Active Now' :
                            member.status === 'on-leave' ? 'On Leave' :
                              'Offline'}
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => navigate(`/employees/profile/${member.userId}`)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
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
          <Card className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-none shadow-lg">
            <CardContent className="p-6">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
                <ClipboardList className="h-6 w-6" />
              </div>
              <h4 className="font-extrabold text-lg mb-2">Manager's Insight</h4>
              <p className="text-emerald-50 text-xs leading-relaxed opacity-90">
                Regular check-ins with your team can boost productivity by 15%. Consider reviewing current tasks to ensure alignment.
              </p>
              <Button variant="secondary" size="sm" className="w-full mt-6 bg-white text-emerald-700 hover:bg-emerald-50 font-bold rounded-xl" onClick={() => navigate('/team_lead/tasks')}>
                Review All Tasks
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TeamLeadDashboard;