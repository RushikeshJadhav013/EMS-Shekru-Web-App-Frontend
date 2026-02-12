import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { isTokenValid } from '@/utils/jwt';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();

  // Store the current path in localStorage for persistence across page refreshes
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && location.pathname !== '/login') {
      localStorage.setItem('lastAuthenticatedPath', location.pathname);
    }
  }, [isLoading, isAuthenticated, user, location.pathname]);

  // Verify token validity on route access
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const token = localStorage.getItem('token');

      // Check if token exists and is valid
      if (!token || !isTokenValid(token)) {
        console.warn('Token is missing or invalid, logging out');
        // Clear invalid session
        logout(false); // Don't show toast for automatic logout
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, location.pathname, logout]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse-slow">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  console.log('ProtectedRoute Check:', {
    isAuthenticated,
    user,
    allowedRoles,
    currentPath: location.pathname
  });

  // Verify token before allowing access
  const token = localStorage.getItem('token');
  if (!token || !isTokenValid(token)) {
    console.log('Token is missing or invalid, redirecting to login');
    return <Navigate to="/login" state={{ from: location, message: 'Your session has expired. Please login again.' }} replace />;
  }

  if (!isAuthenticated || !user) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based access control
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.log('Invalid role, redirecting to user homepage');
    // Redirect to user's appropriate dashboard based on their role
    const roleRoutes: Record<UserRole, string> = {
      admin: '/admin',
      hr: '/hr',
      manager: '/manager',
      team_lead: '/team_lead',
      employee: '/employee',
    };
    const redirectPath = roleRoutes[user.role] || '/login';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;