import React, { useState } from 'react';
import { X, ArrowRight, QrCode, Hash } from 'lucide-react';

interface JoinModalProps {
  onClose: () => void;
  onJoinCode: (code: string) => void;
}

export const JoinModal: React.FC<JoinModalProps> = ({
  onClose,
  onJoinCode
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toLowerCase().replace(/^.*\//, ''); // Clean if someone pasted full URL
    if (!clean) {
      setError('Please enter a valid event code or link');
      return;
    }
    onJoinCode(clean);
  };

  return (
    <div
      id="join-event-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto pt-safe pb-safe"
    >
      <div className="bg-[#FDFCF9] dark:bg-[#07060B] w-full max-w-sm rounded-[28px] sm:rounded-[32px] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[calc(100dvh-2.5rem)] animate-scale-up">
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-[#0C0B12] border-b border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <h2 className="text-base font-bold text-[#1A1A1A] dark:text-white font-display">
            Join an Event
          </h2>
          <button
            id="btn-close-join-modal"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center cursor-pointer active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Enter the event code or paste the shared link to open the photo gallery.
          </p>

          {error && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="relative">
            <Hash className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
            <input
              id="input-join-event-code"
              type="text"
              required
              placeholder="e.g. rooftop-sunset or gala-2026"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-white/15 bg-white dark:bg-[#0D0C14] text-[#1A1A1A] dark:text-white placeholder:text-gray-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 transition-all"
              autoFocus
            />
          </div>

          <button
            id="btn-submit-join-event"
            type="submit"
            className="w-full py-4 px-4 rounded-2xl bg-[#1A1A1A] dark:bg-white dark:text-black hover:bg-black dark:hover:bg-gray-100 text-white font-semibold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md min-h-[48px] cursor-pointer"
          >
            <span>Open Gallery</span>
            <ArrowRight className="w-4 h-4 text-[#E67E22]" />
          </button>
        </form>
      </div>
    </div>
  );
};
