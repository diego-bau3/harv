import type { WarehouseEntry, WarehouseLayoutConfig } from "./types";

export const defaultWarehouseLayoutConfig: WarehouseLayoutConfig = {
  mode: "uniforme",
  rows: 3,
  columnsPerRow: 3,
  levelsPerRack: 1,
  binsPerLevel: 1,
  customRows: [
    { id: "row-a", label: "A", columns: 3 },
    { id: "row-b", label: "B", columns: 3 },
    { id: "row-c", label: "C", columns: 3 }
  ]
};

export const initialWarehouseEntries: WarehouseEntry[] = [];
