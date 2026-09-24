import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { SerpApiProvider } from './providers/serpapi.provider';
import { FlightsCacheService } from './cache/flights-cache.service';
import { RankingService } from './ranking/ranking.service';
import { HistoryService } from './history/history.service';

@Module({
  controllers: [FlightsController],
  providers: [
    FlightsService,
    SerpApiProvider,
    FlightsCacheService,
    RankingService,
    HistoryService,
  ],
  exports: [FlightsService, FlightsCacheService, RankingService, HistoryService],
})
export class FlightsModule {}
