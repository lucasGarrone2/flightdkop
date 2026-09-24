import { Injectable } from '@nestjs/common';
import { FlightOffer } from '../interfaces/flight-offer.interface';

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

@Injectable()
export class AnalyticsService {
  analyzeOffers(offers: FlightOffer[], historicalMinPrice?: number): RouteAnalysis {
    if (!offers || offers.length === 0) {
      return {
        cheapestPrice: 0,
        averagePrice: 0,
        highestPrice: 0,
        dealRating: 'AVERAGE',
        dealLabel: 'Sin datos suficientes',
        bestOriginAirport: 'EZE',
        bestOriginCity: 'Buenos Aires',
        totalOffersAnalyzed: 0,
        alternativeHubs: [],
      };
    }

    const prices = offers.map((o) => o.price);
    const cheapestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const averagePrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);

    // Determine deal rating vs average or historical minimum
    let dealRating: 'EXCELLENT_DEAL' | 'GOOD_DEAL' | 'AVERAGE' | 'HIGH_PRICE' = 'AVERAGE';
    let dealLabel = 'Precio dentro del rango habitual';

    const baselinePrice = historicalMinPrice && historicalMinPrice > 0 ? Math.min(averagePrice, historicalMinPrice) : averagePrice;

    if (cheapestPrice <= baselinePrice * 0.85) {
      dealRating = 'EXCELLENT_DEAL';
      dealLabel = `🔥 ¡Gran Oportunidad! USD $${cheapestPrice} está un ${Math.round(((averagePrice - cheapestPrice) / averagePrice) * 100)}% por debajo del promedio.`;
    } else if (cheapestPrice <= baselinePrice * 0.95) {
      dealRating = 'GOOD_DEAL';
      dealLabel = `🟢 Buen precio: USD $${cheapestPrice} (menor al promedio de $${averagePrice}).`;
    } else if (cheapestPrice >= averagePrice * 1.15) {
      dealRating = 'HIGH_PRICE';
      dealLabel = `⚠️ Tarifas elevadas respecto al promedio ($${averagePrice} USD).`;
    }

    // Determine best origin airport in Argentina
    const originStats = new Map<string, number[]>();
    offers.forEach((o) => {
      const existing = originStats.get(o.origin) || [];
      existing.push(o.price);
      originStats.set(o.origin, existing);
    });

    let bestOriginAirport = 'EZE';
    let lowestOriginAvg = Infinity;

    originStats.forEach((priceList, airportCode) => {
      const avg = priceList.reduce((a, b) => a + b, 0) / priceList.length;
      if (avg < lowestOriginAvg) {
        lowestOriginAvg = avg;
        bestOriginAirport = airportCode;
      }
    });

    const airportCityMap: Record<string, string> = {
      EZE: 'Ezeiza (BsAs)',
      AEP: 'Aeroparque (BsAs)',
      COR: 'Córdoba',
      MDZ: 'Mendoza',
      ROS: 'Rosario',
    };

    // Analyze European hubs
    const hubMap = new Map<string, { count: number; lowest: number }>();
    offers.forEach((offer) => {
      offer.segments.forEach((seg) => {
        const hub = seg.arrivalAirport;
        if (['MAD', 'BCN', 'LHR', 'FRA', 'FCO', 'AMS', 'LIS'].includes(hub)) {
          const current = hubMap.get(hub) || { count: 0, lowest: Infinity };
          current.count++;
          if (offer.price < current.lowest) current.lowest = offer.price;
          hubMap.set(hub, current);
        }
      });
    });

    const alternativeHubs: Array<{ hubCode: string; offerCount: number; lowestPrice: number }> = [];
    hubMap.forEach((val, hubCode) => {
      alternativeHubs.push({
        hubCode,
        offerCount: val.count,
        lowestPrice: val.lowest === Infinity ? 0 : val.lowest,
      });
    });
    alternativeHubs.sort((a, b) => a.lowestPrice - b.lowestPrice);

    return {
      cheapestPrice,
      averagePrice,
      highestPrice,
      dealRating,
      dealLabel,
      bestOriginAirport,
      bestOriginCity: airportCityMap[bestOriginAirport] || bestOriginAirport,
      totalOffersAnalyzed: offers.length,
      alternativeHubs,
    };
  }
}
