import { FlightOffer } from './flight-offer.interface';

export interface DatePriceSummary {
  date: string;
  origin: string;
  destination: string;
  lowestPrice: number;
  flightCount: number;
  isBestPrice: boolean;
  bestOffer: FlightOffer;
}

export interface MultiFlightSearchResponse {
  bestOffer: FlightOffer | null;
  dateSummaries: DatePriceSummary[];
  offers: FlightOffer[];
  stats: {
    totalQueries: number;
    cachedHits: number;
    apiCalls: number;
  };
}
