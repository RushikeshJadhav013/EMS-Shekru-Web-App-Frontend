import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, FileSpreadsheet, Calendar as CalendarIcon, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployee?: { id: string; name: string } | null;
}

type ExportFormat = 'csv' | 'pdf';
type TimeRange = 'monthly' | 'last3months' | 'last6months' | 'yearly' | 'custom';

interface Employee {
  id: string;
  name: string;
  department: string;
}

export default function ExportDialog({ open, onOpenChange, selectedEmployee }: ExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingDepts, setIsLoadingDepts] = useState(false);
  const [isLoadingEmps, setIsLoadingEmps] = useState(false);

  // Load departments on mount
  useEffect(() => {
    loadDepartments();
  }, []);

  // Load employees when department changes
  useEffect(() => {
    if (selectedDepartment !== 'all') {
      loadEmployees(selectedDepartment);
    } else {
      loadAllEmployees();
    }
  }, [selectedDepartment]);

  const loadDepartments = async () => {
    setIsLoadingDepts(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://testing.staffly.space/reports/departments', {
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
    } finally {
      setIsLoadingDepts(false);
    }
  };

  const loadEmployees = async (department: string) => {
    setIsLoadingEmps(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://testing.staffly.space/employees/?department=${department}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const emps = Array.isArray(data) ? data : data.employees || [];
        setEmployees(emps.map((emp: any) => ({
          id: emp.id || emp.user_id,
          name: emp.name,
          department: emp.department,
        })));
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
      setEmployees([]);
    } finally {
      setIsLoadingEmps(false);
    }
  };

  const loadAllEmployees = async () => {
    setIsLoadingEmps(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://testing.staffly.space/employees/', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const emps = Array.isArray(data) ? data : data.employees || [];
        setEmployees(emps.map((emp: any) => ({
          id: emp.id || emp.user_id,
          name: emp.name,
          department: emp.department,
        })));
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
      setEmployees([]);
    } finally {
      setIsLoadingEmps(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Calculate date range based on selection
      let startDate: Date;
      let endDate: Date = new Date();

      switch (timeRange) {
        case 'monthly':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'last3months':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'last6months':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case 'yearly':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case 'custom':
          if (!customStartDate || !customEndDate) {
            toast({
              title: 'Error',
              description: 'Please select both start and end dates for custom range',
              variant: 'destructive',
            });
            setIsExporting(false);
            return;
          }
          startDate = customStartDate;
          endDate = customEndDate;
          break;
        default:
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
      }

      // Build query parameters
      const params = new URLSearchParams({
        format: exportFormat,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        ...(selectedEmployee && { employee_id: selectedEmployee.id }),
        ...(selectedDepartment !== 'all' && { department: selectedDepartment }),
        ...(selectedUser !== 'all' && { employee_id: selectedUser }),
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/reports/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Export failed:', response.status, errorText);
        throw new Error(`Export failed: ${response.status} - ${errorText || 'Server error'}`);
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      let filename = 'performance_report';
      if (selectedEmployee) {
        filename = `performance_${selectedEmployee.name}_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;
      } else if (selectedUser !== 'all') {
        const user = employees.find(e => e.id === selectedUser);
        filename = `performance_${user?.name || 'employee'}_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;
      } else if (selectedDepartment !== 'all') {
        filename = `performance_${selectedDepartment}_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;
      } else {
        filename = `performance_all_employees_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;
      }

      a.download = `${filename}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: `Report exported successfully as ${exportFormat.toUpperCase()}`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Error',
        description: 'Failed to export report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Export Performance Report
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-2 overflow-y-auto max-h-[60vh] scrollbar-thin">
          <div className="space-y-6">
            {/* Employee Info */}
            {selectedEmployee && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-muted-foreground mb-1">Exporting for:</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{selectedEmployee.name}</p>
                <p className="text-xs text-muted-foreground">Employee ID: {selectedEmployee.id}</p>
              </div>
            )}

            {!selectedEmployee && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-200">
                  Exporting data for all employees
                </p>
              </div>
            )}

            {/* Export Format */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Export Format</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportFormat('csv')}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                    exportFormat === 'csv'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}
                >
                  <FileSpreadsheet className={cn(
                    'h-6 w-6',
                    exportFormat === 'csv' ? 'text-blue-600' : 'text-slate-400'
                  )} />
                  <div className="text-left">
                    <p className="font-semibold text-sm">CSV</p>
                    <p className="text-xs text-muted-foreground">Spreadsheet</p>
                  </div>
                </button>

                <button
                  onClick={() => setExportFormat('pdf')}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                    exportFormat === 'pdf'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}
                >
                  <FileText className={cn(
                    'h-6 w-6',
                    exportFormat === 'pdf' ? 'text-red-600' : 'text-slate-400'
                  )} />
                  <div className="text-left">
                    <p className="font-semibold text-sm">PDF</p>
                    <p className="text-xs text-muted-foreground">Document</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Time Range */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Time Range</Label>
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Last Month</SelectItem>
                  <SelectItem value="last3months">Last 3 Months</SelectItem>
                  <SelectItem value="last6months">Last 6 Months</SelectItem>
                  <SelectItem value="yearly">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment} disabled={isLoadingDepts}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser} disabled={isLoadingEmps}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {timeRange === 'custom' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !customStartDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customStartDate ? format(customStartDate, 'PPP') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customStartDate}
                          onSelect={setCustomStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !customEndDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customEndDate ? format(customEndDate, 'PPP') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customEndDate}
                          onSelect={setCustomEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            )}

            {/* Export Info */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Export will include:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Employee performance records</li>
                <li>• Attendance report</li>
                <li>• Task completion report</li>
                <li>• Leave summary</li>
                <li>• Leave type breakdown</li>
                <li>• Performance metrics</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 order-2 sm:order-1"
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 order-1 sm:order-2"
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {exportFormat.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
