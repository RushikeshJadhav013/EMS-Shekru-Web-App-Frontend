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

    // Base64 URL decode with padding handling
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

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
  if (!payload) {
    return true;
  }

  // If no expiration claim, consider it not expired (more lenient for different backend configurations)
  if (!payload.exp) {
    return false;
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = payload.exp * 1000;
  const currentTime = Date.now();

  // Use a small 30-second buffer only to account for clock skew between client and server.
  // A large buffer (e.g. 5 minutes) was causing valid tokens to be rejected on page refresh.
  const bufferTime = 30 * 1000; // 30 seconds in milliseconds

  const isExpired = currentTime >= (expirationTime - bufferTime);

  if (isExpired) {
    console.warn('JWT Token is expired or near expiration:', {
      currentTime: new Date(currentTime).toISOString(),
      expirationTime: new Date(expirationTime).toISOString(),
      remainingMs: expirationTime - currentTime
    });
  }

  return isExpired;
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
    // Check all common JWT user ID field names used by different backends
    userId: (payload.user_id ?? payload.sub ?? payload.userId ?? payload.id) as string | undefined,
    email: payload.email as string | undefined,
    role: payload.role as string | undefined,
  };
};
