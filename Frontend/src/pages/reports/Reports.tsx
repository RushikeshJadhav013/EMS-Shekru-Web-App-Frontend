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
  Edit,
  Check,
  ChevronsUpDown
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { nowIST, formatIST } from '@/utils/timezone';
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
  completedTasks?: number;
  taskEfficiency?: number;
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

const CORE_DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'HR',
  'Human Resources',
  'Finance',
  'Operations',
  'Legal',
  'Customer Support',
  'IT',
  'Administration',
  'Management'
];

export default function Reports() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const currentDate = nowIST();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [yearOpen, setYearOpen] = useState(false);

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

  // Load report data when filters change
  useEffect(() => {
    loadReportData();
  }, [selectedMonth, selectedYear, selectedDepartment]);

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
        fetch(`https://staffly.space/reports/employee-performance/?${empParams}`, { headers }),
        fetch(`https://staffly.space/reports/department-metrics/?${deptParams}`, { headers }),
        fetch(`https://staffly.space/reports/executive-summary/?${summaryParams}`, { headers }),
      ]);

      // Handle employee performance response
      if (empResponse.ok) {
        const empData = await empResponse.json();
        const rawEmployees = empData.employees || [];

        // Map raw API data to EmployeePerformance interface with robust fallbacks
        const employees = rawEmployees.map((emp: any): EmployeePerformance => ({
          id: emp.id || emp.user_id || emp.employeeId || '',
          employeeId: emp.employeeId || emp.employee_id || emp.id || '',
          name: emp.name || 'Unknown',
          department: emp.department || emp.department_name || 'No Department',
          role: emp.role || 'Staff',
          attendanceScore: Math.round(emp.attendanceScore || emp.attendance_score || 0),
          taskCompletionRate: Math.round(emp.taskCompletionRate || emp.task_completion_rate || emp.taskCompletionScore || emp.task_completion_score || 0),
          productivity: emp.productivity || emp.productivity_score || 0,
          qualityScore: emp.qualityScore || emp.quality_score || 0,
          overallRating: emp.overallRating || emp.overall_rating || 0,
          month: emp.month || selectedMonth,
          completedTasks: emp.completedTasks || emp.completed_tasks || 0,
          taskEfficiency: emp.taskEfficiency || emp.task_efficiency || 0
        }));

        setEmployeePerformance(employees);

        // Update departments list to only include those with employees AND are considered Core Departments
        const employeeDepts = Array.from(
          new Set(
            employees
              .map((emp: EmployeePerformance) => emp.department)
              .filter((dept: string) => {
                if (!dept || dept.includes(',')) return false;
                // Filter for Core Departments (case-insensitive)
                return CORE_DEPARTMENTS.some(core => core.toLowerCase() === dept.toLowerCase());
              })
          )
        ).sort() as string[];

        // If filtering leaves nothing but we have employees, fallback to showing all non-empty departments
        // This prevents showing an empty list if department naming conventions don't match standard Core names
        const finalDepts = employeeDepts.length > 0 ? employeeDepts : Array.from(
          new Set(
            employees
              .map((emp: EmployeePerformance) => emp.department)
              .filter((dept: string) => dept && !dept.includes(','))
          )
        ).sort() as string[];

        setDepartments(finalDepts);

        // Reset department filter if selected department has no employees
        if (selectedDepartment !== 'all' && !employeeDepts.includes(selectedDepartment)) {
          setSelectedDepartment('all');
        }
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

  // Calculate overall score for Elite Performers (uses available metrics)
  const calculateEliteScore = (employee: EmployeePerformance) => {
    const productivity = calculateProductivity(employee.employeeId);
    const qualityScore = calculateQualityScore(employee.employeeId);

    // Always use attendance and task completion as base metrics
    const baseScore = (employee.attendanceScore || 0) + (employee.taskCompletionRate || 0);

    // If manual ratings exist, include them in the calculation
    if (productivity > 0 && qualityScore > 0) {
      return Math.round(
        (baseScore + productivity + qualityScore) / 4
      );
    }

    // Otherwise, use attendance and task completion only (weighted average)
    return Math.round(baseScore / 2);
  };

  // Calculate top 5 performers with enriched data
  const topPerformers = React.useMemo(() => {
    if (!employeePerformance || employeePerformance.length === 0) {
      // Fallback to executive summary top performers if general performance is empty
      const apiPerformers = executiveSummary?.topPerformers;
      if (apiPerformers && Array.isArray(apiPerformers)) {
        return apiPerformers
          .map((p: any) => ({
            employeeId: p.employeeId || p.id || '',
            name: p.name || '',
            department: p.department || '',
            role: p.role || '',
            taskCompletionScore: Math.round(p.taskCompletionScore || p.taskCompletionRate || 0),
            attendanceScore: Math.round(p.attendanceScore || 0),
            completedTasks: p.completedTasks || 0,
            taskEfficiency: p.taskEfficiency || Math.round(p.taskCompletionScore || p.taskCompletionRate || 0),
            score: Math.round(p.score || p.overallRating || 0),
          }))
          .filter(p => p.name && p.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
      }
      return [];
    }

    // Merge detailed performance (including local ratings) with executive summary data
    const enrichedPerformers = employeePerformance
      .map(emp => {
        // Find matching summary data for this employee to get task counts
        const summaryData = executiveSummary?.topPerformers?.find(
          (p: any) => (p.employeeId || p.id) === emp.employeeId
        );

        const productivity = calculateProductivity(emp.employeeId);
        const qualityScore = calculateQualityScore(emp.employeeId);
        const score = calculateEliteScore(emp);

        return {
          employeeId: emp.employeeId,
          name: emp.name,
          department: emp.department,
          role: emp.role,
          taskCompletionScore: Math.round(emp.taskCompletionRate || 0),
          attendanceScore: Math.round(emp.attendanceScore || 0),
          completedTasks: summaryData?.completedTasks || emp.completedTasks || 0,
          taskEfficiency: summaryData?.taskEfficiency || emp.taskEfficiency || Math.round(emp.taskCompletionRate || 0),
          score: score,
          productivity,
          qualityScore,
        };
      })
      .filter(p => p.name && p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return enrichedPerformers;
  }, [employeePerformance, employeeRatings, executiveSummary]);

  const filteredPerformance = employeePerformance;

  // Group employees by department - Filtering for Core Departments if applicable
  const employeesByDepartment = React.useMemo(() => {
    const grouped: Record<string, EmployeePerformance[]> = {};

    // Check if we have any active Core Departments detected
    const hasCoreDepts = departments.length > 0 && departments.every(d =>
      CORE_DEPARTMENTS.some(core => core.toLowerCase() === d.toLowerCase())
    );

    filteredPerformance.forEach(emp => {
      const dept = emp.department || 'No Department';

      // If we are enforcing Core Departments, skip employees not in those departments
      if (hasCoreDepts) {
        const isCore = CORE_DEPARTMENTS.some(core => core.toLowerCase() === dept.toLowerCase());
        if (!isCore) return;
      }

      if (!grouped[dept]) {
        grouped[dept] = [];
      }

      // Merge with executive summary data to ensure we have the latest task metrics
      // This matches the logic used in topPerformers to get accurate task counts
      const summaryData = executiveSummary?.topPerformers?.find(
        (p: any) => (p.employeeId || p.id) === emp.employeeId
      );

      const enrichedEmp = {
        ...emp,
        completedTasks: summaryData?.completedTasks || emp.completedTasks || 0,
        taskEfficiency: summaryData?.taskEfficiency || emp.taskEfficiency || Math.round(emp.taskCompletionRate || 0)
      };

      grouped[dept].push(enrichedEmp);
    });
    return grouped;
  }, [filteredPerformance, departments]);

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
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, text: 'Excellent' };
    if (score >= 60) return { variant: 'secondary' as const, text: 'Good' };
    if (score >= 40) return { variant: 'outline' as const, text: 'Average' };
    return { variant: 'destructive' as const, text: 'Poor' };
  };

  const openExportDialog = (employee?: { id: string; name: string }) => {
    setExportEmployee(employee || null);
    setExportDialogOpen(true);
  };

  const handleQuickExport = async (format: 'csv' | 'pdf' = 'csv') => {
    try {
      // Generate full report with current filters
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
      const response = await fetch(`https://staffly.space/reports/export/?${params}`, {
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

      const monthName = formatIST(new Date(parseInt(selectedYear), parseInt(selectedMonth)), 'MMMM');
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
      {!['admin', 'hr'].includes(user?.role || '') && <V2Overlay fallbackPath="/dashboard" />}
      <div className="w-full space-y-6 pb-20">
        {/* Header Section - aligned with other modern pages */}
        <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-sm mt-1">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-40 w-40 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-40 w-40 bg-indigo-500/5 rounded-full blur-3xl" />

          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200/60 dark:shadow-none">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Performance Reports
              </h1>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span>{formatIST(currentDate, 'EEEE, dd MMM yyyy')}</span>
              </p>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-2 sm:gap-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px] h-10 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <Calendar className="h-4 w-4 mr-1.5 text-slate-400" />
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, i) => (
                  <SelectItem key={i} value={i.toString()} className="text-sm">{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={yearOpen} onOpenChange={setYearOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={yearOpen}
                  className="w-[120px] justify-between h-10 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                >
                  {selectedYear}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[120px] p-0">
                <Command>
                  <CommandInput placeholder="Search..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No year found.</CommandEmpty>
                    <CommandGroup>
                      {/* Fixed height for scrollable dropdown */}
                      <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                        {Array.from({ length: 2040 - 2016 + 1 }, (_, i) => (2040 - i).toString()).map((year) => (
                          <CommandItem
                            key={year}
                            value={year}
                            onSelect={(currentValue) => {
                              setSelectedYear(currentValue);
                              setYearOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedYear === year ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {year}
                          </CommandItem>
                        ))}
                      </div>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[160px] h-10 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-left">
                <Filter className="h-4 w-4 mr-1.5 text-slate-400" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept} className="text-sm">{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>


        {/* Tabs Navigation */}
        <Tabs value={selectedReportType} onValueChange={setSelectedReportType} className="space-y-4">
          <TabsList className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg w-fit border border-slate-200/50 dark:border-slate-700/50">
            <TabsTrigger
              value="performance"
              className="h-9 text-sm font-medium px-4 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm transition-all"
            >
              <Users className="h-4 w-4 mr-1.5" />
              Employee Performance
            </TabsTrigger>
            <TabsTrigger
              value="department"
              className="h-9 text-sm font-medium px-4 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm transition-all"
            >
              <PieChart className="h-4 w-4 mr-1.5" />
              Department Metrics
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="h-9 text-sm font-medium px-4 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm transition-all"
            >
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Executive Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-0 outline-none">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Individual Performance</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Comprehensive behavior and task analysis per team member</p>
                </div>
                <Button
                  onClick={() => openExportDialog()}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </div>

              <div className="p-4 sm:p-6 pb-10">
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
                    <p className="text-sm text-muted-foreground mt-2">Try selecting a different month, year range, or department.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Expand/Collapse All Buttons */}
                    <div className="flex justify-end gap-1.5 mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={expandAllDepartments}
                        className="h-7 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Expand All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={collapseAllDepartments}
                        className="h-7 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Collapse All
                      </Button>
                    </div>

                    {/* Department Groups */}
                    <div className="space-y-3">
                      {Object.entries(employeesByDepartment).map(([department, employees]) => {
                        const isExpanded = expandedDepartments.has(department);
                        const deptAvgScore = Math.round(
                          employees.reduce((sum, emp) => sum + calculateOverallRating(emp), 0) / employees.length
                        );

                        return (
                          <div key={department} className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden transition-all">
                            {/* Department Header - Clickable */}
                            <button
                              onClick={() => toggleDepartment(department)}
                              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">{department}</h3>
                                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    {employees.length} {employees.length === 1 ? 'member' : 'members'} • Performance Avg {deptAvgScore}%
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`h-6 text-xs uppercase font-bold tracking-tighter ${getPerformanceBadge(deptAvgScore).variant === 'default' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : getPerformanceBadge(deptAvgScore).variant === 'secondary' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'} border`}>
                                  {getPerformanceBadge(deptAvgScore).text}
                                </Badge>
                                <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </button>

                            {/* Employee List - Collapsible */}
                            {isExpanded && (
                              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-3">
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
                                      className="group bg-white dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 p-3 sm:p-4 hover:border-blue-200 dark:hover:border-blue-800 transition-all hover:shadow-sm"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-xs ring-2 ring-white dark:ring-slate-800 shadow-sm">
                                            {employee.name.charAt(0)}
                                          </div>
                                          <div>
                                            <h3 className="font-bold text-xl tracking-tight text-slate-800 dark:text-white leading-tight">{employee.name}</h3>
                                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                              ID: {employee.employeeId} • {employee.role}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                          <Badge
                                            variant={badge.variant}
                                            className={`h-6 text-xs uppercase font-bold tracking-tighter ${badge.variant === 'default' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : badge.variant === 'secondary' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'} border shadow-none`}
                                          >
                                            {badge.text}
                                          </Badge>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openRatingDialog(employee)}
                                            className="h-8 px-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          >
                                            <Edit className="h-4 w-4 mr-1.5" />
                                            {hasRating ? 'Update' : 'Rate'}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openExportDialog({ id: employee.employeeId, name: employee.name })}
                                            className="h-8 px-3 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                          >
                                            <Download className="h-4 w-4 mr-1.5" />
                                            Export
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <Clock className="h-4 w-4 text-blue-500" />
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Attendance</p>
                                          </div>
                                          <div className="flex items-baseline gap-1">
                                            <span className={`text-2xl font-black ${getPerformanceColor(employee.attendanceScore)}`}>
                                              {employee.attendanceScore}
                                            </span>
                                            <span className="text-xs text-slate-400 font-medium">%</span>
                                          </div>
                                          <Progress value={employee.attendanceScore} className="h-1 mt-1.5 bg-slate-200 dark:bg-slate-700" />
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <Target className="h-4 w-4 text-emerald-500" />
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tasks %</p>
                                          </div>
                                          <div className="flex items-baseline gap-1">
                                            <span className={`text-2xl font-black ${getPerformanceColor(employee.taskCompletionRate)}`}>
                                              {employee.taskCompletionRate}
                                            </span>
                                            <span className="text-xs text-slate-400 font-medium">%</span>
                                          </div>
                                          <Progress value={employee.taskCompletionRate} className="h-1 mt-1.5 bg-slate-200 dark:bg-slate-700" />
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <Check className="h-4 w-4 text-orange-500" />
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Completed</p>
                                          </div>
                                          <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-slate-700 dark:text-slate-300">
                                              {employee.completedTasks || 0}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <TrendingUp className="h-4 w-4 text-blue-500" />
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Efficiency</p>
                                          </div>
                                          <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-slate-700 dark:text-slate-300">
                                              {employee.taskEfficiency || 0}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <Activity className="h-4 w-4 text-purple-500" />
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Productivity</p>
                                          </div>
                                          {hasRating ? (
                                            <>
                                              <div className="flex items-baseline gap-1">
                                                <span className={`text-2xl font-black ${getPerformanceColor(productivity)}`}>
                                                  {Math.round(productivity)}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">%</span>
                                              </div>
                                              <div className="flex gap-0.5 mt-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                  <Star
                                                    key={star}
                                                    className={`h-2.5 w-2.5 ${star <= rating.productivityRating
                                                      ? 'fill-amber-400 text-amber-400'
                                                      : 'text-slate-200 dark:text-slate-700'
                                                      }`}
                                                  />
                                                ))}
                                              </div>
                                            </>
                                          ) : (
                                            <p className="text-xs text-slate-400 py-1">N/A</p>
                                          )}
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <Award className="h-4 w-4 text-pink-500" />
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Quality</p>
                                          </div>
                                          {hasRating ? (
                                            <>
                                              <div className="flex items-baseline gap-1">
                                                <span className={`text-2xl font-black ${getPerformanceColor(qualityScore)}`}>
                                                  {Math.round(qualityScore)}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">%</span>
                                              </div>
                                              <div className="flex gap-0.5 mt-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                  <Star
                                                    key={star}
                                                    className={`h-2.5 w-2.5 ${star <= rating.qualityRating
                                                      ? 'fill-amber-400 text-amber-400'
                                                      : 'text-slate-200 dark:text-slate-700'
                                                      }`}
                                                  />
                                                ))}
                                              </div>
                                            </>
                                          ) : (
                                            <p className="text-xs text-slate-400 py-1">N/A</p>
                                          )}
                                        </div>

                                        <div className="bg-blue-600 rounded-lg p-2.5 shadow-sm col-span-2 md:col-span-4 lg:col-span-1">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <BarChart3 className="h-4 w-4 text-white/80" />
                                            <p className="text-sm font-bold text-white/80 uppercase tracking-widest">Score</p>
                                          </div>
                                          <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black text-white">
                                              {overallRating > 0 ? overallRating : '-'}
                                            </span>
                                            <span className="text-xs text-white/70 font-semibold">%</span>
                                          </div>
                                          <Progress value={overallRating} className="h-1 mt-1.5 bg-white/20" />
                                        </div>
                                      </div>
                                      {hasRating && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <div className="bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl p-3 border border-indigo-100/50 dark:border-indigo-900/30">
                                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                              <Activity className="h-3 w-3" />
                                              Productivity Feedback
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic whitespace-pre-wrap">{rating.productivityDescription}</p>
                                          </div>
                                          <div className="bg-amber-50/30 dark:bg-amber-900/10 rounded-xl p-3 border border-amber-100/50 dark:border-amber-900/30">
                                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                              <Award className="h-3 w-3" />
                                              Quality Assessment
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic whitespace-pre-wrap">{rating.qualityDescription}</p>
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
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="department" className="mt-0 outline-none">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Department Overview</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Comparative analytics and cross-department efficiency metrics</p>
                </div>
                <Button
                  onClick={() => openExportDialog()}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </div>
              <div className="p-4 pb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {departmentMetrics
                    .filter((dept) => {
                      // Filter for Core Departments (case-insensitive)
                      return CORE_DEPARTMENTS.some(core => core.toLowerCase() === dept.department.toLowerCase());
                    })
                    .map((dept) => {
                      const badge = getPerformanceBadge(dept.performanceScore);
                      return (
                        <div
                          key={dept.department}
                          className="bg-slate-50/50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800/50 p-4 hover:border-blue-200 dark:hover:border-blue-800 transition-all"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white truncate max-w-[150px]">{dept.department}</h3>
                            </div>
                            <Badge variant={badge.variant} className="h-6 text-xs shadow-none uppercase font-bold tracking-tighter">
                              {badge.text}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center px-3 py-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100/50 dark:border-slate-800/50 shadow-sm">
                              <span className="text-sm font-bold text-slate-500 flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Department Members
                              </span>
                              <span className="text-lg font-black text-slate-900 dark:text-white">{dept.totalEmployees}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2.5 bg-purple-50/50 dark:bg-purple-900/10 rounded-md">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Productivity</p>
                                <p className={`text-lg font-black ${getPerformanceColor(dept.avgProductivity)}`}>
                                  {dept.avgProductivity}%
                                </p>
                              </div>
                              <div className="p-2.5 bg-blue-50/50 dark:bg-blue-900/10 rounded-md">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Attendance</p>
                                <p className={`text-lg font-black ${getPerformanceColor(dept.avgAttendance)}`}>
                                  {dept.avgAttendance}%
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-md">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Completed</p>
                                <p className="text-lg font-black text-emerald-600">{dept.tasksCompleted}</p>
                              </div>
                              <div className="p-2.5 bg-amber-50/50 dark:bg-amber-900/10 rounded-md">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Pending</p>
                                <p className="text-lg font-black text-amber-600">{dept.tasksPending}</p>
                              </div>
                            </div>

                            <div className="pt-2">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Efficiency Score</span>
                                <span className={`text-xl font-black ${getPerformanceColor(dept.performanceScore)}`}>
                                  {dept.performanceScore}%
                                </span>
                              </div>
                              <Progress value={dept.performanceScore} className="h-1 bg-slate-100 dark:bg-slate-800" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="summary" className="mt-0 outline-none">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent mx-auto"></div>
                <p className="mt-4 text-xs text-slate-500">Loading summary...</p>
              </div>
            ) : (
              <div className="space-y-8 pb-10">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                        <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Performance</p>
                    </div>
                    <p className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">{executiveSummary?.avgPerformance || 0}%</p>
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Company Average</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-md">
                        <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tasks Done</p>
                    </div>
                    <p className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">{executiveSummary?.totalTasksCompleted || 0}</p>
                    <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mt-1">Completion Count</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-md">
                        <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top Dept</p>
                    </div>
                    <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">{executiveSummary?.bestDepartment?.name || 'N/A'}</p>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1">{executiveSummary?.bestDepartment?.score || 0}% Efficiency</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">
                        <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Analyzed</p>
                    </div>
                    <p className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">{executiveSummary?.totalEmployeesAnalyzed || 0}</p>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Total Verified</p>
                  </div>
                </div>

                {/* Top 5 Performers */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Elite Performers</h2>
                    </div>
                    <Badge variant="outline" className="h-6 text-xs border-emerald-200 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tighter">Verified Metrics</Badge>
                  </div>
                  <div className="p-4 space-y-3">
                    {topPerformers && topPerformers.length > 0 ? (
                      topPerformers.map((performer: any, index: number) => {
                        const rankColors = [
                          'bg-amber-400 text-white',
                          'bg-slate-300 text-white',
                          'bg-orange-400 text-white',
                          'bg-blue-400 text-white',
                          'bg-purple-400 text-white'
                        ];
                        const rankIcons = ['🥇', '🥈', '🥉', '4', '5'];

                        return (
                          <div
                            key={performer.employeeId}
                            className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all bg-white dark:bg-slate-900/50"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-full ${rankColors[index]} flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0`}>
                                {rankIcons[index]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg tracking-tight text-slate-800 dark:text-white truncate">{performer.name}</h3>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{performer.department} • {performer.role}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6 mt-3 md:mt-0 w-full md:w-auto">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                                <div className="text-center">
                                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter mb-1">TASKS</p>
                                  <p className="text-base font-bold text-slate-700 dark:text-slate-300">{performer.taskCompletionScore || 0}%</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter mb-1">ATTEND.</p>
                                  <p className="text-base font-bold text-slate-700 dark:text-slate-300">{performer.attendanceScore || 0}%</p>
                                </div>
                                <div className="text-center border-l border-slate-200 dark:border-slate-800 pl-4">
                                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter mb-1">DONE</p>
                                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{performer.completedTasks || 0}</p>
                                </div>
                                <div className="text-center border-l border-slate-200 dark:border-slate-800 pl-4">
                                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter mb-1">EFF.</p>
                                  <p className="text-base font-bold text-blue-600 dark:text-blue-400">{performer.taskEfficiency || 0}</p>
                                </div>
                              </div>
                              <div className="pl-6 border-l border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-w-[90px]">
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-1.5">RATING</p>
                                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">{performer.score || 0}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <TrendingUp className="h-8 w-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 dark:text-slate-500">No performer data available</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Ensure employees have performance data for the selected period</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Insights & Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {executiveSummary && (
                    <>
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2.5 mb-4">
                          <BarChart3 className="h-5 w-5 text-blue-600" />
                          <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">Key Findings</h3>
                        </div>
                        <ul className="space-y-3">
                          {executiveSummary.keyFindings?.slice(0, 3).map((finding: string, i: number) => (
                            <li key={i} className="flex gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                              <span className="text-blue-500 font-black shrink-0">·</span>
                              <span>{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-purple-50/50 dark:bg-purple-900/10 p-5 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                        <div className="flex items-center gap-2.5 mb-4">
                          <Target className="h-5 w-5 text-purple-600" />
                          <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">Recommendations</h3>
                        </div>
                        <ul className="space-y-3">
                          {executiveSummary.recommendations?.slice(0, 3).map((rec: string, i: number) => (
                            <li key={i} className="flex gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                              <span className="text-purple-500 font-black shrink-0">·</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                        <div className="flex items-center gap-2.5 mb-4">
                          <FileText className="h-5 w-5 text-emerald-600" />
                          <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">Action Items</h3>
                        </div>
                        <ul className="space-y-3">
                          {executiveSummary.actionItems?.slice(0, 3).map((item: string, i: number) => (
                            <li key={i} className="flex gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                              <span className="text-emerald-500 font-black shrink-0">·</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>

                {/* Export Actions */}
                <div className="flex flex-wrap items-center justify-end gap-4 pt-6">
                  <Button variant="ghost" size="sm" onClick={() => handleQuickExport('csv')} className="h-10 text-xs font-black text-slate-500 hover:text-slate-900 dark:hover:text-white tracking-widest">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    GENERATE CSV
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleQuickExport('pdf')} className="h-10 text-xs font-black text-slate-500 hover:text-slate-900 dark:hover:text-white tracking-widest">
                    <FileText className="h-4 w-4 mr-2" />
                    GENERATE PDF
                  </Button>
                  <Button onClick={() => openExportDialog()} className="h-10 px-6 text-xs font-black bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 shadow-xl transition-all hover:scale-[1.02] tracking-widest">
                    <Download className="h-4 w-4 mr-2" />
                    ADVANCED EXPORT
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {selectedEmployee && (
          <RatingDialog
            key={selectedEmployee.employeeId}
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