import { API_BASE_URL } from '@/lib/api';

export interface TokenVerificationResponse {
  valid: boolean;
  user_id?: string;
  email?: string;
  role?: string;
  message?: string;
}

/**
 * Verifies JWT token with the backend server
 * This provides server-side validation which is more secure than client-side only
 */
export const verifyTokenWithBackend = async (token: string): Promise<TokenVerificationResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
      method: 'GET',
      headers: {
        'Authorization': token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '',
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        user_id: data.user_id,
        email: data.email,
        role: data.role,
        ...data,
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return {
        valid: false,
        message: errorData.message || 'Token verification failed',
      };
    }
  } catch (error) {
    console.error('Error verifying token with backend:', error);
    return {
      valid: false,
      message: 'Network error during token verification',
    };
  }
};

/**
 * Refreshes an expired JWT token (if refresh token is available)
 */
export const refreshToken = async (refreshToken: string): Promise<{ access_token?: string; refresh_token?: string } | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };
    }
    return null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
};
