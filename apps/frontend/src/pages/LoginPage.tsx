/**
 * pages/LoginPage.tsx — Premium split-screen login
 * IAD SmartVision Dashboard — Blue/Cyan enterprise theme
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Radio, ShieldAlert, Sparkles, BarChart3, Users, Camera, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { login } from '@/api/auth';
import { useAuth } from '@/store/AuthContext';

const features = [
  { icon: BarChart3, text: 'Analytique d\'audience en temps réel' },
  { icon: Users, text: 'Détection démographique par IA' },
  { icon: Camera, text: 'Supervision multi-sites & caméras' },
  { icon: Zap, text: 'Alertes MQTT instantanées' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = React.useState('admin@expressdisplay.com');
  const [password, setPassword] = React.useState('Admin1234!');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDemoLoading, setIsDemoLoading] = React.useState(false);
  const { setTokens } = useAuth();

  const handleLogin = async (e: React.FormEvent, isDemo = false) => {
    e.preventDefault();
    if (isLoading || isDemoLoading) return;
    if (isDemo) setIsDemoLoading(true);
    else setIsLoading(true);

    try {
      const { accessToken, refreshToken } = await login({
        email: isDemo ? 'admin@expressdisplay.com' : email,
        password: isDemo ? 'Admin1234!' : password,
      });
      setTokens(accessToken, refreshToken);
      toast({ variant: 'success', title: 'Connexion réussie', description: 'Bienvenue sur SmartVision IAD.' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Échec de connexion',
        description: error?.response?.data?.message || error?.message || 'Identifiants invalides.',
      });
    } finally {
      setIsLoading(false);
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background overflow-hidden">
      {/* ── Left panel: brand ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(145deg, hsl(221 83% 18%) 0%, hsl(215 28% 9%) 50%, hsl(189 94% 12%) 100%)',
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(hsl(210 40% 98%) 1px, transparent 1px), linear-gradient(90deg, hsl(210 40% 98%) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow orbs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(221 83% 53%), transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(189 94% 43%), transparent 70%)' }} />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-bg-blue shadow-lg shadow-blue-500/30">
              <Radio className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-white">SmartVision IAD</p>
              <p className="text-xs text-blue-300/70">Express Display v1.0</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-3">
              Intelligent Audience<br />
              <span className="gradient-text-blue">Detection Platform</span>
            </h2>
            <p className="text-sm text-blue-200/60 max-w-sm leading-relaxed">
              Analysez votre audience en temps réel, gérez votre parc d'affichage et optimisez vos campagnes grâce à l'IA.
            </p>
          </div>

          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/20">
                  <Icon className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <span className="text-sm text-blue-200/70">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs text-blue-300/50">Système opérationnel</span>
        </div>
      </div>

      {/* ── Right panel: login form ───────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 relative">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(221 83% 53%), transparent)' }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm relative z-10"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg-blue">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-foreground">SmartVision IAD</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-1.5">Connexion</h1>
            <p className="text-sm text-muted-foreground">Entrez vos identifiants pour accéder au tableau de bord.</p>
          </div>

          <form onSubmit={(e) => handleLogin(e, false)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Adresse Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@expressdisplay.com"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="h-10"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 gradient-bg-blue border-0 font-semibold glow-primary text-white"
              disabled={isLoading || isDemoLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Connexion…
                </span>
              ) : 'Se connecter'}
            </Button>
          </form>

          <div className="relative flex items-center my-5">
            <div className="flex-grow border-t border-border/40" />
            <span className="mx-4 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">ou</span>
            <div className="flex-grow border-t border-border/40" />
          </div>

          <Button
            variant="outline"
            className="w-full h-10 border-blue-500/25 hover:border-blue-500/50 text-blue-400 hover:bg-blue-500/8 gap-2"
            onClick={(e) => handleLogin(e, true)}
            disabled={isLoading || isDemoLoading}
          >
            <Sparkles className="h-4 w-4" />
            {isDemoLoading ? 'Connexion…' : 'Mode Démo'}
          </Button>

          <div className="flex items-start gap-2.5 mt-6 p-3 rounded-xl bg-blue-500/6 border border-blue-500/15 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
            <p>Le mode démo utilise le compte admin par défaut provisionné via le script de seed.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
