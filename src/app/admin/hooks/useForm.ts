import { useState, useCallback, useTransition } from 'react';

export interface UseFormOptions<T> {
  initialValues: T;
  onSubmit?: (values: T) => Promise<void> | void;
}

export function useForm<T extends Record<string, any>>(
  options: UseFormOptions<T>
) {
  const [values, setValues] = useState<T>(options.initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
      
      // Update values synchronously for immediate UI feedback
      setValues((prev) => ({
        ...prev,
        [name]: newValue,
      }));
      
      // Defer error clearing to avoid re-render cascade
      startTransition(() => {
        if (errors[name as keyof T]) {
          setErrors((prev) => ({
            ...prev,
            [name]: undefined,
          }));
        }
      });
    },
    [errors]
  );

  const handleChangeValue = useCallback((name: keyof T, value: any) => {
    // Update synchronously for immediate feedback
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Defer error clearing
    startTransition(() => {
      if (errors[name]) {
        setErrors((prev) => ({
          ...prev,
          [name]: undefined,
        }));
      }
    });
  }, [errors]);

  const setFieldValue = useCallback((name: keyof T, value: any) => {
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const setFieldError = useCallback((name: keyof T, error: string) => {
    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  }, []);

  const reset = useCallback(() => {
    setValues(options.initialValues);
    setErrors({});
  }, [options.initialValues]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setIsSubmitting(true);
      try {
        await options.onSubmit?.(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, options]
  );

  return {
    values,
    errors,
    isSubmitting,
    isPending,
    handleChange,
    handleChangeValue,
    setFieldValue,
    setFieldError,
    setErrors,
    reset,
    handleSubmit,
  };
}
