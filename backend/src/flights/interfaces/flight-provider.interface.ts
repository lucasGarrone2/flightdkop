import { FlightOffer } from './flight-offer.interface';

export interface SearchFlightsParams {
  origin: string; // IATA code e.g. "EZE"
  destination: string; // IATA code e.g. "CPH"
  departureDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD
  passengers?: number;
  maxStops?: number;
}

export interface FlightProvider {
  readonly name: string;
  searchFlights(params: SearchFlightsParams): Promise<FlightOffer[]>;
}
