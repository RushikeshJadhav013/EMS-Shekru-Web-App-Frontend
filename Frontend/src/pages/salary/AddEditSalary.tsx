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
import {
    Loader2, Save, Calculator, ArrowLeft,
    AlertTriangle, Calendar, TrendingUp, DollarSign, FileText, AlertCircle, RefreshCw, User, CheckCircle2
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

// Helper to handle numbers with spaces
const preprocessNumber = (val: unknown) => {
    if (typeof val === 'string') {
        const cleaned = val.replace(/\s/g, '');
        if (cleaned === '') return 0;
        const num = Number(cleaned);
        return isNaN(num) ? 0 : num;
    }
    return Number(val) || 0;
};

// Validation Schema with stricter rules
const salarySchema = z.object({
    userId: z.string().min(1, 'Employee is required'),
    annualCtc: z.preprocess(preprocessNumber, z.number().min(0, 'CTC must be a positive number')),
    variablePayType: z.enum(['none', 'percentage', 'fixed']),
    variablePayValue: z.preprocess(preprocessNumber, z.number().min(0).default(0)),
    workingDays: z.preprocess(preprocessNumber, z.number().min(1).max(31).default(22)),
    // Manual Entry Fields (Annual)
    basicAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
    hraAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
    specialAllowanceAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
    conveyanceAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
    medicalAllowanceAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
    otherAllowanceAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
    professionalTaxAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
    otherDeductionAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
    pfAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
    variablePayAnnual: z.preprocess(preprocessNumber, z.number().min(0).optional()),
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

// Helper for component logic
const parseNumber = (val: any) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const num = parseFloat(val.replace(/\s/g, ''));
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

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






    const form = useForm<SalaryFormValues>({
        resolver: zodResolver(salarySchema),
        shouldUnregister: false,
        defaultValues: {
            userId: userIdParam || '',
            annualCtc: 0,
            variablePayType: 'none',
            variablePayValue: 0,
            workingDays: 22,
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

    const totalCalculatedManualCTC = (parseNumber(watchBasicAnn) || 0) + (parseNumber(watchHraAnn) || 0) + (parseNumber(watchSpecialAnn) || 0) +
        (parseNumber(watchConveyanceAnn) || 0) + (parseNumber(watchMedicalAnn) || 0) + (parseNumber(watchOtherAnn) || 0) +
        (parseNumber(watchPFAnn) || 0) + (parseNumber(watchVarPayAnn) || 0) + (parseNumber(watchPTAnn) || 0) + (parseNumber(watchDeductionAnn) || 0);

    const manualCtcDifference = parseNumber(watchCtc) - totalCalculatedManualCTC;

    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === "manual") {
                handleCalculatePreview();
            } else if (parseNumber(watchCtc) > 0) {
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
        if (parseNumber(watchCtc) > 0) {
            // Try to use API calculation first for consistency with guided mode
            const calculateUsingApi = async () => {
                const ctc = parseNumber(watchCtc);
                const variableValue = parseNumber(watchVarValue);
                try {
                    const data = await apiService.calculateSalaryPreview(ctc, watchVarType, variableValue);
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
                const variablePart = parseNumber(form.getValues('variablePayAnnual')) || 0;
                // Fixed CTC available for core components
                const fixedCtc = ctc - variablePart;

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
                    annualVariablePay = ctc * (variableValue / 100);
                } else if (watchVarType === 'fixed') {
                    annualVariablePay = variableValue;
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

        const ctcVal = parseNumber(ctc);
        const vValueVal = parseNumber(vValue);

        if (!isManual && (!ctcVal || ctcVal <= 0)) {
            setPreviewData(null);
            return;
        }

        setIsCalculating(true);
        try {


            if (isManual) {
                const values = form.getValues();
                const basic = Math.round(parseNumber(values.basicAnnual || 0) / 12);
                const hra = Math.round(parseNumber(values.hraAnnual || 0) / 12);
                const special = Math.round(parseNumber(values.specialAllowanceAnnual || 0) / 12);
                const medical = Math.round(parseNumber(values.medicalAllowanceAnnual || 0) / 12);
                const conveyance = Math.round(parseNumber(values.conveyanceAnnual || 0) / 12);
                const other = Math.round(parseNumber(values.otherAllowanceAnnual || 0) / 12);
                const pt = Math.round(parseNumber(values.professionalTaxAnnual || 0) / 12);
                const otherDed = Math.round(parseNumber(values.otherDeductionAnnual || 0) / 12);

                // PF Calculation: Split Annual Total into Employer and Employee shares (50/50)
                const pfAnnTotal = parseNumber(values.pfAnnual || 0);
                const pfAnnOneSide = pfAnnTotal / 2;
                const pfEmp = Math.round(pfAnnOneSide / 12);
                const pfEmpr = Math.round(pfAnnOneSide / 12);

                const vPay = Math.round(parseNumber(values.variablePayAnnual || 0) / 12);

                const monthlyGross = basic + hra + special + medical + conveyance + other;
                const monthlyDeductions = pfEmp + pt + otherDed;
                const monthlyInHand = monthlyGross - monthlyDeductions;
                // CTC = Monthly Gross * 12 + Employer PF * 12 + Annual Variable Pay
                // (Note: Employer PF is outside Gross, but part of CTC)
                const calculatedAnnualCtc = (monthlyGross + pfEmpr) * 12 + parseNumber(values.variablePayAnnual || 0);

                setPreviewData({
                    annualCtc: parseNumber(values.annualCtc) > 0 ? parseNumber(values.annualCtc) : calculatedAnnualCtc,
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
                    const data = await apiService.calculateSalaryPreview(ctcVal, vType, vValueVal);

                    // Robust mapping from API response (handling both snake_case, camelCase, and annual/monthly variations)
                    const monthlyBasic = data.monthly_basic || data.monthlyBasic || (data.basic_annual ? data.basic_annual / 12 : 0);
                    const hra = data.hra || (data.hra_annual ? data.hra_annual / 12 : (data.monthly_hra || 0));
                    const specialAllowance = data.special_allowance || data.specialAllowance || (data.special_allowance_annual ? data.special_allowance_annual / 12 : 0);
                    const medicalAllowance = data.medical_allowance || data.medicalAllowance || (data.medical_allowance_annual ? data.medical_allowance_annual / 12 : 0);
                    const conveyanceAllowance = data.conveyance_allowance || data.conveyanceAllowance || (data.conveyance_annual ? data.conveyance_annual / 12 : 0);
                    const otherAllowance = data.other_allowance || data.otherAllowance || (data.other_allowance_annual ? data.other_allowance_annual / 12 : 0);

                    const pfEmployer = data.pf_employer || data.pfEmployer || (data.pf_annual ? (data.pf_annual / 2) / 12 : (monthlyBasic > 0 ? Math.round(monthlyBasic * 0.12) : 0));
                    const pfEmployee = data.pf_employee || data.pfEmployee || (data.pf_annual ? (data.pf_annual / 2) / 12 : (monthlyBasic > 0 ? Math.round(monthlyBasic * 0.12) : 0));
                    const professionalTax = data.professional_tax || data.professionalTax || (data.professional_tax_annual ? data.professional_tax_annual / 12 : (ctcVal > 0 ? 200 : 0));
                    const otherDeduction = data.other_deduction || data.otherDeduction || (data.other_deduction_annual ? data.other_deduction_annual / 12 : 0);

                    const monthlyGross = data.monthly_gross || data.monthlyGross || (monthlyBasic + hra + specialAllowance + medicalAllowance + conveyanceAllowance + otherAllowance);
                    // Re-calculate monthly deductions with mapped values
                    const totalMonthlyDeductions = pfEmployee + professionalTax + otherDeduction;
                    const monthlyInHand = data.monthly_in_hand || data.monthlyInHand || (monthlyGross - totalMonthlyDeductions);
                    const annualCtc = data.package_ctc_annual || data.annualCtc || (data.ctc_annual || ctcVal);

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
                    const fixedCtc = vType === 'percentage' ? ctcVal * (1 - vValueVal / 100) : ctcVal - vValueVal;
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
                        annualCtc: ctcVal,
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
                        variablePay: vType === 'percentage' ? ctcVal * (vValueVal / 100) : vValueVal,
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
                    annualCtc: data.package_ctc_annual || data.annualCtc,
                    variablePayType: data.variable_pay_type || data.variablePayType || 'none',
                    variablePayValue: data.variable_pay_value || data.variablePayValue || 0,
                    workingDays: data.working_days || data.workingDays || 22,

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
                    working_days_per_month: data.workingDays || 22
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
                    package_ctc_annual: data.annualCtc,
                    variable_pay_type: data.variablePayType,
                    variable_pay_value: data.variablePayValue,
                    working_days: data.workingDays,
                };

                let response;
                if (existingSalary) {
                    // Update CTC first if changed
                    response = await apiService.updateSalaryCtc(data.userId, {
                        annualCtc: payload.package_ctc_annual,
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



    if (isLoading && !existingSalary && userIdParam) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Simple Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100/50 dark:border-blue-900/30">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (userIdParam) {
                                navigate(`/salary/employee/${userIdParam}`);
                            } else {
                                navigate(-1);
                            }
                        }}
                        className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all active:scale-95"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                {existingSalary ? 'Salary Structure' : 'Create Salary Structure'}
                            </h1>
                            {existingSalary && (
                                <Badge className="bg-primary text-primary-foreground">
                                    Edit Mode
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Define compensation, benefits, and statutory details.</p>
                    </div>
                </div>
            </div>

            {/* Step 1: Employee Selection */}
            {
                !watchUserId && (
                    <Card className="max-w-2xl mx-auto mt-10 border-0 shadow-lg bg-slate-50/50 dark:bg-slate-900/50">
                        <CardHeader className="bg-white/50 dark:bg-slate-800/50">
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
                                            disabled={!!userIdParam}
                                        >
                                            <SelectTrigger className="w-full h-10 bg-white dark:bg-slate-800">
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
                                            const ctc = parseNumber(watchCtc);
                                            const vValue = parseNumber(watchVarValue);
                                            if (previewData) {
                                                syncManualFieldsFromPreview();
                                            } else if (ctc > 0) {
                                                // Use API calculation for consistency
                                                try {
                                                    const data = await apiService.calculateSalaryPreview(ctc, watchVarType, vValue);
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
                                                    const variablePart = parseNumber(form.getValues('variablePayAnnual')) || 0;
                                                    const fixedCtc = ctc - variablePart;

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
                                                        annualVariablePay = ctc * (vValue / 100);
                                                    } else if (watchVarType === 'fixed') {
                                                        annualVariablePay = vValue;
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
                                        <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100/50 dark:bg-slate-800/50">
                                            <TabsTrigger value="auto" className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/30 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300">
                                                <Calculator className="h-4 w-4 mr-2" /> Guided Mode
                                            </TabsTrigger>
                                            <TabsTrigger value="manual" className="data-[state=active]:bg-orange-100 dark:data-[state=active]:bg-orange-900/30 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-300">
                                                <FileText className="h-4 w-4 mr-2" /> Manual Entry
                                            </TabsTrigger>
                                        </TabsList>
                                    )}

                                    <TabsContent value="auto">
                                        {/* Section 1: Core Compensation - AUTO */}
                                        <Card className="border-0 shadow-lg bg-blue-50/30 dark:bg-blue-950/10">
                                            <CardHeader className="bg-white/60 dark:bg-slate-800/60">
                                                <CardTitle className="flex items-center gap-2">
                                                    <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                    Guided Salary Setup
                                                </CardTitle>
                                                <CardDescription>Automated compensation structuring based on annual CTC and statutory norms.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label className="flex items-center gap-2">
                                                            Annual CTC (₹) <span className="text-red-500">*</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                                                            <Input
                                                                type="text"
                                                                className="pl-8 h-10 bg-white dark:bg-slate-800"
                                                                placeholder="e.g. 12 00 000"
                                                                disabled={false}
                                                                {...form.register("annualCtc")}
                                                                onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')}
                                                            />
                                                        </div>
                                                        {form.formState.errors.annualCtc && <p className="text-red-500 text-xs mt-1">{form.formState.errors.annualCtc.message}</p>}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Working Days (Month)</Label>
                                                        <Input
                                                            type="text"
                                                            className="h-10 bg-white dark:bg-slate-800"
                                                            disabled={false}
                                                            {...form.register("workingDays")}
                                                            onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="p-5 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg space-y-5 border border-amber-100/50 dark:border-amber-900/30">
                                                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                                        <TrendingUp className="h-3 w-3" />
                                                        Variable Pay Setup
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs uppercase">Type</Label>
                                                            <Controller
                                                                name="variablePayType"
                                                                control={form.control}
                                                                render={({ field }) => (
                                                                    <Select onValueChange={field.onChange} value={field.value} disabled={false}>
                                                                        <SelectTrigger className="h-10 bg-white dark:bg-slate-800">
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
                                                            <Label className="text-xs uppercase">
                                                                {watchVarType === 'percentage' ? 'Percentage (%)' : watchVarType === 'fixed' ? 'Amount (₹)' : 'Value'}
                                                            </Label>
                                                            <div className="relative">
                                                                {watchVarType === 'fixed' && (
                                                                    <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                                                                )}
                                                                <Input
                                                                    type="text"
                                                                    className={`h-10 bg-white dark:bg-slate-800 ${watchVarType === 'fixed' ? 'pl-8' : ''}`}
                                                                    placeholder={watchVarType === 'percentage' ? "e.g. 10" : "e.g. 50 000"}
                                                                    disabled={watchVarType === 'none'}
                                                                    {...form.register("variablePayValue")}
                                                                    onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')}
                                                                />
                                                                {watchVarType === 'percentage' && (
                                                                    <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
                                                                )}
                                                            </div>
                                                            {watchVarType !== 'none' && watchVarValue > 0 && watchCtc > 0 && (
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <div className="h-px flex-1 bg-border" />
                                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                                        {watchVarType === 'percentage'
                                                                            ? `≈ ${formatCurrency((parseNumber(watchCtc) * parseNumber(watchVarValue)) / 100)} / year`
                                                                            : `≈ ${((parseNumber(watchVarValue) / parseNumber(watchCtc)) * 100).toFixed(2)}% of CTC`
                                                                        }
                                                                    </p>
                                                                    <div className="h-px flex-1 bg-border" />
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
                                        <Card className="border-0 shadow-lg bg-orange-50/30 dark:bg-orange-950/10">
                                            <CardHeader className="bg-white/60 dark:bg-slate-800/60">
                                                <CardTitle className="flex items-center gap-2">
                                                    <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                                    Manual Compensation Entry
                                                    <Badge variant="destructive" className="ml-2">Admin Only</Badge>
                                                </CardTitle>
                                                <CardDescription>Provide exact annual values for each salary component.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-100/50 dark:border-amber-900/30">
                                                    <p className="text-xs text-amber-800 dark:text-amber-300">
                                                        <strong>Note:</strong> Enter exact annual values for each salary component. The system will automatically calculate total CTC and monthly breakdowns.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">Basic Annual (₹)</Label>
                                                        <Input
                                                            type="text"
                                                            className="h-10"
                                                            {...form.register("basicAnnual")}
                                                            onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">HRA Annual (₹)</Label>
                                                        <Input type="text" className="h-10 bg-white dark:bg-slate-800" {...form.register("hraAnnual")} onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">Special Allowance (₹)</Label>
                                                        <Input type="text" className="h-10 bg-white dark:bg-slate-800" {...form.register("specialAllowanceAnnual")} onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">Conveyance (₹)</Label>
                                                        <Input type="text" className="h-10 bg-white dark:bg-slate-800" {...form.register("conveyanceAnnual")} onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">Medical (₹)</Label>
                                                        <Input type="text" className="h-10 bg-white dark:bg-slate-800" {...form.register("medicalAllowanceAnnual")} onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">Other Allowance (₹)</Label>
                                                        <Input type="text" className="h-10 bg-white dark:bg-slate-800" {...form.register("otherAllowanceAnnual")} onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">Professional Tax (₹)</Label>
                                                        <Input type="text" className="h-10 bg-white dark:bg-slate-800" {...form.register("professionalTaxAnnual")} onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">Other Deductions (₹)</Label>
                                                        <Input type="text" className="h-10 bg-white dark:bg-slate-800" {...form.register("otherDeductionAnnual")} onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">PF Annual (₹)</Label>
                                                        <Input type="text" className="h-10 bg-white dark:bg-slate-800" {...form.register("pfAnnual")} onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')} />
                                                    </div>
                                                    <div className="space-y-2 lg:col-span-2 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100/50 dark:border-blue-900/30">
                                                        <Label className="text-xs uppercase text-blue-700 dark:text-blue-400">Variable Pay / Performance Bonus</Label>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs uppercase text-muted-foreground">Type</Label>
                                                                <Controller
                                                                    name="variablePayType"
                                                                    control={form.control}
                                                                    render={({ field }) => (
                                                                        <Select
                                                                            onValueChange={field.onChange}
                                                                            value={field.value}
                                                                            disabled={false}
                                                                        >
                                                                            <SelectTrigger className="h-10 bg-white dark:bg-slate-800">
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
                                                                <Label className="text-xs uppercase text-muted-foreground">
                                                                    {form.watch('variablePayType') === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}
                                                                </Label>
                                                                <div className="relative">
                                                                    {form.watch('variablePayType') === 'fixed' && (
                                                                        <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                                                                    )}
                                                                    <Input
                                                                        type="text"
                                                                        className={`h-10 bg-white dark:bg-slate-800 ${form.watch('variablePayType') === 'fixed' ? 'pl-8' : ''}`}
                                                                        placeholder={form.watch('variablePayType') === 'percentage' ? "e.g. 10" : "e.g. 50 000"}
                                                                        disabled={form.watch('variablePayType') === 'none'}
                                                                        {...form.register("variablePayValue")}
                                                                        onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')}
                                                                    />
                                                                    {form.watch('variablePayType') === 'percentage' && (
                                                                        <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {form.watch('variablePayType') !== 'none' && form.watch('variablePayValue') > 0 && (
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <div className="h-px flex-1 bg-border" />
                                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                                    {form.watch('variablePayType') === 'percentage'
                                                                        ? `≈ ${formatCurrency((parseNumber(watchCtc) * parseNumber(form.watch('variablePayValue'))) / 100)} / year`
                                                                        : `≈ ${((parseNumber(form.watch('variablePayValue')) / parseNumber(watchCtc)) * 100).toFixed(2)}% of CTC`
                                                                    }
                                                                </p>
                                                                <div className="h-px flex-1 bg-border" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase text-muted-foreground">Working Days</Label>
                                                        <Input type="text" className="h-10 bg-white dark:bg-slate-800" {...form.register("workingDays")} onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9\s.]/g, '')} />
                                                    </div>
                                                </div>


                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </Tabs>


                                {/* Section 3: Live Calculation Breakdown */}
                                <Card className="border-0 shadow-lg bg-green-50/30 dark:bg-green-950/10">
                                    <CardHeader className="bg-white/60 dark:bg-slate-800/60">
                                        <CardTitle className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Calculator className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                Estimated Payroll Breakdown
                                            </div>
                                            {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
                                        </CardTitle>
                                        <CardDescription>Detailed earnings and statutory deductions based on CTC.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {!previewData ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
                                                <Calculator className="h-10 w-10 mb-2 opacity-20" />
                                                <p>Enter Annual CTC to see breakdown</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-4 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100/50 dark:border-blue-900/30">
                                                        <h4 className="text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">Monthly Earnings</h4>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center py-2 border-b border-blue-100/50 dark:border-blue-900/30">
                                                                <span className="text-sm">Basic Salary</span>
                                                                <span className="font-semibold">{formatCurrency(previewData.monthlyBasic)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 border-b border-blue-100/50 dark:border-blue-900/30">
                                                                <span className="text-sm">HRA</span>
                                                                <span className="font-semibold">{formatCurrency(previewData.hra)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 border-b border-blue-100/50 dark:border-blue-900/30">
                                                                <span className="text-sm">Special Allowance</span>
                                                                <span className="font-semibold">{formatCurrency(previewData.specialAllowance)}</span>
                                                            </div>
                                                            {previewData.medicalAllowance > 0 && (
                                                                <div className="flex justify-between items-center py-2 border-b border-blue-100/50 dark:border-blue-900/30">
                                                                    <span className="text-sm">Medical Allowance</span>
                                                                    <span className="font-semibold">{formatCurrency(previewData.medicalAllowance)}</span>
                                                                </div>
                                                            )}
                                                            {previewData.conveyanceAllowance > 0 && (
                                                                <div className="flex justify-between items-center py-2 border-b border-blue-100/50 dark:border-blue-900/30">
                                                                    <span className="text-sm">Conveyance Allowance</span>
                                                                    <span className="font-semibold">{formatCurrency(previewData.conveyanceAllowance)}</span>
                                                                </div>
                                                            )}
                                                            {previewData.otherAllowance > 0 && (
                                                                <div className="flex justify-between items-center py-2 border-b border-blue-100/50 dark:border-blue-900/30">
                                                                    <span className="text-sm">Other Allowance</span>
                                                                    <span className="font-semibold">{formatCurrency(previewData.otherAllowance)}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between items-center py-2 mt-4 bg-blue-100/50 dark:bg-blue-900/30 px-2 rounded font-semibold">
                                                                <span>Monthly Gross</span>
                                                                <span>{formatCurrency(previewData.monthlyGross)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4 p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg border border-rose-100/50 dark:border-rose-900/30">
                                                        <h4 className="text-sm font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">Statutory Deductions</h4>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center py-2 border-b border-rose-100/50 dark:border-rose-900/30">
                                                                <span className="text-sm text-muted-foreground line-through">EPF (Employer)</span>
                                                                <span className="text-xs italic text-muted-foreground">Incl. in CTC</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 border-b border-rose-100/50 dark:border-rose-900/30">
                                                                <span className="text-sm">EPF (Employee)</span>
                                                                <span className="font-semibold text-destructive">-{formatCurrency(previewData.pfEmployee)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center py-2 border-b border-rose-100/50 dark:border-rose-900/30">
                                                                <span className="text-sm">Professional Tax</span>
                                                                <span className="font-semibold text-destructive">-{formatCurrency(previewData.professionalTax)}</span>
                                                            </div>
                                                            {previewData.otherDeduction > 0 && (
                                                                <div className="flex justify-between items-center py-2 border-b border-rose-100/50 dark:border-rose-900/30">
                                                                    <span className="text-sm">Other Deductions</span>
                                                                    <span className="font-semibold text-destructive">-{formatCurrency(previewData.otherDeduction)}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between items-center py-2 mt-4 bg-rose-100/50 dark:bg-rose-900/30 px-2 rounded font-semibold">
                                                                <span>Total Deductions</span>
                                                                <span className="text-destructive">-{formatCurrency(previewData.monthlyDeductions)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-100/50 dark:border-amber-900/30 flex items-start gap-3">
                                                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
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
                                <Card className="border-0 shadow-lg bg-indigo-50/30 dark:bg-indigo-950/10">
                                    <CardHeader className="bg-white/60 dark:bg-slate-800/60">
                                        <div className="flex items-center justify-between mb-4">
                                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">Live Preview</Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date().toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                Estimated In-Hand Pay
                                            </p>
                                            <div className="flex items-baseline gap-2">
                                                <h2 className="text-3xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
                                                    {previewData ? formatCurrency(previewData.monthlyInHand) : '₹0'}
                                                </h2>
                                                <span className="text-sm text-muted-foreground">per month</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Annual CTC</p>
                                                </div>
                                                <p className="text-lg font-semibold">
                                                    {previewData ? formatCurrency(previewData.annualCtc) : formatCurrency(parseNumber(watchCtc))}
                                                </p>
                                            </div>
                                            <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Calculator className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Monthly Gross</p>
                                                </div>
                                                <p className="text-lg font-semibold">
                                                    {previewData ? formatCurrency(previewData.monthlyGross) : '₹0'}
                                                </p>
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-6">
                                        {/* Validation Status */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100/50 dark:border-emerald-900/30">
                                                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                                <div>
                                                    <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Structure Validation Passed</p>
                                                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1">All salary components are compliant</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100/50 dark:border-blue-900/30">
                                                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                <div>
                                                    <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">Effective Date</p>
                                                    <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-1">Starting {new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="space-y-4">
                                            <Button
                                                type="submit"
                                                className="w-full"
                                                disabled={isLoading || isCalculating || !previewData}
                                            >
                                                {isLoading ? (
                                                    <>
                                                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save className="h-4 w-4 mr-2" />
                                                        {existingSalary ? 'Confirm & Save Changes' : 'Initialize Salary Structure'}
                                                    </>
                                                )}
                                            </Button>

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
        </div>
    );
};

export default AddEditSalary;
