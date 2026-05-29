import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 TrustPass API running on http://localhost:${env.PORT}`);
      console.log(`📚 Swagger docs: http://localhost:${env.PORT}/api/docs`);
    });

    const shutdown = async () => {
      console.log('\n⏳ Shutting down gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Shutdown complete');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
