/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LandingView } from './components/LandingView';
import { EventGalleryView } from './components/EventGalleryView';
import { CreateEventModal } from './components/CreateEventModal';
import { JoinModal } from './components/JoinModal';
import { AdminPortal } from './components/AdminPortal';
import { ThemeToggle } from './components/ThemeToggle';
import { GalaxyBackground } from './components/GalaxyBackground';
import { NetworkToast } from './components/NetworkToast';
import type { MomentoEvent } from './types';
import { useTheme } from './lib/theme';

export default function App() {
  useTheme(); // Initializes and syncs theme state
  const [currentRoute, setCurrentRoute] = useState<{
    view: 'landing' | 'gallery';
    eventCode?: string;
    hostKey?: string;
    photoId?: string;
  }>({ view: 'landing' });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Parse path on initial load & popstate (browser back/forward & QR scanner resilience)
  const parseCurrentUrl = () => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const hostKeyParam = searchParams.get('key') || searchParams.get('hostKey') || '';

    if (pathname === '/admin' || pathname === '/vault') {
      setShowAdminModal(true);
    }

    // 1. Query parameter based link: ?code=xyz or ?event=xyz or ?e=xyz (e.g. from QR scanners)
    const queryCode = searchParams.get('code') || searchParams.get('event') || searchParams.get('e');
    const queryPhotoId = searchParams.get('photo') || searchParams.get('photoId') || undefined;
    if (queryCode) {
      setCurrentRoute({
        view: 'gallery',
        eventCode: queryCode.trim(),
        hostKey: hostKeyParam,
        photoId: queryPhotoId
      });
      return;
    }

    // 2. Hash-based link: #/e/xyz or #e/xyz or #xyz
    if (hash && hash.length > 1) {
      const cleanHash = hash.replace(/^#\/?(e\/)?/, '');
      if (cleanHash && !cleanHash.startsWith('/')) {
        const hashParts = cleanHash.split('/');
        setCurrentRoute({
          view: 'gallery',
          eventCode: hashParts[0].trim(),
          hostKey: hostKeyParam,
          photoId: hashParts[2] || undefined
        });
        return;
      }
    }

    // 3. Route: /e/:code or /e/:code/photo/:photoId or /join/:code
    const eventMatch = pathname.match(/^\/(?:e|join)\/([a-zA-Z0-9-_]+)(?:\/photo\/([a-zA-Z0-9-_]+))?/);
    if (eventMatch) {
      const code = eventMatch[1];
      const photoId = eventMatch[2] || queryPhotoId;
      setCurrentRoute({
        view: 'gallery',
        eventCode: code,
        hostKey: hostKeyParam,
        photoId
      });
      return;
    }

    // 4. Route: /host/:id
    const hostMatch = pathname.match(/^\/host\/([a-zA-Z0-9-_]+)/);
    if (hostMatch) {
      const eventId = hostMatch[1];
      // Fetch event by id to get code
      fetch(`/api/events/${eventId}/host`, {
        headers: hostKeyParam ? { 'x-host-key': hostKeyParam } : {}
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.event && data.event.code) {
            window.history.replaceState({}, '', `/e/${data.event.code}?key=${encodeURIComponent(hostKeyParam)}`);
            setCurrentRoute({
              view: 'gallery',
              eventCode: data.event.code,
              hostKey: hostKeyParam
            });
          }
        })
        .catch(() => {
          setCurrentRoute({ view: 'landing' });
        });
      return;
    }

    if (pathname === '/create') {
      setShowCreateModal(true);
    }

    setCurrentRoute({ view: 'landing' });
  };

  useEffect(() => {
    parseCurrentUrl();

    const handlePopState = () => {
      parseCurrentUrl();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToEvent = (code: string, hostKey?: string) => {
    const url = hostKey ? `/e/${code}?key=${encodeURIComponent(hostKey)}` : `/e/${code}`;
    window.history.pushState({}, '', url);
    setCurrentRoute({
      view: 'gallery',
      eventCode: code,
      hostKey
    });
    setShowCreateModal(false);
    setShowJoinModal(false);
  };

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setCurrentRoute({ view: 'landing' });
  };

  const handleEventCreated = (event: MomentoEvent, hostKey: string) => {
    navigateToEvent(event.code, hostKey);
  };

  return (
    <div className="relative min-h-full font-sans antialiased text-[#1A1A1A] bg-[#F5F2ED] dark:bg-[#020104] dark:text-[#F3F1EC] transition-colors duration-300">
      {/* Starry Galaxy Cosmos in Dark Mode */}
      <GalaxyBackground />

      <div className="relative z-10 min-h-full">
        {currentRoute.view === 'gallery' && currentRoute.eventCode ? (
          <EventGalleryView
            eventCode={currentRoute.eventCode}
            initialHostKey={currentRoute.hostKey}
            initialPhotoId={currentRoute.photoId}
            onGoHome={navigateToHome}
          />
        ) : (
          <>
            <LandingView
              onCreateEvent={() => setShowCreateModal(true)}
              onJoinEvent={() => setShowJoinModal(true)}
              onSelectEvent={(code) => navigateToEvent(code)}
              onOpenAdmin={() => setShowAdminModal(true)}
            />
            <NetworkToast />
          </>
        )}

        {/* Global Modals */}
        {showCreateModal && (
          <CreateEventModal
            onClose={() => setShowCreateModal(false)}
            onEventCreated={handleEventCreated}
          />
        )}

        {showJoinModal && (
          <JoinModal
            onClose={() => setShowJoinModal(false)}
            onJoinCode={(code) => navigateToEvent(code)}
          />
        )}

        {showAdminModal && (
          <AdminPortal
            onClose={() => setShowAdminModal(false)}
            onNavigateToEvent={(code, hostKey) => navigateToEvent(code, hostKey)}
          />
        )}
      </div>

      {/* Floating Draggable Theme Toggle on the Side */}
      <ThemeToggle floating />
    </div>
  );
}
