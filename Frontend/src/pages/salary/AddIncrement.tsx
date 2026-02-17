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


    const loadEmployees = async () => {
        try {
            const data = await apiService.getEmployees();
            setEmployees(data);
        } catch (error) {
            console.error('Failed to load employees:', error);
            toast({ title: "Error", description: "Failed to load employees.", variant: "destructive" });
        }
    };

    const loadCurrentSalary = async (uid: string) => {
        try {
            const data = await apiService.getSalaryDetails(uid);
            if (data) {
                setCurrentSalary(data);
                form.setValue('previousCtc', data.annualCtc);
                form.setValue('newCtc', data.annualCtc);
            } else {
                toast({ title: "No Salary Found", description: "This employee has no salary structure. Create one first.", variant: "warning" });
                setCurrentSalary(null);
            }
        } catch (error) {
            console.error('Failed to load current salary:', error);
            toast({ title: "Error", description: "Failed to load current salary.", variant: "destructive" });
            setCurrentSalary(null);
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

            // 1. Create increment record
            const response = await apiService.createIncrement({
                userId: data.userId,
                previousSalary: data.previousCtc,
                incrementAmount: data.incrementAmount,
                incrementPercentage: data.incrementPercentage,
                newSalary: data.newCtc,
                effectiveDate: data.effectiveDate,
                reason: data.reason
            });

            if (response && currentSalary) {
                // 2. Update the main salary structure CTC
                try {
                    await apiService.updateSalaryCtc(data.userId, {
                        annualCtc: data.newCtc,
                        variablePayType: currentSalary.variablePayType || 'none',
                        variablePayValue: currentSalary.variablePayValue || 0
                    });
                } catch (updateError) {
                    console.error("Increment created but CTC update failed:", updateError);
                    // Don't fail the whole process as the increment is already recorded
                }

                // Show success dialog
                setShowSuccessDialog(true);

                toast({
                    title: "Success",
                    description: "Salary increment processed successfully.",
                    variant: "success"
                });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to process increment.", variant: "destructive" });
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
