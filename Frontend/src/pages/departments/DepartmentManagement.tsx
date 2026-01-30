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
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 shadow-md border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Department Management
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Organize teams, assign managers, and maintain your company structure.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleSyncDepartments}
              disabled={isLoading}
              className="gap-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
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
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <Card className="border border-slate-200 dark:border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    Total Departments
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{departments.length}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200 dark:border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    Active Departments
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{activeDepartments}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                    {departments.length > 0 ? Math.round((activeDepartments / departments.length) * 100) : 0}% active
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <ChevronRight className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200 dark:border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    Total Employees
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalEmployees}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Management Card */}
      <Card className="border border-slate-200 dark:border-slate-700 shadow-md">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Departments</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Search, filter, and manage departments across your organization.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 w-full xl:w-auto">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search departments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-slate-300 dark:border-slate-600"
                  />
                </div>
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[140px] border-slate-300 dark:border-slate-600">
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
                <SelectTrigger className="w-[170px] border-slate-300 dark:border-slate-600">
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
                <SelectTrigger className="w-[150px] border-slate-300 dark:border-slate-600">
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
              <TableHeader className="bg-slate-50 dark:bg-slate-800">
                <TableRow>
                  <TableHead className="w-[100px] px-6 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Code</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Department</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Manager</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Employees</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Location</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Status</TableHead>
                  <TableHead className="px-6 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <TableCell className="px-6 py-4">
                          <Badge variant="outline" className="font-semibold">
                            {department.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900 dark:text-slate-100">{department.name}</p>
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
                                <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                                    {manager.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                  {manager.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge variant="secondary">
                            {department.employeeCount || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {department.location || <span className="text-slate-400 dark:text-slate-500 italic">Not specified</span>}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge
                            className={
                              isActive
                                ? 'bg-green-600 text-white'
                                : 'bg-slate-500 text-white'
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
                              className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(department)}
                              className="h-8 w-8 p-0 hover:bg-amber-100 dark:hover:bg-amber-900"
                              title="Edit department"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={isActive ? 'outline' : 'default'}
                              className={
                                isActive
                                  ? 'border-green-600 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400'
                                  : ''
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
                              className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900"
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
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] p-0 flex flex-col">
          <div className="px-6 pt-6 pb-2">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Edit Department</DialogTitle>
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
              <div className="h-10 w-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <span>Department Details</span>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-normal mt-1">
                  Complete information about this department
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewDepartment && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Department Name</Label>
                    <p className="text-base font-semibold text-slate-900 dark:text-white mt-1 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded border border-slate-200 dark:border-slate-700">
                      {viewDepartment.name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Department Code</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className="font-mono font-bold">
                        {viewDepartment.code}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Status</Label>
                    <div className="mt-1">
                      <Badge
                        className={
                          viewDepartment.status === 'active'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-500 text-white'
                        }
                      >
                        {viewDepartment.status.charAt(0).toUpperCase() + viewDepartment.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Manager</Label>
                    <div className="flex items-center gap-2 mt-1 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded border border-slate-200 dark:border-slate-700">
                      {managers.find(m => m.id === viewDepartment.managerId) ? (
                        <>
                          <div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">
                              {managers.find(m => m.id === viewDepartment.managerId)?.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-base font-medium text-slate-900 dark:text-white">
                            {managers.find(m => m.id === viewDepartment.managerId)?.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Employee Count</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Users className="h-4 w-4 text-slate-500" />
                      <span className="text-base font-medium text-slate-900 dark:text-white">
                        {viewDepartment.employeeCount || 0} employees
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Location</Label>
                    <p className="text-base text-slate-700 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded border border-slate-200 dark:border-slate-700">
                      {viewDepartment.location || 'Not specified'}
                    </p>
                  </div>
                </div>
              </div>
              {viewDepartment.description && (
                <div>
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Description</Label>
                  <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 mt-1">
                    {viewDepartment.description}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Created: {viewDepartment.createdAt ? formatDateIST(viewDepartment.createdAt, 'MMM dd, yyyy') : 'Unknown'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
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
      {/* General Details Section */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
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
              className="border-slate-300 dark:border-slate-600"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Department Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="code"
              value={formData.code}
              onChange={onCodeChange}
              placeholder="ENG"
              maxLength={5}
              className="uppercase tracking-wide border-slate-300 dark:border-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Leadership & Status Section */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                Leadership & Status
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Assign a manager and define operational status
              </p>
            </div>
          </div>
          {!isCreateMode && selectedDepartment?.updatedAt && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
              <SelectTrigger className="border-slate-300 dark:border-slate-600">
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
              <SelectTrigger className="border-slate-300 dark:border-slate-600">
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
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">Department Size</p>
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
            className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
            readOnly
            disabled
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
            Automatically counted from employees in this department
          </p>
        </div>
      </div>

      {/* Location & Description Section */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
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
              className="border-slate-300 dark:border-slate-600"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={onDescriptionChange}
              placeholder="Brief description of the department's responsibilities..."
              rows={4}
              className="resize-none border-slate-300 dark:border-slate-600"
            />
          </div>
        </div>
      </div>

      <DialogFooter className="gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
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