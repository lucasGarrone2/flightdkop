import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FlightOffer } from '../flights/interfaces/flight-offer.interface';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendTelegramAlert(messageHtml: string, targetChatId?: string): Promise<boolean> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim();
    const envChatId = this.configService.get<string>('TELEGRAM_CHAT_ID')?.trim();
    const chatId = targetChatId || envChatId;

    if (!token || !chatId) {
      this.logger.warn(`TELEGRAM_BOT_TOKEN (${token ? 'OK' : 'FALTA'}) o Chat ID (${chatId ? 'OK' : 'FALTA'}) no configurados.`);
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(url, {
        chat_id: chatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      });

      this.logger.log(`📱 Alerta de Telegram enviada con éxito a ${chatId}.`);
      return true;
    } catch (err: any) {
      const detail = err.response?.data?.description || err.message;
      this.logger.error(`Error enviando mensaje a Telegram (${chatId}): ${detail}`);
      return false;
    }
  }

  async sendFlightOpportunityAlert(offer: FlightOffer, historicalLowest?: number): Promise<boolean> {
    const isHistoricalDeal = historicalLowest && offer.price < historicalLowest;
    const title = isHistoricalDeal ? '🔥 NUEVO PRECIO MÍNIMO HISTÓRICO' : '✈️ NUEVA OPORTUNIDAD DE VUELO';

    const segmentsText = offer.segments
      .map((s) => `• <b>${s.airline}</b> (${s.flightNumber}): ${s.departureAirport} ➔ ${s.arrivalAirport}`)
      .join('\n');

    const messageHtml = `
<b>${title}</b>

<b>Ruta:</b> ${offer.origin} ➔ ${offer.destination}
<b>Fecha:</b> ${offer.departureDate}
<b>Precio:</b> 💰 <b>USD $${offer.price}</b>
<b>Duración:</b> ⏱️ ${offer.duration}
<b>Escalas:</b> ${offer.stops === 0 ? 'Directo' : `${offer.stops} escala(s)`}
${offer.selfTransfer ? '⚠️ <i>SELF-TRANSFER (Vuelos independientes)</i>\n' : ''}
<b>Itinerario:</b>
${segmentsText}

${offer.bookingUrl ? `<a href="${offer.bookingUrl}">🔗 Ver Vuelo en Google Flights</a>` : ''}
`;

    return this.sendTelegramAlert(messageHtml);
  }
}
