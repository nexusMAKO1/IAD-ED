/**
 * pages/settings/SettingsPage.tsx — Application Settings
 * SmartVision IAD Dashboard
 */

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Settings, Save, Bell, Shield, MonitorPlay, Database, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/api/settings';
import type { AppSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/types';

export function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<'general'|'mqtt'|'camera'|'age'|'tracking'|'notifications'>('general');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { register, handleSubmit, reset, control, formState: { isDirty } } = useForm<AppSettings>();

  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  const mutation = useMutation({
    mutationFn: (data: Partial<AppSettings>) => updateSettings(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
      reset(updated);
      toast({
        variant: 'success',
        title: 'Paramètres sauvegardés',
        description: 'Les paramètres de l\'application ont été mis à jour.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: getErrorMessage(error, 'Impossible de sauvegarder les paramètres.'),
      });
    },
  });

  const onSubmit = (data: AppSettings) => {
    mutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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
            Paramètres Système
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configuration globale : MQTT, caméras, dashboard et notifications.
          </p>
        </div>
        <Button 
          className="glow-primary gap-2" 
          onClick={handleSubmit(onSubmit)}
          disabled={!isDirty || mutation.isPending}
        >
          <Save className="h-4 w-4" /> 
          {mutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${activeTab === 'general' ? 'bg-secondary/50 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('general')}
          >
            <Settings className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${activeTab === 'mqtt' ? 'bg-secondary/50 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('mqtt')}
          >
            <Database className="h-4 w-4 mr-2" /> Broker MQTT
          </Button>
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${activeTab === 'camera' ? 'bg-secondary/50 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('camera')}
          >
            <MonitorPlay className="h-4 w-4 mr-2" /> Caméras Edge
          </Button>
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${activeTab === 'age' ? 'bg-secondary/50 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('age')}
          >
            <Activity className="h-4 w-4 mr-2" /> Démographie
          </Button>
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${activeTab === 'tracking' ? 'bg-secondary/50 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('tracking')}
          >
            <Shield className="h-4 w-4 mr-2" /> Tracking IA
          </Button>
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${activeTab === 'notifications' ? 'bg-secondary/50 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell className="h-4 w-4 mr-2" /> Notifications
          </Button>
        </div>

        <div className="md:col-span-3 space-y-6">
          <form id="settings-form" onSubmit={handleSubmit(onSubmit)}>
            
            {activeTab === 'general' && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">Dashboard</CardTitle>
                  <CardDescription>Paramètres généraux de l'interface utilisateur</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Taux de rafraîchissement (secondes)</label>
                    <input 
                      type="number" 
                      className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                      {...register('dashboard.refreshRate', { valueAsNumber: true })}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Mode sombre</label>
                      <p className="text-xs text-muted-foreground">Activer le thème sombre de l'application</p>
                    </div>
                    <Controller
                      name="dashboard.darkMode"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'mqtt' && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">Serveur MQTT</CardTitle>
                  <CardDescription>Configuration du broker Mosquitto pour le temps réel</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hôte (Host)</label>
                    <input 
                      type="text" 
                      className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                      {...register('mqtt.host')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Port TCP</label>
                      <input 
                        type="number" 
                        className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                        {...register('mqtt.port', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Port WebSocket</label>
                      <input 
                        type="number" 
                        className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                        {...register('mqtt.websocketPort', { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nom d'utilisateur</label>
                      <input 
                        type="text" 
                        className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                        {...register('mqtt.username')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mot de passe</label>
                      <input 
                        type="password" 
                        className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                        {...register('mqtt.password')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'camera' && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">Edge Inference (Caméras)</CardTitle>
                  <CardDescription>Performances cibles pour l'analyse Edge-CV</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Images par seconde (FPS)</label>
                    <input 
                      type="number" 
                      className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                      {...register('camera.fps', { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Seuil de confiance de détection (0 à 1)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="1"
                      className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                      {...register('camera.confidenceThreshold', { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Intervalle d'envoi MQTT (ms)</label>
                    <input 
                      type="number" 
                      className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                      {...register('camera.detectionInterval', { valueAsNumber: true })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'age' && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">Analyse Démographique</CardTitle>
                  <CardDescription>Configuration de l'estimation Âge/Genre</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Activer l'estimation</label>
                      <p className="text-xs text-muted-foreground">Exécute le modèle d'âge en plus de la détection</p>
                    </div>
                    <Controller
                      name="ageEstimation.enableAgeEstimator"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confiance minimale (0 à 1)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                      {...register('ageEstimation.minimumConfidence', { valueAsNumber: true })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'tracking' && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">Tracking IA (DeepSORT)</CardTitle>
                  <CardDescription>Suivi des individus dans le temps</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Activer le tracking multi-caméras</label>
                      <p className="text-xs text-muted-foreground">Permet de calculer le temps de séjour effectif</p>
                    </div>
                    <Controller
                      name="tracking.enableTracking"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Délai d'expiration du tracker (ms)</label>
                    <input 
                      type="number" 
                      className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                      {...register('tracking.trackerTimeout', { valueAsNumber: true })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-lg">Notifications</CardTitle>
                  <CardDescription>Canaux d'alerte pour les files d'attente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Alertes WebSocket (Dashboard)</label>
                      <p className="text-xs text-muted-foreground">Afficher des popups instantanés</p>
                    </div>
                    <Controller
                      name="notifications.websocket"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Alertes MQTT</label>
                      <p className="text-xs text-muted-foreground">Envoyer un signal sur un topic dédié</p>
                    </div>
                    <Controller
                      name="notifications.mqtt"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Emails</label>
                      <p className="text-xs text-muted-foreground">Envoyer un mail aux managers</p>
                    </div>
                    <Controller
                      name="notifications.email"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

          </form>
        </div>
      </div>
    </div>
  );
}
