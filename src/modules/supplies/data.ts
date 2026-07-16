import type { PlantSupply } from "./types";

export const plantSupplies: PlantSupply[] = [
  {
    id: "supply-loctite-243",
    name: "Loctite 243 / fijador de rosca medio",
    category: "quimico",
    unit: "ml",
    preferredSupplierId: null,
    stockMinimum: 25,
    notes: "Usado para tornilleria M3 en ensambles mecanicos."
  },
  {
    id: "supply-kit-label-bag",
    name: "Bolsa etiquetada para kit",
    category: "empaque",
    unit: "pieza",
    preferredSupplierId: null,
    stockMinimum: 100,
    notes: "Bolsa para separar kits por producto y lote."
  },
  {
    id: "supply-inspection-label-ok",
    name: "Etiqueta de inspeccion OK",
    category: "documento",
    unit: "pieza",
    preferredSupplierId: null,
    stockMinimum: 100,
    notes: "Identifica productos liberados por calidad."
  },
  {
    id: "supply-test-log",
    name: "Registro de prueba",
    category: "documento",
    unit: "formato",
    preferredSupplierId: null,
    stockMinimum: 50,
    notes: "Formato fisico o etiqueta para trazabilidad de prueba funcional."
  },
  {
    id: "supply-so101-box",
    name: "Caja SO101",
    category: "empaque",
    unit: "pieza",
    preferredSupplierId: null,
    stockMinimum: 25,
    notes: "Caja final para empaque de brazo SO101."
  },
  {
    id: "supply-protective-foam",
    name: "Proteccion de espuma",
    category: "empaque",
    unit: "set",
    preferredSupplierId: null,
    stockMinimum: 25,
    notes: "Protecciones internas para producto ensamblado."
  },
  {
    id: "supply-lot-label",
    name: "Etiqueta de lote",
    category: "documento",
    unit: "pieza",
    preferredSupplierId: null,
    stockMinimum: 100,
    notes: "Etiqueta de trazabilidad para empaque final."
  }
];
