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

    queryResults.forEach(({ offers }) => {
      rawOffers.push(...offers);
    });

    // Rank all retrieved offers across dates
    const rankedOffers = this.rankingService.rankOffers(rawOffers);

    // Save history in DB
    this.historyService.saveSearchHistory(origins, destinations, dto.startDate, dto.endDate, rankedOffers);

    // Group by date
    const dateSummaries: DatePriceSummary[] = [];

    dates.forEach((date) => {
      const offersForDate = rankedOffers.filter((o) => o.departureDate === date);
      if (offersForDate.length > 0) {
        // Cheapest offer for date
        const cheapestOffer = [...offersForDate].sort((a, b) => a.price - b.price)[0];
        // Fastest offer for date
        const fastestOffer = [...offersForDate].sort(
          (a, b) => this.parseMins(a.duration) - this.parseMins(b.duration),
        )[0];
        // Best score (smart value) offer for date
        const bestValueOffer = [...offersForDate].sort((a, b) => b.score - a.score)[0];

        dateSummaries.push({
          date,
          origin: bestValueOffer.origin,
          destination: bestValueOffer.destination,
          lowestPrice: cheapestOffer.price,
          fastestDuration: fastestOffer.duration,
          bestScore: bestValueOffer.score,
          flightCount: offersForDate.length,
          isBestPrice: false,
          isFastest: false,
          isBestValue: false,
          bestPriceOffer: cheapestOffer,
          fastestOffer,
          bestValueOffer,
        });
      }
    });

    // Sort ranked offers by score DESC
    rankedOffers.sort((a, b) => b.score - a.score);

    let globalLowestPrice = Infinity;
    let globalFastestMins = Infinity;
    let globalBestScore = -1;

    dateSummaries.forEach((sum) => {
      if (sum.lowestPrice < globalLowestPrice) globalLowestPrice = sum.lowestPrice;
      const durMins = this.parseMins(sum.fastestDuration);
      if (durMins < globalFastestMins) globalFastestMins = durMins;
      if (sum.bestScore > globalBestScore) globalBestScore = sum.bestScore;
    });

    dateSummaries.forEach((sum) => {
      if (sum.lowestPrice === globalLowestPrice) sum.isBestPrice = true;
      if (this.parseMins(sum.fastestDuration) === globalFastestMins) sum.isFastest = true;
      if (sum.bestScore === globalBestScore) sum.isBestValue = true;
    });

    const cheapestOverall = [...rankedOffers].sort((a, b) => a.price - b.price)[0] || null;
    const fastestOverall = [...rankedOffers].sort((a, b) => this.parseMins(a.duration) - this.parseMins(b.duration))[0] || null;

    return {
      bestOffer: rankedOffers[0] || null,
      cheapestOffer: cheapestOverall,
      fastestOffer: fastestOverall,
      dateSummaries,
      offers: rankedOffers,
      stats: {
        totalQueries,
        cachedHits,
        apiCalls,
      },
    };
  }

  private parseMins(dur: string): number {
    const h = dur.match(/(\d+)h/);
    const m = dur.match(/(\d+)m/);
    return (h ? parseInt(h[1], 10) : 0) * 60 + (m ? parseInt(m[1], 10) : 0);
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
