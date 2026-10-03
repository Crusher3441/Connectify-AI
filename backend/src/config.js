import 'dotenv/config';

// Parses "http://a.com,http://b.com" → ["http://a.com", "http://b.com"]
const parseOrigins = (raw = '') =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = Object.freeze({
  port: Number(process.env.PORT || 8000),
  mongoUri: process.env.MONGO_URI,
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  env: process.env.NODE_ENV || 'development',

  openaiApiKey: process.env.OPENAI_API_KEY || null, // optional; null → keyword fallback
});

// Fail fast: a server booting without a DB URI should die loudly,
// not start and serve broken endpoints.
if (!config.mongoUri) {
  console.error(
    'FATAL: MONGO_URI is missing. Copy .env.example to .env and fill it in.'
  );
  process.exit(1);
}
