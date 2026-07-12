/**
 * pages/heatmap/HeatmapPage.tsx — Heatmap Visualization
 * SmartVision IAD Dashboard
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Map, Download, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function HeatmapPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 flex flex-col h-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-6 shrink-0"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Map className="h-6 w-6 text-primary" aria-hidden="true" />
            Spatial Heatmap
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze visitor density and dwell times across floor plans
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 bg-card/50">
            <Calendar className="h-4 w-4" /> Last 24 Hours
          </Button>
          <Button variant="outline" className="gap-2 bg-card/50">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="flex-1 min-h-[500px]"
      >
        <Card className="glass h-full flex flex-col">
          <CardContent className="flex-1 p-0 relative overflow-hidden flex items-center justify-center bg-black/20 group">
            
            {/* Grid background for the heatmap canvas */}
            <div className="absolute inset-0" style={{
              backgroundImage: 'linear-gradient(to right, hsl(222 47% 18% / 0.3) 1px, transparent 1px), linear-gradient(to bottom, hsl(222 47% 18% / 0.3) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} />
            
            {/* Floorplan and Heatmap data would be rendered here in a canvas layer */}
            {/* Future Integration Placeholder Message */}
            <div className="relative z-10 glass-card p-6 text-center max-w-sm mx-auto shadow-2xl border-primary/20 bg-background/80 backdrop-blur-md">
              <Map className="h-10 w-10 text-primary mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">Interactive Heatmap</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The XY tracking coordinates API is currently being integrated. The real-time Canvas heatmap will be activated in the next deployment.
              </p>
              <Button disabled variant="outline" className="w-full">Integration Pending</Button>
            </div>
            
            <div className="absolute bottom-4 right-4 flex items-center gap-2 glass-card px-3 py-1.5 rounded-md">
              <span className="text-xs text-muted-foreground font-medium mr-2">Low</span>
              <div className="w-32 h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" />
              <span className="text-xs text-muted-foreground font-medium ml-2">High</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
