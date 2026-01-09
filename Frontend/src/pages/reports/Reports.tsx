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
        fetch(`https://staffly.space/reports/employee-performance?${empParams}`, { headers }),
        fetch(`https://staffly.space/reports/department-metrics?${deptParams}`, { headers }),
        fetch(`https://staffly.space/reports/executive-summary?${summaryParams}`, { headers }),
      ]);

      // Handle employee performance response
      if (empResponse.ok) {
        const empData = await empResponse.json();
        const employees = empData.employees || [];
        setEmployeePerformance(employees);

        // Update departments list to only include those with employees
        const employeeDepts = Array.from(
          new Set(
            employees
              .map((emp: EmployeePerformance) => emp.department)
              .filter((dept: string) => dept && !dept.includes(','))
          )
        ).sort() as string[];
        setDepartments(employeeDepts);

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
      {(user?.role === 'manager' || user?.role === 'team_lead') && <V2Overlay fallbackPath={user?.role === 'manager' ? '/manager' : '/team_lead'} />}
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Performance Reports
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track and analyze team performance</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[120px] h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, i) => (
                  <SelectItem key={i} value={i.toString()} className="text-xs">{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover open={yearOpen} onOpenChange={setYearOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={yearOpen} className="w-[120px] justify-between h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  {selectedYear}
                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
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
              <SelectTrigger className="w-[160px] h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-left">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept} className="text-xs">{dept}</SelectItem>
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
              className="h-8 text-xs font-medium px-4 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm transition-all"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Employee Performance
            </TabsTrigger>
            <TabsTrigger
              value="department"
              className="h-8 text-xs font-medium px-4 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm transition-all"
            >
              <PieChart className="h-3.5 w-3.5 mr-1.5" />
              Department Metrics
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="h-8 text-xs font-medium px-4 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm transition-all"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Executive Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-0 outline-none">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Individual Performance</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Detailed analytics per employee</p>
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
                        className="h-7 text-[10px] font-medium uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Expand All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={collapseAllDepartments}
                        className="h-7 text-[10px] font-medium uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
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
                                  <h3 className="text-xs font-bold text-slate-800 dark:text-white">{department}</h3>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {employees.length} {employees.length === 1 ? 'member' : 'members'} • Avg {deptAvgScore}%
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`h-5 text-[10px] uppercase font-bold tracking-tighter ${getPerformanceBadge(deptAvgScore).variant === 'default' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : getPerformanceBadge(deptAvgScore).variant === 'secondary' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'} border`}>
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
                                            <h3 className="font-bold text-sm text-slate-800 dark:text-white leading-tight">{employee.name}</h3>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                              {employee.employeeId} • {employee.role}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                          <Badge
                                            variant={badge.variant}
                                            className={`h-5 text-[10px] uppercase font-bold tracking-tighter ${badge.variant === 'default' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : badge.variant === 'secondary' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'} border shadow-none`}
                                          >
                                            {badge.text}
                                          </Badge>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openRatingDialog(employee)}
                                            className="h-7 px-2 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          >
                                            <Edit className="h-3 w-3 mr-1" />
                                            {hasRating ? 'Update' : 'Rate'}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openExportDialog({ id: employee.employeeId, name: employee.name })}
                                            className="h-7 px-2 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                          >
                                            <Download className="h-3 w-3 mr-1" />
                                            Export
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <Clock className="h-3 w-3 text-blue-500" />
                                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance</p>
                                          </div>
                                          <div className="flex items-baseline gap-1">
                                            <span className={`text-base font-bold ${getPerformanceColor(employee.attendanceScore)}`}>
                                              {employee.attendanceScore}
                                            </span>
                                            <span className="text-[10px] text-slate-400">%</span>
                                          </div>
                                          <Progress value={employee.attendanceScore} className="h-1 mt-1.5 bg-slate-200 dark:bg-slate-700" />
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <Target className="h-3 w-3 text-emerald-500" />
                                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tasks</p>
                                          </div>
                                          <div className="flex items-baseline gap-1">
                                            <span className={`text-base font-bold ${getPerformanceColor(employee.taskCompletionRate)}`}>
                                              {employee.taskCompletionRate}
                                            </span>
                                            <span className="text-[10px] text-slate-400">%</span>
                                          </div>
                                          <Progress value={employee.taskCompletionRate} className="h-1 mt-1.5 bg-slate-200 dark:bg-slate-700" />
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <Activity className="h-3 w-3 text-purple-500" />
                                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Productivity</p>
                                          </div>
                                          {hasRating ? (
                                            <>
                                              <div className="flex items-baseline gap-1">
                                                <span className={`text-base font-bold ${getPerformanceColor(productivity)}`}>
                                                  {Math.round(productivity)}
                                                </span>
                                                <span className="text-[10px] text-slate-400">%</span>
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
                                            <p className="text-[10px] text-slate-400 py-1">N/A</p>
                                          )}
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-lg p-2.5 border border-slate-100/50 dark:border-slate-800/50">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <Award className="h-3 w-3 text-pink-500" />
                                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quality</p>
                                          </div>
                                          {hasRating ? (
                                            <>
                                              <div className="flex items-baseline gap-1">
                                                <span className={`text-base font-bold ${getPerformanceColor(qualityScore)}`}>
                                                  {Math.round(qualityScore)}
                                                </span>
                                                <span className="text-[10px] text-slate-400">%</span>
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
                                            <p className="text-[10px] text-slate-400 py-1">N/A</p>
                                          )}
                                        </div>

                                        <div className="bg-blue-600 rounded-lg p-2.5 shadow-sm col-span-2 md:col-span-1">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <BarChart3 className="h-3 w-3 text-white/80" />
                                            <p className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Overall</p>
                                          </div>
                                          <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-bold text-white">
                                              {overallRating > 0 ? overallRating : '-'}
                                            </span>
                                            <span className="text-[10px] text-white/60 font-medium">%</span>
                                          </div>
                                          <Progress value={overallRating} className="h-1 mt-1.5 bg-white/20" />
                                        </div>
                                      </div>
                                      {hasRating && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <div className="bg-indigo-50/30 dark:bg-indigo-900/10 rounded-md p-2 border border-indigo-100/50 dark:border-indigo-900/30">
                                            <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                              <Activity className="h-2.5 w-2.5" />
                                              Productivity
                                            </p>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">{rating.productivityDescription}</p>
                                          </div>
                                          <div className="bg-amber-50/30 dark:bg-amber-900/10 rounded-md p-2 border border-amber-100/50 dark:border-amber-900/30">
                                            <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                              <Award className="h-2.5 w-2.5" />
                                              Quality
                                            </p>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">{rating.qualityDescription}</p>
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
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Department Overview</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Average metrics by department</p>
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
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {departmentMetrics.map((dept) => {
                    const badge = getPerformanceBadge(dept.performanceScore);
                    return (
                      <div
                        key={dept.department}
                        className="bg-slate-50/50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800/50 p-4 hover:border-blue-200 dark:hover:border-blue-800 transition-all"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-md">
                              <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h3 className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[120px]">{dept.department}</h3>
                          </div>
                          <Badge variant={badge.variant} className="h-5 text-[10px] shadow-none uppercase font-bold tracking-tighter">
                            {badge.text}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center px-2 py-1.5 bg-white dark:bg-slate-900 rounded-md border border-slate-100/50 dark:border-slate-800/50">
                            <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5">
                              <Users className="h-3 w-3" />
                              Members
                            </span>
                            <span className="text-xs font-bold">{dept.totalEmployees}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-purple-50/50 dark:bg-purple-900/10 rounded-md">
                              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Prod.</p>
                              <p className={`text-sm font-bold ${getPerformanceColor(dept.avgProductivity)}`}>
                                {dept.avgProductivity}%
                              </p>
                            </div>
                            <div className="p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-md">
                              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Atten.</p>
                              <p className={`text-sm font-bold ${getPerformanceColor(dept.avgAttendance)}`}>
                                {dept.avgAttendance}%
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-md">
                              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Done</p>
                              <p className="text-sm font-bold text-emerald-600">{dept.tasksCompleted}</p>
                            </div>
                            <div className="p-2 bg-amber-50/50 dark:bg-amber-900/10 rounded-md">
                              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Wait</p>
                              <p className="text-sm font-bold text-amber-600">{dept.tasksPending}</p>
                            </div>
                          </div>

                          <div className="pt-2">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score</span>
                              <span className={`text-sm font-bold ${getPerformanceColor(dept.performanceScore)}`}>
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
              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                        <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Performance</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{executiveSummary?.avgPerformance || 0}%</p>
                    <p className="text-[10px] text-slate-400 mt-1.5">Across all staff</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-md">
                        <Target className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tasks Done</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{executiveSummary?.totalTasksCompleted || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5">This month</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-md">
                        <Award className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Dept</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">{executiveSummary?.bestDepartment?.name || 'N/A'}</p>
                    <p className="text-[10px] text-amber-600 font-bold mt-1.5">{executiveSummary?.bestDepartment?.score || 0}% Score</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">
                        <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Analyzed</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{executiveSummary?.totalEmployeesAnalyzed || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5">Active employees</p>
                  </div>
                </div>

                {/* Top 5 Performers */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Top 5 Performers</h2>
                    </div>
                    <Badge variant="outline" className="h-5 text-[10px] borer-emerald-200 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tighter">Verified Metrics</Badge>
                  </div>
                  <div className="p-4 space-y-3">
                    {executiveSummary?.topPerformers && executiveSummary.topPerformers.length > 0 ? (
                      executiveSummary.topPerformers.map((performer: any, index: number) => {
                        const rankColors = ['bg-amber-400', 'bg-slate-300', 'bg-orange-400', 'bg-blue-400', 'bg-purple-400'];
                        const rankIcons = ['🥇', '🥈', '🥉', '4', '5'];

                        return (
                          <div
                            key={performer.employeeId}
                            className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all bg-slate-50/30 dark:bg-slate-900/50"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-8 h-8 rounded-full ${rankColors[index]} flex items-center justify-center text-[10px] font-bold shadow-sm flex-shrink-0`}>
                                {rankIcons[index]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-xs text-slate-800 dark:text-white truncate">{performer.name}</h3>
                                <p className="text-[10px] text-slate-500 truncate">{performer.department} • {performer.role}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6 mt-3 md:mt-0 w-full md:w-auto">
                              <div className="grid grid-cols-2 xs:grid-cols-4 gap-4 flex-1">
                                <div className="text-center">
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Tasks</p>
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{performer.taskCompletionScore}%</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Attend.</p>
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{performer.attendanceScore}%</p>
                                </div>
                                <div className="hidden xs:block text-center border-l border-slate-200 dark:border-slate-800 pl-4">
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Done</p>
                                  <p className="text-xs font-bold text-emerald-600">{performer.completedTasks}</p>
                                </div>
                                <div className="hidden xs:block text-center border-l border-slate-200 dark:border-slate-800 pl-4">
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Eff.</p>
                                  <p className="text-xs font-bold text-blue-600">{performer.taskEfficiency}</p>
                                </div>
                              </div>
                              <div className="pl-6 border-l border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-w-[70px]">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-0.5">Overall</p>
                                <p className="text-lg font-black text-blue-600 leading-none">{performer.score}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <TrendingUp className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">No performer data available</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Insights & Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {executiveSummary && (
                    <>
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2 mb-3">
                          <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                          <h3 className="text-xs font-bold text-slate-800 dark:text-white">Key Findings</h3>
                        </div>
                        <ul className="space-y-2">
                          {executiveSummary.keyFindings?.slice(0, 3).map((finding: string, i: number) => (
                            <li key={i} className="flex gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                              <span className="text-blue-500 shrink-0">•</span>
                              <span>{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Target className="h-3.5 w-3.5 text-purple-600" />
                          <h3 className="text-xs font-bold text-slate-800 dark:text-white">Recommendations</h3>
                        </div>
                        <ul className="space-y-2">
                          {executiveSummary.recommendations?.slice(0, 3).map((rec: string, i: number) => (
                            <li key={i} className="flex gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                              <span className="text-purple-500 shrink-0">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-3.5 w-3.5 text-emerald-600" />
                          <h3 className="text-xs font-bold text-slate-800 dark:text-white">Action Items</h3>
                        </div>
                        <ul className="space-y-2">
                          {executiveSummary.actionItems?.slice(0, 3).map((item: string, i: number) => (
                            <li key={i} className="flex gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                              <span className="text-emerald-500 shrink-0">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>

                {/* Export Actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => handleQuickExport('csv')} className="h-8 text-[10px] font-bold text-slate-500 hover:text-slate-900">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                    CSV REPORT
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleQuickExport('pdf')} className="h-8 text-[10px] font-bold text-slate-500 hover:text-slate-900">
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    PDF REPORT
                  </Button>
                  <Button onClick={() => openExportDialog()} className="h-8 text-[10px] font-bold bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    CUSTOM EXPORT
                  </Button>
                </div>
              </div>
            )}
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