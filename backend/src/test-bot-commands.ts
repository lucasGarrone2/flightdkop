import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FlightsService } from './flights/flights.service';
import { AlertsService } from './alerts/alerts.service';

async function testBotCommands() {
  console.log('🚀 Probando ejecución de comandos del bot...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const flightsService = app.get(FlightsService);
  const alertsService = app.get(AlertsService);

  try {
    console.log('1. Probando /buscar EZE CPH 2027-03-30...');
    const offers = await flightsService.searchFlights({
      origin: 'EZE',
      destination: 'CPH',
      departureDate: '2027-03-30',
    });

    console.log(`- Encontrados ${offers.length} vuelos.`);

    const top = offers.slice(0, 3);
    let msg = `✈️ <b>RESULTADOS PARA EZE ➔ CPH (2027-03-30)</b>\n\n`;

    top.forEach((offer, i) => {
      msg += `<b>#${i + 1} ${offer.airline}</b> - 🏆 ${offer.score || 0}/100 Pts\n`;
      msg += `💰 <b>USD $${offer.price}</b> | ⏱️ ${offer.duration} | Escalas: ${offer.stops}\n`;
      if (offer.selfTransfer) msg += `⚠️ <i>Self-Transfer (Vuelos independientes)</i>\n`;
      if (offer.bookingUrl) msg += `<a href="${offer.bookingUrl}">🔗 Ver en Google Flights</a>\n`;
      msg += `\n`;
    });

    console.log('- Enviando mensaje a Telegram...');
    const sent = await alertsService.sendTelegramAlert(msg);
    console.log(`- Resultado de envío: ${sent ? 'ÉXITO' : 'FALLO'}`);
  } catch (err: any) {
    console.error('❌ Error en test de bot:', err.message || err);
  } finally {
    await app.close();
  }
}

testBotCommands();
