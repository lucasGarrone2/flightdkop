import { Injectable } from '@nestjs/common';
import { FlightOffer } from '../interfaces/flight-offer.interface';

export interface RankedFlightOffer extends FlightOffer {
  score: number;
  scoreBreakdown: {
    priceScore: number;
    durationScore: number;
    stopsScore: number;
    protectionScore: number;
  };
}

@Injectable()
export class RankingService {
  rankOffers(offers: FlightOffer[]): RankedFlightOffer[] {
    if (!offers || offers.length === 0) {
      return [];
    }

    const minPrice = Math.min(...offers.map((o) => o.price));
    const minDurationMins = Math.min(...offers.map((o) => this.parseDurationMinutes(o.duration)));

    const ranked: RankedFlightOffer[] = offers.map((offer) => {
      const durationMins = this.parseDurationMinutes(offer.duration);

      // Price score: 50% weight (cheaper = higher)
      const priceDiffRatio = minPrice > 0 ? (offer.price - minPrice) / minPrice : 0;
      const priceScore = Math.max(0, Math.min(100, 100 - priceDiffRatio * 100));

      // Duration score: 25% weight (faster = higher)
      const durationDiffRatio = minDurationMins > 0 ? (durationMins - minDurationMins) / minDurationMins : 0;
      const durationScore = Math.max(0, Math.min(100, 100 - durationDiffRatio * 100));

      // Stops score: 15% weight (fewer stops = higher)
      let stopsScore = 100;
      if (offer.stops === 1) stopsScore = 70;
      else if (offer.stops >= 2) stopsScore = 40;

      // Protection score: 10% weight (protected = 100, self-transfer = 30)
      const protectionScore = offer.selfTransfer ? 30 : 100;

      // Final weighted score (0 - 100)
      const finalScore = Math.round(
        priceScore * 0.5 + durationScore * 0.25 + stopsScore * 0.15 + protectionScore * 0.1,
      );

      return {
        ...offer,
        score: finalScore,
        scoreBreakdown: {
          priceScore: Math.round(priceScore),
          durationScore: Math.round(durationScore),
          stopsScore,
          protectionScore,
        },
      };
    });

    return ranked;
  }

  private parseDurationMinutes(durationStr: string): number {
    const hoursMatch = durationStr.match(/(\d+)h/);
    const minsMatch = durationStr.match(/(\d+)m/);
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
    return hours * 60 + mins;
  }
}
