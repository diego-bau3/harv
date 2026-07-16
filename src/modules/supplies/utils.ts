import type { PlantSupply } from "./types";

export const plantSupplyCategoryLabels: Record<PlantSupply["category"], string> = {
  quimico: "Quimico",
  consumible: "Consumible",
  empaque: "Empaque",
  documento: "Documento",
  herramienta: "Herramienta",
  otro: "Otro"
};

export function normalizeSupplyLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findPlantSupplyForResource(supplies: PlantSupply[], supplyId: string | undefined, name: string) {
  if (supplyId) {
    const exactSupply = supplies.find((supply) => supply.id === supplyId);

    if (exactSupply) {
      return exactSupply;
    }
  }

  const normalizedName = normalizeSupplyLookup(name);

  return supplies.find((supply) => {
    const normalizedSupplyName = normalizeSupplyLookup(supply.name);

    return normalizedSupplyName === normalizedName || normalizedSupplyName.includes(normalizedName) || normalizedName.includes(normalizedSupplyName);
  });
}
