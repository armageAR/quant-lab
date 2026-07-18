import { InfoButton } from './components/info-button';
import { capabilities, liveExecutionStatus } from './content';

export default function Home() {
  return (
    <main>
      <section className="page-heading">
        <div>
          <span className="overline">PLATAFORMA DE INVESTIGACIÓN</span>
          <h1>Panel operativo</h1>
          <p>Evidencia reproducible antes de arriesgar capital.</p>
        </div>
        <InfoButton title="Qué hace Quant Lab">
          <p>
            Captura y normaliza mercados spot de Binance y Kraken, detecta
            spreads, estima su ejecutabilidad y conserva evidencia para
            investigación.
          </p>
          <p>
            Los backtests reproducen datasets congelados con modelos
            versionados. Ninguna pantalla autoriza ejecución real.
          </p>
        </InfoButton>
      </section>

      <section
        className="capability-grid"
        aria-label="Capacidades de plataforma"
      >
        {capabilities.map(([name, detail, state], index) => (
          <article key={name}>
            <span className="card-index">0{index + 1}</span>
            <div>
              <h2>{name}</h2>
              <p>{detail}</p>
            </div>
            <span className="badge">{state}</span>
          </article>
        ))}
      </section>

      <section className="action-grid">
        <a href="/opportunities">
          <span>01 / INVESTIGAR</span>
          <strong>Ver oportunidades</strong>
          <p>Filtrar señales, spreads, costos y resultados.</p>
        </a>
        <a href="/backtests">
          <span>02 / VALIDAR</span>
          <strong>Revisar backtests</strong>
          <p>Comparar replay, métricas, evidencia y gates.</p>
        </a>
      </section>

      <footer>
        <span>LIVE EXECUTION</span>
        <strong>{liveExecutionStatus}</strong>
      </footer>
    </main>
  );
}
