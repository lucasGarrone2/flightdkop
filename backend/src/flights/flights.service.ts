import { Injectable, Logger } from '@nestjs/common';
import { SerpApiProvider } from './providers/serpapi.provider';
import { FlightsCacheService } from './cache/flights-cache.service';
import { RankingService, RankedFlightOffer } from './ranking/ranking.service';
import { HistoryService } from './history/history.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { SearchMultiFlightsDto } from './dto/search-multi-flights.dto';
import { MultiFlightSearchResponse, DatePriceSummary } from './interfaces/multi-search-response.interface';

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(
    private readonly serpApiProvider: SerpApiProvider,
    private readonly cacheService: FlightsCacheService,
    private readonly rankingService: RankingService,
    private readonly historyService: HistoryService,
  ) {}

  async searchFlights(dto: SearchFlightsDto): Promise<RankedFlightOffer[]> {
    const cacheKey = `single:${dto.origin}:${dto.destination}:${dto.departureDate}:${dto.passengers || 1}:${dto.maxStops ?? 'any'}`;
    let offers = this.cacheService.get(cacheKey);

    if (!offers) {
      offers = await this.serpApiProvider.searchFlights({
        origin: dto.origin,
        destination: dto.destination,
        departureDate: dto.departureDate,
        returnDate: dto.returnDate,
        passengers: dto.passengers,
        maxStops: dto.maxStops,
      });
      this.cacheService.set(cacheKey, offers);
    }

    const ranked = this.rankingService.rankOffers(offers);
    return ranked.sort((a, b) => b.score - a.score);
  }

  async searchMultiFlights(dto: SearchMultiFlightsDto): Promise<MultiFlightSearchResponse> {
    const dates = this.generateDateRange(dto.startDate, dto.endDate);
    const origins = dto.origins && dto.origins.length > 0 ? dto.origins : ['EZE'];
    const destinations = dto.destinations && dto.destinations.length > 0 ? dto.destinations : ['CPH'];

    this.logger.log(`MultiSearch: Orígenes=[${origins.join(',')}], Destinos=[${destinations.join(',')}], Fechas=[${dates.join(', ')}]`);

    let totalQueries = 0;
    let cachedHits = 0;
    let apiCalls = 0;
    const rawOffers: any[] = [];

    const queryTasks: Array<{ origin: string; destination: string; date: string }> = [];

    for (const date of dates) {
      for (const origin of origins) {
        for (const destination of destinations) {
          queryTasks.push({ origin, destination, date });
        }
      }
    }

    totalQueries = queryTasks.length;

    const queryResults = await Promise.all(
      queryTasks.map(async (task) => {
        const cacheKey = `multi:${task.origin}:${task.destination}:${task.date}:${dto.passengers || 1}:${dto.maxStops ?? 'any'}`;
        let offers = this.cacheService.get(cacheKey);

        if (offers) {
          cachedHits++;
          return { task, offers };
        } else {
          apiCalls++;
          try {
            offers = await this.serpApiProvider.searchFlights({
              origin: task.origin,
              destination: task.destination,
              departureDate: task.date,
              passengers: dto.passengers,
              maxStops: dto.maxStops,
            });
            this.cacheService.set(cacheKey, offers);
          } catch (err: any) {
            offers = [];
          }
          return { task, offers };
        }
      }),
    );

    const dateSummariesMap = new Map<string, { lowestPrice: number; flightCount: number; bestOffer: any | null }>();

    dates.forEach((date) => {
      dateSummariesMap.set(date, { lowestPrice: Infinity, flightCount: 0, bestOffer: null });
    });

    queryResults.forEach(({ task, offers }) => {
      rawOffers.push(...offers);
      const current = dateSummariesMap.get(task.date);

      if (current) {
        current.flightCount += offers.length;
        for (const offer of offers) {
          if (offer.price < current.lowestPrice) {
            current.lowestPrice = offer.price;
            current.bestOffer = offer;
          }
        }
      }
    });

    // Rank all retrieved offers using RankingService
    const rankedOffers = this.rankingService.rankOffers(rawOffers);

    // Save history asynchronously in DB
    this.historyService.saveSearchHistory(origins, destinations, dto.startDate, dto.endDate, rankedOffers);

    const dateSummaries: DatePriceSummary[] = [];
    dates.forEach((date) => {
      const summary = dateSummariesMap.get(date);
      if (summary && summary.bestOffer && summary.lowestPrice !== Infinity) {
        dateSummaries.push({
          date,
          origin: summary.bestOffer.origin,
          destination: summary.bestOffer.destination,
          lowestPrice: summary.lowestPrice,
          flightCount: summary.flightCount,
          isBestPrice: false,
          bestOffer: summary.bestOffer,
        });
      }
    });

    // Sort ranked offers by score descending (smartest value first)
    rankedOffers.sort((a, b) => b.score - a.score);

    // Identify global lowest price
    let globalLowestPrice = Infinity;
    let bestGlobalOffer: any | null = null;

    dateSummaries.forEach((sum) => {
      if (sum.lowestPrice < globalLowestPrice) {
        globalLowestPrice = sum.lowestPrice;
        bestGlobalOffer = sum.bestOffer;
      }
    });

    dateSummaries.forEach((sum) => {
      if (sum.lowestPrice === globalLowestPrice) {
        sum.isBestPrice = true;
      }
    });

    return {
      bestOffer: bestGlobalOffer || rankedOffers[0] || null,
      dateSummaries,
      offers: rankedOffers,
      stats: {
        totalQueries,
        cachedHits,
        apiCalls,
      },
    };
  }

  private generateDateRange(startDateStr: string, endDateStr: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');

    const maxDays = 7;
    let count = 0;

    while (current <= end && count < maxDays) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      count++;
    }

    return dates;
  }
}
