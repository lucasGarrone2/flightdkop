export interface FlightSegment {
  airline: string;
  airlineLogo?: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
}

export interface FlightOffer {
  id: string;
  provider: string;
  price: number;
  currency: string;
  airline: string;
  airlineLogo?: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  segments: FlightSegment[];
  selfTransfer: boolean;
  bookingUrl?: string;
}

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

export interface MultiSearchParams {
  origins: string[];
  destinations: string[];
  startDate: string;
  endDate: string;
  passengers: number;
  maxStops?: number;
}
