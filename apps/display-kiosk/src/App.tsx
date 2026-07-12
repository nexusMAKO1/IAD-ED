import { useEffect, useState, useRef, useCallback } from 'react';
import { DisplayPlayer } from './components/DisplayPlayer';
import './App.css';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Campaign {
  id: string;
  name: string;
  mediaUrl: string;
  localUrl?: string;
  mediaType: string;
  duration: number;
}

interface OverlayState {
  detectedAge: string;
  campaignName: string;
  mqttConnected: boolean;
  mqttTopic: string;
  countdown: number;
  latencyMs: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const DEV_OVERLAY = import.meta.env.DEV; // only in dev mode

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [playlist, setPlaylist]               = useState<Campaign[]>([]);
  const [, setCurrentIndex]                   = useState(0);
  const [currentCampaign, setCurrent]         = useState<Campaign | null>(null);
  const [isFading, setIsFading]               = useState(false);
  const [offline, setOffline]                 = useState(false);
  const [overlay, setOverlay]                 = useState<OverlayState>({
    detectedAge: '—',
    campaignName: '—',
    mqttConnected: false,
    mqttTopic: 'smartvision/display/commands',
    countdown: 0,
    latencyMs: 0,
  });

  // Countdown timer ref
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const startCountdown = (durationSec: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    let remaining = durationSec;
    setOverlay((prev) => ({ ...prev, countdown: remaining }));
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setOverlay((prev) => ({ ...prev, countdown: Math.max(0, remaining) }));
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    }, 1000);
  };

  const playCampaign = useCallback((campaign: Campaign) => {
    setIsFading(true);
    setTimeout(() => {
      setCurrent(campaign);
      setIsFading(false);
      setOverlay((prev) => ({
        ...prev,
        campaignName: campaign.name ?? 'Unknown',
        countdown: campaign.duration,
      }));
      startCountdown(campaign.duration);
      console.log(`[DISPLAY] Campaign playing: ${campaign.name}`);
    }, 500);
  }, []);

  // ── Initial setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Load offline cache from localStorage
    try {
      const cached = localStorage.getItem('kiosk_playlist');
      if (cached) {
        setPlaylist(JSON.parse(cached));
      } else {
        setOffline(true);
      }
    } catch {
      setOffline(true);
    }

    const api = (window as any).electronAPI;
    if (!api) {
      console.warn('[App] electronAPI not available — running outside Electron');
      return;
    }

    // ── MQTT: play command from decision engine ────────────────────────────
    api.onPlayCommand((data: any) => {
      console.log('[DISPLAY] Campaign loaded:', data.campaignId);
      // Extract age from data if backend forwards it (optional)
      setOverlay((prev) => ({
        ...prev,
        detectedAge: data.detectedAge ?? prev.detectedAge,
        latencyMs: data.latencyMs ?? 0,
      }));
      playCampaign({
        id:       data.campaignId,
        name:     data.campaignName ?? 'MQTT Campaign',
        mediaUrl: data.url,
        localUrl: data.localUrl,
        mediaType: data.mediaType,
        duration: data.duration ?? 15,
      });
    });

    // ── MQTT: full playlist update ────────────────────────────────────────
    api.onPlaylistUpdate((newPlaylist: Campaign[]) => {
      console.log('[DISPLAY] Playlist updated:', newPlaylist.length, 'campaigns');
      setPlaylist(newPlaylist);
      setOffline(false);
      setCurrentIndex(0);
      localStorage.setItem('kiosk_playlist', JSON.stringify(newPlaylist));
    });

    // ── MQTT: revert to default playlist ─────────────────────────────────
    api.onRevertPlaylist(() => {
      console.log('[DISPLAY] Reverting to default playlist');
      setCurrentIndex(0);
      setCurrent(null); // will trigger playlist auto-start below
    });

    // ── MQTT: connection status ───────────────────────────────────────────
    api.onMqttStatus((status: { connected: boolean; topic: string }) => {
      setOverlay((prev) => ({
        ...prev,
        mqttConnected: status.connected,
        mqttTopic: status.topic,
      }));
    });

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [playCampaign]);

  // ── Playlist auto-loop ─────────────────────────────────────────────────────
  useEffect(() => {
    if (playlist.length === 0) return;
    if (!currentCampaign) {
      playCampaign(playlist[0]);
    }
  }, [playlist, currentCampaign, playCampaign]);

  const playNextInPlaylist = useCallback(() => {
    if (playlist.length === 0) return;
    setCurrentIndex((prev) => {
      const nextIdx = (prev + 1) % playlist.length;
      playCampaign(playlist[nextIdx]);
      return nextIdx;
    });
  }, [playlist, playCampaign]);

  // ── Render: offline splash ─────────────────────────────────────────────────
  if (offline && !currentCampaign) {
    return (
      <div className="offline-screen">
        <h1>Waiting for campaigns…</h1>
        <p>Offline Mode / No Cache Available</p>
      </div>
    );
  }

  // ── Render: main kiosk ────────────────────────────────────────────────────
  return (
    <div className="kiosk-container">
      {currentCampaign && (
        <div className={`media-layer ${isFading ? 'fade-out' : 'fade-in'}`}>
          <DisplayPlayer
            key={currentCampaign.id + '-' + currentCampaign.mediaUrl}
            campaign={currentCampaign}
            onEnded={playNextInPlaylist}
          />
        </div>
      )}

      {/* Developer Overlay — only in dev mode */}
      {DEV_OVERLAY && (
        <div className="dev-overlay">
          <div className="dev-overlay__row">
            <span className="dev-overlay__label">Detected age</span>
            <span className="dev-overlay__value">{overlay.detectedAge}</span>
          </div>
          <div className="dev-overlay__row">
            <span className="dev-overlay__label">Current campaign</span>
            <span className="dev-overlay__value">{overlay.campaignName}</span>
          </div>
          <div className="dev-overlay__row">
            <span className="dev-overlay__label">MQTT status</span>
            <span className={`dev-overlay__value ${overlay.mqttConnected ? 'status--ok' : 'status--err'}`}>
              {overlay.mqttConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="dev-overlay__row">
            <span className="dev-overlay__label">Topic</span>
            <span className="dev-overlay__value dev-overlay__mono">{overlay.mqttTopic}</span>
          </div>
          <div className="dev-overlay__row">
            <span className="dev-overlay__label">Countdown</span>
            <span className="dev-overlay__value">{overlay.countdown} s</span>
          </div>
          <div className="dev-overlay__row">
            <span className="dev-overlay__label">Backend latency</span>
            <span className="dev-overlay__value">{overlay.latencyMs} ms</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
