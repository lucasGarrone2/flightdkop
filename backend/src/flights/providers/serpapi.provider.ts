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
      // Normalize date format to YYYY-MM-DD if user used slashes (e.g. 2027/03/30 or 30/03/2027)
      const cleanDate = this.formatToISO(params.departureDate);

      this.logger.log(`🔍 Consultando SerpApi Google Flights: ${params.origin} -> ${params.destination} (${cleanDate})`);

      const searchType = params.returnDate ? 1 : 2;

      const requestParams: any = {
        engine: 'google_flights',
        type: searchType,
        departure_id: params.origin,
        arrival_id: params.destination,
        outbound_date: cleanDate,
        adults: params.passengers || 1,
        currency: 'USD',
        hl: 'es',
        gl: 'ar',
        api_key: apiKey,
      };

      if (params.returnDate) {
        requestParams.return_date = this.formatToISO(params.returnDate);
      }

      const fetchPromise = new Promise((resolve, reject) => {
        try {
          getJson(requestParams, (data) => {
            if (data?.error) {
              const errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
              reject(new Error(errMsg));
            } else {
              resolve(data);
            }
          });
        } catch (err: any) {
          reject(err);
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de 8s excedido en SerpApi')), 8000),
      );

      const response: any = await Promise.race([fetchPromise, timeoutPromise]);

      const rawItineraries = [
        ...(response?.best_flights || []),
        ...(response?.other_flights || []),
      ];

      const offers: FlightOffer[] = rawItineraries.map((itinerary: any, index: number) =>
        this.normalizeFlight(itinerary, params, index),
      );

      if (params.maxStops !== undefined && params.maxStops !== null) {
        return offers.filter((offer) => offer.stops <= params.maxStops!);
      }

      return offers;
    } catch (error: any) {
      this.logger.error(`❌ Error consultando SerpApi (${params.origin} -> ${params.destination}): ${error.message}`);
      return [];
    }
  }

  private formatToISO(dateStr: string): string {
    if (!dateStr) return dateStr;
    // Replace slashes with dashes
    let formatted = dateStr.replace(/\//g, '-');
    // If format is DD-MM-YYYY, convert to YYYY-MM-DD
    const parts = formatted.split('-');
    if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
      formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return formatted;
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
    const googleFlightsUrl = `https://www.google.com/travel/flights?q=Vuelos%20de%20${params.origin}%20a%20${params.destination}%20el%20${params.departureDate}`;

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
      bookingUrl: googleFlightsUrl,
    };
  }

  private getMockOffers(params: SearchFlightsParams): FlightOffer[] {
    const googleFlightsUrl = `https://www.google.com/travel/flights?q=Vuelos%20de%20${params.origin}%20a%20${params.destination}%20el%20${params.departureDate}`;

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
        bookingUrl: googleFlightsUrl,
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
        ],
      },
    ];
  }
}
