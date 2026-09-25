import {
  Lightbulb, LightbulbOff, Lamp, LampCeiling, LampDesk, LampFloor, LampWallUp, Flashlight, Sun, Sparkles, Wand2, Star, Moon, MoonStar,
  Plug, PlugZap, Zap, ZapOff, Power, PowerOff, BatteryCharging, Cable, Gauge, Activity, ToggleLeft, ToggleRight, CircuitBoard, Cpu,
  Thermometer, ThermometerSun, ThermometerSnowflake, Flame, Snowflake, Fan, Wind, Droplets, Droplet, Heater, AirVent, Waves, Cloud, CloudSun, CloudMoon, CloudRain,
  WashingMachine, Refrigerator, Microwave, CookingPot, Coffee, Utensils, UtensilsCrossed, ChefHat, Wine, Beer, Egg, Pizza, Croissant, IceCream, Cake,
  Tv, Speaker, Radio, Gamepad2, Monitor, Laptop, Printer, Router, Wifi, WifiOff, Smartphone, Projector, Headphones, Music, Disc3, Podcast, Film, Video,
  Sofa, Armchair, Bed, BedDouble, BedSingle, Bath, ShowerHead, Toilet, Home, House, Building, Building2, Warehouse, Car, CarFront, Bike, DoorOpen, DoorClosed, LayoutGrid, Blinds, Grid2x2,
  Trees, TreePine, TreeDeciduous, Flower, Flower2, Sprout, Leaf, Tent, Umbrella, Fence, Mountain, Sunrise, Sunset, Rainbow,
  Lock, Unlock, LockKeyhole, Key, KeyRound, Camera, Cctv, Bell, BellRing, Shield, ShieldAlert, ShieldCheck, Siren, Radar, Eye, EyeOff,
  Baby, Dog, Cat, Fish, Bird, PawPrint, User, Users, UserCheck, Dumbbell, HeartPulse, Stethoscope, Pill,
  BookOpen, Book, Clapperboard, PartyPopper, Timer, Clock, AlarmClock, Calendar, MapPin, Navigation, Compass, Wrench, Hammer, Drill, Cog, Settings,
  Package, Box, Archive, Trash2, Recycle, Brush, Paintbrush, Palette, Layers, Link2, SlidersHorizontal, Rocket, Plane, Ship, Train, Bus, Tractor, Anchor, Sailboat, Fuel,
  CircleDot, Circle, Square, Triangle, Hexagon, Wallet, Receipt, Euro, Coins, PiggyBank, Ghost, Skull, Smile, Mail, Phone, Mic, Volume2, Image, Newspaper, HardDrive, Server, Database,
} from "lucide-react";

export const ICON_CATEGORIES = [
  { key: "lighting", label: "Illuminazione", icons: {
    lightbulb: Lightbulb, "lightbulb-off": LightbulbOff, lamp: Lamp, "lamp-ceiling": LampCeiling, "lamp-desk": LampDesk, "lamp-floor": LampFloor, "lamp-wall": LampWallUp,
    flashlight: Flashlight, sun: Sun, sparkles: Sparkles, wand: Wand2, star: Star, moon: Moon, "moon-star": MoonStar,
  } },
  { key: "power", label: "Prese ed energia", icons: {
    plug: Plug, "plug-zap": PlugZap, zap: Zap, "zap-off": ZapOff, power: Power, "power-off": PowerOff, battery: BatteryCharging, cable: Cable, gauge: Gauge,
    activity: Activity, "toggle-left": ToggleLeft, "toggle-right": ToggleRight, circuit: CircuitBoard, cpu: Cpu,
  } },
  { key: "climate", label: "Clima", icons: {
    thermometer: Thermometer, "thermometer-sun": ThermometerSun, "thermometer-snowflake": ThermometerSnowflake, flame: Flame, snowflake: Snowflake, fan: Fan, wind: Wind,
    droplets: Droplets, droplet: Droplet, heater: Heater, "air-vent": AirVent, waves: Waves, cloud: Cloud, "cloud-sun": CloudSun, "cloud-moon": CloudMoon, "cloud-rain": CloudRain,
  } },
  { key: "appliances", label: "Elettrodomestici", icons: {
    "washing-machine": WashingMachine, refrigerator: Refrigerator, microwave: Microwave, "cooking-pot": CookingPot, coffee: Coffee, utensils: Utensils, "utensils-crossed": UtensilsCrossed,
    "chef-hat": ChefHat, wine: Wine, beer: Beer, egg: Egg, pizza: Pizza, croissant: Croissant, "ice-cream": IceCream, cake: Cake,
  } },
  { key: "media", label: "Media e tecnologia", icons: {
    tv: Tv, speaker: Speaker, radio: Radio, gamepad: Gamepad2, monitor: Monitor, laptop: Laptop, printer: Printer, router: Router, wifi: Wifi, "wifi-off": WifiOff,
    smartphone: Smartphone, projector: Projector, headphones: Headphones, music: Music, disc: Disc3, podcast: Podcast, film: Film, video: Video, "hard-drive": HardDrive, server: Server, database: Database,
  } },
  { key: "rooms", label: "Stanze e arredo", icons: {
    sofa: Sofa, armchair: Armchair, bed: Bed, "bed-double": BedDouble, "bed-single": BedSingle, bath: Bath, "shower-head": ShowerHead, toilet: Toilet, home: Home, house: House,
    building: Building, "building-2": Building2, warehouse: Warehouse, car: Car, "car-front": CarFront, bike: Bike, "door-open": DoorOpen, "door-closed": DoorClosed, "layout-grid": LayoutGrid, blinds: Blinds, grid: Grid2x2,
  } },
  { key: "outdoor", label: "Esterni e giardino", icons: {
    trees: Trees, "tree-pine": TreePine, "tree-deciduous": TreeDeciduous, flower: Flower, "flower-2": Flower2, sprout: Sprout, leaf: Leaf, tent: Tent, umbrella: Umbrella, fence: Fence,
    mountain: Mountain, sunrise: Sunrise, sunset: Sunset, rainbow: Rainbow,
  } },
  { key: "security", label: "Sicurezza", icons: {
    lock: Lock, unlock: Unlock, "lock-keyhole": LockKeyhole, key: Key, "key-round": KeyRound, camera: Camera, cctv: Cctv, bell: Bell, "bell-ring": BellRing, shield: Shield,
    "shield-alert": ShieldAlert, "shield-check": ShieldCheck, siren: Siren, radar: Radar, eye: Eye, "eye-off": EyeOff,
  } },
  { key: "people", label: "Persone e animali", icons: {
    baby: Baby, dog: Dog, cat: Cat, fish: Fish, bird: Bird, "paw-print": PawPrint, user: User, users: Users, "user-check": UserCheck, dumbbell: Dumbbell, "heart-pulse": HeartPulse, stethoscope: Stethoscope, pill: Pill,
  } },
  { key: "misc", label: "Varie", icons: {
    "book-open": BookOpen, book: Book, clapperboard: Clapperboard, "party-popper": PartyPopper, timer: Timer, clock: Clock, "alarm-clock": AlarmClock, calendar: Calendar, "map-pin": MapPin,
    navigation: Navigation, compass: Compass, wrench: Wrench, hammer: Hammer, drill: Drill, cog: Cog, settings: Settings, package: Package, box: Box, archive: Archive, trash: Trash2, recycle: Recycle,
    brush: Brush, paintbrush: Paintbrush, palette: Palette, layers: Layers, link: Link2, sliders: SlidersHorizontal, rocket: Rocket, plane: Plane, ship: Ship, train: Train, bus: Bus, tractor: Tractor,
    anchor: Anchor, sailboat: Sailboat, fuel: Fuel, "circle-dot": CircleDot, circle: Circle, square: Square, triangle: Triangle, hexagon: Hexagon, wallet: Wallet, receipt: Receipt, euro: Euro, coins: Coins,
    "piggy-bank": PiggyBank, ghost: Ghost, skull: Skull, smile: Smile, mail: Mail, phone: Phone, mic: Mic, volume: Volume2, image: Image, newspaper: Newspaper,
  } },
];

export const ICONS = Object.assign({}, ...ICON_CATEGORIES.map((c) => c.icons));
export const ICON_NAMES = Object.keys(ICONS);
export const iconFor = (name, fallback = Lightbulb) => ICONS[name] || fallback;

export const SCENE_ICONS = ["sparkles", "moon", "sun", "sunrise", "sunset", "clapperboard", "book-open", "coffee", "party-popper", "music", "tv", "bed", "power"];
export const SOFT_COLORS = ["#b08e54", "#b86b5a", "#8b7bb0", "#6fa3b5", "#8a9a7b", "#6f9a6a", "#8a8f99", "#a86b8a", "#d19a66", "#7c7ba8"];
