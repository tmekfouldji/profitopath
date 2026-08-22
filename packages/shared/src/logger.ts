import pino, { type Logger, type LoggerOptions } from 'pino';

export interface LoggerContext {
  service: string;
  version?: string;
}

export function createLogger(
  context: LoggerContext,
  options: LoggerOptions = {},
): Logger {
  return pino({
    base: context,
    level: process.env.LOG_LEVEL ?? 'info',
    messageKey: 'message',
    redact: {
      paths: [
        'authorization',
        'cookie',
        'password',
        'req.headers.authorization',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...options,
  });
}
