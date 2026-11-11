# Beacon · Frontend

Interfaz de Beacon. Cada módulo vive en su propia rama; esta es la del módulo **Aplicaciones aéreas** (`aplicaciones-aereas`).
La API está en [JuanCarlosIT/beacon-backend](https://github.com/JuanCarlosIT/beacon-backend), en la rama del mismo nombre.

React 19 + Vite + Tailwind CSS v4, organizado por módulos con arquitectura limpia
(`src/modules/<módulo>/domain`, `application`, `infrastructure`, `presentation`; lo común en `src/shared`).

## Arranque

```bash
npm install
npm run dev     # http://localhost:5173 (https si existe certs/app.crt)
```

Vite manda `/api` al backend en `http://127.0.0.1:3001`, así que el backend debe estar corriendo.

Para abrirla desde otros equipos de la red con https, genera el certificado local con `scripts/crear-certificado.sh`.
La carpeta `certs/` tiene llaves privadas y nunca se versiona.

## Comandos

```bash
npm test               # pruebas de dominio, casos de uso y presentación
npm run build          # compilación en dist/
npm run format:check   # formato con Prettier
```
