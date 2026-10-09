export interface AppConfig {
  databaseUrl: string;
  serpApiKey: string | undefined;
  host: string;
  port: number;
  corsOrigin: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    databaseUrl: required("DATABASE_URL"),
    serpApiKey: process.env.SERPAPI_API_KEY?.trim() || undefined,
    host: process.env.HOST?.trim() || "0.0.0.0",
    port,
    corsOrigin: process.env.CORS_ORIGIN?.trim() || "http://localhost:5173",
  };
}
