import { Module, forwardRef } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { TelegramBotListenerService } from './telegram-bot-listener.service';
import { FlightsModule } from '../flights/flights.module';

@Module({
  imports: [forwardRef(() => FlightsModule)],
  providers: [AlertsService, TelegramBotListenerService],
  exports: [AlertsService, TelegramBotListenerService],
})
export class AlertsModule {}
