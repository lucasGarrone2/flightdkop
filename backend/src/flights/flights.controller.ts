import { Controller, Get, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { FlightsService } from './flights.service';
import { FlightsCronService } from './cron/flights-cron.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { SearchMultiFlightsDto } from './dto/search-multi-flights.dto';
import { FlightOffer } from './interfaces/flight-offer.interface';
import { MultiFlightSearchResponse } from './interfaces/multi-search-response.interface';

@Controller('flights')
export class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly flightsCronService: FlightsCronService,
  ) {}

  @Get('search')
  @UsePipes(new ValidationPipe({ transform: true }))
  async search(@Query() searchDto: SearchFlightsDto): Promise<FlightOffer[]> {
    return this.flightsService.searchFlights(searchDto);
  }

  @Get('search-multi')
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchMulti(@Query() searchMultiDto: SearchMultiFlightsDto): Promise<MultiFlightSearchResponse> {
    return this.flightsService.searchMultiFlights(searchMultiDto);
  }

  @Post('trigger-alert-scan')
  async triggerAlertScan() {
    return this.flightsCronService.runAutomaticScan();
  }
}
