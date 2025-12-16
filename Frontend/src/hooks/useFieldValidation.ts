import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';

interface ValidationResult {
  available: boolean;
  message: string;
}

interface UseFieldValidationOptions {
  endpoint: string;
  debounceMs?: number;
  excludeUserId?: number;
  enabled?: boolean;
}

export const useFieldValidation = (options: UseFieldValidationOptions) => {
  const { endpoint, debounceMs = 500, excludeUserId, enabled = true } = options;
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string>('');

  const validateField = useCallback(
    debounce(async (value: string) => {
      if (!enabled || !value || !value.trim()) {
        setValidationResult(null);
        setError('');
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      setError('');

      try {
        const encodedValue = encodeURIComponent(value.trim());
        const url = excludeUserId 
          ? `https://staffly.space/${endpoint}/${encodedValue}?exclude_user_id=${excludeUserId}`
          : `https://staffly.space/${endpoint}/${encodedValue}`;

        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: ValidationResult = await response.json();
        setValidationResult(result);
      } catch (err) {
        console.error('Validation error:', err);
        setError('Unable to validate field. Please try again.');
        setValidationResult(null);
      } finally {
        setIsValidating(false);
      }
    }, debounceMs),
    [endpoint, debounceMs, excludeUserId, enabled]
  );

  const clearValidation = useCallback(() => {
    setValidationResult(null);
    setError('');
    setIsValidating(false);
  }, []);

  return {
    validateField,
    clearValidation,
    isValidating,
    validationResult,
    error,
    isAvailable: validationResult?.available ?? true,
    validationMessage: validationResult?.message || error
  };
};