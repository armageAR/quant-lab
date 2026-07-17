export interface MainProcessOptions {
  onFatal?: (error: unknown) => void;
  setExitCode?: (code: number) => void;
}

export async function runMain(
  bootstrap: () => Promise<void>,
  options: MainProcessOptions = {},
): Promise<void> {
  try {
    await bootstrap();
  } catch (error) {
    options.onFatal?.(error);
    (options.setExitCode ?? ((code) => (process.exitCode = code)))(1);
  }
}

export function createShutdownHandler(
  cleanup: () => Promise<void>,
  onError?: (error: unknown) => void,
): () => Promise<void> {
  let shutdown: Promise<void> | undefined;

  return () => {
    shutdown ??= cleanup().catch((error: unknown) => {
      onError?.(error);
      process.exitCode = 1;
    });
    return shutdown;
  };
}
