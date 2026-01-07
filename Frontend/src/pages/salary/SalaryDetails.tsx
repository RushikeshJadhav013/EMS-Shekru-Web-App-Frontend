import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { SalaryStructure, Increment } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
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
    EyeOff as EyeSlashIcon
} from 'lucide-react';
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

const SalaryDetails: React.FC<SalaryDetailsProps> = ({ userId: propUserId }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    // Use prop if available, otherwise param, otherwise current user (fallback)
    const targetUserId = propUserId || id || user?.id;

    const [salaryData, setSalaryData] = useState<SalaryStructure | null>(null);
    const [increments, setIncrements] = useState<Increment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSalarySlipSending, setIsSalarySlipSending] = useState(false);

    const userRole = user?.role?.toLowerCase();
    const isAdminOrHr = userRole === 'admin' || userRole === 'hr';
    const isOwner = user?.id === targetUserId;
    const canViewAll = isAdminOrHr || isOwner;

    const [showSensitive, setShowSensitive] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [isAnnexureSending, setIsAnnexureSending] = useState(false);
    const [activeTab, setActiveTab] = useState(canViewAll ? "breakdown" : "documents");



    useEffect(() => {
        if (targetUserId) {
            loadSalaryDetails();
            if (isAdminOrHr || isOwner) {
                loadIncrements();
            }
        }
    }, [targetUserId]);

    const loadSalaryDetails = async () => {
        try {
            setLoading(true);
            setError(null);

            // 0. Check Session Storage first
            const stored = sessionStorage.getItem(`mock_salary_${targetUserId}`);
            if (stored) {
                setSalaryData(JSON.parse(stored));
                setLoading(false);
                return;
            }

            // Mock API Delay
            await new Promise(resolve => setTimeout(resolve, 800));

            // Role-based mock data
            let mockSalary: SalaryStructure;

            if (targetUserId === '1') { // Admin/HR
                mockSalary = {
                    id: 'sal_1',
                    userId: '1',
                    annualCtc: 1200000,
                    variablePayType: 'none',
                    variablePayValue: 0,
                    paymentMode: 'bank_transfer',
                    bankName: 'HDFC Bank',
                    accountNumber: '123456789012',
                    ifscCode: 'HDFC0001234',
                    panNumber: 'ABCDE1234F',
                    uanNumber: '100000000001',
                    workingDays: 26,
                    monthlyBasic: 50000,
                    hra: 25000,
                    specialAllowance: 25000,
                    medicalAllowance: 0,
                    conveyanceAllowance: 0,
                    otherAllowance: 0,
                    pfEmployee: 1800,
                    pfEmployer: 1800,
                    professionalTax: 200,
                    monthlyGross: 100000,
                    monthlyDeductions: 2000,
                    monthlyInHand: 98000,
                    effectiveDate: '2023-04-01',
                    createdAt: '2023-04-01T10:00:00Z',
                    updatedAt: '2024-01-01T10:00:00Z'
                };
            } else if (targetUserId === '2') { // Manager
                mockSalary = {
                    id: 'sal_2',
                    userId: '2',
                    annualCtc: 2400000,
                    variablePayType: 'percentage',
                    variablePayValue: 15,
                    paymentMode: 'bank_transfer',
                    bankName: 'ICICI Bank',
                    accountNumber: '987654321098',
                    ifscCode: 'ICIC0005678',
                    panNumber: 'JKLMN5678G',
                    uanNumber: '200000000002',
                    workingDays: 26,
                    monthlyBasic: 100000,
                    hra: 50000,
                    specialAllowance: 50000,
                    medicalAllowance: 0,
                    conveyanceAllowance: 0,
                    otherAllowance: 0,
                    pfEmployee: 1800,
                    pfEmployer: 1800,
                    professionalTax: 200,
                    monthlyGross: 200000,
                    monthlyDeductions: 2000,
                    monthlyInHand: 198000,
                    effectiveDate: '2022-10-15',
                    createdAt: '2022-10-15T09:00:00Z',
                    updatedAt: '2023-12-10T14:30:00Z'
                };
            } else if (targetUserId === '3') { // Team Lead
                mockSalary = {
                    id: 'sal_3',
                    userId: '3',
                    annualCtc: 1800000,
                    variablePayType: 'percentage',
                    variablePayValue: 10,
                    paymentMode: 'bank_transfer',
                    bankName: 'Axis Bank',
                    accountNumber: '112233445566',
                    ifscCode: 'UTIB0001122',
                    panNumber: 'PQRST1122H',
                    uanNumber: '300000000003',
                    workingDays: 26,
                    monthlyBasic: 75000,
                    hra: 37500,
                    specialAllowance: 37500,
                    medicalAllowance: 0,
                    conveyanceAllowance: 0,
                    otherAllowance: 0,
                    pfEmployee: 1800,
                    pfEmployer: 1800,
                    professionalTax: 200,
                    monthlyGross: 150000,
                    monthlyDeductions: 2000,
                    monthlyInHand: 148000,
                    effectiveDate: '2023-01-10',
                    createdAt: '2023-01-10T11:00:00Z',
                    updatedAt: '2024-01-05T16:00:00Z'
                };
            } else { // Employee or Others
                mockSalary = {
                    id: 'sal_default',
                    userId: targetUserId!,
                    annualCtc: 800000,
                    variablePayType: 'none',
                    variablePayValue: 0,
                    paymentMode: 'bank_transfer',
                    bankName: 'SBI',
                    accountNumber: '998877665544',
                    ifscCode: 'SBIN0001234',
                    panNumber: 'WXYZB5566I',
                    uanNumber: '400000000004',
                    workingDays: 26,
                    monthlyBasic: 33333,
                    hra: 16667,
                    specialAllowance: 16667,
                    medicalAllowance: 0,
                    conveyanceAllowance: 0,
                    otherAllowance: 0,
                    pfEmployee: 1800,
                    pfEmployer: 1800,
                    professionalTax: 200,
                    monthlyGross: 66667,
                    monthlyDeductions: 2000,
                    monthlyInHand: 64667,
                    effectiveDate: '2023-06-01',
                    createdAt: '2023-06-01T10:00:00Z',
                    updatedAt: '2023-06-01T10:00:00Z'
                };
            }

            setSalaryData(mockSalary);

        } catch (err: any) {
            console.error("Failed to load salary", err);
            setError('Failed to load salary details');
        } finally {
            setLoading(false);
        }
    };

    const loadIncrements = async () => {
        try {
            // 1. Get from Session Storage
            const storedIncrements = JSON.parse(sessionStorage.getItem(`mock_increments_${targetUserId}`) || '[]');

            // 2. Fallback / Combine with Hardcoded Mocks for demo
            const mockIncrements: Increment[] = [];
            if (targetUserId === '1') {
                mockIncrements.push({
                    id: 'inc_a1',
                    userId: '1',
                    previousCtc: 1000000,
                    newCtc: 1200000,
                    incrementAmount: 200000,
                    incrementPercentage: 20,
                    effectiveDate: '2023-04-01',
                    reason: 'Annual Performance Appraisal',
                    createdAt: '2023-03-25T10:00:00Z',
                    createdBy: 'Admin'
                });
            } else if (targetUserId === '2') {
                mockIncrements.push({
                    id: 'inc_m1',
                    userId: '2',
                    previousCtc: 2000000,
                    newCtc: 2400000,
                    incrementAmount: 400000,
                    incrementPercentage: 20,
                    effectiveDate: '2023-12-01',
                    reason: 'Promotion to Senior Manager',
                    createdAt: '2023-11-20T10:00:00Z',
                    createdBy: 'Director'
                });
            } else if (targetUserId === '3') {
                mockIncrements.push({
                    id: 'inc_tl1',
                    userId: '3',
                    previousCtc: 1500000,
                    newCtc: 1800000,
                    incrementAmount: 300000,
                    incrementPercentage: 20,
                    effectiveDate: '2023-07-01',
                    reason: 'Annual Hike',
                    createdAt: '2023-06-15T10:00:00Z',
                    createdBy: 'Manager'
                });
            }

            setIncrements([...storedIncrements, ...mockIncrements]);
        } catch (err) {
            console.error("Failed to load increments", err);
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
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast({ title: 'Success', description: `Salary_Slip_${month}_${year}.pdf downloaded (Mock)`, variant: 'success' });
        } catch (err) {
            toast({
                title: 'Download Failed',
                description: 'Failed to download salary slip.',
                variant: 'destructive',
            });
        }
    };

    const handleSendSlip = async (month: number, year: number) => {
        try {
            setIsSalarySlipSending(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
            toast({
                title: 'Sent',
                description: `Salary slip for ${month}/${year} sent to employee via email (Mock).`,
                variant: 'success'
            });
        } catch (err) {
            // ...
        } finally {
            setIsSalarySlipSending(false);
        }
    };

    const handleDownloadAnnexure = async () => {
        try {
            toast({ title: 'Preparing Annexure', description: 'Generating PDF...', variant: 'default' });
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast({ title: 'Success', description: `Salary_Annexure.pdf downloaded (Mock)`, variant: 'success' });
        } catch (err) {
            toast({
                title: "Error",
                description: "Could not download Annexure",
                variant: "destructive"
            });
        }
    };

    const handleSendAnnexure = async () => {
        try {
            setIsAnnexureSending(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
            toast({
                title: "Sent",
                description: "Salary Annexure sent via email (Mock).",
                variant: "success"
            });
        } catch (err) {
            toast({
                title: "Error",
                description: "Failed to send Annexure",
                variant: "destructive"
            });
        } finally {
            setIsAnnexureSending(false);
        }
    };

    const handleDownloadIncrementLetter = async (incrementId: string, date: string) => {
        try {
            toast({ title: 'Preparing Letter', description: 'Generating Increment Letter PDF...', variant: 'default' });
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast({ title: 'Success', description: `Increment_Letter_${date}.pdf downloaded (Mock)`, variant: 'success' });
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to download increment letter', variant: 'destructive' });
        }
    };

    const handleSendIncrementLetter = async (incrementId: string) => {
        try {
            toast({ title: 'Sending Letter', description: 'Sending via email...', variant: 'default' });
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast({ title: 'Sent', description: `Increment letter sent to employee via email (Mock).`, variant: 'success' });
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to send increment letter', variant: 'destructive' });
        }
    };

    const handleDownloadOfferLetter = async () => {
        try {
            toast({ title: 'Generating Letter', description: 'Preparing PDF...', variant: 'default' });
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast({ title: 'Success', description: `Offer_Letter.pdf downloaded (Mock)`, variant: 'success' });
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to download offer letter', variant: 'destructive' });
        }
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;
    }

    if (error || !salaryData) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 m-6">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                    <Briefcase className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">No Salary Record Found</h3>
                <p className="text-muted-foreground mt-2 max-w-sm mb-6">
                    {error || "This employee does not have a salary structure defined yet."}
                </p>
                {isAdminOrHr && (
                    <Button onClick={() => navigate(`/salary/add?userId=${targetUserId}`)}>
                        <Plus className="mr-2 h-4 w-4" /> Create Salary
                    </Button>
                )}
            </div>
        );
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-8 rounded-3xl bg-white dark:bg-gray-900 border shadow-sm mt-1">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 bg-teal-500/5 rounded-full blur-3xl" />

                <div className="relative flex items-center gap-5">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
                        <FileText className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                            Salary <span className="text-emerald-600">Details</span>
                        </h1>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1 text-xs font-bold text-muted-foreground mt-1 uppercase tracking-tight">
                            <span className="flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
                                Created: {salaryData?.createdAt ? new Date(salaryData.createdAt).toLocaleDateString() : 'N/A'}
                            </span>
                            <span className="hidden sm:inline opacity-30">|</span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                                Effective: {salaryData?.effectiveDate ? new Date(salaryData.effectiveDate).toLocaleDateString() : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>

                {isAdminOrHr && (
                    <div className="relative flex gap-3">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => navigate(`/salary/add?userId=${targetUserId}&edit=true`)}
                            className="rounded-xl px-6 h-12 border-gray-200 dark:border-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-95"
                        >
                            <Edit className="mr-2 h-4 w-4" /> Edit Structure
                        </Button>
                    </div>
                )}
            </div>

            {/* Salary Summary Cards - Admin/HR or Owner Only */}
            {canViewAll && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        {
                            label: 'Annual CTC',
                            value: formatCurrency(salaryData.annualCtc),
                            sub: 'Cost to Company',
                            icon: Briefcase,
                            color: 'blue',
                            bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
                            cardBg: 'bg-blue-50/40 dark:bg-blue-950/10',
                            borderColor: 'border-blue-300/80 dark:border-blue-700/50',
                            hoverBorder: 'group-hover:border-blue-500 dark:group-hover:border-blue-400'
                        },
                        {
                            label: 'Monthly In-Hand',
                            value: formatCurrency(salaryData.monthlyInHand),
                            sub: 'Net Pay / Month',
                            icon: DollarSign,
                            color: 'emerald',
                            bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
                            cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
                            borderColor: 'border-emerald-300/80 dark:border-emerald-700/50',
                            hoverBorder: 'group-hover:border-emerald-500 dark:group-hover:border-emerald-400'
                        },
                        {
                            label: 'Variable Pay',
                            value: salaryData.variablePayType === 'none' ? '—' :
                                formatCurrency(
                                    salaryData.variablePayType === 'fixed'
                                        ? salaryData.variablePayValue
                                        : (salaryData.annualCtc * salaryData.variablePayValue) / 100
                                ),
                            sub: salaryData.variablePayType === 'none'
                                ? 'No variable component'
                                : salaryData.variablePayType === 'fixed'
                                    ? 'Fixed Amount (Annual)'
                                    : `${salaryData.variablePayValue}% of Annual CTC`,
                            icon: TrendingUp,
                            color: 'indigo',
                            bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
                            cardBg: 'bg-indigo-50/40 dark:bg-indigo-950/10',
                            borderColor: 'border-indigo-300/80 dark:border-indigo-700/50',
                            hoverBorder: 'group-hover:border-indigo-500 dark:group-hover:border-indigo-400'
                        },
                        {
                            label: 'Payment Mode',
                            value: salaryData.paymentMode.replace('_', ' '),
                            sub: maskData(salaryData.bankName),
                            icon: CreditCard,
                            color: 'amber',
                            bg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
                            cardBg: 'bg-amber-50/40 dark:bg-amber-950/10',
                            borderColor: 'border-amber-300/80 dark:border-amber-700/50',
                            hoverBorder: 'group-hover:border-amber-500 dark:group-hover:border-amber-400',
                            isCap: true
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
                                    <div className={`text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight ${item.isCap ? 'capitalize' : ''}`}>{item.value}</div>
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
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {canViewAll && (
                    <TabsList className="bg-white dark:bg-gray-800 p-1 border">
                        <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                        <TabsTrigger value="documents">Documents</TabsTrigger>
                        {isAdminOrHr && <TabsTrigger value="history">History</TabsTrigger>}
                    </TabsList>
                )}

                {canViewAll && (
                    <TabsContent value="breakdown" className="space-y-4 pt-4">
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Earnings */}
                            <Card className="border-none shadow-md overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 pb-4 border-b">
                                    <CardTitle className="text-green-700 dark:text-green-400 text-lg flex items-center">
                                        <TrendingUp className="h-5 w-5 mr-2" /> Monthly Earnings
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableBody>
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell className="font-medium">Basic Salary</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(salaryData.monthlyBasic)}</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell className="font-medium">House Rent Allowance (HRA)</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(salaryData.hra)}</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell className="font-medium">Special Allowance</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(salaryData.specialAllowance)}</TableCell>
                                            </TableRow>
                                            {salaryData.medicalAllowance > 0 && (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell className="font-medium">Medical Allowance</TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(salaryData.medicalAllowance)}</TableCell>
                                                </TableRow>
                                            )}
                                            {salaryData.conveyanceAllowance > 0 && (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell className="font-medium">Conveyance Allowance</TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(salaryData.conveyanceAllowance)}</TableCell>
                                                </TableRow>
                                            )}
                                            {salaryData.otherAllowance > 0 && (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell className="font-medium">Other Allowance</TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(salaryData.otherAllowance)}</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            {/* Deductions */}
                            <Card className="border-none shadow-md overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 pb-4 border-b">
                                    <CardTitle className="text-red-700 dark:text-red-400 text-lg flex items-center">
                                        <TrendingUp className="h-5 w-5 mr-2 rotate-180" /> Monthly Deductions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableBody>
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell className="font-medium">Professional Tax (PT)</TableCell>
                                                <TableCell className="text-right font-bold text-red-600 dark:text-red-400">-{formatCurrency(salaryData.professionalTax)}</TableCell>
                                            </TableRow>
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell className="font-medium">Provident Fund (Employee PF)</TableCell>
                                                <TableCell className="text-right font-bold text-red-600 dark:text-red-400">-{formatCurrency(salaryData.pfEmployee)}</TableCell>
                                            </TableRow>
                                            {/* Placeholder for other deductions if any */}
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell className="font-medium">Income Tax (TDS)</TableCell>
                                                <TableCell className="text-right font-bold text-red-600 dark:text-red-400">-{formatCurrency(0)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                    <div className="p-4 bg-gray-50/50 dark:bg-gray-950/50 border-t mt-4 space-y-3">
                                        <div className="flex justify-between items-center text-sm font-medium">
                                            <span className="text-muted-foreground">Gross Earnings</span>
                                            <span className="text-gray-900 dark:text-gray-100">{formatCurrency(salaryData.monthlyGross)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm font-medium">
                                            <span className="text-muted-foreground">Total Deductions</span>
                                            <span className="text-red-600 dark:text-red-400">-{formatCurrency(salaryData.monthlyDeductions)}</span>
                                        </div>
                                        <Separator className="bg-gray-200 dark:bg-gray-800" />
                                        <div className="flex justify-between items-center pt-1">
                                            <span className="text-base font-bold text-gray-900 dark:text-gray-100">Take Home Salary</span>
                                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(salaryData.monthlyInHand)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Bank & Payment Details */}
                        <Card className="border-none shadow-md overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between bg-gray-50 dark:bg-gray-900/50 border-b py-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-blue-500" />
                                    Bank & Statutory Details
                                </CardTitle>
                                {isAdminOrHr && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={toggleSensitive}
                                        className="hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600"
                                    >
                                        {showSensitive ? <EyeSlashIcon className="h-4 w-4 mr-2" /> : <EyeIcon className="h-4 w-4 mr-2" />}
                                        {showSensitive ? 'Hide Sensitive' : 'Show Sensitive'}
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Bank Name</h4>
                                        <p className="text-sm font-semibold select-none">{maskData(salaryData.bankName)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Account Number</h4>
                                        <p className="text-sm font-semibold select-none tracking-widest">{maskData(salaryData.accountNumber, 4)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">IFSC Code</h4>
                                        <p className="text-sm font-semibold select-none">{maskData(salaryData.ifscCode)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">PAN Number</h4>
                                        <p className="text-sm font-semibold select-none">{maskData(salaryData.panNumber, 2)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">UAN Number</h4>
                                        <p className="text-sm font-semibold select-none">{maskData(salaryData.uanNumber)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Working Days (Standard)</h4>
                                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 font-bold border-none">
                                            {salaryData.workingDays} Days / Month
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                <TabsContent value="documents" className={isAdminOrHr ? "space-y-6 pt-4" : "space-y-6"}>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Vital Documents */}
                        <div className="lg:col-span-5 space-y-6">
                            <Card className="border-none shadow-md overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-b">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Briefcase className="h-5 w-5 text-blue-600" />
                                        Onboarding & Structure
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-gray-800/50 hover:shadow-sm transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm">Offer Letter</h4>
                                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Joining Document</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={handleDownloadOfferLetter} className="rounded-full h-8 w-8 p-0">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-gray-800/50 hover:shadow-sm transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm">Salary Annexure</h4>
                                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Current CTC Breakdown</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" onClick={handleDownloadAnnexure} className="rounded-full h-8 w-8 p-0">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            {isAdminOrHr && (
                                                <Button variant="ghost" size="sm" onClick={handleSendAnnexure} disabled={isAnnexureSending} className="rounded-full h-8 w-8 p-0">
                                                    <Send className="h-4 w-4 text-blue-500" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Increment Letters Section */}
                            <Card className="border-none shadow-md overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border-b py-4">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                                        Increment Letters
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    {increments.length > 0 ? (
                                        increments.map((inc) => (
                                            <div key={inc.id} className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-gray-800/50 hover:shadow-sm transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-sm">Revision: {new Date(inc.effectiveDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</h4>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Increment Letter</p>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => handleDownloadIncrementLetter(inc.id, inc.effectiveDate)} className="rounded-full h-8 w-8 p-0">
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-6">
                                            <div className="mx-auto w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
                                                <FileText className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">No increment letters found</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="bg-blue-600 text-white border-none shadow-lg overflow-hidden relative">
                                <CardContent className="p-6 relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-xl font-bold">Need Help?</h4>
                                            <p className="text-blue-100 text-sm mt-1 max-w-[200px]">For any salary-related queries, please contact HR.</p>
                                        </div>
                                        <div className="p-3 bg-white/10 rounded-2xl rotate-12">
                                            <AlertCircle className="h-8 w-8 text-white" />
                                        </div>
                                    </div>
                                    <Button variant="secondary" className="mt-6 w-full bg-white text-blue-600 hover:bg-blue-50 font-bold">
                                        Contact HR Desk
                                    </Button>
                                </CardContent>
                                <div className="absolute top-0 right-0 -mr-12 -mt-12 h-48 w-48 bg-white/5 rounded-full" />
                            </Card>
                        </div>

                        {/* Salary Slips Archive */}
                        <div className="lg:col-span-7">
                            <Card className="border-none shadow-md overflow-hidden h-full">
                                <CardHeader className="flex flex-row items-center justify-between bg-gray-50 dark:bg-gray-900/50 border-b py-4">
                                    <div className="flex items-center gap-2">
                                        <History className="h-5 w-5 text-emerald-600" />
                                        <CardTitle className="text-lg">Salary Slips Archive</CardTitle>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                            <SelectTrigger className="w-[85px] h-8 text-xs font-bold border-none bg-white dark:bg-gray-800 shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[2022, 2023, 2024, 2025, 2026].map(y => (
                                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                            <SelectTrigger className="w-[105px] h-8 text-xs font-bold border-none bg-white dark:bg-gray-800 shadow-sm">
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
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-gray-50/50 dark:bg-gray-900/20">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="font-bold text-[10px] uppercase tracking-wider pl-6">Period</TableHead>
                                                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Status</TableHead>
                                                <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Download</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Array.from({ length: 12 }, (_, i) => i)
                                                .filter(monthIndex => selectedMonth === "all" || (monthIndex + 1).toString() === selectedMonth)
                                                .map((monthIndex) => {
                                                    const year = selectedYear;
                                                    const date = new Date(year, monthIndex, 1);
                                                    const monthName = date.toLocaleString('default', { month: 'long' });
                                                    const isFuture = date > new Date();

                                                    if (isFuture) return null;

                                                    return (
                                                        <TableRow key={`${year}-${monthIndex}`} className="group pl-6 pr-6 py-2">
                                                            <TableCell className="pl-6">
                                                                <div className="font-bold text-sm tracking-tight">{monthName} {year}</div>
                                                                <div className="text-[10px] text-muted-foreground font-medium">Generated on {new Date(year, monthIndex + 1, 0).toLocaleDateString()}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px] font-bold border-none">
                                                                    PUBLISHED
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleDownloadSlip(monthIndex + 1, year)}
                                                                        className="h-8 w-8 p-0 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                                    >
                                                                        <Download className="h-4 w-4 text-emerald-600" />
                                                                    </Button>
                                                                    {isAdminOrHr && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleSendSlip(monthIndex + 1, year)}
                                                                            disabled={isSalarySlipSending}
                                                                            className="h-8 w-8 p-0 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                                        >
                                                                            <Send className="h-4 w-4 text-blue-600" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                }).reverse()}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {isAdminOrHr && (
                    <TabsContent value="history" className="space-y-4 pt-4">
                        <Card className="border-none shadow-md overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between bg-gray-50 dark:bg-gray-900/50 border-b py-4">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <History className="h-5 w-5 text-indigo-600" />
                                        Increment History
                                    </CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest mt-1">Record of previous salary revisions & letters</CardDescription>
                                </div>
                                {isAdminOrHr && (
                                    <Button size="sm" onClick={() => navigate(`/salary/increment/add?userId=${targetUserId}`)} className="bg-indigo-600 hover:bg-indigo-700">
                                        <Plus className="mr-2 h-4 w-4" /> New Increment
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-gray-50/50 dark:bg-gray-900/20">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-bold text-[10px] uppercase tracking-wider pl-6">Effective Date</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-wider">CTC Change</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-wider">Percentage</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-wider">Reason</TableHead>
                                            <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Documents</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {increments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                                                    No previous increment records found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            increments.map((inc) => (
                                                <TableRow key={inc.id} className="group">
                                                    <TableCell className="pl-6 font-bold">{new Date(inc.effectiveDate).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-muted-foreground line-through decoration-red-300">{formatCurrency(inc.previousCtc)}</span>
                                                            <span className="text-sm font-black text-emerald-600">{formatCurrency(inc.newCtc)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-black border-none text-[10px]">
                                                            +{inc.incrementPercentage}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium max-w-[200px] truncate">{inc.reason}</TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDownloadIncrementLetter(inc.id, inc.effectiveDate)}
                                                                className="h-8 w-8 p-0 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                                                title="Download Letter"
                                                            >
                                                                <Download className="h-4 w-4 text-indigo-600" />
                                                            </Button>
                                                            {isAdminOrHr && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleSendIncrementLetter(inc.id)}
                                                                    className="h-8 w-8 p-0 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                                    title="Email Letter"
                                                                >
                                                                    <Send className="h-4 w-4 text-blue-600" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
            {/* Audit & Compliance Footer */}
            <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
                <p className="font-medium">Confidential & Proprietary</p>
                <p className="mt-1">Salary calculations follow company payroll policy. Values shown are subject to verification.</p>
                {salaryData?.updatedAt && (
                    <p className="mt-1 text-gray-400">
                        Record ID: {salaryData.id} • Last synced: {new Date(salaryData.updatedAt).toLocaleString()}
                    </p>
                )}
            </div>
        </div>
    );
};

export default SalaryDetails;
