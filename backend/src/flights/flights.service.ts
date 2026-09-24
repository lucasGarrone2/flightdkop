import { Injectable, Logger } from '@nestjs/common';
import { SerpApiProvider } from './providers/serpapi.provider';
import { FlightsCacheService } from './cache/flights-cache.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { SearchMultiFlightsDto } from './dto/search-multi-flights.dto';
import { FlightOffer } from './interfaces/flight-offer.interface';
import { MultiFlightSearchResponse, DatePriceSummary } from './interfaces/multi-search-response.interface';

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(
    private readonly serpApiProvider: SerpApiProvider,
    private readonly cacheService: FlightsCacheService,
  ) {}

  async searchFlights(dto: SearchFlightsDto): Promise<FlightOffer[]> {
    const cacheKey = `single:${dto.origin}:${dto.destination}:${dto.departureDate}:${dto.passengers || 1}:${dto.maxStops ?? 'any'}`;
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const offers = await this.serpApiProvider.searchFlights({
      origin: dto.origin,
      destination: dto.destination,
      departureDate: dto.departureDate,
      returnDate: dto.returnDate,
      passengers: dto.passengers,
      maxStops: dto.maxStops,
    });

    const sorted = offers.sort((a, b) => a.price - b.price);
    this.cacheService.set(cacheKey, sorted);
    return sorted;
  }

  async searchMultiFlights(dto: SearchMultiFlightsDto): Promise<MultiFlightSearchResponse> {
    const dates = this.generateDateRange(dto.startDate, dto.endDate);
    const origins = dto.origins && dto.origins.length > 0 ? dto.origins : ['EZE'];
    const destinations = dto.destinations && dto.destinations.length > 0 ? dto.destinations : ['CPH'];

    this.logger.log(`MultiSearch: Orígenes=[${origins.join(',')}], Destinos=[${destinations.join(',')}], Fechas=[${dates.join(', ')}]`);

    let totalQueries = 0;
    let cachedHits = 0;
    let apiCalls = 0;
    const allOffers: FlightOffer[] = [];

    // Construct query tasks
    const queryTasks: Array<{
      origin: string;
      destination: string;
      date: string;
    }> = [];

    for (const date of dates) {
      for (const origin of origins) {
        for (const destination of destinations) {
          queryTasks.push({ origin, destination, date });
        }
      }
    }

    totalQueries = queryTasks.length;

    // Execute queries in parallel batches
    const queryResults = await Promise.all(
      queryTasks.map(async (task) => {
        const cacheKey = `multi:${task.origin}:${task.destination}:${task.date}:${dto.passengers || 1}:${dto.maxStops ?? 'any'}`;
        let offers = this.cacheService.get(cacheKey);

        if (offers) {
          cachedHits++;
          return { task, offers, isCached: true };
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
            this.logger.warn(`Failure fetching ${task.origin}->${task.destination} on ${task.date}: ${err.message}`);
            offers = [];
          }
          return { task, offers, isCached: false };
        }
      }),
    );

    // Aggregate date price summaries
    const dateSummariesMap = new Map<string, { lowestPrice: number; flightCount: number; bestOffer: FlightOffer | null }>();

    dates.forEach((date) => {
      dateSummariesMap.set(date, { lowestPrice: Infinity, flightCount: 0, bestOffer: null });
    });

    queryResults.forEach(({ task, offers }) => {
      allOffers.push(...offers);
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

    // Sort all offers by price ASC
    allOffers.sort((a, b) => a.price - b.price);

    // Identify global lowest price
    let globalLowestPrice = Infinity;
    let bestGlobalOffer: FlightOffer | null = null;

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
      bestOffer: bestGlobalOffer || allOffers[0] || null,
      dateSummaries,
      offers: allOffers,
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

    // Limit maximum date range to 7 days per batch to prevent API quota exhaustion
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
