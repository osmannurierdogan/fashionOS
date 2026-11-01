import type { Category, Layer, Material, Occasion, Pattern, Season, Style } from "./taxonomy.js";
import type { PlanKey, Profile } from "./schemas.js";

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  plan: PlanKey;
  planRenewsAt: string | null;
  profile: Profile;
  usage: { aiTags: number; aiOutfits: number; periodStart: string };
  limits: { maxItems: number; aiTagsPerMonth: number; aiOutfitsPerMonth: number };
  itemCount: number;
  createdAt: string;
}

export interface ItemColor {
  hex: string;
  name?: string;
  ratio?: number;
}

export interface ItemDTO {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  colors: ItemColor[];
  pattern: Pattern;
  material: Material;
  seasons: Season[];
  warmth: number;
  formality: number;
  styles: Style[];
  layer: Layer;
  waterproof: boolean;
  brand: string;
  size: string;
  price: number | null;
  notes: string;
  favorite: boolean;
  archived: boolean;
  aiTagged: boolean;
  wearCount: number;
  lastWornAt: string | null;
  image: { url: string; thumbUrl: string; originalUrl: string | null; width: number; height: number };
  createdAt: string;
  updatedAt: string;
}

export interface WeatherDTO {
  tempC: number;
  feelsC: number;
  minC: number;
  maxC: number;
  precipitation: number; // mm
  precipitationProbability: number; // %
  windKmh: number;
  condition: string; // Türkçe açıklama
  code: number;
  isRainy: boolean;
  isSnowy: boolean;
  date: string;
  city?: string;
}

export interface OutfitDTO {
  id: string;
  name: string;
  itemIds: string[];
  items: ItemDTO[];
  occasion: Occasion | null;
  source: "ai" | "rules" | "manual";
  explanation: string;
  score: number | null;
  rating: -1 | 0 | 1;
  saved: boolean;
  plannedFor: string | null;
  wornCount: number;
  lastWornAt: string | null;
  weather: Partial<Pick<WeatherDTO, "tempC" | "feelsC" | "condition" | "precipitation">> | null;
  createdAt: string;
}

export interface SuggestionDTO {
  itemIds: string[];
  items: ItemDTO[];
  score: number;
  explanation: string;
  title: string;
  source: "ai" | "rules";
  breakdown?: Record<string, number>;
}

export interface SuggestResponse {
  suggestions: SuggestionDTO[];
  weather: WeatherDTO | null;
  aiUsed: boolean;
  aiError?: string;
  missing?: string[]; // kombin kurmak için eksik kategoriler
}

export interface StatsDTO {
  totalItems: number;
  byCategory: Record<string, number>;
  byColor: { key: string; name: string; hex: string; count: number }[];
  neverWorn: ItemDTO[];
  mostWorn: ItemDTO[];
  leastWornLongTime: ItemDTO[];
  totalValue: number;
  costPerWear: { item: ItemDTO; cpw: number }[];
  wearsLast30Days: number;
  gaps: string[];
}
