import 'dotenv/config';



const parseOrigins = (raw = '') => raw.split(',').map((s) => s.trim()).filter(Boolean);

export const config = Object.freeze({
  port: Number(process.env.PORT || 8000),
  mongoUri: process.env.MONGODB_URI,
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  env: process.env.NODE_ENV || 'development',
});

if (!config.mongoUri) {
  console.error(
    'FATAL: MONGO_URI is missing. Copy .env.example to .env and fill it in.'
  );
  process.exit(1);
}
