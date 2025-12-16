import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Custom hook to handle browser back/forward navigation and prevent
 * unauthorized access after logout
 */
export const useNavigationGuard = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHandlingNavigation = useRef(false);
  const hasShownLogoutConfirm = useRef(false);

  const handleBackNavigation = useCallback(() => {
    // Prevent multiple simultaneous confirmations
    if (isHandlingNavigation.current || hasShownLogoutConfirm.current) {
      return;
    }

    // Only show confirmation if user is authenticated and trying to go back
    if (isAuthenticated && location.pathname !== '/login') {
      isHandlingNavigation.current = true;
      hasShownLogoutConfirm.current = true;

      const confirmLogout = window.confirm(
        'Do you want to logout? Clicking "OK" will log you out of the system.'
      );

      if (confirmLogout) {
        // User confirmed logout
        logout();
        // Clear the flag after logout
        setTimeout(() => {
          hasShownLogoutConfirm.current = false;
          isHandlingNavigation.current = false;
        }, 100);
      } else {
        // User cancelled - push current state again to prevent back navigation
        window.history.pushState(null, '', window.location.href);
        hasShownLogoutConfirm.current = false;
        isHandlingNavigation.current = false;
      }
    }
  }, [isAuthenticated, location.pathname, logout]);

  useEffect(() => {
    // Prevent back navigation when authenticated
    if (isAuthenticated && location.pathname !== '/login') {
      // Push current state to prevent back button
      window.history.pushState(null, '', window.location.href);

      // Listen for popstate (back/forward button)
      const handlePopState = (event: PopStateEvent) => {
        event.preventDefault();
        handleBackNavigation();
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isAuthenticated, location.pathname, handleBackNavigation]);

  useEffect(() => {
    // After logout, prevent forward navigation back into the app
    if (!isAuthenticated && location.pathname !== '/login' && location.pathname !== '/contact-support') {
      // Clear any stored session data
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      
      // Redirect to login with a message
      navigate('/login', { 
        replace: true,
        state: { message: 'Please login to access the application.' }
      });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  // Clear the confirmation flag when location changes
  useEffect(() => {
    hasShownLogoutConfirm.current = false;
    isHandlingNavigation.current = false;
  }, [location.pathname]);
};
