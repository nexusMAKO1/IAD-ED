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
import { PageHeader } from '@/components/ui/PageHeader';

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
      <PageHeader
        title="Profil utilisateur"
        description="Gérez vos paramètres de compte et vos préférences"
        icon={User}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-1">
          <div className="glass-card p-6 h-full flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-[2rem] bg-blue-500/10 flex items-center justify-center mb-5 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/10">
              <User className="h-10 w-10 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold">{user?.name || user?.email?.split('@')[0] || 'Utilisateur'}</h2>
            <p className="text-sm text-muted-foreground mb-4">{user?.email || '—'}</p>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-8 border border-blue-500/20">
              <Shield className="h-3.5 w-3.5" />
              {user?.role ?? 'Invité'}
            </div>

            <Button
              variant="outline"
              className="w-full gap-2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all mt-auto"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="md:col-span-2 space-y-6">
          <div className="glass-card">
            <div className="p-5 border-b border-border/40">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Informations personnelles</h3>
            </div>
            <div className="p-5">
              <form onSubmit={handleSubmitProfile((data) => profileMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <User className="h-3.5 w-3.5" /> Nom complet
                  </label>
                  <input
                    type="text"
                    {...registerProfile('name')}
                    className="w-full bg-black/20 border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> Adresse e-mail
                  </label>
                  <input
                    type="email"
                    {...registerProfile('email')}
                    className="w-full bg-black/20 border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                {user?.siteId && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" /> Site associé
                    </label>
                    <input
                      type="text"
                      value={user.siteId}
                      className="w-full bg-black/10 border border-border/30 rounded-lg px-4 py-2.5 text-sm font-mono text-muted-foreground opacity-70"
                      disabled
                      readOnly
                    />
                  </div>
                )}
                <div className="pt-4">
                  <Button type="submit" disabled={!isProfileDirty || profileMutation.isPending} className="gradient-bg-blue border-0 text-white glow-primary font-medium">
                    <Save className="h-4 w-4 mr-2" />
                    {profileMutation.isPending ? 'Enregistrement…' : 'Mettre à jour le profil'}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          <div className="glass-card">
            <div className="p-5 border-b border-border/40">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Key className="h-4 w-4" /> Sécurité
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Changement de mot de passe</p>
            </div>
            <div className="p-5">
              <form onSubmit={handleSubmitPassword((data) => passwordMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ancien mot de passe</label>
                  <input
                    type="password"
                    {...registerPassword('oldPassword', { required: true })}
                    className="w-full bg-black/20 border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nouveau mot de passe</label>
                  <input
                    type="password"
                    {...registerPassword('newPassword', { required: true, minLength: 8 })}
                    className="w-full bg-black/20 border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="pt-4">
                  <Button type="submit" variant="outline" className="hover:border-blue-500/40 hover:text-blue-400" disabled={passwordMutation.isPending}>
                    {passwordMutation.isPending ? 'Modification…' : 'Changer le mot de passe'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
