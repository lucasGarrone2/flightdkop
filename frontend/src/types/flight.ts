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

export interface SearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  maxStops?: number;
}
