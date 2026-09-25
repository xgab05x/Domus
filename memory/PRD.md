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
### Giugno 2026 (iter. 5) – Hardening post audit di sicurezza (101/101 test backend, flussi UI verificati)
- **SEC-001** `PATCH /api/settings` richiede il PIN per i campi sensibili (`pin_enabled`, `pin_protect_disarm`, `pin_protect_sensitive`, `alarm_ha_code`, `alarm_use_pin_as_code`, `alarm_entity_id`, `alarm_modes`, `alarm_zone_ids`, `alarm_armed`) → non è più possibile disattivare la protezione senza conoscere il PIN. Nuovo scope `config` in `require_pin()` e `updateSettingsSecure()` nel frontend (tab Sicurezza, Allarme, Backup).
- **SEC-002/004** Backup: `restore` e `import?restore=true` richiedono il PIN; `SETTINGS_EXCLUDE` esclude da snapshot e ripristino `pin_hash`, `pin_*`, `alarm_ha_code`, `alarm_armed`, `alarm_ha_state` (niente più segreti nei file scaricabili).
- **SEC-003** Il PIN sulle azioni sensibili (`privacy`, `siren`, `locked`) vale per **qualsiasi** tipo di entità e anche per l'attivazione delle **scene** che contengono quelle azioni.
- **SEC-005** `/api/ha/proxy` limitato a un allowlist di prefissi HA (camera/image/media_player/tts proxy), `/api/ha/hls/{path}` validato con regex, URL di cast accettato solo `http(s)` e senza credenziali nell'host. CORS: `allow_credentials` disattivato quando le origin sono `*`; PIN di default non più scritto nei log.
- Safety UX: la modalità `disarmed` è sempre forzata in `alarm_modes`.
- Code quality: key React stabili al posto degli indici, catch non più silenziosi (log), token del finto HA da variabile d'ambiente `FAKE_HA_TOKEN`.

### Giugno 2026 (iter. 4) – 22/22 test backend + flussi UI verificati
- **PIN di sicurezza** (`pin.py`, PBKDF2-SHA256 200k iterazioni, hash in `settings`, lockout 60s dopo 5 tentativi): PIN richiesto per **disarmare** l'allarme e per le **azioni sensibili** (apri porta citofono, privacy telecamera, sirena). Tastierino `PinDialog`, `askPin()` nel context, tab Impostazioni → **Sicurezza** (`PinSettings.jsx`) con toggle e cambio PIN. PIN iniziale `1234`. Endpoint `/api/pin/status|verify|change`, enforcement server-side su `/api/alarm/set/{mode}`, `/api/intercom/{id}/answer?action=unlock` e `PATCH /api/entities/{id}` (privacy/siren/locked).
- **Pannello allarme HA reale**: tab Impostazioni → **Allarme** (`AlarmSettings.jsx`) con selezione dell'entità `alarm_control_panel.*`, modalità supportate (`supported_features` → disarmed/home/away/night/vacation/custom), zone Domus appartenenti al pannello, codice HA (PIN Domus come codice o codice dedicato). Autorilevamento del pannello all'import HA, `GET /api/alarm/panels|state`, armamento/disarmo reali via `alarm_control_panel.*` e sync bidirezionale (stato HA → `settings.alarm_armed`, push websocket `type: "settings"`). `AlarmPanel.jsx` mostra le modalità configurate, lo stato del pannello (arming/pending/triggered) e i badge pannello HA / PIN.
- **Stream video reale**: `CameraPlayer.jsx` con **hls.js** → HLS da HA (`camera/stream` via WS, proxy `/api/ha/hls/{path}`) con fallback automatico MJPEG (`/api/cameras/{id}/stream`, ora con controllo di stato upstream) → snapshot ogni 5s → immagine demo; badge con la sorgente attiva.
- **Cast su schermi**: `CastDialog.jsx` dalla tab Media (TV/Nest Hub/Echo Show) per trasmettere una **telecamera** (`camera.play_stream`) o una **dashboard Domus** (Sol Invictus, Terminus, viste custom, URL libero via `media_player.play_media` type `url`); badge "In trasmissione" sulla card e **Stop trasmissione** (`media_player.media_stop`). Endpoint `/api/cast/{id}` e `/api/cast/{id}/stop`.
- **Micro-animazioni**: `press` (scale al tocco), `pop-in` sull'icona di accensione, `glow-on` all'accensione luci/prese, `pulse-ring` su cast attivo e PIN, ingressi `stagger` su griglia dispositivi e camere, `shake` sul PIN errato, rispetto di `prefers-reduced-motion`.

### Febbraio-Giugno 2026 (iter. 1-3)
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
- P1: WebRTC/go2rtc a latenza minima come alternativa all'HLS nel dettaglio camera.
- P2: split di `server.py` per dominio (settings/backup/ha/alarm/cameras/cast) — file ~2600 righe.
- P2: editor automazioni visuale; ordinamento drag&drop viste/stanze; storico eventi persistente per sensore.
- P2: notifiche push (mobile) su campanello/allarme.
- P2: log accessi PIN (chi ha disarmato e quando) e PIN multipli per utente/ospite.
