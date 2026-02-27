import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { Employee } from '@/lib/api';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Search, Plus, Eye, Edit, FileText, TrendingUp, Download, AlertCircle, DollarSign, RefreshCw, Users, Building2, Ban, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/types';
import SalaryDetails from '@/pages/salary/SalaryDetails';

const SalaryDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');

    // Pagination states
    const [salaryCurrentPage, setSalaryCurrentPage] = useState(1);
    const [salaryItemsPerPage, setSalaryItemsPerPage] = useState(10);

    const userRole = user?.role?.toLowerCase();
    const isAdminOrHr = userRole === 'admin' || userRole === 'hr';

    const [items, setItems] = useState<(Employee & { salary?: any })[]>([]);

    useEffect(() => {
        if (isAdminOrHr) {
            loadDashboardData();
        }
    }, [user]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const [employeesData, salariesData] = await Promise.all([
                apiService.getEmployees(),
                apiService.getAllEmployeeSalaries()
            ]);

            const merged = (employeesData || []).map((emp: any) => {
                const id = String(emp.id || emp.user_id || '');
                let salary = (salariesData || []).find((s: any) => String(s.user_id) === String(id));

                if (salary) {
                    // Ensure core fields are present for analytics and table display
                    const package_ctc_annual = salary.package_ctc_annual || salary.ctc_annual || 0;

                    // Improved calculation for dashboard consistency
                    const monthly_ctc = salary.monthly_ctc || (package_ctc_annual > 0 ? package_ctc_annual / 12 : 0);

                    // Calculate in-hand from earnings/deductions if direct field is 0 or missing
                    let monthly_in_hand = salary.monthly_in_hand || salary.net_salary || 0;
                    if (monthly_in_hand <= 0 && salary.total_earnings_annual) {
                        monthly_in_hand = (salary.total_earnings_annual - (salary.total_deductions_annual || 0)) / 12;
                    }

                    salary = { ...salary, package_ctc_annual, monthly_ctc, monthly_in_hand };
                }

                return { ...emp, id, salary };
            });

            setItems(merged);
            setEmployees(employeesData || []);
        } catch (error) {
            console.error('Failed to load dashboard data', error);
            toast({
                title: 'Error',
                description: 'Failed to load salary dashboard data',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const loadEmployees = loadDashboardData;

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''));
    };

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

    const filteredItems = items.filter(item => {
        const itemRole = (item.role || '').toLowerCase();
        const normalizedItemRole = itemRole.replace(/[\s_]/g, '');
        const itemId = String(item.id || '');
        const currentUserId = String(user?.id || '');

        // Visibility Logic by Role (Permission-based)
        let isRoleVisible = false;
        if (userRole === 'admin') {
            isRoleVisible = true;
        } else if (userRole === 'hr') {
            isRoleVisible = ['manager', 'teamlead', 'employee'].includes(normalizedItemRole);
        } else if (userRole === 'manager') {
            isRoleVisible = ['teamlead', 'employee'].includes(normalizedItemRole);
        } else if (userRole === 'team_lead' || userRole === 'team lead') {
            isRoleVisible = normalizedItemRole === 'employee';
        }

        // Exclude HR's own record from the list if HR
        if (userRole === 'hr' && itemId && itemId === currentUserId) {
            return false;
        }

        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.department && item.department.toLowerCase().includes(searchQuery.toLowerCase()));

        // Filter for Core Departments only
        const isCoreDept = item.department && CORE_DEPARTMENTS.some(core => core.toLowerCase() === item.department.toLowerCase());
        if (!isCoreDept) return false;

        const matchesDept = deptFilter === 'all' || (item.department && item.department.toLowerCase() === deptFilter.toLowerCase());

        // Normalize role selection for comparison
        const normalizedRoleFilter = roleFilter.toLowerCase().replace(/[\s_]/g, '');
        const matchesRole = roleFilter === 'all' || normalizedItemRole === normalizedRoleFilter;

        return isRoleVisible && matchesSearch && matchesDept && matchesRole;
    });

    const uniqueDepts = [...CORE_DEPARTMENTS].sort();

    // Role filter options based on user access level
    const availableRoles = userRole === 'admin'
        ? ['hr', 'manager', 'team_lead', 'employee']
        : ['manager', 'team_lead', 'employee'];

    // Paginated Items
    const paginatedItems = React.useMemo(() => {
        const startIndex = (salaryCurrentPage - 1) * salaryItemsPerPage;
        return filteredItems.slice(startIndex, startIndex + salaryItemsPerPage);
    }, [filteredItems, salaryCurrentPage, salaryItemsPerPage]);

    const totalPages = Math.ceil(filteredItems.length / salaryItemsPerPage);

    // Reset pagination when filters change
    useEffect(() => {
        setSalaryCurrentPage(1);
    }, [searchQuery, deptFilter, roleFilter]);



    const handleToggleSalaryStatus = async (userId: string, currentStatus: boolean) => {
        try {
            setLoading(true);
            await apiService.updateSalaryDetails(userId, { is_active: !currentStatus });

            toast({
                title: 'Success',
                description: `Salary record set to ${!currentStatus ? 'Active' : 'Inactive'}`,
                variant: 'success',
            });
            loadDashboardData();
        } catch (error) {
            console.error('Failed to toggle salary status:', error);
            toast({
                title: 'Error',
                description: 'Failed to update salary status',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <div>Loading...</div>;

    // If Employee, show their salary details directly
    if (!isAdminOrHr) {
        return <SalaryDetails userId={user.id} />;
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border shadow-sm mt-1">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-blue-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />

                <div className="relative flex items-center gap-5">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                        <DollarSign className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                            Salary Management
                        </h1>
                        <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                            <Building2 className="h-4 w-4 text-blue-500" />
                            Manage employee salaries, slips, and increments.
                        </p>
                    </div>
                </div>

                <div className="relative flex gap-3">
                    {userRole === 'hr' && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => navigate(`/salary/employee/${user?.id}`)}
                            className="rounded-xl px-6 h-12 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all active:scale-95"
                        >
                            <DollarSign className="h-4 w-4 mr-2" />
                            My Salary
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={loadEmployees}
                        disabled={loading}
                        className="rounded-xl px-6 h-12 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Analytics Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    ...(userRole === 'admin'
                        ? [
                            {
                                label: 'Annual Payroll (Filtered)',
                                value: `₹ ${(filteredItems.reduce((acc, item) => acc + (item.salary?.package_ctc_annual || 0), 0) / 10000000).toFixed(2)} Cr`,
                                sub: 'Total Annual Cost to Company',
                                icon: DollarSign,
                                color: 'blue',
                                bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
                                cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
                                borderColor: 'border-blue-300/80 dark:border-blue-700/50',
                                hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400'
                            },
                            {
                                label: 'Monthly Disbursement',
                                value: `₹ ${filteredItems.reduce((acc, item) => acc + (item.salary?.monthly_ctc || 0), 0).toLocaleString('en-IN')}`,
                                sub: 'Current Month Total CTC',
                                icon: TrendingUp,
                                color: 'emerald',
                                bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
                                cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
                                borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
                                hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400'
                            }
                        ]
                        : userRole === 'hr'
                            ? [
                                {
                                    label: 'Total Employees',
                                    value: filteredItems.length,
                                    sub: 'In Current View',
                                    icon: Users,
                                    color: 'blue',
                                    bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
                                    cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
                                    borderColor: 'border-blue-300/80 dark:border-blue-700/50',
                                    hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400'
                                },
                                {
                                    label: 'Active Pay Structures',
                                    value: filteredItems.filter(i => i.salary).length,
                                    sub: 'Verified Salary Records',
                                    icon: FileText,
                                    color: 'emerald',
                                    bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
                                    cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
                                    borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
                                    hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400'
                                }
                            ]
                            : [
                                {
                                    label: 'Total Departments',
                                    value: uniqueDepts.length,
                                    sub: 'Active Business Units',
                                    icon: Building2,
                                    color: 'blue',
                                    bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
                                    cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
                                    borderColor: 'border-blue-300/80 dark:border-blue-700/50',
                                    hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400'
                                },
                                {
                                    label: 'Active Pay Structures',
                                    value: filteredItems.filter(i => i.salary).length,
                                    sub: 'Verified Salary Records',
                                    icon: FileText,
                                    color: 'emerald',
                                    bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
                                    cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
                                    borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
                                    hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400'
                                }
                            ]),
                    {
                        label: 'Average Annual Salary',
                        value: `₹ ${(filteredItems.filter(i => i.salary).length > 0
                            ? Math.round(filteredItems.reduce((acc, item) => acc + (item.salary?.package_ctc_annual || 0), 0) / filteredItems.filter(i => i.salary).length)
                            : 0).toLocaleString('en-IN')}`,
                        sub: 'Per Filtered Employee',
                        icon: AlertCircle,
                        color: 'indigo',
                        bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
                        cardBg: 'bg-indigo-50/40 dark:bg-indigo-950/10',
                        borderColor: 'border-indigo-300/80 dark:border-indigo-700/50',
                        hoverBorder: 'group-hover:border-indigo-500 dark:group-hover:border-indigo-400'
                    },
                    {
                        label: userRole === 'hr' ? 'Pending Salary Setup' : 'Showing Employees',
                        value: userRole === 'hr'
                            ? filteredItems.filter(i => !i.salary).length
                            : filteredItems.length,
                        sub: userRole === 'hr' ? 'Employees without salary' : 'Filtered Workforce',
                        icon: Users,
                        color: 'amber',
                        bg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
                        cardBg: 'bg-amber-50/40 dark:bg-amber-950/10',
                        borderColor: 'border-amber-300/80 dark:border-amber-700/50',
                        hoverBorder: 'group-hover:border-amber-500 dark:group-hover:border-amber-400'
                    }
                ].map((item, i) => (
                    <Card key={i} className={`border-2 ${item.borderColor} ${item.hoverBorder} shadow-sm ${item.cardBg} backdrop-blur-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative`}>
                        {/* Background Accent */}
                        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${item.bg.split(' ')[0]}`} />

                        <CardContent className="p-4 relative">
                            <div className="flex justify-between items-start mb-2">
                                <div className={`p-2.5 rounded-xl ${item.bg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                    <item.icon className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{item.label}</h3>
                                <div className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{item.value}</div>
                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/50 dark:bg-gray-900/30 border border-black/5 dark:border-white/5">
                                    <div className={`h-1.5 w-1.5 rounded-full ${item.color === 'blue' ? 'bg-blue-500' :
                                        item.color === 'emerald' ? 'bg-emerald-500' :
                                            item.color === 'indigo' ? 'bg-indigo-500' :
                                                'bg-amber-500'
                                        }`} />
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.sub}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Employee Salaries</CardTitle>
                            <CardDescription>View and manage salary structures for all employees</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-2">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Department</Label>
                                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                                        <SelectTrigger className="w-[180px] h-10 bg-white dark:bg-gray-800 border-2 transition-all duration-300 hover:shadow-md">
                                            <SelectValue placeholder="All Departments" />
                                        </SelectTrigger>
                                        <SelectContent side="bottom">
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {uniqueDepts.map(dept => (
                                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Role</Label>
                                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                                        <SelectTrigger className="w-[160px] h-10 bg-white dark:bg-gray-800 border-2 transition-all duration-300 hover:shadow-md">
                                            <SelectValue placeholder="All Roles" />
                                        </SelectTrigger>
                                        <SelectContent side="bottom">
                                            <SelectItem value="all">All Roles</SelectItem>
                                            {availableRoles.map(role => (
                                                <SelectItem key={role} value={role}>
                                                    {role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Name, ID, or Dept..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                                        className="pl-9 w-[220px] h-10 bg-white dark:bg-gray-800 border-2 focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border bg-white dark:bg-gray-800 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-gray-900/50">
                                <TableRow>
                                    <TableHead className="w-[100px]">Emp ID</TableHead>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Role / Dept</TableHead>
                                    <TableHead className="text-right">Monthly CTC</TableHead>
                                    <TableHead className="text-right">In-Hand Pay</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                            <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                            <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                            <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse ml-auto"></div></TableCell>
                                            <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse ml-auto"></div></TableCell>
                                            <TableCell><div className="h-8 w-24 bg-gray-200 rounded animate-pulse ml-auto"></div></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No employees found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedItems.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors pointer-events-none sm:pointer-events-auto">
                                            <TableCell className="font-bold text-slate-700 dark:text-slate-300">{item.employee_id}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-gray-100">{item.name}</span>
                                                    <span className="text-[10px] text-muted-foreground lowercase font-medium">{item.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="capitalize text-xs font-semibold">{item.role?.replace('_', ' ')}</span>
                                                    <span className="text-[10px] text-muted-foreground">{item.department || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">
                                                {item.salary ? `₹${Math.round(item.salary.monthly_ctc).toLocaleString()}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                {item.salary ? `₹${Math.round(item.salary.monthly_in_hand).toLocaleString()}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right pointer-events-auto">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                                        disabled={!item.id}
                                                        onClick={() => {
                                                            if (item.id) {
                                                                navigate(`/salary/employee/${item.id}`);
                                                            }
                                                        }}
                                                        title="View Salary Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>

                                                    {isAdminOrHr && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-900/20"
                                                            disabled={!item.id}
                                                            onClick={() => {
                                                                if (item.id) {
                                                                    navigate(`/salary/add?userId=${item.id}&name=${encodeURIComponent(item.name)}`);
                                                                }
                                                            }}
                                                            title={item.salary ? "Update Salary" : "Create Salary"}
                                                        >
                                                            {item.salary ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                                        </Button>
                                                    )}

                                                    {isAdminOrHr && item.salary && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className={`h-8 w-8 p-0 transition-all duration-300 ${item.salary.is_active !== false
                                                                ? 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900 dark:text-emerald-400 dark:bg-emerald-900/10'
                                                                : 'text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100 dark:border-rose-900 dark:text-rose-400 dark:bg-rose-900/10'
                                                                }`}
                                                            onClick={() => handleToggleSalaryStatus(String(item.id), item.salary.is_active !== false)}
                                                            title={item.salary.is_active !== false ? "Click to Deactivate" : "Click to Activate"}
                                                            disabled={loading}
                                                        >
                                                            {item.salary.is_active !== false ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                                        </Button>
                                                    )}


                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {filteredItems.length > 0 && (
                        <div className="mt-6 px-2">
                            <Pagination
                                currentPage={salaryCurrentPage}
                                totalPages={totalPages}
                                totalItems={filteredItems.length}
                                itemsPerPage={salaryItemsPerPage}
                                onPageChange={setSalaryCurrentPage}
                                onItemsPerPageChange={setSalaryItemsPerPage}
                                showItemsPerPage={true}
                                showEntriesInfo={true}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SalaryDashboard;
