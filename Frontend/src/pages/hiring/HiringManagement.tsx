import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Eye,
  Share2,
  Linkedin,
  FileText,
  Users,
  Briefcase,
  Calendar,
  MapPin,
  DollarSign,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateIST, formatDateTimeIST } from '@/utils/timezone';
import { apiService } from '@/lib/api';

interface Vacancy {
  vacancy_id: number;
  title: string;
  department: string;
  description: string;
  requirements: string;
  responsibilities?: string;
  nice_to_have_skills?: string;
  location: string;
  employment_type: string;
  salary_range?: string;
  status: string;
  candidates_count: number;
  created_at: string;
  updated_at: string;
  posted_on_linkedin?: boolean;
  posted_on_naukri?: boolean;
  posted_on_indeed?: boolean;
  posted_on_other?: boolean;
  social_media_links?: string;
}

interface Candidate {
  candidate_id: number;
  vacancy_id: number;
  vacancy_title?: string;
  vacancy_department?: string;
  first_name?: string;
  last_name?: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  resume_url?: string;
  resume_external_url?: string;
  cover_letter?: string;
  status: string;
  interview_date?: string;
  interview_time?: string;
  interview_mode?: string;
  location_or_link?: string;
  interviewer_name?: string;
  applied_at: string;
  updated_at: string;
}

export default function HiringManagement() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('vacancies');
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Dialogs
  const [isVacancyDialogOpen, setIsVacancyDialogOpen] = useState(false);
  const [isViewVacancyDialogOpen, setIsViewVacancyDialogOpen] = useState(false);
  const [isSocialMediaDialogOpen, setIsSocialMediaDialogOpen] = useState(false);
  const [isViewCandidateDialogOpen, setIsViewCandidateDialogOpen] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Form data
  const [vacancyFormData, setVacancyFormData] = useState({
    title: '',
    department: user?.role === 'hr' ? (user.department || '') : '',
    description: '',
    requirements: '',
    responsibilities: '',
    nice_to_have_skills: '',
    location: '',
    employment_type: 'full-time',
    salary_range: '',
    status: 'open',
  });

  const [socialMediaData, setSocialMediaData] = useState({
    platforms: [] as string[],
    links: {} as Record<string, string>,
  });

  const [isCandidateDialogOpen, setIsCandidateDialogOpen] = useState(false);
  const [candidateFormData, setCandidateFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    linkedin_url: '',
    portfolio_url: '',
    vacancy_id: '',
    resume_external_url: '',
    status: 'applied',
  });
  const [candidateResumeFile, setCandidateResumeFile] = useState<File | null>(null);

  const [isShortlistDialogOpen, setIsShortlistDialogOpen] = useState(false);
  const [shortlistFormData, setShortlistFormData] = useState({
    interview_date: '',
    interview_time: '',
    interview_mode: 'online',
    location_or_link: '',
    interviewer_name: '',
  });

  const [isUpdateResumeDialogOpen, setIsUpdateResumeDialogOpen] = useState(false);
  const [resumeUpdateData, setResumeUpdateData] = useState({
    resume_external_url: '',
  });
  const [newResumeFile, setNewResumeFile] = useState<File | null>(null);

  type RichTextField =
    | 'description'
    | 'responsibilities'
    | 'requirements'
    | 'nice_to_have_skills';

  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const responsibilitiesRef = useRef<HTMLTextAreaElement | null>(null);
  const requirementsRef = useRef<HTMLTextAreaElement | null>(null);
  const niceToHaveRef = useRef<HTMLTextAreaElement | null>(null);

  const richTextRefs = useMemo(
    () => ({
      description: descriptionRef,
      responsibilities: responsibilitiesRef,
      requirements: requirementsRef,
      nice_to_have_skills: niceToHaveRef,
    }),
    [],
  );

  // Fetch departments from employees
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const employees = await apiService.getEmployees();
        const uniqueDepartments = new Set<string>();
        employees.forEach((emp: any) => {
          if (emp.department) uniqueDepartments.add(emp.department);
        });
        setDepartments(Array.from(uniqueDepartments).sort());
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    };
    fetchDepartments();
  }, []);

  // Fetch vacancies
  const fetchVacancies = async () => {
    setIsLoading(true);
    try {
      const dept = selectedDepartment !== 'all' ? selectedDepartment : undefined;
      const status = selectedStatus !== 'all' ? selectedStatus : undefined;
      const data = await apiService.getVacancies(dept, status);
      setVacancies(data);
    } catch (error: any) {
      console.error('Failed to fetch vacancies:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load vacancies',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch candidates
  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      const status = selectedStatus !== 'all' ? selectedStatus : undefined;
      const data = await apiService.getCandidates(undefined, status);
      setCandidates(data);
    } catch (error: any) {
      console.error('Failed to fetch candidates:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load candidates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'vacancies') {
      fetchVacancies();
    } else {
      fetchCandidates();
    }
  }, [activeTab, selectedDepartment, selectedStatus]);

  const filteredVacancies = vacancies.filter((vacancy) => {
    const query = searchQuery.toLowerCase();
    return (
      vacancy.title.toLowerCase().includes(query) ||
      vacancy.department.toLowerCase().includes(query) ||
      vacancy.location.toLowerCase().includes(query) ||
      vacancy.description.toLowerCase().includes(query)
    );
  });

  const filteredCandidates = candidates.filter((candidate) => {
    const query = searchQuery.toLowerCase();
    return (
      candidate.name.toLowerCase().includes(query) ||
      candidate.email.toLowerCase().includes(query) ||
      candidate.vacancy_title?.toLowerCase().includes(query) ||
      candidate.phone?.toLowerCase().includes(query)
    );
  });

  const handleCreateVacancy = async () => {
    if (!vacancyFormData.title || !vacancyFormData.department || !vacancyFormData.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      await apiService.createVacancy(vacancyFormData);
      toast({
        title: 'Success',
        description: 'Vacancy created successfully',
      });
      setIsVacancyDialogOpen(false);
      resetVacancyForm();
      fetchVacancies();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create vacancy',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateVacancy = async () => {
    if (!selectedVacancy) return;

    setIsUpdating(true);
    try {
      await apiService.updateVacancy(selectedVacancy.vacancy_id, vacancyFormData);
      toast({
        title: 'Success',
        description: 'Vacancy updated successfully',
      });
      setIsVacancyDialogOpen(false);
      setSelectedVacancy(null);
      resetVacancyForm();
      fetchVacancies();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update vacancy',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteVacancy = async (vacancyId: number) => {
    if (!confirm('Are you sure you want to delete this vacancy?')) return;

    setIsDeleting(vacancyId);
    try {
      await apiService.deleteVacancy(vacancyId);
      toast({
        title: 'Success',
        description: 'Vacancy deleted successfully',
      });
      fetchVacancies();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete vacancy',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePostToSocialMedia = async () => {
    if (!selectedVacancy || socialMediaData.platforms.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one platform',
        variant: 'destructive',
      });
      return;
    }

    try {
      await apiService.postVacancyToSocialMedia(
        selectedVacancy.vacancy_id,
        socialMediaData.platforms,
        socialMediaData.links
      );
      toast({
        title: 'Success',
        description: 'Vacancy posted to social media platforms',
      });
      setIsSocialMediaDialogOpen(false);
      setSocialMediaData({ platforms: [], links: {} });
      fetchVacancies();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to post to social media',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateCandidateStatus = async (candidateId: number, newStatus: string) => {
    try {
      await apiService.updateCandidateStatus(candidateId, newStatus);
      toast({
        title: 'Success',
        description: 'Candidate status updated',
      });
      fetchCandidates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update candidate status',
        variant: 'destructive',
      });
    }
  };

  const handleCreateCandidate = async () => {
    if (!candidateFormData.first_name || !candidateFormData.last_name || !candidateFormData.email || !candidateFormData.vacancy_id) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        ...candidateFormData,
        name: `${candidateFormData.first_name} ${candidateFormData.last_name}`,
      };
      await apiService.createCandidate(payload, candidateResumeFile || undefined);
      toast({
        title: 'Success',
        description: 'Candidate created successfully',
      });
      setIsCandidateDialogOpen(false);
      resetCandidateForm();
      fetchCandidates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create candidate',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleShortlistCandidate = async () => {
    if (!selectedCandidate || !shortlistFormData.interview_date || !shortlistFormData.interviewer_name) {
      toast({
        title: 'Error',
        description: 'Please provide interview date and interviewer name',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);
    try {
      await apiService.shortlistCandidate(selectedCandidate.candidate_id, shortlistFormData);
      toast({
        title: 'Success',
        description: 'Candidate shortlisted for interview',
      });
      setIsShortlistDialogOpen(false);
      fetchCandidates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to shortlist candidate',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateResume = async () => {
    if (!selectedCandidate || (!newResumeFile && !resumeUpdateData.resume_external_url)) {
      toast({
        title: 'Error',
        description: 'Please provide a file or an external URL',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);
    try {
      await apiService.updateCandidateResume(
        selectedCandidate.candidate_id,
        newResumeFile || undefined,
        resumeUpdateData.resume_external_url
      );
      toast({
        title: 'Success',
        description: 'Resume updated successfully',
      });
      setIsUpdateResumeDialogOpen(false);
      setNewResumeFile(null);
      setResumeUpdateData({ resume_external_url: '' });
      fetchCandidates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update resume',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCandidate = async (candidateId: number) => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;

    setIsDeleting(candidateId);
    try {
      await apiService.deleteCandidate(candidateId);
      toast({
        title: 'Success',
        description: 'Candidate deleted successfully',
      });
      fetchCandidates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete candidate',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const resetCandidateForm = () => {
    setCandidateFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      linkedin_url: '',
      portfolio_url: '',
      vacancy_id: '',
      resume_external_url: '',
      status: 'applied',
    });
    setCandidateResumeFile(null);
  };

  const resetVacancyForm = () => {
    setVacancyFormData({
      title: '',
      department: user?.role === 'hr' ? (user.department || '') : '',
      description: '',
      requirements: '',
      responsibilities: '',
      nice_to_have_skills: '',
      location: '',
      employment_type: 'full-time',
      salary_range: '',
      status: 'open',
    });
  };

  const applyFormatting = (
    field: RichTextField,
    format: 'bold' | 'bullet' | 'number',
  ) => {
    const ref = richTextRefs[field].current;
    if (!ref) return;
    const textarea = ref;
    const value = textarea.value;
    const selectionStart = textarea.selectionStart ?? value.length;
    const selectionEnd = textarea.selectionEnd ?? value.length;

    let newValue = value;
    let newCursorPos = selectionEnd;

    if (format === 'bold') {
      const selected = value.slice(selectionStart, selectionEnd) || 'bold text';
      const wrapped = `**${selected}**`;
      newValue = value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);
      newCursorPos = selectionStart + wrapped.length;
    } else {
      const selectedText = value.slice(selectionStart, selectionEnd);
      if (selectedText) {
        const lines = selectedText.split(/\r?\n/);
        const formatted = lines
          .map((line) => {
            const trimmed = line.trim();
            if (format === 'bullet' && /^•\s+/.test(trimmed)) return line;
            if (format === 'number' && /^\d+\.\s+/.test(trimmed)) return line;
            const content = trimmed.length ? trimmed : 'List item';
            return format === 'bullet' ? `• ${content}` : `1. ${content}`;
          })
          .join('\n');
        newValue = value.slice(0, selectionStart) + formatted + value.slice(selectionEnd);
        newCursorPos = selectionStart + formatted.length;
      } else {
        const needsNewLine =
          selectionStart !== 0 && value.slice(0, selectionStart).slice(-1) !== '\n';
        const prefix = needsNewLine ? '\n' : '';
        const addition = format === 'bullet' ? `${prefix}• ` : `${prefix}1. `;
        newValue = value.slice(0, selectionStart) + addition + value.slice(selectionEnd);
        newCursorPos = selectionStart + addition.length;
      }
    }

    setVacancyFormData((prev) => ({
      ...prev,
      [field]: newValue,
    }));

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    });
  };

  const renderFormattingToolbar = (field: RichTextField) => (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Formatting:</span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => applyFormatting(field, 'bold')}
          className="rounded border border-slate-300 px-2 py-0.5 font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyFormatting(field, 'bullet')}
          className="rounded border border-slate-300 px-2 py-0.5 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          aria-label="Bullet list"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => applyFormatting(field, 'number')}
          className="rounded border border-slate-300 px-2 py-0.5 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          aria-label="Numbered list"
        >
          1.
        </button>
      </div>
    </div>
  );

  const renderRichText = (content?: string) => {
    if (!content) return null;

    const escapeHtml = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const formatInline = (line: string) =>
      escapeHtml(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    const blocks: React.ReactNode[] = [];
    let listBuffer: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (!listType || listBuffer.length === 0) {
        listBuffer = [];
        listType = null;
        return;
      }

      const ListTag = listType === 'ul' ? 'ul' : 'ol';
      blocks.push(
        <ListTag
          key={`list-${blocks.length}`}
          className={
            listType === 'ul'
              ? 'list-disc pl-5 text-sm space-y-1'
              : 'list-decimal pl-5 text-sm space-y-1'
          }
        >
          {listBuffer.map((item, idx) => (
            <li key={`item-${idx}`} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </ListTag>,
      );
      listBuffer = [];
      listType = null;
    };

    const lines = content.split(/\r?\n/);

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const isBullet = trimmed.startsWith('• ');
      const numberMatch = trimmed.match(/^(\d+)\.\s+/);

      if (isBullet || numberMatch) {
        const currentType = isBullet ? 'ul' : 'ol';
        if (listType && listType !== currentType) {
          flushList();
        }
        listType = currentType;
        const text = isBullet
          ? trimmed.slice(2)
          : trimmed.replace(/^(\d+)\.\s+/, '');
        listBuffer.push(formatInline(text));
        return;
      }

      flushList();
      if (trimmed.length === 0) {
        blocks.push(<p key={`empty-${idx}`} className="text-sm">&nbsp;</p>);
      } else {
        blocks.push(
          <p
            key={`p-${idx}`}
            className="whitespace-pre-wrap text-sm"
            dangerouslySetInnerHTML={{ __html: formatInline(line) }}
          />,
        );
      }
    });

    flushList();

    return <div className="mt-1 space-y-1">{blocks}</div>;
  };

  const openEditDialog = (vacancy: Vacancy) => {
    setSelectedVacancy(vacancy);
    setVacancyFormData({
      title: vacancy.title,
      department: vacancy.department,
      description: vacancy.description,
      requirements: vacancy.requirements || '',
      responsibilities: vacancy.responsibilities || '',
      nice_to_have_skills: vacancy.nice_to_have_skills || '',
      location: vacancy.location,
      employment_type: vacancy.employment_type,
      salary_range: vacancy.salary_range || '',
      status: vacancy.status,
    });
    setIsVacancyDialogOpen(true);
  };

  const openViewDialog = (vacancy: Vacancy) => {
    setSelectedVacancy(vacancy);
    setIsViewVacancyDialogOpen(true);
  };

  const openSocialMediaDialog = (vacancy: Vacancy) => {
    setSelectedVacancy(vacancy);
    setIsSocialMediaDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      open: 'default',
      closed: 'secondary',
      'on-hold': 'outline',
      applied: 'default',
      'shortlisted': 'default',
      'interviewed': 'default',
      'offered': 'default',
      'rejected': 'destructive',
      'hired': 'default',
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace('-', ' ')}
      </Badge>
    );
  };

  const getSocialMediaLinks = (vacancy: Vacancy) => {
    if (!vacancy.social_media_links) return {};
    try {
      return JSON.parse(vacancy.social_media_links);
    } catch {
      return {};
    }
  };

  const isAdmin = user?.role === 'admin';
  const isHR = user?.role === 'hr';

  return (
    <div className="space-y-6 relative min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Hiring Management</h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Create modern job posts, track candidates, and coordinate your hiring pipeline.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-1 text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setActiveTab('vacancies')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition ${activeTab === 'vacancies'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                <Briefcase className="h-4 w-4" />
                Vacancies
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('candidates')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition ${activeTab === 'candidates'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                <Users className="h-4 w-4" />
                Candidates
              </button>
            </div>
            {activeTab === 'vacancies' && (
              <Button
                className="hidden md:inline-flex gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  resetVacancyForm();
                  setSelectedVacancy(null);
                  setIsVacancyDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t.hiring.createVacancy}</span>
                <span className="sm:hidden">{t.common.add}</span>
              </Button>
            )}
            {activeTab === 'candidates' && (
              <Button
                className="hidden md:inline-flex gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  resetCandidateForm();
                  setIsCandidateDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Candidate</span>
                <span className="sm:hidden">New</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile create button */}
      {activeTab === 'vacancies' && (
        <div className="md:hidden">
          <Button
            className="w-full rounded-full"
            onClick={() => {
              resetVacancyForm();
              setSelectedVacancy(null);
              setIsVacancyDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Vacancy
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-full bg-slate-100/80 dark:bg-slate-900/80 p-1 mx-auto">
          <TabsTrigger
            value="vacancies"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-full text-xs sm:text-sm"
          >
            <Briefcase className="mr-1.5 h-4 w-4" />
            Vacancies
          </TabsTrigger>
          <TabsTrigger
            value="candidates"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-full text-xs sm:text-sm"
          >
            <Users className="mr-1.5 h-4 w-4" />
            Candidates
          </TabsTrigger>
        </TabsList>

        {/* Vacancies Tab */}
        <TabsContent value="vacancies" className="space-y-4">
          {/* Filters */}
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <CardContent className="pt-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search vacancies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                {isAdmin && (
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-slate-950">
                      <SelectValue placeholder="Department" />
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
                )}
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-slate-950">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Vacancies Table */}
          <Card className="border border-slate-200 dark:border-slate-700 shadow-md rounded-3xl">
            <CardHeader className="border-b bg-slate-50 dark:bg-slate-800 rounded-t-3xl">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">Job Vacancies</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Overview of all open roles and hiring progress.
                  </p>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex gap-1">
                  <Briefcase className="h-3 w-3" />
                  {filteredVacancies.length} roles
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredVacancies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No vacancies found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Candidates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Social Media</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVacancies.map((vacancy) => {
                        const socialLinks = getSocialMediaLinks(vacancy);
                        return (
                          <TableRow key={vacancy.vacancy_id}>
                            <TableCell className="font-medium">{vacancy.title}</TableCell>
                            <TableCell>{vacancy.department}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {vacancy.location}
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">
                              {vacancy.employment_type.replace('-', ' ')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{vacancy.candidates_count}</Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(vacancy.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {vacancy.posted_on_linkedin && (
                                  <Linkedin className="h-4 w-4 text-blue-600" />
                                )}
                                {vacancy.posted_on_naukri && (
                                  <FileText className="h-4 w-4 text-green-600" />
                                )}
                                {vacancy.posted_on_indeed && (
                                  <FileText className="h-4 w-4 text-blue-500" />
                                )}
                                {vacancy.posted_on_other && (
                                  <Share2 className="h-4 w-4 text-purple-600" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openViewDialog(vacancy)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openSocialMediaDialog(vacancy)}
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(vacancy)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteVacancy(vacancy.vacancy_id)}
                                  disabled={isDeleting === vacancy.vacancy_id}
                                >
                                  {isDeleting === vacancy.vacancy_id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Candidates Tab */}
        <TabsContent value="candidates" className="space-y-4">
          {/* Filters */}
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <CardContent className="pt-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search candidates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-slate-950">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                    <SelectItem value="screening">Screening</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="hired">Hired</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Candidates Table */}
          <Card className="border border-slate-200 dark:border-slate-700 shadow-md rounded-3xl">
            <CardHeader className="border-b bg-slate-50 dark:bg-slate-800 rounded-t-3xl">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">Candidate Applications</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Track applicants across stages and manage interviews.
                  </p>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex gap-1">
                  <Users className="h-3 w-3" />
                  {filteredCandidates.length} candidates
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No candidates found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Applied Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCandidates.map((candidate) => (
                        <TableRow key={candidate.candidate_id}>
                          <TableCell className="font-medium">{candidate.name}</TableCell>
                          <TableCell>{candidate.email}</TableCell>
                          <TableCell>{candidate.phone || '-'}</TableCell>
                          <TableCell>{candidate.vacancy_title || '-'}</TableCell>
                          <TableCell>{candidate.vacancy_department || '-'}</TableCell>
                          <TableCell>
                            {formatDateIST(candidate.applied_at, 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={candidate.status}
                              onValueChange={(value) =>
                                handleUpdateCandidateStatus(candidate.candidate_id, value)
                              }
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="applied">Applied</SelectItem>
                                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                <SelectItem value="interviewed">Interviewed</SelectItem>
                                <SelectItem value="offered">Offered</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="hired">Hired</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedCandidate(candidate);
                                  setIsViewCandidateDialogOpen(true);
                                }}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedCandidate(candidate);
                                  setShortlistFormData({
                                    interview_date: '',
                                    interview_time: '',
                                    interview_mode: 'online',
                                    location_or_link: '',
                                    interviewer_name: '',
                                  });
                                  setIsShortlistDialogOpen(true);
                                }}
                                title="Shortlist for Interview"
                              >
                                <Calendar className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedCandidate(candidate);
                                  setResumeUpdateData({
                                    resume_external_url: candidate.resume_external_url || '',
                                  });
                                  setIsUpdateResumeDialogOpen(true);
                                }}
                                title="Update Resume"
                              >
                                <FileText className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCandidate(candidate.candidate_id)}
                                disabled={isDeleting === candidate.candidate_id}
                                title="Delete Candidate"
                              >
                                {isDeleting === candidate.candidate_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Vacancy Dialog */}
      <Dialog open={isVacancyDialogOpen} onOpenChange={setIsVacancyDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
          <DialogHeader className="border-b border-slate-200/60 dark:border-slate-800/60 pb-4 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center shadow-sm">
                  <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-semibold tracking-tight">
                    {selectedVacancy ? 'Edit Vacancy' : 'Create New Vacancy'}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm mt-1">
                    {selectedVacancy
                      ? 'Polish the details for this role before publishing.'
                      : 'Craft a compelling job post with clear responsibilities and requirements.'}
                  </DialogDescription>
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1">
                <Badge
                  variant="outline"
                  className="gap-1 px-2 py-0.5 text-[11px] border-indigo-500/40 text-indigo-700 dark:text-indigo-300"
                >
                  <Clock className="h-3 w-3" />
                  {selectedVacancy ? 'Editing existing role' : 'New opportunity'}
                </Badge>
                {vacancyFormData.status && (
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Status: {vacancyFormData.status.replace('-', ' ')}
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Role Snapshot */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Role Snapshot
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Give this vacancy a clear title and connect it to the right department.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    value={vacancyFormData.title}
                    onChange={(e) =>
                      setVacancyFormData({ ...vacancyFormData, title: e.target.value })
                    }
                    placeholder="e.g., Senior Software Engineer"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Select
                    value={vacancyFormData.department}
                    onValueChange={(value) =>
                      setVacancyFormData({ ...vacancyFormData, department: value })
                    }
                    disabled={isHR}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isHR && (
                    <p className="text-xs text-muted-foreground">
                      You can only create vacancies for your department.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={vacancyFormData.location}
                    onChange={(e) =>
                      setVacancyFormData({ ...vacancyFormData, location: e.target.value })
                    }
                    placeholder="e.g., Mumbai, India"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employment_type">Employment Type *</Label>
                  <Select
                    value={vacancyFormData.employment_type}
                    onValueChange={(value) =>
                      setVacancyFormData({ ...vacancyFormData, employment_type: value })
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full Time</SelectItem>
                      <SelectItem value="part-time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary_range">Salary Range</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      id="salary_range"
                      value={vacancyFormData.salary_range}
                      onChange={(e) =>
                        setVacancyFormData({ ...vacancyFormData, salary_range: e.target.value })
                      }
                      placeholder="e.g., ₹5L - ₹10L"
                      className="pl-7 h-10"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={vacancyFormData.status}
                    onValueChange={(value) =>
                      setVacancyFormData({ ...vacancyFormData, status: value })
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="hidden md:block" />
                <div className="hidden md:block" />
              </div>
            </div>

            {/* Role Narrative */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/70 p-4 sm:p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Role Narrative
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Use rich descriptions, responsibilities, and requirements to attract the right
                    talent.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">📝 Job Description *</Label>
                  {renderFormattingToolbar('description')}
                  <Textarea
                    id="description"
                    ref={descriptionRef}
                    value={vacancyFormData.description}
                    onChange={(e) =>
                      setVacancyFormData({ ...vacancyFormData, description: e.target.value })
                    }
                    placeholder="Describe the role, mission, and impact of this position..."
                    rows={4}
                  />
                  {vacancyFormData.description && (
                    <div className="mt-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        Live Preview
                      </p>
                      {renderRichText(vacancyFormData.description)}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsibilities">🔧 Responsibilities</Label>
                  {renderFormattingToolbar('responsibilities')}
                  <Textarea
                    id="responsibilities"
                    ref={responsibilitiesRef}
                    value={vacancyFormData.responsibilities}
                    onChange={(e) =>
                      setVacancyFormData({ ...vacancyFormData, responsibilities: e.target.value })
                    }
                    placeholder="Outline the day-to-day responsibilities..."
                    rows={4}
                  />
                  {vacancyFormData.responsibilities && (
                    <div className="mt-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        Live Preview
                      </p>
                      {renderRichText(vacancyFormData.responsibilities)}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">🎯 Requirements</Label>
                  {renderFormattingToolbar('requirements')}
                  <Textarea
                    id="requirements"
                    ref={requirementsRef}
                    value={vacancyFormData.requirements}
                    onChange={(e) =>
                      setVacancyFormData({ ...vacancyFormData, requirements: e.target.value })
                    }
                    placeholder="List the required skills, qualifications, and experience..."
                    rows={4}
                  />
                  {vacancyFormData.requirements && (
                    <div className="mt-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        Live Preview
                      </p>
                      {renderRichText(vacancyFormData.requirements)}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nice_to_have_skills">✨ Nice-to-Have Skills</Label>
                  {renderFormattingToolbar('nice_to_have_skills')}
                  <Textarea
                    id="nice_to_have_skills"
                    ref={niceToHaveRef}
                    value={vacancyFormData.nice_to_have_skills}
                    onChange={(e) =>
                      setVacancyFormData({
                        ...vacancyFormData,
                        nice_to_have_skills: e.target.value,
                      })
                    }
                    placeholder="Share any bonus skills or experience that would make candidates stand out..."
                    rows={3}
                  />
                  {vacancyFormData.nice_to_have_skills && (
                    <div className="mt-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        Live Preview
                      </p>
                      {renderRichText(vacancyFormData.nice_to_have_skills)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsVacancyDialogOpen(false);
              resetVacancyForm();
              setSelectedVacancy(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={selectedVacancy ? handleUpdateVacancy : handleCreateVacancy}
              disabled={isCreating || isUpdating}
            >
              {isCreating || isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {selectedVacancy ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                selectedVacancy ? 'Update' : 'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Vacancy Dialog */}
      <Dialog open={isViewVacancyDialogOpen} onOpenChange={setIsViewVacancyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedVacancy?.title}</DialogTitle>
            <DialogDescription>
              {selectedVacancy?.department} • {selectedVacancy?.location}
            </DialogDescription>
          </DialogHeader>
          {selectedVacancy && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Employment Type</Label>
                  <p className="capitalize">{selectedVacancy.employment_type.replace('-', ' ')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedVacancy.status)}</div>
                </div>
                {selectedVacancy.salary_range && (
                  <div>
                    <Label className="text-muted-foreground">Salary Range</Label>
                    <p>{selectedVacancy.salary_range}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Candidates</Label>
                  <p>{selectedVacancy.candidates_count} applications</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">📝 Job Description</Label>
                {renderRichText(selectedVacancy.description) || (
                  <p className="mt-1 text-sm text-muted-foreground">No description provided.</p>
                )}
              </div>
              {selectedVacancy.responsibilities && (
                <div>
                  <Label className="text-muted-foreground">🔧 Responsibilities</Label>
                  {renderRichText(selectedVacancy.responsibilities)}
                </div>
              )}
              {selectedVacancy.requirements && (
                <div>
                  <Label className="text-muted-foreground">🎯 Requirements</Label>
                  {renderRichText(selectedVacancy.requirements)}
                </div>
              )}
              {selectedVacancy.nice_to_have_skills && (
                <div>
                  <Label className="text-muted-foreground">✨ Nice-to-Have Skills</Label>
                  {renderRichText(selectedVacancy.nice_to_have_skills)}
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Social Media Posts</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedVacancy.posted_on_linkedin && (
                    <Badge variant="outline" className="gap-1">
                      <Linkedin className="h-3 w-3" />
                      LinkedIn
                    </Badge>
                  )}
                  {selectedVacancy.posted_on_naukri && (
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      Naukri
                    </Badge>
                  )}
                  {selectedVacancy.posted_on_indeed && (
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      Indeed
                    </Badge>
                  )}
                  {selectedVacancy.posted_on_other && (
                    <Badge variant="outline" className="gap-1">
                      <Share2 className="h-3 w-3" />
                      Other
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewVacancyDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Social Media Posting Dialog */}
      <Dialog open={isSocialMediaDialogOpen} onOpenChange={setIsSocialMediaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post to Social Media</DialogTitle>
            <DialogDescription>
              Select platforms to post the vacancy: {selectedVacancy?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="linkedin"
                  checked={socialMediaData.platforms.includes('linkedin')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSocialMediaData({
                        ...socialMediaData,
                        platforms: [...socialMediaData.platforms, 'linkedin'],
                      });
                    } else {
                      setSocialMediaData({
                        ...socialMediaData,
                        platforms: socialMediaData.platforms.filter((p) => p !== 'linkedin'),
                        links: { ...socialMediaData.links, linkedin: undefined },
                      });
                    }
                  }}
                />
                <Label htmlFor="linkedin" className="flex items-center gap-2 cursor-pointer">
                  <Linkedin className="h-4 w-4 text-blue-600" />
                  LinkedIn
                </Label>
              </div>
              {socialMediaData.platforms.includes('linkedin') && (
                <Input
                  placeholder="LinkedIn post URL (optional)"
                  value={socialMediaData.links.linkedin || ''}
                  onChange={(e) =>
                    setSocialMediaData({
                      ...socialMediaData,
                      links: { ...socialMediaData.links, linkedin: e.target.value },
                    })
                  }
                  className="ml-6"
                />
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="naukri"
                  checked={socialMediaData.platforms.includes('naukri')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSocialMediaData({
                        ...socialMediaData,
                        platforms: [...socialMediaData.platforms, 'naukri'],
                      });
                    } else {
                      setSocialMediaData({
                        ...socialMediaData,
                        platforms: socialMediaData.platforms.filter((p) => p !== 'naukri'),
                        links: { ...socialMediaData.links, naukri: undefined },
                      });
                    }
                  }}
                />
                <Label htmlFor="naukri" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-green-600" />
                  Naukri
                </Label>
              </div>
              {socialMediaData.platforms.includes('naukri') && (
                <Input
                  placeholder="Naukri post URL (optional)"
                  value={socialMediaData.links.naukri || ''}
                  onChange={(e) =>
                    setSocialMediaData({
                      ...socialMediaData,
                      links: { ...socialMediaData.links, naukri: e.target.value },
                    })
                  }
                  className="ml-6"
                />
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="indeed"
                  checked={socialMediaData.platforms.includes('indeed')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSocialMediaData({
                        ...socialMediaData,
                        platforms: [...socialMediaData.platforms, 'indeed'],
                      });
                    } else {
                      setSocialMediaData({
                        ...socialMediaData,
                        platforms: socialMediaData.platforms.filter((p) => p !== 'indeed'),
                        links: { ...socialMediaData.links, indeed: undefined },
                      });
                    }
                  }}
                />
                <Label htmlFor="indeed" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-500" />
                  Indeed
                </Label>
              </div>
              {socialMediaData.platforms.includes('indeed') && (
                <Input
                  placeholder="Indeed post URL (optional)"
                  value={socialMediaData.links.indeed || ''}
                  onChange={(e) =>
                    setSocialMediaData({
                      ...socialMediaData,
                      links: { ...socialMediaData.links, indeed: e.target.value },
                    })
                  }
                  className="ml-6"
                />
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="other"
                  checked={socialMediaData.platforms.includes('other')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSocialMediaData({
                        ...socialMediaData,
                        platforms: [...socialMediaData.platforms, 'other'],
                      });
                    } else {
                      setSocialMediaData({
                        ...socialMediaData,
                        platforms: socialMediaData.platforms.filter((p) => p !== 'other'),
                        links: { ...socialMediaData.links, other: undefined },
                      });
                    }
                  }}
                />
                <Label htmlFor="other" className="flex items-center gap-2 cursor-pointer">
                  <Share2 className="h-4 w-4 text-purple-600" />
                  Other Platforms
                </Label>
              </div>
              {socialMediaData.platforms.includes('other') && (
                <Input
                  placeholder="Other platform post URL (optional)"
                  value={socialMediaData.links.other || ''}
                  onChange={(e) =>
                    setSocialMediaData({
                      ...socialMediaData,
                      links: { ...socialMediaData.links, other: e.target.value },
                    })
                  }
                  className="ml-6"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsSocialMediaDialogOpen(false);
              setSocialMediaData({ platforms: [], links: {} });
            }}>
              Cancel
            </Button>
            <Button onClick={handlePostToSocialMedia}>
              <Share2 className="mr-2 h-4 w-4" />
              Post to Selected Platforms
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Candidate Dialog */}
      <Dialog open={isViewCandidateDialogOpen} onOpenChange={setIsViewCandidateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Candidate Profile: {selectedCandidate?.name}</DialogTitle>
            <DialogDescription>{selectedCandidate?.email}</DialogDescription>
          </DialogHeader>
          {selectedCandidate && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Status</Label>
                    {getStatusBadge(selectedCandidate.status)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                    Applied Position
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-medium">{selectedCandidate.vacancy_title || '-'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedCandidate.vacancy_department || '-'}</p>
                    <p className="text-xs text-muted-foreground mt-3">Applied on {formatDateTimeIST(selectedCandidate.applied_at, 'MMM dd, yyyy')}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-orange-500" />
                    Contact Information
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                    {selectedCandidate.phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Phone:</span>
                        <span>{selectedCandidate.phone}</span>
                      </div>
                    )}
                    {selectedCandidate.address && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="flex-1">{selectedCandidate.address}</span>
                      </div>
                    )}
                    {(selectedCandidate.linkedin_url || selectedCandidate.portfolio_url) && (
                      <div className="flex gap-3 pt-2">
                        {selectedCandidate.linkedin_url && (
                          <a href={selectedCandidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:opacity-80 transition-opacity">
                            <Linkedin className="h-4 w-4" />
                          </a>
                        )}
                        {selectedCandidate.portfolio_url && (
                          <a href={selectedCandidate.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-400 hover:opacity-80 transition-opacity">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedCandidate.status === 'interview' && selectedCandidate.interview_date && (
                <div className="bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Calendar className="h-4 w-4" />
                    Scheduled Interview
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground block mb-1">Date</span>
                      <span className="font-medium">{formatDateIST(selectedCandidate.interview_date, 'MMM dd, yyyy')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Time</span>
                      <span className="font-medium">{selectedCandidate.interview_time || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Mode</span>
                      <Badge variant="secondary" className="capitalize text-[10px] py-0">{selectedCandidate.interview_mode || '-'}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Interviewer</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">{selectedCandidate.interviewer_name || '-'}</span>
                    </div>
                  </div>
                  {selectedCandidate.location_or_link && (
                    <div className="pt-2 border-t border-blue-100 dark:border-blue-800/50">
                      <span className="text-muted-foreground text-xs block mb-1">Location / Join Link</span>
                      <p className="text-xs break-all text-blue-600 underline">
                        {selectedCandidate.location_or_link.startsWith('http') ? (
                          <a href={selectedCandidate.location_or_link} target="_blank" rel="noopener noreferrer">{selectedCandidate.location_or_link}</a>
                        ) : selectedCandidate.location_or_link}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedCandidate.cover_letter && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover Letter</Label>
                  <p className="text-sm bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                    {selectedCandidate.cover_letter}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resume</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedCandidate.resume_url && (
                    <Button
                      variant="outline"
                      className="h-9 px-4 rounded-lg bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 hover:bg-green-100"
                      onClick={() => window.open(selectedCandidate.resume_url, '_blank')}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      View Uploaded Resume
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  )}
                  {selectedCandidate.resume_external_url && (
                    <Button
                      variant="outline"
                      className="h-9 px-4 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100"
                      onClick={() => window.open(selectedCandidate.resume_external_url, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Portfolio/External Resume
                    </Button>
                  )}
                  {!selectedCandidate.resume_url && !selectedCandidate.resume_external_url && (
                    <p className="text-xs text-muted-foreground italic">No resume provided</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewCandidateDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Candidate Dialog */}
      <Dialog open={isCandidateDialogOpen} onOpenChange={setIsCandidateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Candidate</DialogTitle>
            <DialogDescription>Enter candidate information and link them to a vacancy.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c_first_name">First Name *</Label>
                <Input
                  id="c_first_name"
                  value={candidateFormData.first_name}
                  onChange={(e) => setCandidateFormData({ ...candidateFormData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c_last_name">Last Name *</Label>
                <Input
                  id="c_last_name"
                  value={candidateFormData.last_name}
                  onChange={(e) => setCandidateFormData({ ...candidateFormData, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c_email">Email *</Label>
                <Input
                  id="c_email"
                  type="email"
                  value={candidateFormData.email}
                  onChange={(e) => setCandidateFormData({ ...candidateFormData, email: e.target.value })}
                  placeholder="john.doe@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c_phone">Phone Number *</Label>
                <Input
                  id="c_phone"
                  value={candidateFormData.phone}
                  onChange={(e) => setCandidateFormData({ ...candidateFormData, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c_vacancy">Vacancy *</Label>
              <Select
                value={candidateFormData.vacancy_id}
                onValueChange={(value) => setCandidateFormData({ ...candidateFormData, vacancy_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a job opening" />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.filter(v => v.status === 'open').map((v) => (
                    <SelectItem key={v.vacancy_id} value={String(v.vacancy_id)}>
                      {v.title} ({v.department})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c_address">Address</Label>
              <Input
                id="c_address"
                value={candidateFormData.address}
                onChange={(e) => setCandidateFormData({ ...candidateFormData, address: e.target.value })}
                placeholder="State, City, Country"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c_linkedin">LinkedIn Profile URL</Label>
                <Input
                  id="c_linkedin"
                  value={candidateFormData.linkedin_url}
                  onChange={(e) => setCandidateFormData({ ...candidateFormData, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c_portfolio">Portfolio URL</Label>
                <Input
                  id="c_portfolio"
                  value={candidateFormData.portfolio_url}
                  onChange={(e) => setCandidateFormData({ ...candidateFormData, portfolio_url: e.target.value })}
                  placeholder="https://github.com/..."
                />
              </div>
            </div>
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-semibold">Resume Submission</h4>
              <div className="space-y-2">
                <Label htmlFor="c_resume_file">Upload Resume (PDF/DOCX)</Label>
                <Input
                  id="c_resume_file"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setCandidateResumeFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or provide link</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c_resume_url">External Resume/Google Drive Link</Label>
                <Input
                  id="c_resume_url"
                  value={candidateFormData.resume_external_url}
                  onChange={(e) => setCandidateFormData({ ...candidateFormData, resume_external_url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCandidateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCandidate} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shortlist Dialog */}
      <Dialog open={isShortlistDialogOpen} onOpenChange={setIsShortlistDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Shortlist for Interview</DialogTitle>
            <DialogDescription>Schedule an interview for {selectedCandidate?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="int_date">Interview Date *</Label>
              <Input
                id="int_date"
                type="date"
                value={shortlistFormData.interview_date}
                onChange={(e) => setShortlistFormData({ ...shortlistFormData, interview_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int_time">Interview Time</Label>
              <Input
                id="int_time"
                type="time"
                value={shortlistFormData.interview_time}
                onChange={(e) => setShortlistFormData({ ...shortlistFormData, interview_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int_mode">Interview Mode *</Label>
              <Select
                value={shortlistFormData.interview_mode}
                onValueChange={(value) => setShortlistFormData({ ...shortlistFormData, interview_mode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="int_location">Meeting Link / Location</Label>
              <Input
                id="int_location"
                value={shortlistFormData.location_or_link}
                onChange={(e) => setShortlistFormData({ ...shortlistFormData, location_or_link: e.target.value })}
                placeholder="Zoom link or Office Address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int_interviewer">Interviewer Name *</Label>
              <Input
                id="int_interviewer"
                value={shortlistFormData.interviewer_name}
                onChange={(e) => setShortlistFormData({ ...shortlistFormData, interviewer_name: e.target.value })}
                placeholder="Name of the person conducting interview"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShortlistDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleShortlistCandidate} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Shortlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Resume Dialog */}
      <Dialog open={isUpdateResumeDialogOpen} onOpenChange={setIsUpdateResumeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Resume</DialogTitle>
            <DialogDescription>Update the resume or portfolio link for {selectedCandidate?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="up_resume_file">Upload New Resume (File)</Label>
              <Input
                id="up_resume_file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setNewResumeFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="up_resume_url">Update External Link</Label>
              <Input
                id="up_resume_url"
                value={resumeUpdateData.resume_external_url}
                onChange={(e) => setResumeUpdateData({ ...resumeUpdateData, resume_external_url: e.target.value })}
                placeholder="https://drive.google.com/..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateResumeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateResume} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Resume
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

