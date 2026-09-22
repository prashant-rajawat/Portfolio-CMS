import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  isDestructive = true,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-start space-x-3 text-slate-300">
          {isDestructive && (
            <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/80 flex items-center justify-center flex-shrink-0 text-rose-400 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}
          <p className="text-xs leading-relaxed text-slate-300">{message}</p>
        </div>

        <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 disabled:opacity-50 rounded-lg transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-medium rounded-lg text-white transition shadow-sm cursor-pointer disabled:opacity-50 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 active:scale-[0.98]'
                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98]'
            }`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isLoading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
