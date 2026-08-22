export type HealthStatus = 'ok' | 'error';

export interface DependencyHealth {
  latencyMs: number;
  message?: string;
  status: HealthStatus;
}

export interface HealthReport {
  checks: Record<string, DependencyHealth>;
  checkedAt: string;
  status: HealthStatus;
}

export type HealthCheck = () => Promise<void>;

export async function runReadinessChecks(
  checks: Record<string, HealthCheck>,
): Promise<HealthReport> {
  const results = await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      const startedAt = performance.now();
      try {
        await check();
        return [
          name,
          {
            latencyMs: Math.round(performance.now() - startedAt),
            status: 'ok',
          },
        ] as const;
      } catch {
        return [
          name,
          {
            latencyMs: Math.round(performance.now() - startedAt),
            message: 'Dependency check failed',
            status: 'error',
          },
        ] as const;
      }
    }),
  );

  const result: Record<string, DependencyHealth> = Object.fromEntries(results);
  return {
    checks: result,
    checkedAt: new Date().toISOString(),
    status: Object.values(result).every((check) => check.status === 'ok')
      ? 'ok'
      : 'error',
  };
}
