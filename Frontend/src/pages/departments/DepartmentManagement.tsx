import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  Edit,
  Trash2,
  Building2,
  Users,
  Search,
  ChevronRight,
  SlidersHorizontal,
  Eye,
  Loader2,
} from 'lucide-react';
import { Department } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateIST } from '@/utils/timezone';
import { apiService, type Department as ApiDepartment } from '@/lib/api';

interface ExtendedDepartment extends Department {
  employeeCount?: number;
  location?: string;
}

interface ManagerOption {
  id: string;
  name: string;
  email?: string;
  department?: string | null;
  role?: string;
}

export default function DepartmentManagement() {
  const { t } = useLanguage();
  const [departments, setDepartments] = useState<ExtendedDepartment[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isManagersLoading, setIsManagersLoading] = useState(false);
  const [managerLoadError, setManagerLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedManagerFilter, setSelectedManagerFilter] = useState<'all' | string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'employees'>('name');
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewDepartment, setViewDepartment] = useState<ExtendedDepartment | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<ExtendedDepartment | null>(null);
  const [formData, setFormData] = useState<Partial<ExtendedDepartment>>({
    name: '',
    code: '',
    managerId: '',
    description: '',
    status: 'active',
    employeeCount: undefined,
    location: ''
  });
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  const managerName = (managerId?: string) => {
    if (!managerId) return undefined;
    const found = managers.find((mgr) => mgr.id === String(managerId));
    return found?.name;
  };

  const filteredDepartments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = departments.filter((dept) => {
      const matchesSearch =
        dept.name.toLowerCase().includes(query) ||
        dept.code.toLowerCase().includes(query) ||
        (dept.description || '').toLowerCase().includes(query) ||
        (dept.location || '').toLowerCase().includes(query);

      const matchesStatus = selectedStatus === 'all' || dept.status === selectedStatus;
      const matchesManager =
        selectedManagerFilter === 'all' ||
        String(dept.managerId ?? '') === selectedManagerFilter;

      return matchesSearch && matchesStatus && matchesManager;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'employees') {
        return (b.employeeCount || 0) - (a.employeeCount || 0);
      }
      return 0;
    });

    return result;
  }, [departments, searchQuery, selectedStatus, selectedManagerFilter, sortBy]);

  const handleCreateDepartment = () => {
    if (!formData.name || !formData.code) {
      toast({
        title: 'Error',
        description: 'Please fill in department name and code',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    apiService
      .createDepartment({
        name: formData.name!,
        code: formData.code!,
        manager_id: formData.managerId ? Number(formData.managerId) : undefined,
        description: formData.description || '',
        status: formData.status || 'active',
        employee_count: formData.employeeCount ?? 0,
        location: formData.location || '',
      })
      .then((created: ApiDepartment) => {
        const mapped: ExtendedDepartment = {
          id: created.id,
          name: created.name,
          code: created.code,
          managerId: created.manager_id?.toString() ?? '',
          description: created.description ?? '',
          status: (created.status as 'active' | 'inactive') || 'active',
          employeeCount: created.employee_count ?? 0,
          location: created.location ?? '',
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        };
        setDepartments((prev) => [...prev, mapped]);
        setIsCreateDialogOpen(false);
        resetForm();
        toast({
          title: 'Success',
          description: 'Department created successfully',
        });
      })
      .catch((error) => {
        console.error('Failed to create department:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to create department',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleUpdateDepartment = () => {
    if (!selectedDepartment) return;

    const oldManagerId = selectedDepartment.managerId;
    const newManagerId = formData.managerId;
    const managerChanged = oldManagerId !== newManagerId;

    setIsSaving(true);
    apiService
      .updateDepartment(Number(selectedDepartment.id), {
        name: formData.name,
        code: formData.code,
        manager_id: formData.managerId ? Number(formData.managerId) : undefined,
        description: formData.description,
        status: formData.status,
        employee_count: formData.employeeCount,
        location: formData.location,
      })
      .then((updated: ApiDepartment) => {
        setDepartments((prev) =>
          prev.map((dept) =>
            dept.id === selectedDepartment.id
              ? {
                ...dept,
                name: updated.name,
                code: updated.code,
                managerId: updated.manager_id?.toString() ?? '',
                description: updated.description ?? '',
                status: updated.status as 'active' | 'inactive',
                employeeCount: updated.employee_count ?? dept.employeeCount,
                location: updated.location ?? '',
                updatedAt: updated.updated_at,
              }
              : dept,
          ),
        );
        setIsEditDialogOpen(false);
        resetForm();

        // Reload managers to reflect any role changes
        loadManagers();

        let successMessage = 'Department updated successfully';
        if (managerChanged) {
          const newManager = managers.find(m => m.id === newManagerId);
          const oldManager = managers.find(m => m.id === oldManagerId);

          if (newManager && oldManager) {
            successMessage += `. Manager changed from ${oldManager.name} to ${newManager.name}. User roles have been updated automatically.`;
          } else if (newManager) {
            successMessage += `. ${newManager.name} has been assigned as manager and promoted to Manager role.`;
          } else if (oldManager) {
            successMessage += `. ${oldManager.name} has been removed as manager. Their role may have been updated.`;
          }
        }

        toast({
          title: 'Success',
          description: successMessage,
        });
      })
      .catch((error) => {
        console.error('Failed to update department:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to update department',
          variant: 'destructive',
        });
      })
      .finally(() => setIsSaving(false));
  };

  const handleDeleteDepartment = (id: string) => {
    const dept = departments.find(d => d.id === id);
    if (dept && dept.employeeCount && dept.employeeCount > 0) {
      toast({
        title: 'Error',
        description: 'Cannot delete department with active employees',
        variant: 'destructive'
      });
      return;
    }

    apiService
      .deleteDepartment(Number(id))
      .then(() => {
        setDepartments((prev) => prev.filter((dept) => dept.id !== id));
        toast({
          title: 'Success',
          description: 'Department deleted successfully',
        });
      })
      .catch((error) => {
        console.error('Failed to delete department:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to delete department',
          variant: 'destructive',
        });
      });
  };

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      code: '',
      managerId: '',
      description: '',
      status: 'active',
      employeeCount: undefined,
      location: ''
    });
    setSelectedDepartment(null);
  }, []);

  const handleCreateCancel = useCallback(() => {
    setIsCreateDialogOpen(false);
    resetForm();
  }, [resetForm]);

  const handleEditCancel = useCallback(() => {
    setIsEditDialogOpen(false);
    resetForm();
  }, [resetForm]);

  const openEditDialog = (department: ExtendedDepartment) => {
    setSelectedDepartment(department);
    setFormData({
      ...department,
      managerId: department.managerId ? String(department.managerId) : '',
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (department: ExtendedDepartment) => {
    setViewDepartment(department);
    setIsViewDialogOpen(true);
  };

  const totalEmployees = departments.reduce((sum, dept) => sum + (dept.employeeCount || 0), 0);

  const activeDepartments = departments.filter(dept => dept.status === 'active').length;

  // Stable handlers to prevent input focus loss
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  }, []);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }));
  }, []);

  const handleManagerChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, managerId: value }));
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, status: value as 'active' | 'inactive' }));
  }, []);

  const handleEmployeeCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      employeeCount: value === '' ? undefined : Number(value),
    }));
  }, []);



  const handleLocationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, location: e.target.value }));
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, description: e.target.value }));
  }, []);

  const loadDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getDepartments();
      const mapped: ExtendedDepartment[] = (data || []).map((dept: ApiDepartment) => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        managerId: dept.manager_id?.toString() ?? '',
        description: dept.description ?? '',
        status: (dept.status as 'active' | 'inactive') || 'active',
        employeeCount: dept.employee_count ?? 0,
        location: dept.location ?? '',
        createdAt: dept.created_at,
        updatedAt: dept.updated_at,
      }));
      setDepartments(mapped);
    } catch (error) {
      console.error('Failed to load departments:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load departments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSyncDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await apiService.syncDepartmentsFromUsers();

      // Reload departments after sync
      await loadDepartments();

      toast({
        variant: 'success',
        title: 'Sync Completed',
        description: `Created ${result.created} new departments, updated ${result.updated} existing departments.`,
      });
    } catch (error) {
      console.error('Failed to sync departments:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to sync departments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [loadDepartments]);

  useEffect(() => {
    // Auto-sync departments from users on mount, then load
    const initializeDepartments = async () => {
      try {
        await apiService.syncDepartmentsFromUsers();
      } catch (error) {
        // Silently fail sync, still load existing departments
        console.warn('Auto-sync failed:', error);
      }
      await loadDepartments();
    };

    initializeDepartments();
  }, [loadDepartments]);

  // Load all employees for auto-calculation
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const employees = await apiService.getEmployees();
        setAllEmployees(employees || []);
      } catch (error) {
        console.error('Failed to load employees:', error);
      }
    };
    loadEmployees();
  }, []);

  const loadManagers = useCallback(async () => {
    setIsManagersLoading(true);
    try {
      setManagerLoadError(null);

      let managerSource: any[] | null = null;

      try {
        managerSource = await apiService.getDepartmentManagers();
      } catch (fallbackError) {
        if (import.meta.env.DEV) {
          console.warn('Falling back to employees endpoint for managers:', fallbackError);
        }
      }

      if (!Array.isArray(managerSource) || managerSource.length === 0) {
        managerSource = await apiService.getEmployees();
      }

      const normalizedManagers: ManagerOption[] = (managerSource || [])
        .filter((entry: any) => {
          const role = (entry.role || '').toString().toLowerCase();
          return role === 'manager' || role === 'teamlead' || role === 'team_lead';
        })
        .map((entry: any) => {
          const idCandidate =
            entry.id ??
            entry.user_id ??
            entry.userId ??
            entry.employee_id ??
            entry.employeeId;

          return {
            id: idCandidate ? String(idCandidate) : '',
            name: entry.name || entry.full_name || '',
            email: entry.email || entry.work_email,
            department: entry.department ?? null,
            role: entry.role,
          };
        })
        .filter((mgr: ManagerOption) => mgr.id && mgr.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      if (normalizedManagers.length === 0) {
        setManagerLoadError('No active managers available. Please add a manager first.');
      }

      setManagers(normalizedManagers);
    } catch (error) {
      console.error('Failed to load managers:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to load managers list';
      setManagerLoadError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsManagersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadManagers();
  }, [loadManagers]);

  // Auto-calculate employee count when department name changes
  useEffect(() => {
    if (formData.name && allEmployees.length > 0) {
      const count = allEmployees.filter((emp: any) => {
        const empDept = (emp.department || '').toLowerCase().trim();
        const formDept = (formData.name || '').toLowerCase().trim();
        return empDept === formDept;
      }).length;

      // Only update if different to avoid infinite loops
      if (count !== formData.employeeCount) {
        setFormData(prev => ({ ...prev, employeeCount: count }));
      }
    }
  }, [formData.name, allEmployees]);


  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Modern Header */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 rounded-3xl p-8 shadow-xl border border-blue-100/60 dark:border-blue-900/60 backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/25 transform hover:scale-105 transition-all duration-300">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Department Management
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-lg">
                Organize teams, assign managers, and maintain your company structure with ease.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleSyncDepartments}
              disabled={isLoading}
              className="gap-2 border-2 border-emerald-200 dark:border-emerald-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-5 py-2.5 h-11 rounded-xl transition-all duration-200 hover:shadow-md"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Sync from Users
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 px-6 py-2.5 h-11 rounded-xl transition-all duration-200 hover:shadow-xl hover:scale-[1.02]">
                  <Plus className="h-4 w-4" />
                  New Department
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] p-0 border-2 shadow-2xl flex flex-col">
                <div className="px-6 pt-6 pb-2">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">
                      Create New Department
                    </DialogTitle>
                  </DialogHeader>
                </div>
                <div className="overflow-y-auto px-6 pb-6 flex-1">
                  <DepartmentForm
                    mode="create"
                    formData={formData}
                    managers={managers}
                    managerLoadError={managerLoadError}
                    isManagersLoading={isManagersLoading}
                    isSaving={isSaving}
                    selectedDepartment={selectedDepartment}
                    onNameChange={handleNameChange}
                    onCodeChange={handleCodeChange}
                    onManagerChange={handleManagerChange}
                    onStatusChange={handleStatusChange}
                    onEmployeeCountChange={handleEmployeeCountChange}
                    onLocationChange={handleLocationChange}
                    onDescriptionChange={handleDescriptionChange}
                    onCancel={handleCreateCancel}
                    onSubmit={handleCreateDepartment}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/95 to-indigo-600/95 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-blue-100 font-semibold">
                    Total Departments
                  </p>
                  <p className="text-3xl font-bold">{departments.length}</p>
                  <p className="text-xs text-blue-100/80">
                    Organizational units
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/95 to-teal-600/95 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">
                    Active Departments
                  </p>
                  <p className="text-3xl font-bold">{activeDepartments}</p>
                  <p className="text-xs text-emerald-100/80">
                    {departments.length > 0 ? Math.round((activeDepartments / departments.length) * 100) : 0}% operational
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <ChevronRight className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/95 to-pink-600/95 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-purple-100 font-semibold">
                    Total Employees
                  </p>
                  <p className="text-3xl font-bold">{totalEmployees}</p>
                  <p className="text-xs text-purple-100/80">
                    Across all departments
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced Main Management Card */}
      <Card className="border-0 shadow-2xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50/80 to-blue-50/80 dark:from-slate-900/80 dark:to-blue-950/80 px-7 py-6">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">Departments</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Search, filter, and manage departments across your organization.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 w-full xl:w-auto">
              <div className="flex-1 min-w-[200px] xl:min-w-[220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search departments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[140px] h-11 text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={selectedManagerFilter}
                onValueChange={(value) =>
                  setSelectedManagerFilter(value as 'all' | string)
                }
              >
                <SelectTrigger className="w-[170px] h-11 text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl">
                  <SelectValue placeholder="Manager" />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  <SelectItem value="all">All Managers</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sortBy}
                onValueChange={(value) =>
                  setSortBy(value as 'name' | 'employees')
                }
              >
                <SelectTrigger className="w-[150px] h-11 text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="employees">Employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gradient-to-r from-slate-50/90 to-blue-50/90 dark:from-slate-900/90 dark:to-blue-950/90 sticky top-0 z-10">
                <TableRow className="border-b border-slate-200/60 dark:border-slate-700/60">
                  <TableHead className="w-[100px] px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Code</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Department</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Manager</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Employees</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Location</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Status</TableHead>
                  <TableHead className="px-6 py-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">Loading departments...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Building2 className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">No departments match your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDepartments.map((department) => {
                    const manager = managers.find(
                      (m) => m.id === String(department.managerId ?? ''),
                    );
                    const isActive = department.status === 'active';
                    return (
                      <TableRow
                        key={department.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors duration-200"
                      >
                        <TableCell className="px-6 py-4">
                          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-200/60 dark:border-blue-800/60">
                            <span className="font-bold text-sm text-blue-700 dark:text-blue-300">
                              {department.code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{department.name}</p>
                            {department.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 max-w-xs">
                                {department.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {manager ? (
                              <>
                                <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                    {manager.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {manager.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge
                            variant="secondary"
                            className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60 px-3 py-1 font-medium"
                          >
                            {department.employeeCount || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-amber-400"></div>
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {department.location || <span className="text-slate-400 dark:text-slate-500 italic">Not specified</span>}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge
                            className={
                              isActive
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 px-3 py-1.5 font-medium shadow-sm shadow-emerald-500/25'
                                : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 px-3 py-1.5 font-medium shadow-sm shadow-slate-400/25'
                            }
                          >
                            {department.status.charAt(0).toUpperCase() + department.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openViewDialog(department)}
                              className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-all duration-200"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(department)}
                              className="h-8 w-8 p-0 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg transition-all duration-200"
                              title="Edit department"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={isActive ? 'outline' : 'default'}
                              className={
                                'h-8 text-xs px-3 border-2 rounded-lg transition-all duration-200 ' +
                                (isActive
                                  ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-400 hover:scale-[1.05]'
                                  : 'border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-300 hover:scale-[1.05]')
                              }
                              onClick={() => {
                                const nextStatus =
                                  department.status === 'active' ? 'inactive' : 'active';
                                apiService
                                  .updateDepartment(Number(department.id), {
                                    status: nextStatus,
                                  })
                                  .then(() => {
                                    setDepartments((prev) =>
                                      prev.map((dept) =>
                                        dept.id === department.id
                                          ? { ...dept, status: nextStatus }
                                          : dept,
                                      ),
                                    );
                                  })
                                  .catch((error) => {
                                    console.error(
                                      'Failed to update department status:',
                                      error,
                                    );
                                    toast({
                                      title: 'Error',
                                      description:
                                        error instanceof Error
                                          ? error.message
                                          : 'Failed to update status',
                                      variant: 'destructive',
                                    });
                                  });
                              }}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteDepartment(String(department.id))}
                              className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all duration-200"
                              title="Delete department"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] p-0 flex flex-col">
          <div className="px-6 pt-6 pb-2">
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto px-6 pb-6 flex-1">
            <DepartmentForm
              mode="edit"
              formData={formData}
              managers={managers}
              managerLoadError={managerLoadError}
              isManagersLoading={isManagersLoading}
              isSaving={isSaving}
              selectedDepartment={selectedDepartment}
              onNameChange={handleNameChange}
              onCodeChange={handleCodeChange}
              onManagerChange={handleManagerChange}
              onStatusChange={handleStatusChange}
              onEmployeeCountChange={handleEmployeeCountChange}
              onLocationChange={handleLocationChange}
              onDescriptionChange={handleDescriptionChange}
              onCancel={handleEditCancel}
              onSubmit={handleUpdateDepartment}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl border-0 shadow-2xl bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-950 dark:to-slate-900/80">
          <DialogHeader className="border-b border-slate-200/60 dark:border-slate-700/60 pb-6">
            <DialogTitle className="flex items-center gap-4 text-xl font-semibold">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-slate-900 dark:text-white">Department Details</span>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-normal mt-1">
                  Complete information about this department
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewDepartment && (
            <div className="space-y-8 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Department Name</Label>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 px-4 py-3 rounded-xl border border-blue-200/60 dark:border-blue-800/60">
                      {viewDepartment.name}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Department Code</Label>
                    <div className="inline-flex items-center px-4 py-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border border-purple-200/60 dark:border-purple-800/60">
                      <span className="text-lg font-mono font-bold text-purple-700 dark:text-purple-300">
                        {viewDepartment.code}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</Label>
                    <div className="inline-flex">
                      <Badge
                        className={
                          viewDepartment.status === 'active'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 px-4 py-2 font-medium shadow-lg shadow-emerald-500/25'
                            : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 px-4 py-2 font-medium shadow-lg shadow-slate-400/25'
                        }
                      >
                        {viewDepartment.status.charAt(0).toUpperCase() + viewDepartment.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Manager</Label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border border-emerald-200/60 dark:border-emerald-800/60">
                      {managers.find(m => m.id === viewDepartment.managerId) ? (
                        <>
                          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">
                              {managers.find(m => m.id === viewDepartment.managerId)?.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-lg font-semibold text-slate-900 dark:text-white">
                            {managers.find(m => m.id === viewDepartment.managerId)?.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Employee Count</Label>
                    <div className="inline-flex items-center px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border border-amber-200/60 dark:border-amber-800/60">
                      <Users className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2" />
                      <span className="text-lg font-semibold text-slate-900 dark:text-white">
                        {viewDepartment.employeeCount || 0} employees
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Location</Label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-200/60 dark:border-blue-800/60">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <span className="text-lg text-slate-900 dark:text-white">
                        {viewDepartment.location || 'Not specified'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {viewDepartment.description && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Description</Label>
                  <div className="text-sm text-slate-700 dark:text-slate-300 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 leading-relaxed">
                    {viewDepartment.description}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  Created: {viewDepartment.createdAt ? formatDateIST(viewDepartment.createdAt, 'MMM dd, yyyy') : 'Unknown'}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  Updated: {viewDepartment.updatedAt ? formatDateIST(viewDepartment.updatedAt, 'MMM dd, yyyy') : 'Unknown'}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-3 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="h-11 px-6 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200">
              Close
            </Button>
            <Button
              onClick={() => {
                setIsViewDialogOpen(false);
                if (viewDepartment) {
                  openEditDialog(viewDepartment);
                }
              }}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
            >
              Edit Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DepartmentFormProps {
  mode: 'create' | 'edit';
  formData: Partial<ExtendedDepartment>;
  managers: ManagerOption[];
  managerLoadError: string | null;
  isManagersLoading: boolean;
  isSaving: boolean;
  selectedDepartment: ExtendedDepartment | null;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onManagerChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onEmployeeCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLocationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function DepartmentForm({
  mode,
  formData,
  managers,
  managerLoadError,
  isManagersLoading,
  isSaving,
  selectedDepartment,
  onNameChange,
  onCodeChange,
  onManagerChange,
  onStatusChange,
  onEmployeeCountChange,
  onLocationChange,
  onDescriptionChange,
  onCancel,
  onSubmit,
}: DepartmentFormProps) {
  const isCreateMode = mode === 'create';
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSaving) {
      onSubmit();
    }
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      {/* General Details Section */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-br from-slate-50/80 to-blue-50/30 dark:from-slate-900/80 dark:to-blue-950/30 p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
              General Details
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Give this department a distinctive name and code
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-2.5">
            <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Department Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={onNameChange}
              placeholder="e.g., Engineering"
              className="h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            />
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="code" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Department Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="code"
              value={formData.code}
              onChange={onCodeChange}
              placeholder="ENG"
              maxLength={5}
              className="h-11 uppercase tracking-wide border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* Leadership & Status Section */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/30 dark:to-teal-950/30 p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-200/50 dark:border-emerald-700/50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Leadership & Status
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Assign a manager and define operational status
              </p>
            </div>
          </div>
          {!isCreateMode && selectedDepartment?.updatedAt && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
              Updated {formatDateIST(selectedDepartment.updatedAt, 'MMM dd, yyyy')}
            </p>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-2.5">
            <Label htmlFor="manager" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Department Manager
            </Label>
            <Select
              value={formData.managerId}
              onValueChange={onManagerChange}
              disabled={isManagersLoading || managers.length === 0}
            >
              <SelectTrigger className="h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200">
                <SelectValue
                  placeholder={
                    isManagersLoading
                      ? 'Loading managers...'
                      : managers.length === 0
                        ? managerLoadError ?? 'No eligible managers'
                        : 'Select manager'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {isManagersLoading && (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                )}
                {!isManagersLoading && managers.length === 0 && (
                  <SelectItem value="none" disabled>
                    {managerLoadError ?? 'No eligible managers'}
                  </SelectItem>
                )}
                {!isManagersLoading &&
                  managers.length > 0 &&
                  managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      <div className="flex flex-col">
                        <span>{manager.name}</span>
                        {manager.email && (
                          <span className="text-xs text-slate-400">{manager.email}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {managerLoadError && !isManagersLoading && (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg">{managerLoadError}</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
              💡 When you assign a manager, their role will be automatically updated to "Manager" in the Employee Management system.
            </p>
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="status" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Status
            </Label>
            <Select value={formData.status} onValueChange={onStatusChange}>
              <SelectTrigger className="h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Department Size Section */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-br from-purple-50/50 to-pink-50/30 dark:from-purple-950/30 dark:to-pink-950/30 p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 pb-2 border-b border-purple-200/50 dark:border-purple-700/50">
          <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Department Size</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track headcount for this department
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="employeeCount" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Number of Employees
            <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5">Auto-calculated</Badge>
          </Label>
          <Input
            id="employeeCount"
            type="number"
            min="0"
            value={formData.employeeCount ?? 0}
            onChange={onEmployeeCountChange}
            className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
            readOnly
            disabled
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
            Automatically counted from employees in this department
          </p>
        </div>
      </div>

      {/* Location & Description Section */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/30 dark:to-orange-950/30 p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 pb-2 border-b border-amber-200/50 dark:border-amber-700/50">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Location & Description
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Help employees know where this department operates from
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2.5">
            <Label htmlFor="location" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Location
            </Label>
            <Input
              id="location"
              value={formData.location}
              onChange={onLocationChange}
              placeholder="Building A, Floor 3"
              className="h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
            />
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={onDescriptionChange}
              placeholder="Brief description of the department's responsibilities..."
              rows={4}
              className="resize-none border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      <DialogFooter className="gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="w-full sm:w-auto h-11 px-6 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
          className="w-full sm:w-auto h-11 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white gap-2 shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>{isCreateMode ? 'Create Department' : 'Save Changes'}</>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}