/**
 * hooks/useLiveDashboard.ts — Aggregated MQTT dashboard state
 * SmartVision IAD Dashboard
 *
 * Subscribes to all 4 SmartVision edge MQTT topics and merges them
 * into a single reactive state object. Uses useCallback to stabilise
 * handler references and prevent unnecessary resubscriptions.
 */

import { useCallback, useState } from 'react';
import { useMqtt } from '@/mqtt/useMqtt';
import { MQTT_TOPICS } from '@/mqtt/mqtt.topics';
import type {
  CrowdDensityPayload,
  TrackingPayload,
  PerformancePayload,
} from '@/mqtt/mqtt.types';

export interface LiveDashboardState {
  currentVisitors: number;
  crowdDensity: 'low' | 'medium' | 'high' | 'critical' | null;
  fps: number;
  cpuPercent: number;
  latencyMs: number;
  malePercent: number;
  femalePercent: number;
  lastUpdated: Date | null;
}

const INITIAL_STATE: LiveDashboardState = {
  currentVisitors: 0,
  crowdDensity: null,
  fps: 0,
  cpuPercent: 0,
  latencyMs: 0,
  malePercent: 50,
  femalePercent: 50,
  lastUpdated: null,
};

export function useLiveDashboard(siteId?: string): LiveDashboardState {
  const [state, setState] = useState<LiveDashboardState>(INITIAL_STATE);

  // Crowd density topic handler
  const handleDensity = useCallback(
    (_topic: string, payload: CrowdDensityPayload) => {
      if (siteId && payload.siteId !== siteId) return;
      setState((prev) => ({
        ...prev,
        crowdDensity: payload.payload?.density ?? prev.crowdDensity,
        currentVisitors: payload.payload?.count ?? prev.currentVisitors,
        lastUpdated: new Date(),
      }));
    },
    [siteId],
  );

  // Tracking topic handler
  const handleTracking = useCallback(
    (_topic: string, payload: TrackingPayload) => {
      if (siteId && payload.siteId !== siteId) return;
      setState((prev) => ({
        ...prev,
        currentVisitors: payload.payload?.activeCount ?? prev.currentVisitors,
        fps: payload.payload?.fps ?? prev.fps,
        lastUpdated: new Date(),
      }));
    },
    [siteId],
  );

  // Performance topic handler
  const handlePerformance = useCallback(
    (_topic: string, payload: PerformancePayload) => {
      if (siteId && payload.siteId !== siteId) return;
      setState((prev) => ({
        ...prev,
        fps: payload.payload?.fps ?? prev.fps,
        cpuPercent: payload.payload?.cpuPercent ?? prev.cpuPercent,
        latencyMs: payload.payload?.processingMsec ?? prev.latencyMs,
        lastUpdated: new Date(),
      }));
    },
    [siteId],
  );

  // Use local state for cumulative demographic counts
  const [demoCounts, setDemoCounts] = useState({ male: 1, female: 1 });

  // Demographics handler — parses individual events
  const handleDemographics = useCallback(
    (_topic: string, envelope: any) => {
      if (siteId && envelope.siteId !== siteId) return;
      const payload = envelope.payload || {};
      const gender = String(payload.gender || '').toLowerCase();
      
      setDemoCounts((prev) => {
        const next = { ...prev };
        if (gender === 'male') next.male++;
        else if (gender === 'female') next.female++;
        
        const total = next.male + next.female;
        const malePercent = Math.round((next.male / total) * 100);
        const femalePercent = 100 - malePercent;
        
        setState((s) => ({
          ...s,
          malePercent,
          femalePercent,
          lastUpdated: new Date(),
        }));
        
        return next;
      });
    },
    [siteId],
  );

  useMqtt(MQTT_TOPICS.EDGE.CROWD_DENSITY, handleDensity as never);
  useMqtt(MQTT_TOPICS.EDGE.TRACKING, handleTracking as never);
  useMqtt(MQTT_TOPICS.EDGE.PERFORMANCE, handlePerformance as never);
  useMqtt(MQTT_TOPICS.EDGE.DEMOGRAPHICS, handleDemographics as never);

  return state;
}
