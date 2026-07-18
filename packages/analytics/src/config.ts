import type { ResearchReportConfig } from './report';

type Env = Record<string, string | undefined>;

function integer(
  value: string | undefined,
  fallback: number,
  min: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min)
    throw new Error(`expected an integer >= ${min}, received "${value}"`);
  return parsed;
}

function decimalString(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0 || !/^-?\d+(\.\d+)?$/.test(trimmed))
    throw new Error(`expected a decimal string, received "${value}"`);
  return trimmed;
}

/**
 * Builds a research report configuration from environment variables, applying
 * safe defaults. Shared by the API and worker so thresholds stay consistent.
 */
export function researchReportConfigFromEnv(
  env: Env = process.env,
): ResearchReportConfig {
  return {
    submissionDelayMs: integer(env.RESEARCH_SUBMISSION_DELAY_MS, 1_000, 0),
    episodeGapMs: integer(env.RESEARCH_EPISODE_GAP_MS, 20_000, 1),
    thresholds: {
      minExecutableCount: integer(env.RESEARCH_MIN_EXECUTABLE_COUNT, 10, 0),
      maxFalsePositiveRate: decimalString(
        env.RESEARCH_MAX_FALSE_POSITIVE_RATE,
        '0.9',
      ),
      minMedianDurationMs: integer(
        env.RESEARCH_MIN_MEDIAN_DURATION_MS,
        1_000,
        0,
      ),
    },
  };
}
