import { createCandemorApp } from './app.mjs';

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
const host =
  process.env.API_HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const app = createCandemorApp({
  databasePath: process.env.DATABASE_PATH,
  uploadDir: process.env.UPLOAD_DIR,
  browserDir: process.env.BROWSER_DIR,
});

app.server.once('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(
      `No se puede iniciar la API: el puerto ${port} ya está ocupado. ` +
        'Cierra la instancia anterior o define otro API_PORT en .env.',
    );
  } else {
    console.error('No se ha podido iniciar la API.', error);
  }

  app.db.close();
  process.exitCode = 1;
});

app.server.listen(port, host, () => {
  console.log(`Candemor API disponible en http://${host}:${port}`);
});

const shutdown = async () => {
  await app.close();
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
