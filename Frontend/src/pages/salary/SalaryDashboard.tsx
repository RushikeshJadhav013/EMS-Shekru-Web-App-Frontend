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
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Search, Plus, Eye, Edit, Trash2, FileText, TrendingUp, Download, AlertCircle, DollarSign, RefreshCw, Users, Building2 } from 'lucide-react';
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

    const userRole = user?.role?.toLowerCase();
    const isAdminOrHr = userRole === 'admin' || userRole === 'hr';

    useEffect(() => {
        if (isAdminOrHr) {
            loadEmployees();
        }
    }, [user]);

    // Mock Data for UI Demo
    const mockEmployees: Employee[] = [
        { id: '1', name: 'Rohan Sharma', employee_id: 'EMP001', department: 'Unreal Engine', role: 'employee', email: 'rohan@example.com', status: 'active', created_at: '2023-01-01', updated_at: '2023-01-01' },
        { id: '2', name: 'Priya Patel', employee_id: 'EMP002', department: 'React Development', role: 'manager', email: 'priya@example.com', status: 'active', created_at: '2023-02-15', updated_at: '2023-02-15' },
        { id: '3', name: 'Amit Singh', employee_id: 'EMP003', department: '3D Art', role: 'team_lead', email: 'amit@example.com', status: 'active', created_at: '2023-03-10', updated_at: '2023-03-10' },
        { id: '4', name: 'Sneha Gupta', employee_id: 'EMP004', department: 'HR', role: 'hr', email: 'sneha@example.com', status: 'active', created_at: '2023-04-01', updated_at: '2023-04-01' },
        { id: '5', name: 'Vikram Malhotra', employee_id: 'EMP005', department: 'Management', role: 'admin', email: 'vikram@example.com', status: 'active', created_at: '2022-11-20', updated_at: '2022-11-20' },
    ];

    const loadEmployees = async () => {
        try {
            setLoading(true);
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 800));
            setEmployees(mockEmployees);
        } catch (error) {
            console.error('Failed to load employees', error);
            toast({
                title: 'Error',
                description: 'Failed to load employees list',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (emp.department && emp.department.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesDept = deptFilter === 'all' || emp.department === deptFilter;
        const matchesRole = roleFilter === 'all' || emp.role === roleFilter;

        return matchesSearch && matchesDept && matchesRole;
    });

    const uniqueDepts = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));
    const uniqueRoles = Array.from(new Set(employees.map(e => e.role)));

    const handleDeleteSalary = async (userId: string) => {
        if (!confirm('Are you sure you want to delete the salary record for this employee? This action cannot be undone.')) return;

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            toast({
                title: 'Success',
                description: 'Salary record deleted successfully (Mock)',
                variant: 'success',
            });
            // In a real app we'd refresh the list or status here
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete salary record',
                variant: 'destructive',
            });
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
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                            Salary <span className="text-blue-600">Management</span>
                        </h1>
                        <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                            <Building2 className="h-4 w-4 text-blue-500" />
                            Manage employee salaries, slips, and increments.
                        </p>
                    </div>
                </div>

                <div className="relative flex gap-3">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={loadEmployees}
                        disabled={loading}
                        className="rounded-xl px-6 h-12 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Analytics Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    ...(userRole === 'admin' ? [
                        {
                            label: 'Net Payroll (Cumulative)',
                            value: '₹ 1.48 Cr',
                            sub: 'Total All-Time Disbursement',
                            icon: DollarSign,
                            color: 'blue',
                            bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
                            cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
                            borderColor: 'border-blue-300/80 dark:border-blue-700/50',
                            hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400'
                        },
                        {
                            label: 'Monthly Disbursement',
                            value: '₹ 12,45,000',
                            sub: 'Current Month Employee Payout',
                            icon: TrendingUp,
                            color: 'emerald',
                            bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
                            cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
                            borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
                            hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400'
                        }
                    ] : [
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
                            value: employees.length,
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
                        label: 'Increments Given',
                        value: '12',
                        sub: 'This Academic Year',
                        icon: AlertCircle,
                        color: 'indigo',
                        bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
                        cardBg: 'bg-indigo-50/40 dark:bg-indigo-950/10',
                        borderColor: 'border-indigo-300/80 dark:border-indigo-700/50',
                        hoverBorder: 'group-hover:border-indigo-500 dark:group-hover:border-indigo-400'
                    },
                    {
                        label: 'Total Employees',
                        value: employees.length,
                        sub: 'Active Workforce',
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
                                <div className="flex flex-col gap-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Department</Label>
                                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                                        <SelectTrigger className="w-[160px] h-9 bg-white dark:bg-gray-800">
                                            <SelectValue placeholder="Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {uniqueDepts.map(dept => (
                                                <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Role</Label>
                                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                                        <SelectTrigger className="w-[140px] h-9 bg-white dark:bg-gray-800">
                                            <SelectValue placeholder="Role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Roles</SelectItem>
                                            {uniqueRoles.map(role => (
                                                <SelectItem key={role} value={role}>{role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Search</Label>
                                <div className="relative w-64">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Name or Emp ID..."
                                        className="pl-9 h-9 bg-white dark:bg-gray-800"
                                        value={searchQuery}
                                        onChange={handleSearch}
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
                                    <TableHead>Role</TableHead>
                                    <TableHead>Department</TableHead>
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
                                            <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                            <TableCell><div className="h-8 w-24 bg-gray-200 rounded animate-pulse ml-auto"></div></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredEmployees.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No employees found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEmployees.map((employee) => (
                                        <TableRow key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <TableCell className="font-medium text-gray-900 dark:text-gray-100">{employee.employee_id}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{employee.name}</span>
                                                    <span className="text-xs text-muted-foreground">{employee.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="capitalize">{employee.role.replace('_', ' ')}</TableCell>
                                            <TableCell>{employee.department || '-'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link
                                                        to={`/salary/employee/${employee.id}`}
                                                        className={`h-8 w-8 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-900/20 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground`}
                                                        title="View Salary Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>

                                                    {isAdminOrHr && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-900/20"
                                                            onClick={() => navigate(`/salary/add?userId=${employee.id}&name=${encodeURIComponent(employee.name)}`)}
                                                            title="Create Salary"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    )}

                                                    {userRole === 'admin' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                                                            onClick={() => handleDeleteSalary(String(employee.id))}
                                                            title="Delete Salary Record"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
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
                </CardContent>
            </Card>
        </div>
    );
};

export default SalaryDashboard;
