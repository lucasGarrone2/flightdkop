export interface AirportConfig {
  code: string;
  name: string;
  city: string;
  country: string;
}

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
