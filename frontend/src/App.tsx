import React, { useState } from 'react';
import styles from './App.module.css';
import type { MultiFlightSearchResponse, MultiSearchParams } from './types/flight';

const ARGENTINA_AIRPORTS = [
  { code: 'EZE', name: 'Ezeiza', city: 'Buenos Aires (EZE)' },
  { code: 'AEP', name: 'Aeroparque', city: 'Buenos Aires (AEP)' },
  { code: 'COR', name: 'Córdoba', city: 'Córdoba (COR)' },
  { code: 'MDZ', name: 'Mendoza', city: 'Mendoza (MDZ)' },
  { code: 'ROS', name: 'Rosario', city: 'Rosario (ROS)' },
];

const DENMARK_AIRPORTS = [
  { code: 'CPH', name: 'Copenhague (CPH)' },
  { code: 'BLL', name: 'Billund (BLL)' },
  { code: 'MMX', name: 'Malmö (MMX - Suecia)' },
  { code: 'HAM', name: 'Hamburgo (HAM - Alemania)' },
];

export const App: React.FC = () => {
  const [params, setParams] = useState<MultiSearchParams>({
    origins: ['EZE', 'AEP'],
    destinations: ['CPH'],
    startDate: '2027-03-30',
    endDate: '2027-04-03',
    passengers: 1,
    maxStops: 2,
  });

  const [response, setResponse] = useState<MultiFlightSearchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toggleOrigin = (code: string) => {
    setParams((prev) => {
      const exists = prev.origins.includes(code);
      if (exists) {
        if (prev.origins.length === 1) return prev; // Keep at least one
        return { ...prev, origins: prev.origins.filter((o) => o !== code) };
      } else {
        return { ...prev, origins: [...prev.origins, code] };
      }
    });
  };

  const selectAllArgentina = () => {
    setParams((prev) => ({
      ...prev,
      origins: ARGENTINA_AIRPORTS.map((a) => a.code),
    }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        origins: params.origins.join(','),
        destinations: params.destinations.join(','),
        startDate: params.startDate,
        endDate: params.endDate,
        passengers: params.passengers.toString(),
        ...(params.maxStops !== undefined ? { maxStops: params.maxStops.toString() } : {}),
      });

      const res = await fetch(`http://localhost:3000/flights/search-multi?${query.toString()}`);
      if (!res.ok) {
        throw new Error(`Error en el servidor: ${res.statusText}`);
      }

      const data: MultiFlightSearchResponse = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'No se pudo conectar con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>✈️ Argentina → Dinamarca Finder</h1>
        <p>Búsqueda inteligente multi-aeropuerto, rango de fechas y optimización de precios</p>
      </header>

      <div className={styles.card}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className={styles.sectionTitle}>Aeropuertos de Origen (Argentina):</span>
            <button
              type="button"
              onClick={selectAllArgentina}
              style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Seleccionar: Toda Argentina
            </button>
          </div>

          <div className={styles.checkboxGroup}>
            {ARGENTINA_AIRPORTS.map((ap) => {
              const active = params.origins.includes(ap.code);
              return (
                <label
                  key={ap.code}
                  className={`${styles.pillLabel} ${active ? styles.pillLabelActive : ''}`}
                  onClick={() => toggleOrigin(ap.code)}
                >
                  <input type="checkbox" checked={active} readOnly />
                  {active ? '✓ ' : '+ '}
                  {ap.code} ({ap.name})
                </label>
              );
            })}
          </div>

          <div className={styles.searchGrid}>
            <div className={styles.field}>
              <label>Salida Desde</label>
              <input
                type="date"
                value={params.startDate}
                onChange={(e) => setParams({ ...params, startDate: e.target.value })}
                required
              />
            </div>

            <div className={styles.field}>
              <label>Salida Hasta (Rango de fechas)</label>
              <input
                type="date"
                value={params.endDate}
                onChange={(e) => setParams({ ...params, endDate: e.target.value })}
                required
              />
            </div>

            <div className={styles.field}>
              <label>Destino Principal</label>
              <select
                value={params.destinations[0] || 'CPH'}
                onChange={(e) => setParams({ ...params, destinations: [e.target.value] })}
              >
                {DENMARK_AIRPORTS.map((ap) => (
                  <option key={ap.code} value={ap.code}>
                    {ap.code} - {ap.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Máximo Escalas</label>
              <select
                value={params.maxStops ?? 2}
                onChange={(e) => setParams({ ...params, maxStops: parseInt(e.target.value, 10) })}
              >
                <option value={0}>Directo (0 escalas)</option>
                <option value={1}>Máximo 1 escala</option>
                <option value={2}>Máximo 2 escalas</option>
              </select>
            </div>
          </div>

          <button type="submit" className={styles.searchButton} disabled={loading}>
            {loading ? '🔍 Buscando mejores alternativas...' : '✈️ BUSCAR OFERTAS Y COMPARAR RANGOS'}
          </button>
        </form>
      </div>

      {error && <div className={styles.noResults} style={{ color: '#dc2626' }}>❌ {error}</div>}

      {loading && (
        <div className={styles.loading}>
          🔄 Consultando fechas y combinaciones de aeropuertos...
        </div>
      )}

      {!loading && response && (
        <>
          {/* Calendar / Price Matrix Section */}
          <div className={styles.summarySection}>
            <div className={styles.summaryHeader}>
              <h3>📅 Comparativa de Precios por Fecha</h3>
              <div className={styles.statsBadge}>
                ⚡ {response.stats.cachedHits} servidas desde Caché | 🌐 {response.stats.apiCalls} consultas API realizadas
              </div>
            </div>

            <div className={styles.matrixGrid}>
              {response.dateSummaries.map((summary) => (
                <div
                  key={summary.date}
                  className={`${styles.matrixCard} ${summary.isBestPrice ? styles.matrixCardBest : ''}`}
                >
                  <span className={styles.matrixDate}>{summary.date}</span>
                  <span className={styles.matrixPrice}>USD ${summary.lowestPrice}</span>
                  <span className={styles.matrixRoute}>{summary.origin} → {summary.destination}</span>
                  {summary.isBestPrice && <span className={styles.bestTag}>🟢 Mejor Precio</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Results List */}
          <div className={styles.resultsSection}>
            <h3>✈️ Resultados Encontrados ({response.offers.length} opciones)</h3>

            {response.offers.map((offer) => (
              <div key={offer.id} className={styles.flightCard}>
                <div className={styles.mainInfo}>
                  <div className={styles.airlineRow}>
                    {offer.airlineLogo && <img src={offer.airlineLogo} alt={offer.airline} />}
                    <span className={styles.airlineName}>{offer.airline}</span>
                    {offer.selfTransfer && (
                      <span className={styles.selfTransferBadge}>
                        ⚠️ SELF-TRANSFER (Vuelos independientes)
                      </span>
                    )}
                  </div>

                  <div className={styles.routeDetails}>
                    <div className={styles.timeBlock}>
                      <span className={styles.time}>{offer.departureTime || 'Salida'}</span>
                      <span className={styles.airport}>{offer.origin} ({offer.departureDate})</span>
                    </div>

                    <div className={styles.durationBlock}>
                      <span className={styles.duration}>{offer.duration}</span>
                      <div className={styles.line}></div>
                      <span className={styles.stopsBadge}>
                        {offer.stops === 0 ? 'Directo' : `${offer.stops} escala(s)`}
                      </span>
                    </div>

                    <div className={styles.timeBlock}>
                      <span className={styles.time}>{offer.arrivalTime || 'Llegada'}</span>
                      <span className={styles.airport}>{offer.destination}</span>
                    </div>
                  </div>

                  <div className={styles.segmentDetail}>
                    <strong>Itinerario:</strong>{' '}
                    {offer.segments.map((s, idx) => (
                      <span key={idx}>
                        {idx > 0 ? ' ➔ ' : ''}
                        {s.airline} ({s.flightNumber}): {s.departureAirport} → {s.arrivalAirport}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.priceBlock}>
                  <span className={styles.price}>USD ${offer.price}</span>
                  {offer.bookingUrl && (
                    <a
                      href={offer.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.bookButton}
                    >
                      Ver en Google Flights
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default App;
