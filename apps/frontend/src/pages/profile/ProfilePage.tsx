/**
 * pages/profile/ProfilePage.tsx — User Profile
 * SmartVision IAD Dashboard — wired to real auth API
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Key, LogOut, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/AuthContext';
import { useNavigate } from 'react-router-dom';
import { logout as apiLogout, updateProfile, changePassword } from '@/api/auth';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { getErrorMessage } from '@/types';

export function ProfilePage() {
  const { user, logout, checkAuth } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { register: registerProfile, handleSubmit: handleSubmitProfile, reset: resetProfile, formState: { isDirty: isProfileDirty } } = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    }
  });

  const { register: registerPassword, handleSubmit: handleSubmitPassword, reset: resetPassword } = useForm({
    defaultValues: {
      oldPassword: '',
      newPassword: '',
    }
  });

  useEffect(() => {
    resetProfile({
      name: user?.name || '',
      email: user?.email || '',
    });
  }, [user, resetProfile]);

  const profileMutation = useMutation({
    mutationFn: (data: { name?: string; email?: string }) => updateProfile(data),
    onSuccess: async () => {
      await checkAuth();
      toast({
        variant: 'success',
        title: 'Profil mis à jour',
        description: 'Vos informations ont été enregistrées avec succès.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: getErrorMessage(error, 'Impossible de mettre à jour le profil.'),
      });
    }
  });

  const passwordMutation = useMutation({
    mutationFn: (data: any) => changePassword(data.oldPassword, data.newPassword),
    onSuccess: () => {
      resetPassword();
      toast({
        variant: 'success',
        title: 'Mot de passe modifié',
        description: 'Votre mot de passe a été mis à jour avec succès.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: getErrorMessage(error, 'L\'ancien mot de passe est incorrect ou une erreur est survenue.'),
      });
    }
  });

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // Backend logout is best-effort — clear local state regardless
    }
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-primary" aria-hidden="true" />
            Profil utilisateur
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos paramètres de compte et vos préférences
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-1">
          <Card className="glass h-full">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4 ring-2 ring-primary/40">
                <User className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-xl font-bold">{user?.name || user?.email?.split('@')[0] || 'Utilisateur'}</h2>
              <p className="text-sm text-muted-foreground mb-4">{user?.email || '—'}</p>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
                <Shield className="h-3.5 w-3.5" />
                {user?.role ?? 'Invité'}
              </div>

              <Button
                variant="outline"
                className="w-full gap-2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50 transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="md:col-span-2 space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitProfile((data) => profileMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" /> Nom complet
                  </label>
                  <input
                    type="text"
                    {...registerProfile('name')}
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" /> Adresse e-mail
                  </label>
                  <input
                    type="email"
                    {...registerProfile('email')}
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                {user?.siteId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Site associé</label>
                    <input
                      type="text"
                      value={user.siteId}
                      className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm font-mono text-xs text-muted-foreground"
                      disabled
                      readOnly
                    />
                  </div>
                )}
                <div className="pt-2">
                  <Button type="submit" disabled={!isProfileDirty || profileMutation.isPending} className="glow-primary">
                    <Save className="h-4 w-4 mr-2" />
                    {profileMutation.isPending ? 'Enregistrement...' : 'Mettre à jour le profil'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" /> Sécurité
              </CardTitle>
              <CardDescription>Changement de mot de passe</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitPassword((data) => passwordMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ancien mot de passe</label>
                  <input
                    type="password"
                    {...registerPassword('oldPassword', { required: true })}
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nouveau mot de passe</label>
                  <input
                    type="password"
                    {...registerPassword('newPassword', { required: true, minLength: 8 })}
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="••••••••"
                  />
                </div>
                <div className="pt-2">
                  <Button type="submit" variant="secondary" disabled={passwordMutation.isPending}>
                    {passwordMutation.isPending ? 'Modification...' : 'Changer le mot de passe'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
