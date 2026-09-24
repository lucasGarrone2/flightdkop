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

    try {
      if (command === '/start' || command === '/ayuda' || command === '/help') {
        await this.sendHelpMessage(chatId);
        return;
      }

      if (command === '/buscar') {
        if (parts.length < 4) {
          await this.alertsService.sendTelegramAlert(
            '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/buscar ORIGEN DESTINO FECHA</code>\nEjemplo: <code>/buscar EZE CPH 2027-03-30</code>',
          );
          return;
        }

        const origin = parts[1].toUpperCase();
        const destination = parts[2].toUpperCase();
        const departureDate = this.normalizeDate(parts[3]);

        await this.alertsService.sendTelegramAlert(
          `🔍 Buscando vuelos para <b>${origin} ➔ ${destination}</b> en fecha <b>${departureDate}</b>...`,
        );

        const offers = await this.flightsService.searchFlights({
          origin,
          destination,
          departureDate,
        });

        if (!offers || offers.length === 0) {
          await this.alertsService.sendTelegramAlert(
            `❌ No se encontraron vuelos para <b>${origin} ➔ ${destination}</b> en la fecha <b>${departureDate}</b>.`,
          );
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
        return;
      }

      if (command === '/rango') {
        if (parts.length < 5) {
          await this.alertsService.sendTelegramAlert(
            '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/rango ORIGEN DESTINO FECHA_INICIO FECHA_FIN</code>\nEjemplo: <code>/rango EZE CPH 2027-03-30 2027-04-03</code>',
          );
          return;
        }

        const origin = parts[1].toUpperCase();
        const destination = parts[2].toUpperCase();
        const startDate = this.normalizeDate(parts[3]);
        const endDate = this.normalizeDate(parts[4]);

        await this.alertsService.sendTelegramAlert(
          `🔍 Evaluando precios y duraciones <b>${startDate} ➔ ${endDate}</b> para <b>${origin} ➔ ${destination}</b>...`,
        );

        const res = await this.flightsService.searchMultiFlights({
          origins: [origin],
          destinations: [destination],
          startDate,
          endDate,
        });

        if (!res.dateSummaries || res.dateSummaries.length === 0) {
          await this.alertsService.sendTelegramAlert(`❌ No se encontraron ofertas en el rango de fechas solicitado.`);
          return;
        }

        let msg = `📅 <b>COMPARATIVA DE FECHAS (${origin} ➔ ${destination})</b>\n\n`;
        res.dateSummaries.forEach((s) => {
          const tags = [];
          if (s.isBestPrice) tags.push('💰 Más barato');
          if (s.isFastest) tags.push('⚡ Más rápido');
          if (s.isBestValue) tags.push('🏆 Mejor valor');

          const tagText = tags.length > 0 ? ` [${tags.join(' | ')}]` : '';
          msg += `• <b>${s.date}:</b> $${s.lowestPrice} (⏱️ ${s.fastestDuration})${tagText}\n`;
        });

        if (res.bestOffer) {
          msg += `\n🏆 <b>OPCIÓN CON MEJOR VALOR (PRECIO/DURACIÓN):</b>\n`;
          msg += `✈️ <b>${res.bestOffer.airline}</b> - 💰 USD $${res.bestOffer.price}\n`;
          msg += `📅 Fecha: ${res.bestOffer.departureDate} | ⏱️ Duración: ${res.bestOffer.duration}\n`;
          msg += `🛑 Escalas: ${res.bestOffer.stops} | Puntaje: 🏆 ${res.bestOffer.score || 0}/100 Pts\n`;
          if (res.bestOffer.bookingUrl) msg += `<a href="${res.bestOffer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
        }

        if (res.fastestOffer && res.fastestOffer.id !== res.bestOffer?.id) {
          msg += `\n⚡ <b>OPCIÓN MÁS RÁPIDA DETECTADA:</b>\n`;
          msg += `✈️ <b>${res.fastestOffer.airline}</b> - USD $${res.fastestOffer.price} (⏱️ ${res.fastestOffer.duration})\n`;
          msg += `📅 Fecha: ${res.fastestOffer.departureDate}\n`;
          if (res.fastestOffer.bookingUrl) msg += `<a href="${res.fastestOffer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
        }

        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      if (command === '/argentina') {
        if (parts.length < 3) {
          await this.alertsService.sendTelegramAlert(
            '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/argentina DESTINO FECHA</code>\nEjemplo: <code>/argentina CPH 2027-03-30</code>',
          );
          return;
        }

        const destination = parts[1].toUpperCase();
        const departureDate = this.normalizeDate(parts[2]);

        await this.alertsService.sendTelegramAlert(
          `🔍 Buscando desde <b>toda Argentina (EZE, AEP, COR, MDZ, ROS)</b> a <b>${destination}</b> el <b>${departureDate}</b>...`,
        );

        const res = await this.flightsService.searchMultiFlights({
          origins: ['EZE', 'AEP', 'COR', 'MDZ', 'ROS'],
          destinations: [destination],
          startDate: departureDate,
          endDate: departureDate,
        });

        if (!res.offers || res.offers.length === 0) {
          await this.alertsService.sendTelegramAlert(`❌ No se encontraron vuelos disponibles desde Argentina.`);
          return;
        }

        const top = res.offers.slice(0, 4);
        let msg = `🇦🇷 <b>RESULTADOS DESDE ARGENTINA ➔ ${destination} (${departureDate})</b>\n\n`;

        top.forEach((offer, i) => {
          msg += `<b>#${i + 1} Origen ${offer.origin}:</b> ${offer.airline} - 💰 <b>USD $${offer.price}</b>\n`;
          msg += `⏱️ Duración: ${offer.duration} | Escalas: ${offer.stops} | 🏆 ${offer.score || 0}/100 Pts\n`;
          if (offer.bookingUrl) msg += `<a href="${offer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
          msg += `\n`;
        });

        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      await this.sendHelpMessage(chatId);
    } catch (err: any) {
      this.logger.error(`Error procesando comando Telegram: ${err.message}`, err.stack);
      await this.alertsService.sendTelegramAlert(`❌ Error procesando el comando: ${err.message}`);
    }
  }

  private normalizeDate(dateStr: string): string {
    if (!dateStr) return dateStr;
    let clean = dateStr.replace(/\//g, '-');
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
      clean = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return clean;
  }

  private async sendHelpMessage(chatId: number) {
    const helpMsg = `
🤖 <b>ASISTENTE DE VUELOS ARGENTINA ➔ DINAMARCA</b>

Comandos disponibles:

1️⃣ <b>Búsqueda de Vuelo Concreto:</b>
<code>/buscar EZE CPH 2027-03-30</code>

2️⃣ <b>Comparar Rango (Precio + Duración):</b>
<code>/rango EZE CPH 2027-03-30 2027-04-03</code>

3️⃣ <b>Buscar desde Toda Argentina:</b>
<code>/argentina CPH 2027-03-30</code>

4️⃣ <b>Menú de Ayuda:</b>
<code>/ayuda</code>
`;
    await this.alertsService.sendTelegramAlert(helpMsg);
  }
}
