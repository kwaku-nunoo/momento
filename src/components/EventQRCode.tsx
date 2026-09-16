import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Share2, Copy, Check, Smartphone, Info } from 'lucide-react';
import { getDirectUrl, getPreviewUrl, isDevContainerUrl } from '../lib/utils';

interface EventQRCodeProps {
  eventUrl: string;
  eventName: string;
  eventCode: string;
  onClose?: () => void;
}

export const EventQRCode: React.FC<EventQRCodeProps> = ({
  eventUrl,
  eventName,
  eventCode,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const isDev = isDevContainerUrl();
  const [urlMode, setUrlMode] = useState<'direct' | 'public'>('direct');
  const [showTips, setShowTips] = useState<boolean>(false);
  const [localNetworkOrigin, setLocalNetworkOrigin] = useState<string>('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const isLocalBrowser = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '[::1]') return;

    fetch('/api/network-address')
      .then((res) => res.ok ? res.json() : null)
      .then((data: { address?: string; port?: number } | null) => {
        if (data?.address) {
          setLocalNetworkOrigin(`http://${data.address}:${data.port || window.location.port || '3000'}`);
        }
      })
      .catch(() => {});
  }, []);

  // Direct active URL vs Shared Preview URL (public defaults to ais-pre-* which has no Google login)
  const targetUrl = eventUrl.startsWith('/') ? eventUrl : `/e/${eventCode}`;
  const directOrigin = localNetworkOrigin || window.location.origin;
  const fullUrl = urlMode === 'public' && isDev 
    ? getPreviewUrl(targetUrl)
    : isLocalBrowser && !localNetworkOrigin ? '' : `${directOrigin}${targetUrl}`;

  useEffect(() => {
    if (!fullUrl) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(fullUrl, {
      width: 360,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    }).then(url => {
      setQrDataUrl(url);
    }).catch(err => {
      console.error('QR code generation error:', err);
    });
  }, [fullUrl]);

  const handleCopyLink = async () => {
    if (!fullUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        // Fallback for older browsers or restricted iframe contexts
        const textarea = document.createElement('textarea');
        textarea.value = fullUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const handleNativeShare = async () => {
    if (!fullUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `MOMENTO — ${eventName}`,
          text: `Join the photo gallery for "${eventName}" on MOMENTO (Event Code: ${eventCode}). Scan the QR code or tap the link to share moments!`,
          url: fullUrl
        });
      } catch (err) {
        // User dismissed share dialog
      }
    } else {
      handleCopyLink();
    }
  };

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `MOMENTO_${eventCode.replace(/[^a-zA-Z0-9]/g, '_')}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div id="event-qr-card" className="flex flex-col items-center text-center p-6 sm:p-7 bg-white dark:bg-[#07060B] rounded-[32px] border border-gray-200/80 dark:border-white/10 shadow-2xl max-w-sm w-full mx-auto animate-scale-in text-[#1A1A1A] dark:text-[#F3F1EC]">
      {/* High-Contrast Container for QR code (Guarantees Instant Camera Recognition) */}
      <div className="w-full aspect-square max-w-[270px] bg-[#121118] rounded-3xl flex items-center justify-center mb-4 p-4 shadow-lg relative group">
        {qrDataUrl ? (
          <div className="bg-white p-3 rounded-2xl shadow-md transform group-hover:scale-[1.02] transition-transform">
            <img
              src={qrDataUrl}
              alt={`QR code for ${eventName}`}
              className="w-48 h-48 sm:w-52 sm:h-52 rounded-xl object-contain block"
            />
          </div>
        ) : (
          <div className="text-gray-400 text-xs text-center animate-pulse px-4">
            {isLocalBrowser && !localNetworkOrigin ? 'Preparing phone-safe link...' : 'Generating High-Contrast QR...'}
          </div>
        )}
      </div>

      <h3 className="text-lg font-bold tracking-tight mb-1 font-display">
        Share the magic
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3.5 max-w-xs">
        Let guests scan this to join the gallery instantly. No apps, no sign-ups.
      </p>

      {/* Code Pill with copy action */}
      <div 
        onClick={handleCopyLink}
        className="flex items-center justify-between gap-2 mb-3.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200/70 dark:hover:bg-white/10 px-4 py-2.5 rounded-2xl font-mono text-xs font-semibold w-full cursor-pointer transition-colors"
        title="Click to copy link"
      >
        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-sans uppercase tracking-wider font-bold">Event Code:</span>
        <span className="text-[#E67E22] tracking-wider select-all font-bold font-mono text-sm">{eventCode}</span>
      </div>

      {/* Dev Container Mode Selector if in AI Studio */}
      {isDev && (
        <div className="w-full mb-3.5 p-2.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-700/40 text-left">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 dark:text-amber-200">
              <Smartphone className="w-3.5 h-3.5 text-[#E67E22]" />
              <span>Scanning from phone:</span>
            </div>
            <button
              type="button"
              onClick={() => setShowTips(!showTips)}
              className="text-[10px] text-[#E67E22] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <Info className="w-3 h-3" />
              <span>{showTips ? 'Hide info' : 'Phone guide'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setUrlMode('direct')}
              className={`px-2.5 py-1.5 rounded-xl transition-all text-center cursor-pointer ${
                urlMode === 'direct'
                  ? 'bg-white dark:bg-neutral-800 font-bold text-[#1A1A1A] dark:text-white shadow-xs border border-amber-300 dark:border-amber-600'
                  : 'text-amber-900 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40'
              }`}
            >
              Live Direct URL
            </button>
            <button
              type="button"
              onClick={() => setUrlMode('public')}
              className={`px-2.5 py-1.5 rounded-xl transition-all text-center cursor-pointer ${
                urlMode === 'public'
                  ? 'bg-white dark:bg-neutral-800 font-bold text-[#1A1A1A] dark:text-white shadow-xs border border-amber-300 dark:border-amber-600'
                  : 'text-amber-900 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40'
              }`}
            >
              Shared App URL
            </button>
          </div>

          {showTips && (
            <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-700/40 text-[10px] text-amber-900 dark:text-amber-300 leading-relaxed space-y-1">
              <p>
                • <strong>Live Direct URL:</strong> Points directly to the current server URL for immediate testing.
              </p>
              <p>
                • <strong>Shared App URL:</strong> Public link generated when clicking <strong>Share</strong> in AI Studio.
              </p>
              <p>
                • <strong>Manual Join:</strong> Guests can also enter <strong>{eventCode}</strong> on the home screen.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions: Copy Link & Download QR */}
      <div className="flex items-center gap-2.5 w-full mb-2 text-xs font-semibold">
        <button
          id="btn-copy-event-link"
          type="button"
          onClick={handleCopyLink}
          disabled={!fullUrl}
          className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 px-3 py-3 rounded-2xl cursor-pointer flex-1 text-center font-medium text-xs text-[#1A1A1A] dark:text-white transition-all flex items-center justify-center gap-1.5 min-h-[44px] shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-wait"
        >
          {copied ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" /> : <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
          <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
        </button>

        <button
          id="btn-download-qr"
          type="button"
          onClick={handleDownloadQR}
          disabled={!qrDataUrl}
          className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 px-3 py-3 rounded-2xl cursor-pointer flex-1 text-center font-medium text-xs text-[#1A1A1A] dark:text-white transition-all flex items-center justify-center gap-1.5 min-h-[44px] shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-wait"
        >
          <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>Download QR</span>
        </button>
      </div>

      {installPrompt && (
        <button
          id="btn-install-momento-pwa"
          type="button"
          onClick={handleInstallApp}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-[#E67E22] hover:bg-[#d47019] text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install MOMENTO on this phone</span>
        </button>
      )}

      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          id="btn-share-event-native"
          type="button"
          onClick={handleNativeShare}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-2xl text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-medium transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>More Share Options</span>
        </button>
      )}
    </div>
  );
};
