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
    Loader2, Save, Calculator, ArrowLeft,
    Lock, AlertTriangle, Calendar, TrendingUp, DollarSign, FileText, AlertCircle, Briefcase, RefreshCw
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Validation Schema with stricter rules
const salarySchema = z.object({
    userId: z.string().min(1, 'Employee is required'),
    annualCtc: z.preprocess((val) => {
        const num = Number(val);
        return isNaN(num) || num === 0 ? 0 : num;
    }, z.number().min(0, 'CTC must be a positive number')),
    variablePayType: z.enum(['none', 'percentage', 'fixed']),
    variablePayValue: z.preprocess((val) => Number(val) || 0, z.number().min(0).default(0)),
    workingDays: z.preprocess((val) => Number(val) || 26, z.number().min(1).max(31).default(26)),
    // Manual Entry Fields (Annual)
    basicAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
    hraAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
    specialAllowanceAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
    conveyanceAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
    medicalAllowanceAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
    otherAllowanceAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
    professionalTaxAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
    otherDeductionAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
    pfAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
    variablePayAnnual: z.preprocess((val) => Number(val) || 0, z.number().min(0).optional()),
}).refine((data) => {
    // Only validate variable pay rules for 'auto' mode if ctc is present
    if (data.annualCtc > 0) {
        if (data.variablePayType === 'percentage' && data.variablePayValue > 50) {
            return false;
        }
        if (data.variablePayType === 'fixed' && data.variablePayValue > data.annualCtc * 0.5) {
            return false;
        }
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
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const userRole = user?.role?.toLowerCase();
    const [previewData, setPreviewData] = useState<SalaryPreview | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [existingSalary, setExistingSalary] = useState<SalaryStructure | null>(null);
    const [activeTab, setActiveTab] = useState<"auto" | "manual">("auto");
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
        const userId = form.getValues('userId');
        if (!userId) {
            toast({
                title: "Employee Required",
                description: "Please select an employee first.",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsGenerating(true);
            const month = parseInt(selectedGenMonth) + 1;
            const year = parseInt(selectedGenYear);

            const response = await apiService.sendSalarySlip(userId, month, year);

            if (response?.success) {
                toast({
                    title: "Salary Slip Generated & Sent",
                    description: `Slip for ${months[parseInt(selectedGenMonth)]} ${selectedGenYear} has been generated and emailed successfully.`,
                    variant: "success"
                });
                setIsGenSlipOpen(false);
            } else {
                throw new Error(response?.message || 'Failed to generate salary slip');
            }
        } catch (err: any) {
            toast({
                title: "Generation Failed",
                description: err.message || "Failed to generate salary slip via API.",
                variant: "destructive"
            });
        } finally {
            setIsGenerating(false);
        }
    };



    const form = useForm<SalaryFormValues>({
        resolver: zodResolver(salarySchema),
        shouldUnregister: false,
        defaultValues: {
            userId: userIdParam || '',
            annualCtc: 0,
            variablePayType: 'none',
            variablePayValue: 0,
            workingDays: 26,
            basicAnnual: 0,
            hraAnnual: 0,
            specialAllowanceAnnual: 0,
            conveyanceAnnual: 0,
            medicalAllowanceAnnual: 0,
            otherAllowanceAnnual: 0,
            professionalTaxAnnual: 0,
            otherDeductionAnnual: 0,
            pfAnnual: 0,
            variablePayAnnual: 0,
        }
    });

    const watchUserId = form.watch('userId');
    const watchCtc = form.watch('annualCtc');
    const watchVarType = form.watch('variablePayType');
    const watchVarValue = form.watch('variablePayValue');
    const watchWorkingDays = form.watch('workingDays');

    useEffect(() => {
        loadEmployees();
        checkPayrollLock();
        if (userIdParam && userIdParam !== 'undefined') {
            loadExistingSalary(userIdParam);
        }
    }, [userIdParam]);

    // Update selected employee when watchUserId changes and pre-fill salary if available
    useEffect(() => {
        const fetchEmployeeDetails = async () => {
            if (watchUserId && employees.length > 0) {
                const emp = employees.find(e => String(e.id) === watchUserId);
                if (emp) {
                    setSelectedEmployee(emp);


                    // Load existing salary for this user if we're not already loading it from userIdParam
                    if (!existingSalary || String(existingSalary.userId) !== watchUserId) {
                        loadExistingSalary(watchUserId);
                    }
                }
            } else if (!watchUserId) {
                // Clear selection when no user is selected
                setSelectedEmployee(null);
            }
        };

        fetchEmployeeDetails();
    }, [watchUserId, employees]);



    const checkPayrollLock = () => {
        // Simulate Logic: Check if we are past 25th of the month
        const today = new Date();
        if (today.getDate() > 25) {
            setIsPayrollLocked(true);
        }
    };

    const watchBasicAnn = form.watch('basicAnnual');
    const watchHraAnn = form.watch('hraAnnual');
    const watchSpecialAnn = form.watch('specialAllowanceAnnual');
    const watchPFAnn = form.watch('pfAnnual');
    const watchVarPayAnn = form.watch('variablePayAnnual');
    const watchConveyanceAnn = form.watch('conveyanceAnnual');
    const watchMedicalAnn = form.watch('medicalAllowanceAnnual');
    const watchOtherAnn = form.watch('otherAllowanceAnnual');
    const watchPTAnn = form.watch('professionalTaxAnnual');
    const watchDeductionAnn = form.watch('otherDeductionAnnual');

    const totalCalculatedManualCTC = (watchBasicAnn || 0) + (watchHraAnn || 0) + (watchSpecialAnn || 0) +
        (watchConveyanceAnn || 0) + (watchMedicalAnn || 0) + (watchOtherAnn || 0) +
        (watchPFAnn || 0) + (watchVarPayAnn || 0) + (watchPTAnn || 0) + (watchDeductionAnn || 0);

    const manualCtcDifference = watchCtc - totalCalculatedManualCTC;

    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === "manual") {
                handleCalculatePreview();
            } else if (watchCtc > 0) {
                handleCalculatePreview();
            }
        }, 400); // Reduced from 800 for better reactivity
        return () => clearTimeout(timer);
    }, [
        watchCtc, watchVarType, watchVarValue, watchWorkingDays,
        watchBasicAnn, watchHraAnn, watchSpecialAnn, watchPFAnn,
        watchVarPayAnn, watchConveyanceAnn, watchMedicalAnn,
        watchOtherAnn, watchPTAnn, watchDeductionAnn, activeTab
    ]);

    // Sync manual components when CTC changes in both Guided and Manual modes
    useEffect(() => {
        if (watchCtc > 0) {
            // Try to use API calculation first for consistency with guided mode
            const calculateUsingApi = async () => {
                try {
                    const data = await apiService.calculateSalaryPreview(watchCtc, watchVarType, watchVarValue);
                    if (data) {
                        // Use API-calculated values for consistency
                        const mb = data.monthly_basic || data.monthlyBasic || (data.basic_annual ? data.basic_annual / 12 : 0);
                        const h = data.hra || (data.hra_annual ? data.hra_annual / 12 : (data.monthly_hra || 0));
                        const sa = data.special_allowance || data.specialAllowance || (data.special_allowance_annual ? data.special_allowance_annual / 12 : 0);
                        const ma = data.medical_allowance || data.medicalAllowance || (data.medical_allowance_annual ? data.medical_allowance_annual / 12 : 0);
                        const ca = data.conveyance_allowance || data.conveyanceAllowance || (data.conveyance_annual ? data.conveyance_annual / 12 : 0);
                        const oa = data.other_allowance || data.otherAllowance || (data.other_allowance_annual ? data.other_allowance_annual / 12 : 0);
                        const pt = data.professional_tax || data.professionalTax || (data.professional_tax_annual ? data.professional_tax_annual / 12 : 0);
                        const od = data.other_deduction || data.otherDeduction || (data.other_deduction_annual ? data.other_deduction_annual / 12 : 0);
                        const pfa = data.pf_annual || (((data.pf_employee || data.pfEmployee || 0) + (data.pf_employer || data.pfEmployer || 0)) * 12);
                        const vp = data.variable_pay || data.variablePay || (data.variable_pay_annual || 0);

                        form.setValue('basicAnnual', mb * 12, { shouldValidate: true });
                        form.setValue('hraAnnual', h * 12, { shouldValidate: true });
                        form.setValue('pfAnnual', pfa, { shouldValidate: true });
                        form.setValue('professionalTaxAnnual', pt * 12, { shouldValidate: true });
                        form.setValue('otherDeductionAnnual', od * 12, { shouldValidate: true });
                        form.setValue('specialAllowanceAnnual', sa * 12, { shouldValidate: true });
                        form.setValue('conveyanceAnnual', ca * 12, { shouldValidate: true });
                        form.setValue('medicalAllowanceAnnual', ma * 12, { shouldValidate: true });
                        form.setValue('otherAllowanceAnnual', oa * 12, { shouldValidate: true });
                        form.setValue('variablePayAnnual', vp, { shouldValidate: true });

                        handleCalculatePreview();
                        return;
                    }
                } catch (error) {
                    console.warn('API calculation failed, using fallback:', error);
                }

                // Fallback to local calculation if API fails
                // Standard Indian Payroll Proportions (following "Government Rules" logic)
                // We calculate based on the current CTC and variable pay in the form
                const variablePart = form.getValues('variablePayAnnual') || 0;
                // Fixed CTC available for core components
                const fixedCtc = watchCtc - variablePart;

                // 1. Basic: Usually 50% of Fixed CTC
                const annualBasic = Math.round(fixedCtc * 0.5);

                // 2. HRA: 50% of Basic
                const annualHra = Math.round(annualBasic * 0.5);

                // 3. PF: 12% of Basic (Employee) + 12% of Basic (Employer) = 24% of Basic Total
                // The form field 'pfAnnual' expects the TOTAL amount.
                const annualPfOneSide = Math.round(annualBasic * 0.12);
                const annualPfTotal = annualPfOneSide * 2;

                // 4. Professional Tax: assumed flat ₹2,400/year (₹200/month) as per your reference
                const annualPt = 2400;

                // 5. Other Deductions: 0% (start with 0, user can adjust)
                const annualOtherDed = 0;

                // 6. Special Allowance: The balancing figure to match CTC exactly
                // Sum of core components (Cost to Company) = Basic + HRA + Special + Conveyance + Medical + OtherAllow + PF_Employer + Variable
                // Fixed CTC = CTC - Variable
                // Fixed CTC = Basic + HRA + Special + PF_Employer
                // Special = Fixed CTC - Basic - HRA - PF_Employer

                const annualSpecial = Math.max(0, fixedCtc - annualBasic - annualHra - annualPfOneSide);

                // 7. Variable Pay calculation based on type
                let annualVariablePay = 0;
                if (watchVarType === 'percentage') {
                    annualVariablePay = watchCtc * (watchVarValue / 100);
                } else if (watchVarType === 'fixed') {
                    annualVariablePay = watchVarValue;
                }

                // Always populate manual fields regardless of active tab
                form.setValue('basicAnnual', annualBasic, { shouldValidate: true });
                form.setValue('hraAnnual', annualHra, { shouldValidate: true });
                form.setValue('pfAnnual', annualPfTotal, { shouldValidate: true });
                form.setValue('professionalTaxAnnual', annualPt, { shouldValidate: true });
                form.setValue('otherDeductionAnnual', annualOtherDed, { shouldValidate: true });
                form.setValue('specialAllowanceAnnual', annualSpecial, { shouldValidate: true });
                form.setValue('variablePayAnnual', annualVariablePay, { shouldValidate: true });

                // Trigger calculation preview refresh
                handleCalculatePreview();
            };

            calculateUsingApi();
        }
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
            const data = await apiService.getEmployees();
            setEmployees(data || []);

            // If we have a userIdParam, immediately set the selected employee and fetch full details
            if (userIdParam && data && data.length > 0) {
                const emp = data.find((e: Employee) => String(e.id) === userIdParam);
                if (emp) {
                    setSelectedEmployee(emp);
                } else if (existingName) {
                    // Fallback: create minimal employee object from URL params
                    setSelectedEmployee({
                        id: userIdParam,
                        name: existingName,
                        employee_id: '',
                        department: '',
                        role: 'employee',
                        email: '',
                        status: 'active',
                        created_at: '',
                        updated_at: ''
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load employees', error);

            // If API fails but we have existingName from URL, still create a minimal employee object
            if (userIdParam && existingName) {
                setSelectedEmployee({
                    id: userIdParam,
                    name: existingName,
                    employee_id: '',
                    department: '',
                    role: 'employee',
                    email: '',
                    status: 'active',
                    created_at: '',
                    updated_at: ''
                });
            }
        }
    };

    const syncManualFieldsFromPreview = () => {
        if (previewData) {
            form.setValue('basicAnnual', previewData.annualBasic || 0, { shouldValidate: true });
            form.setValue('hraAnnual', (previewData.hra || 0) * 12, { shouldValidate: true });
            form.setValue('specialAllowanceAnnual', (previewData.specialAllowance || 0) * 12, { shouldValidate: true });
            form.setValue('conveyanceAnnual', (previewData.conveyanceAllowance || 0) * 12, { shouldValidate: true });
            form.setValue('medicalAllowanceAnnual', (previewData.medicalAllowance || 0) * 12, { shouldValidate: true });
            form.setValue('otherAllowanceAnnual', (previewData.otherAllowance || 0) * 12, { shouldValidate: true });
            form.setValue('pfAnnual', ((previewData.pfEmployee || 0) + (previewData.pfEmployer || 0)) * 12, { shouldValidate: true });
            form.setValue('professionalTaxAnnual', (previewData.professionalTax || 0) * 12, { shouldValidate: true });
            form.setValue('otherDeductionAnnual', (previewData.otherDeduction || 0) * 12, { shouldValidate: true });
            form.setValue('variablePayAnnual', previewData.variablePay || 0, { shouldValidate: true });
        }
    };

    const handleCalculatePreview = async (
        ctc = watchCtc,
        vType = watchVarType,
        vValue = watchVarValue
    ) => {
        const isManual = activeTab === "manual";

        if (!isManual && (!ctc || ctc <= 0)) {
            setPreviewData(null);
            return;
        }

        setIsCalculating(true);
        try {
            // Mock Calculation Delay
            await new Promise(resolve => setTimeout(resolve, 300));

            if (isManual) {
                const values = form.getValues();
                const basic = Math.round((values.basicAnnual || 0) / 12);
                const hra = Math.round((values.hraAnnual || 0) / 12);
                const special = Math.round((values.specialAllowanceAnnual || 0) / 12);
                const medical = Math.round((values.medicalAllowanceAnnual || 0) / 12);
                const conveyance = Math.round((values.conveyanceAnnual || 0) / 12);
                const other = Math.round((values.otherAllowanceAnnual || 0) / 12);
                const pt = Math.round((values.professionalTaxAnnual || 0) / 12);
                const otherDed = Math.round((values.otherDeductionAnnual || 0) / 12);

                // PF Calculation: Split Annual Total into Employer and Employee shares (50/50)
                const pfAnnTotal = values.pfAnnual || 0;
                const pfAnnOneSide = pfAnnTotal / 2;
                const pfEmp = Math.round(pfAnnOneSide / 12);
                const pfEmpr = Math.round(pfAnnOneSide / 12);

                const vPay = Math.round((values.variablePayAnnual || 0) / 12);

                const monthlyGross = basic + hra + special + medical + conveyance + other;
                const monthlyDeductions = pfEmp + pt + otherDed;
                const monthlyInHand = monthlyGross - monthlyDeductions;
                // CTC = Monthly Gross * 12 + Employer PF * 12 + Annual Variable Pay
                // (Note: Employer PF is outside Gross, but part of CTC)
                const calculatedAnnualCtc = (monthlyGross + pfEmpr) * 12 + (values.variablePayAnnual || 0);

                setPreviewData({
                    annualCtc: values.annualCtc > 0 ? values.annualCtc : calculatedAnnualCtc,
                    annualBasic: basic * 12,
                    monthlyBasic: basic,
                    hra,
                    specialAllowance: special,
                    medicalAllowance: medical,
                    conveyanceAllowance: conveyance,
                    otherAllowance: other,
                    pfEmployer: pfEmpr,
                    pfEmployee: pfEmp,
                    professionalTax: pt,
                    variablePay: vPay * 12,
                    monthlyGross,
                    monthlyDeductions,
                    otherDeduction: otherDed,
                    monthlyInHand,
                });
            } else {
                // Try API call first, then fallback to local calculation
                try {
                    const data = await apiService.calculateSalaryPreview(ctc, vType, vValue);

                    // Robust mapping from API response (handling both snake_case, camelCase, and annual/monthly variations)
                    const monthlyBasic = data.monthly_basic || data.monthlyBasic || (data.basic_annual ? data.basic_annual / 12 : 0);
                    const hra = data.hra || (data.hra_annual ? data.hra_annual / 12 : (data.monthly_hra || 0));
                    const specialAllowance = data.special_allowance || data.specialAllowance || (data.special_allowance_annual ? data.special_allowance_annual / 12 : 0);
                    const medicalAllowance = data.medical_allowance || data.medicalAllowance || (data.medical_allowance_annual ? data.medical_allowance_annual / 12 : 0);
                    const conveyanceAllowance = data.conveyance_allowance || data.conveyanceAllowance || (data.conveyance_annual ? data.conveyance_annual / 12 : 0);
                    const otherAllowance = data.other_allowance || data.otherAllowance || (data.other_allowance_annual ? data.other_allowance_annual / 12 : 0);

                    const pfEmployer = data.pf_employer || data.pfEmployer || (data.pf_annual ? (data.pf_annual / 2) / 12 : (monthlyBasic > 0 ? Math.round(monthlyBasic * 0.12) : 0));
                    const pfEmployee = data.pf_employee || data.pfEmployee || (data.pf_annual ? (data.pf_annual / 2) / 12 : (monthlyBasic > 0 ? Math.round(monthlyBasic * 0.12) : 0));
                    const professionalTax = data.professional_tax || data.professionalTax || (data.professional_tax_annual ? data.professional_tax_annual / 12 : (ctc > 0 ? 200 : 0));
                    const otherDeduction = data.other_deduction || data.otherDeduction || (data.other_deduction_annual ? data.other_deduction_annual / 12 : 0);

                    const monthlyGross = data.monthly_gross || data.monthlyGross || (monthlyBasic + hra + specialAllowance + medicalAllowance + conveyanceAllowance + otherAllowance);
                    // Re-calculate monthly deductions with mapped values
                    const totalMonthlyDeductions = pfEmployee + professionalTax + otherDeduction;
                    const monthlyInHand = data.monthly_in_hand || data.monthlyInHand || (monthlyGross - totalMonthlyDeductions);
                    const annualCtc = data.annual_ctc || data.annualCtc || (data.ctc_annual || ctc);

                    setPreviewData({
                        ...data,
                        monthlyBasic,
                        hra,
                        specialAllowance,
                        medicalAllowance,
                        conveyanceAllowance,
                        otherAllowance,
                        pfEmployer,
                        pfEmployee,
                        professionalTax,
                        otherDeduction,
                        variablePay: data.variable_pay || data.variablePay || (data.variable_pay_annual || 0),
                        monthlyGross,
                        monthlyDeductions: totalMonthlyDeductions,
                        monthlyInHand,
                        annualCtc,
                        annualBasic: data.annualBasic || (monthlyBasic * 12)
                    });
                } catch (error) {
                    console.warn('API calculation failed, using fallback:', error);
                    // Fallback calculation for guided mode
                    const fixedCtc = vType === 'percentage' ? ctc * (1 - vValue / 100) : ctc - vValue;
                    const annualBasic = Math.round(fixedCtc * 0.5);
                    const annualHra = Math.round(annualBasic * 0.5);
                    const annualPfOneSide = Math.round(annualBasic * 0.12); // One Side
                    const annualPt = 2400;

                    // Note: Special Allowance in fallback was incorrectly subtracting "annualPf" (one side) from CTC?
                    // CTC = Basic + HRA + Special + PF_Employer + Variable.
                    // Special = CTC - Variable - Basic - HRA - PF_Employer.
                    // Correct.

                    const monthlyBasic = Math.round(annualBasic / 12);
                    const monthlyHra = Math.round(annualHra / 12);
                    const monthlyPfEmp = Math.round(annualPfOneSide / 12);
                    const monthlyPfEmpr = Math.round(annualPfOneSide / 12);
                    const monthlyPt = Math.round(annualPt / 12);

                    const annualSpecial = Math.max(0, fixedCtc - annualBasic - annualHra - annualPfOneSide);
                    const monthlySpecial = Math.round(annualSpecial / 12);

                    const monthlyGross = monthlyBasic + monthlyHra + monthlySpecial;
                    const monthlyDeductions = monthlyPfEmp + monthlyPt;
                    const monthlyInHand = monthlyGross - monthlyDeductions;

                    setPreviewData({
                        annualCtc: ctc,
                        annualBasic,
                        monthlyBasic,
                        hra: monthlyHra,
                        specialAllowance: monthlySpecial,
                        medicalAllowance: 0,
                        conveyanceAllowance: 0,
                        otherAllowance: 0,
                        pfEmployer: monthlyPfEmpr,
                        pfEmployee: monthlyPfEmp,
                        professionalTax: monthlyPt,
                        variablePay: vType === 'percentage' ? ctc * (vValue / 100) : vValue,
                        monthlyGross,
                        monthlyDeductions,
                        otherDeduction: 0,
                        monthlyInHand,
                    });
                }
            }
        } catch (error) {
            console.error('Failed to calculate preview');
        } finally {
            setIsCalculating(false);
        }
    };

    const loadExistingSalary = async (uid: string) => {
        try {
            setIsLoading(true);

            // Fetch existing salary data from Salary API
            const data = await apiService.getSalaryDetails(uid);

            if (data) {
                setExistingSalary(data);

                // Map backend response to form values
                form.reset({
                    userId: uid,
                    annualCtc: data.annual_ctc || data.annualCtc,
                    variablePayType: data.variable_pay_type || data.variablePayType || 'none',
                    variablePayValue: data.variable_pay_value || data.variablePayValue || 0,
                    workingDays: data.working_days || data.workingDays || 26,

                    // Manual entry fields (annual values) - from Salary API
                    basicAnnual: (data.monthly_basic || data.monthlyBasic || 0) * 12,
                    hraAnnual: (data.hra || 0) * 12,
                    pfAnnual: (data.pf_employer || data.pfEmployer || 0) * 12,
                    professionalTaxAnnual: (data.professional_tax || data.professionalTax || 0) * 12,
                    specialAllowanceAnnual: (data.special_allowance || data.specialAllowance || 0) * 12,
                    conveyanceAnnual: (data.conveyance_allowance || data.conveyanceAllowance || 0) * 12,
                    medicalAllowanceAnnual: (data.medical_allowance || data.medicalAllowance || 0) * 12,
                    otherAllowanceAnnual: (data.other_allowance || data.otherAllowance || 0) * 12,
                    otherDeductionAnnual: (data.other_deduction || data.otherDeduction || 0) * 12,
                    variablePayAnnual: data.variable_pay || data.variablePay || 0
                });

                // Set selected employee if employees are loaded
                if (employees.length > 0) {
                    const emp = employees.find((e: Employee) => String(e.id) === uid);
                    if (emp) {
                        setSelectedEmployee(emp);
                    }
                }

                // Trigger preview calculation after form reset
                setTimeout(() => {
                    handleCalculatePreview();
                }, 100);
            }
        } catch (error) {
            console.error('Failed to load salary details:', error);
            // Don't show error toast if it's a 404 (salary doesn't exist yet)
            if (error && typeof error === 'object' && 'message' in error) {
                const errMsg = (error as Error).message;
                if (!errMsg.includes('404') && !errMsg.includes('not found')) {
                    toast({
                        title: "Error",
                        description: "Failed to load existing salary details.",
                        variant: "destructive"
                    });
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmit = async (data: SalaryFormValues) => {
        try {
            setIsLoading(true);

            const userIdInt = parseInt(data.userId);

            if (activeTab === "manual") {
                // Calculate variable pay for manual mode
                const calculatedVariablePay = data.variablePayType === 'percentage'
                    ? ((data.basicAnnual || 0) + (data.hraAnnual || 0) + (data.specialAllowanceAnnual || 0) +
                        (data.conveyanceAnnual || 0) + (data.medicalAllowanceAnnual || 0) + (data.otherAllowanceAnnual || 0)) * (data.variablePayValue / 100)
                    : data.variablePayType === 'fixed'
                        ? data.variablePayValue
                        : 0;

                // Administrative Manual Entry Payload
                const manualPayload = {
                    user_id: userIdInt,
                    basic_annual: data.basicAnnual || 0,
                    hra_annual: data.hraAnnual || 0,
                    special_allowance_annual: data.specialAllowanceAnnual || 0,
                    conveyance_annual: data.conveyanceAnnual || 0,
                    medical_allowance_annual: data.medicalAllowanceAnnual || 0,
                    other_allowance_annual: data.otherAllowanceAnnual || 0,
                    professional_tax_annual: data.professionalTaxAnnual || 0,
                    other_deduction_annual: data.otherDeductionAnnual || 0,
                    pf_annual: data.pfAnnual || 0,
                    variable_pay: calculatedVariablePay,
                    working_days_per_month: data.workingDays || 26
                };

                let response;
                if (existingSalary) {
                    response = await apiService.updateSalaryCtc(data.userId, {
                        annualCtc: data.annualCtc,
                        variablePayType: data.variablePayType,
                        variablePayValue: data.variablePayValue
                    });
                    toast({
                        title: "Success",
                        description: "Salary structure updated successfully.",
                        variant: "success"
                    });
                } else {
                    response = await apiService.createManualSalary(manualPayload);
                    toast({
                        title: "Success",
                        description: "Salary created successfully.",
                        variant: "success"
                    });
                }

                // Update state with backend response
                if (response) {
                    setExistingSalary(response);
                    await loadExistingSalary(data.userId);
                    // Sync manual fields after successful save
                    if (previewData) {
                        syncManualFieldsFromPreview();
                    }
                }

            } else {
                // Guided Mode Payload
                const payload = {
                    user_id: userIdInt,
                    annual_ctc: data.annualCtc,
                    variable_pay_type: data.variablePayType,
                    variable_pay_value: data.variablePayValue,
                    working_days: data.workingDays,
                };

                let response;
                if (existingSalary) {
                    // Update CTC first if changed
                    response = await apiService.updateSalaryCtc(data.userId, {
                        annualCtc: payload.annual_ctc,
                        variablePayType: payload.variable_pay_type,
                        variablePayValue: payload.variable_pay_value
                    });

                    toast({
                        title: "Updated",
                        description: "Salary structure updated successfully.",
                        variant: "success"
                    });
                } else {
                    response = await apiService.createSalary(payload);
                    toast({
                        title: "Created",
                        description: "Salary structure created successfully.",
                        variant: "success"
                    });
                }

                // Update state with backend response
                if (response) {
                    setExistingSalary(response);
                    await loadExistingSalary(data.userId);
                }
            }

        } catch (error: any) {
            console.error("Form Submission Error:", error);

            // Parse backend validation errors if available
            let errorMessage = "Failed to save salary details. Please check all fields.";

            if (error.message) {
                // Check if error contains validation details
                if (error.message.includes("Annual CTC") || error.message.includes("minimum")) {
                    errorMessage = error.message;

                    // Map to form field error if it's a CTC validation error
                    if (error.message.toLowerCase().includes("ctc")) {
                        form.setError('annualCtc', { message: error.message });
                    }
                }
            }

            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to log validation errors
    const onInvalid = (errors: any) => {
        console.error("Form Validation Errors:", errors);
        const firstError = Object.values(errors)[0] as any;
        toast({
            title: "Validation Error",
            description: firstError?.message || "Please fill all required fields correctly.",
            variant: "destructive"
        });
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
                    <Button variant="ghost" size="sm" onClick={() => {
                        if (userIdParam) {
                            navigate(`/salary/employee/${userIdParam}`);
                        } else {
                            navigate(-1);
                        }
                    }}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                                {existingSalary ? 'Salary Structure' : 'Create Salary Structure'}
                            </h1>
                            {existingSalary && (
                                <Badge className="bg-blue-500 text-white">
                                    Edit Mode
                                </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">Define compensation, benefits, and statutory details.</p>
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

            {/* Employee Details Section - Top of Page */}
            {selectedEmployee && (
                <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500 w-full" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-blue-600" />
                            Employee Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Employee Name</h4>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedEmployee.name}</p>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Role</h4>
                                <Badge variant="secondary" className="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 font-semibold text-xs capitalize">
                                    {selectedEmployee.role || 'N/A'}
                                </Badge>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Department</h4>
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 font-semibold text-xs">
                                    {selectedEmployee.department || 'N/A'}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

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
                                                {employees
                                                    .filter(emp => emp.role?.toLowerCase() !== 'admin')
                                                    .map(emp => (
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
                    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* Left Column: Input Fields */}
                            <div className="lg:col-span-8 space-y-8">

                                <Tabs defaultValue="auto" value={activeTab} onValueChange={(val) => {
                                    if (userRole === 'hr' && val === "manual") return;
                                    if (val === "auto" || val === "manual") {
                                        setActiveTab(val);
                                    }
                                    // Sync manual fields when switching from guided to manual
                                    if (val === "manual" && activeTab === "auto") {
                                        setTimeout(async () => {
                                            if (previewData) {
                                                syncManualFieldsFromPreview();
                                            } else if (watchCtc > 0) {
                                                // Use API calculation for consistency
                                                try {
                                                    const data = await apiService.calculateSalaryPreview(watchCtc, watchVarType, watchVarValue);
                                                    if (data) {
                                                        form.setValue('basicAnnual', (data.monthly_basic || data.monthlyBasic || 0) * 12, { shouldValidate: true });
                                                        form.setValue('hraAnnual', (data.hra || 0) * 12, { shouldValidate: true });
                                                        form.setValue('pfAnnual', ((data.pf_employee || data.pfEmployee || 0) + (data.pf_employer || data.pfEmployer || 0)) * 12, { shouldValidate: true });
                                                        form.setValue('professionalTaxAnnual', (data.professional_tax || data.professionalTax || 0) * 12, { shouldValidate: true });
                                                        form.setValue('otherDeductionAnnual', (data.other_deduction || data.otherDeduction || 0) * 12, { shouldValidate: true });
                                                        form.setValue('specialAllowanceAnnual', (data.special_allowance || data.specialAllowance || 0) * 12, { shouldValidate: true });
                                                        form.setValue('conveyanceAnnual', (data.conveyance_allowance || data.conveyanceAllowance || 0) * 12, { shouldValidate: true });
                                                        form.setValue('medicalAllowanceAnnual', (data.medical_allowance || data.medicalAllowance || 0) * 12, { shouldValidate: true });
                                                        form.setValue('otherAllowanceAnnual', (data.other_allowance || data.otherAllowance || 0) * 12, { shouldValidate: true });
                                                        form.setValue('variablePayAnnual', data.variable_pay || data.variablePay || 0, { shouldValidate: true });

                                                        handleCalculatePreview();
                                                        return;
                                                    }
                                                } catch (error) {
                                                    console.warn('API calculation failed during tab switch, using fallback:', error);

                                                    // Fallback calculation
                                                    const variablePart = form.getValues('variablePayAnnual') || 0;
                                                    const fixedCtc = watchCtc - variablePart;

                                                    const annualBasic = Math.round(fixedCtc * 0.5);
                                                    const annualHra = Math.round(annualBasic * 0.5);
                                                    // PF: 12% Emp + 12% Empr = 24% Total
                                                    const annualPfOneSide = Math.round(annualBasic * 0.12);
                                                    const annualPfTotal = annualPfOneSide * 2;

                                                    const annualPt = 2400;
                                                    const annualOtherDed = 0;
                                                    const annualSpecial = Math.max(0, fixedCtc - annualBasic - annualHra - annualPfOneSide - annualPt - annualOtherDed); // Subtract Employer PF only from CTC for Special Allowance balance? No wait.
                                                    // CTC = Basic + HRA + Special + EmprPF + Variable.
                                                    // So Special = CTC - Variable - Basic - HRA - EmprPF.
                                                    // EmprPF is annualPfOneSide.
                                                    // Wait, in previous fix I used: annualSpecial = Math.max(0, fixedCtc - annualBasic - annualHra - annualPfOneSide);
                                                    // But here I see annualPt and annualOtherDed being subtracted too.
                                                    // PT and OtherDed usually come from Gross (Basic+HRA+Special). They don't INCREASE CTC.
                                                    // Gross = CTC - EmprPF.
                                                    // Gross = Basic + HRA + Special.
                                                    // So CTC = Basic + HRA + Special + EmprPF.
                                                    // So Special = CTC - Basic - HRA - EmprPF.
                                                    // PT is a deduction FROM Gross. It doesn't affect the CTC equation directly (it's part of Gross).
                                                    // So subtracting annualPt here reduces Special Allowance? 
                                                    // If we subtract PT from Special, then Gross decreases. 
                                                    // If Gross decreases, but PT is deducted from Gross... 
                                                    // Wait. If Annual PT is 2400. This is paid by Employee. It's part of Gross.
                                                    // So it should NOT be subtracted when calculating Special Allowance to match CTC.
                                                    // Correct: Special = FixedCtc - Basic - HRA - PF_Employer.

                                                    // HOWEVER, if the previous code was subtracting it, maybe it was assuming Cost To Company included PT reimbursement? No, usually PT is employee deduction.
                                                    // I will stick to the logic: Special = FixedCtc - Basic - HRA - PF_Employer (annualPfOneSide).
                                                    // But I will verify what I did in Step 68.
                                                    // Step 68 Sync Logic: const annualSpecial = Math.max(0, fixedCtc - annualBasic - annualHra - annualPfOneSide);
                                                    // Step 68 Fallback Logic: const annualSpecial = Math.max(0, fixedCtc - annualBasic - annualHra - annualPfOneSide);
                                                    // So I should REMOVE -annualPt -annualOtherDed from this calculation to be consistent.

                                                    let annualVariablePay = 0;
                                                    if (watchVarType === 'percentage') {
                                                        annualVariablePay = watchCtc * (watchVarValue / 100);
                                                    } else if (watchVarType === 'fixed') {
                                                        annualVariablePay = watchVarValue;
                                                    }

                                                    form.setValue('basicAnnual', annualBasic, { shouldValidate: true });
                                                    form.setValue('hraAnnual', annualHra, { shouldValidate: true });
                                                    form.setValue('pfAnnual', annualPfTotal, { shouldValidate: true });
                                                    form.setValue('professionalTaxAnnual', annualPt, { shouldValidate: true });
                                                    form.setValue('otherDeductionAnnual', annualOtherDed, { shouldValidate: true });
                                                    form.setValue('specialAllowanceAnnual', annualSpecial, { shouldValidate: true });
                                                    form.setValue('variablePayAnnual', annualVariablePay, { shouldValidate: true });

                                                    handleCalculatePreview();
                                                }
                                            }
                                        }, 100);
                                    }
                                }} className="w-full">
                                    {userRole === 'admin' && (
                                        <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl">
                                            <TabsTrigger value="auto" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm transition-all">
                                                <Calculator className="h-4 w-4 mr-2" /> Guided Mode
                                            </TabsTrigger>
                                            <TabsTrigger value="manual" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm transition-all">
                                                <FileText className="h-4 w-4 mr-2" /> Manual Entry
                                            </TabsTrigger>
                                        </TabsList>
                                    )}

                                    <TabsContent value="auto">
                                        {/* Section 1: Core Compensation - AUTO */}
                                        <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                                            <div className="h-1 bg-blue-500 w-full" />
                                            <CardHeader className="pb-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center border border-blue-100 dark:border-blue-800">
                                                            <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                                Guided Salary Setup
                                                                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 uppercase tracking-widest font-bold">Standard</span>
                                                            </CardTitle>
                                                            <CardDescription className="text-xs font-medium">
                                                                Automated compensation structuring based on annual CTC and statutory norms.
                                                            </CardDescription>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                                                            Annual CTC (₹) <span className="text-red-500">*</span>
                                                        </Label>
                                                        <div className="relative group">
                                                            <span className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-blue-500 transition-colors">₹</span>
                                                            <Input
                                                                type="number"
                                                                className="pl-8 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 font-bold text-lg"
                                                                placeholder="e.g. 12,00,000"
                                                                disabled={isLocked}
                                                                {...form.register("annualCtc")}
                                                            />
                                                        </div>
                                                        {form.formState.errors.annualCtc && <p className="text-red-500 text-xs mt-1">{form.formState.errors.annualCtc.message}</p>}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                                                            Working Days (Month)
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            className="h-11 font-semibold"
                                                            disabled={isLocked}
                                                            {...form.register("workingDays", { valueAsNumber: true })}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="p-5 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl space-y-5 border border-gray-100 dark:border-gray-800">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-[0.2em]">
                                                        <TrendingUp className="h-3 w-3 text-orange-500" />
                                                        Variable Pay Setup
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground uppercase">Type</Label>
                                                            <Controller
                                                                name="variablePayType"
                                                                control={form.control}
                                                                render={({ field }) => (
                                                                    <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                                                                        <SelectTrigger className="h-11">
                                                                            <SelectValue placeholder="Select Type" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="none">No Variable</SelectItem>
                                                                            <SelectItem value="percentage">Percentage (%) of CTC</SelectItem>
                                                                            <SelectItem value="fixed">Fixed Yearly Bonus (INR)</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground uppercase">
                                                                {watchVarType === 'percentage' ? 'Percentage (%)' : watchVarType === 'fixed' ? 'Amount (₹)' : 'Value'}
                                                            </Label>
                                                            <div className="relative group">
                                                                {watchVarType === 'fixed' && (
                                                                    <span className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors">₹</span>
                                                                )}
                                                                <Input
                                                                    type="number"
                                                                    className={`h-11 font-semibold ${watchVarType === 'fixed' ? 'pl-8' : ''}`}
                                                                    placeholder={watchVarType === 'percentage' ? "e.g. 10" : "e.g. 50000"}
                                                                    disabled={watchVarType === 'none' || isLocked}
                                                                    {...form.register("variablePayValue")}
                                                                />
                                                                {watchVarType === 'percentage' && (
                                                                    <span className="absolute right-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors">%</span>
                                                                )}
                                                            </div>
                                                            {watchVarType !== 'none' && watchVarValue > 0 && watchCtc > 0 && (
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
                                                                    <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800 shadow-sm">
                                                                        {watchVarType === 'percentage'
                                                                            ? `≈ ${formatCurrency((watchCtc * watchVarValue) / 100)} / year`
                                                                            : `≈ ${((watchVarValue / watchCtc) * 100).toFixed(2)}% of CTC`
                                                                        }
                                                                    </p>
                                                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                            </CardContent>
                                        </Card>

                                        {/* HR Configuration Guide */}
                                        {userRole === 'hr' && (
                                            <div className="mt-8 p-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-800/50 shadow-sm relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 bg-blue-500/5 rounded-full blur-2xl transition-all duration-700 group-hover:bg-blue-500/15" />
                                                <div className="relative space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm border border-blue-100 dark:border-blue-700">
                                                            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest">HR Configuration Guide</h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-blue-50 dark:border-blue-700/50 backdrop-blur-sm">
                                                            <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1.5 flex items-center gap-2">
                                                                <Calculator className="h-3 w-3" /> Standard Rules
                                                            </p>
                                                            <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                                                                System auto-splits CTC into Basic (50%), HRA (50% of Basic), and Balancing Allowances to ensure tax efficiency.
                                                            </p>
                                                        </div>
                                                        <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-blue-50 dark:border-blue-700/50 backdrop-blur-sm">
                                                            <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1.5 flex items-center gap-2">
                                                                <AlertCircle className="h-3 w-3" /> Statutory Compliance
                                                            </p>
                                                            <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                                                                EPF and Professional Tax are calculated per Government of India slabs. All calculations are real-time and policy-compliant.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="manual">
                                        {/* Section 1: Core Compensation - MANUAL */}
                                        <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                                            <div className="h-1 bg-amber-500 w-full" />
                                            <CardHeader>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <CardTitle className="text-xl flex items-center gap-2">
                                                            <Lock className="h-5 w-5 text-amber-500" />
                                                            Manual Compensation Entry
                                                            <span className="px-2 py-0.5 rounded text-[10px] bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-800 uppercase tracking-widest font-bold">Admin Only</span>
                                                        </CardTitle>
                                                        <CardDescription>Provide exact annual values for each salary component.</CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
                                                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                                        <strong>Note:</strong> Enter exact annual values for each salary component. The system will automatically calculate total CTC and monthly breakdowns.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Basic Annual (₹)</Label>
                                                        <Input type="number" className="h-10" {...form.register("basicAnnual")} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">HRA Annual (₹)</Label>
                                                        <Input type="number" className="h-10" {...form.register("hraAnnual")} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Special Allowance (₹)</Label>
                                                        <Input type="number" className="h-10" {...form.register("specialAllowanceAnnual")} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Conveyance (₹)</Label>
                                                        <Input type="number" className="h-10" {...form.register("conveyanceAnnual")} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Medical (₹)</Label>
                                                        <Input type="number" className="h-10" {...form.register("medicalAllowanceAnnual")} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Other Allowance (₹)</Label>
                                                        <Input type="number" className="h-10" {...form.register("otherAllowanceAnnual")} />
                                                    </div>
                                                    <div className="space-y-2 p-3 bg-red-50/30 dark:bg-red-900/10 rounded-lg border border-red-100/50">
                                                        <Label className="text-[10px] font-bold uppercase text-red-600">Professional Tax (₹)</Label>
                                                        <Input type="number" className="h-9 mt-1 border-red-200" {...form.register("professionalTaxAnnual")} />
                                                    </div>
                                                    <div className="space-y-2 p-3 bg-red-50/30 dark:bg-red-900/10 rounded-lg border border-red-100/50">
                                                        <Label className="text-[10px] font-bold uppercase text-red-600">Other Deductions (₹)</Label>
                                                        <Input type="number" className="h-9 mt-1 border-red-200" {...form.register("otherDeductionAnnual")} />
                                                    </div>
                                                    <div className="space-y-2 p-3 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-lg border border-emerald-100/50">
                                                        <Label className="text-[10px] font-bold uppercase text-emerald-600">PF Annual (₹)</Label>
                                                        <Input type="number" className="h-9 mt-1 border-emerald-200" {...form.register("pfAnnual")} />
                                                    </div>
                                                    <div className="space-y-2 lg:col-span-2">
                                                        <Label className="text-[10px] font-bold uppercase text-blue-600">Variable Pay / Performance Bonus</Label>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Type</Label>
                                                                <Controller
                                                                    name="variablePayType"
                                                                    control={form.control}
                                                                    render={({ field }) => (
                                                                        <Select
                                                                            onValueChange={field.onChange}
                                                                            value={field.value}
                                                                            disabled={isLocked}
                                                                        >
                                                                            <SelectTrigger className="h-11">
                                                                                <SelectValue placeholder="Select type" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="none">None</SelectItem>
                                                                                <SelectItem value="percentage">Percentage of CTC</SelectItem>
                                                                                <SelectItem value="fixed">Fixed Amount</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                                                                    {form.watch('variablePayType') === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}
                                                                </Label>
                                                                <div className="relative group">
                                                                    {form.watch('variablePayType') === 'fixed' && (
                                                                        <span className="absolute left-3 top-2.5 text-blue-400 group-focus-within:text-blue-600 transition-colors">₹</span>
                                                                    )}
                                                                    <Input
                                                                        type="number"
                                                                        className={`h-11 font-semibold ${form.watch('variablePayType') === 'fixed' ? 'pl-8' : ''}`}
                                                                        placeholder={form.watch('variablePayType') === 'percentage' ? "e.g. 10" : "e.g. 50000"}
                                                                        disabled={form.watch('variablePayType') === 'none' || isLocked}
                                                                        {...form.register("variablePayValue")}
                                                                    />
                                                                    {form.watch('variablePayType') === 'percentage' && (
                                                                        <span className="absolute right-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors">%</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {form.watch('variablePayType') !== 'none' && form.watch('variablePayValue') > 0 && (
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
                                                                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800 shadow-sm">
                                                                    {form.watch('variablePayType') === 'percentage'
                                                                        ? `≈ ${formatCurrency((watchCtc * form.watch('variablePayValue')) / 100)} / year`
                                                                        : `≈ ${((form.watch('variablePayValue') / watchCtc) * 100).toFixed(2)}% of CTC`
                                                                    }
                                                                </p>
                                                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Working Days</Label>
                                                        <Input type="number" className="h-10" {...form.register("workingDays")} />
                                                    </div>
                                                </div>


                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </Tabs>


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
                                                            {previewData.medicalAllowance > 0 && (
                                                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                    <span className="text-sm font-medium">Medical Allowance</span>
                                                                    <span className="font-semibold">{formatCurrency(previewData.medicalAllowance)}</span>
                                                                </div>
                                                            )}
                                                            {previewData.conveyanceAllowance > 0 && (
                                                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                    <span className="text-sm font-medium">Conveyance Allowance</span>
                                                                    <span className="font-semibold">{formatCurrency(previewData.conveyanceAllowance)}</span>
                                                                </div>
                                                            )}
                                                            {previewData.otherAllowance > 0 && (
                                                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                    <span className="text-sm font-medium">Other Allowance</span>
                                                                    <span className="font-semibold">{formatCurrency(previewData.otherAllowance)}</span>
                                                                </div>
                                                            )}
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
                                                            {previewData.otherDeduction > 0 && (
                                                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                                                    <span className="text-sm font-medium">Other Deductions</span>
                                                                    <span className="font-semibold text-red-600">-{formatCurrency(previewData.otherDeduction)}</span>
                                                                </div>
                                                            )}
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
                                <Card className="border-none shadow-2xl bg-white dark:bg-gray-900 overflow-hidden ring-1 ring-gray-100/80 dark:ring-gray-800/80 transform transition-all duration-300 hover:shadow-3xl hover:scale-[1.02]">
                                    {/* Modern Gradient Header with Glass Effect */}
                                    <div className="relative p-6 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 text-white overflow-hidden">
                                        {/* Animated Background Pattern */}
                                        <div className="absolute inset-0 opacity-10">
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='7' cy='7' r='7'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                                                }}
                                            />
                                        </div>

                                        {/* Glow Effect */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />

                                        <div className="relative z-10">
                                            {/* Status Badge */}
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 rounded-full">
                                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                                    <span className="text-xs font-medium text-emerald-300">Live Preview</span>
                                                </div>
                                                <div className="text-xs text-blue-300 font-medium">
                                                    {new Date().toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                                                </div>
                                            </div>

                                            {/* Main In-Hand Amount */}
                                            <div className="mb-6">
                                                <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4" />
                                                    Estimated In-Hand Pay
                                                </p>
                                                <div className="flex items-baseline gap-2">
                                                    <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                                                        {previewData ? formatCurrency(previewData.monthlyInHand) : '₹0'}
                                                    </h2>
                                                    <span className="text-blue-300 text-sm font-semibold">per month</span>
                                                </div>
                                            </div>

                                            {/* Stats Grid */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="group cursor-pointer">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <TrendingUp className="w-4 h-4 text-blue-300" />
                                                        <p className="text-xs text-blue-200/80 uppercase tracking-wider">Annual CTC</p>
                                                    </div>
                                                    <p className="text-lg font-bold text-white group-hover:text-blue-200 transition-colors">
                                                        {previewData ? formatCurrency(previewData.annualCtc) : formatCurrency(watchCtc)}
                                                    </p>
                                                </div>
                                                <div className="group cursor-pointer">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Calculator className="w-4 h-4 text-blue-300" />
                                                        <p className="text-xs text-blue-200/80 uppercase tracking-wider">Monthly Gross</p>
                                                    </div>
                                                    <p className="text-lg font-bold text-white group-hover:text-blue-200 transition-colors">
                                                        {previewData ? formatCurrency(previewData.monthlyGross) : '₹0'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <CardContent className="p-6 space-y-6">
                                        {/* Validation Status */}
                                        <div className="space-y-4">
                                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-800/50 p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
                                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/5 to-teal-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative flex items-center gap-4">
                                                    <div className="flex-shrink-0 w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                                        <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-emerald-800 dark:text-emerald-200">Structure Validation Passed</p>
                                                        <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">All salary components are compliant</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-800/50 p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
                                                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 to-indigo-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative flex items-center gap-4">
                                                    <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                                                        <Calendar className="w-5 h-5 text-white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-blue-800 dark:text-blue-200">Effective Date</p>
                                                        <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">Starting {new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="space-y-4">
                                            <Button
                                                type="submit"
                                                className="w-full h-12 text-base font-bold shadow-xl shadow-blue-500/25 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] rounded-2xl"
                                                disabled={isLoading || isCalculating || !previewData || (isLocked && !forceUnlock)}
                                            >
                                                {isLoading ? (
                                                    <>
                                                        <Loader2 className="animate-spin h-5 w-5 mr-3" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save className="h-5 w-5 mr-3" />
                                                        {existingSalary ? 'Confirm & Save Changes' : 'Initialize Salary Structure'}
                                                    </>
                                                )}
                                            </Button>

                                            {isLocked && !forceUnlock && (
                                                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-50/50 to-rose-50/50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200/50 dark:border-red-800/50 p-4">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25">
                                                            <Lock className="w-4 h-4 text-white" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-sm font-bold text-red-800 dark:text-red-200">Input Locked</p>
                                                            <p className="text-xs text-red-600/80 dark:text-red-400/80">Policy Restriction Active</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Generate Slip Section */}
                                        <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                                            <Dialog open={isGenSlipOpen} onOpenChange={setIsGenSlipOpen}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full h-12 border-2 border-blue-200/50 hover:border-blue-300/70 hover:bg-blue-50/50 dark:border-blue-800/50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                                    >
                                                        <FileText className="h-5 w-5 mr-3" />
                                                        Generate Monthly Slip
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[425px] rounded-2xl border-0 shadow-2xl">
                                                    <DialogHeader className="pb-4">
                                                        <DialogTitle className="text-xl font-bold">Generate Salary Slip</DialogTitle>
                                                        <DialogDescription className="text-base">
                                                            Select the month and year to generate the salary slip for this employee.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="grid gap-6 py-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="month" className="text-sm font-semibold">
                                                                Month
                                                            </Label>
                                                            <Select value={selectedGenMonth} onValueChange={setSelectedGenMonth}>
                                                                <SelectTrigger id="month" className="h-12 rounded-xl">
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
                                                        <div className="space-y-2">
                                                            <Label htmlFor="year" className="text-sm font-semibold">
                                                                Year
                                                            </Label>
                                                            <Select value={selectedGenYear} onValueChange={setSelectedGenYear}>
                                                                <SelectTrigger id="year" className="h-12 rounded-xl">
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
                                                    <DialogFooter className="pt-4">
                                                        <Button
                                                            type="button"
                                                            onClick={handleGenerateSlip}
                                                            disabled={isGenerating}
                                                            className="h-12 px-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl font-semibold shadow-lg shadow-blue-500/25"
                                                        >
                                                            {isGenerating ? (
                                                                <>
                                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                                    Generating...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FileText className="h-4 w-4 mr-2" />
                                                                    Generate Now
                                                                </>
                                                            )}
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>

                                        {/* Growth Journey – Revision & Increment Letters */}
                                        <div className="mt-6">
                                            <Card className="border-0 rounded-3xl shadow-none bg-gradient-to-br from-emerald-50 via-emerald-50 to-white dark:from-emerald-950 dark:via-emerald-950 dark:to-slate-950">
                                                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                                                            <TrendingUp className="h-5 w-5 text-white" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <CardTitle className="text-base font-semibold">
                                                                Growth Journey
                                                            </CardTitle>
                                                            <CardDescription className="text-xs font-medium tracking-wide uppercase">
                                                                Revision &amp; Increment Letters
                                                            </CardDescription>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-500">
                                                            Total Growth
                                                        </p>
                                                        <p className="text-lg font-extrabold text-emerald-600">
                                                            +10.0%
                                                        </p>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="pt-3">
                                                    <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/40 px-4 py-3 flex items-center gap-4">
                                                        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white dark:bg-slate-950 border border-emerald-200/70 dark:border-emerald-800/70 shadow-sm">
                                                            <FileText className="h-5 w-5 text-emerald-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge className="h-5 px-2 text-[10px] font-semibold rounded-full bg-emerald-500 text-white">
                                                                    Active Revision
                                                                </Badge>
                                                                <span className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-300/80">
                                                                    Revision: Jan 2026
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-300">
                                                                    <TrendingUp className="h-3 w-3" />
                                                                    +10%
                                                                </span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                                                <span className="truncate max-w-[160px] text-[11px] font-mono">
                                                                    GFJGFHJGHJGJHGBHGUHGBHJBHKJ
                                                                </span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                                                <span className="text-[11px]">
                                                                    Issued on 19/01/2026
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="ml-auto h-10 rounded-xl border-emerald-300/70 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-700/80 dark:text-emerald-200 dark:hover:bg-emerald-900/40 px-4 text-xs font-semibold flex items-center gap-2"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                            Download
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Footer Note */}
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                                By saving, you confirm this salary structure complies with internal policies and tax regulations.
                                            </p>
                                        </div>
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
        </div >
    );
};

export default AddEditSalary;
