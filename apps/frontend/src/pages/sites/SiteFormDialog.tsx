import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createSite, updateSite } from '@/api/sites';
import { useToast } from '@/hooks/use-toast';
import type { Site } from '@/types';
import { getErrorMessage } from '@/types';

const siteSchema = z.object({
  name: z.string().min(2, 'Le nom doit faire au moins 2 caractères').max(100),
  address: z.string().min(5, 'L\'adresse doit faire au moins 5 caractères').max(200),
});

type SiteFormData = z.infer<typeof siteSchema>;

interface Props {
  site: Site | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SiteFormDialog({ site, isOpen, onOpenChange }: Props) {
  const isEditing = !!site;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: '',
      address: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (site) {
        reset({
          name: site.name,
          address: site.address,
        });
      } else {
        reset({
          name: '',
          address: '',
        });
      }
    }
  }, [isOpen, site, reset]);

  const mutation = useMutation({
    mutationFn: (data: SiteFormData) =>
      isEditing ? updateSite(site.id, data) : createSite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      toast({
        variant: 'success',
        title: isEditing ? 'Site mis à jour' : 'Site créé',
        description: `Le site a été ${isEditing ? 'modifié' : 'créé'} avec succès.`,
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: getErrorMessage(error, 'Une erreur est survenue lors de l\'enregistrement du site.'),
      });
    },
  });

  const onSubmit = (data: SiteFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {isEditing ? 'Modifier le site' : 'Ajouter un nouveau site'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifiez les informations générales de l\'agence.'
              : 'Créez une nouvelle agence pour y rattacher des dispositifs.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Nom du site <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              type="text"
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="Ex: Agence Paris Centre"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium">
              Adresse <span className="text-destructive">*</span>
            </label>
            <input
              id="address"
              type="text"
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="Ex: 10 Rue de la Paix, 75002 Paris"
              {...register('address')}
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address.message}</p>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
