import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HistoryService } from './flights/history/history.service';

async function testWatcherCommands() {
  console.log('🚀 Probando comandos de vigilancia en Base de Datos...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const historyService = app.get(HistoryService);

  const testChatId = '1850538089';

  try {
    console.log('1. Creando vigilancia de prueba...');
    const alert = await historyService.createPriceAlert(
      'EZE',
      'CPH',
      '2027-03-30',
      1050,
      testChatId,
    );
    console.log(`✅ Vigilancia creada con ID: ${alert.id}`);

    console.log('2. Obteniendo vigilancias activas del usuario...');
    const alerts = await historyService.getUserPriceAlerts(testChatId);
    console.log(`- Encontradas ${alerts.length} vigilancias activas:`);
    alerts.forEach((a) => {
      console.log(`  • ${a.origin} -> ${a.destination} (${a.departureDate}) <= USD $${a.targetPrice} [ID: ${a.id}]`);
    });

    console.log('3. Eliminando la vigilancia recién creada...');
    await historyService.deletePriceAlert(alert.id, testChatId);
    const remaining = await historyService.getUserPriceAlerts(testChatId);
    console.log(`✅ Vigilancia eliminada. Restantes activas: ${remaining.length}`);
  } catch (err: any) {
    console.error('❌ Error testing watcher commands:', err.message || err);
  } finally {
    await app.close();
  }
}

testWatcherCommands();
