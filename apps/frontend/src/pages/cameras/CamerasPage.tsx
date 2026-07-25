/**
 * pages/cameras/CamerasPage.tsx — Production-Ready Edge Camera Management
 * SmartVision IAD — Complete IoT Device Management Dashboard
 */
import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, RefreshCw, Maximize, WifiOff, Clock, Trash2, Video,
  MoreVertical, RotateCcw, MapPin, Edit3, Search, Cpu, MemoryStick,
  AlertTriangle, CheckCircle2, XCircle, Radio, Gauge
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDevices, unpairDevice, deleteDevice,
  assignSiteDevice, restartDevice, updateDevice,
} from '@/api/devices';
import type { Device as EdgeDevice } from '@/types';
import { getSites } from '@/api/sites';
import { useMqtt } from '@/mqtt/useMqtt';
import { MQTT_TOPICS } from '@/mqtt/mqtt.topics';

import type { Variants } from 'framer-motion';

// ─── Animation Variants ───────────────────────────────────────────────────────
const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatUptime(seconds: number): string {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return 'Never';
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 5) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function statusColor(status: string) {
  switch (status) {
    case 'ONLINE':  return { border: 'border-emerald-500/30', dot: 'bg-emerald-400', bar: 'bg-emerald-500/60' };
    case 'OFFLINE': return { border: 'border-slate-500/20',   dot: 'bg-slate-400',   bar: 'bg-slate-500/40' };
    case 'ERROR':   return { border: 'border-red-500/30',     dot: 'bg-red-400',     bar: 'bg-red-500/60' };
    case 'UNPAIRED':return { border: 'border-amber-500/25',   dot: 'bg-amber-400',   bar: 'bg-amber-500/50' };
    default:        return { border: 'border-slate-500/20',   dot: 'bg-slate-400',   bar: 'bg-slate-500/40' };
  }
}

// ─── Metric Mini Badge ────────────────────────────────────────────────────────
function MetricBadge({ label, value, unit = '', warn = false }: { label: string; value: number | null | undefined; unit?: string; warn?: boolean }) {
  const v = value ?? 0;
  const isHigh = warn && v > 80;
  return (
    <div className={`flex flex-col items-center py-1.5 px-2 rounded-lg border text-[10px] transition-colors ${isHigh ? 'bg-red-500/10 border-red-500/30' : 'bg-muted/30 border-border/20'}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold text-sm ${isHigh ? 'text-red-400' : 'text-foreground'}`}>{v.toFixed(0)}{unit}</span>
    </div>
  );
}

// ─── Camera Actions Dropdown ──────────────────────────────────────────────────
function CameraActionsMenu({
  onAssign, onRename, onRestart, onDelete, onUnpair,
}: {
  cam?: EdgeDevice;
  sites?: any[];
  onAssign: () => void;
  onRename: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onUnpair?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const actions = [
    { icon: Edit3,      label: 'Rename',           action: onRename,  show: true },
    { icon: MapPin,     label: 'Assign Site',       action: onAssign,  show: true },
    { icon: RotateCcw,  label: 'Restart Service',   action: onRestart, show: true },
    { icon: WifiOff,    label: 'Unassign',          action: onUnpair,  show: !!onUnpair },
    { icon: Trash2,     label: 'Delete Camera',     action: onDelete,  show: true, danger: true },
  ];

  return (
    <div className="relative">
      <button
        className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-8 z-50 w-44 bg-background border border-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden py-1"
            >
              {actions.filter(a => a.show).map(({ icon: Icon, label, action, danger }) => (
                <button
                  key={label}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-foreground hover:bg-muted/50'}`}
                  onClick={() => { action?.(); setOpen(false); }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Assign Site Modal ────────────────────────────────────────────────────────
function AssignSiteModal({
  sites, onClose, onConfirm, isPending,
}: {
  sites: any[];
  onClose: () => void;
  onConfirm: (siteId: string, zoneId: string) => void;
  isPending: boolean;
}) {
  const [siteId, setSiteId] = useState('');
  const [zone, setZone] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-background border border-border p-6 rounded-2xl w-full max-w-md space-y-5 shadow-2xl"
      >
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            Assign Camera to Site
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Link this camera to a site and zone for analytics tracking.</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Site</label>
            <select
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none appearance-none"
              value={siteId} onChange={e => setSiteId(e.target.value)}
            >
              <option value="" disabled>Select a site...</option>
              {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Zone (e.g. Entrance, Checkout)</label>
            <input
              type="text"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
              value={zone} onChange={e => setZone(e.target.value)}
              placeholder="Zone name..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onConfirm(siteId, zone)}
            disabled={!siteId || !zone || isPending}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            {isPending ? 'Assigning...' : 'Assign Camera'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────
function RenameModal({
  cam, onClose, onConfirm, isPending,
}: {
  cam: EdgeDevice;
  onClose: () => void;
  onConfirm: (name: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(cam.friendlyName || cam.hostname || '');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-background border border-border p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl"
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Edit3 className="h-5 w-5 text-blue-400" />
          Rename Camera
        </h3>
        <input
          type="text"
          autoFocus
          className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
        />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(name.trim())} disabled={!name.trim() || isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Camera Card (Unpaired) ───────────────────────────────────────────────────
function UnpairedCameraCard({ cam, onAssign, onDelete, onRename, sites }: {
  cam: EdgeDevice; onAssign: () => void; onDelete: () => void; onRename: () => void; sites: any[];
}) {
  const colors = statusColor('UNPAIRED');
  return (
    <motion.div variants={item} className={`glass-card flex flex-col gap-0 overflow-hidden border ${colors.border}`}>
      <div className={`h-0.5 w-full ${colors.bar}`} />
      <div className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{cam.friendlyName || cam.hostname || 'New Camera'}</h3>
            <p className="text-[11px] text-muted-foreground font-mono truncate">{cam.deviceId}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge status="UNPAIRED" size="sm" />
            <CameraActionsMenu
              cam={cam} sites={sites} onAssign={onAssign} onRename={onRename}
              onRestart={() => {}} onDelete={onDelete}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-muted/30 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">IP Address</span>
            <span className="font-mono">{cam.ip || '—'}</span>
          </div>
          <div className="bg-muted/30 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">Version</span>
            {cam.version || '—'}
          </div>
          <div className="bg-muted/30 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">Last Heartbeat</span>
            {timeAgo(cam.lastHeartbeat || cam.lastSeen)}
          </div>
          <div className="bg-muted/30 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">Platform</span>
            <span className="truncate block">{cam.platform?.split(' ')[0] || '—'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Discovered — awaiting site assignment</span>
        </div>

        <Button className="w-full mt-1 bg-blue-600 hover:bg-blue-500 text-white" onClick={onAssign}>
          <MapPin className="h-3.5 w-3.5 mr-1.5" />
          Assign to Site
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Camera Card (Online) ─────────────────────────────────────────────────────
function OnlineCameraCard({ cam, sites, onAssign, onRename, onRestart, onDelete, onUnpair }: {
  cam: EdgeDevice; sites: any[];
  onAssign: () => void; onRename: () => void; onRestart: () => void;
  onDelete: () => void; onUnpair: () => void;
}) {
  const colors = statusColor('ONLINE');
  const [imgError, setImgError] = useState(false);
  const snapshotUrl = cam.streamUrl || (cam.ip ? `http://${cam.ip}:8001/snapshot` : null);

  return (
    <motion.div variants={item} className={`glass-card overflow-hidden flex flex-col border ${colors.border}`}>
      <div className={`h-0.5 w-full ${colors.bar}`} />

      {/* Live Preview */}
      <div className="aspect-video bg-black/80 relative flex items-center justify-center overflow-hidden">
        {snapshotUrl && !imgError ? (
          <img
            src={`${snapshotUrl}?t=${Math.floor(Date.now() / 3000)}`}
            alt="Live Stream"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/20">
            <Video className="h-10 w-10" />
            <span className="text-[11px]">No Live Stream</span>
          </div>
        )}
        {/* LIVE badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-bold">LIVE</span>
        </div>
        {/* FPS overlay */}
        {cam.fps && (
          <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded-full border border-border/30">
            <span className="text-[10px] text-white/70">{cam.fps} FPS</span>
          </div>
        )}
        {/* MQTT indicator */}
        <div className={`absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] ${cam.mqttConnected ? 'bg-black/50 border-emerald-500/30 text-emerald-400' : 'bg-black/50 border-red-500/30 text-red-400'}`}>
          <Radio className="h-2.5 w-2.5" />
          {cam.mqttConnected ? 'MQTT' : 'No MQTT'}
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{cam.friendlyName || cam.hostname || 'Camera'}</h3>
            <p className="text-[11px] text-muted-foreground">
              {cam.site?.name ? `📍 ${cam.site.name}` : 'No site'}{cam.zoneId ? ` · ${cam.zoneId}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status="ONLINE" size="sm" />
            <CameraActionsMenu
              cam={cam} sites={sites} onAssign={onAssign} onRename={onRename}
              onRestart={onRestart} onDelete={onDelete} onUnpair={onUnpair}
            />
          </div>
        </div>

        {/* Telemetry grid */}
        <div className="grid grid-cols-4 gap-1.5">
          <MetricBadge label="CPU" value={cam.cpuUsage} unit="%" warn />
          <MetricBadge label="RAM" value={cam.memoryUsage} unit="%" warn />
          <MetricBadge label="FPS" value={cam.fps} />
          <div className="flex flex-col items-center py-1.5 px-1 rounded-lg border bg-muted/30 border-border/20 text-[10px]">
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-bold text-sm">{formatUptime(cam.uptime)}</span>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="bg-muted/20 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">IP</span>
            <span className="font-mono">{cam.ip || '—'}</span>
          </div>
          <div className="bg-muted/20 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">Model</span>
            <span>{cam.model || '—'}</span>
          </div>
          <div className="bg-muted/20 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">Last Heartbeat</span>
            <span>{timeAgo(cam.lastHeartbeat)}</span>
          </div>
          <div className="bg-muted/20 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">Connected Since</span>
            <span>{timeAgo(cam.connectedAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline" size="sm"
            className="flex-1 text-[11px] h-7 gap-1 hover:border-blue-500/40 hover:text-blue-400"
            onClick={() => snapshotUrl && window.open(snapshotUrl, '_blank')}
            disabled={!snapshotUrl}
          >
            <Maximize className="h-3 w-3" /> Stream
          </Button>
          <Button
            variant="outline" size="sm"
            className="flex-1 text-[11px] h-7 gap-1 hover:border-amber-500/40 hover:text-amber-400"
            onClick={onRestart}
          >
            <RotateCcw className="h-3 w-3" /> Restart
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Camera Card (Offline) ────────────────────────────────────────────────────
function OfflineCameraCard({ cam, sites, onAssign, onRename, onDelete }: {
  cam: EdgeDevice; sites: any[];
  onAssign: () => void; onRename: () => void; onDelete: () => void;
}) {
  const colors = statusColor('OFFLINE');

  return (
    <motion.div variants={item} className={`glass-card overflow-hidden flex flex-col border ${colors.border} opacity-70 hover:opacity-100 transition-opacity`}>
      <div className={`h-0.5 w-full ${colors.bar}`} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{cam.friendlyName || cam.hostname || 'Camera'}</h3>
            <p className="text-[11px] text-muted-foreground">{cam.site?.name || 'No site assigned'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge status="OFFLINE" size="sm" />
            <CameraActionsMenu
              cam={cam} sites={sites} onAssign={onAssign} onRename={onRename}
              onRestart={() => {}} onDelete={onDelete}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="bg-muted/20 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">IP</span>
            <span className="font-mono">{cam.ip || '—'}</span>
          </div>
          <div className="bg-muted/20 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">Version</span>
            {cam.version || '—'}
          </div>
          <div className="bg-muted/20 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">Last Heartbeat</span>
            <span>{timeAgo(cam.lastHeartbeat)}</span>
          </div>
          <div className="bg-muted/20 px-2.5 py-2 rounded-lg">
            <span className="text-muted-foreground block">Disconnected Since</span>
            <span>{timeAgo(cam.disconnectedAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400/80 bg-muted/20 px-2.5 py-2 rounded-lg">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Last seen: {timeAgo(cam.lastSeen)}</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            className="flex-1 text-[11px] h-7 gap-1"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 text-red-400" /> Delete
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Dashboard Stats Row ──────────────────────────────────────────────────────
function DashboardStats({ devices }: { devices: EdgeDevice[] }) {
  const total   = devices.length;
  const online  = devices.filter(d => d.status === 'ONLINE').length;
  const offline = devices.filter(d => d.status === 'OFFLINE' || d.status === 'ERROR').length;
  const unpaired = devices.filter(d => d.status === 'UNPAIRED').length;

  const onlineDevs = devices.filter(d => d.status === 'ONLINE');
  const avgFps = onlineDevs.length ? (onlineDevs.reduce((a, b) => a + (b.fps ?? 0), 0) / onlineDevs.length) : 0;
  const avgCpu = onlineDevs.length ? (onlineDevs.reduce((a, b) => a + (b.cpuUsage ?? 0), 0) / onlineDevs.length) : 0;
  const avgRam = onlineDevs.length ? (onlineDevs.reduce((a, b) => a + (b.memoryUsage ?? 0), 0) / onlineDevs.length) : 0;
  const mqttActive = devices.filter(d => d.mqttConnected).length;

  const stats = [
    { label: 'Total Cameras', value: total,          icon: Camera,       color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
    { label: 'Online',        value: online,          icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'Offline',       value: offline,         icon: XCircle,      color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20' },
    { label: 'Unassigned',    value: unpaired,        icon: AlertTriangle,color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
    { label: 'Avg FPS',       value: avgFps.toFixed(0), icon: Gauge,      color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
    { label: 'Avg CPU',       value: `${avgCpu.toFixed(0)}%`, icon: Cpu, color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
    { label: 'Avg RAM',       value: `${avgRam.toFixed(0)}%`, icon: MemoryStick, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
    { label: 'MQTT Active',   value: mqttActive,      icon: Radio,        color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {stats.map(({ label, value, icon: Icon, color, bg, border }) => (
        <motion.div
          key={label}
          variants={item}
          className={`glass-card p-3 flex flex-col items-center text-center border ${border} gap-1`}
        >
          <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
          <span className={`text-xl font-bold ${color}`}>{value}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function CamerasPage() {
  const queryClient = useQueryClient();
  const [assignModalCamId, setAssignModalCamId] = useState<string | null>(null);
  const [renameModalCam, setRenameModalCam] = useState<EdgeDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterSiteId, setFilterSiteId] = useState<string>('ALL');

  // ─── API Queries ────────────────────────────────────────────────────────────
  const { data: devicesRaw = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['devices', 'EDGE_CAMERA'],
    queryFn: () => getDevices({ type: 'EDGE_CAMERA' }),
    refetchInterval: 15_000,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: getSites,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['devices', 'EDGE_CAMERA'] });

  const assignMutation = useMutation({
    mutationFn: ({ id, siteId, zoneId }: { id: string; siteId: string; zoneId: string }) =>
      assignSiteDevice(id, { siteId, zoneId }),
    onSuccess: () => { invalidate(); setAssignModalCamId(null); },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateDevice(id, { name }),
    onSuccess: () => { invalidate(); setRenameModalCam(null); },
  });

  const unpairMutation = useMutation({
    mutationFn: (id: string) => unpairDevice(id),
    onSuccess: invalidate,
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) => restartDevice(id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDevice(id),
    onSuccess: invalidate,
  });

  // ─── Real-Time MQTT Updates ─────────────────────────────────────────────────
  // Listen to edge/discovery heartbeats and update camera state optimistically
  const [liveDevices, setLiveDevices] = useState<Record<string, Partial<EdgeDevice>>>({});

  const handleDiscoveryHeartbeat = useCallback((_topic: string, payload: any) => {
    const raw = payload as any;
    const deviceId = raw?.deviceId ?? raw?.payload?.deviceId;
    if (!deviceId) return;

    // Do not override status here, only update telemetry!
    setLiveDevices(prev => ({
      ...prev,
      [deviceId]: {
        ...prev[deviceId],
        cpuUsage: raw.cpuUsage ?? raw.payload?.cpuUsage,
        memoryUsage: raw.memoryUsage ?? raw.payload?.memoryUsage,
        fps: raw.fps ?? raw.payload?.fps,
        uptime: raw.uptime ?? raw.payload?.uptime,
        lastHeartbeat: new Date().toISOString(),
      },
    }));
  }, []);

  const handleDeviceStatus = useCallback((_topic: string, payload: any) => {
    const raw = payload as any;
    const deviceId = raw?.deviceId;
    if (!deviceId || raw.deviceType !== 'EDGE_CAMERA') return;

    setLiveDevices(prev => ({
      ...prev,
      [deviceId]: {
        ...prev[deviceId],
        status: raw.status,
        lastHeartbeat: raw.lastHeartbeat || new Date().toISOString(),
      },
    }));
    
    // Also invalidate to fetch full data (connectedAt, etc.)
    invalidate();
  }, [invalidate]);

  // Listen to telemetry heartbeats
  useMqtt(MQTT_TOPICS.EDGE.DISCOVERY, handleDiscoveryHeartbeat as any);
  useMqtt(MQTT_TOPICS.EDGE.HEARTBEAT, handleDiscoveryHeartbeat as any);
  
  // Listen to authoritative backend status changes
  useMqtt(MQTT_TOPICS.FRONTEND.DEVICE_STATUS, handleDeviceStatus as any);

  // Merge live MQTT data with REST data
  const devices: any[] = useMemo(() => {
    return devicesRaw.map((d: any) => ({
      ...d,
      friendlyName: d.name,
      cpuUsage: d.cameraMetadata?.cpuUsage,
      memoryUsage: d.cameraMetadata?.memoryUsage,
      fps: d.cameraMetadata?.fps,
      zoneId: d.cameraMetadata?.zoneId,
      model: d.cameraMetadata?.model,
      streamUrl: d.cameraMetadata?.streamUrl,
      ...(liveDevices[d.deviceId] || {}),
    }));
  }, [devicesRaw, liveDevices]);

  // ─── Filtering & Sorting ────────────────────────────────────────────────────
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q
        || (d.friendlyName || '').toLowerCase().includes(q)
        || (d.hostname || '').toLowerCase().includes(q)
        || d.deviceId.toLowerCase().includes(q)
        || (d.ip || '').includes(q);
      const matchStatus = filterStatus === 'ALL' || d.status === filterStatus;
      const matchSite = filterSiteId === 'ALL' || d.siteId === filterSiteId;
      return matchSearch && matchStatus && matchSite;
    });
  }, [devices, searchQuery, filterStatus, filterSiteId]);

  const unpaired = filteredDevices.filter(d => d.status === 'UNPAIRED');
  const online   = filteredDevices.filter(d => d.status === 'ONLINE');
  const offline  = filteredDevices.filter(d => d.status === 'OFFLINE' || d.status === 'ERROR');

  const assignModalCam = assignModalCamId ? devices.find(d => d.id === assignModalCamId) : null;

  return (
    <div className="p-6 md:p-8 max-w-screen-xl mx-auto space-y-8">
      <PageHeader
        title="Camera Management"
        description="Real-time IoT edge camera discovery, monitoring, and control"
        icon={Camera}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 hover:border-blue-500/40 hover:text-blue-400" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {isError ? (
        <ErrorState title="Unable to load cameras." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-8">

          {/* Dashboard Stats */}
          <DashboardStats devices={devices} />

          {/* Search & Filters */}
          <motion.div variants={item} className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, device ID, or IP..."
                className="w-full bg-muted/40 border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:border-blue-500 outline-none placeholder:text-muted-foreground/60"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="bg-muted/40 border border-border rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="UNPAIRED">Unassigned</option>
              <option value="ERROR">Error</option>
            </select>
            <select
              className="bg-muted/40 border border-border rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer"
              value={filterSiteId}
              onChange={e => setFilterSiteId(e.target.value)}
            >
              <option value="ALL">All Sites</option>
              {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {(searchQuery || filterStatus !== 'ALL' || filterSiteId !== 'ALL') && (
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1"
                onClick={() => { setSearchQuery(''); setFilterStatus('ALL'); setFilterSiteId('ALL'); }}>
                <XCircle className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </motion.div>

          {/* UNPAIRED / DISCOVERED */}
          {unpaired.length > 0 && (
            <motion.section variants={item} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h2 className="text-base font-semibold">Unassigned Cameras</h2>
                  <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">{unpaired.length}</span>
                </div>
                <span className="text-xs text-muted-foreground">Discovered automatically — assign to a site to start analytics</span>
              </div>
              <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {unpaired.map(cam => (
                  <UnpairedCameraCard
                    key={cam.id} cam={cam} sites={sites}
                    onAssign={() => setAssignModalCamId(cam.id)}
                    onDelete={() => deleteMutation.mutate(cam.id)}
                    onRename={() => setRenameModalCam(cam)}
                  />
                ))}
              </motion.div>
            </motion.section>
          )}

          {/* ONLINE */}
          <motion.section variants={item} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-base font-semibold">Online Cameras</h2>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full">{online.length}</span>
              </div>
            </div>
            {online.length === 0 ? (
              <EmptyState icon={Camera} title="No cameras online" description="Online cameras appear here with live telemetry." />
            ) : (
              <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {online.map(cam => (
                  <OnlineCameraCard
                    key={cam.id} cam={cam} sites={sites}
                    onAssign={() => setAssignModalCamId(cam.id)}
                    onRename={() => setRenameModalCam(cam)}
                    onRestart={() => restartMutation.mutate(cam.id)}
                    onDelete={() => deleteMutation.mutate(cam.id)}
                    onUnpair={() => unpairMutation.mutate(cam.id)}
                  />
                ))}
              </motion.div>
            )}
          </motion.section>

          {/* OFFLINE */}
          {offline.length > 0 && (
            <motion.section variants={item} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                  <h2 className="text-base font-semibold text-muted-foreground">Offline Cameras</h2>
                  <span className="bg-slate-500/20 text-slate-400 text-xs font-bold px-2 py-0.5 rounded-full">{offline.length}</span>
                </div>
              </div>
              <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {offline.map(cam => (
                  <OfflineCameraCard
                    key={cam.id} cam={cam} sites={sites}
                    onAssign={() => setAssignModalCamId(cam.id)}
                    onRename={() => setRenameModalCam(cam)}
                    onDelete={() => deleteMutation.mutate(cam.id)}
                  />
                ))}
              </motion.div>
            </motion.section>
          )}

          {/* Empty state when no devices at all */}
          {devices.length === 0 && (
            <EmptyState
              icon={Camera}
              title="No cameras discovered yet"
              description="Start Edge-CV with python3 apps/edge-cv/app/main.py — the camera will appear here automatically."
            />
          )}

        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {assignModalCamId && assignModalCam && (
          <AssignSiteModal
            key="assign"
            sites={sites}
            isPending={assignMutation.isPending}
            onClose={() => setAssignModalCamId(null)}
            onConfirm={(siteId, zoneId) => assignMutation.mutate({ id: assignModalCamId, siteId, zoneId })}
          />
        )}
        {renameModalCam && (
          <RenameModal
            key="rename"
            cam={renameModalCam}
            isPending={renameMutation.isPending}
            onClose={() => setRenameModalCam(null)}
            onConfirm={name => renameMutation.mutate({ id: renameModalCam.id, name })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
