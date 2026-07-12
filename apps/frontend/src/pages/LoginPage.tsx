import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wifi, ShieldAlert, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { login } from '@/api/auth';
import { useAuth } from '@/store/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = React.useState('admin@expressdisplay.com');
  const [password, setPassword] = React.useState('admin123');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDemoLoading, setIsDemoLoading] = React.useState(false);
  const { setTokens } = useAuth();

  const handleLogin = async (e: React.FormEvent, isDemo = false) => {
    e.preventDefault();
    // Guard against double-submit before React re-renders
    if (isLoading || isDemoLoading) return;
    if (isDemo) setIsDemoLoading(true);
    else setIsLoading(true);

    try {
      const { accessToken, refreshToken } = await login({
        email: isDemo ? 'admin@expressdisplay.com' : email,
        password: isDemo ? 'admin123' : password,
      });

      setTokens(accessToken, refreshToken);

      toast({
        variant: 'success',
        title: 'Connexion réussie',
        description: 'Bienvenue sur la console Express Display.',
      });
      navigate('/dashboard/fleet');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Échec de connexion',
        description: error?.message || 'Identifiants invalides ou serveur indisponible.',
      });
    } finally {
      setIsLoading(false);
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative ambient backgrounds */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md glass relative z-10 animate-scale-in">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/30 glow-primary mb-2">
            <Wifi className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Express Display</CardTitle>
          <CardDescription>
            Connectez-vous pour accéder au gestionnaire de parc d'écrans & SmartQueue AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => handleLogin(e, false)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Adresse Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@expressdisplay.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
            <Button type="submit" className="w-full glow-primary" disabled={isLoading || isDemoLoading}>
              {isLoading ? 'Connexion en cours...' : 'Se connecter'}
            </Button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              Ou
            </span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          <Button
            variant="outline"
            className="w-full border-primary/30 hover:border-primary/50 text-primary hover:bg-primary/5 flex items-center justify-center gap-2"
            onClick={(e) => handleLogin(e, true)}
            disabled={isLoading || isDemoLoading}
          >
            <Sparkles className="h-4 w-4" />
            {isDemoLoading ? 'Connexion...' : 'Mode Démo (Connexion Automatique)'}
          </Button>

          <div className="flex items-start gap-2 bg-muted/30 border border-border p-3 rounded-lg text-xs text-muted-foreground mt-4">
            <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>
              Le mode démo se connecte automatiquement avec le compte administrateur par défaut provisionné via le script de seed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
