export const capabilities = [
  ['API', 'NestJS orchestration boundary', 'ready'],
  ['Worker', 'Long-running research workflows', 'ready'],
  ['Database', 'PostgreSQL with Prisma', 'local'],
] as const;

export const liveExecutionStatus = 'DISABLED BY DEFAULT';
