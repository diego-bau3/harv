import type { ProductUnit } from "../sales/types";

export type PlantSupplyCategory = "quimico" | "consumible" | "empaque" | "documento" | "herramienta" | "otro";

export type PlantSupply = {
  id: string;
  name: string;
  category: PlantSupplyCategory;
  unit: ProductUnit;
  preferredSupplierId: string | null;
  stockMinimum: number;
  notes: string;
};
