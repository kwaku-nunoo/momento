import React, { useState } from 'react';
import { formatFileSize, formatTimeAgo } from '../lib/utils';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Database, 
  Image as ImageIcon, 
  HardDrive, 
  Users, 
  Download, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  X, 
  FileCode, 
  Check, 
  Calendar,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  Archive,
  FolderDown,
  Sparkles
} from 'lucide-react';

interface AdminStats {
  eventCount: number;
  photoCount: number;
  totalSizeBytes: number;
  contributorCount: number;
}

interface AdminPhotoRecord {
  id: string;
  eventId: string;
  eventName: string;
  eventCode: string;
  uploaderSessionId: string;
  uploaderName?: string;
  originalFilename: string;
  originalExt: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  aspectRatio: number;
  createdAt: string;
  mediaType: 'photo' | 'video';
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string;
}

interface AdminEventRecord {
  id: string;
  code: string;
  name: string;
  hostKey: string;
  date?: string;
  location?: string;
  isArchived: boolean;
  allowUploads: boolean;
  createdAt: string;
  photoCount: number;
  totalSizeBytes: number;
}

interface AdminPortalProps {
  onClose: () => void;
  onNavigateToEvent: (code: string, hostKey?: string) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onClose,
  onNavigateToEvent
}) => {
  const [adminKey, setAdminKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loginInput, setLoginInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'photos' | 'events' | 'audit'>('photos');

  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [photos, setPhotos] = useState<AdminPhotoRecord[]>([]);
  const [events, setEvents] = useState<AdminEventRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhotoMetadata, setSelectedPhotoMetadata] = useState<AdminPhotoRecord | null>(null);
  const [toastNotice, setToastNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToastNotice({ message, type });
    setTimeout(() => setToastNotice(null), 3500);
  };

  const fetchAdminData = async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { 'x-admin-key': key }
      });
      if (!res.ok) {
        throw new Error('Invalid Admin Key');
      }
      const data = await res.json();
      setStats(data.stats);
      setPhotos(data.photos);
      setEvents(data.events);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message || 'Unauthorized');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const key = loginInput.trim();
    if (!key) return;
    setAdminKey(key);
    fetchAdminData(key);
  };

  const handleLogout = () => {
    setAdminKey('');
    setIsAuthenticated(false);
    setLoginInput('');
  };

  const handleDeletePhoto = async (photoId: string, eventId: string) => {
    if (!window.confirm('Globally purge this photo and its files permanently?')) return;
    try {
      const res = await fetch(`/api/admin/photos/${photoId}?eventId=${eventId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        if (selectedPhotoMetadata?.id === photoId) {
          setSelectedPhotoMetadata(null);
        }
        showToast('Photo purged successfully', 'success');
      } else {
        showToast('Failed to delete photo', 'error');
      }
    } catch (err) {
      showToast('Error deleting photo', 'error');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Permanently purge this entire event and all associated photos?')) return;
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        setPhotos((prev) => prev.filter((p) => p.eventId !== eventId));
        showToast('Event and photos purged', 'success');
      } else {
        showToast('Failed to delete event', 'error');
      }
    } catch (err) {
      showToast('Error deleting event', 'error');
    }
  };

  const [downloadingZipId, setDownloadingZipId] = useState<string | null>(null);

  const handleDownloadEventZip = async (eventId: string, eventName: string) => {
    setDownloadingZipId(eventId);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/download-zip`, {
        headers: { 'x-admin-key': adminKey }
      });
      if (!res.ok) throw new Error('Failed to download event originals.');
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `MOMENTO_${eventName.replace(/[^a-zA-Z0-9_-]/g, '_')}_all_originals.zip`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download event originals.', 'error');
    } finally {
      setDownloadingZipId(null);
    }
  };

  const handleDownloadMasterZip = async () => {
    if (photos.length === 0) {
      showToast('No photos in system to download.', 'error');
      return;
    }
    setDownloadingZipId('master-vault');
    try {
      const res = await fetch('/api/admin/download-all-zip', {
        headers: { 'x-admin-key': adminKey }
      });
      if (!res.ok) throw new Error('Failed to download the master vault.');
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `MOMENTO_MASTER_VAULT_ALL_EVENTS_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download the master vault.', 'error');
    } finally {
      setDownloadingZipId(null);
    }
  };

  const handleClearAllGalleries = async () => {
    if (!window.confirm('⚠️ DANGER: Are you absolutely sure you want to permanently clear ALL events, photo galleries, and files across the entire platform?')) {
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/admin/clear-all', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      if (res.ok) {
        setEvents([]);
        setPhotos([]);
        setStats({
          eventCount: 0,
          photoCount: 0,
          totalSizeBytes: 0,
          contributorCount: 0
        });
        setSelectedPhotoMetadata(null);
        // Clear local visited caches
        localStorage.removeItem('momento_visited_events');
        localStorage.removeItem('momento_host_events');
        showToast('All galleries and photo archives cleared successfully.', 'success');
      } else {
        showToast('Failed to clear galleries. Verify admin key.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error clearing galleries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      exportedAt: new Date().toISOString(),
      stats,
      events,
      photos
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `momento_system_audit_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter photos based on search query
  const filteredPhotos = photos.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.originalFilename.toLowerCase().includes(q) ||
      p.eventName.toLowerCase().includes(q) ||
      p.eventCode.toLowerCase().includes(q) ||
      (p.uploaderName && p.uploaderName.toLowerCase().includes(q)) ||
      p.id.toLowerCase().includes(q)
    );
  });

  return (
    <div
      id="admin-portal-overlay"
      className="fixed inset-0 z-50 bg-[#0C0B0A]/85 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto pt-safe pb-safe animate-fade-in"
    >
      <div className="w-full max-w-5xl bg-[#FDFCF9] dark:bg-[#07060B] text-[#1A1A1A] dark:text-[#E6E1DC] rounded-[28px] sm:rounded-[32px] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[calc(100dvh-2.5rem)] my-auto">
        {/* Admin Header */}
        <header className="px-3 sm:px-6 py-3 sm:py-4 bg-[#1A1A1A] dark:bg-[#0C0B12] text-white flex flex-wrap items-center justify-between gap-2 shrink-0 sticky top-0 z-20 border-b border-white/10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#E67E22] flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="font-bold text-sm sm:text-base font-display tracking-tight text-white truncate">
                  MOMENTO Admin Portal
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[9px] sm:text-[10px] font-mono shrink-0">
                  Master Vault
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-white/50 truncate hidden xs:block">
                Full-system photo metadata tracking, audit logs & event management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogout}
                className="px-2.5 sm:px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] sm:text-xs text-white/80 font-medium transition-colors min-h-[38px] flex items-center justify-center"
              >
                Logout
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Admin Portal"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Dynamic Toast Notice */}
        {toastNotice && (
          <div className={`px-4 py-2.5 flex items-center justify-between text-xs font-semibold shrink-0 animate-fade-in ${
            toastNotice.type === 'success' 
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-b border-emerald-500/25' 
              : 'bg-red-500/15 text-red-700 dark:text-red-300 border-b border-red-500/25'
          }`}>
            <div className="flex items-center gap-2">
              {toastNotice.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />}
              <span>{toastNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastNotice(null)}
              className="p-1 hover:opacity-75 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!isAuthenticated ? (
          /* Login Form */
          <div className="p-5 sm:p-8 max-w-md mx-auto my-auto text-center space-y-5 sm:space-y-6 w-full">
            <div className="w-14 h-14 rounded-3xl bg-[#E67E22]/10 text-[#E67E22] flex items-center justify-center mx-auto mb-2">
              <KeyRound className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-white font-display">
                Admin Authentication
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter your Master Admin Key to access metadata audits and global controls.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="relative">
                <input
                  type="password"
                  placeholder="Master Admin Key"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-white/15 bg-white dark:bg-[#14121B] text-[#1A1A1A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E67E22]/40 text-center tracking-widest font-mono placeholder:text-gray-400 dark:placeholder:text-gray-600"
                  required
                />
              </div>

              {loginError && (
                <div className="text-xs text-red-500 dark:text-red-400 font-medium">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1A1A1A] hover:bg-black dark:bg-[#E67E22] dark:hover:bg-[#d47019] text-white font-semibold text-sm transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Authenticating…' : 'Access Admin Dashboard'}
              </button>

            </form>
          </div>
        ) : (
          /* Authenticated Admin Dashboard */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stats Metric Strip */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-[#F5F2ED] dark:bg-[#0C0B12] border-b border-gray-200 dark:border-white/10">
                <div className="bg-white dark:bg-[#14121B] p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xs">
                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Total Events</div>
                  <div className="text-2xl font-bold text-[#1A1A1A] dark:text-white mt-0.5">{stats.eventCount}</div>
                </div>

                <div className="bg-white dark:bg-[#14121B] p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xs">
                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Total Photos</div>
                  <div className="text-2xl font-bold text-[#1A1A1A] dark:text-white mt-0.5">{stats.photoCount}</div>
                </div>

                <div className="bg-white dark:bg-[#14121B] p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xs">
                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Raw Storage</div>
                  <div className="text-2xl font-bold text-[#E67E22] mt-0.5">{formatFileSize(stats.totalSizeBytes)}</div>
                </div>

                <div className="bg-white dark:bg-[#14121B] p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xs">
                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Unique Uploaders</div>
                  <div className="text-2xl font-bold text-[#1A1A1A] dark:text-white mt-0.5">{stats.contributorCount}</div>
                </div>
              </div>
            )}

            {/* Navigation Tabs & Actions */}
            <div className="px-3 sm:px-5 py-3 bg-white dark:bg-[#0C0B12] border-b border-gray-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('photos')}
                  className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'photos'
                      ? 'bg-[#1A1A1A] dark:bg-[#E67E22] text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  All Photos & Metadata ({photos.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'events'
                      ? 'bg-[#1A1A1A] dark:bg-[#E67E22] text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  All Events ({events.length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {activeTab === 'photos' && (
                  <div className="relative w-full sm:w-auto">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search photo, event, guest..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-52 pl-8 pr-3 py-2 sm:py-1.5 rounded-xl border border-gray-200 dark:border-white/15 bg-gray-50 dark:bg-[#14121B] text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E67E22] placeholder:text-gray-400 dark:placeholder:text-gray-600"
                    />
                  </div>
                )}

                <button
                  id="btn-admin-download-all-zip"
                  type="button"
                  onClick={handleDownloadMasterZip}
                  disabled={downloadingZipId === 'master-vault'}
                  className="flex-1 sm:flex-none min-w-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[11px] sm:text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                  title="Download all original photos across all events into one organized master ZIP"
                >
                  <Archive className="w-3.5 h-3.5 text-[#E67E22]" />
                  <span className="truncate">{downloadingZipId === 'master-vault' ? 'Zipping Master Vault…' : 'Master ZIP (All Events)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex-1 sm:flex-none min-w-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[11px] sm:text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-2xs transition-all cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-[#E67E22]" />
                  <span className="truncate">Export JSON Audit</span>
                </button>

                <button
                  id="btn-admin-clear-all"
                  type="button"
                  onClick={handleClearAllGalleries}
                  disabled={loading}
                  className="flex-1 sm:flex-none min-w-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-[11px] sm:text-xs font-semibold text-red-600 dark:text-red-400 shadow-2xs transition-all cursor-pointer"
                  title="Purge all galleries and photos system-wide"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="truncate">Clear All Galleries</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchAdminData(adminKey)}
                  className="p-1.5 rounded-xl border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 shadow-2xs cursor-pointer"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'photos' && (
                <div className="space-y-4">
                  {filteredPhotos.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-xs">
                      No photos matched your filter query.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0C0B12] shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-[#14121B] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200 dark:border-white/10">
                          <tr>
                            <th className="py-3 px-4">Preview</th>
                            <th className="py-3 px-4">Filename & Event</th>
                            <th className="py-3 px-4">Dimensions</th>
                            <th className="py-3 px-4">Size / MIME</th>
                            <th className="py-3 px-4">Uploader</th>
                            <th className="py-3 px-4">Date Uploaded</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {filteredPhotos.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors">
                              {/* Thumbnail */}
                              <td className="py-2.5 px-4">
                                <div
                                  onClick={() => setSelectedPhotoMetadata(p)}
                                  className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-[#14121B] border border-gray-200 dark:border-white/10 cursor-pointer hover:scale-105 transition-transform"
                                >
                                  <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              </td>

                              {/* Filename & Event */}
                              <td className="py-2.5 px-4">
                                <div className="font-semibold text-[#1A1A1A] dark:text-white truncate max-w-xs">
                                  {p.originalFilename}
                                </div>
                                <div className="text-[10px] text-gray-400 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                  <span className="font-medium text-gray-600 dark:text-gray-300">{p.eventName}</span>
                                  <span>•</span>
                                  <span className="font-mono">/e/{p.eventCode}</span>
                                </div>
                              </td>

                              {/* Dimensions */}
                              <td className="py-2.5 px-4 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                                {p.width} × {p.height} px
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-sans">
                                  Aspect: {p.aspectRatio}
                                </div>
                              </td>

                              {/* Size / MIME */}
                              <td className="py-2.5 px-4">
                                <div className="font-mono font-medium text-[#1A1A1A] dark:text-white">
                                  {formatFileSize(p.fileSize)}
                                </div>
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                                  {p.mimeType}
                                </div>
                              </td>

                              {/* Uploader */}
                              <td className="py-2.5 px-4">
                                <div className="font-medium text-[#1A1A1A] dark:text-white">
                                  {p.uploaderName || 'Anonymous Guest'}
                                </div>
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate max-w-[120px]">
                                  {p.uploaderSessionId}
                                </div>
                              </td>

                              {/* Date */}
                              <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <div>{formatTimeAgo(p.createdAt)}</div>
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                                  {new Date(p.createdAt).toLocaleDateString()}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPhotoMetadata(p)}
                                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 cursor-pointer"
                                  title="Inspect Full Metadata"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>

                                <a
                                  href={p.originalUrl}
                                  download={p.originalFilename}
                                  className="inline-block p-1.5 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 cursor-pointer"
                                  title="Download Untouched Original"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>

                                <button
                                  type="button"
                                  onClick={() => handleDeletePhoto(p.id, p.eventId)}
                                  className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 cursor-pointer"
                                  title="Purge Photo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'events' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-white dark:bg-[#0C0B12] p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-[#1A1A1A] dark:text-white font-display">
                              {ev.name}
                            </h4>
                            {ev.isArchived && (
                              <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-[9px] font-bold">
                                ARCHIVED
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                            Code: /e/{ev.code}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                          title="Purge Event & All Photos"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-gray-100 dark:border-white/10 text-center text-xs">
                        <div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Photos</div>
                          <div className="font-bold text-[#1A1A1A] dark:text-white">{ev.photoCount}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Data</div>
                          <div className="font-bold text-[#E67E22]">{formatFileSize(ev.totalSizeBytes)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Uploads</div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">{ev.allowUploads ? 'Open' : 'Closed'}</div>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-[#14121B] p-2.5 rounded-xl font-mono text-[10px] text-gray-600 dark:text-gray-300 select-all break-all border border-gray-200 dark:border-white/10">
                        Host Key: {ev.hostKey}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-white/10">
                        <button
                          id={`btn-admin-download-event-zip-${ev.id}`}
                          type="button"
                          onClick={() => handleDownloadEventZip(ev.id, ev.name)}
                          disabled={ev.photoCount === 0 || downloadingZipId === ev.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-[#E67E22]/15 hover:bg-orange-100 dark:hover:bg-[#E67E22]/25 text-[#E67E22] text-xs font-semibold border border-orange-200 dark:border-[#E67E22]/30 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          title="Download all original untouched photos for this event in a single ZIP file"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>
                            {downloadingZipId === ev.id ? 'Packaging ZIP…' : `Download Originals ZIP (${ev.photoCount})`}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onNavigateToEvent(ev.code, ev.hostKey);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1A1A] hover:bg-black dark:bg-[#1C1A27] dark:hover:bg-[#252333] border border-transparent dark:border-white/10 text-white text-xs font-semibold shadow-2xs cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3 text-[#E67E22]" />
                          <span>Open Gallery</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Photo Deep Metadata Modal Inspector */}
        {selectedPhotoMetadata && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 pt-safe pb-safe">
            <div className="bg-white dark:bg-[#0C0B12] rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-200 dark:border-white/10 space-y-4 animate-scale-in text-xs text-[#1A1A1A] dark:text-[#E6E1DC]">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/10">
                <div className="font-bold text-sm text-[#1A1A1A] dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#E67E22]" />
                  <span>Full EXIF & Photo Metadata Inspector</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPhotoMetadata(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#14121B] border border-gray-200 dark:border-white/10 shrink-0">
                  <img src={selectedPhotoMetadata.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-bold text-sm text-[#1A1A1A] dark:text-white truncate">{selectedPhotoMetadata.originalFilename}</div>
                  <div className="text-gray-500 dark:text-gray-400">Event: <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedPhotoMetadata.eventName}</span></div>
                  <div className="text-gray-500 dark:text-gray-400">Uploader: <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedPhotoMetadata.uploaderName || 'Anonymous'}</span></div>
                  <div className="text-gray-400 dark:text-gray-500 font-mono text-[10px]">Photo ID: {selectedPhotoMetadata.id}</div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-[#14121B] rounded-2xl p-4 border border-gray-200 dark:border-white/10 space-y-2 font-mono text-[11px]">
                <div className="flex justify-between border-b border-gray-200 dark:border-white/10 pb-1">
                  <span className="text-gray-500 dark:text-gray-400">Pixel Dimensions:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedPhotoMetadata.width} × {selectedPhotoMetadata.height}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-white/10 pb-1">
                  <span className="text-gray-500 dark:text-gray-400">Aspect Ratio:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedPhotoMetadata.aspectRatio}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-white/10 pb-1">
                  <span className="text-gray-500 dark:text-gray-400">Raw Byte Size:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedPhotoMetadata.fileSize.toLocaleString()} bytes ({formatFileSize(selectedPhotoMetadata.fileSize)})</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-white/10 pb-1">
                  <span className="text-gray-500 dark:text-gray-400">MIME Content Type:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedPhotoMetadata.mimeType}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-white/10 pb-1">
                  <span className="text-gray-500 dark:text-gray-400">Timestamp:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedPhotoMetadata.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Client Session ID:</span>
                  <span className="font-bold text-gray-900 dark:text-white truncate max-w-[180px]">{selectedPhotoMetadata.uploaderSessionId}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => handleDownloadEventZip(selectedPhotoMetadata.eventId, selectedPhotoMetadata.eventName)}
                  className="px-3.5 py-2 rounded-xl bg-orange-50 dark:bg-[#E67E22]/15 hover:bg-orange-100 dark:hover:bg-[#E67E22]/25 text-[#E67E22] font-semibold border border-orange-200 dark:border-[#E67E22]/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download all original photos in this photo's event as a ZIP"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Download Event ZIP</span>
                </button>

                <a
                  href={selectedPhotoMetadata.originalUrl}
                  download={selectedPhotoMetadata.originalFilename}
                  className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-black dark:bg-[#E67E22] dark:hover:bg-[#d47019] text-white font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Download Photo Original</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
