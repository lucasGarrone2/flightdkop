import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { SerpApiProvider } from './providers/serpapi.provider';

@Module({
  controllers: [FlightsController],
  providers: [FlightsService, SerpApiProvider],
  exports: [FlightsService],
})
export class FlightsModule {}
