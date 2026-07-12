/**
 * pages/profile/ProfilePage.tsx — User Profile
 * SmartVision IAD Dashboard — wired to real auth API
 */

import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Key, LogOut, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/AuthContext';
import { useNavigate } from 'react-router-dom';
import { logout as apiLogout } from '@/api/auth';
import { useToast } from '@/hooks/use-toast';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
              <h2 className="text-xl font-bold">{user?.email?.split('@')[0] ?? 'Utilisateur'}</h2>
              <p className="text-sm text-muted-foreground mb-4">{user?.email ?? '—'}</p>
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
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> Identifiant
                </label>
                <input
                  type="text"
                  value={user?.id ?? ''}
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono text-xs"
                  disabled
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Adresse e-mail
                </label>
                <input
                  type="email"
                  value={user?.email ?? ''}
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">L'e-mail ne peut pas être modifié ici.</p>
              </div>
              {user?.siteId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Site associé</label>
                  <input
                    type="text"
                    value={user.siteId}
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm font-mono text-xs"
                    disabled
                    readOnly
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass border-amber-500/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-amber-400">
                <Key className="h-5 w-5" /> Sécurité
              </CardTitle>
              <CardDescription>Changement de mot de passe</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-sm text-amber-400 mb-4">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  L'endpoint <code className="font-mono text-xs">POST /api/v1/auth/change-password</code> n'est pas encore
                  implémenté côté backend. Consultez <code className="font-mono text-xs">TODO.md</code>.
                </span>
              </div>
              <Button variant="outline" className="gap-2 border-amber-500/20 text-amber-400 hover:bg-amber-500/10" disabled>
                Changer le mot de passe
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
