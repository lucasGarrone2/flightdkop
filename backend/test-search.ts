import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { FlightsService } from './src/flights/flights.service';

async function testLiveFlightSearch() {
  console.log('🚀 Iniciando test de búsqueda de vuelos reales con SerpApi...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const flightsService = app.get(FlightsService);

  try {
    const results = await flightsService.searchFlights({
      origin: 'EZE',
      destination: 'CPH',
      departureDate: '2027-03-30',
      passengers: 1,
      maxStops: 2,
    });

    console.log(`\n✅ ¡BÚSQUEDA EXITOSA! Se encontraron ${results.length} opciones de vuelo de EZE -> CPH:\n`);
    results.slice(0, 5).forEach((offer, i) => {
      console.log(`--- Opción #${i + 1} ---`);
      console.log(`✈️ Aerolínea: ${offer.airline}`);
      console.log(`💰 Precio: ${offer.currency} $${offer.price}`);
      console.log(`⏱️ Duración: ${offer.duration}`);
      console.log(`🛑 Escalas: ${offer.stops}`);
      console.log(`⚠️ Self-Transfer: ${offer.selfTransfer ? 'SÍ (Vuelos independientes)' : 'NO (Itinerario protegido)'}`);
      console.log(`🛫 Salida: ${offer.departureTime}`);
      console.log(`🛬 Llegada: ${offer.arrivalTime}`);
      console.log(`🔗 Segmentos:`, offer.segments.map(s => `${s.airline} (${s.flightNumber}): ${s.departureAirport} -> ${s.arrivalAirport}`));
      console.log('');
    });
  } catch (err: any) {
    console.error('❌ Error ejecutando test de vuelos:', err.message || err);
  } finally {
    await app.close();
  }
}

testLiveFlightSearch();
