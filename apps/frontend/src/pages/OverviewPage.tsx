import { LayoutDashboard, TrendingUp, Users, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function OverviewPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          Vue d'ensemble
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivi de l'affluence et des performances opérationnelles de vos agences en temps réel.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Visiteurs Détectés</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,248</div>
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +12% vs hier
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Temps d'attente Moyen</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14 min</div>
            <p className="text-xs text-muted-foreground mt-1">
              Seuil critique à 15 min
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Écrans Connectés</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8 / 10</div>
            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              2 écrans hors ligne
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Campagnes Actives</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ciblage dynamique activé
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="border border-border p-6 rounded-xl bg-card/40 flex flex-col items-center justify-center text-center py-12">
        <LayoutDashboard className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <h3 className="text-lg font-semibold mb-1">Graphiques en cours de construction</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Les tableaux de bord analytiques et les courbes d'affluence prédictive (SmartQueue AI) seront intégrés dans le Sprint 3.
        </p>
      </div>
    </div>
  );
}
