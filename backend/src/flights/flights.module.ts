import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { SerpApiProvider } from './providers/serpapi.provider';
import { FlightsCacheService } from './cache/flights-cache.service';
import { RankingService } from './ranking/ranking.service';
import { HistoryService } from './history/history.service';
import { AnalyticsService } from './analytics/analytics.service';
import { FlightsCronService } from './cron/flights-cron.service';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [ScheduleModule.forRoot(), AlertsModule],
  controllers: [FlightsController],
  providers: [
    FlightsService,
    SerpApiProvider,
    FlightsCacheService,
    RankingService,
    HistoryService,
    AnalyticsService,
    FlightsCronService,
  ],
  exports: [FlightsService, FlightsCacheService, RankingService, HistoryService, AnalyticsService, FlightsCronService],
})
export class FlightsModule {}
