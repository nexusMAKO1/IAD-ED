/**
 * pages/cameras/CamerasPage.tsx — Camera fleet monitoring
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Settings, RefreshCw, Maximize, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';

// Demo data removed; waiting for real camera API integration
const cameras: any[] = [];

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function CamerasPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" aria-hidden="true" />
            Camera Streams & Edge AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor real-time feeds and edge inference performance
          </p>
        </div>
        <Button variant="outline" className="gap-2 bg-card/50">
          <RefreshCw className="h-4 w-4" /> Rescan Network
        </Button>
      </motion.div>

      {cameras.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border/50 rounded-xl bg-secondary/5">
          <Camera className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No connected cameras</h3>
          <p className="text-sm text-muted-foreground mt-1">Waiting for Edge-CV nodes to register...</p>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cameras.map((cam) => (
            <motion.div key={cam.id} variants={item}>
              <Card className="glass-card overflow-hidden flex flex-col h-full">
                {/* Real video stream placeholder */}
                <div className="aspect-video bg-black/40 relative flex items-center justify-center border-b border-border">
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Camera className="h-12 w-12 text-white/10 mb-2" />
                    <span className="text-white/20 text-xs font-mono">No live stream available</span>
                  </div>
                  <div className="absolute top-3 left-3">
                    <StatusBadge status={cam.status} size="sm" />
                  </div>
                  <div className="absolute top-3 right-3 flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-white/50 hover:text-white hover:bg-white/10 rounded-full">
                      <Maximize className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-4 grid grid-cols-4 gap-4 flex-1">
                  <div className="col-span-4 flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{cam.name}</h3>
                    <span className="text-xs text-muted-foreground font-mono">{cam.id}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase">Latency</p>
                    <p className="text-sm font-medium">{cam.status === 'offline' ? '-' : `${cam.latency}ms`}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase">CPU</p>
                    <p className={`text-sm font-medium ${cam.cpu > 80 ? 'text-amber-400' : ''}`}>{cam.status === 'offline' ? '-' : `${cam.cpu}%`}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase">Temp</p>
                    <p className={`text-sm font-medium ${cam.temp > 70 ? 'text-red-400' : ''}`}>{cam.status === 'offline' ? '-' : `${cam.temp}°C`}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase">Memory</p>
                    <p className="text-sm font-medium">{cam.status === 'offline' ? '-' : '1.2GB'}</p>
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0 flex gap-2 border-t border-border/50 mt-auto">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-8">
                    <RefreshCw className="h-3 w-3" /> Restart
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-8">
                    <Activity className="h-3 w-3" /> Calibrate
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-8">
                    <Settings className="h-3 w-3" /> Config
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
