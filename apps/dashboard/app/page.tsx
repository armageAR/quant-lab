import { capabilities, liveExecutionStatus } from './content';

export default function Home() {
  return (
    <main>
      <header>
        <span className="eyebrow">QUANT LAB / PLATFORM</span>
        <span className="phase">PHASE 01</span>
      </header>
      <section className="hero">
        <p className="kicker">Research infrastructure before execution.</p>
        <h1>
          Build evidence.
          <br />
          Control risk.
        </h1>
        <p className="lede">
          A crypto-first, multi-market laboratory for reproducible strategies,
          realistic simulation, and deliberately gated execution.
        </p>
      </section>
      <section className="status" aria-label="Platform capabilities">
        {capabilities.map(([name, detail, state], index) => (
          <article key={name}>
            <span className="index">0{index + 1}</span>
            <div>
              <h2>{name}</h2>
              <p>{detail}</p>
            </div>
            <span className="badge">{state}</span>
          </article>
        ))}
      </section>
      <footer>
        <span>LIVE EXECUTION</span>
        <strong>{liveExecutionStatus}</strong>
      </footer>
    </main>
  );
}
