import type { ProductUnit } from "../sales/types";

export type WarehouseMaterialType =
  | "componente"
  | "materia-prima"
  | "producto-terminado"
  | "empaque"
  | "herramienta"
  | "otro";

export type WarehouseEntryStatus =
  | "disponible"
  | "pendiente-revision"
  | "pendiente-ubicacion"
  | "bloqueado"
  | "danado";

export type WarehouseLocation = {
  id: string;
  label: string;
  zone: string;
  rack: string;
  level: string;
  bin: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WarehouseLayoutMode = "uniforme" | "personalizado";

export type WarehouseLayoutRow = {
  id: string;
  label: string;
  columns: number;
};

export type WarehouseLayoutConfig = {
  mode: WarehouseLayoutMode;
  rows: number;
  columnsPerRow: number;
  levelsPerRack: number;
  binsPerLevel: number;
  customRows: WarehouseLayoutRow[];
};

export type WarehouseEntry = {
  id: string;
  receivedAt: string;
  itemName: string;
  sku: string;
  materialType: WarehouseMaterialType;
  quantity: number;
  incomingQuantity: number;
  expectedArrivalDate: string;
  unit: ProductUnit;
  locationId: string;
  supplier: string;
  receivedBy: string;
  status: WarehouseEntryStatus;
  notes: string;
};

export type WarehouseEntryDraft = Omit<WarehouseEntry, "id">;

export type InventoryRecord = {
  key: string;
  itemName: string;
  sku: string;
  materialType: WarehouseMaterialType;
  unit: ProductUnit;
  locationId: string;
  locationLabel: string;
  totalQuantity: number;
  availableQuantity: number;
  pendingQuantity: number;
  blockedQuantity: number;
  damagedQuantity: number;
  incomingQuantity: number;
  firstReceivedAt: string;
  lastReceivedAt: string;
  nextArrivalDate: string;
  lastMovementAt: string;
  entryCount: number;
  status: WarehouseEntryStatus;
};

export type WarehouseLocationInventory = {
  location: WarehouseLocation;
  records: InventoryRecord[];
  totalQuantity: number;
  entryCount: number;
  status: WarehouseEntryStatus | "vacio";
};
