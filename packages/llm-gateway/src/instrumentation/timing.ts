export interface TimingResult {
  startedAt: Date;
  completedAt: Date;
  latencyMs: number;
}

export function startTimer(): () => TimingResult {
  const startedAt = new Date();

  return () => {
    const completedAt = new Date();
    const latencyMs = completedAt.getTime() - startedAt.getTime();

    return {
      startedAt,
      completedAt,
      latencyMs,
    };
  };
}

export function getTimestamp(): string {
  return new Date().toISOString();
}
