/**
 * mqtt.service.spec.ts — Unit Tests for MqttService
 * Express Display SmartVision — T-021
 *
 * All tests run without a real broker. The mqtt package is mocked so tests
 * are hermetic, fast, and CI-friendly.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MqttService, MqttMessageHandler } from './mqtt.service';
import { MqttConfigService } from './mqtt.config';
import { MQTT_TOPICS } from './mqtt.topics';

// ---------------------------------------------------------------------------
// Mock mqtt.connect
// ---------------------------------------------------------------------------
const mockPublish = jest.fn(
  (
    _topic: string,
    _payload: string,
    _opts: unknown,
    cb?: (err?: Error) => void,
  ) => {
    if (typeof cb === 'function') cb();
  },
);
const mockSubscribe = jest.fn(
  (_topic: string, _opts: unknown, cb?: (err?: Error | null) => void) => {
    if (typeof cb === 'function') cb(null);
  },
);
const mockUnsubscribe = jest.fn();
const mockEnd = jest.fn((_force: boolean, _opts: unknown, cb?: () => void) => {
  if (typeof cb === 'function') cb();
});

// Event listener registry to simulate broker events in tests
const eventListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
const mockOn = jest.fn(
  (event: string, listener: (...args: unknown[]) => void) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(listener);
  },
);

const mockMqttClient = {
  publish: mockPublish,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  end: mockEnd,
  on: mockOn,
};

jest.mock('mqtt', () => ({
  connect: jest.fn(() => mockMqttClient),
}));

// Helper to trigger broker events in tests
function emitBrokerEvent(event: string, ...args: unknown[]) {
  (eventListeners[event] ?? []).forEach((fn) => fn(...args));
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MqttService', () => {
  let service: MqttService;

  const mockConfig = {
    host: 'localhost',
    port: 1883,
    wsPort: 9001,
    username: 'test-user',
    password: 'test-pass',
    clientId: 'backend-test',
    keepalive: 60,
    tls: false,
    brokerUrl: 'mqtt://localhost:1883',
  };

  beforeEach(async () => {
    // Clear event listeners between tests
    Object.keys(eventListeners).forEach((k) => delete eventListeners[k]);
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MqttService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: MqttConfigService,
          useValue: { config: mockConfig },
        },
      ],
    }).compile();

    service = module.get<MqttService>(MqttService);

    // Simulate successful connect after onModuleInit
    await service.onModuleInit();
    emitBrokerEvent('connect');
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  // -------------------------------------------------------------------------
  // Connection
  // -------------------------------------------------------------------------

  describe('Connection', () => {
    it('should report isConnected=true after connect event', () => {
      expect(service.isConnected).toBe(true);
    });

    it('should report isConnected=false after disconnect event', () => {
      emitBrokerEvent('disconnect');
      expect(service.isConnected).toBe(false);
    });

    it('should report isConnected=false after offline event', () => {
      emitBrokerEvent('offline');
      expect(service.isConnected).toBe(false);
    });

    it('should log error on broker error event', () => {
      // Should not throw
      expect(() =>
        emitBrokerEvent('error', new Error('ECONNREFUSED')),
      ).not.toThrow();
    });

    it('should set isConnected=false on reconnect event', () => {
      emitBrokerEvent('reconnect');
      expect(service.isConnected).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  describe('subscribe()', () => {
    it('should register a handler and subscribe to broker when connected', () => {
      const handler: MqttMessageHandler = jest.fn();
      service.subscribe('smartvision/edge/detections', handler);

      expect(mockSubscribe).toHaveBeenCalledWith(
        'smartvision/edge/detections',
        expect.objectContaining({ qos: 1 }),
        expect.any(Function),
      );
    });

    it('should dispatch message to registered handler', () => {
      const handler = jest.fn();
      service.subscribe(MQTT_TOPICS.EDGE.DETECTIONS, handler);

      const payload = JSON.stringify({
        timestamp: new Date().toISOString(),
        deviceId: 'camera01',
        siteId: 'express-display',
        event: 'person_detected',
        payload: { personCount: 3 },
      });

      emitBrokerEvent(
        'message',
        MQTT_TOPICS.EDGE.DETECTIONS,
        Buffer.from(payload),
      );

      // Handler is called asynchronously via promise chain
      return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    it('should support wildcard + pattern matching', () => {
      const handler = jest.fn();
      service.subscribe('smartvision/edge/+', handler);

      const payload = JSON.stringify({
        timestamp: new Date().toISOString(),
        deviceId: 'cam1',
        siteId: 's1',
        event: 'test',
        payload: {},
      });

      emitBrokerEvent(
        'message',
        'smartvision/edge/detections',
        Buffer.from(payload),
      );

      return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
        expect(handler).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Publish
  // -------------------------------------------------------------------------

  describe('publish()', () => {
    it('should publish a JSON message when connected', () => {
      const result = service.publish(
        MQTT_TOPICS.BACKEND.EVENTS,
        { foo: 'bar' },
        1,
      );

      expect(result).toBe(true);
      expect(mockPublish).toHaveBeenCalledWith(
        MQTT_TOPICS.BACKEND.EVENTS,
        JSON.stringify({ foo: 'bar' }),
        expect.objectContaining({ qos: 1 }),
        expect.any(Function),
      );
    });

    it('should return false and not call publish when disconnected', () => {
      emitBrokerEvent('offline');
      const result = service.publish(MQTT_TOPICS.BACKEND.EVENTS, {}, 0);
      expect(result).toBe(false);
    });

    it('should publish queue update on BACKEND.QUEUE topic', () => {
      service.publishQueueUpdate({ waitTime: 5 });
      expect(mockPublish).toHaveBeenCalledWith(
        MQTT_TOPICS.BACKEND.QUEUE,
        expect.any(String),
        expect.objectContaining({ qos: 1 }),
        expect.any(Function),
      );
    });

    it('should publish alert with QoS 2', () => {
      service.publishAlert({ severity: 'critical', message: 'Queue overflow' });
      expect(mockPublish).toHaveBeenCalledWith(
        MQTT_TOPICS.BACKEND.ALERTS,
        expect.any(String),
        expect.objectContaining({ qos: 2 }),
        expect.any(Function),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Payload validation
  // -------------------------------------------------------------------------

  describe('Payload validation', () => {
    it('should reject malformed JSON', () => {
      const handler = jest.fn();
      service.subscribe(MQTT_TOPICS.EDGE.DETECTIONS, handler);

      emitBrokerEvent(
        'message',
        MQTT_TOPICS.EDGE.DETECTIONS,
        Buffer.from('not-json'),
      );

      return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
        expect(handler).not.toHaveBeenCalled();
      });
    });

    it('should reject messages missing required envelope fields', () => {
      const handler = jest.fn();
      service.subscribe(MQTT_TOPICS.EDGE.DETECTIONS, handler);

      // Missing deviceId and siteId
      const bad = JSON.stringify({ event: 'test', payload: {} });
      emitBrokerEvent('message', MQTT_TOPICS.EDGE.DETECTIONS, Buffer.from(bad));

      return new Promise((resolve) => setTimeout(resolve, 100)).then(() => {
        expect(handler).not.toHaveBeenCalled();
      });
    });

    it('should accept a valid envelope', () => {
      const handler = jest.fn();
      service.subscribe(MQTT_TOPICS.EDGE.DETECTIONS, handler);

      const valid = JSON.stringify({
        timestamp: new Date().toISOString(),
        deviceId: 'camera01',
        siteId: 'express-display',
        event: 'person_detected',
        payload: {},
      });

      emitBrokerEvent(
        'message',
        MQTT_TOPICS.EDGE.DETECTIONS,
        Buffer.from(valid),
      );

      return new Promise((resolve) => setTimeout(resolve, 100)).then(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  // -------------------------------------------------------------------------
  // QoS handling
  // -------------------------------------------------------------------------

  describe('QoS handling', () => {
    it('should use QoS 0 for telemetry (dashboard)', () => {
      service.publishDashboardEvent({ fps: 30 });
      expect(mockPublish).toHaveBeenCalledWith(
        MQTT_TOPICS.FRONTEND.DASHBOARD,
        expect.any(String),
        expect.objectContaining({ qos: 0 }),
        expect.any(Function),
      );
    });

    it('should use QoS 2 for restart commands', () => {
      service.sendRestartCommand('camera01');
      expect(mockPublish).toHaveBeenCalledWith(
        MQTT_TOPICS.COMMANDS.RESTART,
        expect.any(String),
        expect.objectContaining({ qos: 2 }),
        expect.any(Function),
      );
    });

    it('should use QoS 1 for config updates', () => {
      service.sendConfigUpdate({ confidence: 0.5 });
      expect(mockPublish).toHaveBeenCalledWith(
        MQTT_TOPICS.COMMANDS.CONFIG_UPDATE,
        expect.any(String),
        expect.objectContaining({ qos: 1 }),
        expect.any(Function),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Topic validation (wildcard matching)
  // -------------------------------------------------------------------------

  describe('Topic wildcard matching', () => {
    it('should match # wildcard at end of pattern', async () => {
      const handler = jest.fn();
      service.subscribe('smartvision/#', handler);

      const payload = JSON.stringify({
        timestamp: new Date().toISOString(),
        deviceId: 'cam',
        siteId: 's',
        event: 'e',
        payload: {},
      });

      emitBrokerEvent(
        'message',
        'smartvision/edge/detections',
        Buffer.from(payload),
      );

      await new Promise((r) => setTimeout(r, 50));
      expect(handler).toHaveBeenCalled();
    });

    it('should NOT match different root topic', async () => {
      const handler = jest.fn();
      service.subscribe('other/topic', handler);

      const payload = JSON.stringify({
        timestamp: new Date().toISOString(),
        deviceId: 'cam',
        siteId: 's',
        event: 'e',
        payload: {},
      });

      emitBrokerEvent(
        'message',
        'smartvision/edge/detections',
        Buffer.from(payload),
      );

      await new Promise((r) => setTimeout(r, 50));
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
