/**
 * campaign-scorer.ts — Pure Campaign Evaluation & Scoring Logic
 * Express Display SmartVision — Campaign Decision Engine
 *
 * Implements deterministic scoring and eligibility rules:
 *   - Priority weighting: 'high' (+10), 'standard' (+5), other (0)
 *   - Direct age match (campaign.targetAge): match (+20), mismatch (-10), 'all' (0)
 *   - JSON target audience (campaign.targetAudience.age_group): match (+15)
 *   - Schedule window validation (startDate, endDate, activeHours)
 *
 * Fully decoupled and unit-testable without database or MQTT dependencies.
 */

export interface CandidateCampaign {
  id: string;
  name: string;
  mediaUrl: string;
  mediaType: string;
  duration?: number | null;
  priority?: string | null;
  status?: string | null;
  active?: boolean;
  enabled?: boolean;
  targetAge?: string | null;
  targetAudience?: any;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  activeHours?: any;
}

export interface AgeDetectionSample {
  ts: number;
  ageGroup: string;
}

export const HYSTERESIS_BONUS = 2;

export class CampaignScorer {
  /**
   * Determine dominant demographic group from a sliding time window.
   */
  static calculateDominantAge(window: AgeDetectionSample[]): string | null {
    if (!window || window.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const sample of window) {
      if (!sample.ageGroup) continue;
      counts[sample.ageGroup] = (counts[sample.ageGroup] ?? 0) + 1;
    }
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Check if a campaign is eligible by status and date/time schedules.
   */
  static isCampaignEligible(campaign: CandidateCampaign, now: Date = new Date()): boolean {
    if (campaign.active === false || campaign.enabled === false) {
      return false;
    }
    if (campaign.status && campaign.status.toLowerCase() !== 'active') {
      return false;
    }

    const currentTs = now.getTime();

    // Date range verification
    if (campaign.startDate) {
      const start = new Date(campaign.startDate).getTime();
      if (!isNaN(start) && currentTs < start) {
        return false;
      }
    }

    if (campaign.endDate) {
      const end = new Date(campaign.endDate).getTime();
      if (!isNaN(end) && currentTs > end) {
        return false;
      }
    }

    // Active hours verification (if configured as [startHour, endHour] or { start, end })
    if (campaign.activeHours) {
      const currentHour = now.getHours();
      if (Array.isArray(campaign.activeHours) && campaign.activeHours.length === 2) {
        const [startH, endH] = campaign.activeHours;
        if (currentHour < startH || currentHour >= endH) {
          return false;
        }
      } else if (
        typeof campaign.activeHours === 'object' &&
        'start' in campaign.activeHours &&
        'end' in campaign.activeHours
      ) {
        const startH = parseInt(String(campaign.activeHours.start), 10);
        const endH = parseInt(String(campaign.activeHours.end), 10);
        if (!isNaN(startH) && !isNaN(endH)) {
          if (currentHour < startH || currentHour >= endH) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Score an eligible campaign against the observed dominant age group.
   *
   * Scoring weights:
   *   +10 for high priority
   *   +5  for standard priority
   *   +20 for exact targetAge match
   *   -10 for explicit targetAge mismatch (unless targetAge === 'all')
   *   +15 for matching targetAudience.age_group
   */
  static scoreCampaign(campaign: CandidateCampaign, dominantAgeGroup: string): number {
    let score = 0;

    // Priority bonus
    const priority = (campaign.priority ?? 'standard').toLowerCase();
    if (priority === 'high') {
      score += 10;
    } else if (priority === 'standard') {
      score += 5;
    }

    // Explicit targetAge matching
    const targetAge = campaign.targetAge ? campaign.targetAge.toLowerCase() : null;
    if (targetAge) {
      if (targetAge === dominantAgeGroup.toLowerCase()) {
        score += 20;
      } else if (targetAge !== 'all') {
        score -= 10;
      }
    }

    // Structured targetAudience matching
    const targetAudience = campaign.targetAudience;
    if (targetAudience && typeof targetAudience === 'object') {
      const audienceAge = (targetAudience.age_group || targetAudience.ageGroup || '')
        .toString()
        .toLowerCase();
      if (audienceAge === dominantAgeGroup.toLowerCase()) {
        score += 15;
      }
    }

    return score;
  }

  /**
   * Select best campaign from a list given current conditions.
   * Filters out ineligible campaigns, scores candidates, applies hysteresis for the currently playing campaign,
   * and picks the highest score.
   *
   * Hysteresis Rule:
   * When `currentCampaignId` matches an eligible candidate, that candidate receives a +2 hysteresis bonus.
   * This prevents screen oscillation between equally-scored campaigns (e.g. tie-breaking flapping)
   * while allowing genuinely higher-scoring campaigns (+5 priority, +15-20 targeting) to take over immediately.
   */
  static selectBestCampaign(
    campaigns: CandidateCampaign[],
    dominantAgeGroup: string,
    currentCampaignId: string | null = null,
    now: Date = new Date(),
  ): { campaign: CandidateCampaign | null; score: number } {
    let bestCampaign: CandidateCampaign | null = null;
    let highestScore = -Infinity;

    for (const campaign of campaigns) {
      if (!this.isCampaignEligible(campaign, now)) {
        continue;
      }

      let score = this.scoreCampaign(campaign, dominantAgeGroup);

      // Apply hysteresis sticky bonus to avoid flapping on ties
      if (currentCampaignId && campaign.id === currentCampaignId) {
        score += HYSTERESIS_BONUS;
      }

      if (score > highestScore) {
        highestScore = score;
        bestCampaign = campaign;
      }
    }

    return { campaign: bestCampaign, score: highestScore };
  }
}
