import React from 'react';
import { EventQRCode } from './EventQRCode';
import { X } from 'lucide-react';

interface ShareModalProps {
  eventName: string;
  eventCode: string;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  eventName,
  eventCode,
  onClose
}) => {
  return (
    <div
      id="share-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div className="relative w-full max-w-sm">
        <button
          id="btn-close-share-modal-x"
          type="button"
          onClick={onClose}
          aria-label="Close share"
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/20 text-neutral-600 dark:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <EventQRCode
          eventUrl={`/e/${eventCode}`}
          eventName={eventName}
          eventCode={eventCode}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
