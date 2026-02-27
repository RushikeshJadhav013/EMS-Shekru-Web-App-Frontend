
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://testing.staffly.space';

const axiosInstance: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for auth token — just attach token, never redirect
axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
            const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
            config.headers.Authorization = bearer;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor — log errors but NEVER redirect to login.
// Route guards in AuthContext are responsible for protecting pages.
axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response) {
            const status = error.response.status;
            if (status === 401) {
                console.warn('Axios: API returned 401 Unauthorized');
            } else if (status === 403) {
                console.warn('Axios: API returned 403 Forbidden');
            }
        } else if (error.request) {
            console.error('Axios: Network error', error.request);
        } else {
            console.error('Axios: Error', error.message);
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
