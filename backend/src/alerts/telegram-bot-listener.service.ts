import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FlightsService } from '../flights/flights.service';
import { HistoryService } from '../flights/history/history.service';
import { AlertsService } from './alerts.service';
import { DEFAULT_GENERAL_START_DATE, DEFAULT_GENERAL_END_DATE } from '../config/airports.config';

import { FlightsCronService } from '../flights/cron/flights-cron.service';

@Injectable()
export class TelegramBotListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotListenerService.name);
  private isPolling = false;
  private lastUpdateId = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly flightsService: FlightsService,
    private readonly historyService: HistoryService,
    private readonly alertsService: AlertsService,
    private readonly flightsCronService: FlightsCronService,
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
    const chatId = String(message.chat.id);
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

      // --- COMMAND: /dashboard ---
      if (command === '/dashboard' || command === '/resumen') {
        await this.alertsService.sendTelegramAlert(
          `📊 Generando <b>Dashboard Ejecutivo</b> para el rango general <b>${DEFAULT_GENERAL_START_DATE} ➔ ${DEFAULT_GENERAL_END_DATE}</b>...`,
        );

        const res = await this.flightsService.searchMultiFlights({
          origins: ['EZE', 'AEP'],
          destinations: ['CPH'],
          startDate: DEFAULT_GENERAL_START_DATE,
          endDate: DEFAULT_GENERAL_END_DATE,
        });

        const a = res.analytics;
        let msg = `📊 <b>DASHBOARD EJECUTIVO DE VUELOS (ARGENTINA ➔ DINAMARCA)</b>\n`;
        msg += `📅 Rango General: <b>10/03/2027 a 05/04/2027</b>\n\n`;

        msg += `${a.dealLabel}\n\n`;

        msg += `🟢 <b>Precio Mínimo Encontrado:</b> USD $${a.cheapestPrice}\n`;
        msg += `📈 <b>Precio Promedio:</b> USD $${a.averagePrice}\n`;
        msg += `🇦🇷 <b>Mejor Aeropuerto Origen:</b> ${a.bestOriginCity} (${a.bestOriginAirport})\n`;
        msg += `🔎 <b>Total Ofertas Analizadas:</b> ${a.totalOffersAnalyzed}\n\n`;

        if (res.bestOffer) {
          msg += `🏆 <b>MEJOR VALOR EQUILIBRADO:</b>\n`;
          msg += `✈️ <b>${res.bestOffer.airline}</b> - 💰 USD $${res.bestOffer.price}\n`;
          msg += `📅 Fecha: ${res.bestOffer.departureDate} | ⏱️ Duración: ${res.bestOffer.duration}\n`;
          msg += `🛑 Escalas: ${res.bestOffer.stops} | Puntaje: 🏆 ${res.bestOffer.score || 0}/100 Pts\n`;
          if (res.bestOffer.bookingUrl) msg += `<a href="${res.bestOffer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
        }

        if (res.fastestOffer && res.fastestOffer.id !== res.bestOffer?.id) {
          msg += `\n⚡ <b>OPCIÓN MÁS RÁPIDA:</b>\n`;
          msg += `✈️ <b>${res.fastestOffer.airline}</b> - USD $${res.fastestOffer.price} (⏱️ ${res.fastestOffer.duration})\n`;
          msg += `📅 Fecha: ${res.fastestOffer.departureDate}\n`;
          if (res.fastestOffer.bookingUrl) msg += `<a href="${res.fastestOffer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
        }

        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      // --- COMMAND: /rutas ---
      if (command === '/rutas' || command === '/conexiones') {
        await this.alertsService.sendTelegramAlert(`🗺️ Analizando <b>Rutas Alternativas y Conexiones en Europa</b>...`);

        const res = await this.flightsService.searchMultiFlights({
          origins: ['EZE', 'AEP'],
          destinations: ['CPH', 'BLL', 'HAM'],
          startDate: DEFAULT_GENERAL_START_DATE,
          endDate: '2027-03-24',
        });

        const a = res.analytics;
        let msg = `🗺️ <b>ANÁLISIS DE RUTAS Y CONEXIONES EN EUROPA</b>\n\n`;
        msg += `<b>Conexiones principales detectadas:</b>\n`;

        a.alternativeHubs.forEach((hub) => {
          msg += `• <b>Vía ${hub.hubCode}:</b> desde USD $${hub.lowestPrice} (${hub.offerCount} opciones)\n`;
        });

        msg += `\n💡 <i>Consejo: Volar a Copenhague (CPH) directo o vía Madrid (MAD) / Barcelona (BCN) suele ofrecer el mejor equilibrio precio/duración.</i>`;

        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      // --- COMMAND: /vigilar ORIGEN DESTINO FECHA_INICIO [FECHA_FIN] PRECIO_MAX ---
      if (command === '/vigilar') {
        if (parts.length < 5) {
          await this.alertsService.sendTelegramAlert(
            '⚠️ <b>Formato incorrecto.</b>\n\nUso para Rango:\n<code>/vigilar EZE CPH 2027-03-10 2027-04-05 1100</code>',
          );
          return;
        }

        const origin = parts[1].toUpperCase();
        const destination = parts[2].toUpperCase();

        let startDate = '';
        let endDate = '';
        let targetPrice = 0;

        if (parts.length >= 6) {
          startDate = this.normalizeDate(parts[3]);
          endDate = this.normalizeDate(parts[4]);
          targetPrice = parseFloat(parts[5]);
        } else {
          startDate = this.normalizeDate(parts[3]);
          endDate = startDate;
          targetPrice = parseFloat(parts[4]);
        }

        if (isNaN(targetPrice) || targetPrice <= 0) {
          await this.alertsService.sendTelegramAlert('⚠️ El precio máximo debe ser un número válido.');
          return;
        }

        const alert = await this.historyService.createPriceAlert(
          origin,
          destination,
          startDate,
          endDate,
          targetPrice,
          chatId,
        );

        const rangeLabel = alert.startDate === alert.endDate ? alert.startDate : `${alert.startDate} ➔ ${alert.endDate}`;

        let msg = `📡 <b>¡NUEVA VIGILANCIA ACTIVADA!</b>\n\n`;
        msg += `✈️ <b>Ruta:</b> ${alert.origin} ➔ ${alert.destination}\n`;
        msg += `📅 <b>Rango de Fechas:</b> ${rangeLabel}\n`;
        msg += `💰 <b>Precio Objetivo Máximo:</b> USD $${alert.targetPrice}\n`;
        msg += `🆔 <b>ID de Vigilancia:</b> <code>${alert.id}</code>\n\n`;
        msg += `<i>El sistema monitoreará diariamente este rango de viaje y te avisará automáticamente cuando encuentre una oferta por debajo de tu objetivo.</i>`;

        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      // --- COMMAND: /mis_vigilancias ---
      if (command === '/mis_vigilancias' || command === '/vigilancias') {
        const alerts = await this.historyService.getUserPriceAlerts(chatId);

        if (!alerts || alerts.length === 0) {
          await this.alertsService.sendTelegramAlert('📭 No tenés vigilancias activas en este momento.\nPodés agregar una escribiendo: <code>/vigilar EZE CPH 2027-03-10 2027-04-05 1100</code>');
          return;
        }

        let msg = `📡 <b>TUS VIGILANCIAS ACTIVAS (${alerts.length})</b>\n\n`;
        alerts.forEach((alt, idx) => {
          const rangeLabel = alt.startDate === alt.endDate ? alt.startDate : `${alt.startDate} ➔ ${alt.endDate}`;
          msg += `<b>#${idx + 1}</b> ${alt.origin} ➔ ${alt.destination} (${rangeLabel})\n`;
          msg += `💰 Máximo: <b>USD $${alt.targetPrice}</b>\n`;
          msg += `🆔 ID: <code>${alt.id}</code>\n\n`;
        });

        msg += `<i>Para borrar una vigilancia, enviá: <code>/borrar_vigilancia ID</code></i>`;
        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      // --- COMMAND: /borrar_vigilancia ID ---
      if (command === '/borrar_vigilancia' || command === '/eliminar_vigilancia') {
        if (parts.length < 2) {
          await this.alertsService.sendTelegramAlert('⚠️ Debés indicar el ID de la vigilancia. Ejemplo: <code>/borrar_vigilancia ID</code>');
          return;
        }

        const alertId = parts[1];
        await this.historyService.deletePriceAlert(alertId, chatId);

        await this.alertsService.sendTelegramAlert(`🗑️ <b>Vigilancia desactivada con éxito.</b> (ID: <code>${alertId}</code>)`);
        return;
      }

      // --- COMMAND: /resumen_semanal ---
      if (command === '/resumen_semanal' || command === '/viernes') {
        await this.alertsService.sendTelegramAlert(`✨ Generando <b>Resumen Semanal de Ofertas</b>...`);
        await this.flightsCronService.sendWeeklySummary();
        return;
      }

      // --- COMMAND: /guardar_fecha ORIGEN DESTINO FECHA PRECIO AIRLINE ---
      if (command === '/guardar_fecha' || command === '/guardar') {
        if (parts.length < 6) {
          await this.alertsService.sendTelegramAlert(
            '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/guardar_fecha ORIGEN DESTINO FECHA PRECIO AEROLINEA</code>\nEjemplo: <code>/guardar_fecha EZE CPH 2027-03-15 824 Lufthansa</code>',
          );
          return;
        }

        const origin = parts[1].toUpperCase();
        const destination = parts[2].toUpperCase();
        const departureDate = this.normalizeDate(parts[3]);
        const price = parseFloat(parts[4]);
        const airline = parts.slice(5).join(' ');

        if (isNaN(price)) {
          await this.alertsService.sendTelegramAlert('⚠️ El precio debe ser un número válido.');
          return;
        }

        const saved = await this.historyService.saveFavoriteDate(
          origin,
          destination,
          departureDate,
          price,
          airline,
          '',
          null,
          chatId,
        );

        let msg = `📌 <b>¡FECHA/VUELO GUARDADO EN FAVORITOS!</b>\n\n`;
        msg += `✈️ <b>Ruta:</b> ${saved.origin} ➔ ${saved.destination}\n`;
        msg += `📅 <b>Fecha:</b> ${saved.departureDate}\n`;
        msg += `💰 <b>Precio:</b> USD $${saved.price}\n`;
        msg += `✈️ <b>Aerolínea:</b> ${saved.airline}\n`;
        msg += `🆔 <b>ID Guardado:</b> <code>${saved.id}</code>\n\n`;
        msg += `<i>Podés consultar tus fechas guardadas enviando: <code>/fechas</code></i>`;

        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      // --- COMMAND: /fechas ---
      if (command === '/fechas' || command === '/mis_fechas' || command === '/favoritos') {
        const savedDates = await this.historyService.getUserSavedDates(chatId);

        if (!savedDates || savedDates.length === 0) {
          await this.alertsService.sendTelegramAlert(
            '📭 No tenés fechas ni vuelos favoritos guardados.\nGuardá una fecha escribiendo:\n<code>/guardar_fecha EZE CPH 2027-03-15 824 Lufthansa</code>',
          );
          return;
        }

        let msg = `📌 <b>TUS FECHAS Y VUELOS FAVORITOS GUARDADOS (${savedDates.length})</b>\n\n`;
        savedDates.forEach((s, idx) => {
          msg += `<b>#${idx + 1} ${s.origin} ➔ ${s.destination} (${s.departureDate})</b>\n`;
          msg += `💰 Precio: <b>USD $${s.price}</b> | ✈️ Aerolínea: ${s.airline}\n`;
          msg += `🆔 ID: <code>${s.id}</code>\n\n`;
        });

        msg += `<i>Para borrar una fecha guardada, enviá: <code>/borrar_fecha ID</code></i>`;
        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      // --- COMMAND: /borrar_fecha ID ---
      if (command === '/borrar_fecha' || command === '/eliminar_fecha') {
        if (parts.length < 2) {
          await this.alertsService.sendTelegramAlert('⚠️ Debés indicar el ID de la fecha guardada. Ejemplo: <code>/borrar_fecha ID</code>');
          return;
        }

        const savedId = parts[1];
        await this.historyService.deleteSavedDate(savedId, chatId);

        await this.alertsService.sendTelegramAlert(`🗑️ <b>Fecha/Vuelo eliminado de favoritos.</b> (ID: <code>${savedId}</code>)`);
        return;
      }

      // --- COMMAND: /buscar ---
      if (command === '/buscar') {
        if (parts.length < 4) {
          await this.alertsService.sendTelegramAlert(
            '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/buscar ORIGEN DESTINO FECHA [directo|1escala|2escalas]</code>\nEjemplo: <code>/buscar EZE CPH 2027-03-30 directo</code>',
          );
          return;
        }

        const origin = parts[1].toUpperCase();
        const destination = parts[2].toUpperCase();
        const departureDate = this.normalizeDate(parts[3]);
        const maxStops = this.parseMaxStops(parts);

        await this.alertsService.sendTelegramAlert(
          `🔍 Buscando vuelos para <b>${origin} ➔ ${destination}</b> en fecha <b>${departureDate}</b>${maxStops !== undefined ? ` (Máx ${maxStops} escalas)` : ''}...`,
        );

        const offers = await this.flightsService.searchFlights({
          origin,
          destination,
          departureDate,
          maxStops,
        });

        if (!offers || offers.length === 0) {
          await this.alertsService.sendTelegramAlert(
            `❌ No se encontraron vuelos para <b>${origin} ➔ ${destination}</b> en la fecha <b>${departureDate}</b>.`,
          );
          return;
        }

        const top = offers.slice(0, 5);
        let msg = `✈️ <b>TOP 5 OPCIONES (PRECIO/HORAS) PARA ${origin} ➔ ${destination} (${departureDate})</b>\n\n`;

        top.forEach((offer, i) => {
          msg += `<b>#${i + 1} ${offer.airline}</b> - 🏆 <b>${offer.score || 0}/100 Pts</b>\n`;
          msg += `💰 <b>USD $${offer.price}</b> | ⏱️ Duración: <b>${offer.duration}</b> | Escalas: ${offer.stops}\n`;
          if (offer.selfTransfer) msg += `⚠️ <i>Self-Transfer (Vuelos independientes)</i>\n`;
          if (offer.bookingUrl) msg += `<a href="${offer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
          msg += `\n`;
        });

        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      // --- COMMAND: /rango ---
      if (command === '/rango') {
        if (parts.length < 5) {
          await this.alertsService.sendTelegramAlert(
            '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/rango ORIGEN DESTINO FECHA_INICIO FECHA_FIN [directo|1escala]</code>\nEjemplo: <code>/rango EZE CPH 2027-03-10 2027-04-05 1escala</code>',
          );
          return;
        }

        const origin = parts[1].toUpperCase();
        const destination = parts[2].toUpperCase();
        const startDate = this.normalizeDate(parts[3]);
        const endDate = this.normalizeDate(parts[4]);
        const maxStops = this.parseMaxStops(parts);

        await this.alertsService.sendTelegramAlert(
          `🔍 Evaluando precios y duraciones <b>${startDate} ➔ ${endDate}</b> para <b>${origin} ➔ ${destination}</b>${maxStops !== undefined ? ` (Máx ${maxStops} escalas)` : ''}...`,
        );

        const res = await this.flightsService.searchMultiFlights({
          origins: [origin],
          destinations: [destination],
          startDate,
          endDate,
          maxStops,
        });

        if (!res.dateSummaries || res.dateSummaries.length === 0) {
          await this.alertsService.sendTelegramAlert(`❌ No se encontraron ofertas en el rango de fechas solicitado.`);
          return;
        }

        let msg = `📅 <b>COMPARATIVA DE FECHAS (${origin} ➔ ${destination})</b>\n\n`;
        res.dateSummaries.forEach((s) => {
          const tags = [];
          if (s.isBestPrice) tags.push('🟢 Más barato');
          if (s.isFastest && !s.isBestPrice) tags.push('⚡ Más rápido');
          const tagText = tags.length > 0 ? ` [${tags.join(' | ')}]` : '';
          msg += `• <b>${s.date}:</b> $${s.lowestPrice} (⏱️ ${s.fastestDuration})${tagText}\n`;
        });

        if (res.offers && res.offers.length > 0) {
          const top5 = res.offers.slice(0, 5);
          msg += `\n🏆 <b>TOP 5 MEJORES OPCIONES DEL RANGO (PRECIO/HORAS):</b>\n\n`;
          top5.forEach((offer, i) => {
            msg += `<b>#${i + 1} ${offer.airline}</b> (${offer.departureDate}) - 💰 <b>USD $${offer.price}</b>\n`;
            msg += `⏱️ Duración: <b>${offer.duration}</b> | 🛑 Escalas: ${offer.stops} | Puntaje: 🏆 ${offer.score || 0}/100 Pts\n`;
            if (offer.bookingUrl) msg += `<a href="${offer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
            msg += `\n`;
          });
        }

        msg += `\n💡 <i>Nota: Precios en USD netos retornados por la API. Al pagar en pesos en Argentina con tarjeta local se aplican impuestos locales (Impuesto PAÍS / Percepciones).</i>`;

        await this.alertsService.sendTelegramAlert(msg);
        return;
      }

      // --- COMMAND: /argentina ---
      if (command === '/argentina') {
        if (parts.length < 3) {
          await this.alertsService.sendTelegramAlert(
            '⚠️ <b>Formato incorrecto.</b>\nUso: <code>/argentina DESTINO FECHA [directo|1escala]</code>\nEjemplo: <code>/argentina CPH 2027-03-30 1escala</code>',
          );
          return;
        }

        const destination = parts[1].toUpperCase();
        const departureDate = this.normalizeDate(parts[2]);
        const maxStops = this.parseMaxStops(parts);

        await this.alertsService.sendTelegramAlert(
          `🔍 Buscando desde <b>toda Argentina (EZE, AEP, COR, MDZ, ROS)</b> a <b>${destination}</b> el <b>${departureDate}</b>${maxStops !== undefined ? ` (Máx ${maxStops} escalas)` : ''}...`,
        );

        const res = await this.flightsService.searchMultiFlights({
          origins: ['EZE', 'AEP', 'COR', 'MDZ', 'ROS'],
          destinations: [destination],
          startDate: departureDate,
          endDate: departureDate,
          maxStops,
        });

        if (!res.offers || res.offers.length === 0) {
          await this.alertsService.sendTelegramAlert(`❌ No se encontraron vuelos disponibles desde Argentina.`);
          return;
        }

        const top = res.offers.slice(0, 5);
        let msg = `🇦🇷 <b>TOP 5 OPCIONES DESDE ARGENTINA ➔ ${destination} (${departureDate})</b>\n\n`;

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

  private parseMaxStops(tokens: string[]): number | undefined {
    const text = tokens.join(' ').toLowerCase();
    if (text.includes('directo') || text.includes('0escala') || text.includes('0escalas')) return 0;
    if (text.includes('1escala') || text.includes('1escalas')) return 1;
    if (text.includes('2escala') || text.includes('2escalas')) return 2;
    return undefined;
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

  private async sendHelpMessage(chatId: string) {
    const helpMsg = `
🤖 <b>ASISTENTE DE VUELOS ARGENTINA ➔ DINAMARCA</b>

📊 <b>Resumen Ejecutivo & Análisis:</b>
• <code>/dashboard</code> (Resumen ejecutivo del rango general 10/03 al 05/04)
• <code>/resumen_semanal</code> (Top 3 ofertas de la semana)
• <code>/rutas</code> (Análisis de conexiones en Europa)

🔍 <b>Búsquedas Instantáneas (Soporta filtro directo/1escala):</b>
• <code>/buscar EZE CPH 2027-03-30 1escala</code>
• <code>/rango EZE CPH 2027-03-10 2027-04-05 directo</code>
• <code>/argentina CPH 2027-03-30</code>

📌 <b>Fechas & Vuelos Favoritos Guardados:</b>
• <code>/guardar_fecha EZE CPH 2027-03-15 824 Lufthansa</code>
• <code>/fechas</code> (Ver lista de fechas guardadas)
• <code>/borrar_fecha ID</code>

📡 <b>Vigilancia Continua de Precios:</b>
• <code>/vigilar EZE CPH 2027-03-10 2027-04-05 1100</code>
• <code>/mis_vigilancias</code>
• <code>/borrar_vigilancia ID</code>
`;
    await this.alertsService.sendTelegramAlert(helpMsg);
  }
}

