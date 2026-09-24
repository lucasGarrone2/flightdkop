import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FlightsService } from '../flights.service';
import { AlertsService } from '../../alerts/alerts.service';

@Injectable()
export class FlightsCronService {
  private readonly logger = new Logger(FlightsCronService.name);

  constructor(
    private readonly flightsService: FlightsService,
    private readonly alertsService: AlertsService,
  ) {}

  // Automatically runs every day at 09:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyFlightCheck() {
    this.logger.log('⏰ Ejecutando escaneo automático diario de vuelos...');
    await this.runAutomaticScan();
  }

  // Manual trigger endpoint helper
  async runAutomaticScan() {
    try {
      const today = new Date();
      // Target search: 6 months out (e.g. 2027-03-30)
      const startDate = '2027-03-30';
      const endDate = '2027-04-03';

      const res = await this.flightsService.searchMultiFlights({
        origins: ['EZE', 'AEP'],
        destinations: ['CPH'],
        startDate,
        endDate,
        passengers: 1,
        maxStops: 2,
      });

      if (res.bestOffer) {
        this.logger.log(`🎯 Mejor oferta encontrada: USD $${res.bestOffer.price} en fecha ${res.bestOffer.departureDate}`);

        // If price is under $1100, trigger Telegram alert
        if (res.bestOffer.price <= 1100) {
          await this.alertsService.sendFlightOpportunityAlert(res.bestOffer);
        }
      }

      return {
        success: true,
        bestOffer: res.bestOffer,
        scannedOffersCount: res.offers.length,
      };
    } catch (err: any) {
      this.logger.error(`Error en escaneo automático: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
