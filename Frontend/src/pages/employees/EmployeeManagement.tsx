import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Pagination } from '@/components/ui/pagination';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  Plus,
  Edit,
  Trash2,
  Upload,
  Download,
  Search,
  Users,
  FileSpreadsheet,
  Eye,
  X,
  Loader2,
  Filter,
  User as UserIcon,
  FileText,
  Check,
  ChevronsUpDown
} from 'lucide-react';
import { User, type UserRole } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateIST } from '@/utils/timezone';
import { apiService, API_BASE_URL, type EmployeeData } from '@/lib/api';
import { useFieldValidation } from '@/hooks/useFieldValidation';

type ShiftType = 'general' | 'morning' | 'afternoon' | 'night' | 'rotational';

interface EmployeeRecord extends User {
  employeeId: string;
  photoUrl?: string;
  resignationDate?: string;
  gender?: 'male' | 'female' | 'other';
  employeeType?: 'contract' | 'permanent';
  countryCode?: string;
  panCard?: string;
  aadharCard?: string;
  shift?: ShiftType;
}

const toCamelCase = (obj: any): any => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj !== 'object') return obj;

  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
    acc[camelKey] = toCamelCase(obj[key]);

    // ✅ Special handling: Map user_id to id field for API compatibility
    if (key === 'user_id') {
      acc['id'] = obj[key];
    }

    return acc;
  }, {} as any);
};

const mapEmployeeData = (emp: any): EmployeeRecord => {
  if (!emp) return emp;
  const mapped = toCamelCase(emp);

  // ✅ Fix photo URLs to include backend base URL
  const baseUrl = API_BASE_URL;
  if (mapped.profilePhoto && !mapped.profilePhoto.startsWith('http')) {
    mapped.profilePhoto = `${baseUrl}/${mapped.profilePhoto}`;
  }
  if (mapped.photoUrl && !mapped.photoUrl.startsWith('http')) {
    mapped.photoUrl = `${baseUrl}/${mapped.photoUrl}`;
  }
  if (!mapped.photoUrl && mapped.profilePhoto) {
    mapped.photoUrl = mapped.profilePhoto;
  }

  // ✅ Map is_active/isActive to status robustly
  // Backend might return is_active as "true"/"false" strings or boolean
  let finalStatus = mapped.status || 'active';
  const rawActive = mapped.isActive !== undefined ? mapped.isActive : emp.is_active;

  if (rawActive !== undefined && rawActive !== null) {
    const s = String(rawActive).toLowerCase().trim();
    if (s === 'true' || rawActive === true || s === 'active') {
      finalStatus = 'active';
    } else if (s === 'false' || rawActive === false || s === 'inactive') {
      finalStatus = 'inactive';
    }
  }
  mapped.status = finalStatus;

  // ✅ Ensure shift field is properly set (handle multiple possible field names)
  if (!mapped.shift && (mapped.shiftType || emp.shift_type)) {
    mapped.shift = mapped.shiftType || emp.shift_type;
  }

  return mapped;
};

type BulkUploadResult = {
  row: number;
  employeeId: string;
  name: string;
  status: 'success' | 'failed';
  message?: string;
};

const normalizeHeader = (header: string) =>
  header.replace(/[^a-z0-9]/gi, '').toLowerCase();

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPan = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);

const isValidAadhar = (aadhar: string) => /^\d{4}-\d{4}-\d{4}$/.test(aadhar);

const normalizeCountryCode = (value?: string) => {
  if (!value) return '+91';
  const trimmed = value.trim();
  if (!trimmed) return '+91';
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return '+91';
  const cleaned = digits.replace(/^0+/, '') || digits;
  return `+${cleaned}`;
};

const sanitizePhoneDigits = (rawDigits: string, countryCode: string) => {
  let digits = rawDigits.replace(/[^0-9]/g, '');
  if (!digits) return '';

  const countryDigits = countryCode.replace('+', '');
  if (
    countryDigits &&
    digits.startsWith(countryDigits) &&
    digits.length > countryDigits.length + 5
  ) {
    digits = digits.slice(countryDigits.length);
  }

  if (countryCode === '+91') {
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (digits.length > 10) {
      digits = digits.slice(-10);
    }
  }

  return digits;
};

const isValidPhone = (digits: string, countryCode: string) => {
  if (!digits) return true;
  if (countryCode === '+91') {
    return digits.length === 10;
  }
  return digits.length >= 6 && digits.length <= 15;
};

const parsePhoneValue = (value: string, preferredCode?: string) => {
  const fallbackCode = normalizeCountryCode(preferredCode);

  if (!value) {
    return { countryCode: fallbackCode, digits: '' };
  }

  const trimmed = value.trim();
  let detectedCode = fallbackCode;

  if (!preferredCode) {
    const prefixMatch = trimmed.match(/^(\+\d{1,3})/);
    if (prefixMatch) {
      detectedCode = normalizeCountryCode(prefixMatch[1]);
      const rest = trimmed.slice(prefixMatch[1].length);
      const digits = sanitizePhoneDigits(rest.replace(/[^0-9]/g, ''), detectedCode);
      return { countryCode: detectedCode, digits };
    }

    if (trimmed.includes('-')) {
      const [code, ...rest] = trimmed.split('-');
      if (code.startsWith('+')) {
        detectedCode = normalizeCountryCode(code);
        const digits = sanitizePhoneDigits(rest.join('-'), detectedCode);
        return { countryCode: detectedCode, digits };
      }
    }
  }

  const digits = sanitizePhoneDigits(trimmed, detectedCode);
  return { countryCode: detectedCode, digits };
};

const normalizeRole = (input: string) => {
  if (!input) return 'Employee';
  const key = input.replace(/[\s_]+/g, '').toLowerCase(); // Remove spaces and underscores
  switch (key) {
    case 'admin':
      return 'Admin';
    case 'hr':
      return 'HR';
    case 'manager':
      return 'Manager';
    case 'teamlead':
    case 'teamleader':
      return 'TeamLead';
    default:
      return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
  }
};

const getInternalRole = (input: string): UserRole => {
  if (!input) return 'employee';
  const key = input.replace(/[\s_]+/g, '').toLowerCase();
  switch (key) {
    case 'admin': return 'admin';
    case 'hr': return 'hr';
    case 'manager': return 'manager';
    case 'teamlead':
    case 'teamleader':
    case 'team_lead': return 'team_lead';
    default: return 'employee';
  }
};

const shiftDisplayMap: Record<string, { label: string; backend: ShiftType }> = {
  general: { label: 'General (GS)', backend: 'general' },
  gs: { label: 'General (GS)', backend: 'general' },
  morning: { label: 'Morning', backend: 'morning' },
  afternoon: { label: 'Afternoon', backend: 'afternoon' },
  night: { label: 'Night', backend: 'night' },
  rotational: { label: 'Rotational', backend: 'rotational' },
  rotating: { label: 'Rotational', backend: 'rotational' },
};

const shiftOptions = [
  { value: 'general', label: 'General (GS)' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'night', label: 'Night' },
  { value: 'rotational', label: 'Rotational' },
];

const normalizeShift = (input: string): ShiftType | '' => {
  if (!input) return '';
  const key = input.trim().toLowerCase();
  if (shiftDisplayMap[key]) {
    return shiftDisplayMap[key].backend;
  }
  return '';
};

const normalizeEmployeeType = (input: string) => {
  if (!input) return '';
  const key = input.trim().toLowerCase();
  if (key === 'permanent') return 'permanent';
  if (key === 'contract' || key === 'contract-based' || key === 'contractual') return 'contract';
  return '';
};

const isDuplicateErrorMessage = (message?: string) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('already exists') ||
    lower.includes('already registered') ||
    lower.includes('duplicate') ||
    lower.includes('integrity error')
  );
};

const formatDuplicateErrorMessage = (message: string, employeeId?: string, email?: string) => {
  if (isDuplicateErrorMessage(message)) {
    const identifiers = [
      employeeId ? `ID ${employeeId}` : null,
      email || null,
    ].filter(Boolean);
    const tag = identifiers.length ? ` (${identifiers.join(' / ')})` : '';
    return `Employee already exists${tag}.`;
  }
  return message || 'Failed to create employee';
};


export default function EmployeeManagement() {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewEmployee, setViewEmployee] = useState<EmployeeRecord | null>(null);
  const [formData, setFormData] = useState<Partial<EmployeeRecord>>({
    name: '',
    email: '',
    employeeId: '',
    department: '',
    role: 'employee',
    designation: '',
    phone: '',
    address: '',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'active',
    resignationDate: undefined,
    gender: undefined,
    employeeType: undefined,
    countryCode: '+91',
    panCard: '',
    aadharCard: '',
    shift: undefined
  });

  // For multiple department assignment (HR and Manager roles)
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Address fields
  const [addressFields, setAddressFields] = useState({
    houseNo: '',
    street: '',
    area: '',
    city: '',
    pincode: '',
    state: ''
  });

  const [bulkData, setBulkData] = useState('');
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkSummary, setBulkSummary] = useState<BulkUploadResult[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  // Export dialog states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [genderError, setGenderError] = useState<string>('');
  const [panCardError, setPanCardError] = useState<string>('');
  const [aadharCardError, setAadharCardError] = useState<string>('');
  const [panCardDuplicateError, setPanCardDuplicateError] = useState<string>('');
  const [aadharCardDuplicateError, setAadharCardDuplicateError] = useState<string>('');

  // Export filters
  const [exportFilters, setExportFilters] = useState({
    department: 'all',
    role: 'all'
  });

  // API states
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false);
  const [deptSearchValue, setDeptSearchValue] = useState('');
  const [isDeptPopoverOpen, setIsDeptPopoverOpen] = useState(false);

  const handleCreateDepartment = async (deptName: string) => {
    if (!deptName.trim()) return;

    // Check if already exists (case-insensitive)
    const exists = departments.some(d => d.toLowerCase() === deptName.trim().toLowerCase());
    if (exists) {
      const existingName = departments.find(d => d.toLowerCase() === deptName.trim().toLowerCase());
      setFormData(prev => ({ ...prev, department: existingName }));
      setIsDeptPopoverOpen(false);
      setDeptSearchValue('');
      return existingName;
    }

    setIsCreatingDepartment(true);
    try {
      // Sanitize department name
      const sanitizedDeptName = deptName.trim().replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '');
      if (!sanitizedDeptName) {
        toast({ title: 'Invalid Name', description: 'Department name cannot be empty or only emojis', variant: 'destructive' });
        return;
      }

      // Generate a code (uppercase, alphanumeric)
      const code = sanitizedDeptName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

      const newDept = await apiService.createDepartment({
        name: sanitizedDeptName,
        code: code || `DEPT_${Date.now().toString().slice(-4)}`,
        status: 'active'
      });

      if (newDept) {
        setDepartments(prev => [...prev, newDept.name].sort());
        setFormData(prev => ({ ...prev, department: newDept.name }));
        setIsDeptPopoverOpen(false);
        setDeptSearchValue('');
        toast({ title: 'Success', description: `Department "${newDept.name}" created successfully` });
        return newDept.name;
      }
    } catch (error: any) {
      console.error('Failed to create department:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create department',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingDepartment(false);
    }
  };

  // Delete confirmation states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeRecord | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const createFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const isHR = (formData.role as any) === 'hr';
  const isManager = (formData.role as any) === 'manager';
  const isHROrManager = isHR || isManager;

  const countryCodes = [
    { code: '+91', flag: '🇮🇳', name: 'India' },
    { code: '+1', flag: '🇺🇸', name: 'United States' },
    { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
    { code: '+61', flag: '🇦🇺', name: 'Australia' },
    { code: '+81', flag: '🇯🇵', name: 'Japan' },
  ];

  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.getEmployees();
        const mappedData = data.map(mapEmployeeData);
        console.log('Loaded employees:', mappedData); // ✅ Debug log
        console.log('First employee structure:', mappedData[0]); // ✅ Debug log
        setEmployees(mappedData);
      } catch (error) {
        console.error('Failed to fetch employees:', error);
        toast({
          title: 'Error',
          description: 'Failed to load employees. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    const fetchDepartments = async () => {
      try {
        const departmentData = await apiService.getDepartmentNames();
        const departmentNames = departmentData
          .map(dept => dept.name)
          .sort();
        setDepartments(departmentNames);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
        toast({
          title: 'Warning',
          description: 'Failed to load departments. Please create departments first.',
          variant: 'destructive'
        });
      }
    };

    fetchEmployees();
    fetchDepartments();
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // ✅ Exclude Admin users - Admin is the boss and should not appear in employee lists
      if (emp.role === 'admin') {
        return false;
      }

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        emp.name.toLowerCase().includes(query) ||
        emp.employeeId.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query);
      const matchesDepartment = selectedDepartment === 'all' || emp.department === selectedDepartment;
      const matchesRole = selectedRole === 'all' || emp.role === selectedRole;
      const matchesStatus = selectedStatus === 'all' || emp.status === selectedStatus;
      return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
    });
  }, [employees, searchQuery, selectedDepartment, selectedRole, selectedStatus]);

  // Paginated employees
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredEmployees.slice(startIndex, endIndex);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDepartment, selectedRole, selectedStatus]);

  // Reset to first page when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError('');
      return true;
    }

    // More strict email validation
    // Allows: letters, numbers, dots, hyphens, underscores in local part
    // Rejects: special characters like *, !, #, $, %, etc.
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address (e.g., user@example.com)');
      return false;
    }

    // Additional checks
    if (email.includes('..')) {
      setEmailError('Email cannot contain consecutive dots');
      return false;
    }

    if (email.startsWith('.') || email.includes('@.') || email.includes('.@')) {
      setEmailError('Email cannot start or end with a dot around @');
      return false;
    }

    // Check for invalid characters
    const invalidChars = /[*!#$%^&()+=\[\]{}|\\;:'",<>?/]/;
    if (invalidChars.test(email)) {
      setEmailError('Email contains invalid characters (*, !, #, etc.)');
      return false;
    }

    setEmailError('');
    return true;
  };

  const validateEmployeeId = (employeeId: string) => {
    if (!employeeId) {
      return { valid: false, message: 'Employee ID is required' };
    }

    // Check if it contains at least one letter
    if (!/[A-Z]/.test(employeeId)) {
      return { valid: false, message: 'Employee ID must contain at least one uppercase letter' };
    }

    // Check if it contains at least one number
    if (!/[0-9]/.test(employeeId)) {
      return { valid: false, message: 'Employee ID must contain at least one number' };
    }

    // Check if it only contains uppercase letters and numbers
    if (!/^[A-Z0-9]+$/.test(employeeId)) {
      return { valid: false, message: 'Employee ID can only contain uppercase letters and numbers' };
    }

    return { valid: true, message: '' };
  };

  const validatePhoneNumber = (phone: string, countryCode: string) => {
    if (!phone) {
      setPhoneError('');
      return true;
    }

    const digits = phone.replace(/[^0-9]/g, '');

    if (countryCode === '+91') {
      if (digits.length !== 10) {
        setPhoneError('Indian phone numbers must be exactly 10 digits');
        return false;
      }
      const phoneRegex = /^[6789]\d{9}$/;
      if (!phoneRegex.test(digits)) {
        setPhoneError('Indian phone numbers must start with 6, 7, 8, or 9 and be exactly 10 digits');
        return false;
      }
    } else if (digits.length > 15) {
      setPhoneError('Phone number cannot exceed 15 digits');
      return false;
    }

    setPhoneError('');
    return true;
  };

  const validatePanCard = (panCard: string) => {
    if (!panCard) {
      setPanCardError('PAN Card is required');
      return false;
    }
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panCard)) {
      setPanCardError('Please enter a valid PAN Card number (e.g., ABCDE1234F)');
      return false;
    }
    setPanCardError('');
    return true;
  };

  const validateAadharCard = (aadharCard: string) => {
    if (!aadharCard) {
      setAadharCardError('Aadhar Card is required');
      return false;
    }
    const aadharRegex = /^\d{4}-\d{4}-\d{4}$/;
    if (!aadharRegex.test(aadharCard)) {
      setAadharCardError('Please enter a valid Aadhar Card number (e.g., 1234-5678-9012)');
      return false;
    }
    setAadharCardError('');
    return true;
  };

  const formatPhoneNumber = (digits: string, countryCode: string) => {
    if (!digits) return '';
    if (countryCode === '+91') {
      return digits.slice(0, 10);
    } else {
      return digits.slice(0, 15);
    }
  };

  const handlePhoneInput = (value: string, countryCode: string) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (countryCode === '+91' && digits.length > 10) {
      setPhoneError('Indian phone numbers must be exactly 10 digits');
      return formatPhoneNumber(digits.slice(0, 10), countryCode);
    } else if (digits.length > 15) {
      setPhoneError('Phone number cannot exceed 15 digits');
      return formatPhoneNumber(digits.slice(0, 15), countryCode);
    }
    return formatPhoneNumber(digits, countryCode);
  };

  const formatAadharInput = (value: string) => {
    const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 12);
    const parts = digitsOnly.match(/.{1,4}/g) || [];
    return parts.join('-');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetBulkUploadState = () => {
    setBulkData('');
    setBulkFileName('');
    setBulkSummary([]);
    setIsBulkUploading(false);
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = '';
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setBulkFileName('');
      return;
    }

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a CSV file.',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setBulkData(text);
      }
    };
    reader.readAsText(file);
  };

  const handleCreateEmployee = async () => {
    // Clear any previous duplicate errors
    setPanCardDuplicateError('');
    setAadharCardDuplicateError('');
    setGenderError('');

    // Validate required fields based on role
    const isHROrManager = formData.role === 'hr' || formData.role === 'manager';
    const departmentValid = isHROrManager ? selectedDepartments.length > 0 : formData.department;

    if (!formData.name || !formData.email || !formData.employeeId || !departmentValid || !formData.panCard || !formData.aadharCard || !formData.shift || !formData.employeeType || !formData.gender) {
      if (!formData.gender) {
        setGenderError('Gender is required');
      }
      toast({
        title: 'Error',
        description: isHROrManager
          ? 'Please fill in all required fields and select at least one department'
          : 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    // Validate Employee ID format
    const employeeIdValidation = validateEmployeeId(formData.employeeId);
    if (!employeeIdValidation.valid) {
      toast({
        title: 'Error',
        description: employeeIdValidation.message,
        variant: 'destructive'
      });
      return;
    }

    if (!validateEmail(formData.email)) {
      toast({
        title: 'Error',
        description: emailError,
        variant: 'destructive'
      });
      return;
    }

    if (!validatePhoneNumber(formData.phone?.replace(/[^0-9]/g, '') || '', formData.countryCode || '+91')) {
      toast({
        title: 'Error',
        description: phoneError,
        variant: 'destructive'
      });
      return;
    }

    if (!validatePanCard(formData.panCard)) {
      toast({
        title: 'Error',
        description: panCardError,
        variant: 'destructive'
      });
      return;
    }

    if (!validateAadharCard(formData.aadharCard)) {
      toast({
        title: 'Error',
        description: aadharCardError,
        variant: 'destructive'
      });
      return;
    }

    setIsCreating(true);
    try {
      // Handle department assignment based on role
      const isHROrManager = formData.role === 'hr' || formData.role === 'manager';
      const departmentValue = isHROrManager ? selectedDepartments.join(',') : formData.department;

      // Combine address fields
      const fullAddress = [
        addressFields.houseNo,
        addressFields.street,
        addressFields.area,
        addressFields.city,
        addressFields.pincode,
        addressFields.state
      ].filter(Boolean).join(', ');

      const employeeData: EmployeeData = {
        name: formData.name,
        email: formData.email,
        employee_id: formData.employeeId,
        department: departmentValue,
        designation: formData.designation,
        phone: formData.phone ? (formData.countryCode === '+91' ? formData.phone.replace(/[^0-9]/g, '') : `${formData.countryCode}-${formData.phone.replace(/[^0-9]/g, '')}`) : '',
        address: fullAddress,
        role: normalizeRole(formData.role || 'employee'),
        gender: formData.gender,
        resignation_date: formData.resignationDate || null,
        pan_card: formData.panCard,
        aadhar_card: formData.aadharCard,
        shift_type: formData.shift,
        employee_type: formData.employeeType,
        profile_photo: imageFile || undefined
      };

      const newEmployee = await apiService.createEmployee(employeeData);
      const mappedNewEmployee = mapEmployeeData(newEmployee);
      setEmployees([...employees, mappedNewEmployee]);
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Employee created successfully'
      });
    } catch (error) {
      console.error('Failed to create employee:', error);
      const rawMessage = error instanceof Error ? error.message : 'Failed to create employee. Please try again.';
      const detail = typeof rawMessage === 'object' ? JSON.stringify(rawMessage) : String(rawMessage);

      // Try to handle specific validation errors first
      const isSpecificError = handleApiValidationError(detail);

      if (isSpecificError) {
        toast({
          title: 'Validation Error',
          description: 'Please check the form for errors and correct them.',
          variant: 'destructive'
        });
      } else {
        const friendlyMessage = formatDuplicateErrorMessage(
          detail,
          formData.employeeId,
          formData.email
        );
        toast({
          title: 'Error',
          description: friendlyMessage,
          variant: 'destructive'
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;

    // Clear any previous duplicate errors
    setPanCardDuplicateError('');
    setAadharCardDuplicateError('');

    // Validate required fields based on role
    const isHROrManager = formData.role === 'hr' || formData.role === 'manager';
    const departmentValid = isHROrManager ? selectedDepartments.length > 0 : formData.department;

    if (!formData.name || !formData.email || !formData.employeeId || !departmentValid || !formData.panCard || !formData.aadharCard || !formData.shift) {
      toast({
        title: 'Error',
        description: isHROrManager
          ? 'Please fill in all required fields and select at least one department'
          : 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    // Validate Employee ID format
    const employeeIdValidation = validateEmployeeId(formData.employeeId);
    if (!employeeIdValidation.valid) {
      toast({
        title: 'Error',
        description: employeeIdValidation.message,
        variant: 'destructive'
      });
      return;
    }

    if (!validateEmail(formData.email)) {
      toast({
        title: 'Error',
        description: emailError,
        variant: 'destructive'
      });
      return;
    }

    if (!validatePhoneNumber(formData.phone?.replace(/[^0-9]/g, '') || '', formData.countryCode || '+91')) {
      toast({
        title: 'Error',
        description: phoneError,
        variant: 'destructive'
      });
      return;
    }

    if (!validatePanCard(formData.panCard)) {
      toast({
        title: 'Error',
        description: panCardError,
        variant: 'destructive'
      });
      return;
    }

    if (!validateAadharCard(formData.aadharCard)) {
      toast({
        title: 'Error',
        description: aadharCardError,
        variant: 'destructive'
      });
      return;
    }

    setIsUpdating(true);
    try {
      // Try multiple ways to get user_id for maximum compatibility
      const userIdToUpdate = selectedEmployee?.id
        || formData.id
        || (selectedEmployee as any)?.userId
        || (selectedEmployee as any)?.user_id
        || (formData as any)?.userId
        || (formData as any)?.user_id
        || '';

      // Validate that we have a user_id
      if (!userIdToUpdate) {
        toast({
          title: 'Error',
          description: 'Unable to identify employee. Missing user ID.',
          variant: 'destructive'
        });
        setIsUpdating(false);
        return;
      }

      // Handle department assignment based on role
      const isHROrManager = formData.role === 'hr' || formData.role === 'manager';
      const departmentValue = isHROrManager ? selectedDepartments.join(',') : formData.department;

      // Combine address fields
      const fullAddress = [
        addressFields.houseNo,
        addressFields.street,
        addressFields.area,
        addressFields.city,
        addressFields.pincode,
        addressFields.state
      ].filter(Boolean).join(', ');

      const employeeData: EmployeeData = {
        name: formData.name,
        email: formData.email,
        employee_id: formData.employeeId,
        department: departmentValue,
        designation: formData.designation,
        phone: formData.phone ? (formData.countryCode === '+91' ? formData.phone.replace(/[^0-9]/g, '') : `${formData.countryCode}-${formData.phone.replace(/[^0-9]/g, '')}`) : '',
        address: fullAddress,
        role: normalizeRole(formData.role || 'employee'),
        gender: formData.gender,
        resignation_date: formData.resignationDate || undefined,
        pan_card: formData.panCard,
        aadhar_card: formData.aadharCard,
        shift_type: formData.shift,
        employee_type: formData.employeeType,
        profile_photo: imageFile || formData.profilePhoto || (imagePreview === '' ? '' : undefined), // Pass the file or removal signal
        is_verified: true,
        created_at: formData.createdAt || new Date().toISOString(),
        is_active: (formData.status || 'active') === 'active',
        status: formData.status || 'active'
      };

      // Call API with user_id instead of employee_id
      const updatedEmployee = await apiService.updateEmployee(userIdToUpdate, employeeData);
      const mappedUpdated = mapEmployeeData(updatedEmployee);

      // Update the employee in the list using the id field
      setEmployees(employees.map(emp => emp.id === userIdToUpdate ? mappedUpdated : emp));
      setIsEditDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Employee updated successfully'
      });
    } catch (error) {
      console.error('Failed to update employee:', error);
      const rawMessage = error instanceof Error ? error.message : 'Failed to update employee. Please try again.';
      const detail = typeof rawMessage === 'object' ? JSON.stringify(rawMessage) : String(rawMessage);

      // Try to handle specific validation errors first
      const isSpecificError = handleApiValidationError(detail);

      if (isSpecificError) {
        // Show a toast notification as well for better visibility
        toast({
          title: 'Validation Error',
          description: 'Please check the form for errors and correct them.',
          variant: 'destructive'
        });
      } else {
        // If not a specific validation error, show general error message
        toast({
          title: 'Error',
          description: detail,
          variant: 'destructive'
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteEmployee = async (userId: string) => {
    setIsDeleting(userId);
    try {
      // Call delete API with user_id
      await apiService.deleteEmployee(userId);

      // Remove employee from list using user_id (id field)
      setEmployees(prev => prev.filter(emp => emp.id !== userId));

      toast({
        title: 'Success',
        description: 'Employee deleted successfully'
      });
    } catch (error) {
      console.error('Failed to delete employee:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete employee',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleToggleStatus = async (employeeId: string) => {
    const employee = employees.find(emp => emp.employeeId === employeeId);
    if (!employee) return;

    const newStatus = employee.status === 'active' ? 'inactive' : 'active';
    const isActive = newStatus === 'active';

    try {
      // Call API to update status
      const updatedEmployee = await apiService.updateEmployeeStatus(employee.id.toString(), isActive);
      const mappedUpdated = mapEmployeeData(updatedEmployee);

      // Update local state
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === employee.id ? mappedUpdated : emp
        )
      );

      toast({
        title: 'Success',
        description: `Employee ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Failed to update employee status:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update employee status',
        variant: 'destructive'
      });
    }
  };

  const openViewDialog = (employee: EmployeeRecord) => {
    setViewEmployee(employee);
    setIsViewDialogOpen(true);
  };

  const bulkSuccessCount = bulkSummary.filter((item) => item.status === 'success').length;
  const bulkFailedCount = bulkSummary.length - bulkSuccessCount;

  const handleBulkUpload = async () => {
    if (!bulkData.trim()) {
      toast({
        title: 'No Data',
        description: 'Please paste CSV data or upload a CSV file before importing.',
        variant: 'destructive',
      });
      return;
    }

    const lines = bulkData
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      toast({
        title: 'Invalid CSV',
        description: 'CSV must include a header row and at least one data row.',
        variant: 'destructive',
      });
      return;
    }

    const headers = parseCSVLine(lines[0]);
    if (!headers.length) {
      toast({
        title: 'Invalid CSV',
        description: 'Unable to read CSV headers. Please check the file format.',
        variant: 'destructive',
      });
      return;
    }

    const parsedRows = lines.slice(1).map((line, index) => {
      const values = parseCSVLine(line);
      const rowObject: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        rowObject[normalizeHeader(header)] = values[headerIndex] ?? '';
      });
      return {
        rowNumber: index + 2,
        data: rowObject,
      };
    });

    setIsBulkUploading(true);
    setBulkSummary([]);

    const summary: BulkUploadResult[] = [];
    const createdEmployees: EmployeeRecord[] = [];
    const existingEmployeeIds = new Set(
      employees.map((emp) => emp.employeeId?.toLowerCase()).filter(Boolean) as string[]
    );
    const existingEmails = new Set(
      employees.map((emp) => emp.email?.toLowerCase()).filter(Boolean) as string[]
    );
    const batchEmployeeIds = new Set<string>();
    const batchEmails = new Set<string>();

    for (const row of parsedRows) {
      const data = row.data;
      const employeeId = (data.employeeid || `EMP${Date.now()}${row.rowNumber}`).trim();
      const employeeIdKey = employeeId.toLowerCase();
      const name = (data.name || '').trim().replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '');
      const email = (data.email || '').trim();
      const emailKey = email.toLowerCase();
      const department = (data.department || '').trim().replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '');
      const role = normalizeRole(data.role);
      const designation = (data.designation || '').trim().replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '');
      const address = (data.address || '').trim();
      const joiningDate = data.joiningdate || new Date().toISOString().split('T')[0];
      const status = data.status || 'active';
      const gender = (data.gender || '').trim();
      const employeeType = normalizeEmployeeType(data.employeetype);
      const resignationDate = data.resignationdate || '';
      const panCard = (data.pancard || '').toUpperCase();
      const aadharCard = (data.aadharcard || '').trim();
      const shift = normalizeShift(data.shift);
      const phoneValue = data.phone || '';
      const csvCountryCode = data.countrycode || '';
      const { countryCode, digits } = parsePhoneValue(phoneValue, csvCountryCode);
      const phoneDigits = digits;
      const phoneFormatted = phoneDigits ? (countryCode === '+91' ? phoneDigits : `${countryCode}-${phoneDigits}`) : '';

      const errors: string[] = [];

      // REQUIRED FIELDS - Must be present and valid
      if (!name) errors.push('Name is required');
      if (!email) errors.push('Email is required');
      if (email && !isValidEmail(email)) errors.push('Email format is invalid');
      if (!department) errors.push('Department is required');

      // Check for duplicates only if provided
      if (employeeId && (existingEmployeeIds.has(employeeIdKey) || batchEmployeeIds.has(employeeIdKey))) {
        errors.push('Duplicate employee ID found');
      }
      if (email && (existingEmails.has(emailKey) || batchEmails.has(emailKey))) {
        errors.push('Duplicate email found');
      }

      // OPTIONAL FIELDS - Only validate if provided (not empty)
      // PAN Card - optional, but if provided must be valid
      if (panCard && !isValidPan(panCard.toUpperCase())) {
        errors.push('PAN card format is invalid (must be like ABCDE1234F)');
      }

      // Aadhar Card - optional, but if provided must be valid
      if (aadharCard && !isValidAadhar(aadharCard)) {
        errors.push('Aadhar card format is invalid (must be like 1234-5678-9012)');
      }

      // Shift - optional, but if provided must be valid
      if (shift && !['general', 'morning', 'afternoon', 'night', 'rotational'].includes(shift.toLowerCase())) {
        errors.push('Shift must be general, morning, afternoon, night, or rotational');
      }

      // Employee Type - optional, but if provided must be valid
      if (employeeType && !['contract', 'permanent'].includes(employeeType.toLowerCase())) {
        errors.push('Employee type must be contract or permanent');
      }

      // Phone - optional, but if provided must be valid
      if (phoneDigits && !isValidPhone(phoneDigits, countryCode)) {
        errors.push('Phone number format is invalid');
      }

      if (errors.length > 0) {
        summary.push({
          row: row.rowNumber,
          employeeId,
          name: name || '-',
          status: 'failed',
          message: errors.join('; '),
        });
        continue;
      }

      const employeePayload: EmployeeData = {
        name,
        email,
        employee_id: employeeId,
        department,
        designation: designation || undefined,
        phone: phoneFormatted || undefined,
        address: address || undefined,
        role,
        gender: gender || undefined,
        resignation_date: resignationDate || undefined,
        pan_card: panCard || undefined,
        aadhar_card: aadharCard || undefined,
        shift_type: shift || undefined,
        employee_type: employeeType || undefined,
      };

      try {
        const createdEmployee = await apiService.createEmployee(employeePayload);
        const mappedEmployee = mapEmployeeData(createdEmployee);

        createdEmployees.push(mappedEmployee);
        summary.push({
          row: row.rowNumber,
          employeeId: mappedEmployee.employeeId,
          name: mappedEmployee.name,
          status: 'success',
        });
        existingEmployeeIds.add(employeeIdKey);
        existingEmails.add(emailKey);
        batchEmployeeIds.add(employeeIdKey);
        batchEmails.add(emailKey);
      } catch (error: any) {
        const rawMessage = error?.message || 'Failed to create employee';
        const friendly = formatDuplicateErrorMessage(rawMessage, employeeId, email);
        summary.push({
          row: row.rowNumber,
          employeeId,
          name: name || '-',
          status: 'failed',
          message: friendly,
        });
      }
    }

    if (createdEmployees.length > 0) {
      setEmployees((prev) => [...prev, ...createdEmployees]);
    }

    setBulkSummary(summary);
    setIsBulkUploading(false);

    const successCount = summary.filter((item) => item.status === 'success').length;
    const failedCount = summary.length - successCount;

    if (successCount > 0 && failedCount === 0) {
      toast({
        title: 'Bulk Import Complete',
        description: `${successCount} employees imported successfully.`,
      });
      resetBulkUploadState();
      setIsBulkUploadOpen(false);
    } else {
      toast({
        title: failedCount > 0 ? 'Bulk Import Partial Success' : 'Bulk Import Result',
        description: `${successCount} succeeded, ${failedCount} failed. See details below.`,
        variant: failedCount > 0 ? 'destructive' : 'default',
      });
    }
  };

  // Export employees
  const performExport = async () => {
    if (!exportType) return;

    setIsExporting(true);
    setIsExportDialogOpen(false);

    try {
      const blob = exportType === 'csv'
        ? await apiService.exportEmployeesCSV(exportFilters)
        : await apiService.exportEmployeesPDF(exportFilters);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees_${new Date().toISOString().split('T')[0]}.${exportType}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: `Employee data exported as ${exportType.toUpperCase()} successfully`
      });
    } catch (error) {
      console.error(`Failed to export ${exportType}:`, error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to export ${exportType.toUpperCase()}`,
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  // Download CSV Template
  const downloadCSVTemplate = () => {
    const headers = [
      'EmployeeID',
      'Name',
      'Email',
      'Department',
      'Role',
      'Designation',
      'Phone',
      'Address',
      'JoiningDate',
      'Status',
      'Gender',
      'EmployeeType',
      'ResignationDate',
      'PANCard',
      'AadharCard',
      'Shift'
    ];

    const sampleData = [
      'EMP001',
      'John Doe',
      'john.doe@example.com',
      'Engineering',
      'Employee',
      'Software Engineer',
      '+91-98765-43210',
      '123 Main St, City',
      '2024-01-15',
      'active',
      'male',
      'permanent',
      '',
      'ABCDE1234F',
      '1234-5678-9012',
      'general'
    ];

    const csvContent = [
      headers.join(','),
      sampleData.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_bulk_upload_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Template Downloaded',
      description: 'CSV template has been downloaded successfully'
    });
  };

  const clearValidationErrors = () => {
    setPhoneError('');
    setEmailError('');
    setPanCardError('');
    setAadharCardError('');
    setPanCardDuplicateError('');
    setAadharCardDuplicateError('');
  };

  const handleApiValidationError = (errorMessage: string) => {
    // Clear previous errors
    clearValidationErrors();

    // Check for specific validation errors and set them under the appropriate fields
    if (errorMessage.toLowerCase().includes('phone number already exists')) {
      setPhoneError('Phone number already exists. Please enter a unique phone number.');
      return true;
    }

    if (errorMessage.toLowerCase().includes('pan card already exists')) {
      setPanCardDuplicateError('PAN Card already exists. Please use a different PAN Card.');
      return true;
    }

    if (errorMessage.toLowerCase().includes('aadhar card already exists')) {
      setAadharCardDuplicateError('Aadhar Card already exists. Please use a different Aadhar Card.');
      return true;
    }

    return false; // Return false if no specific validation error was handled
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      employeeId: '',
      department: '',
      role: 'employee',
      designation: '',
      phone: '',
      address: '',
      joiningDate: new Date().toISOString().split('T')[0],
      status: 'active',
      resignationDate: undefined,
      gender: undefined,
      employeeType: undefined,
      countryCode: '+91',
      panCard: '',
      aadharCard: '',
      shift: undefined
    });
    setSelectedDepartments([]);
    setAddressFields({
      houseNo: '',
      street: '',
      area: '',
      city: '',
      pincode: '',
      state: ''
    });
    setImageFile(null);
    setImagePreview('');
    setSelectedEmployee(null);
    clearValidationErrors();
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = async (employee: EmployeeRecord) => {
    console.log('=== OPEN EDIT DIALOG ===');
    console.log('Original employee data:', employee);

    // Identify user_id for fetching
    const empForId = employee as unknown as Record<string, unknown>;
    const userIdToFetch = String(empForId['id'] ?? empForId['user_id'] ?? empForId['userId'] ?? '');

    const populateForm = (emp: any) => {
      setSelectedEmployee(emp);
      const data = emp as unknown as Record<string, unknown>;

      const id = String(data['id'] ?? data['user_id'] ?? data['userId'] ?? '');
      const employeeId = String(data['employeeId'] ?? data['employee_id'] ?? '');
      const name = String(data['name'] ?? '');
      const email = String(data['email'] ?? '');
      const department = String(data['department'] ?? '');
      const role = getInternalRole(String(data['role'] ?? ''));
      const designation = String(data['designation'] ?? '');
      const address = String(data['address'] ?? '');

      const rawJoining = data['joiningDate'] ?? data['joining_date'] ?? data['createdAt'] ?? data['created_at'] ?? '';
      let joiningDate = '';
      if (rawJoining) {
        try {
          joiningDate = new Date(String(rawJoining)).toISOString().split('T')[0];
        } catch (e) {
          joiningDate = String(rawJoining);
        }
      }

      let status = 'active';
      const rawStatus = (data['isActive'] ?? data['is_active'] ?? data['status']);

      if (rawStatus !== undefined && rawStatus !== null) {
        const s = String(rawStatus).toLowerCase().trim();
        if (s === 'active' || s === 'true' || rawStatus === true) {
          status = 'active';
        } else if (s === 'inactive' || s === 'false' || rawStatus === false) {
          status = 'inactive';
        } else {
          status = s; // Fallback for other potential status values
        }
      }
      const resignationDate = data['resignationDate'] ?? data['resignation_date'] ?? '';
      const gender = String(data['gender'] ?? '');
      const employeeType = String(data['employeeType'] ?? data['employee_type'] ?? '');
      const panCard = String(data['panCard'] ?? data['pan_card'] ?? '');
      const aadharCard = String(data['aadharCard'] ?? data['aadhar_card'] ?? '');
      const shift = String(data['shift'] ?? data['shiftType'] ?? data['shift_type'] ?? '');

      let photoUrl = String(data['photoUrl'] ?? data['photo_url'] ?? data['profilePhoto'] ?? data['profile_photo'] ?? '');
      if (photoUrl && !photoUrl.startsWith('http')) {
        photoUrl = `${API_BASE_URL}/${photoUrl}`;
      }

      const rawPhone = String(data['phone'] ?? '');
      let countryCode = String(data['countryCode'] ?? '+91');
      let phone = '';

      if (rawPhone.includes('-')) {
        const parts = rawPhone.split('-');
        countryCode = parts[0] || countryCode;
        phone = parts.slice(1).join('-');
      } else if (rawPhone.startsWith('+')) {
        const m = rawPhone.match(/^(\+\d{1,3})(?:[\s-]?)(.*)$/);
        if (m) {
          countryCode = m[1];
          phone = m[2] || '';
        } else {
          phone = rawPhone;
        }
      } else {
        phone = rawPhone;
      }

      const isHROrManager = role.toLowerCase() === 'hr' || role.toLowerCase() === 'manager';
      const departmentList = isHROrManager && department ? department.split(',').map(d => d.trim()) : [];
      const addressParts = address.split(',').map(part => part.trim());
      const parsedAddress = {
        houseNo: addressParts[0] || '',
        street: addressParts[1] || '',
        area: addressParts[2] || '',
        city: addressParts[3] || '',
        pincode: addressParts[4] || '',
        state: addressParts[5] || ''
      };

      setFormData({
        id,
        employeeId,
        name,
        email,
        department: isHROrManager ? '' : department,
        role,
        designation,
        address,
        joiningDate,
        status: status as any,
        resignationDate: resignationDate as any,
        gender: gender as any,
        employeeType: employeeType as any,
        panCard,
        aadharCard,
        shift: shift as any,
        countryCode,
        phone: formatPhoneNumber(phone.replace(/[^0-9]/g, ''), countryCode),
        photoUrl
      });

      setSelectedDepartments(departmentList);
      setAddressFields(parsedAddress);
      setImagePreview(photoUrl);
      setIsEditDialogOpen(true);
    };

    if (!userIdToFetch) {
      populateForm(employee);
      return;
    }

    try {
      toast({
        title: 'Loading details',
        description: 'Fetching latest employee information...',
      });

      const rawData = await apiService.getEmployeeById(userIdToFetch);
      const fullData = mapEmployeeData(rawData);
      populateForm(fullData);
    } catch (error) {
      console.error('Fetch failed:', error);
      toast({
        title: 'Limited Data',
        description: 'Could not fetch latest details. Using existing information.',
        variant: 'destructive'
      });
      populateForm(employee);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateEmployee();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUpdateEmployee();
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Modern Header Section */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800 rounded-2xl p-6 shadow-sm border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Employee Management</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage your team members efficiently</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setExportFilters(prev => ({
                  ...prev,
                  department: selectedDepartment,
                  role: selectedRole
                }));
                setIsExportDialogOpen(true);
              }}
              variant="outline"
              className="group gap-2 border-blue-200 text-slate-700 bg-white/70 hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-500 hover:text-white hover:border-transparent shadow-sm hover:shadow-lg transition-all dark:text-slate-100 dark:bg-slate-900/60 dark:border-slate-700"
            >
              <Download className="h-4 w-4 text-blue-600 transition-colors group-hover:text-white" />
              Export
            </Button>
            <Dialog
              open={isBulkUploadOpen}
              onOpenChange={(open) => {
                setIsBulkUploadOpen(open);
                if (!open) {
                  resetBulkUploadState();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="group gap-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-500 hover:text-white hover:border-transparent shadow-sm hover:shadow-lg transition-all"
                >
                  <Upload className="h-4 w-4 transition-colors group-hover:text-white" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white border-0 shadow-2xl rounded-2xl">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                      <FileSpreadsheet className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-bold text-gray-900">Bulk Upload Employees</DialogTitle>
                      <DialogDescription className="text-gray-600 mt-1">Import multiple employees at once using CSV format</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-5 overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                  {/* Format Info Card */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">CSV Format Guide</p>
                        <div className="text-sm text-gray-700 mt-2 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex-shrink-0 mt-0.5">*</span>
                            <span><strong>Required:</strong> EmployeeID, Name, Email, Department</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-300 text-white text-xs font-bold flex-shrink-0 mt-0.5">○</span>
                            <span><strong>Optional:</strong> Role, Designation, Phone, Address, JoiningDate, Status, Gender, EmployeeType, ResignationDate, PANCard, AadharCard, Shift</span>
                          </div>
                        </div>
                        <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                          <p className="text-xs text-blue-700 flex items-start gap-2">
                            <span className="text-lg leading-none">💡</span>
                            <span><strong>Pro Tip:</strong> Leave optional fields empty if not available. Only invalid data will be rejected.</span>
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={downloadCSVTemplate}
                        variant="outline"
                        className="gap-2 border-green-300 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-400 shadow-sm flex-shrink-0 font-medium"
                      >
                        <Download className="h-4 w-4" />
                        Template
                      </Button>
                    </div>
                  </div>

                  {/* File Upload Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">1</div>
                      <Label htmlFor="bulk-file" className="font-semibold text-gray-900">Upload CSV File</Label>
                    </div>
                    <div className="relative">
                      <Input
                        id="bulk-file"
                        type="file"
                        accept=".csv"
                        onChange={handleBulkFileChange}
                        ref={bulkFileInputRef}
                        className="border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl p-3 cursor-pointer transition-colors bg-gray-50 hover:bg-purple-50"
                      />
                    </div>
                    {bulkFileName && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                        <p className="text-sm text-green-700 font-medium">{bulkFileName}</p>
                      </div>
                    )}
                  </div>

                  {/* Paste Data Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-sm font-bold">2</div>
                      <Label htmlFor="bulk-textarea" className="font-semibold text-gray-900">Or Paste CSV Data</Label>
                    </div>
                    <Textarea
                      id="bulk-textarea"
                      placeholder="Paste your CSV data here (EmployeeID,Name,Email,Department,...)"
                      value={bulkData}
                      onChange={(e) => setBulkData(e.target.value)}
                      rows={8}
                      className="border-2 border-gray-200 hover:border-orange-300 focus:border-orange-400 rounded-xl resize-none transition-colors bg-gray-50 focus:bg-white"
                    />
                  </div>

                  {/* Import Summary */}
                  {bulkSummary.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">3</div>
                        <p className="font-semibold text-gray-900">Import Results</p>
                      </div>
                      <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">Summary</p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {bulkSuccessCount} succeeded • {bulkFailedCount} failed
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-md">
                              ✓ {bulkSuccessCount}
                            </Badge>
                            <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white border-0 shadow-md">
                              ✕ {bulkFailedCount}
                            </Badge>
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader className="bg-gray-50 sticky top-0">
                              <TableRow className="border-b border-gray-200 hover:bg-gray-50">
                                <TableHead className="text-gray-700 font-semibold">#</TableHead>
                                <TableHead className="text-gray-700 font-semibold">Employee ID</TableHead>
                                <TableHead className="text-gray-700 font-semibold">Name</TableHead>
                                <TableHead className="text-gray-700 font-semibold">Status</TableHead>
                                <TableHead className="text-gray-700 font-semibold">Details</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bulkSummary.map((item) => (
                                <TableRow key={`${item.row}-${item.employeeId}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                  <TableCell className="text-gray-600 text-sm">{item.row}</TableCell>
                                  <TableCell className="font-semibold text-gray-900">{item.employeeId}</TableCell>
                                  <TableCell className="text-gray-700">{item.name || '-'}</TableCell>
                                  <TableCell>
                                    <Badge
                                      className={
                                        item.status === 'success'
                                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-sm'
                                          : 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-0 shadow-sm'
                                      }
                                    >
                                      {item.status === 'success' ? '✓ Imported' : '✕ Failed'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-gray-600 max-w-xs truncate">
                                    {item.message || '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsBulkUploadOpen(false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100 font-medium"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkUpload}
                    className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg font-medium"
                    disabled={isBulkUploading}
                  >
                    {isBulkUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4" />
                        Import Employees
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Employee Directory</CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] border-2 shadow-2xl flex flex-col">
                <DialogHeader className="pb-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 -m-6 mb-0 p-6 rounded-t-lg flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Plus className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-bold">Create New Employee</DialogTitle>
                      <DialogDescription className="mt-1">Fill in the required fields marked with *</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4 overflow-y-auto flex-1 px-6 py-4" onKeyDown={handleKeyDown}>
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="relative w-28 h-28 cursor-pointer group"
                      onClick={() => createFileInputRef.current?.click()}
                    >
                      {imagePreview ? (
                        <>
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover rounded-full border-4 border-blue-200 shadow-lg group-hover:shadow-xl transition-shadow"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg hover:shadow-xl"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageFile(null);
                              setImagePreview('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full border-4 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-100 transition-all shadow-md group-hover:shadow-lg">
                          <Upload className="h-8 w-8 text-blue-500 mb-1" />
                          <span className="text-xs font-semibold text-blue-600">Add Photo</span>
                        </div>
                      )}
                      <Input
                        id="create-photo"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        ref={createFileInputRef}
                      />
                    </div>
                    <p className="text-sm text-center text-slate-600 dark:text-slate-400">
                      Click to upload employee photo
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="create-employeeId">Employee ID * <span className="text-xs text-gray-500">(Uppercase & Numbers only)</span></Label>
                    <Input
                      id="create-employeeId"
                      value={formData.employeeId || ''}
                      onChange={(e) => {
                        // Convert to uppercase and remove all non-alphanumeric characters
                        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        setFormData((prev) => ({ ...prev, employeeId: value }));
                      }}
                      required
                      className="mt-1"
                      placeholder="e.g., EMP001"
                    />
                    {formData.employeeId && !/[A-Z]/.test(formData.employeeId) && (
                      <p className="text-red-500 text-sm mt-1">Employee ID must contain at least one letter</p>
                    )}
                    {formData.employeeId && !/[0-9]/.test(formData.employeeId) && (
                      <p className="text-red-500 text-sm mt-1">Employee ID must contain at least one number</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="create-name">Name *</Label>
                    <Input
                      id="create-name"
                      value={formData.name || ''}
                      onChange={(e) => {
                        // Only allow alphabetic characters and spaces
                        const value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                        setFormData((prev) => ({ ...prev, name: value }));
                      }}
                      required
                      className="mt-1"
                      placeholder="e.g., John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-email">Email *</Label>
                    <Input
                      id="create-email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => {
                        const email = e.target.value;
                        setFormData((prev) => ({ ...prev, email }));
                        validateEmail(email);
                      }}
                      required
                      className={`mt-1 ${emailError ? 'border-red-500' : ''}`}
                      placeholder='e.g., xyz@gmail.com'
                    />
                    {emailError && (
                      <p className="text-red-500 text-sm mt-1">{emailError}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="create-role">Role *</Label>
                    <Select
                      value={formData.role || 'employee'}
                      onValueChange={(value) => {
                        const roleValue = value as UserRole;
                        // Auto-set designation based on role if designation is currently empty
                        let newDesignation = formData.designation || '';
                        if (!newDesignation) {
                          if (roleValue === 'hr') {
                            newDesignation = 'HR';
                          } else if (roleValue === 'manager') {
                            newDesignation = 'Manager';
                          }
                        }

                        // If role is HR, automatically select ALL departments
                        if (roleValue === 'hr') {
                          setSelectedDepartments([...departments]);
                        } else if (roleValue === 'manager' && formData.department && selectedDepartments.length === 0) {
                          // If switching TO manager, migrate single department TO multi-select list
                          setSelectedDepartments([formData.department]);
                        }

                        // If switching FROM hr/manager, migrate first selected department TO single select
                        if (roleValue !== 'hr' && roleValue !== 'manager' && selectedDepartments.length > 0) {
                          setFormData(prev => ({ ...prev, role: roleValue, designation: newDesignation, department: selectedDepartments[0] }));
                        } else {
                          setFormData((prev) => ({ ...prev, role: roleValue, designation: newDesignation }));
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        {formData.role ? (
                          <span>
                            {formData.role === 'admin' && 'Admin'}
                            {formData.role === 'hr' && 'HR'}
                            {formData.role === 'manager' && 'Manager'}
                            {formData.role === 'team_lead' && 'TeamLead'}
                            {formData.role === 'employee' && 'Employee'}
                          </span>
                        ) : (
                          <SelectValue placeholder="Select Role" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="hr">HR</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="team_lead">TeamLead</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Single Department Selection or "All Departments" for HR */}
                  {!isManager && (
                    <div>
                      <Label htmlFor="create-department">Department *</Label>
                      {isHR ? (
                        <Input
                          value="All Departments"
                          readOnly
                          className="mt-1 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 font-medium text-blue-700 dark:text-blue-300"
                        />
                      ) : (
                        <Popover open={isDeptPopoverOpen} onOpenChange={setIsDeptPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isDeptPopoverOpen}
                              className="w-full justify-between mt-1 h-10 px-3 font-normal"
                              disabled={isCreatingDepartment}
                            >
                              {formData.department
                                ? departments.find((d) => d.toLowerCase() === formData.department?.toLowerCase()) || formData.department
                                : "Select or type department"}
                              {isCreatingDepartment ? (
                                <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
                              ) : (
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Search department..."
                                value={deptSearchValue}
                                onValueChange={(val) => setDeptSearchValue(val.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                              />
                              <CommandList className="max-h-[300px]">
                                {deptSearchValue.trim().length > 0 && !departments.some(d => d.toLowerCase() === deptSearchValue.toLowerCase()) && (
                                  <CommandGroup heading="New Department">
                                    <CommandItem
                                      value={deptSearchValue}
                                      onSelect={() => handleCreateDepartment(deptSearchValue)}
                                      className="cursor-pointer text-blue-600 font-medium"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Create "{deptSearchValue}"
                                    </CommandItem>
                                  </CommandGroup>
                                )}
                                <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                                  {deptSearchValue.trim().length === 0 ? "No departments available." : "No matching departments found."}
                                </CommandEmpty>
                                <CommandGroup heading="Existing Departments">
                                  {departments.map((dept) => (
                                    <CommandItem
                                      key={dept}
                                      value={dept}
                                      onSelect={(currentValue) => {
                                        setFormData(prev => ({ ...prev, department: currentValue }));
                                        setIsDeptPopoverOpen(false);
                                        setDeptSearchValue('');
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.department?.toLowerCase() === dept.toLowerCase() ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {dept}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                      {!isHR && departments.length === 0 && (
                        <p className="text-sm text-amber-600 mt-1">
                          ⚠️ No departments available. Please go to Department Management to create departments first.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Multiple Department Selection for Manager */}
                  {isManager && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Assigned Departments *</Label>
                        {departments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedDepartments.length === departments.length) {
                                setSelectedDepartments([]);
                              } else {
                                setSelectedDepartments([...departments]);
                              }
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {selectedDepartments.length === departments.length ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                        {departments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No departments available</p>
                        ) : (
                          departments.map((dept) => (
                            <div key={dept} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`dept-${dept}`}
                                checked={selectedDepartments.includes(dept)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDepartments([...selectedDepartments, dept]);
                                  } else {
                                    setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor={`dept-${dept}`} className="text-sm font-normal">
                                {dept}
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                      {selectedDepartments.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Selected: {selectedDepartments.length === departments.length ? 'All Departments' : selectedDepartments.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Designation Field - Always show now */}
                  <div>
                    <Label htmlFor="create-designation">Designation</Label>
                    <Input
                      id="create-designation"
                      value={formData.designation || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, designation: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                      className="mt-1"
                      placeholder='e.g.,Software Engineer'
                    />
                  </div>


                  <div>
                    <Label htmlFor="create-joiningDate">Joining Date <span className="text-red-500">*</span></Label>
                    <Input
                      id="create-joiningDate"
                      type="date"
                      value={formData.joiningDate || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, joiningDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="create-phone">Phone <span className="text-red-500">*</span></Label>
                    <Input
                      id="create-phone"
                      value={formData.phone || ''}
                      onChange={(e) => {
                        const phone = handlePhoneInput(e.target.value, formData.countryCode || '+91');
                        setFormData((prev) => ({ ...prev, phone }));
                        validatePhoneNumber(phone.replace(/[^0-9]/g, ''), formData.countryCode || '+91');
                      }}
                      className={`mt-1 ${phoneError ? 'border-red-500' : ''}`}
                      placeholder='e.g., 9876543210'
                    />
                    {phoneError && (
                      <p className="text-red-500 text-sm mt-1">{phoneError}</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Label>Address <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="create-houseNo" className="text-xs">House No. / Flat No.</Label>
                        <Input
                          id="create-houseNo"
                          value={addressFields.houseNo || ''}
                          onChange={(e) => setAddressFields((prev) => ({ ...prev, houseNo: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                          className="mt-1 text-sm"
                          placeholder="e.g., 123"
                        />
                      </div>
                      <div>
                        <Label htmlFor="create-street" className="text-xs">House Name / Building Name</Label>
                        <Input
                          id="create-street"
                          value={addressFields.street || ''}
                          onChange={(e) => setAddressFields((prev) => ({ ...prev, street: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                          className="mt-1 text-sm"
                          placeholder="e.g., Galaxy Tower"
                        />
                      </div>
                      <div>
                        <Label htmlFor="create-area" className="text-xs">Area</Label>
                        <Input
                          id="create-area"
                          value={addressFields.area || ''}
                          onChange={(e) => setAddressFields((prev) => ({ ...prev, area: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                          className="mt-1 text-sm"
                          placeholder="e.g., Downtown"
                        />
                      </div>
                      <div>
                        <Label htmlFor="create-city" className="text-xs">City</Label>
                        <Input
                          id="create-city"
                          value={addressFields.city || ''}
                          onChange={(e) => setAddressFields((prev) => ({ ...prev, city: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                          className="mt-1 text-sm"
                          placeholder="e.g., Mumbai"
                        />
                      </div>
                      <div>
                        <Label htmlFor="create-pincode" className="text-xs">Pincode</Label>
                        <Input
                          id="create-pincode"
                          value={addressFields.pincode || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                            setAddressFields((prev) => ({ ...prev, pincode: value }));
                          }}
                          className="mt-1 text-sm"
                          placeholder="e.g., 400001"
                          maxLength={6}
                        />
                      </div>
                      <div>
                        <Label htmlFor="create-state" className="text-xs">State</Label>
                        <Input
                          id="create-state"
                          value={addressFields.state || ''}
                          onChange={(e) => setAddressFields((prev) => ({ ...prev, state: e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, '') }))}
                          className="mt-1 text-sm"
                          placeholder="e.g., Maharashtra"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="create-panCard">PAN Card *</Label>
                    <Input
                      id="create-panCard"
                      value={formData.panCard || ''}
                      onChange={(e) => {
                        // Limit to maximum 10 characters
                        const panCard = e.target.value.toUpperCase().slice(0, 10);
                        setFormData((prev) => ({ ...prev, panCard }));
                        validatePanCard(panCard);
                        // Clear duplicate error when user starts typing
                        if (panCardDuplicateError) {
                          setPanCardDuplicateError('');
                        }
                      }}
                      required
                      maxLength={10}
                      className={`mt-1 ${panCardError || panCardDuplicateError ? 'border-red-500' : ''}`}
                      placeholder="e.g., ABCDE1234F"
                    />
                    {panCardError && (
                      <p className="text-red-500 text-sm mt-1">{panCardError}</p>
                    )}
                    {panCardDuplicateError && (
                      <p className="text-red-500 text-sm mt-1">{panCardDuplicateError}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="create-aadharCard">Aadhar Card *</Label>
                    <Input
                      id="create-aadharCard"
                      value={formData.aadharCard || ''}
                      onChange={(e) => {
                        const formatted = formatAadharInput(e.target.value);
                        setFormData((prev) => ({ ...prev, aadharCard: formatted }));
                        validateAadharCard(formatted);
                        // Clear duplicate error when user starts typing
                        if (aadharCardDuplicateError) {
                          setAadharCardDuplicateError('');
                        }
                      }}
                      required
                      className={`mt-1 ${aadharCardError || aadharCardDuplicateError ? 'border-red-500' : ''}`}
                      placeholder="e.g., 1234-5678-9012"
                    />
                    {aadharCardError && (
                      <p className="text-red-500 text-sm mt-1">{aadharCardError}</p>
                    )}
                    {aadharCardDuplicateError && (
                      <p className="text-red-500 text-sm mt-1">{aadharCardDuplicateError}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="create-shift">Shift *</Label>
                    <Select
                      value={formData.shift || ''}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, shift: value as ShiftType }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select Shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {shiftOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gender <span className="text-red-500">*</span></Label>
                    <RadioGroup
                      value={formData.gender || ''}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, gender: value as 'male' | 'female' | 'other' }));
                        setGenderError('');
                      }}
                      className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="create-male" />
                        <Label htmlFor="create-male">Male</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="create-female" />
                        <Label htmlFor="create-female">Female</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="other" id="create-other" />
                        <Label htmlFor="create-other">Other</Label>
                      </div>
                    </RadioGroup>
                    {genderError && (
                      <p className="text-red-500 text-sm mt-1">{genderError}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="create-employeeType">Employee Type <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.employeeType || ''}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, employeeType: value as 'contract' | 'permanent' }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select Employee Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contract">Contract-based</SelectItem>
                        <SelectItem value="permanent">Permanent</SelectItem>
                        {formData.employeeType && !['contract', 'permanent'].includes(formData.employeeType) && (
                          <SelectItem value={formData.employeeType}>{formData.employeeType}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50 dark:bg-gray-900 flex gap-3 flex-shrink-0 -m-6 mt-0 p-6 rounded-b-lg">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 font-medium">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateEmployee} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md font-medium gap-2" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Employee
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader >
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-end gap-3 mb-6">
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Search by name, ID, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                    className="pl-10 pr-4 h-11 w-full bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500 text-sm"
                    aria-label="Search employees"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-44">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className={`w-full h-11 bg-white dark:bg-gray-950 border-2 transition-all duration-300 hover:shadow-md flex-shrink-0 ${selectedDepartment === 'all'
                  ? 'border-blue-400 dark:border-blue-600 hover:border-blue-400 dark:hover:border-blue-600'
                  : 'hover:border-blue-300 dark:hover:border-blue-700 border-gray-200 dark:border-gray-800'
                  }`}>
                  <Filter className={`h-4 w-4 mr-2 ${selectedDepartment === 'all'
                    ? 'text-blue-600'
                    : 'text-gray-600 dark:text-gray-400'
                    }`} />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent className="border-2 shadow-2xl">
                  <SelectItem value="all" className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors font-medium">
                    <div className="flex items-center gap-2">
                      All Departments
                    </div>
                  </SelectItem>
                  {departments.map((dept, index) => {
                    return (
                      <SelectItem key={dept} value={dept} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <div className="flex items-center gap-2">
                          {dept}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-44">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-full h-11 bg-white dark:bg-gray-950 border-2 hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-300 hover:shadow-md flex-shrink-0">
                  <UserIcon className="h-4 w-4 mr-2 text-purple-600" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent className="border-2 shadow-2xl">
                  <SelectItem value="all" className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors font-medium">
                    <div className="flex items-center gap-2">
                      All Roles
                    </div>
                  </SelectItem>

                  <SelectItem value="HR" className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors">
                    <div className="flex items-center gap-2">
                      HR
                    </div>
                  </SelectItem>
                  <SelectItem value="Manager" className="cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors">
                    <div className="flex items-center gap-2">
                      Manager
                    </div>
                  </SelectItem>
                  <SelectItem value="TeamLead" className="cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-950 transition-colors">
                    <div className="flex items-center gap-2">
                      TeamLead
                    </div>
                  </SelectItem>
                  <SelectItem value="Employee" className="cursor-pointer hover:bg-green-50 dark:hover:bg-green-950 transition-colors">
                    <div className="flex items-center gap-2">
                      Employee
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-44">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full h-11 bg-white dark:bg-gray-950 border-2 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-300 hover:shadow-md flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${selectedStatus === 'all' ? 'text-gray-500' : selectedStatus === 'active' ? 'text-emerald-500' : 'text-rose-500'}`} />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent className="border-2 shadow-2xl">
                  <SelectItem value="all" className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors font-medium">
                    All Status
                  </SelectItem>
                  <SelectItem value="active" className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors">
                    Active
                  </SelectItem>
                  <SelectItem value="inactive" className="cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">
                    Inactive
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden shadow-lg">
            <Table>
              <TableHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="w-[60px] hidden sm:table-cell font-semibold">Photo</TableHead>
                  <TableHead className="font-semibold">Employee ID</TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Department</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading employees...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEmployees.map((employee) => (
                    <TableRow key={employee.employeeId} className="hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border-b">
                      <TableCell className="hidden sm:table-cell">
                        <Avatar className="h-10 w-10 border-2 border-blue-200 dark:border-blue-800">
                          <AvatarImage src={employee.photoUrl} alt={employee.name} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">{employee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-semibold text-blue-600 dark:text-blue-400">{employee.employeeId}</TableCell>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{employee.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 text-sm font-medium">
                          {employee.role?.toLowerCase() === 'hr' || !employee.department
                            ? 'No Dept'
                            : employee.department}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm rounded-full px-3 py-0.5 font-medium transition-all">
                          {employee.role ? employee.role.charAt(0).toUpperCase() + employee.role.slice(1).replace('_', ' ') : '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${employee.status === 'active'
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm rounded-full px-3 py-0.5'
                          : 'bg-gray-400 hover:bg-gray-500 text-white border-0 shadow-sm rounded-full px-3 py-0.5'
                          } font-medium transition-all`}>
                          {employee.status ? employee.status.charAt(0).toUpperCase() + employee.status.slice(1) : '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openViewDialog(employee)}
                            disabled={isDeleting === employee.employeeId}
                            className="h-9 w-9 p-0 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900 transition-all hover:scale-110 rounded-lg"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(employee)}
                            disabled={isDeleting === employee.employeeId}
                            className="h-9 w-9 p-0 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900 transition-all hover:scale-110 rounded-lg"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEmployeeToDelete(employee);
                              setIsDeleteDialogOpen(true);
                            }}
                            disabled={isDeleting === employee.id}
                            className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 transition-all hover:scale-110 rounded-lg"
                          >
                            {isDeleting === employee.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(employee.employeeId)}
                            disabled={isDeleting === employee.employeeId}
                            className="h-9 w-[90px] text-xs px-3 border-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-950 dark:hover:to-indigo-950 transition-all font-medium"
                          >
                            {employee.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination - Always show for consistent UI with Show count dropdown */}
          <div className="mt-6 px-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredEmployees.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              showItemsPerPage={true}
            />
          </div>
        </CardContent>
      </Card >

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[450px] max-h-[80vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle>Update Employee / User</DialogTitle>
            <DialogDescription>Update the employee / user details below</DialogDescription>
          </DialogHeader>
          <div className="space-y-4" onKeyDown={handleEditKeyDown}>
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative w-28 h-28 cursor-pointer group"
                onClick={() => editFileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-full border-4 border-blue-200 shadow-lg group-hover:shadow-xl transition-shadow"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg hover:shadow-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFile(null);
                        setImagePreview('');
                        setFormData(prev => ({ ...prev, profilePhoto: '' }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full border-4 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-100 transition-all shadow-md group-hover:shadow-lg">
                    <Upload className="h-8 w-8 text-blue-500 mb-1" />
                    <span className="text-xs font-semibold text-blue-600">Add Photo</span>
                  </div>
                )}
                <Input
                  id="edit-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  ref={editFileInputRef}
                />
              </div>
              <p className="text-sm text-center text-slate-600 dark:text-slate-400">
                Click to upload or change photo
              </p>
            </div>
            <div>
              <Label htmlFor="edit-employeeId">Employee ID *</Label>
              <Input
                id="edit-employeeId"
                value={formData.employeeId || ''}
                readOnly
                disabled
                aria-readonly="true"
                required
                className="mt-1 bg-gray-50 text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name || ''}
                onChange={(e) => {
                  // Only allow alphabetic characters and spaces
                  const value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                  setFormData((prev) => ({ ...prev, name: value }));
                }}
                required
                className="mt-1"
                placeholder="e.g., John Doe"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => {
                  const email = e.target.value;
                  setFormData((prev) => ({ ...prev, email }));
                  validateEmail(email);
                }}
                required
                className={`mt-1 ${emailError ? 'border-red-500' : ''}`}
              />
              {emailError && (
                <p className="text-red-500 text-sm mt-1">{emailError}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-role">Role *</Label>
              <Select
                value={formData.role || 'employee'}
                onValueChange={(value) => {
                  const roleValue = value as UserRole;
                  // Auto-set designation based on role if currently empty
                  let newDesignation = formData.designation || '';
                  if (!newDesignation) {
                    if (roleValue === 'hr') {
                      newDesignation = 'HR';
                    } else if (roleValue === 'manager') {
                      newDesignation = 'Manager';
                    }
                  }

                  // If role is HR, automatically select ALL departments
                  if (roleValue === 'hr') {
                    setSelectedDepartments([...departments]);
                  } else if (roleValue === 'manager' && formData.department && selectedDepartments.length === 0) {
                    // If switching TO manager, migrate single department TO multi-select list
                    setSelectedDepartments([formData.department]);
                  }

                  // If switching FROM hr/manager, migrate first selected department TO single select
                  if (roleValue !== 'hr' && roleValue !== 'manager' && selectedDepartments.length > 0) {
                    setFormData(prev => ({ ...prev, role: roleValue, designation: newDesignation, department: selectedDepartments[0] }));
                  } else {
                    setFormData((prev) => ({ ...prev, role: roleValue, designation: newDesignation }));
                  }
                }}
              >
                <SelectTrigger className="mt-1">
                  {formData.role ? (
                    <span>
                      {formData.role === 'admin' && 'Admin'}
                      {formData.role === 'hr' && 'HR'}
                      {formData.role === 'manager' && 'Manager'}
                      {formData.role === 'team_lead' && 'Team Lead'}
                      {formData.role === 'employee' && 'Employee'}
                    </span>
                  ) : (
                    <SelectValue placeholder="Select Role" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="team_lead">TeamLead</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Single Department Selection or "All Departments" for HR in Edit */}
            {!isManager && (
              <div>
                <Label htmlFor="edit-department">Department *</Label>
                {isHR ? (
                  <Input
                    value="All Departments"
                    readOnly
                    className="mt-1 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 font-medium text-blue-700 dark:text-blue-300"
                  />
                ) : (
                  <Popover open={isDeptPopoverOpen} onOpenChange={setIsDeptPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isDeptPopoverOpen}
                        className="w-full justify-between mt-1 h-10 px-3 font-normal"
                        disabled={isCreatingDepartment}
                      >
                        {formData.department
                          ? departments.find((d) => d.toLowerCase() === formData.department?.toLowerCase()) || formData.department
                          : "Select or type department"}
                        {isCreatingDepartment ? (
                          <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
                        ) : (
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search department..."
                          value={deptSearchValue}
                          onValueChange={(val) => setDeptSearchValue(val.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}]/gu, ''))}
                        />
                        <CommandList className="max-h-[300px]">
                          {deptSearchValue.trim().length > 0 && !departments.some(d => d.toLowerCase() === deptSearchValue.toLowerCase()) && (
                            <CommandGroup heading="New Department">
                              <CommandItem
                                value={deptSearchValue}
                                onSelect={() => handleCreateDepartment(deptSearchValue)}
                                className="cursor-pointer text-blue-600 font-medium"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create "{deptSearchValue}"
                              </CommandItem>
                            </CommandGroup>
                          )}
                          <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                            {deptSearchValue.trim().length === 0 ? "No departments available." : "No matching departments found."}
                          </CommandEmpty>
                          <CommandGroup heading="Existing Departments">
                            {departments.map((dept) => (
                              <CommandItem
                                key={dept}
                                value={dept}
                                onSelect={(currentValue) => {
                                  setFormData(prev => ({ ...prev, department: currentValue }));
                                  setIsDeptPopoverOpen(false);
                                  setDeptSearchValue('');
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.department?.toLowerCase() === dept.toLowerCase() ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {dept}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            {/* Multiple Department Selection for Manager in Edit */}
            {isManager && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Assigned Departments *</Label>
                  {departments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDepartments.length === departments.length) {
                          setSelectedDepartments([]);
                        } else {
                          setSelectedDepartments([...departments]);
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {selectedDepartments.length === departments.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {departments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No departments available</p>
                  ) : (
                    departments.map((dept) => (
                      <div key={dept} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`edit-dept-${dept}`}
                          checked={selectedDepartments.includes(dept)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDepartments([...selectedDepartments, dept]);
                            } else {
                              setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`edit-dept-${dept}`} className="text-sm font-normal">
                          {dept}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {selectedDepartments.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {selectedDepartments.length === departments.length ? 'All Departments' : selectedDepartments.join(', ')}
                  </p>
                )}
              </div>
            )}



            {/* Designation Field - Always show now */}
            <div>
              <Label htmlFor="edit-designation">Designation</Label>
              <Input
                id="edit-designation"
                value={formData.designation || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, designation: e.target.value }))}
                className="mt-1"
              />
            </div>


            <div>
              <Label htmlFor="edit-joiningDate">Joining Date <span className="text-red-500">*</span></Label>
              <Input
                id="edit-joiningDate"
                type="date"
                value={formData.joiningDate || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, joiningDate: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-phone">Phone <span className="text-red-500">*</span></Label>
              <Input
                id="edit-phone"
                value={formData.phone || ''}
                onChange={(e) => {
                  const phone = handlePhoneInput(e.target.value, formData.countryCode || '+91');
                  setFormData((prev) => ({ ...prev, phone }));
                  validatePhoneNumber(phone.replace(/[^0-9]/g, ''), formData.countryCode || '+91');
                }}
                className={`mt-1 ${phoneError ? 'border-red-500' : ''}`}
                placeholder='e.g., 9876543210'
              />
              {phoneError && (
                <p className="text-red-500 text-sm mt-1">{phoneError}</p>
              )}
            </div>
            <div className="space-y-3">
              <Label>Address <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="edit-houseNo" className="text-xs">House No. / Flat No.</Label>
                  <Input
                    id="edit-houseNo"
                    value={addressFields.houseNo || ''}
                    onChange={(e) => setAddressFields((prev) => ({ ...prev, houseNo: e.target.value }))}
                    className="mt-1 text-sm"
                    placeholder="e.g., 123"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-street" className="text-xs">House Name / Building Name</Label>
                  <Input
                    id="edit-street"
                    value={addressFields.street || ''}
                    onChange={(e) => setAddressFields((prev) => ({ ...prev, street: e.target.value }))}
                    className="mt-1 text-sm"
                    placeholder="e.g., Main St"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-area" className="text-xs">Area</Label>
                  <Input
                    id="edit-area"
                    value={addressFields.area || ''}
                    onChange={(e) => setAddressFields((prev) => ({ ...prev, area: e.target.value }))}
                    className="mt-1 text-sm"
                    placeholder="e.g., Downtown"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-city" className="text-xs">City</Label>
                  <Input
                    id="edit-city"
                    value={addressFields.city || ''}
                    onChange={(e) => setAddressFields((prev) => ({ ...prev, city: e.target.value }))}
                    className="mt-1 text-sm"
                    placeholder="e.g., Mumbai"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-pincode" className="text-xs">Pincode</Label>
                  <Input
                    id="edit-pincode"
                    value={addressFields.pincode || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                      setAddressFields((prev) => ({ ...prev, pincode: value }));
                    }}
                    className="mt-1 text-sm"
                    placeholder="e.g., 400001"
                    maxLength={6}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-state" className="text-xs">State</Label>
                  <Input
                    id="edit-state"
                    value={addressFields.state || ''}
                    onChange={(e) => setAddressFields((prev) => ({ ...prev, state: e.target.value }))}
                    className="mt-1 text-sm"
                    placeholder="e.g., Maharashtra"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-panCard">PAN Card *</Label>
              <Input
                id="edit-panCard"
                value={formData.panCard || ''}
                onChange={(e) => {
                  // Limit to maximum 10 characters
                  const panCard = e.target.value.toUpperCase().slice(0, 10);
                  setFormData((prev) => ({ ...prev, panCard }));
                  validatePanCard(panCard);
                  // Clear duplicate error when user starts typing
                  if (panCardDuplicateError) {
                    setPanCardDuplicateError('');
                  }
                }}
                required
                maxLength={10}
                className={`mt-1 ${panCardError || panCardDuplicateError ? 'border-red-500' : ''}`}
                placeholder="e.g., ABCDE1234F"
              />
              {panCardError && (
                <p className="text-red-500 text-sm mt-1">{panCardError}</p>
              )}
              {panCardDuplicateError && (
                <p className="text-red-500 text-sm mt-1">{panCardDuplicateError}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-aadharCard">Aadhar Card *</Label>
              <Input
                id="edit-aadharCard"
                value={formData.aadharCard || ''}
                onChange={(e) => {
                  const formatted = formatAadharInput(e.target.value);
                  setFormData((prev) => ({ ...prev, aadharCard: formatted }));
                  validateAadharCard(formatted);
                  // Clear duplicate error when user starts typing
                  if (aadharCardDuplicateError) {
                    setAadharCardDuplicateError('');
                  }
                }}
                required
                className={`mt-1 ${aadharCardError || aadharCardDuplicateError ? 'border-red-500' : ''}`}
                placeholder="e.g., 1234-5678-9012"
              />
              {aadharCardError && (
                <p className="text-red-500 text-sm mt-1">{aadharCardError}</p>
              )}
              {aadharCardDuplicateError && (
                <p className="text-red-500 text-sm mt-1">{aadharCardDuplicateError}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-shift">Shift *</Label>
              <Select
                value={formData.shift || ''}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, shift: value as ShiftType }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Shift" />
                </SelectTrigger>
                <SelectContent>
                  {shiftOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender <span className="text-red-500">*</span></Label>
              <RadioGroup
                value={formData.gender || ''}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, gender: value as 'male' | 'female' | 'other' }));
                  setGenderError('');
                }}
                className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="edit-male" />
                  <Label htmlFor="edit-male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="edit-female" />
                  <Label htmlFor="edit-female">Female</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="edit-other" />
                  <Label htmlFor="edit-other">Other</Label>
                </div>
              </RadioGroup>
              {genderError && (
                <p className="text-red-500 text-sm mt-1">{genderError}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-employeeType">Employee Type <span className="text-red-500">*</span></Label>
              <Select
                value={formData.employeeType || ''}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, employeeType: value as 'contract' | 'permanent' }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Employee Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract-based</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  {formData.employeeType && !['contract', 'permanent'].includes(formData.employeeType) && (
                    <SelectItem value={formData.employeeType}>{formData.employeeType}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-resignationDate">Date of Resignation</Label>
              <Input
                id="edit-resignationDate"
                type="date"
                value={formData.resignationDate || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, resignationDate: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50 dark:bg-gray-900 flex gap-3 flex-shrink-0 -m-6 mt-0 p-6 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 font-medium">
              Cancel
            </Button>
            <Button onClick={handleUpdateEmployee} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md font-medium gap-2" disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
                  Update Employee
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[450px] max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
            <DialogTitle className="text-xl font-semibold">Employee Profile</DialogTitle>
            <DialogDescription>Quick profile preview</DialogDescription>
          </DialogHeader>
          {viewEmployee && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-blue-100 dark:border-blue-900 shadow-lg flex-shrink-0">
                  <img
                    src={viewEmployee.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewEmployee.name}`}
                    alt={viewEmployee.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">{viewEmployee.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{viewEmployee.designation || '-'}</p>
                  <div className="mt-2">
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm rounded-full px-4 py-1 font-medium transition-all">
                      {viewEmployee.role ? viewEmployee.role.charAt(0).toUpperCase() + viewEmployee.role.slice(1).replace('_', ' ') : '-'}
                    </Badge>
                  </div>
                  <Badge className={`${viewEmployee.status === 'active'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-gray-400 hover:bg-gray-500 text-white'
                    } border-0 shadow-sm rounded-full px-4 py-1 font-medium transition-all mt-2`}>
                    {viewEmployee.status ? viewEmployee.status.charAt(0).toUpperCase() + viewEmployee.status.slice(1) : '-'}
                  </Badge>
                </div>
                <div className="w-full space-y-2 text-sm bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employee ID</span>
                    <span className="font-medium">{viewEmployee.employeeId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{viewEmployee.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department</span>
                    <div className="font-medium">
                      {viewEmployee.role?.toLowerCase() === 'hr' || (viewEmployee.department && viewEmployee.department.includes(',')) || !viewEmployee.department ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-semibold border border-blue-200 dark:border-blue-800">
                          No Dept
                        </span>
                      ) : (
                        <span>{viewEmployee.department}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{viewEmployee.role ? viewEmployee.role.charAt(0).toUpperCase() + viewEmployee.role.slice(1) : '-'}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{viewEmployee.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gender</span>
                    <span className="font-medium">{viewEmployee.gender ? viewEmployee.gender.charAt(0).toUpperCase() + viewEmployee.gender.slice(1) : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employee Type</span>
                    <span className="font-medium">{viewEmployee.employeeType ? viewEmployee.employeeType.charAt(0).toUpperCase() + viewEmployee.employeeType.slice(1) : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resignation Date</span>
                    <span className="font-medium">{viewEmployee.resignationDate || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PAN Card</span>
                    <span className="font-medium">{viewEmployee.panCard || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aadhar Card</span>
                    <span className="font-medium">{viewEmployee.aadharCard || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shift</span>
                    <span className="font-medium">
                      {viewEmployee.shift && viewEmployee.shift.trim()
                        ? viewEmployee.shift.charAt(0).toUpperCase() + viewEmployee.shift.slice(1).toLowerCase()
                        : '-'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this employee? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
              onClick={() => {
                if (employeeToDelete) {
                  handleDeleteEmployee(employeeToDelete.id);
                  setIsDeleteDialogOpen(false);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export Employee Data</DialogTitle>
            <DialogDescription>
              Choose the format to export employee data
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Export Filters */}
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <Label htmlFor="export-department">Department</Label>
                <Select
                  value={exportFilters.department}
                  onValueChange={(value) => setExportFilters(prev => ({ ...prev, department: value }))}
                >
                  <SelectTrigger id="export-department" className="mt-1">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="export-role">Role</Label>
                <Select
                  value={exportFilters.role}
                  onValueChange={(value) => setExportFilters(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger id="export-role" className="mt-1">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Export Format Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Export Format</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportType('csv')}
                  className={`p-4 rounded-lg border-2 transition-all ${exportType === 'csv'
                    ? 'border-green-600 bg-green-50 dark:bg-green-950'
                    : 'border-gray-200 hover:border-green-300 dark:border-gray-700'
                    }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className={`h-8 w-8 ${exportType === 'csv' ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold ${exportType === 'csv' ? 'text-green-600' : 'text-gray-600'}`}>
                      CSV
                    </span>
                    <span className="text-xs text-muted-foreground text-center">
                      Excel compatible
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setExportType('pdf')}
                  className={`p-4 rounded-lg border-2 transition-all ${exportType === 'pdf'
                    ? 'border-red-600 bg-red-50 dark:bg-red-950'
                    : 'border-gray-200 hover:border-red-300 dark:border-gray-700'
                    }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileText className={`h-8 w-8 ${exportType === 'pdf' ? 'text-red-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold ${exportType === 'pdf' ? 'text-red-600' : 'text-gray-600'}`}>
                      PDF
                    </span>
                    <span className="text-xs text-muted-foreground text-center">
                      Print ready
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsExportDialogOpen(false);
                setExportType(null);
              }}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={performExport}
              disabled={isExporting || !exportType}
              className={exportType === 'csv' ? 'bg-green-600 hover:bg-green-700' : exportType === 'pdf' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {isExporting ? 'Exporting...' : exportType ? `Export ${exportType.toUpperCase()}` : 'Select Format'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}