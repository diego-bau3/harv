import {
  BadgeCheck,
  Banknote,
  Boxes,
  ClipboardCheck,
  Factory,
  HandCoins,
  HardHat,
  Headset,
  LineChart,
  PackageCheck,
  PackageSearch,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TestTube2,
  Truck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Profile = {
  id: string;
  name: string;
  note?: string;
  icon: LucideIcon;
  accent: string;
  tint: string;
};

export const profiles: Profile[] = [
  {
    id: "super-admin",
    name: "Super Admin",
    note: "Puede ver todo",
    icon: ShieldCheck,
    accent: "#8f3f2b",
    tint: "#fff2e7"
  },
  {
    id: "administrador-planta",
    name: "Administrador de Planta",
    icon: Factory,
    accent: "#ad5b2b",
    tint: "#fff5df"
  },
  {
    id: "finanzas",
    name: "Finanzas",
    icon: Banknote,
    accent: "#7d5a2f",
    tint: "#f8f1dc"
  },
  {
    id: "ventas",
    name: "Ventas",
    icon: HandCoins,
    accent: "#b64b39",
    tint: "#fff0ec"
  },
  {
    id: "compras",
    name: "Compras",
    icon: ShoppingCart,
    accent: "#9b6b1f",
    tint: "#fff4cf"
  },
  {
    id: "ingenieria",
    name: "Ingeniería",
    icon: HardHat,
    accent: "#82643a",
    tint: "#f7f0e3"
  },
  {
    id: "produccion",
    name: "Producción",
    icon: LineChart,
    accent: "#a4472d",
    tint: "#ffeee8"
  },
  {
    id: "almacen",
    name: "Almacén",
    icon: Boxes,
    accent: "#775d2a",
    tint: "#fbf1d7"
  },
  {
    id: "fabricacion",
    name: "Fabricación",
    icon: Factory,
    accent: "#98482f",
    tint: "#fff0e9"
  },
  {
    id: "ensamble",
    name: "Ensamble",
    icon: PackageSearch,
    accent: "#9c6a36",
    tint: "#fff3e2"
  },
  {
    id: "calidad",
    name: "Calidad",
    icon: BadgeCheck,
    accent: "#876633",
    tint: "#f8efd6"
  },
  {
    id: "prueba",
    name: "Prueba",
    icon: TestTube2,
    accent: "#a04b3b",
    tint: "#fff1ee"
  },
  {
    id: "empaquetado-logistica",
    name: "Empaquetado y Logística",
    icon: Truck,
    accent: "#88611f",
    tint: "#fff2d2"
  },
  {
    id: "seguridad",
    name: "Seguridad",
    icon: ClipboardCheck,
    accent: "#7c4b39",
    tint: "#f9eee9"
  },
  {
    id: "mejora-continua",
    name: "Mejora Continua",
    icon: Sparkles,
    accent: "#9d5031",
    tint: "#fff0e6"
  }
];
