import React, { useState } from 'react';
import type { MomentoEvent, MomentoPhoto } from '../types';
import { formatFileSize, getShareableUrl } from '../lib/utils';
import { DateTimePicker } from './DateTimePicker';
import { 
  X, 
  Download, 
  Archive, 
  Unlock, 
  Lock, 
  Edit3, 
  Trash2, 
  Users, 
  Image as ImageIcon, 
  HardDrive, 
  Check, 
  Share2,
  AlertCircle
} from 'lucide-react';

interface HostDashboardProps {
  event: MomentoEvent;
  photos: MomentoPhoto[];
  stats: {
    photoCount: number;
    contributorCount: number;
    totalSizeBytes: number;
  };
  onClose: () => void;
  onUpdateEvent: (updates: Partial<MomentoEvent>) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onClearAllPhotos?: () => Promise<void>;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  event,
  photos,
  stats,
  onClose,
  onUpdateEvent,
  onDeletePhoto,
  onClearAllPhotos
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'manage'>('overview');
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date || '');
  const [location, setLocation] = useState(event.location || '');
  const [description, setDescription] = useState(event.description || '');
  const [allowUploads, setAllowUploads] = useState(event.allowUploads);
  const [isArchived, setIsArchived] = useState(event.isArchived);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [clearingPhotos, setClearingPhotos] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearSuccessToast, setClearSuccessToast] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const handleExecuteClearAll = async () => {
    if (!onClearAllPhotos) return;
    try {
      setClearingPhotos(true);
      setDashboardError(null);
      await onClearAllPhotos();
      setShowClearConfirmModal(false);
      setClearSuccessToast(true);
      setTimeout(() => setClearSuccessToast(false), 3000);
    } catch (err: any) {
      setDashboardError(err.message || 'Failed to clear gallery photos');
    } finally {
      setClearingPhotos(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setDashboardError(null);
    try {
      await onUpdateEvent({
        name,
        date: date || undefined,
        location: location || undefined,
        description: description || undefined,
        allowUploads,
        isArchived
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      setDashboardError(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadZip = () => {
    if (photos.length === 0) {
      setDashboardError('No photos available to download yet.');
      setTimeout(() => setDashboardError(null), 3000);
      return;
    }
    setDownloadingZip(true);
    const zipUrl = `/api/events/${event.id}/download-zip?key=${encodeURIComponent(event.hostKey)}`;
    
    const anchor = document.createElement('a');
    anchor.href = zipUrl;
    anchor.download = `${event.name}_moments.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => setDownloadingZip(false), 3000);
  };

  return (
    <div
      id="host-dashboard-drawer"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in"
    >
      <div className="w-full max-w-lg bg-[#FDFCF9] dark:bg-[#07060B] text-[#1A1A1A] dark:text-[#F3F1EC] h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="px-5 py-4 bg-white dark:bg-[#0C0B12] border-b border-gray-100 dark:border-white/10 flex items-center justify-between pt-safe">
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1A1A1A] dark:bg-white/20 text-white text-[10px] font-semibold uppercase tracking-wider mb-1">
              Host Controls
            </div>
            <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white font-display truncate max-w-xs">
              {event.name}
            </h2>
          </div>

          <button
            id="btn-close-host-dashboard"
            type="button"
            onClick={onClose}
            aria-label="Close Host Dashboard"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Navigation */}
        <nav className="flex border-b border-gray-100 dark:border-white/10 bg-white dark:bg-[#0C0B12] px-5 gap-6 text-sm font-semibold">
          <button
            id="tab-host-overview"
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 relative transition-colors ${
              activeTab === 'overview' ? 'text-[#1A1A1A] dark:text-white' : 'text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Overview
            {activeTab === 'overview' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E67E22] rounded-full" />
            )}
          </button>

          <button
            id="tab-host-settings"
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-3 relative transition-colors ${
              activeTab === 'settings' ? 'text-[#1A1A1A] dark:text-white' : 'text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Event Settings
            {activeTab === 'settings' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E67E22] rounded-full" />
            )}
          </button>

          <button
            id="tab-host-manage"
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`py-3 relative transition-colors ${
              activeTab === 'manage' ? 'text-[#1A1A1A] dark:text-white' : 'text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Moderate ({photos.length})
            {activeTab === 'manage' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E67E22] rounded-full" />
            )}
          </button>
        </nav>

        {/* Error notification banner if any */}
        {dashboardError && (
          <div className="mx-5 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl text-red-600 dark:text-red-300 text-xs flex items-center justify-between animate-fade-in">
            <span>{dashboardError}</span>
            <button
              type="button"
              onClick={() => setDashboardError(null)}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-200 text-sm font-bold ml-2 p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Metric stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-[#0F0E17] p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 text-center shadow-2xs">
                  <ImageIcon className="w-4 h-4 text-[#E67E22] mx-auto mb-1" />
                  <div className="text-xl font-bold text-[#1A1A1A] dark:text-white">{stats.photoCount}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-400 font-medium">Moments</div>
                </div>

                <div className="bg-white dark:bg-[#0F0E17] p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 text-center shadow-2xs">
                  <Users className="w-4 h-4 text-[#E67E22] mx-auto mb-1" />
                  <div className="text-xl font-bold text-[#1A1A1A] dark:text-white">{stats.contributorCount}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-400 font-medium">Guests</div>
                </div>

                <div className="bg-white dark:bg-[#0F0E17] p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 text-center shadow-2xs">
                  <HardDrive className="w-4 h-4 text-[#E67E22] mx-auto mb-1" />
                  <div className="text-xl font-bold text-[#1A1A1A] dark:text-white">{formatFileSize(stats.totalSizeBytes)}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-400 font-medium">Original Data</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white dark:bg-[#0F0E17] p-4 rounded-2xl border border-gray-200 dark:border-white/10 space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
                  Host Actions
                </h4>

                <button
                  id="btn-download-all-zip"
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={downloadingZip || photos.length === 0}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1A1A1A] dark:bg-white dark:text-black text-white font-medium text-sm hover:bg-black dark:hover:bg-gray-100 active:scale-[0.99] transition-all disabled:opacity-50 min-h-[46px] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Download className="w-4 h-4 text-[#E67E22]" />
                    <span>Download All Originals (.ZIP)</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-600 font-mono">
                    {downloadingZip ? 'Packing…' : `${photos.length} files`}
                  </span>
                </button>

                <div className="p-3 bg-gray-50 dark:bg-[#141220] rounded-xl border border-gray-100 dark:border-white/5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  <span className="font-semibold text-[#1A1A1A] dark:text-white">Original Master Guarantee:</span> All files in the ZIP retain their full camera resolution and untouched metadata.
                </div>
              </div>

              {/* Danger Zone: Clear All Gallery Photos */}
              <div className="bg-red-50/70 dark:bg-red-950/25 border border-red-200/80 dark:border-red-900/40 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs">
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span>Purge Gallery Images</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
                    Irreversible
                  </span>
                </div>

                <p className="text-xs text-red-800/80 dark:text-red-300/80 leading-relaxed">
                  Permanently delete all images from this event gallery. All original files, thumbnails, and database records will be erased from storage.
                </p>

                <button
                  id="btn-host-clear-all-photos"
                  type="button"
                  onClick={() => setShowClearConfirmModal(true)}
                  disabled={photos.length === 0 || clearingPhotos}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-semibold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer min-h-[42px]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {photos.length === 0
                      ? 'Gallery is already empty'
                      : `Clear All ${photos.length} Photo${photos.length > 1 ? 's' : ''}`}
                  </span>
                </button>
              </div>

              {/* Host Secret Key info */}
              <div className="bg-[#E67E22]/10 border border-[#E67E22]/20 p-4 rounded-2xl">
                <div className="flex items-center gap-2 text-[#E67E22] font-bold text-xs mb-1">
                  <AlertCircle className="w-4 h-4 text-[#E67E22]" />
                  Host Access Key
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
                  Bookmark your host URL or keep this key to manage this event on any device.
                </p>
                <div className="bg-white/90 dark:bg-[#12101C] p-2 rounded-xl font-mono text-[11px] text-gray-700 dark:text-gray-300 select-all break-all border border-gray-200 dark:border-white/10">
                  {getShareableUrl(`/e/${event.code}?key=${event.hostKey}`)}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Event Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl border border-gray-200 dark:border-white/15 bg-white dark:bg-[#0F0E17] text-[#1A1A1A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30"
                />
              </div>

              <DateTimePicker
                value={date}
                onChange={(val) => setDate(val)}
                label="Date / Time"
                placeholder="Select date & time"
              />

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  placeholder="e.g. Brooklyn, NY"
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl border border-gray-200 dark:border-white/15 bg-white dark:bg-[#0F0E17] text-[#1A1A1A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Description / Welcome Note
                </label>
                <textarea
                  rows={3}
                  value={description}
                  placeholder="Welcome message or instructions for your guests..."
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl border border-gray-200 dark:border-white/15 bg-white dark:bg-[#0F0E17] text-[#1A1A1A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 resize-none"
                />
              </div>

              {/* Upload Controls */}
              <div className="pt-2 border-t border-gray-200 dark:border-white/10 space-y-3">
                <label className="flex items-center justify-between p-3.5 bg-white dark:bg-[#0F0E17] rounded-2xl border border-gray-200 dark:border-white/10 cursor-pointer">
                  <div>
                    <div className="text-sm font-semibold text-[#1A1A1A] dark:text-white">Allow Guest Uploads</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">When disabled, guests can only view and download.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowUploads}
                    onChange={(e) => setAllowUploads(e.target.checked)}
                    className="w-5 h-5 accent-[#E67E22] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-white dark:bg-[#0F0E17] rounded-2xl border border-gray-200 dark:border-white/10 cursor-pointer">
                  <div>
                    <div className="text-sm font-semibold text-[#1A1A1A] dark:text-white">Archive Event</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Freezes the event gallery into permanent read-only mode.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isArchived}
                    onChange={(e) => setIsArchived(e.target.checked)}
                    className="w-5 h-5 accent-[#E67E22] rounded cursor-pointer"
                  />
                </label>
              </div>

              <button
                id="btn-save-host-settings"
                type="submit"
                disabled={saving}
                className="w-full py-4 px-4 rounded-2xl bg-[#1A1A1A] dark:bg-white dark:text-black text-white font-semibold text-sm hover:bg-black dark:hover:bg-gray-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm min-h-[48px] cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span>Settings Saved!</span>
                  </>
                ) : (
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                )}
              </button>
            </form>
          )}

          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Moderate or delete photos from the live gallery.
                </p>
                {photos.length > 0 && onClearAllPhotos && (
                  <button
                    id="btn-moderate-clear-all"
                    type="button"
                    onClick={() => setShowClearConfirmModal(true)}
                    className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All ({photos.length})</span>
                  </button>
                )}
              </div>

              {photos.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-xs">
                  No photos to moderate.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative group rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#0F0E17] border border-gray-200 dark:border-white/10 aspect-square"
                    >
                      <img
                        src={photo.thumbnailUrl}
                        alt="Event thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Delete this photo permanently?')) {
                              onDeletePhoto(photo.id);
                            }
                          }}
                          className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-md transition-transform active:scale-95 cursor-pointer"
                          title="Delete Photo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-full text-[9px] text-white truncate max-w-[80%] font-medium">
                        {photo.uploaderName || 'Guest'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clear All Confirmation Modal Safeguard */}
        {showClearConfirmModal && (
          <div 
            id="modal-clear-gallery-confirm" 
            className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 pt-safe pb-safe animate-fade-in"
          >
            <div className="bg-white dark:bg-[#0C0B12] w-full max-w-sm rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl p-6 text-center animate-scale-up">
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-1 font-display">
                Clear All Gallery Images?
              </h3>

              <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                Are you sure you want to permanently delete all <strong className="text-red-600 dark:text-red-400">{photos.length}</strong> photo{photos.length > 1 ? 's' : ''} from <span className="font-semibold text-black dark:text-white">"{event.name}"</span>?
              </p>

              <div className="bg-red-50 dark:bg-red-950/40 rounded-2xl p-3 text-left border border-red-200/80 dark:border-red-800 mb-5 text-[11px] text-red-900 dark:text-red-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>This permanent action will:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-red-800 dark:text-red-300 text-[10px] pl-1">
                  <li>Erase all original RAW & high-res camera files</li>
                  <li>Delete all generated thumbnails and WebP previews</li>
                  <li>Remove all database photo records</li>
                  <li>Update all live guest screens in real time</li>
                </ul>
              </div>

              <div className="space-y-2.5">
                <button
                  id="btn-confirm-clear-all-photos"
                  type="button"
                  onClick={handleExecuteClearAll}
                  disabled={clearingPhotos}
                  className="w-full py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer min-h-[46px] flex items-center justify-center gap-2"
                >
                  {clearingPhotos ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Purging Files & Storage…</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Yes, Delete All {photos.length} Photos</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-cancel-clear-all-photos"
                  type="button"
                  onClick={() => setShowClearConfirmModal(false)}
                  disabled={clearingPhotos}
                  className="w-full py-2.5 px-4 rounded-2xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Success Floating Notification */}
        {clearSuccessToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-60 animate-bounce">
            <div className="bg-[#1A1A1A] text-white px-4 py-2 rounded-full shadow-2xl border border-white/10 flex items-center gap-2 text-xs font-medium">
              <Check className="w-4 h-4 text-green-400" />
              <span>Gallery images and storage cleared successfully</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
