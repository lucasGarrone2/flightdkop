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
  score?: number;
  scoreBreakdown?: {
    priceScore: number;
    durationScore: number;
    stopsScore: number;
    protectionScore: number;
  };
  bookingUrl?: string;
}

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

export interface RouteAnalysis {
  cheapestPrice: number;
  averagePrice: number;
  highestPrice: number;
  dealRating: 'EXCELLENT_DEAL' | 'GOOD_DEAL' | 'AVERAGE' | 'HIGH_PRICE';
  dealLabel: string;
  bestOriginAirport: string;
  bestOriginCity: string;
  totalOffersAnalyzed: number;
  alternativeHubs: Array<{
    hubCode: string;
    offerCount: number;
    lowestPrice: number;
  }>;
}

export interface MultiFlightSearchResponse {
  bestOffer: FlightOffer | null;
  cheapestOffer: FlightOffer | null;
  fastestOffer: FlightOffer | null;
  dateSummaries: DatePriceSummary[];
  offers: FlightOffer[];
  analytics: RouteAnalysis;
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
