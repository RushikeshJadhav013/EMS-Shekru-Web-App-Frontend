import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown,
  Users,
  Clock,
  Target,
  Award,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Filter,
  FileSpreadsheet,
  Star,
  Edit
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { nowIST } from '@/utils/timezone';
import { toast } from '@/hooks/use-toast';
import RatingDialog, { EmployeeRating } from '@/components/rating/RatingDialog';
import ExportDialog from '@/components/reports/ExportDialog';
import V2Overlay from '@/components/ui/V2Overlay';

interface EmployeePerformance {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  role: string;
  attendanceScore: number;
  taskCompletionRate: number;
  productivity: number;
  qualityScore: number;
  overallRating: number;
  month: string;
  year: number;
}

interface DepartmentMetrics {
  department: string;
  totalEmployees: number;
  avgProductivity: number;
  avgAttendance: number;
  tasksCompleted: number;
  tasksPending: number;
  performanceScore: number;
}

export default function Reports() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(nowIST().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(nowIST().getFullYear().toString());
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  
  // Check URL for tab parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const [selectedReportType, setSelectedReportType] = useState(tabParam || 'performance');
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePerformance | null>(null);
  const [employeeRatings, setEmployeeRatings] = useState<Record<string, EmployeeRating>>({});
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportEmployee, setExportEmployee] = useState<{ id: string; name: string } | null>(null);
  
  // State for API data
  const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[]>([]);
  const [departmentMetrics, setDepartmentMetrics] = useState<DepartmentMetrics[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<any>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load ratings from localStorage on mount
  useEffect(() => {
    const savedRatings = localStorage.getItem('employeeRatings');
    if (savedRatings) {
      setEmployeeRatings(JSON.parse(savedRatings));
    }
  }, []);

  // Save ratings to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(employeeRatings).length > 0) {
      localStorage.setItem('employeeRatings', JSON.stringify(employeeRatings));
    }
  }, [employeeRatings]);

  // Load departments on mount
  useEffect(() => {
    loadDepartments();
  }, []);

  // Load report data when filters change
  useEffect(() => {
    loadReportData();
  }, [selectedMonth, selectedYear, selectedDepartment]);

  const loadDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://staffly.space/reports/departments', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': token ? `Bearer ${token}` : '',
      };

      const month = parseInt(selectedMonth);
      const year = parseInt(selectedYear);
      const dept = selectedDepartment !== 'all' ? selectedDepartment : undefined;

      // Build query parameters
      const empParams = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
        ...(dept && { department: dept }),
      });

      const deptParams = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
      });

      const summaryParams = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
      });

      // Fetch all data in parallel
      const [empResponse, deptResponse, summaryResponse] = await Promise.all([
        fetch(`https://staffly.space/reports/employee-performance?${empParams}`, { headers }),
        fetch(`https://staffly.space/reports/department-metrics?${deptParams}`, { headers }),
        fetch(`https://staffly.space/reports/executive-summary?${summaryParams}`, { headers }),
      ]);

      // Handle employee performance response
      if (empResponse.ok) {
        const empData = await empResponse.json();
        setEmployeePerformance(empData.employees || []);
      } else {
        console.error('Employee performance error:', empResponse.status, await empResponse.text());
        setEmployeePerformance([]);
      }

      // Handle department metrics response
      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        setDepartmentMetrics(deptData.departments || []);
      } else {
        console.error('Department metrics error:', deptResponse.status, await deptResponse.text());
        setDepartmentMetrics([]);
      }

      // Handle executive summary response
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setExecutiveSummary(summaryData);
      } else {
        console.error('Executive summary error:', summaryResponse.status, await summaryResponse.text());
        setExecutiveSummary(null);
      }

      // Show error toast if any request failed
      if (!empResponse.ok || !deptResponse.ok || !summaryResponse.ok) {
        toast({
          title: 'Partial Data Load',
          description: 'Some report data could not be loaded. Check console for details.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load report data:', error);
      setEmployeePerformance([]);
      setDepartmentMetrics([]);
      setExecutiveSummary(null);
      toast({
        title: 'Error',
        description: 'Failed to load report data. Please check if backend is running.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRating = (rating: EmployeeRating) => {
    setEmployeeRatings(prev => ({
      ...prev,
      [rating.employeeId]: rating
    }));
  };

  const openRatingDialog = (employee: EmployeePerformance) => {
    setSelectedEmployee(employee);
    setRatingDialogOpen(true);
  };

  const getEmployeeRating = (employeeId: string) => {
    return employeeRatings[employeeId];
  };

  const calculateProductivity = (employeeId: string) => {
    const rating = getEmployeeRating(employeeId);
    if (!rating) return 0;
    return (rating.productivityRating / 5) * 100;
  };

  const calculateQualityScore = (employeeId: string) => {
    const rating = getEmployeeRating(employeeId);
    if (!rating) return 0;
    return (rating.qualityRating / 5) * 100;
  };

  const calculateOverallRating = (employee: EmployeePerformance) => {
    const productivity = calculateProductivity(employee.employeeId);
    const qualityScore = calculateQualityScore(employee.employeeId);
    
    // If no manual ratings exist, return 0
    if (productivity === 0 || qualityScore === 0) return 0;
    
    // Calculate average of all 4 metrics
    return Math.round(
      (employee.attendanceScore + employee.taskCompletionRate + productivity + qualityScore) / 4
    );
  };

  const filteredPerformance = employeePerformance;

  // Group employees by department
  const employeesByDepartment = React.useMemo(() => {
    const grouped: Record<string, EmployeePerformance[]> = {};
    filteredPerformance.forEach(emp => {
      const dept = emp.department || 'No Department';
      if (!grouped[dept]) {
        grouped[dept] = [];
      }
      grouped[dept].push(emp);
    });
    return grouped;
  }, [filteredPerformance]);

  const toggleDepartment = (department: string) => {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(department)) {
        newSet.delete(department);
      } else {
        newSet.add(department);
      }
      return newSet;
    });
  };

  const expandAllDepartments = () => {
    setExpandedDepartments(new Set(Object.keys(employeesByDepartment)));
  };

  const collapseAllDepartments = () => {
    setExpandedDepartments(new Set());
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return { variant: 'default' as const, text: 'Excellent' };
    if (score >= 75) return { variant: 'secondary' as const, text: 'Good' };
    if (score >= 60) return { variant: 'outline' as const, text: 'Average' };
    return { variant: 'destructive' as const, text: 'Poor' };
  };

  const openExportDialog = (employee?: { id: string; name: string }) => {
    setExportEmployee(employee || null);
    setExportDialogOpen(true);
  };

  const handleQuickExport = async (format: 'csv' | 'pdf' = 'csv') => {
    try {
      // Generate full report with current filters
      const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);
      const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0);
      
      const params = new URLSearchParams({
        format: format,
        start_date: `${selectedYear}-${String(parseInt(selectedMonth) + 1).padStart(2, '0')}-01`,
        end_date: `${selectedYear}-${String(parseInt(selectedMonth) + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
      });

      if (selectedDepartment !== 'all') {
        // If department filter is applied, we need to get all employees from that department
        // The backend will filter by employee_id, so we'll let it handle all employees
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`https://staffly.space/reports/export?${params}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Export failed:', response.status, errorText);
        throw new Error(`Export failed: ${response.status}`);
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const monthName = new Date(parseInt(selectedYear), parseInt(selectedMonth)).toLocaleString('default', { month: 'long' });
      const filename = `performance_report_${monthName}_${selectedYear}.${format}`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: `Full report generated successfully as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative">
      {(user?.role === 'manager' || user?.role === 'team_lead') && <V2Overlay />}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
        {/* Header Section */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:gap-0 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Performance Reports
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Track and analyze team performance</p>
              </div>
            </div>
            
            {/* Filters - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 lg:flex lg:gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-auto lg:w-[140px] h-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 shadow-sm">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">January</SelectItem>
                  <SelectItem value="1">February</SelectItem>
                  <SelectItem value="2">March</SelectItem>
                  <SelectItem value="3">April</SelectItem>
                  <SelectItem value="4">May</SelectItem>
                  <SelectItem value="5">June</SelectItem>
                  <SelectItem value="6">July</SelectItem>
                  <SelectItem value="7">August</SelectItem>
                  <SelectItem value="8">September</SelectItem>
                  <SelectItem value="9">October</SelectItem>
                  <SelectItem value="10">November</SelectItem>
                  <SelectItem value="11">December</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full sm:w-auto lg:w-[110px] h-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 shadow-sm">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-full sm:w-auto lg:w-[200px] h-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 shadow-sm">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={selectedReportType} onValueChange={setSelectedReportType} className="space-y-4 sm:space-y-6">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 p-2">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 bg-transparent h-auto">
              <TabsTrigger 
                value="performance" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 rounded-xl py-2 px-4 text-sm sm:text-base flex items-center justify-center"
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Employee Performance</span>
                <span className="sm:hidden">Employees</span>
              </TabsTrigger>
              <TabsTrigger 
                value="department" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 rounded-xl py-2 px-4 text-sm sm:text-base flex items-center justify-center"
              >
                <PieChart className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Department Metrics</span>
                <span className="sm:hidden">Departments</span>
              </TabsTrigger>
              <TabsTrigger 
                value="summary" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 rounded-xl py-2 px-4 text-sm sm:text-base flex items-center justify-center"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Executive Summary</span>
                <span className="sm:hidden">Summary</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="performance" className="space-y-4">
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Individual Performance Metrics</h2>
                    <p className="text-sm text-muted-foreground mt-1">Detailed employee performance analysis</p>
                  </div>
                  <Button 
                    onClick={() => openExportDialog()} 
                    className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading employee performance data...</p>
                  </div>
                ) : filteredPerformance.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                      <Users className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No employee data available</p>
                    <p className="text-sm text-muted-foreground mt-2">Try selecting a different month, year, or department.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Expand/Collapse All Buttons */}
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={expandAllDepartments}
                        className="text-xs"
                      >
                        Expand All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={collapseAllDepartments}
                        className="text-xs"
                      >
                        Collapse All
                      </Button>
                    </div>

                    {/* Department Groups */}
                    {Object.entries(employeesByDepartment).map(([department, employees]) => {
                      const isExpanded = expandedDepartments.has(department);
                      const deptAvgScore = Math.round(
                        employees.reduce((sum, emp) => sum + calculateOverallRating(emp), 0) / employees.length
                      );
                      
                      return (
                        <div key={department} className="border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                          {/* Department Header - Clickable */}
                          <button
                            onClick={() => toggleDepartment(department)}
                            className="w-full p-4 sm:p-6 bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 hover:from-slate-200 hover:to-gray-200 dark:hover:from-slate-700 dark:hover:to-gray-700 transition-all duration-200"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                                  <Users className="h-6 w-6 text-white" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">{department}</h3>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {employees.length} {employees.length === 1 ? 'Employee' : 'Employees'} • Avg Score: {deptAvgScore}%
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge className={`px-4 py-2 text-sm font-bold ${getPerformanceBadge(deptAvgScore).variant === 'default' ? 'bg-green-500' : getPerformanceBadge(deptAvgScore).variant === 'secondary' ? 'bg-yellow-500' : 'bg-red-500'} text-white`}>
                                  {getPerformanceBadge(deptAvgScore).text}
                                </Badge>
                                <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* Employee List - Collapsible */}
                          {isExpanded && (
                            <div className="p-4 sm:p-6 space-y-4 bg-white dark:bg-slate-900">
                              {employees.map((employee) => {
                    const productivity = calculateProductivity(employee.employeeId);
                    const qualityScore = calculateQualityScore(employee.employeeId);
                    const overallRating = calculateOverallRating(employee);
                    const badge = getPerformanceBadge(overallRating);
                    const rating = getEmployeeRating(employee.employeeId);
                    const hasRating = !!rating;
                    
                    return (
                      <div 
                        key={employee.id} 
                        className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-6 hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                              {employee.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-slate-800 dark:text-white">{employee.name}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {employee.employeeId} • {employee.department} • {employee.role}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge 
                              variant={badge.variant} 
                              className="text-xs sm:text-sm px-3 py-1 shadow-md"
                            >
                              {badge.text}
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openRatingDialog(employee)}
                              className="text-xs sm:text-sm shadow-sm hover:shadow-md transition-shadow"
                            >
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              {hasRating ? 'Update' : 'Rate'}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openExportDialog({ id: employee.employeeId, name: employee.name })}
                              className="text-xs sm:text-sm shadow-sm hover:shadow-md transition-shadow"
                            >
                              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Export
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Attendance</p>
                              </div>
                              <div className="flex items-baseline gap-2 mb-2">
                                <span className={`text-2xl sm:text-3xl font-bold ${getPerformanceColor(employee.attendanceScore)}`}>
                                  {employee.attendanceScore}
                                </span>
                                <span className="text-sm text-muted-foreground">%</span>
                              </div>
                              <Progress value={employee.attendanceScore} className="h-2 mb-2" />
                              <p className="text-xs text-muted-foreground">Auto-calculated</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                  <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Tasks</p>
                              </div>
                              <div className="flex items-baseline gap-2 mb-2">
                                <span className={`text-2xl sm:text-3xl font-bold ${getPerformanceColor(employee.taskCompletionRate)}`}>
                                  {employee.taskCompletionRate}
                                </span>
                                <span className="text-sm text-muted-foreground">%</span>
                              </div>
                              <Progress value={employee.taskCompletionRate} className="h-2 mb-2" />
                              <p className="text-xs text-muted-foreground">Auto-calculated</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                  <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Productivity</p>
                              </div>
                              {hasRating ? (
                                <>
                                  <div className="flex items-baseline gap-2 mb-2">
                                    <span className={`text-2xl sm:text-3xl font-bold ${getPerformanceColor(productivity)}`}>
                                      {Math.round(productivity)}
                                    </span>
                                    <span className="text-sm text-muted-foreground">%</span>
                                  </div>
                                  <div className="flex gap-1 mb-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`h-3 w-3 sm:h-4 sm:w-4 ${
                                          star <= rating.productivityRating
                                            ? 'fill-yellow-400 text-yellow-400'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <Progress value={productivity} className="h-2 mb-2" />
                                </>
                              ) : (
                                <div className="py-4">
                                  <span className="text-sm text-muted-foreground">Not rated yet</span>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">Manual rating</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                  <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Quality</p>
                              </div>
                              {hasRating ? (
                                <>
                                  <div className="flex items-baseline gap-2 mb-2">
                                    <span className={`text-2xl sm:text-3xl font-bold ${getPerformanceColor(qualityScore)}`}>
                                      {Math.round(qualityScore)}
                                    </span>
                                    <span className="text-sm text-muted-foreground">%</span>
                                  </div>
                                  <div className="flex gap-1 mb-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`h-3 w-3 sm:h-4 sm:w-4 ${
                                          star <= rating.qualityRating
                                            ? 'fill-yellow-400 text-yellow-400'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <Progress value={qualityScore} className="h-2 mb-2" />
                                </>
                              ) : (
                                <div className="py-4">
                                  <span className="text-sm text-muted-foreground">Not rated yet</span>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">Manual rating</p>
                            </div>
                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-lg p-3 sm:p-4 shadow-md border-2 border-indigo-200 dark:border-indigo-700">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                  <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-indigo-900 dark:text-indigo-200">Overall</p>
                              </div>
                              {overallRating > 0 ? (
                                <>
                                  <div className="flex items-baseline gap-2 mb-2">
                                    <span className={`text-3xl sm:text-4xl font-bold ${getPerformanceColor(overallRating)}`}>
                                      {overallRating}
                                    </span>
                                    <span className="text-sm text-muted-foreground">%</span>
                                  </div>
                                  <Progress value={overallRating} className="h-2 mb-2" />
                                </>
                              ) : (
                                <div className="py-4">
                                  <span className="text-sm text-muted-foreground">Pending ratings</span>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">Average score</p>
                            </div>
                          </div>
                          {hasRating && (
                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                              <h4 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">Performance Comments</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                                  <p className="text-xs font-semibold text-purple-900 dark:text-purple-200 mb-1 flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    Productivity
                                  </p>
                                  <p className="text-sm text-slate-700 dark:text-slate-300">{rating.productivityDescription}</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1">
                                    <Award className="h-3 w-3" />
                                    Quality
                                  </p>
                                  <p className="text-sm text-slate-700 dark:text-slate-300">{rating.qualityDescription}</p>
                                </div>
                              </div>
                            </div>
                          )}
                                </div>
                              );
                            })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="department" className="space-y-4">
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Department Performance Overview</h2>
                    <p className="text-sm text-muted-foreground mt-1">Compare department metrics and performance</p>
                  </div>
                  <Button 
                    onClick={() => openExportDialog()} 
                    className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {departmentMetrics.map((dept) => {
                    const badge = getPerformanceBadge(dept.performanceScore);
                    return (
                      <div 
                        key={dept.department}
                        className="bg-gradient-to-br from-white to-purple-50 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-6 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                              <Users className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">{dept.department}</h3>
                          </div>
                          <Badge variant={badge.variant} className="shadow-md">
                            {badge.text}
                          </Badge>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Employees
                            </span>
                            <span className="font-bold text-lg">{dept.totalEmployees}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                              <p className="text-xs text-muted-foreground mb-1">Productivity</p>
                              <p className={`text-xl font-bold ${getPerformanceColor(dept.avgProductivity)}`}>
                                {dept.avgProductivity}%
                              </p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-xs text-muted-foreground mb-1">Attendance</p>
                              <p className={`text-xl font-bold ${getPerformanceColor(dept.avgAttendance)}`}>
                                {dept.avgAttendance}%
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="text-xs text-muted-foreground mb-1">Completed</p>
                              <p className="text-xl font-bold text-green-600">{dept.tasksCompleted}</p>
                            </div>
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                              <p className="text-xs text-muted-foreground mb-1">Pending</p>
                              <p className="text-xl font-bold text-yellow-600">{dept.tasksPending}</p>
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Performance Score</span>
                              <span className={`font-bold text-2xl ${getPerformanceColor(dept.performanceScore)}`}>
                                {dept.performanceScore}%
                              </span>
                            </div>
                            <Progress value={dept.performanceScore} className="h-3" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="summary" className="space-y-4 sm:space-y-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading executive summary...</p>
              </div>
            ) : (
              <>
                {/* Quick Stats - Mobile Optimized */}
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl sm:rounded-2xl shadow-lg border border-blue-200 dark:border-blue-800 p-4 sm:p-6 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="p-2 sm:p-3 bg-blue-500 rounded-lg sm:rounded-xl shadow-lg">
                        <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Avg Performance</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-1">{executiveSummary?.avgPerformance || 0}%</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">All Employees</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl sm:rounded-2xl shadow-lg border border-purple-200 dark:border-purple-800 p-4 sm:p-6 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="p-2 sm:p-3 bg-purple-500 rounded-lg sm:rounded-xl shadow-lg">
                        <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Tasks Completed</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-1">{executiveSummary?.totalTasksCompleted || 0}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">This month</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl sm:rounded-2xl shadow-lg border border-amber-200 dark:border-amber-800 p-4 sm:p-6 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="p-2 sm:p-3 bg-amber-500 rounded-lg sm:rounded-xl shadow-lg">
                        <Award className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Best Department</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-1 truncate">{executiveSummary?.bestDepartment?.name || 'N/A'}</p>
                    <p className="text-xs sm:text-sm font-semibold text-amber-600">{executiveSummary?.bestDepartment?.score || 0}% Score</p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl sm:rounded-2xl shadow-lg border border-emerald-200 dark:border-emerald-800 p-4 sm:p-6 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="p-2 sm:p-3 bg-emerald-500 rounded-lg sm:rounded-xl shadow-lg">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Employees Analyzed</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-1">{executiveSummary?.totalEmployeesAnalyzed || 0}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Active staff</p>
                  </div>
                </div>

                {/* Top 5 Performers Section - Mobile Optimized */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="p-3 sm:p-4 md:p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg sm:rounded-xl shadow-lg">
                        <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-white">Top 5 Performers</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">Based on comprehensive performance metrics</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 md:p-6">
                    {executiveSummary?.topPerformers && executiveSummary.topPerformers.length > 0 ? (
                      <div className="space-y-3 sm:space-y-4">
                        {executiveSummary.topPerformers.map((performer: any, index: number) => {
                          const rankColors = [
                            'from-yellow-400 to-amber-500',
                            'from-gray-300 to-gray-400',
                            'from-orange-400 to-amber-600',
                            'from-blue-400 to-indigo-500',
                            'from-purple-400 to-pink-500'
                          ];
                          const rankIcons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                          
                          return (
                            <div 
                              key={performer.employeeId}
                              className="bg-gradient-to-br from-white to-green-50 dark:from-slate-800 dark:to-slate-900 rounded-lg sm:rounded-xl shadow-lg border-2 border-green-200 dark:border-green-800 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300 hover:scale-[1.01]"
                            >
                              <div className="flex flex-col gap-4">
                                {/* Top: Rank & Employee Info + Overall Score */}
                                <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${rankColors[index]} flex items-center justify-center text-2xl sm:text-3xl shadow-lg flex-shrink-0`}>
                                      {rankIcons[index]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white truncate">{performer.name}</h3>
                                      <p className="text-xs sm:text-sm text-muted-foreground truncate">ID: {performer.employeeId}</p>
                                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{performer.department} • {performer.role}</p>
                                    </div>
                                  </div>

                                  {/* Overall Score - Mobile Optimized */}
                                  <div className="w-full xs:w-auto flex xs:flex-col items-center justify-between xs:justify-center gap-2 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-3 sm:p-4 border-2 border-green-300 dark:border-green-700">
                                    <div className="text-center">
                                      <p className="text-xs font-semibold text-muted-foreground mb-1">Overall Score</p>
                                      <p className="text-3xl sm:text-4xl font-bold text-green-600">{performer.score}</p>
                                      <p className="text-xs text-muted-foreground hidden xs:block">out of 100</p>
                                    </div>
                                    <div className="w-24 xs:w-full">
                                      <Progress value={performer.score} className="h-2" />
                                    </div>
                                  </div>
                                </div>

                                {/* Performance Metrics - Fully Responsive Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 sm:p-3 border border-blue-200 dark:border-blue-800">
                                    <p className="text-xs text-muted-foreground mb-1 truncate">On-time Check-in</p>
                                    <p className="text-base sm:text-lg font-bold text-blue-600">{performer.earlyCheckinScore}%</p>
                                    <Progress value={performer.earlyCheckinScore} className="h-1.5 mt-1" />
                                  </div>
                                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 sm:p-3 border border-green-200 dark:border-green-800">
                                    <p className="text-xs text-muted-foreground mb-1 truncate">Task Completion</p>
                                    <p className="text-base sm:text-lg font-bold text-green-600">{performer.taskCompletionScore}%</p>
                                    <Progress value={performer.taskCompletionScore} className="h-1.5 mt-1" />
                                  </div>
                                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 sm:p-3 border border-purple-200 dark:border-purple-800">
                                    <p className="text-xs text-muted-foreground mb-1 truncate">Attendance</p>
                                    <p className="text-base sm:text-lg font-bold text-purple-600">{performer.attendanceScore}%</p>
                                    <Progress value={performer.attendanceScore} className="h-1.5 mt-1" />
                                  </div>
                                  <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-2 sm:p-3 border border-pink-200 dark:border-pink-800">
                                    <p className="text-xs text-muted-foreground mb-1 truncate">Leave Score</p>
                                    <p className="text-base sm:text-lg font-bold text-pink-600">{performer.leaveScore}%</p>
                                    <Progress value={performer.leaveScore} className="h-1.5 mt-1" />
                                  </div>
                                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2 sm:p-3 border border-slate-200 dark:border-slate-600">
                                    <p className="text-xs text-muted-foreground mb-1 truncate">Task Efficiency</p>
                                    <p className="text-base sm:text-lg font-bold text-slate-600 dark:text-slate-300">{performer.taskEfficiency}</p>
                                    <p className="text-xs text-muted-foreground">tasks/day</p>
                                  </div>
                                </div>

                                {/* Bottom: Additional Stats - Responsive Grid */}
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                  <div className="text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                                    <p className="text-xs text-muted-foreground mb-1">Tasks Completed</p>
                                    <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">{performer.completedTasks}/{performer.totalTasks}</p>
                                  </div>
                                  <div className="text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                                    <p className="text-xs text-muted-foreground mb-1">Attendance Days</p>
                                    <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">{performer.attendanceDays}/{performer.workingDays}</p>
                                  </div>
                                  <div className="text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                                    <p className="text-xs text-muted-foreground mb-1">On-time Check-in</p>
                                    <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">{performer.earlyCheckins}</p>
                                  </div>
                                  <div className="text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                                    <p className="text-xs text-muted-foreground mb-1">Leave Days</p>
                                    <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">{performer.totalLeaveDays}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                          <TrendingUp className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No performance data available</p>
                        <p className="text-sm text-muted-foreground mt-2">Performance data will appear once employees have attendance and task records.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-xl border border-white/20 overflow-hidden">
              <div className="p-3 sm:p-4 md:p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-700">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-white">Executive Summary</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Insights and recommendations</p>
              </div>
              <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading summary...</p>
                  </div>
                ) : executiveSummary ? (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-blue-500 rounded-lg">
                          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Key Findings</h3>
                      </div>
                      <ul className="space-y-2">
                        {executiveSummary.keyFindings?.map((finding: string, index: number) => (
                          <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                            <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
                            <span className="flex-1">{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-purple-500 rounded-lg">
                          <Target className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Recommendations</h3>
                      </div>
                      <ul className="space-y-2">
                        {executiveSummary.recommendations?.map((rec: string, index: number) => (
                          <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                            <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                            <span className="flex-1">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2 mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-emerald-500 rounded-lg">
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Action Items</h3>
                      </div>
                      <ul className="space-y-2">
                        {executiveSummary.actionItems?.map((item: string, index: number) => (
                          <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                            <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
                            <span className="flex-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                      <FileText className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No summary data available</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto shadow-sm text-xs sm:text-sm"
                    onClick={() => handleQuickExport('csv')}
                  >
                    <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="truncate">Generate Full Report (CSV)</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto shadow-sm text-xs sm:text-sm"
                    onClick={() => handleQuickExport('pdf')}
                  >
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="truncate">Generate Full Report (PDF)</span>
                  </Button>
                  <Button 
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg text-xs sm:text-sm"
                    onClick={() => openExportDialog()}
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="truncate">Custom Export</span>
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {selectedEmployee && (
          <RatingDialog
            open={ratingDialogOpen}
            onOpenChange={setRatingDialogOpen}
            employeeId={selectedEmployee.employeeId}
            employeeName={selectedEmployee.name}
            onSave={handleSaveRating}
            currentRatings={getEmployeeRating(selectedEmployee.employeeId)}
          />
        )}

        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          selectedEmployee={exportEmployee}
        />
      </div>
    </div>
  );
}