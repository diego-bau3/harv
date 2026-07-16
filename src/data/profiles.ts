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
  Route,
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
  status: "terminado" | "en-proceso" | "sin-iniciar";
  icon: LucideIcon;
  accent: string;
  tint: string;
};

export const profiles: Profile[] = [
  {
    id: "super-admin",
    name: "Super Admin",
    note: "Puede ver todo",
    status: "sin-iniciar",
    icon: ShieldCheck,
    accent: "#8f3f2b",
    tint: "#fff2e7"
  },
  {
    id: "administrador-planta",
    name: "Administrador de Planta",
    status: "sin-iniciar",
    icon: Factory,
    accent: "#ad5b2b",
    tint: "#fff5df"
  },
  {
    id: "finanzas",
    name: "Finanzas",
    status: "sin-iniciar",
    icon: Banknote,
    accent: "#7d5a2f",
    tint: "#f8f1dc"
  },
  {
    id: "ventas",
    name: "Ventas",
    status: "terminado",
    icon: HandCoins,
    accent: "#b64b39",
    tint: "#fff0ec"
  },
  {
    id: "compras",
    name: "Compras",
    status: "en-proceso",
    icon: ShoppingCart,
    accent: "#9b6b1f",
    tint: "#fff4cf"
  },
  {
    id: "ingenieria",
    name: "Ingeniería",
    status: "sin-iniciar",
    icon: HardHat,
    accent: "#82643a",
    tint: "#f7f0e3"
  },
  {
    id: "pre-produccion",
    name: "Preproducción",
    status: "en-proceso",
    icon: Route,
    accent: "#9a5438",
    tint: "#fff0e7"
  },
  {
    id: "produccion",
    name: "Producción",
    status: "sin-iniciar",
    icon: LineChart,
    accent: "#a4472d",
    tint: "#ffeee8"
  },
  {
    id: "almacen",
    name: "Almacén",
    status: "en-proceso",
    icon: Boxes,
    accent: "#775d2a",
    tint: "#fbf1d7"
  },
  {
    id: "fabricacion",
    name: "Fabricación",
    status: "en-proceso",
    icon: Factory,
    accent: "#98482f",
    tint: "#fff0e9"
  },
  {
    id: "ensamble",
    name: "Ensamble",
    status: "sin-iniciar",
    icon: PackageSearch,
    accent: "#9c6a36",
    tint: "#fff3e2"
  },
  {
    id: "calidad",
    name: "Calidad",
    status: "sin-iniciar",
    icon: BadgeCheck,
    accent: "#876633",
    tint: "#f8efd6"
  },
  {
    id: "prueba",
    name: "Prueba",
    status: "sin-iniciar",
    icon: TestTube2,
    accent: "#a04b3b",
    tint: "#fff1ee"
  },
  {
    id: "empaquetado-logistica",
    name: "Empaquetado y Logística",
    status: "sin-iniciar",
    icon: Truck,
    accent: "#88611f",
    tint: "#fff2d2"
  },
  {
    id: "seguridad",
    name: "Seguridad",
    status: "sin-iniciar",
    icon: ClipboardCheck,
    accent: "#7c4b39",
    tint: "#f9eee9"
  },
  {
    id: "mejora-continua",
    name: "Mejora Continua",
    status: "sin-iniciar",
    icon: Sparkles,
    accent: "#9d5031",
    tint: "#fff0e6"
  }
];
