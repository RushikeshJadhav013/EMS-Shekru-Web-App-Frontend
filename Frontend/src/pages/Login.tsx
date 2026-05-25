/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Shield, Users, Clock, ClipboardList, Globe, Phone, CheckCircle2, Settings, Home, MessageCircle, HelpCircle, Building2, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Logo } from '@/components/ui/Logo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Language } from '@/i18n/translations';
import loginBackgroundImage from '@/components/asstes/empty-room-with-chairs-desks_23-2149008873.avif';

import { API_BASE_URL, apiService } from '@/lib/api';

// API endpoints
const API_ENDPOINTS = {
  sendOtp: `${API_BASE_URL}/auth/send-otp`,
  verifyOtp: `${API_BASE_URL}/auth/verify-otp`
};

// Configure axios defaults
axios.defaults.baseURL = '';  // Using absolute URLs
axios.defaults.headers.post['Content-Type'] = 'application/json';
axios.defaults.timeout = 30000; // 30 second timeout

interface ApiError {
  response?: {
    data?: {
      message?: string;
      detail?: string | Array<{ type: string; loc: Array<string | number>; msg: string; input: any }>;
    };
  };
}

const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [otpExpiryTime, setOtpExpiryTime] = useState<number>(0); // Countdown in seconds
  const [canResend, setCanResend] = useState(false);

  // Admin Company Selection State
  const [showCompanySelect, setShowCompanySelect] = useState(false);
  const [accessibleCompanies, setAccessibleCompanies] = useState<any[]>([]);
  const [selectedCompanySlug, setSelectedCompanySlug] = useState<string>('');
  const [tempAuthData, setTempAuthData] = useState<any>(null);
  const [lastShownError, setLastShownError] = useState<string>('');
  const [lastOtpAttempt, setLastOtpAttempt] = useState<string>('');
  const otpInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus OTP input when OTP form is shown
  useEffect(() => {
    if (otpSent && otpInputRef.current) {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [otpSent]);

  // Check for session message from navigation state
  useEffect(() => {
    if (location.state?.message) {
      setSessionMessage(location.state.message);
      toast({
        title: 'Session Required',
        description: location.state.message,
        variant: 'default',
      });
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location, toast]);

  // Redirect if already authenticated
  useEffect(() => {
    // If we're showing the company selection modal, don't redirect yet
    if (showCompanySelect) return;

    if (isAuthenticated) {
      // Check if there's a last authenticated path stored
      const lastPath = localStorage.getItem('lastAuthenticatedPath');
      if (lastPath && lastPath !== '/login' && lastPath !== '/') {
        // Redirect to the last authenticated path
        navigate(lastPath, { replace: true });
      } else {
        // Fallback to admin dashboard
        navigate('/admin', { replace: true });
      }
    }
  }, [isAuthenticated, navigate, showCompanySelect]);

  // OTP Countdown Timer
  useEffect(() => {
    if (otpExpiryTime > 0) {
      const timer = setInterval(() => {
        setOtpExpiryTime((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [otpExpiryTime]);

  // Reset error tracking when OTP value changes
  useEffect(() => {
    if (otp !== lastOtpAttempt) {
      setLastShownError('');
    }
  }, [otp, lastOtpAttempt]);

  // Prevent back navigation to authenticated pages after logout
  useEffect(() => {
    const handlePopState = () => {
      if (!isAuthenticated) {
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAuthenticated]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError('');

    try {
      // Create axios instance with timeout and proper error handling
      const axiosInstance = axios.create({
        timeout: 30000, // 30 seconds
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // Send email as query parameter
      const response = await axiosInstance.post(`${API_ENDPOINTS.sendOtp}?email=${encodeURIComponent(email)}`);

      // Handle successful response
      if (response.status === 200 || response.status === 201) {
        setOtpSent(true);
        // Use backend expiry time or default to 120 seconds
        const expirySeconds = response.data?.expires_in_seconds || 120;
        setOtpExpiryTime(expirySeconds);
        setCanResend(false);
        const successMessage = response.data?.message || "OTP sent successfully";
        toast({
          variant: "success",
          title: "Success",
          description: successMessage,
        });
      }
    } catch (err: any) {
      console.error('OTP send error:', err);
      let errorMessage = 'Failed to send OTP';

      // Handle different types of errors
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your internet connection and try again.';
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check if the server is running and try again.';
      } else if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((error: any) => error.msg).join(', ');
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (!err.response) {
        errorMessage = 'Unable to connect to the server. Please check if the server is running.';
      }

      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format countdown time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResendOtp = async () => {
    if (!email || !canResend) return;

    setIsLoading(true);
    setError('');

    try {
      // Create axios instance with timeout
      const axiosInstance = axios.create({
        timeout: 30000, // 30 seconds
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const response = await axiosInstance.post(`${API_ENDPOINTS.sendOtp}?email=${encodeURIComponent(email)}`);

      if (response.status === 200 || response.status === 201) {
        // Use backend expiry time or default to 120 seconds
        const expirySeconds = response.data?.expires_in_seconds || 120;
        setOtpExpiryTime(expirySeconds);
        setCanResend(false);
        setOtp(''); // Clear previous OTP
        toast({
          variant: "success",
          title: "OTP Resent",
          description: "A new OTP has been sent to your email",
        });
      }
    } catch (err: any) {
      console.error('OTP resend error:', err);
      let errorMessage = 'Failed to resend OTP';

      // Handle different types of errors
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your internet connection and try again.';
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check if the server is running and try again.';
      } else if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((error: any) => error.msg).join(', ');
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }

      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !otp) return;

    // Prevent duplicate submissions while already loading
    if (isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      // Create axios instance with timeout
      const axiosInstance = axios.create({
        timeout: 30000, // 30 seconds
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // Send email and otp as query parameters
      const response = await axiosInstance.post(
        `${API_ENDPOINTS.verifyOtp}?email=${encodeURIComponent(email)}&otp=${otp}`
      );

      // Handle successful OTP verification
      if (response.status === 200 || response.status === 201) {
        const userData = response.data;
        console.log('Verify OTP Response:', userData); // Debug log

        // Clear error tracking on success
        setLastShownError('');
        setLastOtpAttempt('');

        // Store auth token and scope IDs immediately on successful login
        if (userData.access_token) {
          localStorage.setItem('token', userData.access_token);
        }
        if (userData.branch_id) localStorage.setItem('branchId', String(userData.branch_id));
        if (userData.company_id) localStorage.setItem('companyId', String(userData.company_id));
        if (userData.branchId) localStorage.setItem('branchId', String(userData.branchId));
        if (userData.companyId) localStorage.setItem('companyId', String(userData.companyId));

        // Fetch additional user profile and tenant context
        try {
          const profileData = await apiService.getCurrentUser();
          console.log('User Profile & Tenant Context:', profileData);
          if (profileData.company_slug) {
            localStorage.setItem('company_slug', profileData.company_slug);
          }
          if (profileData.company_name) {
            localStorage.setItem('company_name', profileData.company_name);
          }
        } catch (profileErr) {
          console.error('Failed to fetch user profile after login:', profileErr);
        }

        // If admin, fetch accessible companies and show selector
        if (userData.role === 'Admin' || userData.role === 'admin') {
          try {
            const companies = await apiService.getAccessibleCompanies();
            console.log('Admin Accessible Companies:', companies);

            if (companies && companies.length > 1) {
              localStorage.setItem('token', userData.access_token); // Store token for switch API
              setAccessibleCompanies(companies);
              setTempAuthData(userData);
              setShowCompanySelect(true);
              setIsLoading(false);
              return; // STOP HERE: Don't call login() or navigate() yet
            } else if (companies && companies.length === 1) {
              const singleCompany = companies[0];
              if (singleCompany.company_slug) {
                localStorage.setItem('company_slug', singleCompany.company_slug);
                localStorage.setItem('company_name', singleCompany.company_name);
              }
            }
            localStorage.setItem('accessibleCompanies', JSON.stringify(companies));
          } catch (compErr) {
            console.error('Failed to fetch companies after login:', compErr);
          }
        }

        // --- Standard Login Flow (Non-admin or Single-company Admin) ---
        await login({
          user_id: userData.user_id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          access_token: userData.access_token,
          department: userData.department,
          designation: userData.designation,
          joining_date: userData.joining_date,
          branch_id: userData.branch_id,
          company_id: userData.company_id,
        } as any);

        navigate('/admin', { replace: true });
      }
    } catch (err: any) {
      console.error('OTP verification error:', err);
      let errorMessage = 'Failed to verify OTP';

      // Handle different types of errors
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your internet connection and try again.';
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check if the server is running and try again.';
      } else if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((error: any) => error.msg).join(', ');
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (!err.response) {
        errorMessage = 'Unable to connect to the server. Please check if the server is running.';
      }

      setError(errorMessage);

      // Only show toast notification if:
      // 1. The error message is different from the last shown error, OR
      // 2. The OTP value has changed since the last attempt
      const shouldShowToast = lastShownError !== errorMessage || lastOtpAttempt !== otp;

      if (shouldShowToast) {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: errorMessage,
        });

        // Update tracking variables
        setLastShownError(errorMessage);
        setLastOtpAttempt(otp);
      }
    } finally {
      setIsLoading(false);
    }
  };



  // Auto-submit when OTP is filled
  useEffect(() => {
    if (otp.length === 6 && !isLoading) {
      handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <div className="relative min-h-screen flex overflow-x-hidden">
      {/* Background Image with Overlay */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000 scale-105"
        style={{
          backgroundImage: `url('/landing-bg.png')`,
        }}
      >
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 flex w-full min-h-screen">

        {/* Left Panel - Branding and Features with Gradient Background */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-end pr-8 xl:pr-16">
          {/* Decorative background removed to maintain clarity with new image background */}

          <div className="relative z-10 flex flex-col justify-center p-8 lg:p-12 max-w-lg">
            {/* Logo */}
            <div className="mb-6">
              <Logo
                className="flex items-center gap-3 drop-shadow-sm"
                iconClassName="h-10 w-10 text-emerald-400"
                textClassName="text-3xl font-bold tracking-tight text-white"
              />
            </div>

            {/* Heading */}
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              Welcome to Your{' '}
              <span className="text-emerald-400">Workspace</span>
            </h2>
            <p className="text-base text-slate-200 mb-6 font-medium">
              Streamline your workforce with intelligent attendance tracking, task management, and seamless collaboration.
            </p>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Smart Attendance Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-white/20">
                <div className="h-10 w-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-3">
                  <Clock className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-[13px] font-bold text-white mb-0.5">Smart Attendance</h3>
                <p className="text-[11px] text-slate-300">Real-time tracking</p>
              </div>

              {/* Task Manager Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-white/20">
                <div className="h-10 w-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-3">
                  <ClipboardList className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-[13px] font-bold text-white mb-0.5">Task Manager</h3>
                <p className="text-[11px] text-slate-300">Stay organized</p>
              </div>

              {/* Team Sync Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-white/20">
                <div className="h-10 w-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-3">
                  <Users className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-[13px] font-bold text-white mb-0.5">Team Sync</h3>
                <p className="text-[11px] text-slate-300">Collaborate better</p>
              </div>

              {/* Secure Access Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-white/20">
                <div className="h-10 w-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-3">
                  <Shield className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-[13px] font-bold text-white mb-0.5">Secure Access</h3>
                <p className="text-[11px] text-slate-300">Role-based control</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full lg:w-1/2 relative flex items-center justify-start pl-8 xl:pl-16 p-8 lg:p-12">
          {/* Form Card */}
          <div className="w-full max-w-md">
            <Card className="bg-white shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="space-y-1 pb-6 pt-8 px-8">
                {/* Language Selector */}
                <div className="flex justify-end mb-4">
                  <Select value={language} onValueChange={(value: Language) => setLanguage(value)}>
                    <SelectTrigger className="w-[140px] h-9 border-slate-200 bg-white rounded-lg">
                      <Globe className="h-4 w-4 mr-2 text-slate-600" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">हिंदी</SelectItem>
                      <SelectItem value="mr">मराठी</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <CardTitle className="text-2xl font-bold text-center text-slate-800">
                  Login to Staffly
                </CardTitle>
                <CardDescription className="text-center text-slate-600">
                  Enter your email to receive a secure OTP
                </CardDescription>
              </CardHeader>

              <CardContent className="px-8 pb-8">
                {/* Session Message */}
                {sessionMessage && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm mb-4">
                    <p className="font-medium">{sessionMessage}</p>
                  </div>
                )}

                {/* Form Content Toggle */}
                {showCompanySelect ? (
                  /* --- COMPANY SELECTION VIEW --- */
                  <div className="space-y-6 py-2">
                    <div className="bg-blue-50 border-2 border-black p-4 rounded-2xl mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-6 w-6 text-blue-600" />
                        <div>
                          <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Select Company</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Multiple organizations detected</p>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1 py-1 custom-scrollbar">
                      {accessibleCompanies.map((company) => (
                        <div
                          key={company.company_id}
                          onClick={() => setSelectedCompanySlug(company.company_slug)}
                          className={`group relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer flex items-center justify-between gap-4 ${selectedCompanySlug === company.company_slug
                            ? 'border-black bg-blue-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                            : 'border-slate-100 bg-white hover:border-black/20 hover:bg-slate-50'
                            }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedCompanySlug === company.company_slug ? 'border-black bg-black' : 'border-slate-300 bg-white'
                              }`}>
                              {selectedCompanySlug === company.company_slug && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-black text-sm truncate uppercase tracking-tight transition-colors ${selectedCompanySlug === company.company_slug ? 'text-black' : 'text-slate-700'
                                }`}>
                                {company.company_name}
                              </p>
                              <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase">ID: {company.company_id}</p>
                            </div>
                          </div>
                          {company.company_logo && (
                            <img src={company.company_logo} alt="" className="w-10 h-10 rounded-lg border border-slate-100 object-contain p-1 bg-white" />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <Button
                        disabled={!selectedCompanySlug || isLoading}
                        onClick={async () => {
                          setIsLoading(true);
                          try {
                            const selectedComp = accessibleCompanies.find(c => c.company_slug === selectedCompanySlug);
                            if (selectedComp) {
                              localStorage.setItem('companyId', String(selectedComp.company_id));
                              localStorage.setItem('company_slug', selectedComp.company_slug);
                              localStorage.setItem('company_name', selectedComp.company_name);
                            }

                            // Fetch fresh profile data to get the final tenant context
                            try {
                              const freshProfile = await apiService.getCurrentUser();
                              if (freshProfile.company_slug) localStorage.setItem('company_slug', freshProfile.company_slug);
                              if (freshProfile.company_name) localStorage.setItem('company_name', freshProfile.company_name);
                              if (freshProfile.company_id) localStorage.setItem('companyId', String(freshProfile.company_id));
                            } catch (profileErr) {
                              console.error('Failed to get me after company select:', profileErr);
                            }

                            if (tempAuthData) {
                              await login({
                                ...tempAuthData,
                                company_id: selectedComp ? selectedComp.company_id : tempAuthData.company_id
                              });
                            }
                            setShowCompanySelect(false);
                            navigate('/admin', { replace: true });
                          } catch (err) {
                            console.error('Failed to switch company:', err);
                            toast({ title: "Switch Failed", description: "Failed to connect to selected organization.", variant: "destructive" });
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="w-full h-14 rounded-2xl border-2 border-black bg-[#5882FF] hover:bg-[#436FE9] text-white font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-3"
                      >
                        {isLoading ? 'ESTABLISHING CONNECTION...' : (
                          <>CONTINUE TO DASHBOARD <ChevronRight className="h-5 w-5" /></>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowCompanySelect(false);
                          setTempAuthData(null);
                          setOtpSent(false);
                          setOtp('');
                        }}
                        className="w-full h-10 text-slate-400 hover:text-slate-900 font-bold uppercase text-[10px] tracking-widest"
                      >
                        ← Back to Login
                      </Button>
                    </div>
                  </div>
                ) : !otpSent ? (
                  /* --- EMAIL INPUT VIEW --- */
                  <form onSubmit={handleSendOtp} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-700 font-medium text-sm">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setSessionMessage(null);
                          }}
                          className="h-12 pl-10 bg-white border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                          Sending OTP...
                        </>
                      ) : (
                        'Send OTP'
                      )}
                    </Button>
                  </form>
                ) : (
                  /* --- OTP VERIFICATION VIEW --- */
                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="otp" className="text-slate-700 font-medium">
                        {t.auth.otp}
                      </Label>
                      <Input
                        ref={otpInputRef}
                        id="otp"
                        type="text"
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        maxLength={6}
                        required
                        disabled={isLoading}
                        className="text-center tracking-[0.5em] text-2xl font-semibold h-14 bg-white border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                      />
                      <div className="flex items-center justify-between text-xs mt-2">
                        <p className="text-slate-500">
                          OTP sent to <span className="font-medium text-slate-700">{email}</span>
                        </p>
                        {otpExpiryTime > 0 ? (
                          <p className="text-emerald-600 font-medium">
                            {formatTime(otpExpiryTime)}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={isLoading}
                            className="text-red-600 font-semibold hover:text-red-700 hover:underline transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoading ? 'Resending...' : 'Resend OTP'}
                          </button>
                        )}
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                      disabled={isLoading || otpExpiryTime === 0}
                    >
                      {isLoading ? (
                        <>
                          <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                          Verifying...
                        </>
                      ) : (
                        t.auth.verifyOtp
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-12 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp('');
                        setError('');
                        setOtpExpiryTime(0);
                        setCanResend(false);
                      }}
                      disabled={isLoading}
                    >
                      ← Change Email
                    </Button>
                  </form>
                )}

                <div className="text-center mt-6">
                  <p className="text-[12px] text-slate-400 font-medium">
                    Powered By{' '}
                    <a
                      href="https://shekruweb.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
                    >
                      Shekru Lab India Pvt. Ltd
                    </a>
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div >
  );
};

export default Login;
