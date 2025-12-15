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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  });

  const [recentActivities, setRecentActivities] = useState<{id: number; type: string; user: string; time: string; status: string;}[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberStatus[]>([]);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(false);

  useEffect(() => {
    apiService.getTeamLeadDashboard()
      .then((data) => {
        setStats(data);
        setRecentActivities(data.recentActivities || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchTeamMembersWithStatus = async () => {
      if (!user?.department) return;
      
      setIsLoadingTeamMembers(true);
      try {
        // Fetch all employees
        const employees = await apiService.getEmployees();
        
        // Filter by department and exclude managers/admins
        const departmentEmployees = employees.filter((emp: any) => 
          emp.department === user.department && 
          emp.role?.toLowerCase() !== 'manager' && 
          emp.role?.toLowerCase() !== 'admin' &&
          emp.is_active !== false
        );

        // Fetch all tasks
        const tasks = await apiService.getMyTasks();
        
        // Get today's date for attendance check
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        // Fetch today's attendance (we'll need to check if there's an endpoint for this)
        // For now, we'll use the tasks to determine status
        const teamMembersData: TeamMemberStatus[] = await Promise.all(
          departmentEmployees.map(async (emp: any) => {
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

            // Calculate progress based on completed vs total tasks
            const totalTasks = employeeTasks.length;
            const completedTasks = employeeTasks.filter((task: any) => task.status === 'completed').length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            // Get the most recent active task title
            const currentTask = activeTasks.length > 0 
              ? activeTasks[0].title || 'No active task'
              : completedTasks > 0 
                ? 'All tasks completed'
                : 'No tasks assigned';

            // Determine status (simplified - we'll assume present if they have tasks, on-leave if no tasks)
            // In a real scenario, you'd check attendance records
            let status: 'present' | 'on-leave' | 'absent' = 'present';
            if (activeTasks.length === 0 && completedTasks === 0) {
              status = 'absent';
            }

            return {
              name: emp.name || 'Unknown',
              status,
              task: currentTask,
              progress,
              userId,
            };
          })
        );

        setTeamMembers(teamMembersData);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-green-700 to-teal-800 text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="h-7 w-7 text-white" />
            </div>
            {t.common.welcome}, Team Lead!
          </h1>
          <p className="text-emerald-100 mt-2 ml-15">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => navigate('/team_lead/tasks')} className="gap-2 bg-white text-emerald-700 hover:bg-emerald-50">
          <ClipboardList className="h-4 w-4" />
          Assign Task
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover border-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-indigo-50">
              {t.navigation.teamSize}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.teamSize}</div>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-100" />
              <span className="text-sm text-indigo-100">{stats.presentToday} present</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-50">
              {t.navigation.teamEfficiency}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.teamEfficiency}%</div>
            <Progress value={stats.teamEfficiency} className="mt-2 h-2 bg-white/30" />
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyan-50">
              Tasks In Progress
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.tasksInProgress}</div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-sm text-cyan-100">{stats.completedToday} completed today</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-50">
              Pending Reviews
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingReviews}</div>
            <Button variant="link" className="p-0 h-auto mt-2 text-white hover:text-amber-100" onClick={() => navigate('/team_lead/tasks')}>
              <span className="text-sm">Review now</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Member Status */}
        <Card className="lg:col-span-2 border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              {t.navigation.teamMembers}
            </CardTitle>
            <CardDescription className="text-base">Current status and task progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingTeamMembers ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t.common.loadingTeamMembers}</p>
            ) : teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t.common.noTeamMembers}</p>
            ) : (
              teamMembers.map((member) => (
                <div key={member.userId} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                        member.status === 'present' ? 'bg-green-500' : 
                        member.status === 'on-leave' ? 'bg-amber-500' : 
                        'bg-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.task}</p>
                    </div>
                  </div>
                    <Badge variant={
                      member.status === 'present' ? 'default' : 
                      member.status === 'on-leave' ? 'secondary' : 
                      'outline'
                    }>
                      {member.status === 'present' ? 'Active' : 
                       member.status === 'on-leave' ? 'On Leave' : 
                       'Absent'}
                  </Badge>
                </div>
                {member.status === 'present' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{member.progress}%</span>
                    </div>
                    <Progress value={member.progress} className="h-1" />
                  </div>
                )}
              </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              Recent Activity
            </CardTitle>
            <CardDescription className="text-base">Latest team updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  activity.type === 'success' ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
                  activity.type === 'warning' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                  'bg-gradient-to-br from-blue-400 to-indigo-500'
                }`}>
                  {activity.type === 'success' && <CheckCircle2 className="h-5 w-5 text-white" />}
                  {activity.type === 'warning' && <AlertCircle className="h-5 w-5 text-white" />}
                  {activity.type === 'info' && <Activity className="h-5 w-5 text-white" />}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{activity.user}</p>
                  <p className="text-xs text-muted-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.quickActions}</CardTitle>
          <CardDescription>Frequently used team lead actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/team_lead/teams')}>
              <Users className="h-5 w-5" />
              <span className="text-xs">{t.navigation.viewTeam}</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/team_lead/attendance')}>
              <Clock className="h-5 w-5" />
              <span className="text-xs">{t.navigation.teamAttendance}</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/team_lead/leaves')}>
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs">Leave Requests</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-2" onClick={() => navigate('/team_lead/tasks')}>
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs">Manage Tasks</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamLeadDashboard;