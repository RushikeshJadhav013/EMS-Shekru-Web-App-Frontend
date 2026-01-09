import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { apiService, Employee } from '@/lib/api';
import { SalaryStructure, SalaryPreview } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Loader2, Save, Calculator, ArrowLeft, RefreshCw,
    Lock, AlertTriangle, Calendar, Wallet, TrendingUp, DollarSign, FileText
} from 'lucide-react';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

// Validation Schema with stricter rules
const salarySchema = z.object({
    userId: z.string().min(1, 'Employee is required'),
    annualCtc: z.number().min(50000, 'Minimum CTC is ₹50,000'), // Minimum wage guard
    variablePayType: z.enum(['none', 'percentage', 'fixed']),
    variablePayValue: z.number().min(0).default(0),
    paymentMode: z.enum(['bank_transfer', 'cash', 'cheque']),
    bankName: z.string().min(2, 'Bank Name is required'),
    accountNumber: z.string().min(5, 'Account Number is required'),
    ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC Code format'),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
    uanNumber: z.string().optional(),
    workingDays: z.number().min(1).max(31).default(26),
}).refine((data) => {
    if (data.variablePayType === 'percentage' && data.variablePayValue > 50) {
        return false;
    }
    if (data.variablePayType === 'fixed' && data.variablePayValue > data.annualCtc * 0.5) {
        return false;
    }
    return true;
}, {
    message: "Variable pay cannot exceed 50% of CTC",
    path: ["variablePayValue"],
});

type SalaryFormValues = z.infer<typeof salarySchema>;

const AddEditSalary = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    const userIdParam = searchParams.get('userId');
    const existingName = searchParams.get('name');

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [previewData, setPreviewData] = useState<SalaryPreview | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [existingSalary, setExistingSalary] = useState<SalaryStructure | null>(null);
    const [activeTab, setActiveTab] = useState("ctc");
    const [isPayrollLocked, setIsPayrollLocked] = useState(false);
    const [forceUnlock, setForceUnlock] = useState(false);
    const [isGenSlipOpen, setIsGenSlipOpen] = useState(false);
    const [selectedGenMonth, setSelectedGenMonth] = useState(new Date().getMonth().toString());
    const [selectedGenYear, setSelectedGenYear] = useState(new Date().getFullYear().toString());
    const [isGenerating, setIsGenerating] = useState(false);

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const handleGenerateSlip = async () => {
        setIsGenerating(true);
        // Simulate generation delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsGenerating(false);
        setIsGenSlipOpen(false);
        toast({
            title: "Salary Slip Generated",
            description: `Slip for ${months[parseInt(selectedGenMonth)]} ${selectedGenYear} has been generated successfully.`,
            variant: "success"
        });
    };



    const form = useForm<SalaryFormValues>({
        resolver: zodResolver(salarySchema),
        defaultValues: {
            userId: userIdParam || '',
            annualCtc: 0,
            variablePayType: 'none',
            variablePayValue: 0,
            paymentMode: 'bank_transfer',
            bankName: '',
            accountNumber: '',
            ifscCode: '',
            panNumber: '',
            uanNumber: '',
            workingDays: 26,
        }
    });

    const watchUserId = form.watch('userId');
    const watchCtc = form.watch('annualCtc');
    const watchVarType = form.watch('variablePayType');
    const watchVarValue = form.watch('variablePayValue');

    useEffect(() => {
        loadEmployees();
        checkPayrollLock();
        if (userIdParam) {
            loadExistingSalary(userIdParam);
        }
    }, [userIdParam]);



    const checkPayrollLock = () => {
        // Simulate Logic: Check if we are past 25th of the month
        const today = new Date();
        if (today.getDate() > 25) {
            setIsPayrollLocked(true);
        }
    };

    // Auto calculate preview
    useEffect(() => {
        const timer = setTimeout(() => {
            if (watchCtc > 0) {
                handleCalculatePreview();
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [watchCtc, watchVarType, watchVarValue]);

    // Mock Data for UI Demo (AddEditSalary)
    const mockEmployees: Employee[] = [
        { id: '1', name: 'Rohan Sharma', employee_id: 'EMP001', department: 'Unreal Engine', role: 'employee', email: 'rohan@example.com', status: 'active', created_at: '2023-01-01', updated_at: '2023-01-01' },
        { id: '2', name: 'Priya Patel', employee_id: 'EMP002', department: 'React Development', role: 'manager', email: 'priya@example.com', status: 'active', created_at: '2023-02-15', updated_at: '2023-02-15' },
        { id: '3', name: 'Amit Singh', employee_id: 'EMP003', department: '3D Art', role: 'team_lead', email: 'amit@example.com', status: 'active', created_at: '2023-03-10', updated_at: '2023-03-10' },
        { id: '4', name: 'Sneha Gupta', employee_id: 'EMP004', department: 'HR', role: 'hr', email: 'sneha@example.com', status: 'active', created_at: '2023-04-01', updated_at: '2023-04-01' },
        { id: '5', name: 'Vikram Malhotra', employee_id: 'EMP005', department: 'Management', role: 'admin', email: 'vikram@example.com', status: 'active', created_at: '2022-11-20', updated_at: '2022-11-20' },
    ];

    const loadEmployees = async () => {
        try {
            // Simulate API
            // const data = await apiService.getEmployees();
            setEmployees(mockEmployees);
        } catch (error) {
            console.error('Failed to load employees');
        }
    };

    const loadExistingSalary = async (uid: string) => {
        try {
            setIsLoading(true);

            // 1. Check Session Storage first (Persisted Mock Data)
            const storedSalary = sessionStorage.getItem(`mock_salary_${uid}`);
            if (storedSalary) {
                const data = JSON.parse(storedSalary) as SalaryStructure;
                setExistingSalary(data);
                form.reset({
                    userId: uid,
                    annualCtc: data.annualCtc,
                    variablePayType: data.variablePayType,
                    variablePayValue: data.variablePayValue,
                    paymentMode: data.paymentMode,
                    bankName: data.bankName,
                    accountNumber: data.accountNumber,
                    ifscCode: data.ifscCode,
                    panNumber: data.panNumber,
                    uanNumber: data.uanNumber || '',
                    workingDays: data.workingDays,
                });
                handleCalculatePreview(data.annualCtc, data.variablePayType, data.variablePayValue);
                setIsLoading(false);
                return;
            }

            // Mock Validation: Only simulate existing salary for specific IDs
            // Assume user '1' and '2' have salary. Others are new.
            const hasSalary = uid === '1' || uid === '2';

            if (!hasSalary) {
                // Sceanrio: New Salary, but Employee Configured (KYC Exists)
                // Check if we have mock profile details to pre-fill
                const mockProfiles: Record<string, { pan: string, uan: string, bank: string, account: string, ifsc: string }> = {
                    '1': { pan: 'ABCDE1234F', uan: '101837465920', bank: 'State Bank of India', account: 'XXXXXXXXX1234', ifsc: 'SBIN0001234' },
                    '2': { pan: 'FGHIJ5678K', uan: '202948576131', bank: 'HDFC Bank', account: 'XXXXXXXXX5678', ifsc: 'HDFC0005678' },
                    '3': { pan: 'AMITS4321L', uan: '303040506070', bank: 'ICICI Bank', account: '987654321012', ifsc: 'ICIC0001234' },
                    '4': { pan: 'SNEHA9876M', uan: '404050607080', bank: 'Axis Bank', account: '112233445566', ifsc: 'UTIB0001234' },
                    '5': { pan: 'VIKRA1234N', uan: '505060708090', bank: 'Kotak Mahindra', account: '998877665544', ifsc: 'KKBK0001234' }
                };

                const profile = mockProfiles[uid];
                if (profile) {
                    // Simulate "Fetching from User Profile"
                    await new Promise(resolve => setTimeout(resolve, 300));

                    form.setValue('panNumber', profile.pan);
                    form.setValue('uanNumber', profile.uan);
                    form.setValue('bankName', profile.bank);
                    form.setValue('accountNumber', profile.account);
                    form.setValue('ifscCode', profile.ifsc);

                    toast({
                        title: "Profile Data Fetched",
                        description: "PAN and Bank details auto-filled from employee profile.",
                        variant: "default"
                    });
                }

                setIsLoading(false);
                return;
            }

            // Simulate API Delay
            await new Promise(resolve => setTimeout(resolve, 600));

            // Mock Response
            const data: SalaryStructure = {
                id: 'sal_' + uid,
                userId: uid,
                annualCtc: uid === '1' ? 1200000 : 1800000,
                variablePayType: uid === '1' ? 'none' : 'percentage',
                variablePayValue: uid === '1' ? 0 : 10,
                paymentMode: 'bank_transfer',
                bankName: 'HDFC Bank',
                accountNumber: '123456789012',
                ifscCode: 'HDFC0001234',
                panNumber: 'ABCDE1234F',
                uanNumber: '100000000001',
                workingDays: 26,
                monthlyBasic: uid === '1' ? 50000 : 75000,
                hra: uid === '1' ? 25000 : 37500,
                specialAllowance: uid === '1' ? 25000 : 37500,
                medicalAllowance: 0,
                conveyanceAllowance: 0,
                otherAllowance: 0,
                pfEmployee: 1800,
                pfEmployer: 1800,
                professionalTax: 200,
                monthlyGross: uid === '1' ? 100000 : 150000,
                monthlyDeductions: 2000,
                monthlyInHand: uid === '1' ? 98000 : 148000,
                effectiveDate: '2023-04-01',
                createdAt: '2023-04-01T10:00:00Z',
                updatedAt: '2024-01-01T10:00:00Z'
            };

            if (data) {
                setExistingSalary(data);
                form.reset({
                    userId: uid,
                    annualCtc: data.annualCtc,
                    variablePayType: data.variablePayType as 'none' | 'percentage' | 'fixed',
                    variablePayValue: data.variablePayValue,
                    paymentMode: data.paymentMode as 'bank_transfer' | 'cash' | 'cheque',
                    bankName: data.bankName,
                    accountNumber: data.accountNumber,
                    ifscCode: data.ifscCode,
                    panNumber: data.panNumber,
                    uanNumber: data.uanNumber || '',
                    workingDays: data.workingDays,
                });
                // Trigger preview based on mock data
                handleCalculatePreview(data.annualCtc, data.variablePayType as 'none' | 'percentage' | 'fixed', data.variablePayValue);
            }
        } catch (error) {
            // No salary found, perfectly fine for creation mode
        } finally {
            setIsLoading(false);
        }
    };

    const handleCalculatePreview = async (
        ctc = watchCtc,
        vType = watchVarType,
        vValue = watchVarValue
    ) => {
        if (!ctc || ctc <= 0) {
            setPreviewData(null);
            return;
        }

        setIsCalculating(true);
        try {
            // Mock Calculation Delay
            await new Promise(resolve => setTimeout(resolve, 500));
            // Force Error to use Fallback Logic (Mocking Frontend Logic as Primary)
            throw new Error("Using Frontend Mock Logic");
        } catch (error) {
            // console.warn("Backend preview calculation failed, using frontend fallback", error);

            // Fallback Logic (Indian Standard Salary Structure)
            const annualCtc = ctc;
            let variablePay = 0;

            if (vType === 'fixed') variablePay = vValue;
            if (vType === 'percentage') variablePay = (annualCtc * vValue) / 100;

            const fixedAnnualCtc = annualCtc - variablePay;
            const monthlyCtc = fixedAnnualCtc / 12;

            // Basic: 50% of Fixed CTC
            const basic = Math.round(monthlyCtc * 0.5);

            // HRA: 50% of Basic (assuming Metro)
            const hra = Math.round(basic * 0.5);

            // PF: 12% of Basic (capped calculation usually, but simplied here)
            // If Basic > 15000, PF is often limited to 1800, but standard is 12%
            const pfEmployee = Math.round(basic * 0.12);
            const pfEmployer = Math.round(basic * 0.12);

            // Professional Tax (Standard avg)
            const pt = 200;

            // Special Allowance is the balancing component
            // Formula: MonthlyCTC - (Basic + HRA + PFEmployer + OtherStatutory)
            // Note: CTC includes Employer PF. Gross does not.
            const grossDeductions = 0; // Employer part usually inside CTC but outside Gross
            const specialAllowance = Math.max(0, monthlyCtc - basic - hra - pfEmployer);

            const monthlyGross = basic + hra + specialAllowance;
            const monthlyDeductions = pfEmployee + pt;
            const monthlyInHand = monthlyGross - monthlyDeductions;

            setPreviewData({
                monthlyBasic: basic,
                annualBasic: basic * 12,
                hra: hra,
                specialAllowance: specialAllowance,
                medicalAllowance: 0,
                conveyanceAllowance: 0,
                otherAllowance: 0,
                professionalTax: pt,
                pfEmployee: pfEmployee,
                pfEmployer: pfEmployer,
                variablePay: variablePay,
                monthlyGross: monthlyGross,
                monthlyDeductions: monthlyDeductions,
                monthlyInHand: monthlyInHand,
                annualCtc: annualCtc
            });
        } finally {
            setIsCalculating(false);
        }
    };

    const onSubmit = async (data: SalaryFormValues) => {
        try {
            setIsLoading(true);

            // Mock Submission Delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (existingSalary) {
                // Mock Update
                const updatedSalary: SalaryStructure = {
                    ...existingSalary,
                    annualCtc: data.annualCtc,
                    variablePayType: data.variablePayType,
                    variablePayValue: data.variablePayValue,
                    paymentMode: data.paymentMode,
                    bankName: data.bankName,
                    accountNumber: data.accountNumber,
                    ifscCode: data.ifscCode,
                    panNumber: data.panNumber,
                    uanNumber: data.uanNumber || '',
                    workingDays: data.workingDays,
                    monthlyBasic: previewData?.monthlyBasic || existingSalary.monthlyBasic,
                    hra: previewData?.hra || existingSalary.hra,
                    specialAllowance: previewData?.specialAllowance || existingSalary.specialAllowance,
                    medicalAllowance: previewData?.medicalAllowance || existingSalary.medicalAllowance,
                    conveyanceAllowance: previewData?.conveyanceAllowance || existingSalary.conveyanceAllowance,
                    otherAllowance: previewData?.otherAllowance || existingSalary.otherAllowance,
                    professionalTax: previewData?.professionalTax || existingSalary.professionalTax,
                    pfEmployee: previewData?.pfEmployee || existingSalary.pfEmployee,
                    pfEmployer: previewData?.pfEmployer || existingSalary.pfEmployer,
                    monthlyGross: previewData?.monthlyGross || existingSalary.monthlyGross || 0,
                    monthlyDeductions: previewData?.monthlyDeductions || existingSalary.monthlyDeductions || 0,
                    monthlyInHand: previewData?.monthlyInHand || existingSalary.monthlyInHand,
                    updatedAt: new Date().toISOString()
                };
                sessionStorage.setItem(`mock_salary_${data.userId}`, JSON.stringify(updatedSalary));
                toast({ title: "Updated", description: "Salary updated successfully (Session Saved).", variant: "success" });
            } else {
                // Mock Create
                const newSalary: SalaryStructure = {
                    id: `sal_${data.userId}_${Date.now()}`,
                    userId: data.userId,
                    annualCtc: data.annualCtc,
                    variablePayType: data.variablePayType,
                    variablePayValue: data.variablePayValue,
                    paymentMode: data.paymentMode,
                    bankName: data.bankName,
                    accountNumber: data.accountNumber,
                    ifscCode: data.ifscCode,
                    panNumber: data.panNumber,
                    uanNumber: data.uanNumber || '',
                    workingDays: data.workingDays,
                    monthlyBasic: previewData?.monthlyBasic || 0,
                    hra: previewData?.hra || 0,
                    specialAllowance: previewData?.specialAllowance || 0,
                    medicalAllowance: previewData?.medicalAllowance || 0,
                    conveyanceAllowance: previewData?.conveyanceAllowance || 0,
                    otherAllowance: previewData?.otherAllowance || 0,
                    professionalTax: previewData?.professionalTax || 0,
                    pfEmployee: previewData?.pfEmployee || 0,
                    pfEmployer: previewData?.pfEmployer || 0,
                    monthlyGross: previewData?.monthlyGross || 0,
                    monthlyDeductions: previewData?.monthlyDeductions || 0,
                    monthlyInHand: previewData?.monthlyInHand || 0,
                    effectiveDate: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                sessionStorage.setItem(`mock_salary_${data.userId}`, JSON.stringify(newSalary));
                toast({ title: "Created", description: "Salary structure created with Session Storage.", variant: "success" });
            }

            navigate(`/salary/employee/${data.userId}`);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to save salary details.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val) : '₹0';

    // Lock Handling
    const isLocked = isPayrollLocked && existingSalary && !forceUnlock;



    if (isLoading && !existingSalary && userIdParam) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{existingSalary ? 'Update Salary Structure' : 'Create Salary Structure'}</h1>
                        <p className="text-muted-foreground text-sm">Define compensation, benefits, and statutory details.</p>
                    </div>
                </div>
                {isPayrollLocked && existingSalary && (
                    <div className="flex items-center gap-4 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center text-yellow-800 dark:text-yellow-400 text-sm font-medium">
                            <Lock className="h-4 w-4 mr-2" />
                            Payroll Locked for {new Date().toLocaleString('default', { month: 'long' })}
                        </div>
                        {user?.role === 'admin' && (
                            <div className="flex items-center gap-2">
                                <Label htmlFor="unlock-mode" className="text-xs pointer-events-none">Override</Label>
                                <Switch id="unlock-mode" checked={forceUnlock} onCheckedChange={setForceUnlock} />
                            </div>
                        )}
                    </div>
                )}
            </div>



            {/* Step 1: Employee Selection (Always Visible if no user selected) */}
            {
                !watchUserId && (
                    <Card className="max-w-2xl mx-auto mt-10 border-dashed border-2">
                        <CardHeader>
                            <CardTitle>Select Employee</CardTitle>
                            <CardDescription>Choose an employee to configure their salary structure.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <Label>Employee Search</Label>
                                <Controller
                                    name="userId"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={!!userIdParam || isLocked}
                                        >
                                            <SelectTrigger className="w-full h-12 text-lg">
                                                <SelectValue placeholder="Select an employee..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.map(emp => (
                                                    <SelectItem key={emp.id} value={String(emp.id)}>
                                                        <div className="flex flex-col text-left">
                                                            <span className="font-medium">{emp.name}</span>
                                                            <span className="text-xs text-muted-foreground">{emp.employee_id} • {emp.department || 'No Dept'}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )
            }

            {/* Step 2: Full Form (Visible only after selection) */}
            {
                watchUserId && (
                    <form onSubmit={form.handleSubmit(onSubmit)} className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* Left Column: Input Fields */}
                            <div className="lg:col-span-8 space-y-8">

                                {/* Section 1: Core Compensation */}
                                <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                                    <div className="h-1 bg-blue-500 w-full" />
                                    <CardHeader>
                                        <div>
                                            <CardTitle className="text-xl flex items-center gap-2">
                                                <DollarSign className="h-5 w-5 text-blue-500" />
                                                Core Compensation
                                            </CardTitle>
                                            <CardDescription>Define salary components and variable pay structure.</CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl flex items-center gap-4 border border-blue-100 dark:border-blue-900/20">
                                            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                                                {employees.find(e => String(e.id) === watchUserId)?.name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-gray-100">{employees.find(e => String(e.id) === watchUserId)?.name || 'Unknown Employee'}</p>
                                                <p className="text-sm text-muted-foreground">{employees.find(e => String(e.id) === watchUserId)?.employee_id} • {employees.find(e => String(e.id) === watchUserId)?.department}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="flex items-center gap-2">
                                                    Annual CTC (₹) <span className="text-red-500">*</span>
                                                </Label>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-blue-500 transition-colors">₹</span>
                                                    <Input
                                                        type="number"
                                                        className="pl-8 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                                        placeholder="e.g. 12,00,000"
                                                        disabled={isLocked}
                                                        {...form.register("annualCtc", { valueAsNumber: true })}
                                                    />
                                                </div>
                                                {form.formState.errors.annualCtc && <p className="text-red-500 text-xs mt-1">{form.formState.errors.annualCtc.message}</p>}
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="flex items-center gap-2">
                                                    Working Days (Month)
                                                </Label>
                                                <Input
                                                    type="number"
                                                    className="h-11"
                                                    disabled={isLocked}
                                                    {...form.register("workingDays", { valueAsNumber: true })}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-5 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl space-y-5 border border-gray-100 dark:border-gray-800">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                                <TrendingUp className="h-4 w-4 text-orange-500" />
                                                Variable Pay Setup
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div className="space-y-2">
                                                    <Label>Type</Label>
                                                    <Controller
                                                        name="variablePayType"
                                                        control={form.control}
                                                        render={({ field }) => (
                                                            <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                                                                <SelectTrigger className="h-11">
                                                                    <SelectValue placeholder="Select Type" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">Fixed Monthly Only (No Variable)</SelectItem>
                                                                    <SelectItem value="percentage">% of Annual CTC</SelectItem>
                                                                    <SelectItem value="fixed">Fixed Yearly Bonus</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Amount / %</Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            className="h-11"
                                                            placeholder={watchVarType === 'percentage' ? "e.g. 10" : "e.g. 50000"}
                                                            disabled={watchVarType === 'none' || isLocked}
                                                            {...form.register("variablePayValue", { valueAsNumber: true })}
                                                        />
                                                        {watchVarType === 'percentage' && <span className="absolute right-3 top-3 text-gray-400">%</span>}
                                                    </div>
                                                    {form.formState.errors.variablePayValue && <p className="text-red-500 text-xs mt-1">{form.formState.errors.variablePayValue.message}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Section 2: Bank & Compliance */}
                                <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                                    <div className="h-1 bg-purple-500 w-full" />
                                    <CardHeader>
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            <Wallet className="h-5 w-5 text-purple-500" />
                                            Bank & KYC Details
                                        </CardTitle>
                                        <CardDescription>Required for statutory compliance and monthly disbursement.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <Label>Payment Mode <span className="text-red-500">*</span></Label>
                                                <Controller
                                                    name="paymentMode"
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                                                            <SelectTrigger className="h-11">
                                                                <SelectValue placeholder="Select Mode" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="bank_transfer">Electronic Bank Transfer</SelectItem>
                                                                <SelectItem value="cheque">Account Payee Cheque</SelectItem>
                                                                <SelectItem value="cash">Petty Cash</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </div>
                                            <div className="space-y-2 lg:col-span-2">
                                                <Label>Bank Name <span className="text-red-500">*</span></Label>
                                                <Input {...form.register("bankName")} placeholder="e.g. HDFC Bank, SBI, ICICI" className="h-11" disabled={isLocked} />
                                                {form.formState.errors.bankName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.bankName.message}</p>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label>Account Number <span className="text-red-500">*</span></Label>
                                                <Input {...form.register("accountNumber")} placeholder="Enter Account No." className="h-11" disabled={isLocked} />
                                                {form.formState.errors.accountNumber && <p className="text-red-500 text-xs mt-1">{form.formState.errors.accountNumber.message}</p>}
                                            </div>
                                            <div className="space-y-2">
                                                <Label>IFSC Code <span className="text-red-500">*</span></Label>
                                                <Input {...form.register("ifscCode")} placeholder="e.g. HDFC0001234" maxLength={11} className="h-11 uppercase" disabled={isLocked} />
                                                {form.formState.errors.ifscCode && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ifscCode.message}</p>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label>PAN (Tax ID) <span className="text-red-500">*</span></Label>
                                                <Input {...form.register("panNumber")} placeholder="ABCDE1234F" maxLength={10} className="h-11 uppercase" disabled={isLocked} />
                                                {form.formState.errors.panNumber && <p className="text-red-500 text-xs mt-1">{form.formState.errors.panNumber.message}</p>}
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Universal Account Number (UAN)</Label>
                                                <Input {...form.register("uanNumber")} placeholder="12-digit UAN" className="h-11" disabled={isLocked} />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Section 3: Live Calculation Breakdown */}
                                <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                                    <div className="h-1 bg-green-500 w-full" />
                                    <CardHeader>
                                        <CardTitle className="text-xl flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Calculator className="h-5 w-5 text-green-500" />
                                                Estimated Payroll Breakdown
                                            </div>
                                            {isCalculating && <Loader2 className="h-4 w-4 animate-spin text-green-600" />}
                                        </CardTitle>
                                        <CardDescription>Detailed earnings and statutory deductions based on CTC.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {!previewData ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed">
                                                <Calculator className="h-10 w-10 mb-2 opacity-20" />
                                                <p>Enter Annual CTC to see breakdown</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-4">
                                                        <h4 className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Monthly Earnings</h4>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                <span className="text-sm font-medium">Basic Salary</span>
                                                                <span className="font-semibold">{formatCurrency(previewData.monthlyBasic)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                <span className="text-sm font-medium">HRA</span>
                                                                <span className="font-semibold">{formatCurrency(previewData.hra)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                <span className="text-sm font-medium">Special Allowance</span>
                                                                <span className="font-semibold">{formatCurrency(previewData.specialAllowance)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 mt-4 bg-gray-50/50 dark:bg-gray-800/50 px-2 rounded font-bold">
                                                                <span>Monthly Gross</span>
                                                                <span className="text-blue-600">{formatCurrency(previewData.monthlyGross)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <h4 className="text-sm font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Statutory Deductions</h4>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                <span className="text-sm font-medium text-muted-foreground line-through decoration-red-300">EPF (Employer)</span>
                                                                <span className="text-xs italic text-muted-foreground">Incl. in CTC</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                <span className="text-sm font-medium">EPF (Employee)</span>
                                                                <span className="font-semibold text-red-600">-{formatCurrency(previewData.pfEmployee)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                <span className="text-sm font-medium">Professional Tax</span>
                                                                <span className="font-semibold text-red-600">-{formatCurrency(previewData.professionalTax)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 mt-4 bg-red-50/50 dark:bg-red-900/10 px-2 rounded font-bold">
                                                                <span>Total Deductions</span>
                                                                <span className="text-red-600">-{formatCurrency(previewData.monthlyDeductions)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/30 flex items-start gap-3">
                                                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-yellow-800 dark:text-yellow-400 leading-relaxed">
                                                        Values are estimates based on standard Indian payroll regulations. Employer Provident Fund (EPF) of {formatCurrency(previewData.pfEmployer)} is included in the Annual CTC but deducted before calculating Monthly Gross.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column: Sticky Summary & Sidebar */}
                            <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
                                <Card className="border-none shadow-xl bg-white dark:bg-gray-900 overflow-hidden ring-1 ring-gray-100 dark:ring-gray-800">
                                    <div className="p-6 bg-gradient-to-br from-gray-900 to-blue-900 dark:from-gray-950 dark:to-blue-950 text-white">
                                        <p className="text-blue-300 text-xs font-bold uppercase tracking-tighter mb-1">Estimated In-Hand Pay</p>
                                        <div className="flex items-baseline gap-2">
                                            <h2 className="text-4xl font-extrabold tracking-tight">
                                                {previewData ? formatCurrency(previewData.monthlyInHand) : '₹0'}
                                            </h2>
                                            <span className="text-blue-400 text-sm font-medium">/ month</span>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] text-white/50 uppercase">Annual CTC</p>
                                                <p className="text-sm font-bold">{previewData ? formatCurrency(previewData.annualCtc) : formatCurrency(watchCtc)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-white/50 uppercase">Monthly Gross</p>
                                                <p className="text-sm font-bold">{previewData ? formatCurrency(previewData.monthlyGross) : '₹0'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                                                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Structure Validation Passed</span>
                                            </div>

                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                                                <Calendar className="h-4 w-4 text-blue-500" />
                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Effective from {new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Button
                                                type="submit"
                                                className="w-full h-12 text-md font-bold shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                                                disabled={isLoading || isCalculating || !previewData || (isLocked && !forceUnlock)}
                                            >
                                                {isLoading ? (
                                                    <><Loader2 className="animate-spin h-5 w-5 mr-3" /> Saving...</>
                                                ) : (
                                                    <><Save className="h-5 w-5 mr-3" /> {existingSalary ? 'Confirm & Update' : 'Initialize Salary'}</>
                                                )}
                                            </Button>

                                            {isLocked && !forceUnlock && (
                                                <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-2">
                                                    <Lock className="h-4 w-4 text-red-600" />
                                                    <span className="text-[10px] font-bold text-red-700 uppercase">Input Locked (Policy Restriction)</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                            <Dialog open={isGenSlipOpen} onOpenChange={setIsGenSlipOpen}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full border-blue-200 hover:bg-blue-50 dark:border-blue-900/50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold"
                                                    >
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Generate Monthly Slip
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[425px]">
                                                    <DialogHeader>
                                                        <DialogTitle>Generate Salary Slip</DialogTitle>
                                                        <DialogDescription>
                                                            Select the month and year to generate the salary slip for this employee.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="grid gap-4 py-4">
                                                        <div className="grid grid-cols-4 items-center gap-4">
                                                            <Label htmlFor="month" className="text-right text-xs">
                                                                Month
                                                            </Label>
                                                            <div className="col-span-3">
                                                                <Select value={selectedGenMonth} onValueChange={setSelectedGenMonth}>
                                                                    <SelectTrigger id="month">
                                                                        <SelectValue placeholder="Select Month" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {months.map((m, idx) => (
                                                                            <SelectItem key={m} value={idx.toString()}>
                                                                                {m}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-4 items-center gap-4">
                                                            <Label htmlFor="year" className="text-right text-xs">
                                                                Year
                                                            </Label>
                                                            <div className="col-span-3">
                                                                <Select value={selectedGenYear} onValueChange={setSelectedGenYear}>
                                                                    <SelectTrigger id="year">
                                                                        <SelectValue placeholder="Select Year" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {[2024, 2025, 2026].map(y => (
                                                                            <SelectItem key={y} value={y.toString()}>
                                                                                {y}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <Button
                                                            type="button"
                                                            onClick={handleGenerateSlip}
                                                            disabled={isGenerating}
                                                            className="bg-blue-600 hover:bg-blue-700"
                                                        >
                                                            {isGenerating ? (
                                                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Working...</>
                                                            ) : (
                                                                "Generate Now"
                                                            )}
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>

                                        <p className="text-[10px] text-center text-muted-foreground">
                                            By saving, you verify that this salary structure adheres to internal compliance and tax regulations.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </form>
                )
            }
            {
                !previewData && watchUserId && (
                    <div className="text-center py-12 text-muted-foreground animate-pulse">
                        <p>Enter Compensation details above to generate real-time preview</p>
                    </div>
                )
            }
        </div>
    );
};

export default AddEditSalary;
