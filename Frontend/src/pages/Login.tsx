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
import { Mail, Shield, Users, Clock, ClipboardList, Globe, Phone, CheckCircle2, Settings, Home, MessageCircle, HelpCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Language } from '@/i18n/translations';
import loginBackgroundImage from '@/components/asstes/empty-room-with-chairs-desks_23-2149008873.avif';

import { API_BASE_URL } from '@/lib/api';

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
  }, [isAuthenticated, navigate]);

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

        // Call the auth context login method with the verified data
        await login({
          user_id: userData.user_id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          access_token: userData.access_token,
          department: userData.department,
          designation: userData.designation,
          joining_date: userData.joining_date
        });
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
    <div className="min-h-screen flex bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
      {/* Left Panel - Branding and Features with Gradient Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-end pr-8 xl:pr-16">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-blue-300 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-purple-300 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center p-12 lg:p-16 max-w-xl">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="h-12 w-12 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 flex items-center justify-center shadow-lg rounded-xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-transparent"></div>
              <span className="text-2xl font-bold text-white relative z-10">S</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Staffly</h1>
          </div>

          {/* Heading */}
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-800 mb-4 leading-tight">
            Welcome to Your{' '}
            <span className="text-blue-600">Workspace</span>
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Streamline your workforce with intelligent attendance tracking, task management, and seamless collaboration.
          </p>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* Smart Attendance Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-white/50">
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Smart Attendance</h3>
              <p className="text-xs text-slate-600">Real-time tracking</p>
            </div>

            {/* Task Manager Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-white/50">
              <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                <ClipboardList className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Task Manager</h3>
              <p className="text-xs text-slate-600">Stay organized</p>
            </div>

            {/* Team Sync Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-white/50">
              <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Team Sync</h3>
              <p className="text-xs text-slate-600">Collaborate better</p>
            </div>

            {/* Secure Access Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-white/50">
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Secure Access</h3>
              <p className="text-xs text-slate-600">Role-based control</p>
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
                Login to Shekru labs India
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

              {/* Form */}
              {!otpSent ? (
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
                        className="h-12 pl-10 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
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
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
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

                  <div className="text-center mt-4">
                    <p className="text-xs text-slate-500">
                      By logging in, you agree to our{' '}
                      <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
                      {' '}and{' '}
                      <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </p>
                  </div>
                </form>
              ) : (
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
                      className="text-center tracking-[0.5em] text-2xl font-semibold h-14 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    />
                    <div className="flex items-center justify-between text-xs mt-2">
                      <p className="text-slate-500">
                        OTP sent to <span className="font-medium text-slate-700">{email}</span>
                      </p>
                      {otpExpiryTime > 0 ? (
                        <p className="text-blue-600 font-medium">
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
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
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

              {/* Support Link */}
              <div className="text-center mt-6">
                <p className="text-sm text-slate-600">
                  Need help?{' '}
                  <Link to="/contact-support" className="text-blue-600 hover:underline font-medium">
                    Contact Support
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;