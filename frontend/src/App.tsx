import React, { useState } from 'react';
import styles from './App.module.css';
import type { FlightOffer, SearchParams } from './types/flight';

const ARGENTINA_AIRPORTS = [
  { code: 'EZE', name: 'Ezeiza (Buenos Aires)' },
  { code: 'AEP', name: 'Aeroparque (Buenos Aires)' },
  { code: 'COR', name: 'Córdoba (COR)' },
  { code: 'MDZ', name: 'Mendoza (MDZ)' },
  { code: 'ROS', name: 'Rosario (ROS)' },
];

const DENMARK_AIRPORTS = [
  { code: 'CPH', name: 'Copenhague (CPH)' },
  { code: 'BLL', name: 'Billund (BLL)' },
  { code: 'MMX', name: 'Malmö (MMX - Cercano)' },
  { code: 'HAM', name: 'Hamburgo (HAM - Cercano)' },
];

export const App: React.FC = () => {
  const [params, setParams] = useState<SearchParams>({
    origin: 'EZE',
    destination: 'CPH',
    departureDate: '2027-03-30',
    passengers: 1,
    maxStops: 2,
  });

  const [flights, setFlights] = useState<FlightOffer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState<boolean>(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const query = new URLSearchParams({
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        passengers: params.passengers.toString(),
        ...(params.maxStops !== undefined ? { maxStops: params.maxStops.toString() } : {}),
        ...(params.returnDate ? { returnDate: params.returnDate } : {}),
      });

      const response = await fetch(`http://localhost:3000/flights/search?${query.toString()}`);
      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.statusText}`);
      }

      const data: FlightOffer[] = await response.json();
      setFlights(data);
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
        <p>Buscador inteligente de mejores ofertas y rutas alternativas</p>
      </header>

      <div className={styles.card}>
        <form onSubmit={handleSearch}>
          <div className={styles.searchGrid}>
            <div className={styles.field}>
              <label>Origen (Argentina)</label>
              <select
                value={params.origin}
                onChange={(e) => setParams({ ...params, origin: e.target.value })}
              >
                {ARGENTINA_AIRPORTS.map((ap) => (
                  <option key={ap.code} value={ap.code}>
                    {ap.code} - {ap.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Destino (Europa / Dinamarca)</label>
              <select
                value={params.destination}
                onChange={(e) => setParams({ ...params, destination: e.target.value })}
              >
                {DENMARK_AIRPORTS.map((ap) => (
                  <option key={ap.code} value={ap.code}>
                    {ap.code} - {ap.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Fecha de Salida</label>
              <input
                type="date"
                value={params.departureDate}
                onChange={(e) => setParams({ ...params, departureDate: e.target.value })}
                required
              />
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
            {loading ? '🔍 Buscando mejores vuelos...' : '✈️ BUSCAR VUELOS'}
          </button>
        </form>
      </div>

      {error && <div className={styles.noResults} style={{ color: '#dc2626' }}>❌ {error}</div>}

      {loading && <div className={styles.loading}>🔄 Consultando APIs de vuelos en tiempo real...</div>}

      {!loading && searched && flights.length === 0 && !error && (
        <div className={styles.noResults}>No se encontraron vuelos para la combinación solicitada.</div>
      )}

      <div className={styles.resultsSection}>
        {flights.map((offer) => (
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
                  <span className={styles.airport}>{offer.origin}</span>
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
                <strong>Escalas / Itinerario:</strong>{' '}
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
    </div>
  );
};

export default App;
