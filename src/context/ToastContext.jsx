import React, { createContext, useContext, useState, useCallback } from 'react';

export const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    // message: { type: 'success' | 'warning' | 'error' | 'info', text: string, ttl?: number }
    setToast(message);

    const ttl = message?.ttl || 3000;
    if (ttl) {
      setTimeout(() => {
        setToast((current) => (current === message ? null : current));
      }, ttl);
    }
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, showToast, hideToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
