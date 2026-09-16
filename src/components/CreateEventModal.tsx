import React, { useState } from 'react';
import type { MomentoEvent } from '../types';
import { EventQRCode } from './EventQRCode';
import { DateTimePicker } from './DateTimePicker';
import { Sparkles, X, ArrowRight, MapPin, AlignLeft } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CreateEventModalProps {
  onClose: () => void;
  onEventCreated: (event: MomentoEvent, hostKey: string) => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  onClose,
  onEventCreated
}) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Result state after creation
  const [createdResult, setCreatedResult] = useState<{
    event: MomentoEvent;
    hostKey: string;
    publicUrl: string;
    hostUrl: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Event name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          date: date.trim() || undefined,
          location: location.trim() || undefined,
          description: description.trim() || undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create event');
      }

      const data = await res.json();
      setCreatedResult(data);

      // Save to localStorage for quick re-access
      const savedHostEvents = JSON.parse(localStorage.getItem('momento_host_events') || '[]');
      savedHostEvents.unshift({
        id: data.event.id,
        code: data.event.code,
        name: data.event.name,
        hostKey: data.hostKey,
        createdAt: data.event.createdAt
      });
      localStorage.setItem('momento_host_events', JSON.stringify(savedHostEvents.slice(0, 20)));

      // Trigger celebratory confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="create-event-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto pt-safe pb-safe"
    >
      <div className="bg-[#FDFCF9] dark:bg-[#07060B] w-full max-w-md rounded-[28px] sm:rounded-[32px] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[calc(100dvh-2.5rem)] animate-scale-up">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-[#0C0B12] border-b border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E67E22]" />
            <h2 className="text-base font-bold text-[#1A1A1A] dark:text-white font-display">
              {createdResult ? 'Your event is ready 🎉' : 'Create an Event'}
            </h2>
          </div>
          <button
            id="btn-close-create-modal"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center cursor-pointer active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {createdResult ? (
            <div className="space-y-4">
              <EventQRCode
                eventUrl={createdResult.publicUrl}
                eventName={createdResult.event.name}
                eventCode={createdResult.event.code}
              />

              <div className="pt-2">
                <button
                  id="btn-open-new-gallery"
                  type="button"
                  onClick={() => onEventCreated(createdResult.event, createdResult.hostKey)}
                  className="w-full py-4 px-4 rounded-2xl bg-[#1A1A1A] dark:bg-white dark:text-black text-white font-semibold text-sm hover:bg-black dark:hover:bg-gray-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 min-h-[48px] shadow-md cursor-pointer"
                >
                  <span>Open Gallery</span>
                  <ArrowRight className="w-4 h-4 text-[#E67E22]" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Event Name *
                </label>
                <input
                  id="input-create-event-name"
                  type="text"
                  required
                  placeholder="e.g. Summer Solstice Soirée, Rooftop Party"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/15 bg-white dark:bg-[#0D0C14] text-[#1A1A1A] dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 transition-all"
                  autoFocus
                />
              </div>

              <DateTimePicker
                value={date}
                onChange={(val) => setDate(val)}
                label="Date / Time (optional)"
                placeholder="Select date, time & hour dropdown"
              />

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Location <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    id="input-create-event-location"
                    type="text"
                    placeholder="e.g. Skyline Lounge or Backyard"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-white/15 bg-white dark:bg-[#0D0C14] text-[#1A1A1A] dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Note / Welcome Msg <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <AlignLeft className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <textarea
                    id="input-create-event-description"
                    rows={2}
                    placeholder="e.g. Drop your favorite photos from tonight!"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/15 bg-white dark:bg-[#0D0C14] text-[#1A1A1A] dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="btn-submit-create-event"
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-4 rounded-2xl bg-[#1A1A1A] dark:bg-white dark:text-black hover:bg-black dark:hover:bg-gray-100 text-white font-semibold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 min-h-[48px] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#E67E22]" />
                  <span>{loading ? 'Creating Event...' : 'Create Event & Get QR'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
