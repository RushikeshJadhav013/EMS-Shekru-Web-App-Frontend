import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet,
  Receipt,
  Plus,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileCheck,
  CreditCard,
  IndianRupee,
  Layers,
  X,
  Paperclip
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EXPENSE_CATEGORIES } from '@/pages/expenses/ExpensesPage';

// Local storage key shared with Admin Expense management module
const EXPENSES_STORAGE_KEY = 'staffly_expenses_data';

// Dependent Category and Sub-category Mapping
export const CATEGORY_SUBCATEGORY_MAP: Record<string, string[]> = {
  travel_conveyance: ['Taxi / Cab', 'Flight', 'Fuel / Mileage', 'Train / Metro', 'Auto / Bus', 'Parking & Toll'],
  food_refreshments: ['Client Lunch / Dinner', 'Team Lunch', 'Daily Snacks & Beverages', 'Overtime Meal'],
  office_supplies: ['Desk Accessories', 'Printer Cartridges', 'Pantry Essentials', 'Cleaning Supplies'],
  stationery: ['Notepads & Pens', 'Printing Paper', 'Folders & Binders', 'Stamps & Envelopes'],
  electricity: ['Office Utility Power', 'Generator Fuel / Back-up'],
  internet_telephone: ['Office Broadband / Fiber', 'Mobile Bill Reimbursement', 'VoIP / Landline'],
  rent_maintenance: ['Office Space Rent', 'HVAC / AC Maintenance', 'Building Maintenance Charges', 'Plumbing / Electrical Repairs'],
  software_subscription: ['Cloud Hosting (AWS/GCP/Azure)', 'SaaS Tools & Licenses', 'Developer Tools', 'Domain & Security Certificates'],
  employee_welfare: ['Team Outing', 'Employee Health / Medical First Aid', 'Celebrations & Festivals', 'Training / Workshop'],
  client_meeting: ['Conference Room Rental', 'Client Entertainment', 'Gifts / Hampers for Clients'],
  marketing: ['Online Ads (Google/Meta)', 'Print Material / Brochures', 'Events & Sponsorship', 'Promotional Merchandise'],
  courier: ['Domestic Courier', 'International Shipping', 'Local Document Delivery'],
  repairs_maintenance: ['IT Hardware Repairs', 'Furniture Maintenance', 'Office Equipment Overhaul'],
  miscellaneous: ['Bank Charges', 'Government / Filing Fees', 'General Miscellaneous'],
};

export const COST_CENTERS = [
  'CC-01: Engineering & Technology',
  'CC-02: Human Resources & Admin',
  'CC-03: Sales & Business Development',
  'CC-04: Marketing & Growth',
  'CC-05: Product & Design',
  'CC-06: Operations & Support',
  'CC-07: Finance & Legal',
];

export const CLIENT_PROJECTS = [
  'Internal / Corporate Operations',
  'Project Alpha (FinTech Client)',
  'EMS Shekru Web App',
  'Client Portal Migration',
  'Enterprise CRM Implementation',
  'Cloud Infrastructure Modernization',
  'Client Onboarding - Q4 Initiative',
];

export const PAYMENT_MODES = [
  'Corporate Card',
  'Personal Card (Reimbursement)',
  'UPI / QR Code',
  'Bank Transfer (NEFT/RTGS)',
  'Cash',
];

export default function AddExpensePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supportingFileInputRef = useRef<HTMLInputElement>(null);

  // Form toggle state: opens when user clicks "Add Expenses" button in the header
  const [isFormOpen, setIsFormOpen] = useState<boolean>(true);

  // Form State
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  // Cost Center & Project
  const [costCenter, setCostCenter] = useState<string>(COST_CENTERS[0]);
  const [projectClient, setProjectClient] = useState<string>(CLIENT_PROJECTS[0]);

  // Vendor & Bill
  const [vendorName, setVendorName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [gstDetails, setGstDetails] = useState<string>('');
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billFileName, setBillFileName] = useState<string>('');

  // Payment section (Submitted by employee for reference)
  const [paymentMode, setPaymentMode] = useState<string>('Personal Card (Reimbursement)');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [transactionNumber, setTransactionNumber] = useState<string>('');

  // Supporting files
  const [supportingFiles, setSupportingFiles] = useState<string[]>([]);

  // Submission / Loading state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Sub-categories list computed from selected category
  const availableSubCategories = useMemo(() => {
    if (!selectedCategory) return [];
    return CATEGORY_SUBCATEGORY_MAP[selectedCategory] || ['General'];
  }, [selectedCategory]);

  // Handle Category Change -> Reset Sub-category
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCat = e.target.value;
    setSelectedCategory(nextCat);
    setSelectedSubCategory(''); // Strict requirement: reset sub-category
    if (formErrors.category) {
      setFormErrors((prev) => ({ ...prev, category: '' }));
    }
  };

  // Handle Bill File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (< 10MB) and type
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(fileExt)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a PDF, PNG, JPG, or WEBP file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Maximum attachment size is 10 MB.',
        variant: 'destructive',
      });
      return;
    }

    setBillFile(file);
    setBillFileName(file.name);
    if (formErrors.billFile) {
      setFormErrors((prev) => ({ ...prev, billFile: '' }));
    }
  };

  const handleRemoveFile = () => {
    setBillFile(null);
    setBillFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle Multiple Supporting Files
  const handleSupportingFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newNames: string[] = [];
    for (let i = 0; i < files.length; i++) {
      newNames.push(files[i].name);
    }
    setSupportingFiles((prev) => [...prev, ...newNames]);
    if (supportingFileInputRef.current) {
      supportingFileInputRef.current.value = '';
    }
  };

  const handleRemoveSupportingFile = (indexToRemove: number) => {
    setSupportingFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!expenseTitle.trim()) {
      errors.expenseTitle = 'Expense Title is required.';
    }

    if (!expenseDate) {
      errors.expenseDate = 'Expense date is required.';
    }

    if (!selectedCategory) {
      errors.category = 'Please select an expense category.';
    }

    if (!selectedSubCategory) {
      errors.subCategory = 'Please select a sub-category.';
    }

    if (!description.trim()) {
      errors.description = 'Please provide an expense description.';
    } else if (description.trim().length < 5) {
      errors.description = 'Description must be at least 5 characters.';
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errors.amount = 'Please enter a valid positive amount (₹).';
    }

    if (!costCenter) {
      errors.costCenter = 'Cost center is required.';
    }

    if (!projectClient) {
      errors.projectClient = 'Project / Client is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form Submit to Admin Workflow
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please correct the highlighted fields before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    // Format display date
    const dateObj = new Date(expenseDate);
    const formattedDate = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : expenseDate;

    // Identified logged-in user
    const authenticatedName = user?.name || user?.email?.split('@')[0] || 'Staff Member';
    const authenticatedRole = user?.role ? user.role.toUpperCase() : 'EMPLOYEE';

    // Construct the standard ExpenseItem record for the admin workflow
    const newExpenseRecord = {
      id: Date.now(),
      title: expenseTitle.trim(),
      date: formattedDate,
      employee: authenticatedName,
      role: authenticatedRole,
      category: selectedCategory,
      subCategory: selectedSubCategory,
      description: `${expenseTitle.trim()} - ${selectedSubCategory ? `[${selectedSubCategory}] ` : ''}${description.trim()}`,
      amount: parseFloat(amount),
      status: 'Pending' as const, // Always initial Pending state for Admin approval
      paymentMethod: paymentMode,
      paymentDate: paymentDate || formattedDate,
      transactionNumber: transactionNumber || undefined,
      vendorName: vendorName.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      invoiceDate: invoiceDate || undefined,
      gstDetails: gstDetails.trim() || undefined,
      receiptName: billFileName || 'submitted_invoice.pdf',
      costCenter,
      projectClient,
      supportingFiles,
      createdAt: new Date().toISOString(),
      submittedBy: {
        id: user?.id,
        name: authenticatedName,
        email: user?.email,
        role: user?.role,
      },
    };

    setTimeout(() => {
      try {
        // Read existing records from localStorage
        const existingDataRaw = localStorage.getItem(EXPENSES_STORAGE_KEY);
        let currentExpenses: any[] = [];
        if (existingDataRaw) {
          try {
            currentExpenses = JSON.parse(existingDataRaw);
            if (!Array.isArray(currentExpenses)) currentExpenses = [];
          } catch (e) {
            currentExpenses = [];
          }
        }

        // Add new pending expense to the top
        const updatedList = [newExpenseRecord, ...currentExpenses];
        localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updatedList));

        setIsSubmitting(false);

        toast({
          title: 'Expense Request Submitted',
          description: `Your expense "${expenseTitle.trim()}" of ₹${parseFloat(amount).toLocaleString('en-IN')} has been sent to Admin for approval.`,
        });

        // Reset and close form
        handleReset();
        setIsFormOpen(false);
      } catch (err) {
        setIsSubmitting(false);
        toast({
          title: 'Submission Failed',
          description: 'Failed to record your expense request. Please try again.',
          variant: 'destructive',
        });
      }
    }, 600);
  };

  const handleReset = () => {
    setExpenseTitle('');
    setSelectedCategory('');
    setSelectedSubCategory('');
    setDescription('');
    setAmount('');
    setVendorName('');
    setInvoiceNumber('');
    setInvoiceDate('');
    setGstDetails('');
    handleRemoveFile();
    setSupportingFiles([]);
    setPaymentDate('');
    setTransactionNumber('');
    setFormErrors({});
  };

  // Inside-form Cancel button only
  const handleFormCancel = () => {
    if (expenseTitle || amount || description || selectedCategory) {
      const confirmDiscard = window.confirm('Discard unsaved expense changes?');
      if (!confirmDiscard) return;
    }
    handleReset();
    setIsFormOpen(false);
  };

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      {/* 1. TOP HEADER - Matches existing Staffly Header with "Add Expenses" button replacing "Cancel" */}
      <div className="w-full bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700  min-h-[125px] md:min-h-[135px] px-6 md:px-8 py-5 md:py-6 flex flex-col sm:flex-row items-center justify-between gap-5 md:gap-6 shadow-none transition-all duration-200">
        <div className="flex items-center gap-5 w-full sm:w-auto">
          <div className="w-[65px] h-[65px] md:w-[65px] md:h-[62px] bg-[#4545E9] rounded-[18px] md:rounded-[20px] flex items-center justify-center shrink-0 shadow-sm">
            <Wallet className="w-8 h-8 md:w-[34px] md:h-[34px] text-white stroke-[1.8]" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-[24px] sm:text-[28px] md:text-[32px] font-bold text-black dark:text-white tracking-tight leading-tight mb-1">
              Add Expense Request
            </h1>
            <div className="flex items-center gap-2 text-[13px] sm:text-[14px] font-semibold text-gray-700 dark:text-gray-300">
              <Receipt className="w-4 h-4 text-[#4545E9] stroke-[2.2] shrink-0" />
              <span>Submit your reimbursement claim or company expense to Admin for review</span>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION: "Add Expenses" button replacing former "Cancel" button */}
        <div className="w-full sm:w-auto flex items-center justify-end shrink-0">
          <button
            onClick={() => {
              setIsFormOpen(true);
            }}
            type="button"
            className="w-full sm:w-[155px] md:w-[150px] h-[48px] md:h-[45px] bg-[#4545E9] hover:bg-[#3737D4] active:scale-[0.98] rounded-[14px] border-2 border-black text-white font-bold text-[14px] md:text-[15px] flex items-center justify-center gap-2 transition-all cursor-pointer select-none shadow-sm"
          >
            <Plus className="w-5 h-5 text-white stroke-[2.5]" />
            <span>Add Expenses</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKFLOW PROGRESS STEPPER */}
      <div className="w-full bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[24px] p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-bold text-black dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#4545E9]" />
            Expense Lifecycle Workflow
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-[#4545E9] border border-blue-200 dark:border-blue-900 rounded-full">
            Admin Controlled Process
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
          {/* Step 1: Create Expense */}
          <div className={`flex items-center gap-3 p-3 rounded-[16px] ${isFormOpen
            ? 'bg-[#EEF2FF] dark:bg-indigo-950/40 border-2 border-[#4545E9]'
            : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
            }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isFormOpen ? 'bg-[#4545E9] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
              1
            </div>
            <div className="min-w-0">
              <p className={`text-[13px] font-bold truncate ${isFormOpen ? 'text-[#4545E9]' : 'text-black dark:text-white'}`}>
                Create Expense
              </p>
              <p className="text-[11px] font-medium text-gray-500">
                {isFormOpen ? 'Active Form' : 'Click Add Expenses'}
              </p>
            </div>
          </div>

          {/* Step 2: Submit */}
          <div className="flex items-center gap-3 p-3 rounded-[16px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
              2
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-black dark:text-white truncate">Submit</p>
              <p className="text-[11px] font-medium text-gray-500">Sent to Admin</p>
            </div>
          </div>

          {/* Step 3: Approve / Reject */}
          <div className="flex items-center gap-3 p-3 rounded-[16px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
              3
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-black dark:text-white truncate">Approve / Reject</p>
              <p className="text-[11px] font-medium text-gray-500">Admin Review</p>
            </div>
          </div>

          {/* Step 4: Pay */}
          <div className="flex items-center gap-3 p-3 rounded-[16px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
              4
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-black dark:text-white truncate">Pay</p>
              <p className="text-[11px] font-medium text-gray-500">Finance Disbursal</p>
            </div>
          </div>

          {/* Step 5: Close */}
          <div className="flex items-center gap-3 p-3 rounded-[16px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
              5
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-black dark:text-white truncate">Close</p>
              <p className="text-[11px] font-medium text-gray-500">Archived Record</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ADD EXPENSES FORM (Opened when clicking "Add Expenses" button) */}
      {isFormOpen ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* COMBINED SECTIONS CONTAINER */}
          <div className="bg-white dark:bg-slate-900 border border-black dark:border-slate-700 rounded-2xl md:rounded-[20px] divide-y divide-gray-200 dark:divide-slate-800 shadow-none overflow-hidden">
            {/* SECTION A: EXPENSE DETAILS */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 shadow-none space-y-5">
              <div className="border-b border-gray-200 dark:border-slate-800 pb-3">
                <h3 className="text-xl font-bold text-black dark:text-white tracking-tight flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#4545E9] text-white flex items-center justify-center text-sm font-bold">
                    h
                  </span>
                  Expense Details
                </h3>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Specify the expense title, date, category hierarchy, amount, and business description
                </p>
              </div>

              {/* Expense Title */}
              <div className="space-y-1.5">
                <Label htmlFor="expenseTitle" className="font-bold text-sm text-black dark:text-white">
                  Expense Title <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="expenseTitle"
                  placeholder="e.g. Client Dinner Meeting at Westin, Tech Conference Travel, Monitor Purchase"
                  value={expenseTitle}
                  onChange={(e) => {
                    setExpenseTitle(e.target.value);
                    if (formErrors.expenseTitle) {
                      setFormErrors((prev) => ({ ...prev, expenseTitle: '' }));
                    }
                  }}
                  className={`border-2 border-black dark:border-slate-700 rounded-[12px] h-[46px] font-medium ${formErrors.expenseTitle ? 'border-rose-500 focus-visible:ring-rose-500' : ''
                    }`}
                />
                {formErrors.expenseTitle && (
                  <p className="text-xs font-semibold text-rose-500">{formErrors.expenseTitle}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Expense Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="expenseDate" className="font-bold text-sm text-black dark:text-white">
                    Expense Date <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="expenseDate"
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className={`border-2 border-black dark:border-slate-700 rounded-[12px] h-[46px] font-medium ${formErrors.expenseDate ? 'border-rose-500 focus-visible:ring-rose-500' : ''
                        }`}
                    />
                  </div>
                  {formErrors.expenseDate && (
                    <p className="text-xs font-semibold text-rose-500">{formErrors.expenseDate}</p>
                  )}
                </div>

                {/* Category Dropdown */}
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="font-bold text-sm text-black dark:text-white">
                    Category <span className="text-rose-500">*</span>
                  </Label>
                  <select
                    id="category"
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                    className={`w-full h-[46px] px-3.5 border-2 border-black dark:border-slate-700 rounded-[12px] text-sm font-medium bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9] ${formErrors.category ? 'border-rose-500' : ''
                      }`}
                  >
                    <option value="">-- Select Category --</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.category && (
                    <p className="text-xs font-semibold text-rose-500">{formErrors.category}</p>
                  )}
                </div>

                {/* Dependent Sub-Category Dropdown */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="subCategory" className="font-bold text-sm text-black dark:text-white">
                      Sub-category <span className="text-rose-500">*</span>
                    </Label>
                    {!selectedCategory && (
                      <span className="text-[11px] font-semibold text-amber-600">Select Category First</span>
                    )}
                  </div>
                  <select
                    id="subCategory"
                    value={selectedSubCategory}
                    disabled={!selectedCategory}
                    onChange={(e) => {
                      setSelectedSubCategory(e.target.value);
                      if (formErrors.subCategory) {
                        setFormErrors((prev) => ({ ...prev, subCategory: '' }));
                      }
                    }}
                    className={`w-full h-[46px] px-3.5 border-2 border-black dark:border-slate-700 rounded-[12px] text-sm font-medium bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9] disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-slate-800/40 disabled:cursor-not-allowed ${formErrors.subCategory ? 'border-rose-500' : ''
                      }`}
                  >
                    <option value="">
                      {selectedCategory ? '-- Select Sub-category --' : 'Disabled (Select category above)'}
                    </option>
                    {availableSubCategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                  {formErrors.subCategory && (
                    <p className="text-xs font-semibold text-rose-500">{formErrors.subCategory}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Amount */}
                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="font-bold text-sm text-black dark:text-white">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <IndianRupee className="w-4 h-4 text-gray-500" />
                    </div>
                    <Input
                      id="amount"
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="e.g. 2500"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        if (formErrors.amount) {
                          setFormErrors((prev) => ({ ...prev, amount: '' }));
                        }
                      }}
                      className={`pl-9 border-2 border-black dark:border-slate-700 rounded-[12px] h-[46px] font-semibold text-base ${formErrors.amount ? 'border-rose-500 focus-visible:ring-rose-500' : ''
                        }`}
                    />
                  </div>
                  {formErrors.amount && (
                    <p className="text-xs font-semibold text-rose-500">{formErrors.amount}</p>
                  )}
                </div>

                {/* Description */}
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="description" className="font-bold text-sm text-black dark:text-white">
                    Description / Purpose <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="State the business purpose, meeting attendees, or itemized reason for the expense"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (formErrors.description) {
                        setFormErrors((prev) => ({ ...prev, description: '' }));
                      }
                    }}
                    className={`border-2 border-black dark:border-slate-700 rounded-[12px] min-h-[46px] h-[46px] py-2.5 font-medium resize-none ${formErrors.description ? 'border-rose-500' : ''
                      }`}
                  />
                  {formErrors.description && (
                    <p className="text-xs font-semibold text-rose-500">{formErrors.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION B: EMPLOYEE DETAILS (Auto-Identified, Non-Editable Name) */}
            <div className="bg-transparent p-0 shadow-none space-y-5">
              <div className="border-b border-gray-200 dark:border-slate-800 pb-3">
                <h3 className="text-xl font-bold text-black dark:text-white tracking-tight flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#4545E9] text-white flex items-center justify-center text-sm font-bold">
                    B
                  </span>
                  Employee Details
                </h3>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Identified logged-in profile and allocation center (Employee Name is locked to current user)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Employee Name - Non-editable, automatically identified */}
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm text-black dark:text-white flex items-center justify-between">
                    <span>Employee Name</span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Auto-Identified
                    </span>
                  </Label>
                  <div className="h-[46px] px-3.5 border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 rounded-[12px] flex items-center justify-between select-none">
                    <span className="font-bold text-sm text-black dark:text-white">
                      {user?.name || user?.email || 'Logged-in Staff Member'}
                    </span>
                    <span className="bg-[#4545E9]/10 text-[#4545E9] text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                      {user?.role || 'Employee'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Logged in ID: {user?.id || 'AUTH-SESSION'} · {user?.email || 'N/A'}
                  </p>
                </div>

                {/* Cost Center */}
                <div className="space-y-1.5">
                  <Label htmlFor="costCenter" className="font-bold text-sm text-black dark:text-white">
                    Cost Center <span className="text-rose-500">*</span>
                  </Label>
                  <select
                    id="costCenter"
                    value={costCenter}
                    onChange={(e) => setCostCenter(e.target.value)}
                    className="w-full h-[46px] px-3.5 border-2 border-black dark:border-slate-700 rounded-[12px] text-sm font-medium bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9]"
                  >
                    {COST_CENTERS.map((cc) => (
                      <option key={cc} value={cc}>
                        {cc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Project / Client */}
                <div className="space-y-1.5">
                  <Label htmlFor="projectClient" className="font-bold text-sm text-black dark:text-white">
                    Project / Client <span className="text-rose-500">*</span>
                  </Label>
                  <select
                    id="projectClient"
                    value={projectClient}
                    onChange={(e) => setProjectClient(e.target.value)}
                    className="w-full h-[46px] px-3.5 border-2 border-black dark:border-slate-700 rounded-[12px] text-sm font-medium bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9]"
                  >
                    {CLIENT_PROJECTS.map((pj) => (
                      <option key={pj} value={pj}>
                        {pj}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION C: VENDOR & BILL */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 shadow-none space-y-5">
              <div className="border-b border-gray-200 dark:border-slate-800 pb-3">
                <h3 className="text-xl font-bold text-black dark:text-white tracking-tight flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#4545E9] text-white flex items-center justify-center text-sm font-bold">
                    C
                  </span>
                  Vendor & Bill
                </h3>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Details from the official merchant invoice, bill copy, or receipt
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Vendor Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="vendorName" className="font-bold text-sm text-black dark:text-white">
                    Vendor Name
                  </Label>
                  <Input
                    id="vendorName"
                    placeholder="e.g. Uber India, Amazon, Staples"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="border-2 border-black dark:border-slate-700 rounded-[12px] h-[46px]"
                  />
                </div>

                {/* Invoice Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="invoiceNumber" className="font-bold text-sm text-black dark:text-white">
                    Invoice Number
                  </Label>
                  <Input
                    id="invoiceNumber"
                    placeholder="e.g. INV-2026-9041"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="border-2 border-black dark:border-slate-700 rounded-[12px] h-[46px]"
                  />
                </div>

                {/* Invoice Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="invoiceDate" className="font-bold text-sm text-black dark:text-white">
                    Invoice Date
                  </Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="border-2 border-black dark:border-slate-700 rounded-[12px] h-[46px]"
                  />
                </div>

                {/* GST Details */}
                <div className="space-y-1.5">
                  <Label htmlFor="gstDetails" className="font-bold text-sm text-black dark:text-white">
                    GST Details / GSTIN
                  </Label>
                  <Input
                    id="gstDetails"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={gstDetails}
                    onChange={(e) => setGstDetails(e.target.value)}
                    className="border-2 border-black dark:border-slate-700 rounded-[12px] h-[46px]"
                  />
                </div>
              </div>

              {/* Bill Upload */}
              <div className="space-y-2 pt-2">
                <Label className="font-bold text-sm text-black dark:text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#4545E9]" />
                  Bill Upload (PDF, PNG, JPG, or WEBP up to 10MB)
                </Label>

                <div className="border-2 border-dashed border-black dark:border-slate-700 rounded-[20px] p-5 text-center bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="billUploadInput"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {!billFileName ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-2">
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-[#4545E9]">
                        <Upload className="w-6 h-6 stroke-[2]" />
                      </div>
                      <div className="text-sm font-semibold text-black dark:text-white">
                        Drop invoice here or{' '}
                        <label
                          htmlFor="billUploadInput"
                          className="text-[#4545E9] hover:underline cursor-pointer"
                        >
                          browse files
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">Supports PDF, PNG, JPG up to 10MB</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[14px] p-3.5 max-w-lg mx-auto">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="font-bold text-sm text-black dark:text-white truncate">
                          {billFileName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION D: PAYMENT (Details provided by employee; Status locked to pending) */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 shadow-none space-y-5">
              <div className="border-b border-gray-200 dark:border-slate-800 pb-3">
                <h3 className="text-xl font-bold text-black dark:text-white tracking-tight flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#4545E9] text-white flex items-center justify-center text-sm font-bold">
                    D
                  </span>
                  Payment Information
                </h3>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Employee submission details; Payment Status is controlled exclusively by Finance/Admin
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Payment Mode */}
                <div className="space-y-1.5">
                  <Label htmlFor="paymentMode" className="font-bold text-sm text-black dark:text-white">
                    Payment Mode
                  </Label>
                  <select
                    id="paymentMode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-[46px] px-3.5 border-2 border-black dark:border-slate-700 rounded-[12px] text-sm font-medium bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9]"
                  >
                    {PAYMENT_MODES.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="paymentDate" className="font-bold text-sm text-black dark:text-white">
                    Payment Date
                  </Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="border-2 border-black dark:border-slate-700 rounded-[12px] h-[46px]"
                  />
                </div>

                {/* Transaction Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="transactionNumber" className="font-bold text-sm text-black dark:text-white">
                    Transaction / UTR Number
                  </Label>
                  <Input
                    id="transactionNumber"
                    placeholder="e.g. UTR2930419028"
                    value={transactionNumber}
                    onChange={(e) => setTransactionNumber(e.target.value)}
                    className="border-2 border-black dark:border-slate-700 rounded-[12px] h-[46px]"
                  />
                </div>

                {/* Payment Status (Controlled, read-only for employees) */}
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm text-black dark:text-white flex items-center justify-between">
                    <span>Payment Status</span>
                    <span className="text-[11px] font-semibold text-gray-500">System Controlled</span>
                  </Label>
                  <div className="h-[46px] px-3.5 border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 rounded-[12px] flex items-center justify-between select-none">
                    <span className="font-bold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Unpaid (Pending Approval)
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-extrabold uppercase">
                      Locked
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* INSIDE-FORM BUTTONS: Cancel & Submit Request ONLY */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleFormCancel}
              disabled={isSubmitting}
              className="w-full sm:w-[130px] h-[48px] rounded-[14px] border-2 border-black font-bold text-[15px]"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-[200px] h-[48px] bg-[#4545E9] hover:bg-[#3737D4] active:scale-[0.98] text-white font-bold text-[15px] rounded-[14px] border-2 border-black flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  <span>Submit Request</span>
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        /* Empty / Minimized State when Form is Closed */
        <div className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-black dark:border-slate-700 rounded-[28px] p-10 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-[#4545E9]">
            <Receipt className="w-7 h-7 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-black dark:text-white">Ready to Submit an Expense?</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Click the <strong className="text-black dark:text-white">Add Expenses</strong> button in the top header to open the expense creation form.
            </p>
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            type="button"
            className="px-6 h-[46px] bg-[#4545E9] hover:bg-[#3737D4] active:scale-[0.98] rounded-[14px] border-2 border-black text-white font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Open Expense Form</span>
          </button>
        </div>
      )}
    </div>
  );
}
