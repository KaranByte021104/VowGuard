import React, { useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  mode?: 'confirm' | 'prompt' | 'custom';
  position?: 'center' | 'right';
  promptPlaceholder?: string;
  confirmText?: string;
  confirmColor?: 'red' | 'primary';
  onConfirm?: (value?: string) => void;
  children?: React.ReactNode;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  mode = 'confirm',
  position = 'center',
  promptPlaceholder, 
  confirmText = 'Confirm', 
  confirmColor = 'primary',
  onConfirm,
  children
}: ModalProps) {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm(mode === 'prompt' ? inputValue : undefined);
    setInputValue('');
    onClose();
  };

  const handleClose = () => {
    setInputValue('');
    onClose();
  };

  const colorClasses = confirmColor === 'red' 
    ? 'bg-red-600 hover:bg-red-700' 
    : 'bg-primary hover:bg-blue-700';

  const containerClasses = position === 'right'
    ? 'fixed inset-y-0 right-0 z-[100] flex w-full max-w-md flex-col bg-white dark:bg-gray-800 shadow-2xl animate-in slide-in-from-right'
    : 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-sm animate-in zoom-in-95';

  const wrapperClasses = position === 'right'
    ? 'fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm transition-opacity'
    : 'fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity';

  return (
    <div className={wrapperClasses} onClick={handleClose}>
      <div className={containerClasses} onClick={e => e.stopPropagation()}>
        <div className={position === 'right' ? 'p-6 flex-grow overflow-y-auto' : ''}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        {message && <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{message}</p>}
        
        {mode === 'prompt' && (
          <input
            type="text"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 mb-4 bg-gray-50 dark:bg-gray-700 dark:text-white"
            placeholder={promptPlaceholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') handleClose();
            }}
            autoFocus
          />
        )}

        {children}

        {mode !== 'custom' && !children && (
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={handleClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
            <button onClick={handleConfirm} className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${colorClasses}`}>
              {confirmText}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
