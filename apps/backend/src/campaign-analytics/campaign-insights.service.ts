/**
 * campaign-insights.service.ts — Rule-based AI insight text generator
 * IAD Campaign Performance Analytics
 *
 * Generates human-readable performance summaries and recommendations
 * based entirely on computed statistical data. No LLM required.
 */

import { Injectable } from '@nestjs/common';
import { PerformanceGrade } from './dto/campaign-analytics.dto';

export interface InsightInput {
  campaignName: string;
  performanceScore: number;
  engagementScore: number;
  grade: PerformanceGrade;
  impressions: number;
  reach: number;
  avgViewTimeSec: number;
  attentionRate: number;
  completionRate: number;
  avgAudience: number;
  peakHour: number | null;
  childCount: number;
  youngAdultCount: number;
  adultCount: number;
  seniorCount: number;
}

@Injectable()
export class CampaignInsightsService {
  generateInsightText(input: InsightInput): { text: string; recommendations: string[] } {
    const {
      campaignName, performanceScore, grade, impressions, reach,
      avgViewTimeSec, attentionRate, completionRate, avgAudience,
      peakHour, childCount, youngAdultCount, adultCount, seniorCount,
    } = input;

    // Determine dominant age group
    const ageCounts = { child: childCount, youngAdult: youngAdultCount, adult: adultCount, senior: seniorCount };
    const totalAge = Object.values(ageCounts).reduce((s, v) => s + v, 0);
    const dominantEntry = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0];
    const dominantAgeLabel = this.ageLabel(dominantEntry?.[0] ?? 'adult');
    const dominantPct = totalAge > 0
      ? Math.round((dominantEntry?.[1] ?? 0) / totalAge * 100)
      : 0;

    const gradeLabel = this.gradeLabel(grade);
    const peakHourLabel = peakHour !== null ? `${peakHour}h00` : 'non défini';

    const text =
      `La campagne "${campaignName}" a obtenu un score de ${performanceScore}/100 — ${gradeLabel}. ` +
      `Elle a généré ${impressions} diffusion${impressions > 1 ? 's' : ''} avec une portée de ${reach} visiteur${reach > 1 ? 's' : ''} unique${reach > 1 ? 's' : ''}. ` +
      `Les ${dominantAgeLabel} représentent ${dominantPct} % de l'audience. ` +
      (peakHour !== null
        ? `Le meilleur créneau est autour de ${peakHourLabel}. `
        : '') +
      `Le temps moyen de visionnage est de ${Math.round(avgViewTimeSec)} seconde${avgViewTimeSec >= 2 ? 's' : ''}. ` +
      `Le taux d'attention est de ${Math.round(attentionRate)} % et le taux de complétion est de ${Math.round(completionRate)} %.`;

    const recommendations = this.generateRecommendations(input);

    return { text, recommendations };
  }

  private generateRecommendations(input: InsightInput): string[] {
    const recs: string[] = [];
    const { attentionRate, completionRate, avgViewTimeSec, impressions, reach, peakHour, performanceScore } = input;

    if (attentionRate < 30) {
      recs.push('Augmenter l\'impact visuel des 5 premières secondes pour améliorer le taux d\'attention.');
    }
    if (completionRate < 40) {
      recs.push('Réduire la durée de la publicité ou dynamiser le contenu pour améliorer le taux de complétion.');
    }
    if (avgViewTimeSec < 5) {
      recs.push('Raccourcir le message clé : la majorité des visiteurs quittent avant 5 secondes.');
    }
    if (impressions > 0 && reach / impressions < 0.5) {
      recs.push('La portée est faible par rapport aux diffusions : diversifier les horaires pour toucher une audience plus large.');
    }
    if (peakHour !== null && performanceScore >= 70) {
      recs.push(`Augmenter la priorité de diffusion entre ${peakHour}h00 et ${peakHour + 1}h00 (créneau le plus performant).`);
    }
    if (performanceScore >= 85) {
      recs.push('Excellente performance ! Envisager d\'augmenter le budget et la fréquence de diffusion.');
    }
    if (impressions === 0) {
      recs.push('Aucune diffusion enregistrée. Vérifier le statut de la campagne et la connectivité des afficheurs.');
    }

    return recs;
  }

  private ageLabel(key: string): string {
    const map: Record<string, string> = {
      child: 'enfants',
      youngAdult: 'jeunes adultes',
      adult: 'adultes',
      senior: 'seniors',
    };
    return map[key] ?? 'visiteurs';
  }

  private gradeLabel(grade: PerformanceGrade): string {
    const map: Record<PerformanceGrade, string> = {
      EXCELLENT: 'Excellent',
      VERY_GOOD: 'Très bon',
      GOOD: 'Bon',
      AVERAGE: 'Moyen',
      WEAK: 'Faible',
    };
    return map[grade];
  }
}
