import { z } from 'zod';

const semanticVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export interface StrategyRequirements {
  capabilities: readonly string[];
  assetClasses: readonly string[];
  minimumMarkets?: number;
}

export interface StrategyMetadata {
  id: string;
  name: string;
  version: string;
  commitSha: string;
  description: string;
  requirements: StrategyRequirements;
}

export interface StrategyRuntimeContext {
  runId: string;
  capabilities: ReadonlySet<string>;
  assetClasses: ReadonlySet<string>;
  marketIds: readonly string[];
}

export interface StrategyPlugin<Config, Input, Output> {
  metadata: StrategyMetadata;
  configuration: z.ZodType<Config, z.ZodTypeDef, unknown>;
  initialize?(context: StrategyRuntimeContext, config: Config): Promise<void>;
  execute(
    input: Input,
    context: StrategyRuntimeContext,
    config: Config,
  ): Promise<Output> | Output;
  dispose?(context: StrategyRuntimeContext): Promise<void>;
}

export class StrategyCompatibilityError extends Error {
  constructor(readonly reasons: readonly string[]) {
    super(`strategy requirements are not satisfied: ${reasons.join(', ')}`);
    this.name = 'StrategyCompatibilityError';
  }
}

export class StrategyRegistry {
  readonly #plugins = new Map<
    string,
    StrategyPlugin<unknown, unknown, unknown>
  >();

  register<Config, Input, Output>(
    plugin: StrategyPlugin<Config, Input, Output>,
  ): void {
    validateMetadata(plugin.metadata);
    const key = strategyKey(plugin.metadata.id, plugin.metadata.version);
    if (this.#plugins.has(key))
      throw new Error(`strategy plugin ${key} is already registered`);
    this.#plugins.set(key, plugin);
  }

  list(): readonly StrategyMetadata[] {
    return [...this.#plugins.values()]
      .map((plugin) => plugin.metadata)
      .sort((left, right) =>
        strategyKey(left.id, left.version).localeCompare(
          strategyKey(right.id, right.version),
        ),
      );
  }

  resolve<Config, Input, Output>(
    id: string,
    version: string,
  ): StrategyPlugin<Config, Input, Output> {
    const plugin = this.#plugins.get(strategyKey(id, version));
    if (!plugin) throw new Error(`strategy plugin ${id}@${version} not found`);
    return plugin as StrategyPlugin<Config, Input, Output>;
  }

  async run<Config, Input, Output>(input: {
    id: string;
    version: string;
    configuration: unknown;
    event: Input;
    context: StrategyRuntimeContext;
  }): Promise<Output> {
    const plugin = this.resolve<Config, Input, Output>(input.id, input.version);
    assertCompatible(plugin.metadata.requirements, input.context);
    const configuration = plugin.configuration.parse(input.configuration);
    await plugin.initialize?.(input.context, configuration);
    try {
      return await plugin.execute(input.event, input.context, configuration);
    } finally {
      await plugin.dispose?.(input.context);
    }
  }
}

export function assertCompatible(
  requirements: StrategyRequirements,
  context: StrategyRuntimeContext,
): void {
  const reasons = [
    ...requirements.capabilities
      .filter((item) => !context.capabilities.has(item))
      .map((item) => `missing capability ${item}`),
    ...requirements.assetClasses
      .filter((item) => !context.assetClasses.has(item))
      .map((item) => `unsupported asset class ${item}`),
    ...(context.marketIds.length < (requirements.minimumMarkets ?? 0)
      ? [`requires at least ${requirements.minimumMarkets} markets`]
      : []),
  ];
  if (reasons.length) throw new StrategyCompatibilityError(reasons);
}

export const noopStrategy = {
  metadata: {
    id: 'reference.noop',
    name: 'No-op reference strategy',
    version: '1.0.0',
    commitSha: 'built-in',
    description: 'Validates lifecycle wiring without emitting an intent.',
    requirements: { capabilities: [], assetClasses: [] },
  },
  configuration: z.object({ label: z.string().min(1).default('noop') }),
  execute: () => ({ signals: [] as readonly unknown[] }),
} satisfies StrategyPlugin<
  { label: string },
  unknown,
  { signals: readonly unknown[] }
>;

function validateMetadata(metadata: StrategyMetadata): void {
  if (
    !metadata.id.trim() ||
    !metadata.name.trim() ||
    !metadata.commitSha.trim()
  )
    throw new TypeError('strategy id, name and commit SHA are required');
  if (!semanticVersion.test(metadata.version))
    throw new TypeError(
      `invalid strategy semantic version ${metadata.version}`,
    );
}

function strategyKey(id: string, version: string): string {
  return `${id.trim()}@${version.trim()}`;
}
