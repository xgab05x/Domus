# Domus - PRD

## Original Problem Statement (IT)
Interfaccia grafica web per gestire la domotica Home Assistant. Mini PC Linux Ubuntu esegue HA + server HTTP. Progetto "Domus" con due sezioni: "Sol Invictus" (luci, prese, scene, automazioni, dimmer, colori) e "Terminus" (videosorveglianza, citofono, antintrusione). Universi: Sonoff (eWeLink), Tuya (Smart Life), Tapo, Blink.

## User Choices
- HA integration: MOCK data (no real HA wiring)
- Auth: none (accesso libero)
- Style: light-mode preferito ma decide design agent; bubble trasparenti su sfondi colorati
- Cameras: via HA camera entities (proxy mock)
- Ingresso: diretto in Sol Invictus (no dashboard iniziale)
- Extra: switch rapido tra sezioni, colori dinamici in base a sole/ora/coordinate, settings modificabili (zona, indirizzo, colori dinamici on/off, light/dark), CRUD stanze, spostamento entità, assegnazione dispositivi rilevati.

## Architecture
- Backend: FastAPI + Motor (MongoDB). Routes prefissate /api. Seed automatico al primo avvio (rooms, entities, discovered, settings, events).
- Frontend: React 19 + React Router + Tailwind + shadcn/ui + Sonner. State via DomusContext, API in src/lib/api.js.
- Solar engine: src/lib/solar.js calcola alba/tramonto da lat/lon + data locale; fasi dawn/day/sunset/night.
- Theming: `auto` segue il sole (dark durante `night`), oppure `light`/`dark` forzati.

## Implemented (Feb 2026)
- Sol Invictus: filtri per stanza, scene/automazioni bubble, luci con brightness slider + color picker, prese con wattaggio, termostato con target slider, drag menu per spostare entità, delete entità.
- Terminus: griglia camere con expand focus view + PTZ mock + rec toggle, citofono con simulate ring / unlock / hangup / mute, pannello antintrusione con 3 modes (disarmed/home/away) + zone bypass, timeline eventi.
- Settings dialog: home name, address + geocoding via Nominatim, lat/lon manuali, dynamic colors toggle, theme auto/light/dark, mock HA integration status.
- Room manager: CRUD stanze con colori preset; on delete le entità diventano non assegnate.
- Unassigned drawer: assegna dispositivi rilevati a una stanza, simula nuovi rilevamenti.
- Escape key chiude dialoghi.

## Backlog / Future
- P1: WebSocket a HA reale con Long-Lived Token; sostituire il seed con l'inventario HA.
- P1: Registrazione/rewind camere reali (Frigate / HA stream).
- P2: Editor di automazioni visuale (trigger/action/condition), storicizzazione consumi presa (grafico).
- P2: Drag&drop nativo tra stanze; ordinamento delle stanze.
- P2: Notifiche push su eventi antintrusione.
