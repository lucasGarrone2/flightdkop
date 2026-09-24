import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HistoryService } from './flights/history/history.service';
import { FlightsCronService } from './flights/cron/flights-cron.service';

async function testCronScan() {
  console.log('🚀 Probando escaneo automático del Cron sobre vigilancias con RANGO...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const historyService = app.get(HistoryService);
  const cronService = app.get(FlightsCronService);

  const testChatId = '1850538089';

  try {
    console.log('1. Creando vigilancia con RANGO de fechas en Base de Datos...');
    const alert = await historyService.createPriceAlert(
      'EZE',
      'CPH',
      '2027-03-30',
      '2027-04-01',
      1200, // Target price $1200 USD
      testChatId,
    );
    console.log(`✅ Vigilancia creada con ID: ${alert.id} (${alert.startDate} -> ${alert.endDate})`);

    console.log('2. Ejecutando escaneo automático dinámico del Cron...');
    const scanResult = await cronService.runAutomaticScan();
    console.log('📊 Resultado del Escaneo:', JSON.stringify(scanResult, null, 2));

    console.log('3. Limpiando la vigilancia de prueba...');
    await historyService.deletePriceAlert(alert.id, testChatId);
    console.log('✅ Prueba completada con éxito.');
  } catch (err: any) {
    console.error('❌ Error testing cron scan:', err.message || err);
  } finally {
    await app.close();
  }
}

testCronScan();
