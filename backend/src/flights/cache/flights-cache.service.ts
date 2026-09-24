import { Injectable, Logger } from '@nestjs/common';
import { FlightOffer } from '../interfaces/flight-offer.interface';

interface CacheEntry {
  data: FlightOffer[];
  timestamp: number;
}

@Injectable()
export class FlightsCacheService {
  private readonly logger = new Logger(FlightsCacheService.name);
  private cache = new Map<string, CacheEntry>();
  // Default TTL: 6 hours (in milliseconds)
  private readonly ttlMs = 6 * 60 * 60 * 1000;

  get(key: string): FlightOffer[] | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.logger.log(`⏰ Cache expirado para clave: ${key}`);
      this.cache.delete(key);
      return null;
    }

    this.logger.log(`⚡ Hit de Caché! Retornando datos sin consumir API para clave: ${key}`);
    return entry.data;
  }

  set(key: string, data: FlightOffer[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    this.logger.log(`💾 Guardado en caché (TTL 6h): ${key}`);
  }

  clear(): void {
    this.cache.clear();
    this.logger.log('🧹 Caché de vuelos limpiado.');
  }
}
