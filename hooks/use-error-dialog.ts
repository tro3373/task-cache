import { useCallback, useState } from 'react';

interface ErrorDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string;
}

export function useErrorDialog() {
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showError = useCallback(
    (error: { title: string; message: string; details?: string }) => {
      setErrorDialog({
        isOpen: true,
        ...error,
      });
    },
    [],
  );

  const hideError = useCallback(() => {
    setErrorDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    errorDialog,
    showError,
    hideError,
  };
}
