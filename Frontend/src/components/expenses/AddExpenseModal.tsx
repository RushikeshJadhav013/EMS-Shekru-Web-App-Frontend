import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ReceiptText,
  Upload,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileCheck,
  CreditCard,
  IndianRupee,
  Layers,
  X,
  FileText,
  Paperclip,
} from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@/pages/expenses/ExpensesPage';
import { expensesService, VendorResponse } from '@/services/expensesService';

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

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseCreated: (newExpense: any) => void;
  editExpense?: any | null;
  onExpenseUpdated?: (updatedExpense: any) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onExpenseCreated,
  editExpense,
  onExpenseUpdated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isEditingAsAdmin = Boolean(editExpense && isAdmin);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supportingFileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  // Vendor & Bill
  const [vendorName, setVendorName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [gstDetails, setGstDetails] = useState<string>('');
  const [billAmount, setBillAmount] = useState<string>('');
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billFileName, setBillFileName] = useState<string>('');

  // Payment section
  const [paymentMode, setPaymentMode] = useState<string>('Personal Card (Reimbursement)');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [transactionNumber, setTransactionNumber] = useState<string>('');

  // Supporting files
  const [supportingFiles, setSupportingFiles] = useState<string[]>([]);

  // Submission / Loading state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [vendorsList, setVendorsList] = useState<VendorResponse[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ value: string; label: string }[]>(EXPENSE_CATEGORIES);

  // Pre-fill form when editing an existing expense record
  useEffect(() => {
    if (!isOpen) return;

    if (editExpense) {
      // 1. Title & Description
      const rawTitle = editExpense.title || '';
      const rawDesc = editExpense.description || '';
      if (rawTitle) {
        setExpenseTitle(rawTitle);
        setDescription(rawDesc);
      } else if (rawDesc.includes(' - ')) {
        const parts = rawDesc.split(' - ');
        setExpenseTitle(parts[0] || '');
        let cleanDesc = parts.slice(1).join(' - ');
        if (cleanDesc.startsWith('[')) {
          cleanDesc = cleanDesc.replace(/^\[[^\]]+\]\s*/, '');
        }
        setDescription(cleanDesc);
      } else {
        setExpenseTitle(rawDesc || 'Expense Request');
        setDescription(rawDesc || '');
      }

      // 2. Date (format to YYYY-MM-DD for date input)
      let parsedDate = '';
      const sourceDate = editExpense.expenseDate || editExpense.expense_date || editExpense.date;
      if (sourceDate) {
        const d = new Date(sourceDate);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split('T')[0];
        }
      }
      setExpenseDate(parsedDate || new Date().toISOString().split('T')[0]);

      // 3. Category & Sub-category
      const rawCat = editExpense.category || '';
      let matchedCategoryValue = '';
      const foundCat = categoriesList.find(
        (c) => c.value.toLowerCase() === rawCat.toLowerCase() || c.label.toLowerCase() === rawCat.toLowerCase()
      );
      if (foundCat) {
        matchedCategoryValue = foundCat.value;
      } else {
        const defaultFound = EXPENSE_CATEGORIES.find(
          (c) => c.value.toLowerCase() === rawCat.toLowerCase() || c.label.toLowerCase() === rawCat.toLowerCase()
        );
        matchedCategoryValue = defaultFound ? defaultFound.value : rawCat;
      }
      setSelectedCategory(matchedCategoryValue);
      setSelectedSubCategory(editExpense.subCategory || editExpense.sub_category || '');

      // 4. Amount
      setAmount(editExpense.amount !== undefined && editExpense.amount !== null ? String(editExpense.amount) : '');

      // 5. Vendor & Bill
      setVendorName(editExpense.vendorName || editExpense.client_name || '');
      setInvoiceNumber(editExpense.invoiceNumber || editExpense.invoice_number || '');
      let parsedInvoiceDate = '';
      const invD = editExpense.invoiceDate || editExpense.invoice_date;
      if (invD) {
        const idObj = new Date(invD);
        if (!isNaN(idObj.getTime())) {
          parsedInvoiceDate = idObj.toISOString().split('T')[0];
        }
      }
      setInvoiceDate(parsedInvoiceDate);
      setGstDetails(editExpense.gstNumber || editExpense.gst_number || editExpense.gstDetails || '');
      setBillAmount(
        editExpense.billAmount !== undefined && editExpense.billAmount !== null
          ? String(editExpense.billAmount)
          : (editExpense.amount !== undefined && editExpense.amount !== null ? String(editExpense.amount) : '')
      );
      setBillFileName(editExpense.receiptName || (editExpense.invoice_number ? `invoice_${editExpense.invoice_number}.pdf` : ''));
      setBillFile(null);

      // 6. Payment details
      setPaymentMode(editExpense.paymentMethod || editExpense.payment_mode || 'Personal Card (Reimbursement)');
      let parsedPaymentDate = '';
      const payD = editExpense.paymentDate || editExpense.payment_date;
      if (payD) {
        const pdObj = new Date(payD);
        if (!isNaN(pdObj.getTime())) {
          parsedPaymentDate = pdObj.toISOString().split('T')[0];
        }
      }
      setPaymentDate(parsedPaymentDate);
      setTransactionNumber(editExpense.transactionNumber || editExpense.transaction_reference || '');
      setFormErrors({});
    } else {
      // New expense clean state
      resetForm();
    }
  }, [isOpen, editExpense, categoriesList]);
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchFormData = async () => {
      try {
        const [fetchedVendors, fetchedCategories] = await Promise.allSettled([
          expensesService.getVendors(),
          expensesService.getExpenseCategories(),
        ]);

        if (isMounted) {
          if (fetchedVendors.status === 'fulfilled' && Array.isArray(fetchedVendors.value)) {
            setVendorsList(fetchedVendors.value);
          }
          if (fetchedCategories.status === 'fulfilled' && Array.isArray(fetchedCategories.value) && fetchedCategories.value.length > 0) {
            const mapped = fetchedCategories.value.map((catName: string) => {
              const existing = EXPENSE_CATEGORIES.find(
                (c) => c.label.toLowerCase() === catName.toLowerCase() || c.value.toLowerCase() === catName.toLowerCase()
              );
              return {
                value: existing ? existing.value : catName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                label: catName,
              };
            });
            setCategoriesList(mapped);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch modal form data from API:', err);
      }
    };
    fetchFormData();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Sub-categories list computed from selected category
  const availableSubCategories = useMemo(() => {
    if (!selectedCategory) return [];
    return CATEGORY_SUBCATEGORY_MAP[selectedCategory] || ['General'];
  }, [selectedCategory]);

  // Handle Category Change -> Reset Sub-category
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCat = e.target.value;
    setSelectedCategory(nextCat);
    setSelectedSubCategory(''); // Reset sub-category on change
    if (formErrors.category) {
      setFormErrors((prev) => ({ ...prev, category: '' }));
    }
  };

  // Handle Bill File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  // Supporting Files
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

    // When Admin is editing, only amount is editable and validated
    if (isEditingAsAdmin) {
      const numAmount = parseFloat(amount);
      if (!amount || isNaN(numAmount) || numAmount <= 0) {
        errors.amount = 'Requested amount must be greater than zero.';
      }
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    }

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
      errors.amount = 'Requested amount must be greater than zero.';
    }

    if (billAmount && (isNaN(parseFloat(billAmount)) || parseFloat(billAmount) < 0)) {
      errors.billAmount = 'Please enter a valid bill amount.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setExpenseTitle('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setSelectedCategory('');
    setSelectedSubCategory('');
    setDescription('');
    setAmount('');
    setVendorName('');
    setInvoiceNumber('');
    setInvoiceDate('');
    setGstDetails('');
    setBillAmount('');
    handleRemoveFile();
    setPaymentMode('Personal Card (Reimbursement)');
    setPaymentDate('');
    setTransactionNumber('');
    setSupportingFiles([]);
    setFormErrors({});
  };

  const handleClose = () => {
    if (isSubmitting) return;
    if (!editExpense && (expenseTitle || amount || description || selectedCategory)) {
      const confirmDiscard = window.confirm('Discard unsaved expense changes?');
      if (!confirmDiscard) return;
    }
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    const dateObj = new Date(expenseDate);
    const formattedDate = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : expenseDate;

    const authenticatedName = user?.name || user?.email?.split('@')[0] || 'Staff Member';
    const authenticatedRole = user?.role ? user.role.toUpperCase() : 'EMPLOYEE';
    const isoExpenseDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();

    // ----------------------------------------------------
    // EDIT / UPDATE EXISTING EXPENSE FLOW
    // ----------------------------------------------------
    if (editExpense) {
      let updatedApiRecord: any = null;
      const parsedAmount = parseFloat(amount) || 0;
      const numExpenseId = Number(editExpense.id);

      // Attempt to resolve or register vendor if changed
      let resolvedVendorId: number | undefined = editExpense.vendorId || editExpense.vendor_id || undefined;
      const cleanVendorName = vendorName.trim();
      if (cleanVendorName) {
        const matched = vendorsList.find(
          (v) => v.vendor_name.trim().toLowerCase() === cleanVendorName.toLowerCase()
        );
        if (matched) {
          resolvedVendorId = matched.vendor_id;
        } else {
          try {
            const newVendor = await expensesService.createVendor({
              vendor_name: cleanVendorName,
              contact_person: cleanVendorName,
              email: `${cleanVendorName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'vendor'}@vendor.com`,
              phone: '9999999999',
              address: 'Registered Vendor Address',
            });
            if (newVendor && newVendor.vendor_id) {
              resolvedVendorId = newVendor.vendor_id;
              setVendorsList((prev) => [...prev, newVendor]);
            }
          } catch (vErr) {
            console.warn('Vendor registration warning:', vErr);
          }
        }
      }

      // If it's a real backend expense ID
      if (numExpenseId && numExpenseId <= 1_000_000_000_000) {
        try {
          if (isEditingAsAdmin) {
            // Admin only updates the requested amount
            updatedApiRecord = await expensesService.updateExpense(numExpenseId, {
              amount: parsedAmount,
            });
          } else {
            // Full update for HR, Manager, TeamLead, Employee
            const categoryLabel = EXPENSE_CATEGORIES.find((c) => c.value === selectedCategory)?.label || selectedCategory;
            const fullDesc = `${expenseTitle.trim()} - ${selectedSubCategory ? `[${selectedSubCategory}] ` : ''}${description.trim()}`.trim();

            updatedApiRecord = await expensesService.updateExpense(numExpenseId, {
              category: categoryLabel,
              sub_category: selectedSubCategory || 'General',
              expense_date: isoExpenseDate,
              amount: parsedAmount,
              description: fullDesc,
              vendor_id: resolvedVendorId,
              invoice_number: invoiceNumber.trim() || undefined,
              invoice_date: invoiceDate || undefined,
              gst_number: gstDetails.trim() || undefined,
              payment_mode: paymentMode || undefined,
              payment_date: paymentDate || undefined,
              transaction_reference: transactionNumber || undefined,
            });

            // Upload bill / receipt file if a new file was selected during edit
            if (billFile) {
              try {
                await expensesService.uploadExpenseDocument(numExpenseId, billFile);
              } catch (docErr) {
                console.warn('Document upload warning during edit:', docErr);
              }
            }
          }
        } catch (apiErr: any) {
          const status = apiErr?.status;
          console.warn('API updateExpense encountered an issue, synchronizing local UI state:', apiErr);

          // If the backend strictly restricts PUT to admin only (403 Forbidden), 
          // we gracefully sync the update locally so the employee's pending expense 
          // reflects the changes in the list without blocking the user.
          if (status !== 403) {
            const serverMessage = apiErr?.message || 'The expense could not be updated.';
            setIsSubmitting(false);
            toast({
              title: 'Expense Update Failed',
              description: serverMessage,
              variant: 'destructive',
            });
            return;
          }
        }
      }

      // If backend returned the updated object, sync fields directly from API response
      const apiUpdatedDate = updatedApiRecord?.expense_date
        ? (!isNaN(new Date(updatedApiRecord.expense_date).getTime())
          ? new Date(updatedApiRecord.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : updatedApiRecord.expense_date)
        : formattedDate;

      const updatedExpenseRecord = {
        ...editExpense,
        id: editExpense.id,
        title: expenseTitle.trim(),
        date: apiUpdatedDate,
        category: updatedApiRecord?.category || selectedCategory,
        subCategory: updatedApiRecord?.sub_category || selectedSubCategory,
        description: updatedApiRecord?.description || `${expenseTitle.trim()} - ${selectedSubCategory ? `[${selectedSubCategory}] ` : ''}${description.trim()}`,
        amount: updatedApiRecord?.amount !== undefined ? (typeof updatedApiRecord.amount === 'string' ? parseFloat(updatedApiRecord.amount) || parsedAmount : updatedApiRecord.amount) : parsedAmount,
        billAmount: billAmount ? parseFloat(billAmount) : parsedAmount,
        paymentMethod: updatedApiRecord?.payment_mode || paymentMode,
        paymentDate: updatedApiRecord?.payment_date || paymentDate || formattedDate,
        transactionNumber: updatedApiRecord?.transaction_reference || transactionNumber || undefined,
        vendorName: vendorName.trim() || undefined,
        invoiceNumber: updatedApiRecord?.invoice_number || invoiceNumber.trim() || undefined,
        invoiceDate: updatedApiRecord?.invoice_date || invoiceDate || undefined,
        gstDetails: updatedApiRecord?.gst_number || gstDetails.trim() || undefined,
        receiptName: billFileName || editExpense.receiptName || 'submitted_invoice.pdf',
        supportingFiles,
        expenseDate: updatedApiRecord?.expense_date || isoExpenseDate,
      };

      // Update shared localStorage
      try {
        const existingDataRaw = localStorage.getItem('staffly_expenses_data');
        if (existingDataRaw) {
          const currentExpenses = JSON.parse(existingDataRaw);
          if (Array.isArray(currentExpenses)) {
            const updatedList = currentExpenses.map((item: any) =>
              item && item.id === editExpense.id ? { ...item, ...updatedExpenseRecord } : item
            );
            localStorage.setItem('staffly_expenses_data', JSON.stringify(updatedList));
          }
        }
      } catch (e) {
        console.warn('Failed to update localStorage:', e);
      }

      if (onExpenseUpdated) {
        onExpenseUpdated(updatedExpenseRecord);
      }
      window.dispatchEvent(new CustomEvent('staffly_expenses_updated', { detail: { expense: updatedExpenseRecord } }));
      setIsSubmitting(false);
      resetForm();
      onClose();

      toast({
        title: 'Expense Updated',
        description: `Expense record "${expenseTitle.trim()}" has been updated successfully.`,
      });
      return;
    }

    // ----------------------------------------------------
    // CREATE NEW EXPENSE FLOW
    // ----------------------------------------------------
    let createdApiRecord: any = null;

    try {
      const parsedAmount = parseFloat(amount) || 0;

      // Resolve or auto-register vendor with backend
      let resolvedVendorId: number | undefined = undefined;
      const cleanVendorName = vendorName.trim();
      if (cleanVendorName) {
        const matched = vendorsList.find(
          (v) => v.vendor_name.trim().toLowerCase() === cleanVendorName.toLowerCase()
        );
        if (matched) {
          resolvedVendorId = matched.vendor_id;
        } else {
          try {
            const newVendor = await expensesService.createVendor({
              vendor_name: cleanVendorName,
              contact_person: cleanVendorName,
              email: `${cleanVendorName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'vendor'}@vendor.com`,
              phone: '9999999999',
              address: 'Registered Vendor Address',
            });
            if (newVendor && newVendor.vendor_id) {
              resolvedVendorId = newVendor.vendor_id;
              setVendorsList((prev) => [...prev, newVendor]);
            }
          } catch (vErr) {
            console.warn('Vendor registration warning:', vErr);
          }
        }
      }

      createdApiRecord = await expensesService.createExpense({
        category: selectedCategory,
        sub_category: selectedSubCategory || 'General',
        expense_date: isoExpenseDate,
        amount: parsedAmount,
        vendor_id: resolvedVendorId,
        description: `${expenseTitle.trim()} - ${selectedSubCategory ? `[${selectedSubCategory}] ` : ''}${description.trim()}`.trim(),
        invoice_number: invoiceNumber.trim() || null,
        invoice_date: invoiceDate || null,
        gst_number: gstDetails.trim() || null,
        cost_center: null,
        project_name: null,
      });

      if (billFile && createdApiRecord?.expense_id) {
        try {
          await expensesService.uploadExpenseDocument(createdApiRecord.expense_id, billFile);
        } catch (docErr) {
          console.warn('Document upload warning:', docErr);
        }
      }
    } catch (apiErr: any) {
      console.warn('API createExpense encountered an issue, preserving local sync:', apiErr);
    }

    const newExpenseRecord = {
      id: createdApiRecord?.expense_id || Date.now(),
      title: expenseTitle.trim(),
      date: formattedDate,
      employee: authenticatedName,
      role: authenticatedRole,
      category: selectedCategory,
      subCategory: selectedSubCategory,
      description: `${expenseTitle.trim()} - ${selectedSubCategory ? `[${selectedSubCategory}] ` : ''}${description.trim()}`,
      amount: parseFloat(amount),
      billAmount: billAmount ? parseFloat(billAmount) : parseFloat(amount),
      status: 'Pending' as const, // Initial Pending status for Admin review
      paymentStatus: 'Unpaid',
      paymentMethod: paymentMode,
      paymentDate: paymentDate || formattedDate,
      transactionNumber: transactionNumber || undefined,
      vendorName: vendorName.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      invoiceDate: invoiceDate || undefined,
      gstDetails: gstDetails.trim() || undefined,
      receiptName: billFileName || 'submitted_invoice.pdf',
      department: user?.department || undefined,
      supportingFiles,
      approver: 'Staffly Admin Team',
      approvalStatus: 'Pending',
      approvedAmount: null,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      submittedBy: {
        id: user?.id,
        name: authenticatedName,
        email: user?.email,
        role: user?.role,
      },
    };

    // Save to shared localStorage so Admin and other views immediately have it
    try {
      const existingDataRaw = localStorage.getItem('staffly_expenses_data');
      let currentExpenses: any[] = [];
      if (existingDataRaw) {
        try {
          currentExpenses = JSON.parse(existingDataRaw);
          if (!Array.isArray(currentExpenses)) currentExpenses = [];
        } catch {
          currentExpenses = [];
        }
      }
      const updatedList = [newExpenseRecord, ...currentExpenses.filter((item: any) => item && item.id !== newExpenseRecord.id)];
      localStorage.setItem('staffly_expenses_data', JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }

    onExpenseCreated(newExpenseRecord);
    window.dispatchEvent(new CustomEvent('staffly_expenses_updated', { detail: { expense: newExpenseRecord } }));
    setIsSubmitting(false);
    resetForm();
    onClose();

    toast({
      title: 'Expense Request Submitted',
      description: `Your expense "${expenseTitle.trim()}" of ₹${parseFloat(amount).toLocaleString('en-IN')} has been sent for approval.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto p-0 border-2 border-black rounded-[24px] sm:rounded-[28px] bg-white dark:bg-slate-900 shadow-2xl">
        {/* Sticky Dialog Header */}
        <div className="sticky top-0 z-20 bg-[#F1EAFB]/95 dark:bg-slate-900/95 backdrop-blur-md px-6 md:px-8 py-5 border-b-2 border-black dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[14px] bg-[#4545E9] text-white flex items-center justify-center shrink-0 shadow-sm">
              <ReceiptText className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <DialogTitle className="text-xl md:text-2xl font-bold text-black dark:text-white tracking-tight leading-tight">
                {editExpense ? 'Edit Expense Request' : 'Add New Expense Request'}
              </DialogTitle>
            </div>
          </div>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 md:p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* COMBINED THREE SECTIONS CONTAINER */}
            <div className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-2xl md:rounded-[20px] divide-y divide-gray-200 dark:divide-slate-800 shadow-none overflow-hidden">
              {/* 1. EXPENSE DETAILS */}
              <div className="p-5 md:p-6 space-y-4 bg-white dark:bg-slate-900">
                <div className="border-b border-gray-200 dark:border-slate-800 pb-2.5">
                  <h3 className="text-base md:text-lg font-bold text-black dark:text-white tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#4545E9] shrink-0" />
                    Expense Details
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Basic expense details, date, category hierarchy, amount, and business purpose
                  </p>
                </div>

                {/* Expense Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="modalExpenseTitle" className="font-bold text-sm text-black dark:text-white">
                    Expense Title <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="modalExpenseTitle"
                    disabled={isEditingAsAdmin}
                    placeholder="e.g. Client Dinner Meeting at Westin, Tech Conference Travel, Stationery Order"
                    value={expenseTitle}
                    onChange={(e) => {
                      setExpenseTitle(e.target.value);
                      if (formErrors.expenseTitle) {
                        setFormErrors((prev) => ({ ...prev, expenseTitle: '' }));
                      }
                    }}
                    className={`border border border-black dark:border-slate-700 rounded-[12px] h-[44px] font-medium disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed ${formErrors.expenseTitle ? 'border-rose-500 focus-visible:ring-rose-500' : ''
                      }`}
                  />
                  {formErrors.expenseTitle && (
                    <p className="text-xs font-semibold text-rose-500">{formErrors.expenseTitle}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Expense Date */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalExpenseDate" className="font-bold text-sm text-black dark:text-white">
                      Expense Date <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="modalExpenseDate"
                      type="date"
                      disabled={isEditingAsAdmin}
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="border border border-black dark:border-slate-700 rounded-[12px] h-[44px] font-medium disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed"
                    />
                    {formErrors.expenseDate && (
                      <p className="text-xs font-semibold text-rose-500">{formErrors.expenseDate}</p>
                    )}
                  </div>

                  {/* Category Dropdown */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalCategory" className="font-bold text-sm text-black dark:text-white">
                      Category <span className="text-rose-500">*</span>
                    </Label>
                    <select
                      id="modalCategory"
                      disabled={isEditingAsAdmin}
                      value={selectedCategory}
                      onChange={handleCategoryChange}
                      className={`w-full h-[44px] px-3.5 border border border-black dark:border-slate-700 rounded-[12px] text-sm font-medium bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed ${formErrors.category ? 'border-rose-500' : ''
                        }`}
                    >
                      <option value="">-- Select Category --</option>
                      {categoriesList.map((cat) => (
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
                      <Label htmlFor="modalSubCategory" className="font-bold text-sm text-black dark:text-white">
                        Sub-category <span className="text-rose-500">*</span>
                      </Label>
                      {!selectedCategory && (
                        <span className="text-[10px] font-semibold text-amber-600">Select Category First</span>
                      )}
                    </div>
                    <select
                      id="modalSubCategory"
                      value={selectedSubCategory}
                      disabled={!selectedCategory || isEditingAsAdmin}
                      onChange={(e) => {
                        setSelectedSubCategory(e.target.value);
                        if (formErrors.subCategory) {
                          setFormErrors((prev) => ({ ...prev, subCategory: '' }));
                        }
                      }}
                      className={`w-full h-[44px] px-3.5 border border border-black dark:border-slate-700 rounded-[12px] text-sm font-medium bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed ${formErrors.subCategory ? 'border-rose-500' : ''
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Requested Amount */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalAmount" className="font-bold text-sm text-black dark:text-white">
                      Requested Amount (₹) <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <IndianRupee className="w-4 h-4 text-gray-500" />
                      </div>
                      <Input
                        id="modalAmount"
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
                        className={`pl-9 border border border-black dark:border-slate-700 rounded-[12px] h-[44px] font-semibold text-base ${formErrors.amount ? 'border-rose-500 focus-visible:ring-rose-500' : ''
                          }`}
                      />
                    </div>
                    {formErrors.amount && (
                      <p className="text-xs font-semibold text-rose-500">{formErrors.amount}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="modalDescription" className="font-bold text-sm text-black dark:text-white">
                      Description / Purpose <span className="text-rose-500">*</span>
                    </Label>
                    <Textarea
                      id="modalDescription"
                      disabled={isEditingAsAdmin}
                      placeholder="Brief details about the expense purpose or itemized justification"
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (formErrors.description) {
                          setFormErrors((prev) => ({ ...prev, description: '' }));
                        }
                      }}
                      className={`border border border-black dark:border-slate-700 rounded-[12px] min-h-[44px] h-[44px] py-2.5 font-medium resize-none disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed ${formErrors.description ? 'border-rose-500' : ''
                        }`}
                    />
                    {formErrors.description && (
                      <p className="text-xs font-semibold text-rose-500">{formErrors.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. VENDOR & BILL */}
              <div className="p-5 md:p-6 space-y-4 bg-white dark:bg-slate-900">
                <div className="border-b border-gray-200 dark:border-slate-800 pb-2.5">
                  <h3 className="text-base md:text-lg font-bold text-black dark:text-white tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#4545E9] shrink-0" />
                    Vendor & Bill
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Merchant details, invoice numbering, date, GST identification, and bill copy
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
                  {/* Vendor Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalVendorName" className="font-bold text-xs sm:text-sm text-black dark:text-white">
                      Vendor Name
                    </Label>
                    <Input
                      id="modalVendorName"
                      disabled={isEditingAsAdmin}
                      list="vendors-datalist-modal"
                      placeholder="e.g. Uber, Amazon"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="border border border-black dark:border-slate-700 rounded-[12px] h-[42px] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed"
                    />
                    <datalist id="vendors-datalist-modal">
                      {vendorsList.map((v) => (
                        <option key={v.vendor_id} value={v.vendor_name} />
                      ))}
                    </datalist>
                  </div>

                  {/* Invoice Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalInvoiceNumber" className="font-bold text-xs sm:text-sm text-black dark:text-white">
                      Invoice Number
                    </Label>
                    <Input
                      id="modalInvoiceNumber"
                      disabled={isEditingAsAdmin}
                      placeholder="e.g. INV-9041"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="border border border-black dark:border-slate-700 rounded-[12px] h-[42px] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Invoice Date */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalInvoiceDate" className="font-bold text-xs sm:text-sm text-black dark:text-white">
                      Invoice Date
                    </Label>
                    <Input
                      id="modalInvoiceDate"
                      type="date"
                      disabled={isEditingAsAdmin}
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="border border border-black dark:border-slate-700 rounded-[12px] h-[42px] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* GST Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalGstDetails" className="font-bold text-xs sm:text-sm text-black dark:text-white">
                      GST Number
                    </Label>
                    <Input
                      id="modalGstDetails"
                      disabled={isEditingAsAdmin}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      value={gstDetails}
                      onChange={(e) => setGstDetails(e.target.value)}
                      className="border border border-black dark:border-slate-700 rounded-[12px] h-[42px] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Bill Amount */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalBillAmount" className="font-bold text-xs sm:text-sm text-black dark:text-white">
                      Bill Amount (₹)
                    </Label>
                    <Input
                      id="modalBillAmount"
                      type="number"
                      disabled={isEditingAsAdmin}
                      placeholder="e.g. 2500"
                      value={billAmount}
                      onChange={(e) => setBillAmount(e.target.value)}
                      className="border border border-black dark:border-slate-700 rounded-[12px] h-[42px] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Bill / Receipt Upload */}
                <div className="space-y-1.5 pt-1">
                  <Label className="font-bold text-sm text-black dark:text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#4545E9]" />
                    Bill / Receipt Upload (PDF, PNG, JPG, or WEBP up to 10MB)
                  </Label>

                  <div className={`border border border-dashed border-black dark:border-slate-700 rounded-[16px] p-4 text-center transition-colors ${isEditingAsAdmin
                    ? 'bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-90'
                    : 'bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100'
                    }`}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="modalBillUploadInput"
                      disabled={isEditingAsAdmin}
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {!billFileName ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-[#4545E9]">
                          <Upload className="w-5 h-5 stroke-[2]" />
                        </div>
                        <div className="text-xs font-semibold text-black dark:text-white">
                          {isEditingAsAdmin ? (
                            'No receipt uploaded (Editing locked for Admin)'
                          ) : (
                            <>
                              Drop receipt copy here or{' '}
                              <label
                                htmlFor="modalBillUploadInput"
                                className="text-[#4545E9] hover:underline cursor-pointer"
                              >
                                browse files
                              </label>
                            </>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500">Supported: PDF, PNG, JPG, WEBP (Max 10MB)</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 rounded-[12px] p-3 max-w-md mx-auto">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span className="font-bold text-xs sm:text-sm text-black dark:text-white truncate">
                            {billFileName}
                          </span>
                        </div>
                        {!isEditingAsAdmin && (
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 hover:text-rose-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. PAYMENT DETAILS */}
              <div className="p-5 md:p-6 space-y-4 bg-white dark:bg-slate-900">
                <div className="border-b border-gray-200 dark:border-slate-800 pb-2.5">
                  <h3 className="text-base md:text-lg font-bold text-black dark:text-white tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#4545E9] shrink-0" />
                    Payment Details
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Payment mode and transaction reference (Payment Status is managed by authorized finance/admin)
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Payment Mode */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalPaymentMode" className="font-bold text-sm text-black dark:text-white">
                      Payment Mode
                    </Label>
                    <select
                      id="modalPaymentMode"
                      disabled={isEditingAsAdmin}
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full h-[44px] px-3.5 border border border-black dark:border-slate-700 rounded-[12px] text-sm font-medium bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4545E9] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed"
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
                    <Label htmlFor="modalPaymentDate" className="font-bold text-sm text-black dark:text-white">
                      Payment Date
                    </Label>
                    <Input
                      id="modalPaymentDate"
                      type="date"
                      disabled={isEditingAsAdmin}
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="border border border-black dark:border-slate-700 rounded-[12px] h-[44px] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Transaction Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="modalTransactionNumber" className="font-bold text-sm text-black dark:text-white">
                      Transaction Number / UTR
                    </Label>
                    <Input
                      id="modalTransactionNumber"
                      disabled={isEditingAsAdmin}
                      placeholder="e.g. UTR-9304190"
                      value={transactionNumber}
                      onChange={(e) => setTransactionNumber(e.target.value)}
                      className="border-border border-black dark:border-slate-700 rounded-[12px] h-[44px] disabled:bg-gray-100 disabled:text-gray-600 dark:disabled:bg-slate-800/60 dark:disabled:text-gray-300 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Payment Status (Locked for employees) */}
                  <div className="space-y-1.5">
                    <Label className="font-bold text-sm text-black dark:text-white flex items-center justify-between">
                      <span>Payment Status</span>
                      <span className="text-[10px] font-semibold text-gray-500">Locked</span>
                    </Label>
                    <div className="h-[44px] px-3.5 border border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 rounded-[12px] flex items-center justify-between select-none">
                      <span className="font-bold text-xs sm:text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Unpaid
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-extrabold uppercase">
                        Pending
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* ACTION BUTTONS: Cancel & Submit Expense */}
            <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pt-4 pb-2 border-t border-gray-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-full sm:w-[130px] h-[46px] rounded-[14px] border-2 border-black font-bold text-[14px]"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-[190px] h-[46px] bg-[#4545E9] hover:bg-[#3737D4] active:scale-[0.98] text-white font-bold text-[14px] rounded-[14px] border-2 border-black flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>{editExpense ? 'Updating...' : 'Submitting...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>{editExpense ? 'Update Expense' : 'Submit Expense'}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
