import React, { useState } from 'react';
import type { UploadItem } from '../types';
import { formatFileSize } from '../lib/utils';
import { CheckCircle2, AlertTriangle, RefreshCw, X, Info, Copy, Check } from 'lucide-react';

interface UploadQueueProps {
  items: UploadItem[];
  onRetry: (itemId: string) => void;
  onRetryAll?: () => void;
  onDismiss: (itemId: string) => void;
  onClearCompleted: () => void;
}

export const UploadQueue: React.FC<UploadQueueProps> = ({
  items,
  onRetry,
  onRetryAll,
  onDismiss,
  onClearCompleted
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);

  if (items.length === 0) return null;

  const totalCount = items.length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const uploadingCount = items.filter(i => i.status === 'uploading' || i.status === 'queued').length;
  const failedItems = items.filter(i => i.status === 'failed');
  const failedCount = failedItems.length;
  const isAllComplete = completedCount === totalCount && totalCount > 0;

  const handleCopyDiagnostics = () => {
    const diagnosticReport = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      onlineStatus: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown',
      totalItems: items.length,
      failedCount,
      completedCount,
      items: items.map(item => ({
        id: item.id,
        fileName: item.file.name,
        fileSize: item.file.size,
        fileType: item.file.type,
        status: item.status,
        error: item.error,
        httpStatus: item.httpStatus,
        failedAt: item.failedAt
      }))
    };

    navigator.clipboard.writeText(JSON.stringify(diagnosticReport, null, 2)).then(() => {
      setCopiedLog(true);
      setTimeout(() => setCopiedLog(false), 2500);
    });
  };

  return (
    <>
      <aside
        id="upload-queue-panel"
        aria-label="Upload Progress"
        className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 left-4 sm:left-auto sm:w-96 z-40 bg-[#1A1A1A] dark:bg-[#07060B] text-white rounded-3xl shadow-2xl border border-white/10 overflow-hidden transition-all duration-300 p-4 sm:p-5 pb-safe"
      >
        {/* Header Info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
              failedCount > 0 
                ? 'bg-red-500 text-white' 
                : isAllComplete 
                  ? 'bg-green-500 text-white' 
                  : 'bg-[#E67E22] text-white'
            }`}>
              {failedCount > 0 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isAllComplete ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            
            <div>
              <p className="text-sm font-bold leading-tight">
                {failedCount > 0
                  ? `${failedCount} upload${failedCount > 1 ? 's' : ''} failed`
                  : isAllComplete
                    ? 'Your moments are in ✨'
                    : `Uploading ${uploadingCount || totalCount} moment${(uploadingCount || totalCount) > 1 ? 's' : ''}...`}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {failedCount > 0
                  ? `${completedCount} succeeded • Tap retry or inspect below`
                  : isAllComplete
                    ? `${completedCount} saved to gallery`
                    : `${completedCount} of ${totalCount} processed`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {failedCount > 0 && onRetryAll && (
              <button
                id="btn-retry-all-uploads"
                type="button"
                onClick={onRetryAll}
                title="Retry all failed uploads"
                className="text-[11px] font-semibold text-[#E67E22] hover:text-white px-2.5 py-1 rounded-full bg-[#E67E22]/15 hover:bg-[#E67E22] transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry All</span>
              </button>
            )}

            {isAllComplete && (
              <button
                id="btn-dismiss-upload-queue"
                type="button"
                onClick={onClearCompleted}
                className="text-xs font-semibold text-gray-300 hover:text-white px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>

        {/* Global Progress Bar */}
        {!isAllComplete && (
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                failedCount > 0 ? 'bg-red-400' : 'bg-[#E67E22]'
              }`}
              style={{ width: `${Math.max((completedCount / totalCount) * 100, 15)}%` }}
            />
          </div>
        )}

        {/* Progress Items List */}
        <div className="max-h-52 overflow-y-auto divide-y divide-white/10 -mx-1 px-1">
          {items.map((item) => (
            <div key={item.id} className="py-2.5 flex items-start justify-between gap-2.5 text-xs">
              {/* Thumbnail + Name + Error Details */}
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 border border-white/10 relative mt-0.5">
                  <img
                    src={item.previewUrl}
                    alt="Upload preview"
                    className="w-full h-full object-cover"
                  />
                  {item.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">{item.progress}%</span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-gray-200 text-xs font-medium leading-tight">
                    {item.file.name}
                  </div>
                  
                  <div className="text-[10px] text-gray-400 flex flex-wrap items-center gap-1 mt-0.5">
                    <span>{formatFileSize(item.file.size)}</span>
                    
                    {item.status === 'uploading' && (
                      <span className="text-[#E67E22] font-medium">• {item.progress}%</span>
                    )}

                    {item.status === 'queued' && (
                      <span className="text-amber-400 font-medium">• Queued (Waiting for connection)</span>
                    )}

                    {item.status === 'completed' && (
                      <span className="text-green-400 font-medium">• Saved</span>
                    )}

                    {item.status === 'failed' && (
                      <span className="text-red-400 font-semibold">• Failed</span>
                    )}
                  </div>

                  {/* Explicit Error Details Banner */}
                  {item.status === 'failed' && item.error && (
                    <div className="mt-1 p-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-[10px] text-red-300 leading-tight">
                      {item.error}
                      {item.httpStatus ? ` (HTTP ${item.httpStatus})` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Status actions */}
              <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                {item.status === 'failed' && (
                  <button
                    id={`btn-retry-upload-${item.id}`}
                    type="button"
                    onClick={() => onRetry(item.id)}
                    title="Retry upload"
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  id={`btn-dismiss-upload-item-${item.id}`}
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  title="Dismiss"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Diagnostic Inspector Footer */}
        {failedCount > 0 && (
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-400">
            <button
              id="btn-toggle-diagnostics"
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="inline-flex items-center gap-1 text-gray-300 hover:text-white underline underline-offset-2"
            >
              <Info className="w-3 h-3" />
              <span>{showDiagnostics ? 'Hide Diagnostic Report' : 'Inspect Diagnostic Report'}</span>
            </button>

            <button
              id="btn-copy-diagnostics"
              type="button"
              onClick={handleCopyDiagnostics}
              className="inline-flex items-center gap-1 text-gray-300 hover:text-white px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
            >
              {copiedLog ? (
                <>
                  <Check className="w-3 h-3 text-green-400" />
                  <span className="text-green-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Logs</span>
                </>
              )}
            </button>
          </div>
        )}
      </aside>

      {/* Diagnostics Modal */}
      {showDiagnostics && (
        <div
          id="modal-upload-diagnostics"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="bg-[#14121B] dark:bg-[#0C0B12] border border-white/15 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Upload Diagnostics Report</h3>
                  <p className="text-xs text-gray-400">Detailed error breakdown for troubleshooting</p>
                </div>
              </div>
              <button
                id="btn-close-diagnostics-modal"
                type="button"
                onClick={() => setShowDiagnostics(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-400">Browser Network:</span>
                  <span className={typeof navigator !== 'undefined' && navigator.onLine ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {typeof navigator !== 'undefined' && navigator.onLine ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Allowed Size:</span>
                  <span className="text-gray-200">100 MB per photo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Batch Failed Count:</span>
                  <span className="text-red-400 font-semibold">{failedCount} of {totalCount}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Failed Items Log</p>
                {failedItems.map(item => (
                  <div key={item.id} className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-gray-300 space-y-1">
                    <div className="flex justify-between items-start font-medium text-white">
                      <span className="truncate flex-1">{item.file.name}</span>
                      <span className="text-red-400 text-[11px] flex-shrink-0 ml-2">{formatFileSize(item.file.size)}</span>
                    </div>
                    <div className="text-[11px] text-gray-400">MIME Type: {item.file.type || 'unknown/binary'}</div>
                    <div className="text-red-300 text-[11px] font-mono bg-red-900/40 p-2 rounded-lg border border-red-500/20 break-words">
                      {item.error || 'Unknown upload failure'} {item.httpStatus ? `(Status: ${item.httpStatus})` : ''}
                    </div>
                    {item.failedAt && (
                      <div className="text-[10px] text-gray-500">Failed at: {new Date(item.failedAt).toLocaleTimeString()}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCopyDiagnostics}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {copiedLog ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span>Copied to Clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy JSON Report</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDiagnostics(false);
                  if (onRetryAll) onRetryAll();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#E67E22] hover:bg-[#D35400] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry All Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

