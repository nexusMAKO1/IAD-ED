import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Site } from '@/types';

interface Props {
  site: Site | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
  errorMessage?: string | null;
}

export function DeleteSiteDialog({
  site,
  isOpen,
  onOpenChange,
  onConfirm,
  isDeleting,
  errorMessage,
}: Props) {
  if (!site) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Supprimer le site
          </DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir supprimer ce site ?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg flex gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Action irréversible</p>
              <p>
                Vous êtes sur le point de supprimer le site <strong>{site.name}</strong>.
              </p>
              <p className="mt-2 text-xs opacity-90">
                Note : Si des dispositifs sont encore rattachés à ce site, la
                suppression sera refusée par mesure de sécurité.
              </p>
            </div>
          </div>

          {/* Inline error message — shown when backend returns 409 or any error */}
          {errorMessage && (
            <div className="bg-orange-500/10 text-orange-400 border border-orange-500/30 p-3 rounded-lg flex gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
