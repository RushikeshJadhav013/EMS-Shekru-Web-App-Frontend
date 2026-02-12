/**
 * JWT Utility Functions
 * Handles JWT token decoding, validation, and expiration checking
 */

export interface JWTPayload {
  user_id?: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Decodes a JWT token without verification
 * Note: This only decodes the token. For production, tokens should be verified
 * with the backend using the secret key. This is a client-side check only.
 */
export const decodeJWT = (token: string): JWTPayload | null => {
  try {
    // JWT tokens have three parts: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT token format');
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    
    // Base64 URL decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return null;
  }
};

/**
 * Checks if a JWT token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true; // If no expiration, consider it expired for security
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = payload.exp * 1000;
  const currentTime = Date.now();

  // Add a 5-minute buffer to account for clock skew
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

  return currentTime >= (expirationTime - bufferTime);
};

/**
 * Checks if a JWT token is valid (not expired and properly formatted)
 */
export const isTokenValid = (token: string | null): boolean => {
  if (!token || token.trim() === '') {
    return false;
  }

  try {
    // Check if token is expired
    if (isTokenExpired(token)) {
      console.warn('JWT token is expired');
      return false;
    }

    // Check if token can be decoded
    const payload = decodeJWT(token);
    if (!payload) {
      console.warn('JWT token cannot be decoded');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating JWT token:', error);
    return false;
  }
};

/**
 * Gets the expiration time of a JWT token in milliseconds
 */
export const getTokenExpirationTime = (token: string): number | null => {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return null;
  }

  return payload.exp * 1000; // Convert to milliseconds
};

/**
 * Gets the remaining time until token expiration in milliseconds
 */
export const getTokenRemainingTime = (token: string): number | null => {
  const expirationTime = getTokenExpirationTime(token);
  if (!expirationTime) {
    return null;
  }

  const remaining = expirationTime - Date.now();
  return remaining > 0 ? remaining : 0;
};

/**
 * Extracts user information from JWT token payload
 */
export const getUserFromToken = (token: string): { userId?: string; email?: string; role?: string } | null => {
  const payload = decodeJWT(token);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.user_id || payload.sub || payload.userId,
    email: payload.email,
    role: payload.role,
  };
};
