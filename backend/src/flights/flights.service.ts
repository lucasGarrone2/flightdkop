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
    const dateSummaries: DatePriceSummary[] = [];

    for (const date of dates) {
      let lowestPriceForDate = Infinity;
      let bestOfferForDate: FlightOffer | null = null;
      let flightCountForDate = 0;

      for (const origin of origins) {
        for (const destination of destinations) {
          totalQueries++;
          const cacheKey = `multi:${origin}:${destination}:${date}:${dto.passengers || 1}:${dto.maxStops ?? 'any'}`;
          let offers = this.cacheService.get(cacheKey);

          if (offers) {
            cachedHits++;
          } else {
            apiCalls++;
            offers = await this.serpApiProvider.searchFlights({
              origin,
              destination,
              departureDate: date,
              passengers: dto.passengers,
              maxStops: dto.maxStops,
            });
            this.cacheService.set(cacheKey, offers);
          }

          allOffers.push(...offers);
          flightCountForDate += offers.length;

          for (const offer of offers) {
            if (offer.price < lowestPriceForDate) {
              lowestPriceForDate = offer.price;
              bestOfferForDate = offer;
            }
          }
        }
      }

      if (bestOfferForDate && lowestPriceForDate !== Infinity) {
        dateSummaries.push({
          date,
          origin: bestOfferForDate.origin,
          destination: bestOfferForDate.destination,
          lowestPrice: lowestPriceForDate,
          flightCount: flightCountForDate,
          isBestPrice: false,
          bestOffer: bestOfferForDate,
        });
      }
    }

    // Sort all offers by price ascending
    allOffers.sort((a, b) => a.price - b.price);

    // Identify overall lowest price date
    let globalLowestPrice = Infinity;
    let bestGlobalOffer: FlightOffer | null = null;

    dateSummaries.forEach((summary) => {
      if (summary.lowestPrice < globalLowestPrice) {
        globalLowestPrice = summary.lowestPrice;
        bestGlobalOffer = summary.bestOffer;
      }
    });

    dateSummaries.forEach((summary) => {
      if (summary.lowestPrice === globalLowestPrice) {
        summary.isBestPrice = true;
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

    // Limit maximum date range to 14 days per query to prevent exhausting limits
    const maxDays = 14;
    let count = 0;

    while (current <= end && count < maxDays) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      count++;
    }

    return dates;
  }
}
