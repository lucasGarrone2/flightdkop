import { Injectable, Logger } from '@nestjs/common';
import { SerpApiProvider } from './providers/serpapi.provider';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { FlightOffer } from './interfaces/flight-offer.interface';

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(private readonly serpApiProvider: SerpApiProvider) {}

  async searchFlights(dto: SearchFlightsDto): Promise<FlightOffer[]> {
    this.logger.log(`Performing flight search: ${dto.origin} -> ${dto.destination} (${dto.departureDate})`);

    // In the future, we can aggregate results from multiple providers here (e.g., SerpApi, Duffel, Travelpayouts)
    const offers = await this.serpApiProvider.searchFlights({
      origin: dto.origin,
      destination: dto.destination,
      departureDate: dto.departureDate,
      returnDate: dto.returnDate,
      passengers: dto.passengers,
      maxStops: dto.maxStops,
    });

    // Default sorting: Price ASC
    return offers.sort((a, b) => a.price - b.price);
  }
}
