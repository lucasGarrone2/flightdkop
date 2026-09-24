import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FlightsService } from '../flights/flights.service';
import { AlertsService } from './alerts.service';

@Injectable()
export class TelegramBotListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotListenerService.name);
  private isPolling = false;
  private lastUpdateId = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly flightsService: FlightsService,
    private readonly alertsService: AlertsService,
  ) {}

  onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token) {
      this.logger.log('🤖 Iniciando escucha interactiva de Telegram (Long Polling)...');
      this.isPolling = true;
      this.pollUpdates();
    } else {
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado. Escucha interactiva desactivada.');
    }
  }

  onModuleDestroy() {
    this.isPolling = false;
  }

  private async pollUpdates() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return;

    while (this.isPolling) {
      try {
        const response = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, {
          params: {
            offset: this.lastUpdateId + 1,
            timeout: 10,
          },
        });

        const updates = response.data?.result || [];
        for (const update of updates) {
          this.lastUpdateId = update.update_id;
          if (update.message && update.message.text) {
            await this.handleMessage(update.message);
          }
        }
      } catch (err: any) {
        if (this.isPolling) {
          this.logger.warn(`Error en polling de Telegram: ${err.message}`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  private async handleMessage(message: any) {
    const chatId = message.chat.id;
    const text: string = (message.text || '').trim();

    if (!text.startsWith('/')) return;

    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();

    this.logger.log(`📩 Comando recibido de Telegram (${chatId}): ${text}`);

    if (command === '/start' || command === '/ayuda' || command === '/help') {
      await this.sendHelpMessage(chatId);
      return;
    }

    if (command === '/buscar') {
      // Usage: /buscar EZE CPH 2027-03-30
      if (parts.length < 4) {
        await this.alertsService.sendTelegramAlert(
          '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/buscar ORIGEN DESTINO FECHA</code>\nEjemplo: <code>/buscar EZE CPH 2027-03-30</code>',
        );
        return;
      }
      const origin = parts[1].toUpperCase();
      const destination = parts[2].toUpperCase();
      const departureDate = parts[3];

      await this.alertsService.sendTelegramAlert(`🔍 Buscando vuelos para <b>${origin} ➔ ${destination}</b> en fecha <b>${departureDate}</b>...`);

      try {
        const offers = await this.flightsService.searchFlights({
          origin,
          destination,
          departureDate,
        });

        if (!offers || offers.length === 0) {
          await this.alertsService.sendTelegramAlert(`❌ No se encontraron vuelos para ${origin} ➔ ${destination} en ${departureDate}.`);
          return;
        }

        const top = offers.slice(0, 3);
        let msg = `✈️ <b>RESULTADOS PARA ${origin} ➔ ${destination} (${departureDate})</b>\n\n`;

        top.forEach((offer, i) => {
          msg += `<b>#${i + 1} ${offer.airline}</b> - 🏆 ${offer.score || 0}/100 Pts\n`;
          msg += `💰 <b>USD $${offer.price}</b> | ⏱️ ${offer.duration} | Escalas: ${offer.stops}\n`;
          if (offer.selfTransfer) msg += `⚠️ <i>Self-Transfer (Vuelos independientes)</i>\n`;
          if (offer.bookingUrl) msg += `<a href="${offer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
          msg += `\n`;
        });

        await this.alertsService.sendTelegramAlert(msg);
      } catch (err: any) {
        await this.alertsService.sendTelegramAlert(`❌ Error ejecutando búsqueda: ${err.message}`);
      }
      return;
    }

    if (command === '/rango') {
      // Usage: /rango EZE CPH 2027-03-30 2027-04-03
      if (parts.length < 5) {
        await this.alertsService.sendTelegramAlert(
          '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/rango ORIGEN DESTINO FECHA_INICIO FECHA_FIN</code>\nEjemplo: <code>/rango EZE CPH 2027-03-30 2027-04-03</code>',
        );
        return;
      }
      const origin = parts[1].toUpperCase();
      const destination = parts[2].toUpperCase();
      const startDate = parts[3];
      const endDate = parts[4];

      await this.alertsService.sendTelegramAlert(`🔍 Evaluando rango <b>${startDate} ➔ ${endDate}</b> para <b>${origin} ➔ ${destination}</b>...`);

      try {
        const res = await this.flightsService.searchMultiFlights({
          origins: [origin],
          destinations: [destination],
          startDate,
          endDate,
        });

        let msg = `📅 <b>COMPARATIVA DE PRECIOS (${origin} ➔ ${destination})</b>\n\n`;
        res.dateSummaries.forEach((s) => {
          msg += `• <b>${s.date}:</b> USD $${s.lowestPrice} ${s.isBestPrice ? '🟢 (MEJOR PRECIO)' : ''}\n`;
        });

        if (res.bestOffer) {
          msg += `\n🏆 <b>MEJOR OPCION GLOBAL:</b>\n`;
          msg += `✈️ <b>${res.bestOffer.airline}</b> - USD $${res.bestOffer.price}\n`;
          msg += `📅 Fecha: ${res.bestOffer.departureDate} (${res.bestOffer.duration})\n`;
          if (res.bestOffer.bookingUrl) msg += `<a href="${res.bestOffer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
        }

        await this.alertsService.sendTelegramAlert(msg);
      } catch (err: any) {
        await this.alertsService.sendTelegramAlert(`❌ Error evaluando rango: ${err.message}`);
      }
      return;
    }

    if (command === '/argentina') {
      // Usage: /argentina CPH 2027-03-30
      if (parts.length < 3) {
        await this.alertsService.sendTelegramAlert(
          '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/argentina DESTINO FECHA</code>\nEjemplo: <code>/argentina CPH 2027-03-30</code>',
        );
        return;
      }
      const destination = parts[1].toUpperCase();
      const departureDate = parts[2];

      await this.alertsService.sendTelegramAlert(`🔍 Buscando desde <b>toda Argentina (EZE, AEP, COR, MDZ, ROS)</b> a <b>${destination}</b> el <b>${departureDate}</b>...`);

      try {
        const res = await this.flightsService.searchMultiFlights({
          origins: ['EZE', 'AEP', 'COR', 'MDZ', 'ROS'],
          destinations: [destination],
          startDate: departureDate,
          endDate: departureDate,
        });

        if (!res.offers || res.offers.length === 0) {
          await this.alertsService.sendTelegramAlert(`❌ No se encontraron vuelos disponibles.`);
          return;
        }

        const top = res.offers.slice(0, 4);
        let msg = `🇦🇷 <b>RESULTADOS DESDE ARGENTINA ➔ ${destination} (${departureDate})</b>\n\n`;

        top.forEach((offer, i) => {
          msg += `<b>#${i + 1} Origen ${offer.origin}:</b> ${offer.airline} - 💰 <b>USD $${offer.price}</b>\n`;
          msg += `⏱️ Duración: ${offer.duration} | Escalas: ${offer.stops}\n`;
          if (offer.bookingUrl) msg += `<a href="${offer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
          msg += `\n`;
        });

        await this.alertsService.sendTelegramAlert(msg);
      } catch (err: any) {
        await this.alertsService.sendTelegramAlert(`❌ Error en búsqueda Argentina: ${err.message}`);
      }
      return;
    }

    await this.sendHelpMessage(chatId);
  }

  private async sendHelpMessage(chatId: number) {
    const helpMsg = `
🤖 <b>BIENVENIDO AL ASISTENTE DE VUELOS ARGENTINA ➔ DINAMARCA</b>

Comandos disponibles que podés enviarme:

1️⃣ <b>Búsqueda de Vuelo Específico:</b>
<code>/buscar EZE CPH 2027-03-30</code>

2️⃣ <b>Comparar Rango de Fechas:</b>
<code>/rango EZE CPH 2027-03-30 2027-04-03</code>

3️⃣ <b>Buscar desde Toda Argentina:</b>
<code>/argentina CPH 2027-03-30</code>

4️⃣ <b>Menú de Ayuda:</b>
<code>/ayuda</code>
`;
    await this.alertsService.sendTelegramAlert(helpMsg);
  }
}
