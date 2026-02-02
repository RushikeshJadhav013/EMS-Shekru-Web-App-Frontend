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

// API endpoints
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://testing.staffly.space';
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
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form with Blurred Office Background */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center p-8 lg:p-12 overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${loginBackgroundImage})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        {/* Light overlay for better form readability */}
        <div className="absolute inset-0 bg-white/20" />

        {/* Form Card */}
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 lg:p-10">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div
                className="h-12 w-12 bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 flex items-center justify-center shadow-lg relative overflow-hidden"
                style={{
                  clipPath: 'polygon(25% 5%, 75% 5%, 95% 25%, 95% 75%, 75% 95%, 25% 95%, 5% 75%, 5% 25%)',
                  borderRadius: '18%'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/30 to-transparent"></div>
                <span className="text-2xl font-bold text-white relative z-10">S</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Staffly</h1>
            </div>

            {/* Heading */}
            <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">
              Sign in to continue to your account
            </h2>

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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email" className="text-slate-700 font-medium">
                      Email Address*
                    </Label>
                    <Select value={language} onValueChange={(value: Language) => setLanguage(value)}>
                      <SelectTrigger className="w-[140px] h-8 border-slate-200 bg-white/80">
                        <Globe className="h-3.5 w-3.5 mr-2 text-slate-600" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">हिंदी</SelectItem>
                        <SelectItem value="mr">मराठी</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setSessionMessage(null);
                    }}
                    className="h-12 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500 rounded-xl"
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
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
                    className="text-center tracking-[0.5em] text-2xl font-semibold h-14 bg-white border-slate-300 focus:border-purple-500 focus:ring-purple-500 rounded-xl"
                  />
                  <div className="flex items-center justify-between text-xs mt-2">
                    <p className="text-slate-500">
                      OTP sent to <span className="font-medium text-slate-700">{email}</span>
                    </p>
                    {otpExpiryTime > 0 ? (
                      <p className="text-purple-600 font-medium">
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
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
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

            {/* Social Media Icons */}
            <div className="flex justify-center gap-4 mt-6">
              <a
                href="https://google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold hover:bg-green-600 transition-colors shadow-md"
              >
                G
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold hover:bg-blue-700 transition-colors shadow-md"
              >
                f
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center text-white hover:opacity-90 transition-opacity shadow-md"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-colors shadow-md"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Marketing with Light Background */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-white via-slate-50/30 to-blue-50/20 relative overflow-hidden">
        {/* Grid Pattern Background */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />

        {/* Decorative Dots - Very subtle */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-2 h-2 bg-blue-200 rounded-full opacity-20 animate-pulse" />
          <div className="absolute top-40 right-32 w-1.5 h-1.5 bg-indigo-200 rounded-full opacity-15 animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-32 left-40 w-2 h-2 bg-blue-200 rounded-full opacity-18 animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-60 right-20 w-1 h-1 bg-indigo-200 rounded-full opacity-12 animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute bottom-60 right-40 w-1.5 h-1.5 bg-blue-200 rounded-full opacity-15 animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 h-full">
          {/* Top Section */}
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div
                className="h-12 w-12 bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 flex items-center justify-center shadow-lg relative overflow-hidden"
                style={{
                  clipPath: 'polygon(25% 5%, 75% 5%, 95% 25%, 95% 75%, 75% 95%, 25% 95%, 5% 75%, 5% 25%)',
                  borderRadius: '18%'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/30 to-transparent"></div>
                <span className="text-2xl font-bold text-white relative z-10">S</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Staffly</h1>
            </div>

            {/* Heading */}
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-800 mb-4 leading-tight">
              Welcome to Your{' '}
              <span className="text-blue-600">Workspace</span>
            </h2>
            <p className="text-xl text-slate-600 mb-12">
              Streamline your workforce with intelligent attendance tracking, task management, and seamless collaboration.
            </p>
          </div>

          {/* Center - Laptop Illustration */}
          <div className="flex-1 flex items-center justify-center my-8">
            <div className="relative">
              {/* Laptop Base */}
              <div className="relative w-64 h-40 bg-gradient-to-br from-slate-300 to-slate-400 rounded-lg shadow-2xl">
                {/* Screen */}
                <div className="absolute -top-32 left-1/2 transform -translate-x-1/2 w-72 h-48 bg-gradient-to-br from-slate-800 to-slate-900 rounded-t-lg shadow-2xl border-4 border-slate-600">
                  {/* Screen Content */}
                  <div className="p-4 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-2 w-2 rounded-full bg-red-500"></div>
                      <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 bg-slate-700 rounded p-2">
                      <div className="h-2 bg-slate-600 rounded w-3/4 mb-2"></div>
                      <div className="h-2 bg-slate-600 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
                {/* Keyboard Area */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-slate-500 rounded-b-lg"></div>
              </div>

              {/* Floating UI Elements */}
              <div className="absolute -top-20 -right-8 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shadow-md">
                <CheckCircle2 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="absolute -bottom-12 -left-8 w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shadow-md">
                <MessageCircle className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="absolute top-1/2 -right-16 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shadow-md">
                <ClipboardList className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Bottom Section - Features */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-slate-700 text-lg">
                Manage attendance, leave, tasks, payroll and more from one platform.
              </p>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-slate-700 text-lg">
                Secure, fast, and user-friendly for all organizations.
              </p>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Settings className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-slate-700 text-lg">
                Smart tools to streamline HR and employee management.
              </p>
            </div>

            <Button
              asChild
              className="mt-8 w-full lg:w-auto bg-blue-500 text-white hover:bg-blue-600 font-semibold rounded-xl h-12 px-8 shadow-md"
            >
              <Link to="/contact-support">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;