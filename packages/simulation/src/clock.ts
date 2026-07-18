export interface Clock {
  now(): Date;
}

export class SimulationClock implements Clock {
  #current: number;

  constructor(initial: Date) {
    const value = initial.getTime();
    if (!Number.isFinite(value)) throw new RangeError('invalid initial time');
    this.#current = value;
  }

  now(): Date {
    return new Date(this.#current);
  }

  advanceTo(next: Date): void {
    const value = next.getTime();
    if (!Number.isFinite(value))
      throw new RangeError('invalid simulation time');
    if (value < this.#current)
      throw new RangeError('simulation clock cannot move backwards');
    this.#current = value;
  }
}
