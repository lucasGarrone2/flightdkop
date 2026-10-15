import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*', // For local dev
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend NestJS corriendo en http://localhost:${port}`);

  // Keep-alive: Render (plan gratuito) duerme el servicio tras 15 min sin tráfico HTTP entrante.
  // Auto-ping a la URL pública cada 10 min para mantenerlo despierto y el bot escuchando.
  const publicUrl = process.env.RENDER_EXTERNAL_URL;
  if (publicUrl) {
    setInterval(() => {
      fetch(publicUrl)
        .then(() => console.log('💓 Keep-alive ping OK'))
        .catch((err) => console.warn(`Keep-alive ping falló: ${err.message}`));
    }, 10 * 60 * 1000);
    console.log(`💓 Keep-alive activado hacia ${publicUrl}`);
  }
}
bootstrap();
