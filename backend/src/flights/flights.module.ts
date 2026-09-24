import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { SerpApiProvider } from './providers/serpapi.provider';
import { FlightsCacheService } from './cache/flights-cache.service';

@Module({
  controllers: [FlightsController],
  providers: [FlightsService, SerpApiProvider, FlightsCacheService],
  exports: [FlightsService, FlightsCacheService],
})
export class FlightsModule {}
