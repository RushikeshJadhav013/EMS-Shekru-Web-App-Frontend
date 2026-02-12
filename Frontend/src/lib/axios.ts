
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { isTokenValid } from '@/utils/jwt';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://staffly.space';

const axiosInstance: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for auth token
axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        
        // Validate token before adding to request
        if (token) {
            if (!isTokenValid(token)) {
                // Token is expired or invalid
                console.warn('Token is invalid or expired, clearing session');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userId');
                
                // Redirect to login if not already there
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                
                // Reject the request
                return Promise.reject(new Error('Token is invalid or expired'));
            }
            
            // Token is valid, add to request
            if (config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response) {
            const status = error.response.status;

            if (status === 401) {
                // Unauthorized - token is invalid or expired
                console.warn('Received 401 Unauthorized, clearing session');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userId');
                
                // Redirect to login if not already there
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            } else if (status === 403) {
                // Forbidden - access denied (user doesn't have permission)
                console.error('Access denied:', error.response.data);
                // Don't clear session for 403, just log the error
                // The user might have valid token but insufficient permissions
            }
        } else if (error.request) {
            // Network error
            console.error('Network error:', error.request);
        } else {
            console.error('Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
