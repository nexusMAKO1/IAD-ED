import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSiteThresholds } from '@/api/sites';
import type { Site, ApiValidationError } from '@/types';
import { extractFieldErrors, getErrorMessage } from '@/types';

interface ThresholdsCardProps {
  site: Site;
}

export function ThresholdsCard({ site }: ThresholdsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [density, setDensity] = React.useState(site.densityThreshold);
  const [anomaly, setAnomaly] = React.useState(site.anomalyQueueThreshold);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Sync state if site prop changes
  React.useEffect(() => {
    setDensity(site.densityThreshold);
    setAnomaly(site.anomalyQueueThreshold);
    setFieldErrors({});
  }, [site]);

  const mutation = useMutation({
    mutationFn: (variables: { density: number; anomaly: number }) =>
      updateSiteThresholds(site.id, {
        densityThreshold: variables.density,
        anomalyQueueThreshold: variables.anomaly,
      }),
    onSuccess: (updatedSite) => {
      // Invalidate the sites list so the selector updates
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setFieldErrors({});
      toast({
        variant: 'success',
        title: 'Seuils sauvegardés',
        description: `Les seuils pour le site ${updatedSite.name} ont été mis à jour.`,
      });
    },
    onError: (error: unknown) => {
      if (error && typeof error === 'object' && 'message' in error) {
        const errors = extractFieldErrors(error as ApiValidationError);
        setFieldErrors(errors);
      }
      toast({
        variant: 'destructive',
        title: 'Erreur de sauvegarde',
        description: getErrorMessage(error, 'Une erreur est survenue lors de la mise à jour des seuils.'),
      });
    },
  });

  const handleSave = () => {
    mutation.mutate({ density, anomaly });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Configuration des seuils</CardTitle>
        <CardDescription>
          Ajustez les seuils d'alerte et de déclenchement comportemental pour le site{' '}
          <span className="font-semibold text-primary">{site.name}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Density Threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="density-threshold" className="text-sm font-medium">
              Seuil de densité (personnes / zone)
            </Label>
            <span className="text-sm font-semibold text-primary">{density}</span>
          </div>
          <div className="flex gap-4 items-center">
            <Slider
              id="density-threshold-slider"
              min={1}
              max={100}
              step={1}
              value={[density]}
              onValueChange={(val) => {
                setDensity(val[0]);
                setFieldErrors((prev) => ({ ...prev, densityThreshold: '' }));
              }}
              className="flex-1"
            />
            <Input
              id="density-threshold"
              type="number"
              min={1}
              max={500}
              value={density}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setDensity(val);
                  setFieldErrors((prev) => ({ ...prev, densityThreshold: '' }));
                }
              }}
              error={fieldErrors.densityThreshold}
              className="w-20 text-right"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Déclenche le comportement adaptatif de l'IAD lorsque ce nombre de personnes est dépassé dans une zone.
          </p>
        </div>

        {/* Anomaly Threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="anomaly-threshold" className="text-sm font-medium">
              Seuil d'anomalie de file d'attente (minutes)
            </Label>
            <span className="text-sm font-semibold text-primary">{anomaly} min</span>
          </div>
          <div className="flex gap-4 items-center">
            <Slider
              id="anomaly-threshold-slider"
              min={1}
              max={120}
              step={1}
              value={[anomaly]}
              onValueChange={(val) => {
                setAnomaly(val[0]);
                setFieldErrors((prev) => ({ ...prev, anomalyQueueThreshold: '' }));
              }}
              className="flex-1"
            />
            <Input
              id="anomaly-threshold"
              type="number"
              min={1}
              max={1440}
              value={anomaly}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setAnomaly(val);
                  setFieldErrors((prev) => ({ ...prev, anomalyQueueThreshold: '' }));
                }
              }}
              error={fieldErrors.anomalyQueueThreshold}
              className="w-20 text-right"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Déclenche l'alerte d'anomalie SmartQueue F2.9 en cas d'écart de temps d'attente supérieur à cette valeur.
          </p>
        </div>

        {fieldErrors._general && (
          <p className="text-sm text-destructive font-medium animate-fade-in">
            {fieldErrors._general}
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="glow-primary font-medium"
          >
            {mutation.isPending ? 'Sauvegarde...' : 'Sauvegarder les seuils'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
