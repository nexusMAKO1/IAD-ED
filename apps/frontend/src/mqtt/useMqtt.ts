/**
 * useMqtt.ts — React Hook for MQTT Subscriptions
 * Express Display SmartVision — T-021
 *
 * Provides a declarative way for React components to subscribe to MQTT topics.
 * Automatically handles subscribing on mount and unsubscribing on unmount.
 *
 * Usage:
 *   useMqtt(MQTT_TOPICS.EDGE.DETECTIONS, (topic, payload: DetectionPayload) => {
 *     console.log('Detection:', payload);
 *   });
 */

import { useEffect, useState } from 'react';
import { mqttClient } from './mqtt.client';
import type { BaseEvent, MqttHandler } from './mqtt.types';

/**
 * Hook to subscribe to an MQTT topic.
 *
 * @param topic The topic pattern to subscribe to (supports + and #)
 * @param handler Callback invoked when a message is received
 * @param enabled Optional boolean to pause/resume the subscription dynamically
 */
export function useMqtt<T extends BaseEvent = BaseEvent>(
  topic: string,
  handler: MqttHandler<T>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    
    // Subscribe and return the cleanup (unsubscribe) function
    return mqttClient.subscribe(topic, handler);
  }, [topic, handler, enabled]);
}

/**
 * Hook to get the current MQTT connection status reactively.
 * Useful for showing a connection indicator in the UI.
 */
export function useMqttConnectionStatus(): boolean {
  const [isConnected, setIsConnected] = useState(mqttClient.isConnected);

  useEffect(() => {
    return mqttClient.onConnectionChange((connected) => {
      setIsConnected(connected);
    });
  }, []);

  return isConnected;
}
