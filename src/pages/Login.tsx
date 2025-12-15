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
import { Mail, Shield, Users, Clock, ClipboardList, Globe } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Language } from '@/i18n/translations';

// API endpoints
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
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
      detail?: string | Array<{type: string; loc: Array<string | number>; msg: string; input: any}>;
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
      navigate('/admin', { replace: true });
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-100/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="space-y-8 text-center lg:text-left">
            {/* Logo */}
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-lg opacity-60"></div>
                <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl">
                  <span className="text-2xl font-bold text-white">S</span>
                </div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Staffly
              </h1>
            </div>

            {/* Heading */}
            <div className="space-y-4">
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-800 leading-tight">
                Welcome to Your
                <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Workspace
                </span>
              </h2>
              <p className="text-lg text-slate-600 max-w-md mx-auto lg:mx-0">
                Streamline your workforce with intelligent attendance tracking, task management, and seamless collaboration.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto lg:mx-0">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Smart Attendance</h3>
                <p className="text-xs text-slate-600">Real-time tracking</p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center mb-3">
                  <ClipboardList className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Task Manager</h3>
                <p className="text-xs text-slate-600">Stay organized</p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Team Sync</h3>
                <p className="text-xs text-slate-600">Collaborate better</p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                  <Shield className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Secure Access</h3>
                <p className="text-xs text-slate-600">Role-based control</p>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="w-full max-w-md mx-auto">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
              {/* Language Selector */}
              <div className="flex justify-end p-6 pb-0">
                <Select value={language} onValueChange={(value: Language) => setLanguage(value)}>
                  <SelectTrigger className="w-[140px] border-slate-200 bg-white/50">
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

              <div className="p-8 pt-4">
                {/* Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">
                    {t.auth.loginTitle}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {otpSent ? 'Enter the OTP sent to your email' : 'Enter your email to receive a secure OTP'}
                  </p>
                </div>

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
                      <Label htmlFor="email" className="text-slate-700 font-medium">
                        {t.auth.email}
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setSessionMessage(null); // Clear message when user starts typing
                          }}
                          className="pl-12 h-12 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
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
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                          Sending OTP...
                        </>
                      ) : (
                        t.auth.sendOtp
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
                        id="otp"
                        type="text"
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        maxLength={6}
                        required
                        disabled={isLoading}
                        className="text-center tracking-[0.5em] text-2xl font-semibold h-14 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
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
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
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

                {/* Footer */}
                <p className="text-xs text-center text-slate-500 mt-6">
                  By logging in, you agree to our{' '}
                  <span className="text-blue-600 hover:underline cursor-pointer">Terms of Service</span>
                  {' '}and{' '}
                  <span className="text-blue-600 hover:underline cursor-pointer">Privacy Policy</span>
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <p className="text-center text-sm text-slate-600 mt-6">
              Need help? <Link to="/contact-support" className="text-blue-600 hover:underline cursor-pointer font-medium">Contact Support</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;