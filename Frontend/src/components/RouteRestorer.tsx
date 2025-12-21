import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * RouteRestorer Component
 * 
 * This component handles route persistence across page refreshes.
 * When a user refreshes the page while on a subpage, this component
 * ensures they stay on that subpage instead of being redirected to the dashboard.
 */
const RouteRestorer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only run after authentication is complete
    if (isLoading) return;

    // Get the current path
    const currentPath = location.pathname;
    const lastAuthenticatedPath = localStorage.getItem('lastAuthenticatedPath');

    // If user is authenticated and on a protected route, they should stay there
    if (user && currentPath !== '/login' && currentPath !== '/contact-support') {
      // User is authenticated and on a valid protected route - keep them there
      return;
    }

    // If user is authenticated but on login page, redirect to last authenticated path
    if (user && currentPath === '/login') {
      if (lastAuthenticatedPath && lastAuthenticatedPath !== '/login') {
        navigate(lastAuthenticatedPath, { replace: true });
      } else {
        // Fallback to dashboard if no last path is stored
        navigate(`/${user.role}`, { replace: true });
      }
    }

    // If user is not authenticated and trying to access protected route, let ProtectedRoute handle it
    if (!user && currentPath !== '/login' && currentPath !== '/contact-support' && currentPath !== '/') {
      // This will be handled by ProtectedRoute component
      return;
    }
  }, [isLoading, user, location.pathname, navigate]);

  return <>{children}</>;
};

export default RouteRestorer;
