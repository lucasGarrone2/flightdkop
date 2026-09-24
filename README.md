# ✈️ Argentina → Dinamarca Finder

Aplicación web personal full-stack para encontrar, ranking-ear y recibir alertas automáticas en Telegram de las mejores ofertas de vuelos desde Argentina a Dinamarca y rutas alternativas en Europa.

---

## 🚀 Características Principales

* **Búsqueda Multi-Aeropuerto:** Busca simultáneamente en `EZE`, `AEP`, `COR`, `MDZ` y `ROS` hacia `CPH`, `BLL`, `MMX` (Malmö) o `HAM` (Hamburgo).
* **Matriz de Fechas Flexibles:** Compara un rango de fechas y resalta automáticamente el 🟢 **Mejor Precio**.
* **Motor de Ranking Inteligente (0 a 100 Pts):** Ordena ofertas evaluando Precio (50%), Duración (25%), Escalas (15%) y Protección de Conexión (10%).
* **Advertencia de Self-Transfer:** Detecta y advierte `⚠️ SELF-TRANSFER` cuando un itinerario utiliza billetes independientes.
* **Caché Inteligente ($0 Costo):** Guarda búsquedas por 6 horas para minimizar el consumo de la cuota de la API.
* **Persistencia con Prisma ORM:** Guarda el historial de búsquedas y ofertas en base de datos.
* **Alertas por Bot de Telegram:** Notificaciones automáticas de precios bajos directamente a tu celular.
* **Escaneo Automático (Cron Job):** Programado diariamente a las 9:00 AM con opción de disparar escaneo manual desde la UI.
* **Enlaces Directos a Google Flights:** Botón `Ver en Google Flights ↗` prefiltrado exactamente para el origen, destino y fecha seleccionada.

---

## 🛠️ Tech Stack ($0 Costo)

* **Frontend:** React 19, Vite, TypeScript, CSS Modules (Sin Tailwind).
* **Backend:** NestJS 12, TypeScript, RxJS, `@nestjs/schedule`.
* **ORM & Database:** Prisma ORM, SQLite (`dev.db` en desarrollo) / PostgreSQL (Supabase en producción).
* **APIs & Alertas:** SerpApi (Google Flights Engine), Telegram Bot API.

---

## ⚙️ Variables de Entorno (`.env`)

Crea un archivo `.env` dentro de la carpeta `backend/`:

```env
PORT=3000
SERPAPI_KEY=tu_serpapi_key_aqui
DATABASE_URL="file:./dev.db"
TELEGRAM_BOT_TOKEN=tu_telegram_bot_token
TELEGRAM_CHAT_ID=tu_telegram_chat_id
```

---

## 💻 Instalación y Ejecución Local

### 1. Clonar e Instalar Backend:
```bash
cd backend
npm install
npx prisma db push
npm run start:dev
```
*(Se ejecutará en `http://localhost:3000`)*

### 2. Instalar y Ejecutar Frontend:
```bash
cd frontend
npm install
npm run dev
```
*(Se ejecutará en `http://localhost:5173`)*

---

## ☁️ Guía de Despliegue Gratuito ($0 Costo)

1. **Frontend (Vercel):**
   * Conecta tu repositorio de GitHub a Vercel.
   * Root Directory: `frontend`
   * Build Command: `npm run build`
   * Output Directory: `dist`

2. **Backend (Render):**
   * Crea un **Free Web Service** en Render desde tu repositorio.
   * Root Directory: `backend`
   * Build Command: `npm install && npm run build`
   * Start Command: `npm run start:prod`
   * Carga las variables de entorno (`SERPAPI_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DATABASE_URL`).

3. **Base de Datos (Supabase):**
   * Crea un proyecto **Free Tier** en Supabase.
   * Copia la cadena de conexión PostgreSQL a la variable `DATABASE_URL` en Render.
