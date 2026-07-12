/**
 * pages/settings/SettingsPage.tsx — Application Settings
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Bell, Shield, MonitorPlay, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function SettingsPage() {
  const [fps, setFps] = React.useState('30 FPS (Standard)');
  const [model, setModel] = React.useState('yolov8s-fp16 (Balanced)');

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" aria-hidden="true" />
            System Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure global thresholds, notifications, and application preferences
          </p>
        </div>
        <Button className="glow-primary gap-2">
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-1">
          <Button variant="ghost" className="w-full justify-start bg-secondary/50 text-foreground font-medium">
            <Settings className="h-4 w-4 mr-2 text-primary" /> General
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Bell className="h-4 w-4 mr-2" /> Notifications
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Shield className="h-4 w-4 mr-2" /> Security
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <MonitorPlay className="h-4 w-4 mr-2" /> Edge Inference
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Database className="h-4 w-4 mr-2" /> Data Retention
          </Button>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Global Thresholds</CardTitle>
              <CardDescription>Default values applied to new sites</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Density Threshold (Persons)</label>
                <input type="number" defaultValue={50} className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Queue Anomaly Time (Minutes)</label>
                <input type="number" defaultValue={15} className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Edge AI Defaults</CardTitle>
              <CardDescription>Target performance for camera nodes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target FPS</label>
                <select 
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  value={fps}
                  onChange={(e) => setFps(e.target.value)}
                >
                  <option>15 FPS (Resource saving)</option>
                  <option>30 FPS (Standard)</option>
                  <option>60 FPS (High performance)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">YOLO Model Version</label>
                <select 
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option>yolov8n-int8 (Fastest)</option>
                  <option>yolov8s-fp16 (Balanced)</option>
                  <option>yolov8m (High accuracy)</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
