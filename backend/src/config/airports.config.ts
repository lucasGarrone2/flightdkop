export interface AirportConfig {
  code: string;
  name: string;
  city: string;
  country: string;
}

export const DEFAULT_GENERAL_START_DATE = '2027-03-10';
export const DEFAULT_GENERAL_END_DATE = '2027-04-05';

export const ARGENTINA_AIRPORTS: AirportConfig[] = [
  { code: 'EZE', name: 'Ministro Pistarini (Ezeiza)', city: 'Buenos Aires', country: 'Argentina' },
  { code: 'AEP', name: 'Aeroparque Jorge Newbery', city: 'Buenos Aires', country: 'Argentina' },
  { code: 'COR', name: 'Ingeniero Aeronáutico Ambrosio Taravella', city: 'Córdoba', country: 'Argentina' },
  { code: 'MDZ', name: 'El Plumerillo', city: 'Mendoza', country: 'Argentina' },
  { code: 'ROS', name: 'Islas Malvinas', city: 'Rosario', country: 'Argentina' },
];

export const DENMARK_AIRPORTS: AirportConfig[] = [
  { code: 'CPH', name: 'Copenhague-Kastrup', city: 'Copenhague', country: 'Dinamarca' },
  { code: 'BLL', name: 'Billund Airport', city: 'Billund', country: 'Dinamarca' },
  { code: 'MMX', name: 'Malmö Airport (Cercano)', city: 'Malmö', country: 'Suecia' },
  { code: 'HAM', name: 'Hamburgo Airport (Cercano)', city: 'Hamburgo', country: 'Alemania' },
];

export const EUROPEAN_HUBS: AirportConfig[] = [
  { code: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', city: 'Madrid', country: 'España' },
  { code: 'BCN', name: 'Josep Tarradellas Barcelona-El Prat', city: 'Barcelona', country: 'España' },
  { code: 'LHR', name: 'London Heathrow', city: 'Londres', country: 'Reino Unido' },
  { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Alemania' },
  { code: 'FCO', name: 'Leonardo da Vinci-Fiumicino', city: 'Roma', country: 'Italia' },
];
