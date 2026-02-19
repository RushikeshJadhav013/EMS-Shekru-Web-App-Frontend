import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { LeaveBalanceProvider } from "@/contexts/LeaveBalanceContext";
import { HolidayProvider } from "@/contexts/HolidayContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import MainLayout from "@/components/layout/MainLayout";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import HRDashboard from "@/pages/hr/HRDashboard";
import ManagerDashboard from "@/pages/manager/ManagerDashboard";
import TeamLeadDashboard from "@/pages/team_lead/TeamLeadDashboard";
import EmployeeDashboard from "@/pages/employee/EmployeeDashboard";
import NotFound from "./pages/NotFound";
import AttendancePage from "@/pages/attendance/AttendancePage";
import AttendanceWithToggle from "@/pages/attendance/AttendanceWithToggle";
import AttendanceManager from "@/pages/attendance/AttendanceManager";
import TaskManagement from "@/pages/tasks/TaskManagement";
import EmployeeManagement from "@/pages/employees/EmployeeManagement";
import DepartmentManagement from "@/pages/departments/DepartmentManagement";
import Reports from "@/pages/reports/Reports";
import LeaveManagement from "@/pages/leaves/LeaveManagement";
import HiringManagement from "@/pages/hiring/HiringManagement";
import TeamManagement from "@/pages/teams/TeamManagement";
import ShiftScheduleManagement from "@/pages/shifts/ShiftScheduleManagement";
import TeamShifts from "@/pages/shifts/TeamShifts";
import AccessControl from "@/pages/access/AccessControl";
import Inbox from "@/pages/inbox/Inbox";
import Profile from "@/pages/profile/Profile";
import SettingsPage from "@/pages/settings/SettingsPage";
import ContactSupport from "@/pages/ContactSupport";
import Chat from "@/pages/chat/Chat";
import WFHRequests from "@/pages/wfh/WFHRequests";
import RouteRestorer from "@/components/RouteRestorer";
import SalaryDashboard from "@/pages/salary/SalaryDashboard";
import AddEditSalary from "@/pages/salary/AddEditSalary";
import SalaryDetails from "@/pages/salary/SalaryDetails";
import AddIncrement from "@/pages/salary/AddIncrement";
import { WFHProvider } from "@/contexts/WFHContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <WFHProvider>
                <RouteRestorer>
                  <LeaveBalanceProvider>
                    <HolidayProvider>
                      <ChatProvider>
                        <NotificationProvider>
                          <Toaster />
                          <Sonner />
                          <Routes>
                            {/* Public Routes */}
                            <Route path="/login" element={<Login />} />
                            <Route path="/contact-support" element={<ContactSupport />} />
                            <Route path="/" element={<Navigate to="/login" replace />} />

                            {/* Protected Routes */}
                            <Route element={
                              <ProtectedRoute>
                                <MainLayout />
                              </ProtectedRoute>
                            }>
                              {/* Salary Management Routes */}
                              <Route path="/salary" element={
                                <ProtectedRoute allowedRoles={['admin', 'hr', 'employee', 'manager', 'team_lead']}>
                                  <SalaryDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/salary/add" element={
                                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                                  <AddEditSalary />
                                </ProtectedRoute>
                              } />
                              <Route path="/salary/employee/:id" element={
                                <ProtectedRoute allowedRoles={['admin', 'hr', 'employee', 'manager', 'team_lead']}>
                                  <SalaryDetails />
                                </ProtectedRoute>
                              } />
                              <Route path="/salary/increment/add" element={
                                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                                  <AddIncrement />
                                </ProtectedRoute>
                              } />

                              {/* Admin Routes */}
                              <Route path="/admin" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <AdminDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/attendance" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <AttendanceManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/tasks" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <TaskManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/employees" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <EmployeeManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/employees/new/" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <EmployeeManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/departments" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <DepartmentManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/reports" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <Reports />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/access" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <AccessControl />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/inbox" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <Inbox />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/employees" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <EmployeeManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/leaves" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <LeaveManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/hiring" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <HiringManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/profile" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <Profile />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/settings" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <SettingsPage />
                                </ProtectedRoute>
                              } />
                              <Route path="/admin/chat/*" element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                  <Chat />
                                </ProtectedRoute>
                              } />


                              {/* HR Routes */}
                              <Route path="/hr" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <HRDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/attendance" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <AttendanceWithToggle />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/tasks" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <TaskManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/leaves" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <LeaveManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/wfh" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <WFHRequests />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/employees" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <EmployeeManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/employees/new/" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <EmployeeManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/departments" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <DepartmentManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/employees" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <EmployeeManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/reports" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <Reports />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/inbox" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <Inbox />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/hiring" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <HiringManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/profile" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <Profile />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/settings" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <SettingsPage />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/chat/*" element={
                                <ProtectedRoute allowedRoles={['hr']}>
                                  <Chat />
                                </ProtectedRoute>
                              } />


                              {/* Manager Routes */}
                              <Route path="/manager" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <ManagerDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/team" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <TeamManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/teams" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <TeamManagement />
                                </ProtectedRoute>
                              } />

                              <Route path="/manager/shift-schedule" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <ShiftScheduleManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/attendance" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <AttendanceWithToggle />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/tasks" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <TaskManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/leaves" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <LeaveManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/wfh" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <WFHRequests />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/reports" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <Reports />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/inbox" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <Inbox />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/profile" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <Profile />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/settings" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <SettingsPage />
                                </ProtectedRoute>
                              } />
                              <Route path="/manager/chat/*" element={
                                <ProtectedRoute allowedRoles={['manager']}>
                                  <Chat />
                                </ProtectedRoute>
                              } />

                              {/* Team Lead Routes */}
                              <Route path="/team_lead" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <TeamLeadDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/attendance" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <AttendanceWithToggle />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/tasks" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <TaskManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/leaves" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <LeaveManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/wfh" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <WFHRequests />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/team" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <TeamShifts />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/teams" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <TeamManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/reports" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <Reports />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/inbox" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <Inbox />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/profile" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <Profile />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/settings" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <SettingsPage />
                                </ProtectedRoute>
                              } />
                              <Route path="/team_lead/chat/*" element={
                                <ProtectedRoute allowedRoles={['team_lead']}>
                                  <Chat />
                                </ProtectedRoute>
                              } />

                              {/* Employee Routes */}
                              <Route path="/employee" element={
                                <ProtectedRoute allowedRoles={['employee']}>
                                  <EmployeeDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/employee/attendance" element={
                                <ProtectedRoute allowedRoles={['employee']}>
                                  <AttendanceWithToggle />
                                </ProtectedRoute>
                              } />
                              <Route path="/employee/tasks" element={
                                <ProtectedRoute allowedRoles={['employee']}>
                                  <TaskManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/employee/team" element={
                                <ProtectedRoute allowedRoles={['employee']}>
                                  <TeamShifts />
                                </ProtectedRoute>
                              } />
                              <Route path="/employee/leaves" element={
                                <ProtectedRoute allowedRoles={['employee']}>
                                  <LeaveManagement />
                                </ProtectedRoute>
                              } />
                              <Route path="/employee/wfh" element={
                                <ProtectedRoute allowedRoles={['employee', 'hr', 'manager', 'team_lead']}>
                                  <WFHRequests />
                                </ProtectedRoute>
                              } />
                              <Route path="/employee/inbox" element={
                                <ProtectedRoute allowedRoles={['employee']}>
                                  <Inbox />
                                </ProtectedRoute>
                              } />
                              <Route path="/employee/profile" element={
                                <ProtectedRoute allowedRoles={['employee']}>
                                  <Profile />
                                </ProtectedRoute>
                              } />
                              <Route path="/employee/settings" element={
                                <ProtectedRoute allowedRoles={['employee']}>
                                  <SettingsPage />
                                </ProtectedRoute>
                              } />
                              <Route path="/employee/chat/*" element={
                                <ProtectedRoute allowedRoles={['employee']}>
                                  <Chat />
                                </ProtectedRoute>
                              } />
                            </Route>

                            {/* 404 Route */}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </NotificationProvider>
                      </ChatProvider>
                    </HolidayProvider>
                  </LeaveBalanceProvider>
                </RouteRestorer>
              </WFHProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
