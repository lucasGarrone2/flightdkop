import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RankedFlightOffer } from '../ranking/ranking.service';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveSearchHistory(
    origins: string[],
    destinations: string[],
    startDate: string,
    endDate: string,
    rankedOffers: RankedFlightOffer[],
  ): Promise<void> {
    try {
      const search = await this.prisma.flightSearch.create({
        data: {
          origins: origins.join(','),
          destinations: destinations.join(','),
          startDate,
          endDate,
          results: {
            create: rankedOffers.slice(0, 20).map((offer) => ({
              provider: offer.provider,
              price: offer.price,
              currency: offer.currency,
              airline: offer.airline,
              origin: offer.origin,
              destination: offer.destination,
              departureDate: offer.departureDate,
              departureTime: offer.departureTime,
              arrivalTime: offer.arrivalTime,
              duration: offer.duration,
              stops: offer.stops,
              isSelfTransfer: offer.selfTransfer,
              score: offer.score,
              bookingUrl: offer.bookingUrl,
            })),
          },
        },
      });

      this.logger.log(`💾 Histórico guardado exitosamente en DB (ID: ${search.id}) con ${rankedOffers.length} ofertas.`);
    } catch (err: any) {
      this.logger.error(`Error guardando histórico en DB: ${err.message}`);
    }
  }

  async getPriceTrend(origin: string, destination: string): Promise<{ lowestPriceHistorical: number; totalSearches: number }> {
    try {
      const results = await this.prisma.flightResult.findMany({
        where: { origin, destination },
        orderBy: { price: 'asc' },
        take: 1,
      });

      const count = await this.prisma.flightSearch.count();

      return {
        lowestPriceHistorical: results[0]?.price || 0,
        totalSearches: count,
      };
    } catch (err: any) {
      this.logger.error(`Error consultando tendencia histórica: ${err.message}`);
      return { lowestPriceHistorical: 0, totalSearches: 0 };
    }
  }
}
