import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation } from '@tanstack/react-query';
import { assignSiteDevice } from '@/api/devices';
import { useToast } from '@/hooks/use-toast';
import { Link2 } from 'lucide-react';

interface PairDisplayModalProps {
  device: any;
  sites: any[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PairDisplayModal({ device, sites, isOpen, onClose, onSuccess }: PairDisplayModalProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const { toast } = useToast();

  const pairMutation = useMutation({
    mutationFn: () => assignSiteDevice(device.id, { siteId: selectedSiteId }),
    onSuccess: () => {
      toast({ title: 'Afficheur associé avec succès', variant: 'success' });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Erreur lors de l'association", variant: 'destructive' });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-border/50 text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-400" />
            Associer un afficheur
          </DialogTitle>
          <DialogDescription>
            Sélectionnez le site auquel vous souhaitez affecter l'afficheur <strong className="text-white">{device?.deviceId}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="site" className="text-muted-foreground">Site de déploiement</Label>
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger id="site" className="bg-slate-800/50 border-border/50">
                <SelectValue placeholder="Choisir un site..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-border/50 text-foreground">
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pairMutation.isPending}>
            Annuler
          </Button>
          <Button 
            onClick={() => pairMutation.mutate()} 
            disabled={!selectedSiteId || pairMutation.isPending}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            {pairMutation.isPending ? 'Association...' : 'Associer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
