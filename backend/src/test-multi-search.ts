import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FlightsService } from './flights/flights.service';

async function testMultiSearch() {
  console.log('🚀 Iniciando test de búsqueda multi-aeropuerto y rango de fechas...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const flightsService = app.get(FlightsService);

  try {
    const result = await flightsService.searchMultiFlights({
      origins: ['EZE', 'AEP'],
      destinations: ['CPH'],
      startDate: '2027-03-30',
      endDate: '2027-04-01',
      passengers: 1,
      maxStops: 2,
    });

    console.log('\n📊 ESTADÍSTICAS DE BÚSQUEDA:');
    console.log(`- Consultas totales intentadas: ${result.stats.totalQueries}`);
    console.log(`- Hits en Caché (0 coste API): ${result.stats.cachedHits}`);
    console.log(`- Llamadas reales a SerpApi: ${result.stats.apiCalls}`);

    console.log('\n📅 COMPARATIVA DE PRECIOS POR FECHA:');
    result.dateSummaries.forEach((sum) => {
      console.log(`- Date ${sum.date}: $${sum.lowestPrice} (${sum.origin} -> ${sum.destination}) ${sum.isBestPrice ? '🟢 [MEJOR PRECIO]' : ''}`);
    });

    console.log(`\n🏆 MEJOR OFERTA GLOBAL DETECTADA:`);
    if (result.bestOffer) {
      console.log(`✈️ Aerolínea: ${result.bestOffer.airline}`);
      console.log(`💰 Precio: USD $${result.bestOffer.price}`);
      console.log(`📅 Fecha: ${result.bestOffer.departureDate}`);
      console.log(`📍 Ruta: ${result.bestOffer.origin} -> ${result.bestOffer.destination}`);
    }
  } catch (err: any) {
    console.error('❌ Error en test multi-búsqueda:', err.message || err);
  } finally {
    await app.close();
  }
}

testMultiSearch();
