import type { ProductComponentType, ProductUnit } from "../sales/types";
import type {
  InventoryRecord,
  WarehouseEntry,
  WarehouseEntryAllocation,
  WarehouseEntryStatus,
  WarehouseLayoutConfig,
  WarehouseLayoutRow,
  WarehouseLocation,
  WarehouseLocationInventory,
  WarehouseMaterialType
} from "./types";
import { defaultWarehouseLayoutConfig } from "./data";

export const warehouseMaterialTypeLabels: Record<WarehouseMaterialType, string> = {
  componente: "Componente",
  "materia-prima": "Materia prima",
  "producto-terminado": "Producto terminado",
  empaque: "Empaque",
  herramienta: "Herramienta",
  otro: "Otro"
};

export const warehouseEntryStatusLabels: Record<WarehouseEntryStatus, string> = {
  disponible: "Disponible",
  "pendiente-revision": "Pendiente de revision",
  "pendiente-ubicacion": "Pendiente de ubicacion",
  bloqueado: "Bloqueado",
  danado: "Danado"
};

export const warehouseUnitLabels: Record<ProductUnit, string> = {
  pieza: "Pieza",
  metro: "Metro",
  kg: "Kg",
  set: "Set"
};

const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}

export function getWarehouseRowLabel(index: number) {
  return rowLabels[index] ?? `F${index + 1}`;
}

export function createWarehouseLayoutRows(
  rows: number,
  columnsPerRow: number,
  currentRows: WarehouseLayoutRow[] = []
) {
  const normalizedRows = clampInteger(rows, 1, 8);
  const normalizedColumns = clampInteger(columnsPerRow, 1, 8);

  return Array.from({ length: normalizedRows }, (_, index) => {
    const currentRow = currentRows[index];

    return {
      id: currentRow?.id ?? `row-${getWarehouseRowLabel(index).toLowerCase()}`,
      label: currentRow?.label || getWarehouseRowLabel(index),
      columns: clampInteger(currentRow?.columns ?? normalizedColumns, 1, 8)
    };
  });
}

export function normalizeWarehouseLayoutConfig(config?: Partial<WarehouseLayoutConfig>) {
  const rows = clampInteger(config?.rows ?? defaultWarehouseLayoutConfig.rows, 1, 8);
  const columnsPerRow = clampInteger(
    config?.columnsPerRow ?? defaultWarehouseLayoutConfig.columnsPerRow,
    1,
    8
  );
  const levelsPerRack = clampInteger(config?.levelsPerRack ?? defaultWarehouseLayoutConfig.levelsPerRack, 1, 4);
  const binsPerLevel = clampInteger(config?.binsPerLevel ?? defaultWarehouseLayoutConfig.binsPerLevel, 1, 4);
  const customRows = createWarehouseLayoutRows(
    rows,
    columnsPerRow,
    Array.isArray(config?.customRows) ? config.customRows : defaultWarehouseLayoutConfig.customRows
  );

  return {
    mode: config?.mode === "personalizado" ? "personalizado" : "uniforme",
    rows,
    columnsPerRow,
    levelsPerRack,
    binsPerLevel,
    customRows
  } satisfies WarehouseLayoutConfig;
}

export function createWarehouseLocations(config: WarehouseLayoutConfig) {
  const normalizedConfig = normalizeWarehouseLayoutConfig(config);
  const activeRows =
    normalizedConfig.mode === "personalizado"
      ? normalizedConfig.customRows
      : createWarehouseLayoutRows(normalizedConfig.rows, normalizedConfig.columnsPerRow).map((row) => ({
          ...row,
          columns: normalizedConfig.columnsPerRow
        }));
  const rackArea = { x: 30, y: 8, width: 42, height: 74 };
  const gapY = 4;
  const rowHeight = (rackArea.height - gapY * Math.max(activeRows.length - 1, 0)) / activeRows.length;
  const rackLocations: WarehouseLocation[] = [];

  activeRows.forEach((row, rowIndex) => {
    const gapX = Math.min(2, 8 / Math.max(row.columns - 1, 1));
    const columnWidth = (rackArea.width - gapX * Math.max(row.columns - 1, 0)) / row.columns;
    const usedWidth = row.columns * columnWidth + gapX * Math.max(row.columns - 1, 0);
    const rowStartX = rackArea.x + (rackArea.width - usedWidth) / 2;
    const rowStartY = rackArea.y + rowIndex * (rowHeight + gapY);

    Array.from({ length: row.columns }, (_, columnIndex) => columnIndex + 1).forEach((column) => {
      Array.from({ length: normalizedConfig.levelsPerRack }, (_, levelIndex) => levelIndex + 1).forEach((level) => {
        Array.from({ length: normalizedConfig.binsPerLevel }, (_, binIndex) => binIndex + 1).forEach((bin) => {
          const rackCode = `${row.label}-${String(column).padStart(2, "0")}`;
          const hasSingleLocation = normalizedConfig.levelsPerRack === 1 && normalizedConfig.binsPerLevel === 1;
          const locationLabel = hasSingleLocation
            ? `Rack ${rackCode}`
            : `Rack ${rackCode} N${level} B${bin}`;
          const subWidth = columnWidth / normalizedConfig.binsPerLevel;
          const subHeight = rowHeight / normalizedConfig.levelsPerRack;

          rackLocations.push({
            id: `rack-${row.label.toLowerCase()}-${String(column).padStart(2, "0")}-n${level}-b${bin}`,
            label: locationLabel,
            zone: row.label,
            rack: `Rack ${rackCode}`,
            level: `Nivel ${level}`,
            bin: String(bin).padStart(2, "0"),
            x: rowStartX + (column - 1) * (columnWidth + gapX) + (bin - 1) * subWidth,
            y: rowStartY + (level - 1) * subHeight,
            width: Math.max(subWidth - 0.2, 0.5),
            height: Math.max(subHeight - 0.25, 0.65)
          });
        });
      });
    });
  });

  return [
    {
      id: "recibo-01",
      label: "Recibo 01",
      zone: "Recibo",
      rack: "Mesa de recibo",
      level: "Nivel piso",
      bin: "Pendiente",
      x: 4,
      y: 8,
      width: 20,
      height: 18
    },
    ...rackLocations,
    {
      id: "calidad-01",
      label: "Cuarentena / Calidad",
      zone: "Calidad",
      rack: "Cuarentena",
      level: "Revision",
      bin: "01",
      x: 76,
      y: 8,
      width: 20,
      height: 24
    },
    {
      id: "empaque-01",
      label: "Empaque 01",
      zone: "Empaque",
      rack: "Mesa empaque",
      level: "Nivel piso",
      bin: "01",
      x: 76,
      y: 58,
      width: 20,
      height: 24
    }
  ];
}

export function formatWarehouseDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return "Sin fecha";
  }

  return `${day}/${month}/${year}`;
}

export function formatQuantity(value: number, unit: ProductUnit) {
  return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)} ${warehouseUnitLabels[
    unit
  ].toLowerCase()}`;
}

export function materialTypeFromComponentType(type: ProductComponentType): WarehouseMaterialType {
  if (type === "empaque") {
    return "empaque";
  }

  if (type === "otro") {
    return "otro";
  }

  return "componente";
}

export function getLocationLabel(locationId: string, locations: WarehouseLocation[]) {
  return locations.find((location) => location.id === locationId)?.label ?? "Sin ubicacion";
}

function olderDate(currentDate: string, candidateDate: string) {
  if (!candidateDate) {
    return currentDate;
  }

  if (!currentDate || candidateDate < currentDate) {
    return candidateDate;
  }

  return currentDate;
}

function newerDate(currentDate: string, candidateDate: string) {
  if (!candidateDate) {
    return currentDate;
  }

  if (!currentDate || candidateDate > currentDate) {
    return candidateDate;
  }

  return currentDate;
}

function nextArrivalDate(currentDate: string, candidateDate: string) {
  if (!candidateDate) {
    return currentDate;
  }

  if (!currentDate || candidateDate < currentDate) {
    return candidateDate;
  }

  return currentDate;
}

function getEntryAllocations(entry: WarehouseEntry): WarehouseEntryAllocation[] {
  const allocations = Array.isArray(entry.allocations) ? entry.allocations : [];
  const validAllocations = allocations
    .map((allocation) => ({
      id: allocation.id || createLegacyAllocationId(entry, allocation.locationId),
      locationId: allocation.locationId || entry.locationId,
      quantity: Number(allocation.quantity ?? 0)
    }))
    .filter((allocation) => allocation.locationId && allocation.quantity > 0);

  if (validAllocations.length > 0) {
    return validAllocations;
  }

  return [
    {
      id: createLegacyAllocationId(entry, entry.locationId),
      locationId: entry.locationId,
      quantity: Number(entry.quantity ?? 0)
    }
  ].filter((allocation) => allocation.locationId && allocation.quantity > 0);
}

function createLegacyAllocationId(entry: WarehouseEntry, locationId: string) {
  return `${entry.id || "entry"}-${locationId || "location"}`;
}

function createRecord(
  entry: WarehouseEntry,
  allocation: WarehouseEntryAllocation,
  locationLabel: string,
  incomingQuantity: number
): InventoryRecord {
  const quantity = Number(allocation.quantity ?? 0);
  const availableQuantity = entry.status === "disponible" ? quantity : 0;
  const pendingQuantity =
    entry.status === "pendiente-revision" || entry.status === "pendiente-ubicacion" ? quantity : 0;
  const blockedQuantity = entry.status === "bloqueado" ? quantity : 0;
  const damagedQuantity = entry.status === "danado" ? quantity : 0;
  const expectedArrivalDate = incomingQuantity > 0 ? entry.expectedArrivalDate : "";

  return {
    key: `${entry.sku || entry.itemName}-${allocation.locationId}-${entry.unit}`,
    itemName: entry.itemName,
    sku: entry.sku,
    materialType: entry.materialType,
    unit: entry.unit,
    locationId: allocation.locationId,
    locationLabel,
    totalQuantity: quantity,
    availableQuantity,
    pendingQuantity,
    blockedQuantity,
    damagedQuantity,
    incomingQuantity,
    maxPerLocation: Number(entry.maxPerLocation ?? 0),
    firstReceivedAt: entry.receivedAt,
    lastReceivedAt: entry.receivedAt,
    nextArrivalDate: expectedArrivalDate,
    lastMovementAt: entry.receivedAt,
    entryCount: 1,
    status: entry.status
  };
}

function resolveInventoryStatus(record: InventoryRecord): WarehouseEntryStatus {
  if (record.availableQuantity > 0) {
    return "disponible";
  }

  if (record.pendingQuantity > 0) {
    return "pendiente-revision";
  }

  if (record.blockedQuantity > 0) {
    return "bloqueado";
  }

  if (record.damagedQuantity > 0) {
    return "danado";
  }

  return "pendiente-ubicacion";
}

export function calculateInventory(entries: WarehouseEntry[], locations: WarehouseLocation[]) {
  const records = new Map<string, InventoryRecord>();

  entries.forEach((entry) => {
    getEntryAllocations(entry).forEach((allocation, allocationIndex) => {
      const locationLabel = getLocationLabel(allocation.locationId, locations);
      const key = `${entry.sku || entry.itemName}-${allocation.locationId}-${entry.unit}`;
      const existingRecord = records.get(key);
      const quantity = Number(allocation.quantity ?? 0);
      const incomingQuantity = allocationIndex === 0 ? Number(entry.incomingQuantity ?? 0) : 0;

      if (!existingRecord) {
        records.set(key, createRecord(entry, allocation, locationLabel, incomingQuantity));
        return;
      }

      const nextRecord: InventoryRecord = {
        ...existingRecord,
        totalQuantity: existingRecord.totalQuantity + quantity,
        availableQuantity: existingRecord.availableQuantity + (entry.status === "disponible" ? quantity : 0),
        pendingQuantity:
          existingRecord.pendingQuantity +
          (entry.status === "pendiente-revision" || entry.status === "pendiente-ubicacion" ? quantity : 0),
        blockedQuantity: existingRecord.blockedQuantity + (entry.status === "bloqueado" ? quantity : 0),
        damagedQuantity: existingRecord.damagedQuantity + (entry.status === "danado" ? quantity : 0),
        incomingQuantity: existingRecord.incomingQuantity + incomingQuantity,
        maxPerLocation: Math.max(existingRecord.maxPerLocation, Number(entry.maxPerLocation ?? 0)),
        firstReceivedAt: olderDate(existingRecord.firstReceivedAt, entry.receivedAt),
        lastReceivedAt: newerDate(existingRecord.lastReceivedAt, entry.receivedAt),
        nextArrivalDate: nextArrivalDate(
          existingRecord.nextArrivalDate,
          incomingQuantity > 0 ? entry.expectedArrivalDate : ""
        ),
        lastMovementAt: newerDate(existingRecord.lastMovementAt, entry.receivedAt),
        entryCount: existingRecord.entryCount + 1
      };

      records.set(key, {
        ...nextRecord,
        status: resolveInventoryStatus(nextRecord)
      });
    });
  });

  return Array.from(records.values()).sort((firstRecord, secondRecord) =>
    firstRecord.itemName.localeCompare(secondRecord.itemName)
  );
}

export function calculateLocationInventory(
  inventory: InventoryRecord[],
  locations: WarehouseLocation[]
): WarehouseLocationInventory[] {
  return locations.map((location) => {
    const records = inventory.filter((record) => record.locationId === location.id);
    const totalQuantity = records.reduce((total, record) => total + record.totalQuantity, 0);
    const hasBlocked = records.some((record) => record.status === "bloqueado" || record.status === "danado");
    const hasPending = records.some(
      (record) => record.status === "pendiente-revision" || record.status === "pendiente-ubicacion"
    );
    const hasAvailable = records.some((record) => record.status === "disponible");

    return {
      location,
      records,
      totalQuantity,
      entryCount: records.reduce((total, record) => total + record.entryCount, 0),
      status: hasBlocked ? "bloqueado" : hasPending ? "pendiente-revision" : hasAvailable ? "disponible" : "vacio"
    };
  });
}

export function entryMatches(entry: WarehouseEntry, query: string, locations: WarehouseLocation[]) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const allocationLabels = getEntryAllocations(entry).map((allocation) =>
    getLocationLabel(allocation.locationId, locations)
  );

  return [
    entry.itemName,
    entry.sku,
    entry.supplier,
    entry.receivedBy,
    getLocationLabel(entry.locationId, locations),
    ...allocationLabels
  ].some((field) => field.toLowerCase().includes(normalizedQuery));
}

function csvCell(value: string | number) {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function createInventoryCsv(inventory: InventoryRecord[], locations: WarehouseLocation[]) {
  const headers = [
    "Producto",
    "SKU",
    "Tipo",
    "Cantidad total",
    "Disponible",
    "Pendiente",
    "Bloqueado",
    "Danado",
    "Cantidad por llegar",
    "Maximo por ubicacion",
    "Unidad",
    "Ubicacion",
    "Zona",
    "Rack",
    "Nivel",
    "Bin",
    "Primera llegada",
    "Ultima llegada",
    "Fecha por llegar",
    "Ultimo movimiento",
    "Estado",
    "Registros"
  ];

  const rows = inventory.map((record) => {
    const location = locations.find((currentLocation) => currentLocation.id === record.locationId);

    return [
      record.itemName,
      record.sku,
      warehouseMaterialTypeLabels[record.materialType],
      record.totalQuantity,
      record.availableQuantity,
      record.pendingQuantity,
      record.blockedQuantity,
      record.damagedQuantity,
      record.incomingQuantity,
      record.maxPerLocation || "",
      warehouseUnitLabels[record.unit],
      record.locationLabel,
      location?.zone ?? "",
      location?.rack ?? "",
      location?.level ?? "",
      location?.bin ?? "",
      record.firstReceivedAt,
      record.lastReceivedAt,
      record.nextArrivalDate,
      record.lastMovementAt,
      warehouseEntryStatusLabels[record.status],
      record.entryCount
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
