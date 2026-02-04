import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, LoginCredentials, UserRole } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface LoginResponse {
  user_id: string;
  email: string;
  name: string;
  role: string; // Backend role format (e.g., "TeamLead", "Admin", etc.)
  department?: string;
  designation?: string;
  joining_date?: string;
  profile_photo?: string;
  access_token: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: LoginResponse) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  showDeadlineWarnings: boolean;
  setShowDeadlineWarnings: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user data for demo
const mockUsers: Record<string, User> = {
  'admin@company.com': {
    id: '1',
    email: 'admin@company.com',
    name: 'Admin User',
    role: 'admin',
    department: 'Management',
    designation: 'System Administrator',
    joiningDate: '2020-01-01',
    status: 'active',
    createdAt: '2020-01-01',
    updatedAt: '2024-01-01',
  },
  'hr@company.com': {
    id: '2',
    email: 'hr@company.com',
    name: 'HR Manager',
    role: 'hr',
    department: 'Human Resources',
    designation: 'HR Manager',
    joiningDate: '2020-02-01',
    status: 'active',
    createdAt: '2020-02-01',
    updatedAt: '2024-01-01',
  },
  'manager@company.com': {
    id: '3',
    email: 'manager@company.com',
    name: 'Project Manager',
    role: 'manager',
    department: 'Engineering',
    designation: 'Engineering Manager',
    joiningDate: '2020-03-01',
    status: 'active',
    createdAt: '2020-03-01',
    updatedAt: '2024-01-01',
  },
  'teamlead@company.com': {
    id: '4',
    email: 'teamlead@company.com',
    name: 'Team Lead',
    role: 'team_lead',
    department: 'Engineering',
    designation: 'Senior Developer',
    joiningDate: '2020-04-01',
    managerId: '3',
    status: 'active',
    createdAt: '2020-04-01',
    updatedAt: '2024-01-01',
  },
  'employee@company.com': {
    id: '5',
    email: 'employee@company.com',
    name: 'John Employee',
    role: 'employee',
    department: 'Engineering',
    designation: 'Software Developer',
    joiningDate: '2021-01-01',
    managerId: '3',
    teamLeadId: '4',
    status: 'active',
    createdAt: '2021-01-01',
    updatedAt: '2024-01-01',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [showDeadlineWarnings, setShowDeadlineWarnings] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  // Map backend role values to frontend role values
  const mapRoleToFrontend = (backendRole: string): UserRole => {
    const roleMap: Record<string, UserRole> = {
      'admin': 'admin',
      'Admin': 'admin',
      'ADMIN': 'admin',
      'hr': 'hr',
      'HR': 'hr',
      'manager': 'manager',
      'Manager': 'manager',
      'MANAGER': 'manager',
      'teamlead': 'team_lead',
      'TeamLead': 'team_lead',
      'TEAM_LEAD': 'team_lead',
      'team_lead': 'team_lead',
      'employee': 'employee',
      'Employee': 'employee',
      'EMPLOYEE': 'employee',
    };

    const normalizedRole = backendRole?.trim();
    const mappedRole = roleMap[normalizedRole] || 'employee';
    console.log('Role mapping:', { backendRole, normalizedRole, mappedRole });
    return mappedRole;
  };

  const login = async (userData: LoginResponse) => {
    setIsLoading(true);
    try {
      console.log('AuthContext Login Data:', userData); // Debug log

      // Map backend role to frontend role format
      const frontendRole = mapRoleToFrontend(userData.role);

      // Create a user object from the API response
      const user: User = {
        id: userData.user_id,
        email: userData.email,
        name: userData.name,
        role: frontendRole,
        department: userData.department || '',
        designation: userData.designation || '',
        joiningDate: userData.joining_date || new Date().toISOString(),
        profilePhoto: userData.profile_photo ? `https://staffly.space/${userData.profile_photo}` : undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Processed User Data:', user); // Debug log

      // Store the user data and token
      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', userData.access_token);
      localStorage.setItem('userId', user.id.toString()); // Store userId for language persistence

      toast({
        variant: 'success',
        title: 'Login Successful',
        description: `Welcome back, ${user.name}!`,
      });

      // Redirect to the appropriate dashboard based on role
      const roleRoutes: Record<UserRole, string> = {
        admin: '/admin',
        hr: '/hr',
        manager: '/manager',
        team_lead: '/team_lead',
        employee: '/employee',
      };

      const redirectPath = roleRoutes[user.role];
      console.log('Redirecting to:', redirectPath); // Debug log

      if (!redirectPath) {
        console.error('Invalid role:', user.role);
        toast({
          title: 'Navigation Error',
          description: 'Invalid user role. Please contact support.',
          variant: 'destructive',
        });
        return;
      }

      // Call login resume endpoint to handle pause/resume functionality
      try {
        await fetch('https://staffly.space/attendance/login-resume', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userData.access_token}`,
          },
          body: JSON.stringify({
            user_id: parseInt(user.id),
            login_timestamp: new Date().toISOString(),
          }),
        });
      } catch (error) {
        // Don't block login if the resume API call fails
        console.warn('Failed to record login resume:', error);
      }

      // Show deadline warnings after successful login
      setTimeout(() => {
        setShowDeadlineWarnings(true);
      }, 1000); // Small delay to let the navigation complete

      navigate(redirectPath);
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Login Failed',
        description: 'There was an error processing your login. Please try again.',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
    setOtpSent(false);
  };

  const logout = async () => {
    // Before logging out, record logout timestamp for pause/resume functionality
    try {
      const token = localStorage.getItem('token');
      if (token && user?.id) {
        // Call the logout endpoint to record pause timestamp
        await fetch('https://staffly.space/attendance/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: parseInt(user.id),
            logout_timestamp: new Date().toISOString(),
          }),
        });
      }
    } catch (error) {
      // Don't block logout if the API call fails
      console.warn('Failed to record logout timestamp:', error);
    }

    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('userId'); // Clear userId for language persistence

    // Clear all session-related data
    sessionStorage.clear();

    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out.',
    });

    // Use replace to prevent going back to authenticated pages
    navigate('/login', { replace: true });
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
    showDeadlineWarnings,
    setShowDeadlineWarnings,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};