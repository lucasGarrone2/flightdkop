import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getJson } from 'serpapi';
import { FlightProvider, SearchFlightsParams } from '../interfaces/flight-provider.interface';
import { FlightOffer, FlightSegment } from '../interfaces/flight-offer.interface';

@Injectable()
export class SerpApiProvider implements FlightProvider {
  readonly name = 'SERPAPI';
  private readonly logger = new Logger(SerpApiProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async searchFlights(params: SearchFlightsParams): Promise<FlightOffer[]> {
    const apiKey = this.configService.get<string>('SERPAPI_KEY');

    if (!apiKey || apiKey.trim() === '') {
      this.logger.warn('⚠️ SERPAPI_KEY no configurada en .env. Generando ofertas de prueba (Mock Mode).');
      return this.getMockOffers(params);
    }

    try {
      this.logger.log(`🔍 Consultando SerpApi Google Flights: ${params.origin} -> ${params.destination} (${params.departureDate})`);

      // Determine search type: 1 = Round trip, 2 = One way
      const searchType = params.returnDate ? 1 : 2;

      const requestParams: any = {
        engine: 'google_flights',
        type: searchType,
        departure_id: params.origin,
        arrival_id: params.destination,
        outbound_date: params.departureDate,
        adults: params.passengers || 1,
        currency: 'USD',
        hl: 'es',
        gl: 'ar',
        api_key: apiKey,
      };

      if (params.returnDate) {
        requestParams.return_date = params.returnDate;
      }

      const response: any = await new Promise((resolve, reject) => {
        getJson(requestParams, (data) => {
          if (data?.error) {
            reject(new Error(data.error));
          } else {
            resolve(data);
          }
        });
      });

      const rawItineraries = [
        ...(response.best_flights || []),
        ...(response.other_flights || []),
      ];

      const offers: FlightOffer[] = rawItineraries.map((itinerary: any, index: number) =>
        this.normalizeFlight(itinerary, params, index),
      );

      if (params.maxStops !== undefined && params.maxStops !== null) {
        return offers.filter((offer) => offer.stops <= params.maxStops!);
      }

      return offers;
    } catch (error: any) {
      this.logger.error(`❌ Error consultando SerpApi: ${error.message}`, error.stack);
      throw error;
    }
  }

  private normalizeFlight(itinerary: any, params: SearchFlightsParams, index: number): FlightOffer {
    const flightsList = itinerary.flights || [];
    const segments: FlightSegment[] = flightsList.map((f: any) => ({
      airline: f.airline || 'Desconocida',
      airlineLogo: f.airline_logo,
      flightNumber: f.flight_number || '',
      departureAirport: f.departure_airport?.id || f.departure_airport?.name || '',
      arrivalAirport: f.arrival_airport?.id || f.arrival_airport?.name || '',
      departureTime: f.departure_airport?.time || '',
      arrivalTime: f.arrival_airport?.time || '',
      duration: `${f.duration || 0}m`,
    }));

    const firstSegment: FlightSegment | undefined = segments[0];
    const lastSegment: FlightSegment | undefined = segments[segments.length - 1];

    const stops = Math.max(0, segments.length - 1);
    const price = itinerary.price || 0;
    const totalDurationMinutes = itinerary.total_duration || 0;
    const hours = Math.floor(totalDurationMinutes / 60);
    const mins = totalDurationMinutes % 60;
    const durationFormatted = `${hours}h ${mins}m`;

    const isSelfTransfer = Boolean(itinerary.self_transfer || itinerary.is_self_transfer);
    const mainAirline = firstSegment?.airline || 'Varios';

    return {
      id: `serpapi-${params.origin}-${params.destination}-${params.departureDate}-${index}`,
      provider: this.name,
      price,
      currency: 'USD',
      airline: mainAirline,
      airlineLogo: firstSegment?.airlineLogo,
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
      departureTime: firstSegment?.departureTime || '',
      arrivalDate: params.departureDate,
      arrivalTime: lastSegment?.arrivalTime || '',
      duration: durationFormatted,
      stops,
      segments,
      selfTransfer: isSelfTransfer,
      bookingUrl: 'https://www.google.com/travel/flights',
    };
  }

  private getMockOffers(params: SearchFlightsParams): FlightOffer[] {
    return [
      {
        id: `mock-1`,
        provider: 'MOCK_SERPAPI',
        price: 817,
        currency: 'USD',
        airline: 'Iberia',
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        departureTime: '13:05',
        arrivalDate: params.departureDate,
        arrivalTime: '09:30 (+1)',
        duration: '16h 25m',
        stops: 1,
        selfTransfer: false,
        bookingUrl: 'https://www.google.com/travel/flights',
        segments: [
          {
            airline: 'Iberia',
            flightNumber: 'IB 6844',
            departureAirport: params.origin,
            arrivalAirport: 'MAD',
            departureTime: '13:05',
            arrivalTime: '06:15',
            duration: '12h 10m',
          },
          {
            airline: 'Iberia Express',
            flightNumber: 'I2 3740',
            departureAirport: 'MAD',
            arrivalAirport: params.destination,
            departureTime: '08:45',
            arrivalTime: '09:30',
            duration: '3h 45m',
          },
        ],
      },
    ];
  }
}
