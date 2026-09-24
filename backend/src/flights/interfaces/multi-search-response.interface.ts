import { FlightOffer } from './flight-offer.interface';

export interface DatePriceSummary {
  date: string;
  origin: string;
  destination: string;
  lowestPrice: number;
  fastestDuration: string;
  bestScore: number;
  flightCount: number;
  isBestPrice: boolean;
  isFastest: boolean;
  isBestValue: boolean;
  bestPriceOffer: FlightOffer;
  fastestOffer: FlightOffer;
  bestValueOffer: FlightOffer;
}

export interface MultiFlightSearchResponse {
  bestOffer: FlightOffer | null; // Overall best value offer
  cheapestOffer: FlightOffer | null;
  fastestOffer: FlightOffer | null;
  dateSummaries: DatePriceSummary[];
  offers: FlightOffer[];
  stats: {
    totalQueries: number;
    cachedHits: number;
    apiCalls: number;
  };
}
