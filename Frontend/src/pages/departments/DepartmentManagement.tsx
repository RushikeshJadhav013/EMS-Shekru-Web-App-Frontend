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
      <div className="bg-gradient-to-r from-slate-50 via-indigo-50 to-blue-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 rounded-2xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/60">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Department Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Organize teams, assign managers, and keep your org structure clean.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleSyncDepartments}
              disabled={isLoading}
              className="gap-2 border-2 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
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
                <Button className="gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/40">
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

        {/* Top Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <Card className="border-0 bg-gradient-to-br from-indigo-500/90 to-sky-500/90 text-white shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/80">
                    Total Departments
                  </p>
                  <p className="mt-1 text-2xl font-bold">{departments.length}</p>
                </div>
                <Building2 className="h-8 w-8 text-white/80" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/80">
                    Active Departments
                  </p>
                  <p className="mt-1 text-2xl font-bold">{activeDepartments}</p>
                </div>
                <ChevronRight className="h-8 w-8 text-white/80" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/80">
                    Total Employees
                  </p>
                  <p className="mt-1 text-2xl font-bold">{totalEmployees}</p>
                </div>
                <Users className="h-8 w-8 text-white/80" />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Main Management Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Departments</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Search, filter, and manage departments across the organisation.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 w-full lg:w-auto">
              <div className="flex-1 min-w-[180px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, code, or location"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[130px] h-10 text-xs sm:text-sm">
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
                <SelectTrigger className="w-[160px] h-10 text-xs sm:text-sm">
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
                <SelectTrigger className="w-[140px] h-10 text-xs sm:text-sm">
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
              <TableHeader className="bg-slate-50/80 dark:bg-slate-900/80">
                <TableRow className="border-b">
                  <TableHead className="w-[90px]">Code</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm">
                      Loading departments...
                    </TableCell>
                  </TableRow>
                ) : filteredDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No departments match your filters.
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
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors"
                      >
                        <TableCell className="font-semibold text-slate-700 dark:text-slate-200">
                          {department.code}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{department.name}</p>
                            {department.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {department.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {manager?.name || (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 px-2 py-0.5"
                          >
                            {department.employeeCount || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {department.location || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              isActive
                                ? 'bg-emerald-500 text-white border-0 px-2 py-0.5 shadow-sm'
                                : 'bg-slate-400 text-white border-0 px-2 py-0.5 shadow-sm'
                            }
                          >
                            {department.status.charAt(0).toUpperCase() + department.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openViewDialog(department)}
                              className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(department)}
                              className="h-8 w-8 p-0 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/40 rounded-lg"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={isActive ? 'outline' : 'default'}
                              className={
                                'h-8 text-xs px-3 border-2 ' +
                                (isActive
                                  ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-400'
                                  : 'border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-200')
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
                              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 rounded-lg"
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

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-indigo-600" />
              Department Details
            </DialogTitle>
          </DialogHeader>
          {viewDepartment && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Department Name</Label>
                    <p className="text-lg font-semibold">{viewDepartment.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Department Code</Label>
                    <p className="text-lg font-mono font-semibold text-indigo-600">{viewDepartment.code}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge
                        className={
                          viewDepartment.status === 'active'
                            ? 'bg-emerald-500 text-white border-0 px-3 py-1'
                            : 'bg-slate-400 text-white border-0 px-3 py-1'
                        }
                      >
                        {viewDepartment.status.charAt(0).toUpperCase() + viewDepartment.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Manager</Label>
                    <p className="text-lg font-semibold">
                      {managers.find(m => m.id === viewDepartment.managerId)?.name || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Employee Count</Label>
                    <p className="text-lg font-semibold">{viewDepartment.employeeCount || 0} employees</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                    <p className="text-lg">{viewDepartment.location || 'Not specified'}</p>
                  </div>
                </div>
              </div>
              {viewDepartment.description && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                  <p className="mt-2 text-sm text-muted-foreground bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                    {viewDepartment.description}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  Created: {viewDepartment.createdAt ? formatDateIST(viewDepartment.createdAt, 'MMM dd, yyyy') : 'Unknown'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated: {viewDepartment.updatedAt ? formatDateIST(viewDepartment.updatedAt, 'MMM dd, yyyy') : 'Unknown'}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setIsViewDialogOpen(false);
                if (viewDepartment) {
                  openEditDialog(viewDepartment);
                }
              }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
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
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            General Details
          </p>
          <p className="text-xs text-muted-foreground">
            Give this department a distinctive name and code.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Department Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={onNameChange}
              placeholder="e.g., Engineering"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Department Code *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={onCodeChange}
              placeholder="ENG"
              maxLength={5}
              className="uppercase tracking-wide h-11"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Leadership & Status
            </p>
            <p className="text-xs text-muted-foreground">
              Assign a manager and define the operational status.
            </p>
          </div>
          {!isCreateMode && selectedDepartment?.updatedAt && (
            <p className="text-[11px] text-muted-foreground">
              Updated {formatDateIST(selectedDepartment.updatedAt, 'MMM dd, yyyy')}
            </p>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="manager">Department Manager (Optional)</Label>
            <Select
              value={formData.managerId}
              onValueChange={onManagerChange}
              disabled={isManagersLoading || managers.length === 0}
            >
              <SelectTrigger className="h-11">
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
                          <span className="text-xs text-muted-foreground">{manager.email}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {managerLoadError && !isManagersLoading && (
              <p className="text-xs text-amber-600">{managerLoadError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              💡 When you assign a manager, their role will be automatically updated to "Manager" in the Employee Management system.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={onStatusChange}>
              <SelectTrigger className="h-11">
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

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Department Size</p>
          <p className="text-xs text-muted-foreground">
            Track headcount for this department.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employeeCount" className="flex items-center gap-2">
            Number of Employees
            <Badge variant="secondary" className="text-xs">Auto-calculated</Badge>
          </Label>
          <Input
            id="employeeCount"
            type="number"
            min="0"
            value={formData.employeeCount ?? 0}
            onChange={onEmployeeCountChange}
            className="h-11 bg-slate-50 dark:bg-slate-900"
            readOnly
            disabled
          />
          <p className="text-xs text-muted-foreground">
            Automatically counted from employees in this department
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Location & Description
          </p>
          <p className="text-xs text-muted-foreground">
            Help employees know where this department operates from.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={onLocationChange}
            placeholder="Building A, Floor 3"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={onDescriptionChange}
            placeholder="Brief description of the department's responsibilities..."
            rows={4}
            className="resize-none"
          />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
          className="w-full sm:w-auto bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white gap-2"
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