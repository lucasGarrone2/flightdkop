import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { FlightsService } from './flights.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { FlightOffer } from './interfaces/flight-offer.interface';

@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get('search')
  @UsePipes(new ValidationPipe({ transform: true }))
  async search(@Query() searchDto: SearchFlightsDto): Promise<FlightOffer[]> {
    return this.flightsService.searchFlights(searchDto);
  }
}
