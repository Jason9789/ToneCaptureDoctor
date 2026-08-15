export function App() {
  return (
    <main className="app-shell" data-testid="dashboard">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local-first audio diagnostics</p>
          <h1>ToneCaptureDoctor</h1>
        </div>
        <span className="status-pill">Design baseline</span>
      </header>

      <section className="hero" aria-labelledby="signal-health-title">
        <div>
          <p className="eyebrow">First mode</p>
          <h2 id="signal-health-title">Signal Health</h2>
          <p className="hero-copy">
            Check whether an instrument signal is reaching your interface before comparing tones.
            The first release keeps analysis local and explains the next useful experiment.
          </p>
        </div>
        <div className="connection-card" aria-label="Audio input status">
          <span className="connection-dot" aria-hidden="true" />
          <div>
            <strong>No audio input connected</strong>
            <p>This shell does not request microphone permission yet.</p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid" aria-label="Signal health dashboard">
        <article className="panel panel-primary">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Input overview</p>
              <h3>Ready when you are</h3>
            </div>
            <span className="panel-index">01</span>
          </div>
          <p>
            Connect a guitar or bass to an instrument/Hi-Z input. The next phase will ask for
            permission only after you choose to start.
          </p>
          <button type="button" disabled>
            Start Signal Health
          </button>
        </article>

        <article className="panel">
          <p className="eyebrow">What will be measured</p>
          <ul className="metric-list">
            <li>Peak and RMS level</li>
            <li>Noise floor and clipping candidates</li>
            <li>Waveform and frequency overview</li>
          </ul>
        </article>

        <article className="panel safety-panel">
          <p className="eyebrow">Safe routing</p>
          <h3>Instrument input only</h3>
          <p>
            Never connect a tube amplifier speaker output directly to an interface input. Use a
            microphone, load box, DI, or another manufacturer-approved path.
          </p>
        </article>
      </section>
    </main>
  );
}
