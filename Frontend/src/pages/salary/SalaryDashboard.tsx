import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import SummaryCard from '@/components/ui/SummaryCard';
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
import { Search, Plus, Eye, Edit, FileText, TrendingUp, Download, AlertCircle, DollarSign, RefreshCw, Users, Building2, Ban, CheckCircle2, IndianRupee, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole, SalaryStructure } from '@/types';
import SalaryDetails from '@/pages/salary/SalaryDetails';

const SalaryDashboard = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
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

    const [items, setItems] = useState<(Employee & { salary?: SalaryStructure })[]>([]);

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
                    // Core fields for analytics
                    const annualCtc = salary.annualCtc || salary.package_ctc_annual || salary.ctc_annual || 0;

                    // PF Split (Annual Total / 24 for each side)
                    const annualPfTotal = salary.pf_annual || 0;
                    const monthlyPfEmployer = annualPfTotal / 24;
                    const monthlyPfEmployee = annualPfTotal / 24;

                    // Monthly Fixed CTC (Excluding variable pay)
                    const annualVariable = salary.variable_pay_annual || 0;
                    const monthlyFixedCtc = (annualCtc - annualVariable) / 12;

                    // Monthly Gross = Monthly Fixed CTC - Employer PF
                    const monthlyGross = monthlyFixedCtc - monthlyPfEmployer;

                    // Professional Tax (PT)
                    const currentMonth = new Date().getMonth() + 1; // 1-indexed
                    let monthlyPt = 200;
                    if (salary.professional_tax_annual >= 2400) {
                        monthlyPt = (currentMonth === 2) ? 300 : 200;
                    }

                    // Other Deductions: Use stored other_deduction_annual if it exists, otherwise back-calculate from total
                    const salaryOtherDedAnnual = salary.other_deduction_annual !== undefined ? salary.other_deduction_annual : 0;
                    const backCalcOtherDeductionsAnnual = Math.max(0, (salary.total_deductions_annual || 0) - (salary.professional_tax_annual || 2500) - (annualPfTotal / 2));
                    const monthlyOtherDeductions = (salaryOtherDedAnnual || backCalcOtherDeductionsAnnual) / 12;

                    // Monthly In-Hand = Monthly Gross - (Employee PF + PT + Other Deductions)
                    const monthlyInHand = monthlyGross - (monthlyPfEmployee + monthlyPt + monthlyOtherDeductions);

                    salary = {
                        ...salary,
                        annualCtc,
                        monthlyCtc: annualCtc / 12,
                        monthlyInHand,
                        monthlyGross,
                        professionalTax: monthlyPt
                    };
                }

                const department = (emp.department || '').trim();
                return { ...emp, id, department, salary };
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

        const itemDepts = (item.department || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            itemDepts.some(d => d.includes(searchQuery.toLowerCase()));

        const matchesDept = deptFilter === 'all' || itemDepts.includes(deptFilter.toLowerCase());
        const normalizedRoleFilter = roleFilter.toLowerCase().replace(/[\s_]/g, '');
        const matchesRole = roleFilter === 'all' || normalizedItemRole === normalizedRoleFilter;

        return isRoleVisible && matchesSearch && matchesDept && matchesRole;
    });

    const uniqueDepts = React.useMemo(() => {
        const depts = new Set<string>();
        items.forEach(item => {
            const deptField = item.department;
            if (deptField) {
                deptField.split(',').forEach(d => {
                    const trimmed = d.trim();
                    if (trimmed) depts.add(trimmed);
                });
            }
        });
        return Array.from(depts).sort();
    }, [items]);

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

    const stats = React.useMemo(() => {
        const salaries = filteredItems.map(i => i.salary?.monthlyCtc || 0).filter(s => s > 0);
        return {
            totalSalary: salaries.reduce((a, b) => a + b, 0),
            averageSalary: salaries.length > 0 ? salaries.reduce((a, b) => a + b, 0) / salaries.length : 0,
            highestSalary: salaries.length > 0 ? Math.max(...salaries) : 0,
            totalEmployees: filteredItems.length
        };
    }, [filteredItems]);

    const [togglingId, setTogglingId] = useState<string | null>(null);

    const handleToggleSalaryStatus = async (userId: string, currentStatus: boolean) => {
        setTogglingId(userId);
        const newStatus = !currentStatus; // true = activate, false = deactivate
        try {
            await apiService.toggleSalaryStatus(userId, newStatus);

            // Optimistically update local state for instant visual feedback
            setItems(prev => prev.map(item =>
                String(item.id) === userId && item.salary
                    ? { ...item, salary: { ...item.salary, is_active: newStatus } }
                    : item
            ));

            toast({
                title: 'Success',
                description: `Salary record ${newStatus ? 'activated' : 'deactivated'} successfully`,
                variant: 'success',
            });
        } catch (error: any) {
            console.error('Failed to toggle salary status:', error);
            toast({
                title: 'Error',
                description: error?.message || 'Failed to update salary status. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setTogglingId(null);
        }
    };

    if (!user) return <div>Loading...</div>;

    // If Employee, show their salary details directly
    if (!isAdminOrHr) {
        return <SalaryDetails userId={user.id} />;
    }

    return (
        <div className="w-full space-y-6 animate-in fade-in duration-500">
            <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-sm mt-1">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-blue-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />

                <div className="relative flex items-center gap-5">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                        <DollarSign className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold tracking-tight" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "30px" }}>
                            Salary Management
                        </h1>
                        <p className="font-medium flex items-center gap-2 mt-1" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>
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
                            className="rounded-xl px-6 h-12 transition-all active:scale-95"
                            style={{ color: '#FFFFFF', backgroundColor: '#2563EB', fontSize: '14px' }}
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
                        className="rounded-xl px-6 h-12 transition-all active:scale-95"
                        style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#FFFFFF", backgroundColor: "#2563EB", fontSize: "14px" }}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Analytics Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        title: t.salary?.totalSalary || 'Total Salary',
                        value: `₹${stats.totalSalary.toLocaleString()}`,
                        icon: IndianRupee,
                        iconColor: 'text-indigo-600',
                        iconBg: 'bg-indigo-100',
                    },
                    {
                        title: t.salary?.averageSalary || 'Average Salary',
                        value: `₹${stats.averageSalary.toLocaleString()}`,
                        icon: TrendingUp,
                        iconColor: 'text-emerald-600',
                        iconBg: 'bg-emerald-100',
                    },
                    {
                        title: t.salary?.highestSalary || 'Highest Salary',
                        value: `₹${stats.highestSalary.toLocaleString()}`,
                        icon: Award,
                        iconColor: 'text-amber-600',
                        iconBg: 'bg-amber-100',
                    },
                    {
                        title: t.salary?.totalEmployees || 'Total Employees',
                        value: stats.totalEmployees,
                        icon: Users,
                        iconColor: 'text-blue-600',
                        iconBg: 'bg-blue-100',
                    },
                ].map((item, index) => (
                    <SummaryCard
                        key={index}
                        title={item.title}
                        value={item.value}
                        icon={item.icon}
                        iconColor={item.iconColor}
                        iconBg={item.iconBg}
                    />
                ))}
            </div>

            <Card className="border-2 border-[#000000] shadow-md bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="font-bold mb-2" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "16px", fontWeight: "bold" }}>Employee Salaries</CardTitle>
                            <CardDescription style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>View and manage salary structures for all employees</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-2">
                                    <Label className="uppercase font-bold ml-1" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>Department</Label>
                                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                                        <SelectTrigger className="w-[180px] h-10 bg-white dark:bg-gray-800 border-2 border-[#000000] transition-all duration-300 hover:shadow-md" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>
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
                                    <Label className="uppercase font-bold ml-1" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>Role</Label>
                                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                                        <SelectTrigger className="w-[160px] h-10 bg-white dark:bg-gray-800 border-2 border-[#000000] transition-all duration-300 hover:shadow-md" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>
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
                                <Label className="uppercase font-bold ml-1" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Name, ID, or Dept..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                                        className="pl-9 w-[220px] h-10 bg-white dark:bg-gray-800 border-2 border-[#000000] focus:ring-2 focus:ring-blue-500" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border-2 border-[#000000] bg-white dark:bg-gray-800 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-gray-900/50">
                                <TableRow>
                                    <TableHead className="w-[100px] font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>EMP ID</TableHead>
                                    <TableHead className="font-bold uppercase" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>EMPLOYEE</TableHead>
                                    <TableHead className="font-bold uppercase" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>ROLE/DEPT</TableHead>
                                    <TableHead className="text-right font-bold uppercase" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>MONTHLY CTC</TableHead>
                                    <TableHead className="text-right font-bold uppercase" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>IN-HAND PAY</TableHead>
                                    <TableHead className="text-right font-bold uppercase" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>ACTIONS</TableHead>
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
                                        <TableRow key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <TableCell className="font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{item.employee_id}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{item.name}</span>
                                                    <span className="lowercase font-medium" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>{item.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="capitalize font-semibold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{item.role?.replace('_', ' ')}</span>
                                                    <span>{item.department || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>
                                                {item.salary ? `₹${Math.round(item.salary.monthlyCtc || 0).toLocaleString()}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>
                                                {item.salary ? `₹${Math.round(item.salary.monthlyInHand || 0).toLocaleString()}` : '-'}
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
                                                            disabled={togglingId === String(item.id)}
                                                        >
                                                            {togglingId === String(item.id)
                                                                ? <RefreshCw className="h-4 w-4 animate-spin" />
                                                                : item.salary.is_active !== false
                                                                    ? <CheckCircle2 className="h-4 w-4" />
                                                                    : <Ban className="h-4 w-4" />}
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
                            <div style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>
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
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SalaryDashboard;
