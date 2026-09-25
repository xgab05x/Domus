import {
  Lightbulb, Lamp, Wand2, Plug, Thermometer, Sparkles, Moon, Clapperboard, Sunrise, Sunset, PowerOff, Power, UserCheck,
  ToggleLeft, Flame, Fan, Gauge, Snowflake, LayoutGrid, Link2, BookOpen, Coffee, PartyPopper, Bed, Sofa, ChefHat, Bath,
  Trees, Car, DoorOpen, Home, Cctv, Bell, Radar, ShieldAlert, DoorClosed, Sun, Star, Music, Tv,
} from "lucide-react";

export const ICONS = {
  lightbulb: Lightbulb, lamp: Lamp, wand: Wand2, plug: Plug, thermometer: Thermometer, sparkles: Sparkles, moon: Moon,
  clapperboard: Clapperboard, sunrise: Sunrise, sunset: Sunset, "power-off": PowerOff, power: Power, "user-check": UserCheck,
  "toggle-left": ToggleLeft, flame: Flame, fan: Fan, gauge: Gauge, snowflake: Snowflake, "layout-grid": LayoutGrid, link: Link2,
  "book-open": BookOpen, coffee: Coffee, "party-popper": PartyPopper, bed: Bed, sofa: Sofa, "chef-hat": ChefHat, bath: Bath,
  trees: Trees, car: Car, "door-open": DoorOpen, home: Home, cctv: Cctv, bell: Bell, radar: Radar, "shield-alert": ShieldAlert,
  "door-closed": DoorClosed, sun: Sun, star: Star, music: Music, tv: Tv,
};

export const iconFor = (name, fallback = Lightbulb) => ICONS[name] || fallback;

export const SCENE_ICONS = ["sparkles", "moon", "sun", "sunrise", "sunset", "clapperboard", "book-open", "coffee", "party-popper", "music", "tv", "bed", "power"];
export const SOFT_COLORS = ["#b08e54", "#b86b5a", "#8b7bb0", "#6fa3b5", "#8a9a7b", "#6f9a6a", "#8a8f99", "#a86b8a", "#d19a66", "#7c7ba8"];
