import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';

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

  useEffect(() => {
    if (isOpen) setInputValue('');
  }, [isOpen]);

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

  const contentClasses = position === 'right'
    ? '!fixed !right-0 !left-auto !top-0 !translate-x-0 !translate-y-0 !h-full w-full !max-w-md !rounded-none !border-l border-border bg-background p-6 shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full'
    : 'sm:max-w-md flex flex-col';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={contentClasses}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {message && <DialogDescription className="mt-1">{message}</DialogDescription>}
        </DialogHeader>

        <div className={position === 'right' ? 'flex-grow overflow-y-auto py-4' : 'py-4'}>
          {mode === 'prompt' && (
            <Input
              type="text"
              placeholder={promptPlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
              autoFocus
            />
          )}
          {children}
        </div>

        {mode !== 'custom' && !children && (
          <DialogFooter className="mt-auto pt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              variant={confirmColor === 'red' ? 'destructive' : 'default'}
              onClick={handleConfirm}
            >
              {confirmText}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
