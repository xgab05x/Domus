# Domus - PRD

## Original Problem Statement (IT)
Interfaccia grafica web per gestire la domotica Home Assistant. Mini PC Linux Ubuntu esegue HA + server HTTP. Progetto "Domus" con due sezioni: "Sol Invictus" (luci, prese, scene, automazioni, dimmer, colori, clima, consumi, media) e "Terminus" (videosorveglianza, videocitofoni, citofono, antintrusione). Universi: Sonoff (eWeLink), Tuya (Smart Life), Tapo, Blink, Alexa/Echo, Google/Android TV, Fire TV. L'app deve gestire l'intera domotica e sicurezza della casa prendendo TUTTE le entità da Home Assistant.

## User Choices
- HA integration: connettore REALE (REST + WebSocket, URL + Long-Lived Token nelle Impostazioni) con fallback automatico in modalità Demo quando HA non è raggiungibile (giugno 2026)
- Auth: none (accesso libero)
- Lingua UI: Italiano
- Style: glassmorphism trasparente, sfondo dinamico cielo/meteo, banner e loghi custom in /public/brand/
- Media: tab "Media" in Sol Invictus con controllo completo (now playing, volume, trasporto, sorgenti, app, TTS, notifiche su schermo)
- Backup: JSON locali sul mini PC, cartella scelta dall'utente (default /var/lib/domus/backups), automatici (ora/giorno/settimana) con retention, import/ripristino/download

## Architecture
- Backend: FastAPI + Motor (MongoDB). Routes prefissate /api. Seed automatico (SEED_VERSION=4).
  - `server.py`: modelli, seed, CRUD, energia, clima, viste, media, camere, backup routes, websocket `/api/ws` (push realtime al browser)
  - `ha_client.py`: HAClient (REST + WS subscribe state_changed), `map_entities()` (HA → Domus: light/switch/plug/camera/doorbell/alarm_zone/sensor/meter/thermostat/media_player/scene/automation, controlli figli: privacy, night_vision, motion, siren, led, flip, ptz_preset, battery, signal, power/energy…), `services_for_patch()` (Domus → HA), media/tts/notify service mapping
  - `backup.py`: snapshot/create/list/restore/prune/scheduler
  - `tests/fake_ha.py`: finto Home Assistant (127.0.0.1:8123, token demo-token) per test del connettore
- Frontend: React 19 + Tailwind + shadcn/ui + Sonner + Recharts. State via DomusContext (polling 30s + WebSocket live), API in src/lib/api.js.

## Implemented
### Feb 2026 (iter. 1-2)
- Sol Invictus: stanze, luci (dimmer/colore/ColorWheel), prese con wattaggio, gruppi sync/placche, scene, clima multi-zona (TempDial), Consumi (contatori virtuali, grafici donut/radiali/linee, costi fissi+variabili), IconPicker, stato offline/online, notifiche.
- Terminus: camere, citofono, antintrusione, eventi. Sfondo dinamico cielo/meteo (Open-Meteo). Banner/loghi utente animati.

### Giugno 2026 (iter. 3) – tutto testato (34/34 backend, frontend OK)
- BUG FIX: nomi dispositivi Terminus mai troncati (wrap 2 righe) in card, pannello allarme, camere.
- Terminus: SecurityCard + SensorDetail (stato, batteria, segnale, manomissione, cronologia, rename, tipo sensore, stanza, icona, bypass, simula, appartenenza viste, elimina).
- Viste personalizzate (`/api/views` CRUD, ViewEditor): tab "Tutto" + viste (seed: Perimetro Esterno, Interno Notte), layout griglia/compatta, filtro camere/citofoni/sensori/zone.
- CameraDetail: privacy, visione notturna auto/on/off, rilevamento movimento, sirena, LED, flip, registrazione, PTZ pad + preset, snapshot (proxy HA), simula movimento, rename/stanza/icona; videocitofoni (type `doorbell`) con suona/apri porta (relock 8s)/riaggancia/mute/chime.
- Media (`media_player`): MediaPanel/MediaCard/MediaDetail/AnnouncePanel; comandi `/api/media/{id}/command`, TTS `/api/media/tts` (Alexa Media announce / tts.speak / google_translate_say), notifiche schermo `/api/media/notify` (notify.android_tv_* ecc.).
- Connettore Home Assistant: Impostazioni → tab Home Assistant (URL, token mascherato, test, importa tutte le entità + stanze dalle aree, elenco entità HA, rimuovi token). Live sync bidirezionale via WS; header pill "Demo"/"HA live". Simulazioni (consumi, offline, clima) sospese per entità collegate quando HA è live.
- Backup: tab Backup (cartella, automatico off/ora/giorno/settimana, retention, crea, ripristina, scarica, importa file, elimina). Scheduler in background.
- Tab Problemi: offline, batterie basse (<25%), avvisi non letti, stato HA; toggle simulazione guasti e pallino online.

## Backlog / Future
- P1: stream video reale (HLS/WebRTC via HA `camera/stream` o go2rtc) al posto dello snapshot MJPEG proxy.
- P1: mappatura `alarm_control_panel` HA esplicita (oggi: primo pannello trovato) e zone reali del pannello.
- P2: editor automazioni visuale; ordinamento drag&drop viste/stanze; storico eventi persistente per sensore.
- P2: notifiche push (mobile) su campanello/allarme; PIN per disarmo.
- P2: Cast di dashboard/URL su Nest Hub/Android TV (media_player.play_media type cast).
