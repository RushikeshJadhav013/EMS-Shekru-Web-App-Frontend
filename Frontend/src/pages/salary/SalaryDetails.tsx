import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { SalaryStructure, Increment } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Download,
    Send,
    Plus,
    History,
    FileText,
    CreditCard,
    Briefcase,
    Calendar,
    CalendarDays,
    Clock,
    DollarSign,
    TrendingUp,
    AlertCircle,
    Edit,
    Eye as EyeIcon,
    EyeOff as EyeSlashIcon,
    Loader2,
    Save,
    LayoutGrid,
    CheckCircle2,
    Ban
} from 'lucide-react';
import SummaryCard from "@/components/ui/SummaryCard";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface SalaryDetailsProps {
    userId?: string;
}

interface SalarySlipHistoryItem {
    id: string | number;
    user_id: string | number;
    month: number;
    year: number;
    gross_salary: number;
    net_salary: number;
    email_sent: boolean;
    email_sent_at?: string;
    generated_at: string;
    file_path?: string;
}

const SalaryDetails: React.FC<SalaryDetailsProps> = ({ userId: propUserId }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { toast } = useToast();

    // Use prop if available, otherwise param, otherwise current user (fallback)
    const targetUserId = propUserId || id || user?.id;

    const [salaryData, setSalaryData] = useState<SalaryStructure | null>(null);
    const [increments, setIncrements] = useState<Increment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSalarySlipSending, setIsSalarySlipSending] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [showIncrementForm, setShowIncrementForm] = useState(false);
    const [isCreatingIncrement, setIsCreatingIncrement] = useState(false);
    const [salarySlipHistory, setSalarySlipHistory] = useState<SalarySlipHistoryItem[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isOfferLetterDialogOpen, setIsOfferLetterDialogOpen] = useState(false);
    const [offerLetterForm, setOfferLetterForm] = useState({
        letter_date: '',
        joining_date: '',
    });
    const [isDownloadingOfferLetter, setIsDownloadingOfferLetter] = useState(false);
    const [selectedIncrementDetail, setSelectedIncrementDetail] = useState<Increment | null>(null);
    const [isViewingIncrement, setIsViewingIncrement] = useState(false);
    const [isLoadingIncrementDetail, setIsLoadingIncrementDetail] = useState(false);
    const [isVerified, setIsVerified] = useState<boolean | null>(null);

    const userRole = user?.role?.toLowerCase();
    // HR viewing their own salary should behave like a regular employee/manager (no HR admin controls)
    const isSelf = String(targetUserId) === String(user?.id);
    const isAdminOrHr = userRole === 'admin' || (userRole === 'hr' && !isSelf);
    const isOwner = isSelf;
    const canViewAll = isAdminOrHr;

    const canEdit = userRole === 'admin' || (userRole === 'hr' && !isSelf);

    const [showSensitive, setShowSensitive] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [isAnnexureSending, setIsAnnexureSending] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const [isGenerateSlipDialogOpen, setIsGenerateSlipDialogOpen] = useState(false);
    const [generateSlipForm, setGenerateSlipForm] = useState({
        optional_deduction_1_label: '',
        optional_deduction_1_amount: '',
        optional_deduction_2_label: '',
        optional_deduction_2_amount: '',
        optional_deduction_3_label: '',
        optional_deduction_3_amount: '',
        manual_leave_days: '',
    });

    // Pagination states
    const [growthPage, setGrowthPage] = useState(1);
    const growthPerPage = 5;
    const [archivePage, setArchivePage] = useState(1);
    const archivePerPage = 10;

    const sortedIncrements = React.useMemo(() => {
        return [...increments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [increments]);

    const uniqueArchiveSlips = React.useMemo(() => {
        return Array.from(
            salarySlipHistory
                .filter(slip => selectedMonth === "all" || slip.month.toString() === selectedMonth)
                .reduce((acc, slip) => {
                    const key = `${slip.year}-${slip.month}`;
                    if (!acc.has(key) || new Date(slip.generated_at).getTime() > new Date(acc.get(key)!.generated_at).getTime()) {
                        acc.set(key, slip);
                    }
                    return acc;
                }, new Map<string, SalarySlipHistoryItem>()).values()
        ).sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            return b.month - a.month;
        });
    }, [salarySlipHistory, selectedMonth]);

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Increment form schema
    const incrementSchema = z.object({
        incrementAmount: z.number().min(0, 'Amount must be positive'),
        incrementPercentage: z.number().min(0, 'Percentage must be positive'),
        newCtc: z.number().min(1, 'New CTC must be valid'),
        variablePayType: z.enum(['none', 'percentage', 'fixed']),
        variablePayValue: z.number().min(0).default(0),
        effectiveDate: z.string().min(1, 'Date is required'),
        reason: z.string().min(3, 'Reason is required'),
    });

    type IncrementFormValues = z.infer<typeof incrementSchema>;

    const incrementForm = useForm<IncrementFormValues>({
        resolver: zodResolver(incrementSchema),
        defaultValues: {
            incrementAmount: 0,
            incrementPercentage: 0,
            newCtc: 0,
            variablePayType: 'none',
            variablePayValue: 0,
            effectiveDate: new Date().toISOString().split('T')[0],
            reason: '',
        }
    });

    // Reset form when salary data loads or form opens
    useEffect(() => {
        if (salaryData) {
            incrementForm.reset({
                incrementAmount: 0,
                incrementPercentage: 0,
                newCtc: salaryData.annualCtc || 0,
                variablePayType: salaryData.variablePayType || 'none',
                variablePayValue: salaryData.variablePayValue || 0,
                effectiveDate: new Date().toISOString().split('T')[0],
                reason: '',
            });
        }
    }, [salaryData, showIncrementForm]);

    // Auto-calculate increment logic
    const watchAmount = incrementForm.watch('incrementAmount');
    const watchPercent = incrementForm.watch('incrementPercentage');
    const watchNewCtc = incrementForm.watch('newCtc');
    const currentCtc = salaryData?.annualCtc || 0;

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value) || 0;
        incrementForm.setValue('incrementAmount', val);
        if (currentCtc > 0) {
            const pct = parseFloat(((val / currentCtc) * 100).toFixed(2));
            incrementForm.setValue('incrementPercentage', pct);
            incrementForm.setValue('newCtc', currentCtc + val);
        }
    };

    const handlePercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value) || 0;
        incrementForm.setValue('incrementPercentage', val);
        if (currentCtc > 0) {
            const amt = Math.round((currentCtc * val) / 100);
            incrementForm.setValue('incrementAmount', amt);
            incrementForm.setValue('newCtc', currentCtc + amt);
        }
    };

    const handleNewCtcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value) || 0;
        incrementForm.setValue('newCtc', val);
        if (currentCtc > 0) {
            const diff = val - currentCtc;
            incrementForm.setValue('incrementAmount', diff);
            const pct = parseFloat(((diff / currentCtc) * 100).toFixed(2));
            incrementForm.setValue('incrementPercentage', pct);
        }
    };

    const handleCreateIncrement = async (data: IncrementFormValues) => {
        if (!targetUserId || !salaryData) {
            toast({ title: "Error", description: "Incomplete data to process increment.", variant: "destructive" });
            return;
        }

        try {
            setIsCreatingIncrement(true);

            // 1. Create increment record (Admin/HR Only)
            const response = await apiService.createIncrement({
                userId: targetUserId,
                previousSalary: currentCtc,
                incrementAmount: data.incrementAmount,
                incrementPercentage: data.incrementPercentage,
                newSalary: data.newCtc,
                effectiveDate: data.effectiveDate,
                reason: data.reason
            });

            if (response) {
                // 2. Update the main salary structure CTC
                try {
                    await apiService.updateSalaryCtc(targetUserId, {
                        annualCtc: data.newCtc,
                        variablePayType: data.variablePayType,
                        variablePayValue: data.variablePayValue
                    });
                } catch (updateError) {
                    console.error("Increment created but CTC update failed:", updateError);
                    // We don't throw here as the increment record is already created
                    toast({
                        title: "Notice",
                        description: "Increment recorded, but primary CTC update failed. Please update manually.",
                        variant: "warning"
                    });
                }

                // Reload increments data
                loadIncrements();

                // Reload salary details to update stat cards
                loadSalaryDetails();

                // Reset form and close
                incrementForm.reset();
                setShowIncrementForm(false);
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to create increment.", variant: "destructive" });
        } finally {
            setIsCreatingIncrement(false);
        }
    };
    const [activeTab, setActiveTab] = useState(canViewAll ? "breakdown" : "documents");
    const [isBankEditDialogOpen, setIsBankEditDialogOpen] = useState(false);
    const [isUpdatingBank, setIsUpdatingBank] = useState(false);
    const [bankForm, setBankForm] = useState<any>({
        uan_number: '',
        bank_name: '',
        bank_account: '',
        ifsc_code: '',
        working_days_per_month: '',
        payment_mode: 'Bank Transfer',
        pf_no: '',
    });



    const loadSalaryDetails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            if (!targetUserId || targetUserId === 'undefined') {
                setError('No valid user ID provided');
                setLoading(false);
                return;
            }

            const data = await apiService.getSalaryDetails(targetUserId);

            if (!data) {
                setSalaryData(null);
                setError('No salary record found for this employee');
                setLoading(false);
                return;
            }

            // The API now returns properly mapped data, so we can use it directly
            // Just ensure we have all required fields with fallbacks
            const mappedSalary: SalaryStructure = {
                id: data.id || `sal_${targetUserId}`,
                userId: String(data.userId || targetUserId),
                annualCtc: data.annualCtc || 0,
                variablePayType: data.variablePayType || 'none',
                variablePayValue: data.variablePayValue || 0,
                paymentMode: data.paymentMode || 'bank_transfer',
                bankName: data.bankName || '',
                accountNumber: data.accountNumber || '',
                ifscCode: data.ifscCode || '',
                panNumber: data.panNumber || '',
                uanNumber: data.uanNumber || '',
                pfNumber: data.pfNumber || data.pf_no || '',
                workingDays: data.workingDays || 26,

                // Monthly components (already calculated by API)
                monthlyBasic: data.monthlyBasic || 0,
                hra: data.hra || 0,
                specialAllowance: data.specialAllowance || 0,
                medicalAllowance: data.medicalAllowance || 0,
                conveyanceAllowance: data.conveyanceAllowance || 0,
                otherAllowance: data.otherAllowance || 0,
                pfEmployee: data.pfEmployee || 0,
                pfEmployer: data.pfEmployer || 0,
                professionalTax: data.professionalTax || 0,
                otherDeduction: data.otherDeduction || 0,
                variablePay: data.variablePay || data.variable_pay || 0,

                // Totals
                monthlyGross: data.monthlyGross || 0,
                monthlyDeductions: data.monthlyDeductions || 0,
                monthlyInHand: data.monthlyInHand || 0,

                effectiveDate: data.effectiveDate || data.createdAt || '',
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || '',

                is_active: data.is_active !== undefined ? data.is_active : true
            };

            // Always recalculate totals to ensure they match current CTC
            const currentAnnualCtc = data.ctc_annual || data.annualCtc || 0;

            if (currentAnnualCtc > 0) {
                // Recalculate monthly components proportionally if they seem outdated
                const expectedMonthlyBasic = (data.basic_annual || 0) / 12 || data.monthlyBasic || 0;
                const expectedMonthlyHra = (data.hra_annual || 0) / 12 || data.hra || 0;
                const expectedMonthlyMedical = (data.medical_allowance_annual || 0) / 12 || data.medicalAllowance || 0;
                const expectedMonthlyConveyance = (data.conveyance_annual || 0) / 12 || data.conveyanceAllowance || 0;
                const expectedMonthlyOtherAllowance = (data.other_allowance_annual || 0) / 12 || data.otherAllowance || 0;

                // PF Calculation Fallback: use pf_annual if available, otherwise calculate 12% of basic
                const annualPfTotal = data.pf_annual || (expectedMonthlyBasic * 0.12 * 2 * 12);
                const expectedMonthlyPfEmployer = annualPfTotal / 24;
                const expectedMonthlyPfEmployee = annualPfTotal / 24;

                // Professional Tax: 200 for 11 months, 300 for February (Total 2500)
                let expectedMonthlyPt = 200;
                const currentMonth = selectedMonth === "all" ? (new Date().getMonth() + 1).toString() : selectedMonth;
                if (currentMonth === "2") {
                    expectedMonthlyPt = 300;
                }

                const expectedMonthlyOtherDed = (data.other_deduction_annual || 0) / 12 || data.otherDeduction || 0;

                // Update monthly values if they don't match expected calculations
                data.monthlyBasic = expectedMonthlyBasic;
                data.hra = expectedMonthlyHra;
                data.medicalAllowance = expectedMonthlyMedical;
                data.conveyanceAllowance = expectedMonthlyConveyance;
                data.otherAllowance = expectedMonthlyOtherAllowance;
                data.pfEmployer = expectedMonthlyPfEmployer;
                data.pfEmployee = expectedMonthlyPfEmployee;
                data.professionalTax = expectedMonthlyPt;
                data.otherDeduction = expectedMonthlyOtherDed;

                // Recalculate special allowance as the balancing component
                const monthlyFixedCtc = currentAnnualCtc / 12 - (data.variable_pay || 0) / 12;
                const knownComponents = data.monthlyBasic + data.hra + (data.medicalAllowance || 0) +
                    (data.conveyanceAllowance || 0) + (data.otherAllowance || 0) + data.pfEmployer;

                // Use the stored special allowance if available, otherwise balance it
                const storedMonthlySpecial = (data.special_allowance_annual || 0) / 12 || data.specialAllowance;
                data.specialAllowance = storedMonthlySpecial > 0 ? storedMonthlySpecial : Math.max(0, monthlyFixedCtc - knownComponents);

                // Recalculate totals
                data.monthlyGross = data.monthlyBasic + data.hra + data.specialAllowance +
                    (data.medicalAllowance || 0) + (data.conveyanceAllowance || 0) + (data.otherAllowance || 0);
                data.monthlyDeductions = data.professionalTax + data.pfEmployee + data.otherDeduction;
                data.monthlyInHand = data.monthlyGross - data.monthlyDeductions;

                // Update CTC values
                data.annualCtc = currentAnnualCtc;
                data.ctc_annual = currentAnnualCtc;
                data.monthly_ctc = currentAnnualCtc / 12;

                // Sync mappedSalary with recalculated values
                mappedSalary.annualCtc = data.annualCtc;
                mappedSalary.monthlyBasic = data.monthlyBasic;
                mappedSalary.hra = data.hra;
                mappedSalary.specialAllowance = data.specialAllowance;
                mappedSalary.pfEmployer = data.pfEmployer;
                mappedSalary.pfEmployee = data.pfEmployee;
                mappedSalary.professionalTax = data.professionalTax;
                mappedSalary.otherDeduction = data.otherDeduction;
                mappedSalary.monthlyGross = data.monthlyGross;
                mappedSalary.monthlyDeductions = data.monthlyDeductions;
                mappedSalary.monthlyInHand = data.monthlyInHand;
            } else {
                // Fallback to original calculation logic if no CTC
                if (data.monthlyGross === 0) {
                    data.monthlyGross = data.monthlyBasic + data.hra + data.specialAllowance +
                        data.medicalAllowance + data.conveyanceAllowance + data.otherAllowance;
                }
            }

            const userData = await apiService.getEmployeeWithPAN(targetUserId);
            if (userData && userData.name) {
                setUserName(userData.name);
                setUserEmail(userData.email);
                console.log('User details loaded:', { name: userData.name, email: userData.email, pan: userData.pan_card });
            }

            setSalaryData(mappedSalary);
        } catch (err: any) {
            console.error("Error loading salary details", err);
            if (err.message?.includes('404') || err.message?.includes('not found')) {
                setError('No salary record found for this employee');
            } else if (err.message?.includes('401') || err.message?.includes('403')) {
                setError('You do not have permission to view this salary information');
            } else if (err.message?.includes('NetworkError') || err.message?.includes('fetch')) {
                setError('Unable to connect to the server. Please check your internet connection.');
            } else {
                setError(err.message || 'Failed to load salary details. Please try again.');
            }
            setSalaryData(null);
        } finally {
            setLoading(false);
        }
    }, [targetUserId, selectedMonth]);

    const loadUserDetails = useCallback(async () => {
        try {
            if (!targetUserId || targetUserId === 'undefined') {
                return;
            }
            const userData = await apiService.getEmployeeWithPAN(targetUserId);
            if (userData && userData.name) {
                setUserName(userData.name);
                setUserEmail(userData.email);
                setIsVerified(userData.is_verified || false);
                console.log('User details loaded:', { name: userData.name, email: userData.email, pan: userData.pan_card, verified: userData.is_verified });
            }
        } catch (err: any) {
            console.error("Failed to load user details", err);
            // Don't set error for user name loading failure as it's not critical
        }
    }, [targetUserId]);

    const loadIncrements = useCallback(async () => {
        try {
            const data = await apiService.getIncrements(targetUserId!);
            setIncrements(data || []);
        } catch (error) {
            console.error("Failed to load increments", error);
            toast({
                title: "Error",
                description: "Failed to load increment history.",
                variant: "destructive"
            });
            setIncrements([]);
        }
    }, [targetUserId, toast]);

    const loadSalarySlipHistory = useCallback(async () => {
        try {
            setIsLoadingHistory(true);
            const data = await apiService.getSalarySlipHistory(targetUserId!, selectedYear);
            setSalarySlipHistory(data?.history || []);
        } catch (error) {
            console.error('Failed to load salary slip history:', error);
            toast({
                title: 'Error',
                description: 'Failed to load salary slip history.',
                variant: 'destructive'
            });
            setSalarySlipHistory([]);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [targetUserId, selectedYear, toast]);

    // Load salary slip history when year changes
    useEffect(() => {
        if (targetUserId) {
            loadSalarySlipHistory();
        }
    }, [selectedYear, targetUserId, loadSalarySlipHistory]);

    // Refresh data when user navigates back from edit page
    useEffect(() => {
        if (targetUserId && location.key) {
            // Check if we have a location.key (indicates navigation)
            // This helps refresh data when user comes back from edit page
            const refreshTimer = setTimeout(() => {
                loadSalaryDetails();
                if (isAdminOrHr || isOwner) {
                    loadIncrements();
                }
            }, 100); // Small delay to ensure backend has processed updates

            return () => clearTimeout(refreshTimer);
        }
    }, [location.key, targetUserId, loadSalaryDetails, loadIncrements, isAdminOrHr, isOwner]);

    useEffect(() => {
        if (targetUserId) {
            loadSalaryDetails();
            loadUserDetails();
            loadSalarySlipHistory();
            if (isAdminOrHr || isOwner) {
                loadIncrements();
            }
        }
    }, [targetUserId, selectedMonth, loadSalaryDetails, loadUserDetails, loadSalarySlipHistory, loadIncrements, isAdminOrHr, isOwner]);


    const openBankEditDialog = () => {
        if (salaryData) {
            // Map payment mode to Title Case for the select input
            let mode = 'Bank Transfer';
            if (salaryData.paymentMode) {
                const lower = salaryData.paymentMode.toLowerCase();
                if (lower.includes('cash')) mode = 'Cash';
                else if (lower.includes('cheque')) mode = 'Cheque';
            }

            setBankForm({
                uan_number: salaryData.uanNumber || '',
                bank_name: salaryData.bankName || '',
                bank_account: salaryData.accountNumber || '',
                ifsc_code: salaryData.ifscCode || '',
                working_days_per_month: salaryData.workingDays || '',
                payment_mode: mode,
                pf_no: salaryData.pfNumber || '',
            });
        }
        setIsBankEditDialogOpen(true);
    };

    const handleUpdateBankDetails = async () => {
        try {
            setIsUpdatingBank(true);

            const payload = {
                user_id: parseInt(targetUserId!),
                bank_name: bankForm.bank_name || null,
                bank_account: bankForm.bank_account || null,
                ifsc_code: bankForm.ifsc_code || null,
                working_days_per_month: bankForm.working_days_per_month === '' ? null : Number(bankForm.working_days_per_month),
                ...(bankForm.uan_number ? { uan_number: bankForm.uan_number } : {}),
                ...(bankForm.pf_no ? { pf_no: bankForm.pf_no } : {})
            };

            const response = await apiService.updateBankDetails(targetUserId!, payload);

            if (response) {
                // Update local state with response
                setSalaryData(prev => prev ? {
                    ...prev,
                    uanNumber: response.uan_number || bankForm.uan_number,
                    bankName: response.bank_name || bankForm.bank_name,
                    accountNumber: response.bank_account || bankForm.bank_account,
                    ifscCode: response.ifsc_code || bankForm.ifsc_code,
                    workingDays: response.working_days_per_month || bankForm.working_days_per_month,
                    paymentMode: response.payment_mode?.toLowerCase().replace(' ', '_') || bankForm.payment_mode.toLowerCase().replace(' ', '_'),
                    pfNumber: response.pf_no || bankForm.pf_no,
                    // Recalculate monthly values from updated annual/config values
                    otherDeduction: (response.other_deduction_annual !== undefined ? response.other_deduction_annual : bankForm.other_deduction_annual) / 12,
                    pfEmployee: (response.pf_annual !== undefined ? response.pf_annual : bankForm.pf_annual) / 24,
                    pfEmployer: (response.pf_annual !== undefined ? response.pf_annual : bankForm.pf_annual) / 24
                } : null);

                toast({
                    title: "Success",
                    description: "Bank details updated successfully.",
                    variant: "success"
                });

                setIsBankEditDialogOpen(false);
            }
        } catch (error: any) {
            console.error("Failed to update bank details:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to update bank details.",
                variant: "destructive"
            });
        } finally {
            setIsUpdatingBank(false);
        }
    };



    const toggleSensitive = () => setShowSensitive(!showSensitive);

    const maskData = (value: string | undefined, visibleChars = 4) => {
        if (!value) return 'N/A';
        if (showSensitive) return value;
        const len = value.length;
        if (len <= visibleChars) return value;
        return '*'.repeat(len - visibleChars) + value.slice(-visibleChars);
    };

    const handleDownloadSlip = async (month: number, year: number) => {
        try {
            toast({ title: 'Preparing Download', description: 'Generating salary slip PDF...', variant: 'default' });
            const blob = await apiService.downloadSalarySlip(targetUserId!, month, year);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Salary_Slip_${month}_${year}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({ title: 'Success', description: `Salary slip for ${months[month - 1]} ${year} downloaded successfully.`, variant: 'success' });
        } catch (err: any) {
            toast({
                title: 'Download Failed',
                description: err.message || 'Failed to download salary slip.',
                variant: 'destructive',
            });
        }
    };

    const handleSendSlip = async (month: number, year: number) => {
        if (isVerified === false) {
            toast({
                title: "Email Not Verified",
                description: "Cannot send salary slip. The employee's email must be verified first.",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSalarySlipSending(true);
            const response = await apiService.sendSalarySlip(targetUserId!, month, year);

            if (response?.success) {
                toast({
                    title: 'Sent Successfully',
                    description: response.message || `Salary slip for ${months[month - 1]} ${year} sent to ${userEmail || 'employee'}.`,
                    variant: 'success'
                });
                loadSalarySlipHistory(); // Refresh history to show email sent status
            } else {
                throw new Error('Failed to send salary slip');
            }
        } catch (err: any) {
            toast({
                title: 'Send Failed',
                description: err.message || 'Failed to send salary slip via email.',
                variant: 'destructive'
            });
        } finally {
            setIsSalarySlipSending(false);
        }
    };

    const handleOpenGenerateSlip = () => {
        if (selectedMonth === 'all') {
            toast({
                title: "Selection Required",
                description: "Please select a specific month to generate the slip.",
                variant: "destructive"
            });
            return;
        }
        setGenerateSlipForm({
            optional_deduction_1_label: '',
            optional_deduction_1_amount: '',
            optional_deduction_2_label: '',
            optional_deduction_2_amount: '',
            optional_deduction_3_label: '',
            optional_deduction_3_amount: '',
            manual_leave_days: '',
        });
        setIsGenerateSlipDialogOpen(true);
    };

    const handleGenerateSlipAction = async (action: 'preview' | 'download') => {
        try {
            setIsGenerating(true);
            const month = parseInt(selectedMonth);

            const options = {
                optional_deduction_1_label: generateSlipForm.optional_deduction_1_label || undefined,
                optional_deduction_1_amount: generateSlipForm.optional_deduction_1_amount ? Number(generateSlipForm.optional_deduction_1_amount) : undefined,
                optional_deduction_2_label: generateSlipForm.optional_deduction_2_label || undefined,
                optional_deduction_2_amount: generateSlipForm.optional_deduction_2_amount ? Number(generateSlipForm.optional_deduction_2_amount) : undefined,
                optional_deduction_3_label: generateSlipForm.optional_deduction_3_label || undefined,
                optional_deduction_3_amount: generateSlipForm.optional_deduction_3_amount ? Number(generateSlipForm.optional_deduction_3_amount) : undefined,
                manual_leave_days: generateSlipForm.manual_leave_days ? Number(generateSlipForm.manual_leave_days) : undefined,
                inline: action === 'preview',
                preview: action === 'preview'
            };

            toast({ title: action === 'preview' ? 'Generating Preview' : 'Generating Slip', description: 'Preparing PDF...', variant: 'default' });

            const blob = await apiService.downloadSalarySlip(targetUserId!, month, selectedYear, options);
            const url = window.URL.createObjectURL(blob);

            if (action === 'preview') {
                window.open(url, '_blank');
                toast({ title: 'Success', description: 'Preview opened in a new tab.', variant: 'success' });
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `Salary_Slip_${months[month - 1]}_${selectedYear}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                toast({ title: 'Success', description: 'Salary slip generated and downloaded.', variant: 'success' });
                setIsGenerateSlipDialogOpen(false);
                loadSalarySlipHistory();
            }
        } catch (err: any) {
            toast({
                title: "Generation Failed",
                description: err.message || "Failed to generate salary slip.",
                variant: "destructive"
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadAnnexure = async () => {
        try {
            toast({ title: 'Preparing Annexure', description: 'Generating PDF...', variant: 'default' });
            const blob = await apiService.downloadAnnexure(targetUserId!);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Salary_Annexure_${userName || 'Employee'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({ title: 'Success', description: `Salary annexure downloaded successfully.`, variant: 'success' });
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message || "Could not download annexure",
                variant: "destructive"
            });
        }
    };

    const handleSendAnnexure = async () => {
        try {
            setIsAnnexureSending(true);
            const response = await apiService.sendAnnexureEmail(targetUserId!);

            if (response?.success) {
                toast({
                    title: "Sent Successfully",
                    description: response.message || "Salary annexure sent via email successfully.",
                    variant: "success"
                });
            } else {
                throw new Error('Failed to send annexure');
            }
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message || "Failed to send annexure",
                variant: "destructive"
            });
        } finally {
            setIsAnnexureSending(false);
        }
    };

    const handleDownloadIncrementLetter = async (incrementId: string, date: string) => {
        try {
            toast({ title: 'Preparing Letter', description: 'Generating Increment Letter PDF...', variant: 'default' });
            const blob = await apiService.downloadIncrementLetter(incrementId);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Increment_Letter_${date}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({ title: 'Success', description: `Increment letter downloaded successfully.`, variant: 'success' });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to download increment letter', variant: 'destructive' });
        }
    };

    const handleSendIncrementLetter = async (incrementId: string) => {
        try {
            toast({ title: 'Sending Letter', description: 'Sending via email...', variant: 'default' });
            const response = await apiService.sendIncrementLetter(incrementId);

            if (response?.success) {
                toast({
                    title: 'Sent Successfully',
                    description: response.message || `Increment letter sent to employee via email successfully.`,
                    variant: 'success'
                });
            } else {
                throw new Error('Failed to send increment letter');
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to send increment letter', variant: 'destructive' });
        }
    };

    const handleOpenOfferLetterDialog = () => {
        setIsOfferLetterDialogOpen(true);
        // Reset form
        setOfferLetterForm({
            letter_date: '',
            joining_date: '',
        });
    };

    const handleDownloadOfferLetter = async () => {
        // Validate form
        if (!offerLetterForm.letter_date || !offerLetterForm.joining_date) {
            toast({
                title: 'Validation Error',
                description: 'Please fill in both letter date and joining date.',
                variant: 'destructive'
            });
            return;
        }

        // Validate that joining_date >= letter_date
        const letterDate = new Date(offerLetterForm.letter_date);
        const joiningDate = new Date(offerLetterForm.joining_date);
        if (joiningDate < letterDate) {
            toast({
                title: 'Validation Error',
                description: 'Joining date must be same or later than letter date.',
                variant: 'destructive'
            });
            return;
        }

        setIsDownloadingOfferLetter(true);
        try {
            toast({ title: 'Generating Letter', description: 'Preparing PDF...', variant: 'default' });
            const blob = await apiService.downloadOfferLetter(targetUserId!, {
                letter_date: offerLetterForm.letter_date,
                joining_date: offerLetterForm.joining_date,
            });

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Offer_Letter_${userName || 'Employee'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({ title: 'Success', description: `Offer letter downloaded successfully.`, variant: 'success' });
            setIsOfferLetterDialogOpen(false);
            // Reset form
            setOfferLetterForm({
                letter_date: '',
                joining_date: '',
            });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to download offer letter', variant: 'destructive' });
        } finally {
            setIsDownloadingOfferLetter(false);
        }
    };

    const handleViewIncrementDetail = async (incrementId: string) => {
        try {
            setIsLoadingIncrementDetail(true);
            setIsViewingIncrement(true);
            const detail = await apiService.getIncrementById(incrementId);
            setSelectedIncrementDetail(detail);
        } catch (err: any) {
            console.error("Failed to fetch increment details", err);
            toast({
                title: "Error",
                description: "Failed to fetch detailed record.",
                variant: "destructive"
            });
            setIsViewingIncrement(false);
        } finally {
            setIsLoadingIncrementDetail(false);
        }
    };

    // Create memoized salary structure for consistent display across summary and breakdown
    const displaySalaryData: SalaryStructure = React.useMemo(() => {
        const base = salaryData || {
            id: '',
            userId: targetUserId || '',
            annualCtc: 0,
            monthlyBasic: 0,
            hra: 0,
            specialAllowance: 0,
            medicalAllowance: 0,
            conveyanceAllowance: 0,
            otherAllowance: 0,
            professionalTax: 0,
            pfEmployer: 0,
            pfEmployee: 0,
            variablePayType: 'none',
            variablePayValue: 0,
            variablePay: 0,
            monthlyGross: 0,
            monthlyDeductions: 0,
            otherDeduction: 0,
            monthlyInHand: 0,
            workingDays: 26,
            paymentMode: 'bank_transfer' as const,
            bankName: '',
            accountNumber: '',
            ifscCode: '',
            panNumber: '',
            uanNumber: '',
            pfNumber: '',
            effectiveDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            is_active: true
        };

        // If a specific month is selected and we have history, try to use the net_salary from history
        let inHand = (base.monthlyGross || 0) - (base.monthlyDeductions || 0);
        if (selectedMonth !== "all" && salarySlipHistory.length > 0) {
            const slip = salarySlipHistory.find(s => s.month.toString() === selectedMonth && s.year === selectedYear);
            if (slip && slip.net_salary) {
                inHand = slip.net_salary;
            }
        }

        // Ensure totals match components if not overridden by slip
        const calculatedGross = (base.monthlyBasic || 0) + (base.hra || 0) + (base.specialAllowance || 0) +
            (base.medicalAllowance || 0) + (base.conveyanceAllowance || 0) + (base.otherAllowance || 0);
        const calculatedDeductions = (base.professionalTax || 0) + (base.pfEmployee || 0) + (base.otherDeduction || 0);

        return {
            ...base,
            monthlyGross: calculatedGross > 0 ? calculatedGross : base.monthlyGross,
            monthlyDeductions: calculatedDeductions > 0 ? calculatedDeductions : base.monthlyDeductions,
            monthlyInHand: inHand > 0 ? inHand : (calculatedGross - calculatedDeductions)
        };
    }, [salaryData, targetUserId, selectedMonth, selectedYear, salarySlipHistory]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;
    }

    return (
        <div className="w-full space-y-6 animate-in fade-in duration-500">
            <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-sm mt-1">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-teal-500/5 rounded-full blur-3xl" />

                <div className="relative flex items-center gap-5">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
                        <FileText className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold tracking-tight" style={{ color: '#000000', fontSize: '30px' }}>
                            {userName ? `${userName}'s Salary Details` : 'Salary Details'}
                        </h1>

                    </div>
                </div>

                {canEdit && (
                    <div className="relative flex gap-3">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => {
                                if (targetUserId && targetUserId !== 'undefined') {
                                    navigate(`/salary/add?userId=${targetUserId}&edit=true`);
                                }
                            }}
                            className="rounded-xl px-6 h-12 transition-all active:scale-95"
                            style={{ color: '#FFFFFF', backgroundColor: '#10B981', fontSize: '14px' }}
                        >
                            <Edit className="mr-2 h-4 w-4" /> Edit Structure
                        </Button>
                    </div>
                )}
            </div>

            {/* Salary Summary Cards - Admin/HR or Owner Only */}
            {canViewAll && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                        const annualCtc = displaySalaryData.annualCtc || displaySalaryData.ctc_annual || 0;
                        const monthly_ctc = displaySalaryData.monthly_ctc || (annualCtc / 12);

                        let currentMonthlyInHand = displaySalaryData.monthlyInHand;
                        const currentMonthlyCTC = monthly_ctc;

                        return (
                            <>
                                <SummaryCard
                                    title="Annual CTC"
                                    value={formatCurrency(annualCtc)}
                                    icon={Briefcase}
                                    iconColor="text-blue-600"
                                    iconBg="bg-blue-50"
                                />
                                <SummaryCard
                                    title="Monthly In-Hand"
                                    value={formatCurrency(currentMonthlyInHand)}
                                    icon={DollarSign}
                                    iconColor="text-green-600"
                                    iconBg="bg-green-50"
                                />
                                <SummaryCard
                                    title="Monthly CTC"
                                    value={formatCurrency(currentMonthlyCTC)}
                                    icon={TrendingUp}
                                    iconColor="text-indigo-600"
                                    iconBg="bg-indigo-50"
                                />
                                <SummaryCard
                                    title="Payment Mode"
                                    value={displaySalaryData.paymentMode.replace('_', ' ')}
                                    icon={CreditCard}
                                    iconColor="text-amber-600"
                                    iconBg="bg-amber-50"
                                />
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Salary Slips Archive Section - Always prominent for everyone */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-12">
                    <Card className="border-2 border-[#000000] shadow-md overflow-hidden bg-white dark:bg-gray-900">
                        <CardHeader className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 dark:bg-gray-900/50 border-b py-5 px-6 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <History className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <CardTitle className="font-bold" style={{ color: '#000000', fontSize: '16px', fontWeight: 'bold' }}>Salary Slips Archive</CardTitle>
                                    <CardDescription className="font-medium" style={{ color: '#000000', fontSize: '14px' }}>History of generated payslips and payment statuses</CardDescription>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex flex-col items-start gap-1">
                                    <Label className="uppercase font-bold text-[10px] tracking-wider opacity-70" style={{ color: '#000000', fontWeight: 'bold' }}>Year</Label>
                                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                        <SelectTrigger className="w-[85px] h-9 border-2 border-[#000000] bg-white dark:bg-gray-800 shadow-sm" style={{ color: '#000000', fontSize: '14px' }}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                                                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col items-start gap-1">
                                    <Label className="uppercase font-bold text-[10px] tracking-wider opacity-70" style={{ color: '#000000', fontWeight: 'bold' }}>Month</Label>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger className="w-[120px] h-9 border-2 border-[#000000] bg-white dark:bg-gray-800 shadow-sm" style={{ color: '#000000', fontSize: '14px' }}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Months</SelectItem>
                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                                <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {isAdminOrHr && !(userRole === 'hr' && isSelf) && (
                                    <Button
                                        size="default"
                                        className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-sm shadow-emerald-200 dark:shadow-none transition-all active:scale-95"
                                        onClick={handleOpenGenerateSlip}
                                        disabled={selectedMonth === 'all' || isLoadingHistory || isGenerating}
                                    >
                                        {isGenerating ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Plus className="h-4 w-4 mr-2" />
                                        )}
                                        Generate Slip
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-gray-50/50 dark:bg-gray-900/20">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="uppercase tracking-wider pl-6 py-4 font-bold" style={{ color: '#000000', fontSize: '14px', fontWeight: 'bold' }}>PERIOD</TableHead>
                                            <TableHead className="uppercase tracking-wider py-4 font-bold" style={{ color: '#000000', fontSize: '14px', fontWeight: 'bold' }}>PAYMENT SUMMARY</TableHead>
                                            <TableHead className="uppercase tracking-wider py-4 text-center font-bold" style={{ color: '#000000', fontSize: '14px', fontWeight: 'bold' }}>STATUS</TableHead>
                                            <TableHead className="text-right uppercase tracking-wider pr-6 py-4 font-bold" style={{ color: '#000000', fontSize: '14px', fontWeight: 'bold' }}>ACTIONS</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoadingHistory ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-12">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                                                        <div className="text-sm font-bold text-muted-foreground mt-3 uppercase tracking-widest">Fetching Archives...</div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : salarySlipHistory.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-16">
                                                    <div className="flex flex-col items-center justify-center opacity-40">
                                                        <History className="h-12 w-12 text-gray-300 mb-2" />
                                                        <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider font-bold tracking-widest">No salary slips found for {selectedYear}</div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            (() => {
                                                const paginatedSlips = uniqueArchiveSlips.slice((archivePage - 1) * archivePerPage, archivePage * archivePerPage);

                                                if (paginatedSlips.length === 0) {
                                                    return (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-16">
                                                                <div className="flex flex-col items-center justify-center opacity-40">
                                                                    <History className="h-12 w-12 text-gray-300 mb-2" />
                                                                    <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider font-bold tracking-widest">No matching salary slips found</div>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                }

                                                return paginatedSlips.map((slip) => {
                                                    const date = new Date(slip.generated_at);
                                                    const monthName = months[slip.month - 1];

                                                    return (
                                                        <TableRow key={slip.id} className="group hover:bg-gray-50/80 dark:hover:bg-gray-900/40 transition-colors">
                                                            <TableCell className="pl-6 py-4">
                                                                <div className="tracking-tight font-bold" style={{ color: '#000000', fontSize: '14px' }}>{monthName} {slip.year}</div>
                                                                <div className="mt-1.5 font-bold" style={{ color: '#000000', fontSize: '12px' }}>ID: {String(slip.id).slice(0, 8)} | Generated: {date.toLocaleDateString()}</div>
                                                            </TableCell>
                                                            <TableCell className="py-4">
                                                                <div className="flex gap-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="uppercase" style={{ color: '#000000', fontSize: '12px' }}>GROSS EARNINGS</span>
                                                                        <span className="font-bold" style={{ color: '#000000', fontSize: '14px' }}>₹{slip.gross_salary?.toLocaleString('en-IN')}</span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="uppercase" style={{ color: '#000000', fontSize: '12px' }}>NET SELECTION</span>
                                                                        <span className="font-bold" style={{ color: '#000000', fontSize: '14px' }}>₹{slip.net_salary?.toLocaleString('en-IN')}</span>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center py-4">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <Badge
                                                                        variant={slip.email_sent ? "default" : "secondary"}
                                                                        className={`border-none px-2.5 py-0.5 ${slip.email_sent ? "bg-emerald-50" : "bg-blue-50 shadow-sm"}`}
                                                                        style={{ color: slip.email_sent ? '#16A34A' : '#2563EB', fontSize: '12px', fontWeight: 'bold' }}
                                                                    >
                                                                        {slip.email_sent ? "EMAIL SENT" : "READY"}
                                                                    </Badge>
                                                                    {slip.email_sent_at && (
                                                                        <div className="uppercase tracking-tighter font-bold" style={{ color: '#000000', fontSize: '12px' }}>Ref: {new Date(slip.email_sent_at).toLocaleDateString()}</div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6 py-4">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleDownloadSlip(slip.month, slip.year)}
                                                                        className="h-8 w-8 p-0 rounded-lg border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                                                                        title="Download Salary Slip"
                                                                    >
                                                                        <Download className="h-4 w-4" />
                                                                    </Button>
                                                                    {isAdminOrHr && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handleSendSlip(slip.month, slip.year)}
                                                                            disabled={isSalarySlipSending}
                                                                            className="h-8 w-8 p-0 rounded-lg border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                                                                            title="Send via Email"
                                                                        >
                                                                            <Send className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                });
                                            })()
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {uniqueArchiveSlips.length > archivePerPage && (
                                <div className="p-4 border-t border-gray-50 dark:border-gray-800">
                                    <Pagination
                                        currentPage={archivePage}
                                        totalPages={Math.ceil(uniqueArchiveSlips.length / archivePerPage)}
                                        totalItems={uniqueArchiveSlips.length}
                                        itemsPerPage={archivePerPage}
                                        onPageChange={setArchivePage}
                                        showItemsPerPage={false}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {canViewAll && (
                    <div className="flex justify-center mb-6">
                        <TabsList className="h-14 p-1.5 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-lg border-2 border-[#000000] rounded-2xl shadow-inner w-fit">
                            <TabsTrigger
                                value="breakdown"
                                className="px-8 h-full rounded-xl uppercase tracking-widest transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-black data-[state=active]:shadow-lg active:scale-95"
                                style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", fontSize: "14px", fontWeight: "900", color: "#000000" }}
                            >
                                Breakdown
                            </TabsTrigger>
                            <TabsTrigger
                                value="documents"
                                className="px-8 h-full rounded-xl uppercase tracking-widest transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-black data-[state=active]:shadow-lg active:scale-95"
                                style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", fontSize: "14px", fontWeight: "900", color: "#000000" }}
                            >
                                Documents
                            </TabsTrigger>
                            {isAdminOrHr && (
                                <TabsTrigger
                                    value="history"
                                    className="px-8 h-full rounded-xl uppercase tracking-widest transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg active:scale-95"
                                    style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", fontSize: "14px", fontWeight: "900" }}
                                >
                                    Increment
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>
                )}

                {canViewAll && (
                    <TabsContent value="breakdown" className="space-y-6 pt-4">
                        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-12">
                            {/* Monthly Earnings & Deductions Comparison */}
                            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Earnings Card */}
                                <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-xl transition-all duration-300 hover:shadow-2xl">
                                    <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 bg-emerald-500/5 rounded-full blur-3xl" />

                                    <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                                                <TrendingUp className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="tracking-tight" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "16px", fontWeight: "bold" }}>Earnings</h3>
                                                <p className="uppercase tracking-widest" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px", fontWeight: "bold" }}>Monthly Breakdown</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-0">
                                        <Table>
                                            <TableBody>
                                                <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-none group">
                                                    <TableCell className="pl-6 py-4">
                                                        <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Basic Salary</span>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{formatCurrency(displaySalaryData.monthlyBasic)}</TableCell>
                                                </TableRow>
                                                <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-none group">
                                                    <TableCell className="pl-6 py-4">
                                                        <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>HRA</span>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{formatCurrency(displaySalaryData.hra)}</TableCell>
                                                </TableRow>
                                                <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-none group">
                                                    <TableCell className="pl-6 py-4">
                                                        <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Special Allowance</span>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{formatCurrency(displaySalaryData.specialAllowance)}</TableCell>
                                                </TableRow>
                                                {displaySalaryData.medicalAllowance > 0 && (
                                                    <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-none group">
                                                        <TableCell className="pl-6 py-4">
                                                            <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Medical Allowance</span>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{formatCurrency(displaySalaryData.medicalAllowance)}</TableCell>
                                                    </TableRow>
                                                )}
                                                {displaySalaryData.conveyanceAllowance > 0 && (
                                                    <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-none group">
                                                        <TableCell className="pl-6 py-4">
                                                            <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Conveyance Allowance</span>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{formatCurrency(displaySalaryData.conveyanceAllowance)}</TableCell>
                                                    </TableRow>
                                                )}
                                                {displaySalaryData.otherAllowance > 0 && (
                                                    <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-none group">
                                                        <TableCell className="pl-6 py-4">
                                                            <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Other Allowance</span>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{formatCurrency(displaySalaryData.otherAllowance)}</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                        <div className="p-6 bg-emerald-50/40 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-800/50 rounded-b-3xl">
                                            <div className="flex justify-between items-center">
                                                <span className="uppercase tracking-widest font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>Gross Total</span>
                                                <h4 className="tracking-tight font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{formatCurrency(displaySalaryData.monthlyGross)}</h4>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Deductions Card */}
                                <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-xl transition-all duration-300 hover:shadow-2xl">
                                    <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 bg-rose-500/5 rounded-full blur-3xl" />

                                    <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 flex items-center justify-center shadow-inner">
                                                <TrendingUp className="h-6 w-6 rotate-180" />
                                            </div>
                                            <div>
                                                <h3 className="tracking-tight" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "16px", fontWeight: "bold" }}>Deductions</h3>
                                                <p className="uppercase tracking-widest" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px", fontWeight: "bold" }}>Mandatory & Others</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-0">
                                        <Table>
                                            <TableBody>
                                                <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-none group">
                                                    <TableCell className="pl-6 py-4">
                                                        <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Professional Tax</span>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>-{formatCurrency(displaySalaryData.professionalTax)}</TableCell>
                                                </TableRow>
                                                <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-none group">
                                                    <TableCell className="pl-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Provident Fund (EPF)</span>
                                                            {displaySalaryData.pfNumber && (
                                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">PF NO: {displaySalaryData.pfNumber}</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>-{formatCurrency(displaySalaryData.pfEmployee)}</TableCell>
                                                </TableRow>

                                                {displaySalaryData.otherDeduction > 0 && (
                                                    <TableRow className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-none group">
                                                        <TableCell className="pl-6 py-4">
                                                            <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Other Deductions</span>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>-{formatCurrency(displaySalaryData.otherDeduction)}</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                        <div className="p-6 bg-rose-50/40 dark:bg-rose-900/10 border-t border-rose-100 dark:border-rose-800/50 rounded-b-3xl">
                                            <div className="flex justify-between items-center">
                                                <span className="uppercase tracking-widest font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>Total Deductions</span>
                                                <h4 className="tracking-tight font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{formatCurrency(displaySalaryData.monthlyDeductions)}</h4>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Net Take Home & High-level Summary */}
                            <div className="lg:col-span-4 space-y-6">
                                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl p-8 group h-[320px] flex flex-col justify-between border-2 border-[#000000]">
                                    <div className="absolute top-0 right-0 -mr-20 -mt-20 h-80 w-80 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />

                                    <div className="relative">
                                        <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl">
                                            <TrendingUp className="h-7 w-7 text-white" />
                                        </div>
                                        <div className="mt-6">
                                            <p className="uppercase tracking-[0.2em]" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#FFFFFF", fontSize: "12px", fontWeight: "900" }}>Net Take Home</p>
                                            <h2 className="tracking-tighter mt-2 font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#FFFFFF", fontSize: "24px" }}>{formatCurrency(displaySalaryData.monthlyInHand)}</h2>
                                        </div>
                                    </div>

                                    <div className="relative space-y-4">
                                        <Separator className="bg-white/20" />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                                                <span className="uppercase tracking-widest" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#FFFFFF", fontSize: "12px", fontWeight: "bold" }}>Payment Processed</span>
                                            </div>
                                            <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 uppercase tracking-tighter" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#FFFFFF", fontSize: "12px", fontWeight: "900" }}>Verified</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Annual Summary Mini Card */}
                                <div className="relative overflow-hidden rounded-3xl bg-white text-black p-6 shadow-xl group border-2 border-[#000000]">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-5 w-5 text-emerald-600" />
                                            <span className="text-sm font-bold tracking-tight">Annual Summary</span>
                                        </div>
                                        <Badge variant="outline" className="border-black px-2 py-0" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px", fontWeight: "bold" }}>
                                            {(() => {
                                                const m = selectedMonth === "all" ? new Date().getMonth() + 1 : parseInt(selectedMonth);
                                                const y = selectedYear;
                                                if (m >= 4) {
                                                    return `FY ${y}-${(y + 1).toString().slice(-2)}`;
                                                } else {
                                                    return `FY ${y - 1}-${y.toString().slice(-2)}`;
                                                }
                                            })()}
                                        </Badge>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="uppercase tracking-widest font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>Total CTC</span>
                                            <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "900" }}>{formatCurrency(displaySalaryData.ctc_annual || displaySalaryData.annualCtc)}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-black/10">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bank Details Overhaul */}
                            <div className="lg:col-span-12">
                                <div className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-2xl">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                                    <div className="p-8 pb-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-14 w-14 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-inner group transition-all duration-300">
                                                <CreditCard className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div>
                                                <h3 className="tracking-tight font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "16px" }}>Bank & Statutory Details</h3>
                                                <p style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "500" }}>Payment endpoints & identification numbers</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={toggleSensitive}
                                                className="h-11 px-6 rounded-2xl transition-all active:scale-95"
                                                style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#FFFFFF", backgroundColor: "#10B981", fontSize: "14px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.1em" }}
                                            >
                                                {showSensitive ? <EyeSlashIcon className="h-4 w-4 mr-2" /> : <EyeIcon className="h-4 w-4 mr-2" />}
                                                {showSensitive ? 'Hide' : 'Show'} Protected
                                            </Button>
                                            {isAdminOrHr && (
                                                <Button
                                                    onClick={openBankEditDialog}
                                                    className="h-11 px-6 rounded-2xl shadow-lg shadow-slate-200 dark:shadow-none hover:translate-y-[-2px] transition-all active:scale-95"
                                                    style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#FFFFFF", backgroundColor: "#10B981", fontSize: "14px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.1em" }}
                                                >
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Modify Records
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="px-8 pb-8 pt-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                                            {[
                                                { label: 'Primary Bank', value: displaySalaryData.bankName, icon: '🏦', color: 'blue' },
                                                { label: 'Account Number', value: displaySalaryData.accountNumber, mask: 4, icon: '💳', color: 'indigo' },
                                                { label: 'IFSC Protocol', value: displaySalaryData.ifscCode, icon: '📋', color: 'purple' },
                                                { label: 'UAN Identity', value: displaySalaryData.uanNumber, icon: '🔖', color: 'slate' },
                                                { label: 'PF Identity', value: displaySalaryData.pfNumber, icon: '🆔', color: 'emerald' }
                                            ].map((item, idx) => (
                                                <div key={idx} className="group relative">
                                                    <div className="relative z-10 p-5 rounded-3xl bg-slate-50/50 dark:bg-slate-800/20 border-2 border-[#000000] transition-all duration-300 hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-xl">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="uppercase tracking-[0.15em] font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{item.label}</span>
                                                            <span className="text-lg grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                                                        </div>
                                                        <p className="text-base font-black text-slate-800 dark:text-white tracking-tight break-all">
                                                            {maskData(item.value, item.mask)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-8 p-6 rounded-[2rem] bg-indigo-50/30 dark:bg-indigo-900/10 border-2 border-[#000000] flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex items-center gap-6">
                                                <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-md animate-bounce">
                                                    <Calendar className="h-6 w-6 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <h4 className="tracking-tight font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>Standard Working Cycle</h4>
                                                    <p className="mt-0.5" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>Performance is assessed based on this standard monthly cycle.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right hidden sm:block">
                                                    <p className="uppercase tracking-widest font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>Monthly Quota</p>
                                                    <p className="leading-none font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{displaySalaryData.workingDays} Days</p>
                                                </div>
                                                <div className="h-10 w-px bg-indigo-100 dark:bg-indigo-800 mx-2 hidden sm:block" />
                                                <div className={`h-12 px-6 rounded-2xl flex items-center gap-3 shadow-lg font-black text-xs uppercase tracking-widest transition-all duration-300 ${displaySalaryData.is_active !== false
                                                    ? 'bg-emerald-600 text-white shadow-emerald-200/50 dark:shadow-none'
                                                    : 'bg-amber-600 text-white shadow-amber-200/50 dark:shadow-none'
                                                    }`}>
                                                    {displaySalaryData.is_active !== false ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                                    <span style={{ fontSize: '14px' }}>{displaySalaryData.is_active !== false ? 'Active Structure' : 'Inactive Structure'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                )}

                <TabsContent value="documents" className={isAdminOrHr ? "space-y-6 pt-4" : "space-y-6"}>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Foundation Documents - Left Side */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-xl p-6 group h-full">
                                <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all duration-700" />

                                <div className="relative flex items-center gap-5 mb-10">
                                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none transform group-hover:rotate-6 transition-transform">
                                        <Briefcase className="h-7 w-7 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="tracking-tight" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "16px", fontWeight: "bold" }}>Foundation Documents</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="h-1.5 w-4 rounded-full bg-blue-500" />
                                            <p className="uppercase tracking-widest" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>ONBOARDING & SALARY STRUCTURE</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {/* Offer Letter Card - Only visible to Admin or HR (viewing others) */}
                                    {isAdminOrHr && (
                                        <div className="relative p-5 rounded-2xl border-2 border-[#000000] bg-slate-50/50 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-800/40 transition-all duration-300 group/item overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover/item:opacity-100" />
                                            <div className="flex justify-between items-center relative z-10">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-800 group-hover/item:scale-110 group-hover/item:shadow-blue-100 dark:group-hover/item:shadow-none transition-all">
                                                        <FileText className="h-6 w-6 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <h4 style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Offer Letter</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant="secondary" className="uppercase tracking-tighter h-4.5 bg-blue-50 dark:bg-blue-900/40 border-none px-2" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>Official Contract</Badge>
                                                            <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>PDF • 1.2 MB</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleOpenOfferLetterDialog}
                                                    className="h-11 w-11 rounded-xl hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110 active:scale-95 shadow-sm"
                                                >
                                                    <Download className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Salary Annexure Card */}
                                    <div className="relative p-5 rounded-2xl border-2 border-[#000000] bg-slate-50/50 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-800/40 transition-all duration-300 group/item overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover/item:opacity-100" />
                                        <div className="flex justify-between items-center relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-800 group-hover/item:scale-110 group-hover/item:shadow-purple-100 dark:group-hover/item:shadow-none transition-all">
                                                    <LayoutGrid className="h-6 w-6 text-purple-600" />
                                                </div>
                                                <div>
                                                    <h4 style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Salary Annexure</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="secondary" className="uppercase tracking-tighter h-4.5 bg-purple-50 dark:bg-purple-900/40 border-none px-2" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>Current CTC Structure</Badge>
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            <span className="uppercase tracking-tighter font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#10B981", fontSize: "12px" }}>Active</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleDownloadAnnexure}
                                                    className="h-11 w-11 rounded-xl hover:bg-purple-600 hover:text-white transition-all transform hover:scale-110 active:scale-95 shadow-sm border-2 border-purple-100 dark:border-purple-900/50"
                                                    title="Download Annexure"
                                                >
                                                    <Download className="h-5 w-5" />
                                                </Button>
                                                {isAdminOrHr && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleSendAnnexure}
                                                        disabled={isAnnexureSending}
                                                        className={`h-11 w-11 rounded-xl transition-all transform hover:scale-110 active:scale-95 shadow-sm ${isAnnexureSending ? 'bg-slate-100' : 'hover:bg-blue-500 hover:text-white'}`}
                                                        title="Email to Employee"
                                                    >
                                                        {isAnnexureSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className={`h-5 w-5 ${!isAnnexureSending && 'text-blue-500 group-hover/item:text-inherit'}`} />}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 p-4 rounded-2xl bg-yellow-50/50 dark:bg-yellow-950/20 border-2 border-[#000000]">
                                    <div className="flex gap-3">
                                        <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
                                        <p className="leading-relaxed" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#A16207", fontSize: "12px" }}>
                                            Foundation documents are issued during the hiring process. If you notice any discrepancies, please reach out to the HR department immediately.
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Increment Journey - Right Side */}
                        <div className="lg:col-span-7 space-y-6">
                            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-xl p-6 group h-full flex flex-col">
                                <div className="absolute bottom-0 right-0 -mr-20 -mb-20 h-80 w-80 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all duration-700" />

                                <div className="relative flex justify-between items-start mb-8">
                                    <div className="flex items-center gap-5">
                                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none transform group-hover:-rotate-6 transition-transform">
                                            <TrendingUp className="h-7 w-7 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="tracking-tight" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "16px", fontWeight: "bold" }}>Growth Journey</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <div className="h-1.5 w-4 rounded-full bg-emerald-500" />
                                                <p className="uppercase tracking-widest" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>REVISION & INCREMENT LETTERS</p>
                                            </div>
                                        </div>
                                    </div>
                                    {increments.length > 0 && (
                                        <div className="flex flex-col items-end">
                                            <span className="uppercase tracking-widest" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>TOTAL GROWTH</span>
                                            <span className="tracking-tight" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "16px", fontWeight: "bold" }}>
                                                +{increments.reduce((acc, inc) => acc + inc.increment_percentage, 0).toFixed(1)}%
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="relative flex-1 space-y-4 max-h-[500px] overflow-y-auto px-8 pt-10 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                    {sortedIncrements.length > 0 ? (
                                        <div className="space-y-4">
                                            {sortedIncrements
                                                .slice((growthPage - 1) * growthPerPage, growthPage * growthPerPage)
                                                .map((inc, index) => {
                                                    const effectiveDate = new Date(inc.effective_date);
                                                    const createdDate = new Date(inc.created_at);
                                                    const isLatest = index === 0 && growthPage === 1;

                                                    return (
                                                        <div key={inc.id} className={`group/inc relative p-5 rounded-2xl border-2 border-[#000000] transition-all duration-300 ${isLatest
                                                            ? 'bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-900/20 dark:to-teal-900/20 shadow-md shadow-emerald-500/5 scale-[1.02] z-10'
                                                            : 'bg-white dark:bg-gray-800/30 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                                                            }`}>
                                                            {isLatest && (
                                                                <div className="absolute -top-3 left-6">
                                                                    <Badge className="border-none uppercase tracking-widest px-2 shadow-lg shadow-emerald-600/20" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", backgroundColor: "#10B981", color: "#FFFFFF", fontSize: "12px" }}>Active Revision</Badge>
                                                                </div>
                                                            )}

                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center border-2 transition-all ${isLatest
                                                                        ? 'bg-white dark:bg-slate-950 border-emerald-400/30 shadow-inner group-hover/inc:rotate-12'
                                                                        : 'bg-slate-50 dark:bg-slate-800/80 border-slate-100 dark:border-slate-700'
                                                                        }`}>
                                                                        <FileText className={`h-6 w-6 ${isLatest ? 'text-emerald-600' : 'text-slate-400'}`} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-3">
                                                                            <h4 className={`font-bold text-sm ${isLatest ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                                <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Revision: {effectiveDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                                                                            </h4>
                                                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all`} style={{ backgroundColor: "#FFFFFF", color: "#10B981", fontSize: "12px", border: "1px solid #10B981" }}>
                                                                                <TrendingUp className="h-3 w-3" />
                                                                                <span className="uppercase tracking-tighter font-bold" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#10B981", fontSize: "12px" }}>+{inc.increment_percentage}%</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-1.5">
                                                                            <Badge variant="outline" className="border-slate-200 dark:border-slate-700 uppercase tracking-tighter h-4 px-1" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px", fontWeight: "bold" }}>{inc.reason}</Badge>
                                                                            <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>• Issued on {createdDate.toLocaleDateString()}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleDownloadIncrementLetter(inc.id.toString(), inc.effective_date)}
                                                                        className={`h-10 w-10 rounded-xl border-2 transition-all font-bold ${isLatest
                                                                            ? 'bg-white dark:bg-slate-900 border-emerald-200 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white'
                                                                            : 'border-slate-100 dark:border-slate-800 hover:bg-slate-900 dark:hover:bg-slate-100 hover:text-white dark:hover:text-black hover:border-transparent'
                                                                            }`}
                                                                    >
                                                                        <Download className="h-5 w-5" />
                                                                    </Button>
                                                                    {isAdminOrHr && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleSendIncrementLetter(inc.id.toString())}
                                                                            className={`h-10 w-10 rounded-xl transition-all ${isLatest ? 'hover:bg-emerald-600 hover:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} text-emerald-600`}
                                                                            title="Email to Employee"
                                                                        >
                                                                            <Send className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                            {sortedIncrements.length > growthPerPage && (
                                                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                                    <Pagination
                                                        currentPage={growthPage}
                                                        totalPages={Math.ceil(sortedIncrements.length / growthPerPage)}
                                                        totalItems={sortedIncrements.length}
                                                        itemsPerPage={growthPerPage}
                                                        onPageChange={setGrowthPage}
                                                        showItemsPerPage={false}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
                                            <div className="relative mb-6">
                                                <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />
                                                <div className="relative h-20 w-20 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border-2 border-slate-100 dark:border-slate-700">
                                                    <History className="h-10 w-10 text-slate-300" />
                                                </div>
                                            </div>
                                            <h4 style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold" }}>Growth Journey Awaits</h4>
                                            <div className="mt-2 space-y-1">
                                                <p style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>Your professional growth records will be cataloged here sequentially.</p>
                                                <div className="flex items-center justify-center gap-2 mt-4">
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                    <span style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>Verified by HR Operations</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>


                {isAdminOrHr && (
                    <TabsContent value="history" className="space-y-6 pt-4">
                        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border-2 border-[#000000] shadow-xl overflow-x-hidden">
                            <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-indigo-500/5 rounded-full blur-3xl" />

                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                                        <History className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="tracking-tight" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "16px", fontWeight: "bold" }}>Revision Timeline</h3>
                                        <p className="uppercase tracking-widest" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>GROWTH TRACKING & HISTORICAL DATA</p>
                                    </div>
                                </div>
                                {canEdit && (
                                    <Button onClick={() => setShowIncrementForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-6 shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95">
                                        <Plus className="mr-2 h-4 w-4" /> New Increment
                                    </Button>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                        <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-transparent">
                                            <TableHead className="pl-8 py-5" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold", textTransform: "uppercase" }}>Date & Impact</TableHead>
                                            <TableHead className="py-5" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold", textTransform: "uppercase" }}>CTC Transformation</TableHead>
                                            <TableHead className="py-5 text-center" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold", textTransform: "uppercase" }}>Growth Factor</TableHead>
                                            <TableHead className="py-5" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold", textTransform: "uppercase" }}>Reasoning</TableHead>
                                            <TableHead className="text-right pr-8 py-5" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", fontWeight: "bold", textTransform: "uppercase" }}>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {increments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-48 text-center">
                                                    <div className="flex flex-col items-center justify-center text-muted-foreground italic">
                                                        <History className="h-10 w-10 mb-3 opacity-20" />
                                                        <p className="text-sm font-medium">No previous growth records found in our archives.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            increments
                                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                .map((inc, idx) => {
                                                    const effectiveDate = new Date(inc.effective_date);
                                                    const createdDate = new Date(inc.created_at);
                                                    const isTop = idx === 0;

                                                    return (
                                                        <TableRow key={inc.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all border-b border-slate-50 dark:border-slate-800 last:border-0">
                                                            <TableCell className="pl-8 py-5">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`h-2.5 w-2.5 rounded-full ${isTop ? 'bg-indigo-600 animate-pulse ring-4 ring-indigo-600/10' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                                                    <div>
                                                                        <div className="leading-none mb-1.5" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{effectiveDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                                                        <div className="uppercase tracking-tighter" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>Effective From</div>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-5">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="line-through flex items-center gap-1.5 leading-none" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "12px" }}>
                                                                        {formatCurrency(inc.previous_salary)}
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 leading-none" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>
                                                                        {formatCurrency(inc.new_salary)}
                                                                        <TrendingUp className="h-3 w-3" />
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-5">
                                                                <div className="flex justify-center">
                                                                    <Badge className="border-none rounded-full px-3 py-0.5 shadow-sm" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px", backgroundColor: "transparent" }}>
                                                                        +{inc.increment_percentage}%
                                                                    </Badge>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-5">
                                                                <div className="max-w-[200px]">
                                                                    <p className="truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#000000", fontSize: "14px" }}>{inc.reason}</p>
                                                                    <p className="text-[8px] text-muted-foreground font-black uppercase tracking-tighter mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Record UUID: {inc.id.toString().slice(0, 8)}...</p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right pr-8 py-5">
                                                                <div className="flex justify-end gap-2 opacity-100 scale-100 transition-all origin-right">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleViewIncrementDetail(inc.id.toString())}
                                                                        className="h-9 w-9 p-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-all shadow-sm"
                                                                        title="View Details"
                                                                    >
                                                                        <EyeIcon className="h-4 w-4 text-emerald-600" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleDownloadIncrementLetter(inc.id.toString(), inc.effective_date)}
                                                                        className="h-9 w-9 p-0 rounded-xl hover:bg-slate-900 dark:hover:bg-slate-100 hover:text-white dark:hover:text-black border border-transparent hover:border-slate-800 transition-all shadow-sm"
                                                                        title="Download Official Letter"
                                                                    >
                                                                        <Download className="h-4 w-4" />
                                                                    </Button>
                                                                    {isAdminOrHr && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleSendIncrementLetter(inc.id.toString())}
                                                                            className="h-9 w-9 p-0 rounded-xl hover:bg-indigo-600 hover:text-white border border-transparent transition-all shadow-sm text-indigo-600"
                                                                            title="Dispatch to Email"
                                                                        >
                                                                            <Send className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>


                        </div>
                    </TabsContent>
                )}
            </Tabs >

            {/* Bank Details Edit Dialog */}
            < Dialog open={isBankEditDialogOpen} onOpenChange={setIsBankEditDialogOpen} >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-[#000000] rounded-3xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-blue-500" />
                            Edit Bank & Payment Details
                        </DialogTitle>
                        <DialogDescription>
                            Update bank information, payment mode, and statutory details. This will not affect salary structure calculations.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="bank_name">Bank Name</Label>
                                <Input
                                    id="bank_name"
                                    value={bankForm.bank_name}
                                    onChange={(e) => setBankForm(prev => ({ ...prev, bank_name: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                                    placeholder="Enter bank name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="bank_account">Account Number</Label>
                                <Input
                                    id="bank_account"
                                    value={bankForm.bank_account}
                                    onChange={(e) => setBankForm(prev => ({ ...prev, bank_account: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                                    placeholder="Enter account number"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="ifsc_code">IFSC Code</Label>
                                <Input
                                    id="ifsc_code"
                                    value={bankForm.ifsc_code}
                                    onChange={(e) => setBankForm(prev => ({ ...prev, ifsc_code: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                                    placeholder="Enter IFSC code"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="uan_number">UAN Number</Label>
                                <Input
                                    id="uan_number"
                                    value={bankForm.uan_number}
                                    onChange={(e) => setBankForm(prev => ({ ...prev, uan_number: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                                    placeholder="Enter UAN number"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="payment_mode">Payment Mode</Label>
                                <Select
                                    value={bankForm.payment_mode}
                                    onValueChange={(value) => setBankForm(prev => ({ ...prev, payment_mode: value }))}
                                >
                                    <SelectTrigger className="border-2 border-[#000000] h-10 bg-white dark:bg-slate-800">
                                        <SelectValue placeholder="Select payment mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="Cheque">Cheque</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="working_days_per_month">Working Days per Month</Label>
                                <Input
                                    id="working_days_per_month"
                                    type="number"
                                    max="31"
                                    value={bankForm.working_days_per_month}
                                    onChange={(e) => setBankForm(prev => ({ ...prev, working_days_per_month: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                                    placeholder="e.g. 26"
                                    className="border-2 border-[#000000] h-10 bg-white dark:bg-slate-800"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pf_no">PF Number</Label>
                                <Input
                                    id="pf_no"
                                    value={bankForm.pf_no}
                                    onChange={(e) => setBankForm(prev => ({ ...prev, pf_no: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                                    placeholder="Enter PF number"
                                    className="border-2 border-[#000000] h-10 bg-white dark:bg-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsBankEditDialogOpen(false)}
                            disabled={isUpdatingBank}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateBankDetails}
                            disabled={isUpdatingBank}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isUpdatingBank ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Update Details
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Inline Increment Form */}
            {
                showIncrementForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#000000]">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold">Process Salary Increment</h2>
                                    <Button variant="ghost" size="sm" onClick={() => setShowIncrementForm(false)}>
                                        ×
                                    </Button>
                                </div>
                            </div>

                            <form onSubmit={incrementForm.handleSubmit(handleCreateIncrement)} className="p-6 space-y-6">
                                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-[#000000]">
                                    <p className="text-sm text-muted-foreground">Current Annual CTC</p>
                                    <p className="text-xl font-bold">
                                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(currentCtc)}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Increment Amount (₹)</Label>
                                        <Input
                                            type="number"
                                            onChange={handleAmountChange}
                                            value={incrementForm.watch('incrementAmount')}
                                            placeholder="Enter increment amount"
                                            className="border-2 border-[#000000] h-10 bg-white dark:bg-slate-800"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Percentage (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            onChange={handlePercentChange}
                                            value={incrementForm.watch('incrementPercentage')}
                                            placeholder="Enter percentage"
                                            className="border-2 border-[#000000] h-10 bg-white dark:bg-slate-800"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>New Annual CTC (₹)</Label>
                                    <Input
                                        type="number"
                                        onChange={handleNewCtcChange}
                                        value={incrementForm.watch('newCtc')}
                                        className="text-lg font-bold text-green-600 border-2 border-[#000000] h-10 bg-white dark:bg-slate-800"
                                        placeholder="Enter new CTC"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Variable Pay Type</Label>
                                        <Controller
                                            name="variablePayType"
                                            control={incrementForm.control}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger className="border-2 border-[#000000] h-10 bg-white dark:bg-slate-800">
                                                        <SelectValue placeholder="Select Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">No Variable Pay</SelectItem>
                                                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                                                        <SelectItem value="percentage">Percentage</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Variable Pay</Label>
                                        <Input
                                            type="number"
                                            {...incrementForm.register('variablePayValue', { valueAsNumber: true })}
                                            placeholder="Enter variable pay"
                                            className="border-2 border-[#000000] h-10 bg-white dark:bg-slate-800"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Effective Date</Label>
                                    <Input
                                        type="date"
                                        {...incrementForm.register('effectiveDate')}
                                        className="border-2 border-[#000000] h-10 bg-white dark:bg-slate-800"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Reason / Remarks</Label>
                                    <Textarea
                                        {...incrementForm.register('reason', {
                                            onChange: (e) => {
                                                e.target.value = e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '');
                                            }
                                        })}
                                        placeholder="e.g. Annual Appraisal, Promotion, etc."
                                        rows={3}
                                        className="border-2 border-[#000000] bg-white dark:bg-slate-800"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowIncrementForm(false)}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isCreatingIncrement}
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                    >
                                        {isCreatingIncrement ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <TrendingUp className="mr-2 h-4 w-4" />
                                                Process Increment
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }



            {/* Increment Detail Dialog */}
            <Dialog open={isViewingIncrement} onOpenChange={setIsViewingIncrement}>
                <DialogContent className="sm:max-w-[500px] border-2 border-[#000000] shadow-2xl p-0 overflow-hidden rounded-[2rem]">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white relative">
                        <div className="absolute top-0 right-0 p-6 opacity-20">
                            <TrendingUp className="h-24 w-24 rotate-12" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                                <History className="h-6 w-6" />
                                Growth Details
                            </DialogTitle>
                            <DialogDescription className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] mt-1">
                                Official Increment Record
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 space-y-6 bg-white dark:bg-slate-900">
                        {isLoadingIncrementDetail ? (
                            <div className="py-12 flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Retrieving Secure Data...</p>
                            </div>
                        ) : selectedIncrementDetail ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-[#000000]">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Previous CTC</p>
                                        <p className="text-lg font-black text-slate-600 dark:text-slate-400">{formatCurrency(selectedIncrementDetail.previous_salary)}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border-2 border-[#000000]">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">New CTC</p>
                                        <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(selectedIncrementDetail.new_salary)}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hike Amount</span>
                                        <span className="text-sm font-black text-indigo-600">{formatCurrency(selectedIncrementDetail.increment_amount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Growth %</span>
                                        <Badge className="bg-indigo-600 text-white font-black rounded-full px-3">{selectedIncrementDetail.increment_percentage}%</Badge>
                                    </div>
                                    <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Effective From</span>
                                        <span className="text-sm font-black text-slate-800 dark:text-white">{new Date(selectedIncrementDetail.effective_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 border-2 border-[#000000]">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Revision Reason</p>
                                    <p className="text-sm font-medium leading-relaxed italic">"{selectedIncrementDetail.reason}"</p>
                                </div>

                                <div className="pt-2 text-[9px] text-center text-slate-400 font-bold uppercase tracking-[0.2em]">
                                    System ID: {selectedIncrementDetail.id}
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-slate-500 italic">No record data found.</div>
                        )}

                        <DialogFooter className="pt-4 flex !justify-center">
                            <Button
                                onClick={() => setIsViewingIncrement(false)}
                                className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 h-10 transition-all border-none"
                            >
                                Close Details
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Offer Letter Download Dialog */}
            <Dialog open={isOfferLetterDialogOpen} onOpenChange={setIsOfferLetterDialogOpen}>
                <DialogContent className="sm:max-w-[500px] border-2 border-[#000000] rounded-3xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            Download Offer Letter
                        </DialogTitle>
                        <DialogDescription>
                            Please provide the required dates to generate the offer letter.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="letter_date" className="flex items-center gap-1">
                                Letter Date <span className="text-red-500">*</span>
                                <span className="text-xs text-muted-foreground font-normal">(required)</span>
                            </Label>
                            <Input
                                id="letter_date"
                                type="date"
                                value={offerLetterForm.letter_date}
                                onChange={(e) => setOfferLetterForm({ ...offerLetterForm, letter_date: e.target.value })}
                                className="w-full"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Letter creation date (YYYY-MM-DD)
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="joining_date" className="flex items-center gap-1">
                                Joining Date <span className="text-red-500">*</span>
                                <span className="text-xs text-muted-foreground font-normal">(required)</span>
                            </Label>
                            <Input
                                id="joining_date"
                                type="date"
                                value={offerLetterForm.joining_date}
                                onChange={(e) => setOfferLetterForm({ ...offerLetterForm, joining_date: e.target.value })}
                                className="w-full"
                                min={offerLetterForm.letter_date || undefined}
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Joining date (YYYY-MM-DD). Must be same or later than letter date.
                            </p>
                            {offerLetterForm.letter_date && offerLetterForm.joining_date &&
                                new Date(offerLetterForm.joining_date) < new Date(offerLetterForm.letter_date) && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Joining date must be same or later than letter date.
                                    </p>
                                )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsOfferLetterDialogOpen(false)}
                            disabled={isDownloadingOfferLetter}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDownloadOfferLetter}
                            disabled={isDownloadingOfferLetter || !offerLetterForm.letter_date || !offerLetterForm.joining_date}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isDownloadingOfferLetter ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Downloading...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isGenerateSlipDialogOpen} onOpenChange={setIsGenerateSlipDialogOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-2 border-[#000000] rounded-3xl shadow-2xl">
                    <div className="bg-emerald-600 p-6 text-white text-center rounded-t-3xl relative">
                        <div className="absolute top-0 right-0 -mr-12 -mt-12 h-32 w-32 bg-white/10 rounded-full blur-2xl" />
                        <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>Generate Salary Slip</h2>
                        <p className="mt-2 text-emerald-100 opacity-90 font-medium">Add manual deductions before generating</p>
                    </div>
                    <div className="p-8 space-y-6">
                        {/* Other Deduction 1 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Other Deduction 1 (Label)</Label>
                                <Input
                                    value={generateSlipForm.optional_deduction_1_label}
                                    onChange={(e) => setGenerateSlipForm(prev => ({ ...prev, optional_deduction_1_label: e.target.value }))}
                                    placeholder="e.g. Gratuity"
                                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-[#000000]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Amount (₹)</Label>
                                <Input
                                    type="number"
                                    value={generateSlipForm.optional_deduction_1_amount}
                                    onChange={(e) => setGenerateSlipForm(prev => ({ ...prev, optional_deduction_1_amount: e.target.value }))}
                                    placeholder="0"
                                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-[#000000]"
                                />
                            </div>
                        </div>

                        {/* Other Deduction 2 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Other Deduction 2 (Label)</Label>
                                <Input
                                    value={generateSlipForm.optional_deduction_2_label}
                                    onChange={(e) => setGenerateSlipForm(prev => ({ ...prev, optional_deduction_2_label: e.target.value }))}
                                    placeholder="e.g. Insurance"
                                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-[#000000]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Amount (₹)</Label>
                                <Input
                                    type="number"
                                    value={generateSlipForm.optional_deduction_2_amount}
                                    onChange={(e) => setGenerateSlipForm(prev => ({ ...prev, optional_deduction_2_amount: e.target.value }))}
                                    placeholder="0"
                                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-[#000000]"
                                />
                            </div>
                        </div>

                        {/* Other Deduction 3 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Other Deduction 3 (Label)</Label>
                                <Input
                                    value={generateSlipForm.optional_deduction_3_label}
                                    onChange={(e) => setGenerateSlipForm(prev => ({ ...prev, optional_deduction_3_label: e.target.value }))}
                                    placeholder="e.g. Loan Recovery"
                                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-[#000000]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Amount (₹)</Label>
                                <Input
                                    type="number"
                                    value={generateSlipForm.optional_deduction_3_amount}
                                    onChange={(e) => setGenerateSlipForm(prev => ({ ...prev, optional_deduction_3_amount: e.target.value }))}
                                    placeholder="0"
                                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-[#000000]"
                                />
                            </div>
                        </div>

                        {/* Leave Deduction */}
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-emerald-600" />
                                Manual Leave Days Deduction
                            </Label>
                            <Input
                                type="number"
                                step="0.5"
                                value={generateSlipForm.manual_leave_days}
                                onChange={(e) => setGenerateSlipForm(prev => ({ ...prev, manual_leave_days: e.target.value }))}
                                placeholder="Number of days (e.g. 1.5)"
                                className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-[#000000] w-full"
                            />
                            <p className="text-xs text-slate-500 mt-1">Leave deduction will be calculated automatically based on monthly gross.</p>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 rounded-b-3xl border-t border-slate-100 dark:border-slate-800">
                        <Button
                            variant="outline"
                            onClick={() => setIsGenerateSlipDialogOpen(false)}
                            className="h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-slate-500"
                            disabled={isGenerating}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => handleGenerateSlipAction('preview')}
                            className="h-11 px-6 rounded-xl font-bold uppercase tracking-widest border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <EyeIcon className="h-4 w-4 mr-2" />}
                            Preview
                        </Button>
                        <Button
                            onClick={() => handleGenerateSlipAction('download')}
                            className="h-11 px-6 rounded-xl font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-none"
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                            Download
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default SalaryDetails;
