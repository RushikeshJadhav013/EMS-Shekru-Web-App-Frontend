import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiService, Employee } from '@/lib/api';
import { SalaryStructure, Increment } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, TrendingUp, CheckCircle2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const incrementSchema = z.object({
    userId: z.string().min(1, 'Employee is required'),
    previousCtc: z.number(),
    incrementAmount: z.number().min(0, 'Amount must be positive'),
    incrementPercentage: z.number().min(0, 'Percentage must be positive'),
    newCtc: z.number().min(1, 'New CTC must be valid'),
    effectiveDate: z.string().min(1, 'Date is required'),
    reason: z.string().min(3, 'Reason is required'),
});

type IncrementFormValues = z.infer<typeof incrementSchema>;

const AddIncrement = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    const userIdParam = searchParams.get('userId');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [currentSalary, setCurrentSalary] = useState<SalaryStructure | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);


    const form = useForm<IncrementFormValues>({
        resolver: zodResolver(incrementSchema),
        defaultValues: {
            userId: userIdParam || '',
            previousCtc: 0,
            incrementAmount: 0,
            incrementPercentage: 0,
            newCtc: 0,
            effectiveDate: new Date().toISOString().split('T')[0],
            reason: '',
        }
    });

    // Load Employees
    useEffect(() => {
        loadEmployees();
    }, []);

    // Load Salary when User is Selected
    const selectedUserId = form.watch('userId');
    useEffect(() => {
        if (selectedUserId) {
            loadCurrentSalary(selectedUserId);
        }
    }, [selectedUserId]);

    // Mock Data for UI Demo (AddIncrement)
    const mockEmployees: Employee[] = [
        { id: '1', name: 'Rohan Sharma', employee_id: 'EMP001', department: 'Unreal Engine', role: 'employee', email: 'rohan@example.com', status: 'active', created_at: '2023-01-01', updated_at: '2023-01-01' },
        { id: '2', name: 'Priya Patel', employee_id: 'EMP002', department: 'React Development', role: 'manager', email: 'priya@example.com', status: 'active', created_at: '2023-02-15', updated_at: '2023-02-15' },
        { id: '3', name: 'Amit Singh', employee_id: 'EMP003', department: '3D Art', role: 'team_lead', email: 'amit@example.com', status: 'active', created_at: '2023-03-10', updated_at: '2023-03-10' },
        { id: '4', name: 'Sneha Gupta', employee_id: 'EMP004', department: 'HR', role: 'hr', email: 'sneha@example.com', status: 'active', created_at: '2023-04-01', updated_at: '2023-04-01' },
        { id: '5', name: 'Vikram Malhotra', employee_id: 'EMP005', department: 'Management', role: 'admin', email: 'vikram@example.com', status: 'active', created_at: '2022-11-20', updated_at: '2022-11-20' },
    ];

    const loadEmployees = async () => {
        // Simulate API
        // const data = await apiService.getEmployees();
        setEmployees(mockEmployees);
    };

    const loadCurrentSalary = async (uid: string) => {
        try {
            // 1. Check Session Storage first
            const stored = sessionStorage.getItem(`mock_salary_${uid}`);
            if (stored) {
                const data = JSON.parse(stored) as SalaryStructure;
                setCurrentSalary(data);
                form.setValue('previousCtc', data.annualCtc);
                form.setValue('newCtc', data.annualCtc);
                return;
            }

            // 2. Fallback to Hardcoded Mocks (for fresh demo state)
            // Mock API Delay
            await new Promise(resolve => setTimeout(resolve, 500));

            let data: SalaryStructure | null = null;

            // FULL Mock Data Construction to prevent crashes
            const baseMock = {
                variablePayType: 'none',
                variablePayValue: 0,
                paymentMode: 'bank_transfer',
                bankName: 'HDFC Bank',
                accountNumber: '123456789012',
                ifscCode: 'HDFC0001234',
                panNumber: 'ABCDE1234F',
                uanNumber: '100000000001',
                workingDays: 26,
                medicalAllowance: 0,
                conveyanceAllowance: 0,
                otherAllowance: 0,
                professionalTax: 200,
                pfEmployer: 1800,
                pfEmployee: 1800,
                effectiveDate: '2023-04-01',
                createdAt: '2023-04-01T10:00:00Z',
                updatedAt: '2024-01-01T10:00:00Z'
            };

            if (uid === '1') {
                data = {
                    ...baseMock,
                    id: 'sal1',
                    userId: '1',
                    annualCtc: 1200000,
                    monthlyBasic: 50000,
                    hra: 25000,
                    specialAllowance: 25000,
                    monthlyGross: 100000,
                    monthlyDeductions: 2000,
                    monthlyInHand: 98000
                } as SalaryStructure;
            } else if (uid === '2') {
                data = {
                    ...baseMock,
                    id: 'sal2',
                    userId: '2',
                    annualCtc: 1800000,
                    monthlyBasic: 75000,
                    hra: 37500,
                    specialAllowance: 37500,
                    monthlyGross: 150000,
                    monthlyDeductions: 2000,
                    monthlyInHand: 148000
                } as SalaryStructure;
            }

            if (data) {
                setCurrentSalary(data);
                form.setValue('previousCtc', data.annualCtc);
                form.setValue('newCtc', data.annualCtc);
            } else {
                toast({ title: "No Salary Found", description: "This employee has no salary structure. Create one first.", variant: "warning" });
                setCurrentSalary(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Auto-calculate logic
    const watchAmount = form.watch('incrementAmount');
    const watchPercent = form.watch('incrementPercentage');
    const watchNewCtc = form.watch('newCtc');
    const currentCtc = currentSalary?.annualCtc || 0;

    // We need to know which field was last changed to drive the others. 
    // This is tricky with react-hook-form watchers in a simple way. 
    // I'll attach handlers to inputs instead of simple watchers affecting each other cyclically.

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value) || 0;
        form.setValue('incrementAmount', val);
        if (currentCtc > 0) {
            const pct = parseFloat(((val / currentCtc) * 100).toFixed(2));
            form.setValue('incrementPercentage', pct);
            form.setValue('newCtc', currentCtc + val);
        }
    };

    const handlePercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value) || 0;
        form.setValue('incrementPercentage', val);
        if (currentCtc > 0) {
            const amt = Math.round((currentCtc * val) / 100);
            form.setValue('incrementAmount', amt);
            form.setValue('newCtc', currentCtc + amt);
        }
    };

    const handleNewCtcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value) || 0;
        form.setValue('newCtc', val);
        if (currentCtc > 0) {
            const diff = val - currentCtc;
            form.setValue('incrementAmount', diff);
            const pct = parseFloat(((diff / currentCtc) * 100).toFixed(2));
            form.setValue('incrementPercentage', pct);
        }
    };

    const onSubmit = async (data: IncrementFormValues) => {
        if (!currentSalary) {
            toast({ title: "Error", description: "Cannot create increment without existing salary.", variant: "destructive" });
            return;
        }

        try {
            setIsLoading(true);

            // Mock API Delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            /* 
            await apiService.createIncrement({
                // ... api args
            });
            */

            // 1. Calculate New Components based on New CTC
            // Use same fallback logic as AddEditSalary for consistency
            const annualCtc = data.newCtc;
            // Assume 0 variable for simplicity in increment (or keep existing ratio if we had it)
            // Ideally we should preserve the structure type, but let's assume standard breakups for the Hike

            const variablePay = 0; // Simplified
            const fixedAnnualCtc = annualCtc - variablePay;
            const monthlyCtc = fixedAnnualCtc / 12;

            const basic = Math.round(monthlyCtc * 0.5);
            const hra = Math.round(basic * 0.5);
            const pfEmployee = Math.round(basic * 0.12);
            const pfEmployer = Math.round(basic * 0.12);
            const pt = 200;
            const specialAllowance = Math.max(0, monthlyCtc - basic - hra - pfEmployer);

            const monthlyGross = basic + hra + specialAllowance;
            const monthlyDeductions = pfEmployee + pt;
            const monthlyInHand = monthlyGross - monthlyDeductions;

            // 2. Update Salary Object
            const updatedSalary: SalaryStructure = {
                ...currentSalary, // Keep existing fields like bank, ID, etc.
                annualCtc: annualCtc,
                monthlyBasic: basic,
                hra: hra,
                pfEmployee: pfEmployee,
                pfEmployer: pfEmployer,
                professionalTax: pt,
                specialAllowance: specialAllowance,
                monthlyGross: monthlyGross, // Important!
                monthlyDeductions: monthlyDeductions, // Important!
                monthlyInHand: monthlyInHand,
                updatedAt: new Date().toISOString()
            };

            // 3. Save Increment History to Session Storage
            const historyKey = `mock_increments_${data.userId}`;
            const existingHistory = JSON.parse(sessionStorage.getItem(historyKey) || '[]');
            const newIncrement: Increment = {
                id: `inc_${Date.now()}`,
                userId: data.userId,
                previousCtc: data.previousCtc,
                newCtc: data.newCtc,
                incrementAmount: data.incrementAmount,
                incrementPercentage: data.incrementPercentage,
                effectiveDate: data.effectiveDate,
                reason: data.reason,
                createdAt: new Date().toISOString(),
                createdBy: user?.name || 'Admin'
            };
            sessionStorage.setItem(historyKey, JSON.stringify([newIncrement, ...existingHistory]));

            // 4. Save Updated Salary to Session Storage
            sessionStorage.setItem(`mock_salary_${data.userId}`, JSON.stringify(updatedSalary));

            // Show Success Dialog instead of immediate redirect
            setShowSuccessDialog(true);
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to create increment.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <h1 className="text-2xl font-bold">Process Increment</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Salary Revision</CardTitle>
                    <CardDescription>Record a salary hike or revision for an employee.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <Label>Employee</Label>
                            <Controller
                                name="userId"
                                control={form.control}
                                render={({ field }) => (
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={!!userIdParam}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Employee" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {employees.map(emp => (
                                                <SelectItem key={emp.id} value={String(emp.id)}>
                                                    {emp.name} ({emp.employee_id})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>

                        {currentSalary && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-muted-foreground">Current Annual CTC</p>
                                    <p className="text-xl font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(currentSalary.annualCtc)}</p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Increment Amount (₹)</Label>
                                <Input
                                    type="number"
                                    onChange={handleAmountChange}
                                    value={form.watch('incrementAmount')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Percentage (%)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    onChange={handlePercentChange}
                                    value={form.watch('incrementPercentage')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>New Annual CTC (₹)</Label>
                            <Input
                                type="number"
                                onChange={handleNewCtcChange}
                                value={form.watch('newCtc')}
                                className="text-lg font-bold text-green-600"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Effective Date</Label>
                            <Input type="date" {...form.register('effectiveDate')} />
                            {form.formState.errors.effectiveDate && <p className="text-red-500 text-xs">{form.formState.errors.effectiveDate.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Reason / Remarks</Label>
                            <Textarea
                                {...form.register('reason')}
                                placeholder="e.g. Annual Appraisal, Promotion, etc."
                            />
                            {form.formState.errors.reason && <p className="text-red-500 text-xs">{form.formState.errors.reason.message}</p>}
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading || !currentSalary}>
                            {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                            Submit Increment
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <AlertDialogContent className="bg-white dark:bg-gray-900 border-green-500 border-2">
                    <AlertDialogHeader>
                        <div className="mx-auto bg-green-100 dark:bg-green-900/30 p-3 rounded-full mb-2">
                            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <AlertDialogTitle className="text-center text-xl">Increment Processed Successfully!</AlertDialogTitle>
                        <AlertDialogDescription className="text-center pt-2">
                            Salary structure has been updated for the employee.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg my-2 grid grid-cols-2 gap-4 text-center">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Previous CTC</p>
                            <p className="text-lg font-semibold text-gray-600 dark:text-gray-400 strike-through">
                                {currentSalary && new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(form.getValues('previousCtc'))}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">New CTC</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(form.getValues('newCtc'))}
                            </p>
                        </div>
                    </div>

                    <AlertDialogFooter className="sm:justify-center">
                        <AlertDialogAction
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                            onClick={() => navigate(`/salary/employee/${form.getValues('userId')}`)}
                        >
                            View Updated Salary Structure
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default AddIncrement;
