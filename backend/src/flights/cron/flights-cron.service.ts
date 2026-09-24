import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FlightsService } from '../flights.service';
import { HistoryService } from '../history/history.service';
import { AlertsService } from '../../alerts/alerts.service';
import { DEFAULT_GENERAL_START_DATE, DEFAULT_GENERAL_END_DATE } from '../../config/airports.config';

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

  // Automatically runs every Friday at 18:00 (6 PM)
  @Cron('0 18 * * 5')
  async handleFridayWeeklySummary() {
    this.logger.log('📅 Ejecutando resumen semanal de viernes...');
    await this.sendWeeklySummary();
  }

  async sendWeeklySummary() {
    try {
      const res = await this.flightsService.searchMultiFlights({
        origins: ['EZE', 'AEP'],
        destinations: ['CPH', 'BLL'],
        startDate: DEFAULT_GENERAL_START_DATE,
        endDate: DEFAULT_GENERAL_END_DATE,
      });

      if (!res.offers || res.offers.length === 0) return { success: false, message: 'No hay ofertas' };

      const top3 = res.offers.slice(0, 3);
      let msg = `✨ <b>RESUMEN DE VIERNES: MEJORES OFERTAS DE LA SEMANA</b> ✨\n\n`;
      msg += `📅 Rango General: <b>10/03/2027 a 05/04/2027</b>\n`;
      msg += `${res.analytics.dealLabel}\n\n`;
      msg += `<b>🏆 TOP 3 VUELOS RECOMENDADOS:</b>\n\n`;

      top3.forEach((offer, i) => {
        msg += `<b>#${i + 1} ${offer.airline}</b> - 💰 <b>USD $${offer.price}</b>\n`;
        msg += `📅 Fecha: ${offer.departureDate} (${offer.origin} ➔ ${offer.destination})\n`;
        msg += `⏱️ Duración: <b>${offer.duration}</b> | 🛑 Escalas: ${offer.stops} | 🏆 ${offer.score || 0}/100 Pts\n`;
        if (offer.bookingUrl) msg += `<a href="${offer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
        msg += `\n`;
      });

      msg += `💡 <i>¡Buen fin de semana! El monitoreo automático sigue activo.</i>`;

      await this.alertsService.sendTelegramAlert(msg);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Error enviando resumen semanal: ${err.message}`);
      return { success: false, error: err.message };
    }
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

