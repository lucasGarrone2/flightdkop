import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FlightsService } from '../flights.service';
import { HistoryService } from '../history/history.service';
import { AlertsService } from '../../alerts/alerts.service';

@Injectable()
export class FlightsCronService {
  private readonly logger = new Logger(FlightsCronService.name);

  constructor(
    private readonly flightsService: FlightsService,
    private readonly historyService: HistoryService,
    private readonly alertsService: AlertsService,
  ) {}

  // Automatically runs every day at 09:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyFlightCheck() {
    this.logger.log('⏰ Ejecutando escaneo automático diario de vigilancias activas...');
    await this.runAutomaticScan();
  }

  // Dynamic automatic scan of all active watchers stored in database
  async runAutomaticScan() {
    try {
      const activeWatchers = await this.historyService.getActivePriceAlerts();
      this.logger.log(`📡 Escaneando ${activeWatchers.length} vigilancias activas en base de datos...`);

      if (!activeWatchers || activeWatchers.length === 0) {
        return {
          success: true,
          scannedWatchersCount: 0,
          alertsTriggeredCount: 0,
          message: 'No hay vigilancias activas en la base de datos.',
        };
      }

      let alertsTriggered = 0;

      for (const watcher of activeWatchers) {
        this.logger.log(`🔎 Escaneando vigilancia [${watcher.id}]: ${watcher.origin} -> ${watcher.destination} (${watcher.startDate} a ${watcher.endDate}) <= USD $${watcher.targetPrice}`);

        const origins = watcher.origin.includes(',') ? watcher.origin.split(',') : [watcher.origin];
        const res = await this.flightsService.searchMultiFlights({
          origins,
          destinations: [watcher.destination],
          startDate: watcher.startDate,
          endDate: watcher.endDate || watcher.startDate,
          passengers: 1,
          maxStops: 2,
        });

        if (res.bestOffer && res.bestOffer.price <= watcher.targetPrice) {
          this.logger.log(`🎯 OPORTUNIDAD ENCONTRADA para vigilancia [${watcher.id}]: USD $${res.bestOffer.price} <= USD $${watcher.targetPrice}`);
          await this.alertsService.sendFlightOpportunityAlert(res.bestOffer);
          alertsTriggered++;
        }
      }

      return {
        success: true,
        scannedWatchersCount: activeWatchers.length,
        alertsTriggeredCount: alertsTriggered,
      };
    } catch (err: any) {
      this.logger.error(`Error en escaneo automático: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
