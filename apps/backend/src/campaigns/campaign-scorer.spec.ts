import { CampaignScorer, CandidateCampaign } from './campaign-scorer';

describe('CampaignScorer', () => {
  describe('calculateDominantAge()', () => {
    it('returns null for empty window', () => {
      expect(CampaignScorer.calculateDominantAge([])).toBeNull();
    });

    it('determines the most frequent age group', () => {
      const window = [
        { ts: 1000, ageGroup: 'adult' },
        { ts: 1001, ageGroup: 'young' },
        { ts: 1002, ageGroup: 'adult' },
        { ts: 1003, ageGroup: 'senior' },
        { ts: 1004, ageGroup: 'adult' },
      ];
      expect(CampaignScorer.calculateDominantAge(window)).toBe('adult');
    });

    it('ignores invalid samples', () => {
      const window = [
        { ts: 1000, ageGroup: '' },
        { ts: 1001, ageGroup: 'senior' },
      ];
      expect(CampaignScorer.calculateDominantAge(window)).toBe('senior');
    });
  });

  describe('isCampaignEligible()', () => {
    const baseCampaign: CandidateCampaign = {
      id: 'c1',
      name: 'Summer Sale',
      mediaUrl: 'http://cdn/sale.mp4',
      mediaType: 'video',
      status: 'active',
      active: true,
      enabled: true,
    };

    it('returns true for an active enabled campaign with no schedule constraints', () => {
      expect(CampaignScorer.isCampaignEligible(baseCampaign)).toBe(true);
    });

    it('returns false when campaign is disabled or inactive', () => {
      expect(
        CampaignScorer.isCampaignEligible({ ...baseCampaign, active: false }),
      ).toBe(false);
      expect(
        CampaignScorer.isCampaignEligible({ ...baseCampaign, enabled: false }),
      ).toBe(false);
      expect(
        CampaignScorer.isCampaignEligible({ ...baseCampaign, status: 'paused' }),
      ).toBe(false);
    });

    it('validates startDate and endDate', () => {
      const now = new Date('2026-06-15T12:00:00Z');
      const future = new Date('2026-07-01T00:00:00Z');
      const past = new Date('2026-05-01T00:00:00Z');

      expect(
        CampaignScorer.isCampaignEligible(
          { ...baseCampaign, startDate: future },
          now,
        ),
      ).toBe(false);
      expect(
        CampaignScorer.isCampaignEligible(
          { ...baseCampaign, endDate: past },
          now,
        ),
      ).toBe(false);
      expect(
        CampaignScorer.isCampaignEligible(
          { ...baseCampaign, startDate: past, endDate: future },
          now,
        ),
      ).toBe(true);
    });

    it('validates active hours', () => {
      const morningTime = new Date('2026-06-15T09:00:00'); // 9 AM
      const eveningTime = new Date('2026-06-15T20:00:00'); // 8 PM

      const hourlyCampaign: CandidateCampaign = {
        ...baseCampaign,
        activeHours: { start: '8', end: '18' }, // 8h to 18h
      };

      expect(
        CampaignScorer.isCampaignEligible(hourlyCampaign, morningTime),
      ).toBe(true);
      expect(
        CampaignScorer.isCampaignEligible(hourlyCampaign, eveningTime),
      ).toBe(false);
    });
  });

  describe('scoreCampaign()', () => {
    it('applies priority bonuses correctly', () => {
      const high: CandidateCampaign = {
        id: '1',
        name: 'High',
        mediaUrl: 'http://cdn/1.mp4',
        mediaType: 'video',
        priority: 'high',
      };
      const standard: CandidateCampaign = {
        id: '2',
        name: 'Std',
        mediaUrl: 'http://cdn/2.mp4',
        mediaType: 'video',
        priority: 'standard',
      };

      expect(CampaignScorer.scoreCampaign(high, 'adult')).toBe(10);
      expect(CampaignScorer.scoreCampaign(standard, 'adult')).toBe(5);
    });

    it('rewards target age match and penalizes mismatch', () => {
      const targetYoung: CandidateCampaign = {
        id: '1',
        name: 'Young Ad',
        mediaUrl: 'http://cdn/1.mp4',
        mediaType: 'video',
        priority: 'standard', // +5
        targetAge: 'young',   // +20 if young, -10 if other
      };

      expect(CampaignScorer.scoreCampaign(targetYoung, 'young')).toBe(25);
      expect(CampaignScorer.scoreCampaign(targetYoung, 'senior')).toBe(-5);
    });

    it('rewards structured targetAudience.age_group (+15)', () => {
      const audienceCampaign: CandidateCampaign = {
        id: '1',
        name: 'Adult Ad',
        mediaUrl: 'http://cdn/1.mp4',
        mediaType: 'video',
        priority: 'standard', // +5
        targetAge: 'adult',   // +20
        targetAudience: { age_group: 'adult' }, // +15
      };

      expect(CampaignScorer.scoreCampaign(audienceCampaign, 'adult')).toBe(40);
    });
  });

  describe('selectBestCampaign()', () => {
    it('selects the campaign with the highest score', () => {
      const campaigns: CandidateCampaign[] = [
        {
          id: 'c1',
          name: 'General Ad',
          mediaUrl: 'http://cdn/gen.mp4',
          mediaType: 'video',
          priority: 'standard',
          targetAge: 'all',
          active: true,
          status: 'active',
        },
        {
          id: 'c2',
          name: 'Youth Fashion',
          mediaUrl: 'http://cdn/youth.mp4',
          mediaType: 'video',
          priority: 'high',
          targetAge: 'young',
          active: true,
          status: 'active',
        },
      ];

      const result = CampaignScorer.selectBestCampaign(campaigns, 'young');
      expect(result.campaign?.id).toBe('c2');
      expect(result.score).toBe(30); // 10 (high) + 20 (young match)
    });

    it('returns null campaign if all are ineligible', () => {
      const campaigns: CandidateCampaign[] = [
        {
          id: 'c1',
          name: 'Expired',
          mediaUrl: 'http://cdn/1.mp4',
          mediaType: 'video',
          active: false,
        },
      ];
      const result = CampaignScorer.selectBestCampaign(campaigns, 'adult');
      expect(result.campaign).toBeNull();
    });

    describe('hysteresis prevention', () => {
      const tiedCampaigns: CandidateCampaign[] = [
        {
          id: 'camp-A',
          name: 'Campaign A',
          mediaUrl: 'http://cdn/a.mp4',
          mediaType: 'video',
          priority: 'standard', // 5
          targetAge: 'adult',   // 20
          active: true,
          status: 'active',
        },
        {
          id: 'camp-B',
          name: 'Campaign B',
          mediaUrl: 'http://cdn/b.mp4',
          mediaType: 'video',
          priority: 'standard', // 5
          targetAge: 'adult',   // 20
          active: true,
          status: 'active',
        },
      ];

      it('favors currently playing campaign when scores are tied to prevent flapping', () => {
        // Without currentCampaignId, camp-A wins by order of iteration
        const resNone = CampaignScorer.selectBestCampaign(tiedCampaigns, 'adult', null);
        expect(resNone.campaign?.id).toBe('camp-A');
        expect(resNone.score).toBe(25);

        // With camp-B currently playing, camp-B receives +2 hysteresis bonus (score 27) and stays active
        const resB = CampaignScorer.selectBestCampaign(tiedCampaigns, 'adult', 'camp-B');
        expect(resB.campaign?.id).toBe('camp-B');
        expect(resB.score).toBe(27);
      });

      it('allows legitimate higher-scoring campaigns to take over despite hysteresis', () => {
        const higherCampaign: CandidateCampaign = {
          id: 'camp-C',
          name: 'High Priority Campaign C',
          mediaUrl: 'http://cdn/c.mp4',
          mediaType: 'video',
          priority: 'high',     // 10
          targetAge: 'adult',   // 20
          active: true,
          status: 'active',
        };

        const list = [...tiedCampaigns, higherCampaign];
        // camp-B is playing with score 25 + 2 = 27, but camp-C scores 30
        const result = CampaignScorer.selectBestCampaign(list, 'adult', 'camp-B');
        expect(result.campaign?.id).toBe('camp-C');
        expect(result.score).toBe(30);
      });

      it('does not apply hysteresis bonus if currently playing campaign has expired', () => {
        const expiredPlaying: CandidateCampaign = {
          id: 'camp-B',
          name: 'Campaign B Expired',
          mediaUrl: 'http://cdn/b.mp4',
          mediaType: 'video',
          active: false,
          status: 'active',
        };
        const candidate: CandidateCampaign = {
          id: 'camp-A',
          name: 'Campaign A',
          mediaUrl: 'http://cdn/a.mp4',
          mediaType: 'video',
          priority: 'standard',
          active: true,
          status: 'active',
        };

        const result = CampaignScorer.selectBestCampaign([expiredPlaying, candidate], 'adult', 'camp-B');
        expect(result.campaign?.id).toBe('camp-A');
      });
    });
  });
});
