import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarClock,
  ClipboardList,
  Download,
  Eye,
  MapPinned,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  PendingReceipt,
  PurchaseOrder,
  PurchaseReceiptIssue,
  PurchaseReceiptLineUpdate,
  PurchaseReceiptStatus
} from "../../purchases/types";
import { pendingReceiptStatusLabels, purchaseReceiptIssueLabels } from "../../purchases/utils";
import type { Product, ProductComponent, ProductUnit } from "../../sales/types";
import { createId, todayIso } from "../../sales/utils";
import { defaultWarehouseLayoutConfig, initialWarehouseEntries } from "../data";
import type {
  WarehouseEntry,
  WarehouseEntryAllocation,
  WarehouseEntryDraft,
  WarehouseEntryStatus,
  WarehouseLayoutConfig,
  WarehouseLayoutMode,
  WarehouseLocation,
  WarehouseMaterialType
} from "../types";
import {
  calculateInventory,
  calculateLocationInventory,
  createInventoryCsv,
  createWarehouseLayoutRows,
  createWarehouseLocations,
  entryMatches,
  formatQuantity,
  formatWarehouseDate,
  getLocationLabel,
  materialTypeFromComponentType,
  normalizeWarehouseLayoutConfig,
  warehouseEntryStatusLabels,
  warehouseMaterialTypeLabels,
  warehouseUnitLabels
} from "../utils";

type WarehouseScreenProps = {
  products: Product[];
  pendingReceipts: PendingReceipt[];
  purchaseOrders: PurchaseOrder[];
  onBack: () => void;
  onReceivePurchaseReceipt: (
    receiptId: string,
    lineUpdates: PurchaseReceiptLineUpdate[],
    status: PurchaseReceiptStatus,
    issue: PurchaseReceiptIssue | "",
    issueNotes: string
  ) => void;
};

type ComponentOption = {
  id: string;
  productName: string;
  productSku: string;
  component: ProductComponent;
};

type ReceiptLineDraft = {
  receivedQuantity: number;
  damagedQuantity: number;
  reviewQuantity: number;
  receiptNotes: string;
};

type ReceiptDraft = {
  lines: Record<string, ReceiptLineDraft>;
  issue: PurchaseReceiptIssue | "";
  issueNotes: string;
  receivedBy: string;
  locationId: string;
};

const entriesStorageKey = "harv:warehouse-entries:v2";
const layoutStorageKey = "harv:warehouse-layout:v1";
const quantityTolerance = 0.001;

function getActiveRows(layoutConfig: WarehouseLayoutConfig) {
  return layoutConfig.mode === "personalizado"
    ? layoutConfig.customRows
    : createWarehouseLayoutRows(layoutConfig.rows, layoutConfig.columnsPerRow).map((row) => ({
        ...row,
        columns: layoutConfig.columnsPerRow
      }));
}

function getMapSize(layoutConfig: WarehouseLayoutConfig) {
  const activeRows = getActiveRows(layoutConfig);
  const maxColumns = Math.max(...activeRows.map((row) => row.columns), 1);
  const horizontalCells = maxColumns * layoutConfig.binsPerLevel;
  const verticalCells = activeRows.length * layoutConfig.levelsPerRack;

  return {
    width: Math.max(760, Math.ceil((horizontalCells * 72) / 0.42)),
    height: Math.max(540, Math.ceil((verticalCells * 70) / 0.74))
  };
}

function getMapRackLabel(location: WarehouseLocation) {
  if (!location.id.startsWith("rack-")) {
    return location.label;
  }

  return location.rack.replace("Rack ", "");
}

function getMapPositionLabel(location: WarehouseLocation) {
  if (!location.id.startsWith("rack-")) {
    return "";
  }

  const level = location.level.replace("Nivel ", "N");
  const bin = `B${Number(location.bin) || location.bin}`;

  return `${level} ${bin}`;
}

function createAllocation(locationId: string, quantity = 1): WarehouseEntryAllocation {
  return {
    id: createId("allocation"),
    locationId,
    quantity
  };
}

function getAllocationTotal(allocations: WarehouseEntryAllocation[]) {
  return allocations.reduce((total, allocation) => total + Number(allocation.quantity || 0), 0);
}

function clampQuantity(value: number, maxQuantity: number) {
  return Math.max(0, Math.min(Number(value || 0), maxQuantity));
}

function normalizeStoredAllocations(entry: Partial<WarehouseEntry>, fallbackLocationId: string) {
  const fallbackEntryLocationId = entry.locationId || fallbackLocationId;
  const storedAllocations = Array.isArray(entry.allocations) ? entry.allocations : [];
  const normalizedAllocations = storedAllocations
    .map((allocation) => ({
      id: allocation.id || createId("allocation"),
      locationId: allocation.locationId || fallbackEntryLocationId,
      quantity: Number(allocation.quantity ?? 0)
    }))
    .filter((allocation) => allocation.locationId && allocation.quantity > 0);

  if (normalizedAllocations.length > 0) {
    return normalizedAllocations;
  }

  const fallbackQuantity = Number(entry.quantity ?? 0);

  if (!fallbackEntryLocationId || fallbackQuantity <= 0) {
    return [];
  }

  return [createAllocation(fallbackEntryLocationId, fallbackQuantity)];
}

function createEmptyDraft(locationId: string): WarehouseEntryDraft {
  return {
    receivedAt: todayIso(),
    itemName: "",
    sku: "",
    materialType: "componente",
    quantity: 1,
    incomingQuantity: 0,
    expectedArrivalDate: "",
    unit: "pieza",
    locationId,
    maxPerLocation: 0,
    allocations: [createAllocation(locationId, 1)],
    supplier: "",
    receivedBy: "",
    status: "disponible",
    notes: ""
  };
}

function normalizeStoredEntry(entry: Partial<WarehouseEntry>, fallbackLocationId: string): WarehouseEntry {
  const allocations = normalizeStoredAllocations(entry, fallbackLocationId);
  const locationId = allocations[0]?.locationId ?? entry.locationId ?? fallbackLocationId;

  return {
    ...createEmptyDraft(fallbackLocationId),
    ...entry,
    id: entry.id ?? createId("entry"),
    locationId,
    itemName: entry.itemName ?? "",
    sku: entry.sku ?? "",
    quantity: Number(entry.quantity ?? 0),
    incomingQuantity: Number(entry.incomingQuantity ?? 0),
    expectedArrivalDate: entry.expectedArrivalDate ?? "",
    maxPerLocation: Number(entry.maxPerLocation ?? 0),
    allocations,
    supplier: entry.supplier ?? "",
    receivedBy: entry.receivedBy ?? "",
    notes: entry.notes ?? ""
  };
}

function loadStoredLayoutConfig() {
  try {
    const storedLayout = window.localStorage.getItem(layoutStorageKey);

    if (!storedLayout) {
      return defaultWarehouseLayoutConfig;
    }

    return normalizeWarehouseLayoutConfig(JSON.parse(storedLayout));
  } catch {
    return defaultWarehouseLayoutConfig;
  }
}

function saveStoredLayoutConfig(layoutConfig: WarehouseLayoutConfig) {
  try {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(layoutConfig));
  } catch {
    return;
  }
}

function loadStoredEntries(fallbackLocationId: string) {
  try {
    const storedEntries = window.localStorage.getItem(entriesStorageKey);

    if (!storedEntries) {
      return initialWarehouseEntries;
    }

    const parsedEntries = JSON.parse(storedEntries);
    return Array.isArray(parsedEntries)
      ? parsedEntries.map((entry) => normalizeStoredEntry(entry, fallbackLocationId))
      : initialWarehouseEntries;
  } catch {
    return initialWarehouseEntries;
  }
}

function saveStoredEntries(entries: WarehouseEntry[]) {
  try {
    window.localStorage.setItem(entriesStorageKey, JSON.stringify(entries));
  } catch {
    return;
  }
}

export function WarehouseScreen({
  pendingReceipts,
  products,
  purchaseOrders,
  onBack,
  onReceivePurchaseReceipt
}: WarehouseScreenProps) {
  const [layoutConfig, setLayoutConfig] = useState<WarehouseLayoutConfig>(loadStoredLayoutConfig);
  const warehouseLocations = useMemo(() => createWarehouseLocations(layoutConfig), [layoutConfig]);
  const mapSize = useMemo(() => getMapSize(layoutConfig), [layoutConfig]);
  const defaultLocationId = warehouseLocations[0]?.id ?? "";
  const [entries, setEntries] = useState<WarehouseEntry[]>(() => loadStoredEntries(defaultLocationId));
  const [draft, setDraft] = useState<WarehouseEntryDraft>(() => createEmptyDraft(defaultLocationId));
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, ReceiptDraft>>({});
  const [selectedComponentId, setSelectedComponentId] = useState("manual");
  const [entryQuery, setEntryQuery] = useState("");
  const [formError, setFormError] = useState("");
  const [isInventoryMapOpen, setInventoryMapOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState(defaultLocationId);

  useEffect(() => {
    saveStoredEntries(entries);
  }, [entries]);

  useEffect(() => {
    saveStoredLayoutConfig(layoutConfig);
  }, [layoutConfig]);

  useEffect(() => {
    if (!warehouseLocations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(defaultLocationId);
    }

    setDraft((currentDraft) => {
      const validLocationIds = new Set(warehouseLocations.map((location) => location.id));
      const locationId = validLocationIds.has(currentDraft.locationId) ? currentDraft.locationId : defaultLocationId;
      const allocations = currentDraft.allocations.length
        ? currentDraft.allocations.map((allocation) =>
            validLocationIds.has(allocation.locationId) ? allocation : { ...allocation, locationId }
          )
        : [createAllocation(locationId, currentDraft.quantity || 1)];

      return {
        ...currentDraft,
        locationId,
        allocations
      };
    });
  }, [defaultLocationId, selectedLocationId, warehouseLocations]);

  const componentOptions = useMemo<ComponentOption[]>(() => {
    return products.flatMap((product) =>
      product.components.map((component) => ({
        id: `${product.id}-${component.id}`,
        productName: product.name,
        productSku: product.sku,
        component
      }))
    );
  }, [products]);

  const receiptOrderById = useMemo(() => {
    return new Map(purchaseOrders.map((order) => [order.id, order]));
  }, [purchaseOrders]);

  const activePurchaseReceipts = useMemo(() => {
    return pendingReceipts.filter((receipt) => receipt.status !== "recibida");
  }, [pendingReceipts]);

  const inventory = useMemo(() => calculateInventory(entries, warehouseLocations), [entries, warehouseLocations]);
  const locationInventory = useMemo(
    () => calculateLocationInventory(inventory, warehouseLocations),
    [inventory, warehouseLocations]
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => entryMatches(entry, entryQuery, warehouseLocations));
  }, [entries, entryQuery, warehouseLocations]);

  const selectedLocationInventory =
    locationInventory.find((location) => location.location.id === selectedLocationId) ?? locationInventory[0];
  const generatedLocationsCount = warehouseLocations.length;

  const entriesToday = entries.filter((entry) => entry.receivedAt === todayIso()).length;
  const totalQuantity = entries.reduce((total, entry) => total + entry.quantity, 0);
  const purchaseIncomingQuantity = activePurchaseReceipts.reduce(
    (receiptTotal, receipt) =>
      receiptTotal +
      receipt.lines.reduce(
        (lineTotal, line) =>
          lineTotal + Math.max(line.quantity - line.receivedQuantity - line.damagedQuantity - line.reviewQuantity, 0),
        0
      ),
    0
  );
  const incomingQuantity = entries.reduce((total, entry) => total + entry.incomingQuantity, 0) + purchaseIncomingQuantity;
  const usedLocations = new Set(
    entries.flatMap((entry) => entry.allocations.map((allocation) => allocation.locationId))
  ).size;
  const allocatedQuantity = getAllocationTotal(draft.allocations);
  const unassignedQuantity = Math.max(draft.quantity - allocatedQuantity, 0);
  const overAssignedQuantity = Math.max(allocatedQuantity - draft.quantity, 0);

  function updateDraft<Key extends keyof WarehouseEntryDraft>(key: Key, value: WarehouseEntryDraft[Key]) {
    setDraft((currentDraft) => {
      if (key === "locationId") {
        const locationId = String(value);
        const allocations =
          currentDraft.allocations.length <= 1
            ? currentDraft.allocations.length === 1
              ? currentDraft.allocations.map((allocation) => ({ ...allocation, locationId }))
              : [createAllocation(locationId, currentDraft.quantity || 1)]
            : currentDraft.allocations;

        return {
          ...currentDraft,
          locationId,
          allocations
        };
      }

      return { ...currentDraft, [key]: value };
    });
  }

  function buildReceiptDraft(receipt: PendingReceipt, existingDraft?: ReceiptDraft): ReceiptDraft {
    const locationId =
      existingDraft?.locationId && warehouseLocations.some((location) => location.id === existingDraft.locationId)
        ? existingDraft.locationId
        : defaultLocationId;
    const lines = receipt.lines.reduce<Record<string, ReceiptLineDraft>>((draftLines, line) => {
      const existingLineDraft = existingDraft?.lines[line.id];
      const defaultReceivedQuantity = receipt.status === "por-recibir" ? line.quantity : line.receivedQuantity;

      draftLines[line.id] = {
        receivedQuantity: existingLineDraft?.receivedQuantity ?? defaultReceivedQuantity,
        damagedQuantity: existingLineDraft?.damagedQuantity ?? line.damagedQuantity,
        reviewQuantity: existingLineDraft?.reviewQuantity ?? line.reviewQuantity,
        receiptNotes: existingLineDraft?.receiptNotes ?? line.receiptNotes
      };

      return draftLines;
    }, {});

    return {
      lines,
      issue: existingDraft?.issue ?? receipt.issue ?? "",
      issueNotes: existingDraft?.issueNotes ?? receipt.issueNotes ?? "",
      receivedBy: existingDraft?.receivedBy ?? "",
      locationId
    };
  }

  function receiptDraftFor(receipt: PendingReceipt) {
    return buildReceiptDraft(receipt, receiptDrafts[receipt.id]);
  }

  function updateReceiptDraft<Key extends keyof ReceiptDraft>(receipt: PendingReceipt, key: Key, value: ReceiptDraft[Key]) {
    setReceiptDrafts((currentDrafts) => {
      const currentDraft = buildReceiptDraft(receipt, currentDrafts[receipt.id]);

      return {
        ...currentDrafts,
        [receipt.id]: {
          ...currentDraft,
          [key]: value
        }
      };
    });
  }

  function updateReceiptLineDraft<Key extends keyof ReceiptLineDraft>(
    receipt: PendingReceipt,
    lineId: string,
    key: Key,
    value: ReceiptLineDraft[Key]
  ) {
    setReceiptDrafts((currentDrafts) => {
      const currentDraft = buildReceiptDraft(receipt, currentDrafts[receipt.id]);

      return {
        ...currentDrafts,
        [receipt.id]: {
          ...currentDraft,
          lines: {
            ...currentDraft.lines,
            [lineId]: {
              ...currentDraft.lines[lineId],
              [key]: value
            }
          }
        }
      };
    });
  }

  function getReceiptLineMaterialType(line: PendingReceipt["lines"][number]) {
    const product = products.find((currentProduct) => currentProduct.id === line.productId);
    const component = product?.components.find((currentComponent) => currentComponent.id === line.componentId);

    return component ? materialTypeFromComponentType(component.type) : "componente";
  }

  function createReceiptWarehouseEntry(
    receipt: PendingReceipt,
    line: PendingReceipt["lines"][number],
    quantity: number,
    status: WarehouseEntryStatus,
    receiptDraft: ReceiptDraft,
    statusNote: string
  ): WarehouseEntry {
    const locationId = receiptDraft.locationId || defaultLocationId;
    const lineDraft = receiptDraft.lines[line.id];
    const notes = [`Desde OC ${receipt.purchaseOrderFolio}`, statusNote, lineDraft?.receiptNotes, receiptDraft.issueNotes]
      .filter(Boolean)
      .join(". ");

    return {
      id: createId("entry"),
      receivedAt: todayIso(),
      itemName: line.itemName,
      sku: line.productSku,
      materialType: getReceiptLineMaterialType(line),
      quantity,
      incomingQuantity: 0,
      expectedArrivalDate: "",
      unit: line.unit,
      locationId,
      maxPerLocation: 0,
      allocations: [createAllocation(locationId, quantity)],
      supplier: receipt.supplierName,
      receivedBy: receiptDraft.receivedBy.trim(),
      status,
      notes
    };
  }

  function receiveReceipt(receipt: PendingReceipt, status: PurchaseReceiptStatus) {
    const receiptDraft = receiptDraftFor(receipt);
    const lineUpdates = receipt.lines.map((line): PurchaseReceiptLineUpdate => {
      if (status === "recibida") {
        return {
          lineId: line.id,
          receivedQuantity: line.quantity,
          damagedQuantity: 0,
          reviewQuantity: 0,
          receiptNotes: receiptDraft.lines[line.id]?.receiptNotes ?? ""
        };
      }

      const lineDraft = receiptDraft.lines[line.id];

      return {
        lineId: line.id,
        receivedQuantity: clampQuantity(lineDraft?.receivedQuantity ?? 0, line.quantity),
        damagedQuantity: clampQuantity(lineDraft?.damagedQuantity ?? 0, line.quantity),
        reviewQuantity: clampQuantity(lineDraft?.reviewQuantity ?? 0, line.quantity),
        receiptNotes: lineDraft?.receiptNotes.trim() ?? ""
      };
    });
    const hasOverAssignedLine = lineUpdates.some((lineUpdate) => {
      const line = receipt.lines.find((currentLine) => currentLine.id === lineUpdate.lineId);
      const totalQuantity = lineUpdate.receivedQuantity + lineUpdate.damagedQuantity + lineUpdate.reviewQuantity;

      return Boolean(line && totalQuantity - line.quantity > quantityTolerance);
    });

    if (hasOverAssignedLine) {
      setFormError("En una línea, recibido + dañado + revisión no puede exceder la cantidad comprada.");
      return;
    }

    const hasDamagedQuantity = lineUpdates.some((lineUpdate) => lineUpdate.damagedQuantity > 0);
    const issue: PurchaseReceiptIssue | "" =
      status === "parcial"
        ? "incompleto"
        : status === "pendiente-revision"
          ? "revision"
          : status === "problema"
            ? receiptDraft.issue || (hasDamagedQuantity ? "danado" : "otro")
            : "";
    const newEntries = receipt.lines.flatMap((line) => {
      const lineUpdate = lineUpdates.find((currentUpdate) => currentUpdate.lineId === line.id);

      if (!lineUpdate) {
        return [];
      }

      const receivedDelta = Math.max(lineUpdate.receivedQuantity - line.receivedQuantity, 0);
      const damagedDelta = Math.max(lineUpdate.damagedQuantity - line.damagedQuantity, 0);
      const reviewDelta = Math.max(lineUpdate.reviewQuantity - line.reviewQuantity, 0);
      const entriesToAdd: WarehouseEntry[] = [];

      if (receivedDelta > 0) {
        entriesToAdd.push(
          createReceiptWarehouseEntry(receipt, line, receivedDelta, "disponible", receiptDraft, "Material disponible")
        );
      }

      if (reviewDelta > 0) {
        entriesToAdd.push(
          createReceiptWarehouseEntry(
            receipt,
            line,
            reviewDelta,
            "pendiente-revision",
            receiptDraft,
            "Material pendiente de revisión"
          )
        );
      }

      if (damagedDelta > 0) {
        entriesToAdd.push(
          createReceiptWarehouseEntry(receipt, line, damagedDelta, "danado", receiptDraft, "Material dañado")
        );
      }

      return entriesToAdd;
    });

    if (newEntries.length > 0) {
      setEntries((currentEntries) => [...newEntries, ...currentEntries]);
    }

    onReceivePurchaseReceipt(receipt.id, lineUpdates, status, issue, receiptDraft.issueNotes.trim());
    setReceiptDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[receipt.id];
      return nextDrafts;
    });
    setFormError("");
  }

  function updateAllocation(allocationId: string, patch: Partial<WarehouseEntryAllocation>) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      allocations: currentDraft.allocations.map((allocation) =>
        allocation.id === allocationId ? { ...allocation, ...patch } : allocation
      )
    }));
  }

  function addAllocation() {
    setDraft((currentDraft) => {
      const usedLocationIds = new Set(currentDraft.allocations.map((allocation) => allocation.locationId));
      const nextLocationId =
        warehouseLocations.find((location) => !usedLocationIds.has(location.id))?.id ??
        currentDraft.locationId ??
        defaultLocationId;
      const pendingQuantity = Math.max(currentDraft.quantity - getAllocationTotal(currentDraft.allocations), 0);
      const suggestedQuantity =
        currentDraft.maxPerLocation > 0
          ? Math.min(currentDraft.maxPerLocation, pendingQuantity || currentDraft.maxPerLocation)
          : pendingQuantity || currentDraft.quantity || 1;

      return {
        ...currentDraft,
        allocations: [...currentDraft.allocations, createAllocation(nextLocationId, suggestedQuantity)]
      };
    });
  }

  function removeAllocation(allocationId: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      allocations: currentDraft.allocations.filter((allocation) => allocation.id !== allocationId)
    }));
  }

  function suggestAllocations() {
    setDraft((currentDraft) => {
      const totalQuantity = Number(currentDraft.quantity ?? 0);
      const maxPerLocation = Number(currentDraft.maxPerLocation ?? 0);
      const chunkSize = maxPerLocation > 0 ? maxPerLocation : totalQuantity;

      if (totalQuantity <= 0 || chunkSize <= 0 || warehouseLocations.length === 0) {
        return currentDraft;
      }

      const preferredLocationIds = [
        currentDraft.locationId,
        ...currentDraft.allocations.map((allocation) => allocation.locationId)
      ];
      const orderedLocations = [
        ...preferredLocationIds
          .map((locationId) => warehouseLocations.find((location) => location.id === locationId))
          .filter((location): location is WarehouseLocation => Boolean(location)),
        ...warehouseLocations
      ].filter(
        (location, index, locations) =>
          locations.findIndex((currentLocation) => currentLocation.id === location.id) === index
      );
      let remainingQuantity = totalQuantity;
      const allocations: WarehouseEntryAllocation[] = [];

      for (const location of orderedLocations) {
        if (remainingQuantity <= 0) {
          break;
        }

        const quantity = maxPerLocation > 0 ? Math.min(chunkSize, remainingQuantity) : remainingQuantity;
        allocations.push(createAllocation(location.id, Number(quantity.toFixed(2))));
        remainingQuantity = Number((remainingQuantity - quantity).toFixed(2));

        if (maxPerLocation <= 0) {
          break;
        }
      }

      return {
        ...currentDraft,
        locationId: allocations[0]?.locationId ?? currentDraft.locationId,
        allocations
      };
    });
  }

  function updateLayoutConfig(patch: Partial<WarehouseLayoutConfig>) {
    setLayoutConfig((currentConfig) =>
      normalizeWarehouseLayoutConfig({
        ...currentConfig,
        ...patch
      })
    );
  }

  function updateLayoutNumber(key: "rows" | "columnsPerRow" | "levelsPerRack" | "binsPerLevel", value: number) {
    setLayoutConfig((currentConfig) => {
      const nextConfig = normalizeWarehouseLayoutConfig({
        ...currentConfig,
        [key]: value
      });

      if (key === "rows" || key === "columnsPerRow") {
        return {
          ...nextConfig,
          customRows: createWarehouseLayoutRows(nextConfig.rows, nextConfig.columnsPerRow, currentConfig.customRows)
        };
      }

      return nextConfig;
    });
  }

  function updateCustomRowColumns(rowId: string, columns: number) {
    setLayoutConfig((currentConfig) =>
      normalizeWarehouseLayoutConfig({
        ...currentConfig,
        mode: "personalizado",
        customRows: currentConfig.customRows.map((row) => (row.id === rowId ? { ...row, columns } : row))
      })
    );
  }

  function resetLayoutConfig() {
    setLayoutConfig(defaultWarehouseLayoutConfig);
  }

  function selectComponent(optionId: string) {
    setSelectedComponentId(optionId);

    if (optionId === "manual") {
      return;
    }

    const selectedOption = componentOptions.find((option) => option.id === optionId);

    if (!selectedOption) {
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      itemName: selectedOption.component.name,
      sku: selectedOption.component.supplierPartNumber || selectedOption.productSku,
      materialType: materialTypeFromComponentType(selectedOption.component.type),
      unit: selectedOption.component.unit,
      supplier: selectedOption.component.supplierCompany || currentDraft.supplier,
      notes: selectedOption.component.notes || currentDraft.notes
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.itemName.trim()) {
      setFormError("Captura que material llego.");
      return;
    }

    if (draft.quantity <= 0) {
      setFormError("La cantidad debe ser mayor a cero.");
      return;
    }

    if (draft.maxPerLocation < 0) {
      setFormError("El maximo por ubicacion no puede ser negativo.");
      return;
    }

    if (draft.incomingQuantity < 0) {
      setFormError("La cantidad por llegar no puede ser negativa.");
      return;
    }

    if (draft.incomingQuantity > 0 && !draft.expectedArrivalDate) {
      setFormError("Captura la fecha por llegar.");
      return;
    }

    if (draft.expectedArrivalDate && draft.incomingQuantity <= 0) {
      setFormError("Captura la cantidad por llegar.");
      return;
    }

    if (draft.allocations.length === 0) {
      setFormError("Agrega al menos una ubicacion para esta entrada.");
      return;
    }

    if (draft.allocations.some((allocation) => !allocation.locationId || Number(allocation.quantity) <= 0)) {
      setFormError("Cada ubicacion debe tener cantidad mayor a cero.");
      return;
    }

    const savedAllocations = draft.allocations.map((allocation) => ({
      ...allocation,
      quantity: Number(allocation.quantity)
    }));
    const allocatedTotal = getAllocationTotal(savedAllocations);

    if (Math.abs(allocatedTotal - draft.quantity) > quantityTolerance) {
      setFormError("La distribucion debe sumar exactamente la cantidad recibida.");
      return;
    }

    if (draft.maxPerLocation > 0) {
      const quantityByLocation = new Map<string, number>();

      savedAllocations.forEach((allocation) => {
        quantityByLocation.set(
          allocation.locationId,
          (quantityByLocation.get(allocation.locationId) ?? 0) + allocation.quantity
        );
      });

      const hasLocationOverLimit = Array.from(quantityByLocation.values()).some(
        (quantity) => quantity - draft.maxPerLocation > quantityTolerance
      );

      if (hasLocationOverLimit) {
        setFormError("Una ubicacion excede el maximo permitido para este producto.");
        return;
      }
    }

    const savedEntry: WarehouseEntry = {
      ...draft,
      id: createId("entry"),
      locationId: savedAllocations[0]?.locationId ?? draft.locationId,
      itemName: draft.itemName.trim(),
      sku: draft.sku.trim(),
      maxPerLocation: Number(draft.maxPerLocation),
      allocations: savedAllocations,
      supplier: draft.supplier.trim(),
      receivedBy: draft.receivedBy.trim(),
      notes: draft.notes.trim()
    };

    setEntries((currentEntries) => [savedEntry, ...currentEntries]);
    setDraft((currentDraft) => ({
      ...createEmptyDraft(defaultLocationId),
      receivedBy: currentDraft.receivedBy,
      supplier: currentDraft.supplier
    }));
    setSelectedComponentId("manual");
    setFormError("");
  }

  function downloadInventoryCsv() {
    const csv = createInventoryCsv(inventory, warehouseLocations);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `harv-inventario-${todayIso()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  function getEntryLocationSummary(entry: WarehouseEntry) {
    const allocations = entry.allocations.filter((allocation) => allocation.locationId && allocation.quantity > 0);

    if (allocations.length === 0) {
      return getLocationLabel(entry.locationId, warehouseLocations);
    }

    if (allocations.length === 1) {
      return getLocationLabel(allocations[0].locationId, warehouseLocations);
    }

    return `${getLocationLabel(allocations[0].locationId, warehouseLocations)} +${allocations.length - 1}`;
  }

  return (
    <main className="profile-screen warehouse-profile-screen">
      <header className="screen-header">
        <button className="icon-button" onClick={onBack} type="button" aria-label="Regresar a perfiles">
          <ArrowLeft size={22} />
        </button>
        <div className="screen-title">
          <span className="screen-icon warehouse-screen-icon" aria-hidden="true">
            <Boxes size={22} />
          </span>
          <h1>Almacen</h1>
        </div>
      </header>

      <section className="warehouse-profile-body">
        <section className="warehouse-command-panel">
          <div>
            <span className="section-kicker">Control de recibo</span>
          </div>
          <div className="warehouse-command-actions">
            <button className="secondary-button" onClick={downloadInventoryCsv} type="button">
              <Download size={17} />
              Descargar CSV
            </button>
            <button className="primary-button" onClick={() => setInventoryMapOpen(true)} type="button">
              <Eye size={17} />
              Ver inventario real
            </button>
          </div>
        </section>

        <section className="warehouse-stat-grid" aria-label="Resumen de almacen">
          <article>
            <ClipboardList size={20} aria-hidden="true" />
            <span>Entradas de hoy</span>
            <strong>{entriesToday}</strong>
          </article>
          <article>
            <PackageCheck size={20} aria-hidden="true" />
            <span>Cantidad capturada</span>
            <strong>{totalQuantity}</strong>
          </article>
          <article>
            <CalendarClock size={20} aria-hidden="true" />
            <span>Por llegar</span>
            <strong>{incomingQuantity}</strong>
          </article>
          <article>
            <MapPinned size={20} aria-hidden="true" />
            <span>Ubicaciones usadas</span>
            <strong>{usedLocations}</strong>
          </article>
        </section>

        {activePurchaseReceipts.length > 0 ? (
          <section className="main-panel warehouse-purchase-receipts">
            <div className="clean-section-heading">
              <div>
                <h2>Órdenes de compra por recibir</h2>
                <p>Recepción conectada con Compras: completo, parcial, dañado o pendiente de revisión.</p>
              </div>
            </div>

            {formError ? <p className="form-error">{formError}</p> : null}

            <div className="warehouse-receipt-list">
              {activePurchaseReceipts.map((receipt) => {
                const receiptDraft = receiptDraftFor(receipt);
                const order = receiptOrderById.get(receipt.purchaseOrderId);

                return (
                  <article className="warehouse-receipt-card" key={receipt.id}>
                    <header className="warehouse-receipt-header">
                      <div>
                        <span>{receipt.purchaseOrderFolio}</span>
                        <strong>{receipt.supplierName}</strong>
                        <p>
                          Llega {formatWarehouseDate(receipt.expectedDate)} · {receipt.internalDestination}
                          {order ? ` · ${order.lines.length} líneas en OC` : ""}
                        </p>
                      </div>
                      <span className={`purchase-pill status-${receipt.status}`}>
                        {pendingReceiptStatusLabels[receipt.status]}
                      </span>
                    </header>

                    <div className="warehouse-receipt-lines">
                      {receipt.lines.map((line) => {
                        const lineDraft = receiptDraft.lines[line.id];
                        const pendingQuantity = Math.max(
                          line.quantity - line.receivedQuantity - line.damagedQuantity - line.reviewQuantity,
                          0
                        );

                        return (
                          <section className="warehouse-receipt-line" key={line.id}>
                            <div className="warehouse-receipt-line-main">
                              <strong>{line.itemName}</strong>
                              <span>
                                {line.productSku || "Compra manual"} · pendiente {formatQuantity(pendingQuantity, line.unit)} de{" "}
                                {formatQuantity(line.quantity, line.unit)}
                              </span>
                            </div>

                            <div className="warehouse-receipt-line-controls">
                              <label className="field">
                                <span>Recibido</span>
                                <input
                                  min="0"
                                  step="0.01"
                                  type="number"
                                  value={lineDraft.receivedQuantity}
                                  onChange={(event) =>
                                    updateReceiptLineDraft(
                                      receipt,
                                      line.id,
                                      "receivedQuantity",
                                      Number(event.target.value)
                                    )
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>Dañado</span>
                                <input
                                  min="0"
                                  step="0.01"
                                  type="number"
                                  value={lineDraft.damagedQuantity}
                                  onChange={(event) =>
                                    updateReceiptLineDraft(
                                      receipt,
                                      line.id,
                                      "damagedQuantity",
                                      Number(event.target.value)
                                    )
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>Revisión</span>
                                <input
                                  min="0"
                                  step="0.01"
                                  type="number"
                                  value={lineDraft.reviewQuantity}
                                  onChange={(event) =>
                                    updateReceiptLineDraft(
                                      receipt,
                                      line.id,
                                      "reviewQuantity",
                                      Number(event.target.value)
                                    )
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>Notas línea</span>
                                <input
                                  value={lineDraft.receiptNotes}
                                  onChange={(event) =>
                                    updateReceiptLineDraft(receipt, line.id, "receiptNotes", event.target.value)
                                  }
                                  placeholder={warehouseUnitLabels[line.unit]}
                                />
                              </label>
                            </div>
                          </section>
                        );
                      })}
                    </div>

                    <div className="warehouse-receipt-footer">
                      <label className="field">
                        <span>Recibió</span>
                        <input
                          value={receiptDraft.receivedBy}
                          onChange={(event) => updateReceiptDraft(receipt, "receivedBy", event.target.value)}
                          placeholder="Nombre"
                        />
                      </label>
                      <label className="field">
                        <span>Ubicación</span>
                        <select
                          value={receiptDraft.locationId}
                          onChange={(event) => updateReceiptDraft(receipt, "locationId", event.target.value)}
                        >
                          {warehouseLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Tipo problema</span>
                        <select
                          value={receiptDraft.issue}
                          onChange={(event) =>
                            updateReceiptDraft(receipt, "issue", event.target.value as PurchaseReceiptIssue | "")
                          }
                        >
                          <option value="">Sin problema</option>
                          {Object.entries(purchaseReceiptIssueLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field wide-field">
                        <span>Notas de recepción</span>
                        <input
                          value={receiptDraft.issueNotes}
                          onChange={(event) => updateReceiptDraft(receipt, "issueNotes", event.target.value)}
                          placeholder="Faltante, daño, guía, empaque, lote"
                        />
                      </label>
                    </div>

                    <div className="warehouse-receipt-actions">
                      <button className="primary-button compact-button" onClick={() => receiveReceipt(receipt, "recibida")} type="button">
                        <PackageCheck size={15} />
                        Recibir completo
                      </button>
                      <button className="secondary-button compact-button" onClick={() => receiveReceipt(receipt, "parcial")} type="button">
                        <ClipboardList size={15} />
                        Registrar parcial
                      </button>
                      <button
                        className="secondary-button compact-button"
                        onClick={() => receiveReceipt(receipt, "pendiente-revision")}
                        type="button"
                      >
                        <Eye size={15} />
                        Mandar a revisión
                      </button>
                      <button className="secondary-button compact-button danger-button" onClick={() => receiveReceipt(receipt, "problema")} type="button">
                        <AlertTriangle size={15} />
                        Reportar problema
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="main-panel warehouse-layout-config-panel">
          <div className="clean-section-heading">
            <div>
              <h2>Configurar ubicaciones</h2>
              <p>Define filas, columnas por fila, niveles y bins para generar el mapa 2D.</p>
            </div>
            <button className="secondary-button compact-button" onClick={resetLayoutConfig} type="button">
              <RotateCcw size={15} />
              Restablecer
            </button>
          </div>

          <div className="warehouse-layout-config-grid">
            <label className="field">
              <span>Modo</span>
              <select
                value={layoutConfig.mode}
                onChange={(event) => updateLayoutConfig({ mode: event.target.value as WarehouseLayoutMode })}
              >
                <option value="uniforme">Uniforme</option>
                <option value="personalizado">Personalizado por fila</option>
              </select>
            </label>

            <label className="field">
              <span>Filas</span>
              <input
                min="1"
                max="8"
                type="number"
                value={layoutConfig.rows}
                onChange={(event) => updateLayoutNumber("rows", Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Columnas por fila</span>
              <input
                min="1"
                max="8"
                type="number"
                value={layoutConfig.columnsPerRow}
                onChange={(event) => updateLayoutNumber("columnsPerRow", Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Niveles por rack</span>
              <input
                min="1"
                max="4"
                type="number"
                value={layoutConfig.levelsPerRack}
                onChange={(event) => updateLayoutNumber("levelsPerRack", Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Bins por nivel</span>
              <input
                min="1"
                max="4"
                type="number"
                value={layoutConfig.binsPerLevel}
                onChange={(event) => updateLayoutNumber("binsPerLevel", Number(event.target.value))}
              />
            </label>

            <article className="warehouse-layout-summary">
              <Settings2 size={18} aria-hidden="true" />
              <span>Ubicaciones generadas</span>
              <strong>{generatedLocationsCount}</strong>
            </article>
          </div>

          {layoutConfig.mode === "personalizado" ? (
            <div className="warehouse-custom-row-list">
              {layoutConfig.customRows.map((row) => (
                <label className="warehouse-custom-row" key={row.id}>
                  <span>Fila {row.label}</span>
                  <input
                    min="1"
                    max="8"
                    type="number"
                    value={row.columns}
                    onChange={(event) => updateCustomRowColumns(row.id, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </section>

        <div className="warehouse-layout">
          <section className="main-panel warehouse-entry-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Registro de entrada</h2>
                <p>Captura material recibido, cantidad, estado y ubicacion fisica.</p>
              </div>
            </div>

            <form className="warehouse-entry-form" onSubmit={handleSubmit}>
              <label className="field wide-field">
                <span>Usar componente de producto</span>
                <select value={selectedComponentId} onChange={(event) => selectComponent(event.target.value)}>
                  <option value="manual">Captura manual</option>
                  {componentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.component.name || "Componente sin nombre"} / {option.productName || "Producto sin nombre"}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-grid two-columns">
                <label className="field">
                  <span>Que llego</span>
                  <input
                    value={draft.itemName}
                    onChange={(event) => updateDraft("itemName", event.target.value)}
                    placeholder="Ej. Tornillo M4, motor, carcasa"
                  />
                </label>

                <label className="field">
                  <span>SKU o codigo</span>
                  <input
                    value={draft.sku}
                    onChange={(event) => updateDraft("sku", event.target.value)}
                    placeholder="Codigo interno o proveedor"
                  />
                </label>

                <label className="field">
                  <span>Tipo</span>
                  <select
                    value={draft.materialType}
                    onChange={(event) => updateDraft("materialType", event.target.value as WarehouseMaterialType)}
                  >
                    {Object.entries(warehouseMaterialTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Fecha de entrada</span>
                  <input
                    type="date"
                    value={draft.receivedAt}
                    onChange={(event) => updateDraft("receivedAt", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Cantidad</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={draft.quantity}
                    onChange={(event) => updateDraft("quantity", Number(event.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Maximo por ubicacion</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={draft.maxPerLocation}
                    onChange={(event) => updateDraft("maxPerLocation", Number(event.target.value))}
                    placeholder="Ej. 50"
                  />
                </label>

                <label className="field">
                  <span>Cantidad por llegar</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={draft.incomingQuantity}
                    onChange={(event) => updateDraft("incomingQuantity", Number(event.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Fecha por llegar</span>
                  <input
                    type="date"
                    value={draft.expectedArrivalDate}
                    onChange={(event) => updateDraft("expectedArrivalDate", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Unidad</span>
                  <select value={draft.unit} onChange={(event) => updateDraft("unit", event.target.value as ProductUnit)}>
                    {Object.entries(warehouseUnitLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Ubicacion inicial</span>
                  <select value={draft.locationId} onChange={(event) => updateDraft("locationId", event.target.value)}>
                    {warehouseLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Estado</span>
                  <select
                    value={draft.status}
                    onChange={(event) => updateDraft("status", event.target.value as WarehouseEntryStatus)}
                  >
                    {Object.entries(warehouseEntryStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Proveedor u origen</span>
                  <input value={draft.supplier} onChange={(event) => updateDraft("supplier", event.target.value)} />
                </label>

                <label className="field">
                  <span>Recibio</span>
                  <input value={draft.receivedBy} onChange={(event) => updateDraft("receivedBy", event.target.value)} />
                </label>
              </div>

              <section className="warehouse-allocation-panel" aria-label="Distribucion por ubicacion">
                <div className="warehouse-allocation-toolbar">
                  <div>
                    <span>Distribucion por ubicacion</span>
                    <strong>
                      Asignado {allocatedQuantity} / {draft.quantity} {warehouseUnitLabels[draft.unit].toLowerCase()}
                    </strong>
                  </div>
                  <div className="warehouse-allocation-actions">
                    <button className="secondary-button compact-button" onClick={suggestAllocations} type="button">
                      <MapPinned size={15} />
                      Sugerir distribucion
                    </button>
                    <button className="secondary-button compact-button" onClick={addAllocation} type="button">
                      <Plus size={15} />
                      Agregar ubicacion
                    </button>
                  </div>
                </div>

                <div className="warehouse-allocation-summary">
                  <span>
                    {draft.maxPerLocation > 0
                      ? `Maximo ${draft.maxPerLocation} por ubicacion`
                      : "Sin maximo definido"}
                  </span>
                  <span className={unassignedQuantity > quantityTolerance ? "pending" : "ready"}>
                    Pendiente {unassignedQuantity > quantityTolerance ? unassignedQuantity : 0}
                  </span>
                  {overAssignedQuantity > quantityTolerance ? (
                    <span className="over">Excedente {overAssignedQuantity}</span>
                  ) : null}
                </div>

                <div className="warehouse-allocation-list">
                  {draft.allocations.map((allocation) => (
                    <div className="warehouse-allocation-row" key={allocation.id}>
                      <label className="field">
                        <span>Ubicacion</span>
                        <select
                          value={allocation.locationId}
                          onChange={(event) => updateAllocation(allocation.id, { locationId: event.target.value })}
                        >
                          {warehouseLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Cantidad</span>
                        <input
                          min="0"
                          step="0.01"
                          type="number"
                          value={allocation.quantity}
                          onChange={(event) =>
                            updateAllocation(allocation.id, { quantity: Number(event.target.value) })
                          }
                        />
                      </label>

                      <button
                        className="icon-button ghost warehouse-allocation-remove"
                        onClick={() => removeAllocation(allocation.id)}
                        type="button"
                        aria-label="Quitar ubicacion"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>

                {draft.allocations.length === 0 ? (
                  <p className="warehouse-allocation-warning">Agrega una ubicacion para registrar esta entrada.</p>
                ) : null}
                {unassignedQuantity > quantityTolerance ? (
                  <p className="warehouse-allocation-warning">Queda cantidad recibida sin ubicacion.</p>
                ) : null}
              </section>

              <label className="field wide-field">
                <span>Notas</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) => updateDraft("notes", event.target.value)}
                  placeholder="Condicion, empaque, factura, lote, observaciones"
                />
              </label>

              {formError ? <p className="form-error">{formError}</p> : null}

              <button className="primary-button input-height-button" type="submit">
                <Plus size={17} />
                Registrar entrada
              </button>
            </form>
          </section>

          <section className="main-panel warehouse-activity-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Entradas recientes</h2>
                <p>Movimientos que alimentan el inventario real.</p>
              </div>
            </div>

            <label className="search-field client-search">
              <Search size={18} aria-hidden="true" />
              <input
                value={entryQuery}
                onChange={(event) => setEntryQuery(event.target.value)}
                placeholder="Buscar material, SKU, proveedor o ubicacion"
              />
            </label>

            <div className="warehouse-entry-list">
              {filteredEntries.map((entry) => (
                <article className="warehouse-entry-row" key={entry.id}>
                  <div className="warehouse-entry-main">
                    <strong>{entry.itemName}</strong>
                    <span>{entry.sku || "Sin SKU"}</span>
                  </div>
                  <div className="warehouse-entry-stat">
                    <span>Cantidad</span>
                    <strong>{formatQuantity(entry.quantity, entry.unit)}</strong>
                  </div>
                  <div className="warehouse-entry-stat">
                    <span>Por llegar</span>
                    <strong>
                      {entry.incomingQuantity > 0
                        ? `${formatQuantity(entry.incomingQuantity, entry.unit)} / ${formatWarehouseDate(
                            entry.expectedArrivalDate
                          )}`
                        : "0"}
                    </strong>
                  </div>
                  <div className="warehouse-entry-stat">
                    <span>Ubicaciones</span>
                    <strong>{getEntryLocationSummary(entry)}</strong>
                  </div>
                  <div className="warehouse-entry-stat">
                    <span>Fecha</span>
                    <strong>{formatWarehouseDate(entry.receivedAt)}</strong>
                  </div>
                  <span className={`status-pill ${entry.status}`}>{warehouseEntryStatusLabels[entry.status]}</span>
                </article>
              ))}

              {entries.length === 0 ? <p className="empty-state">Todavia no hay entradas registradas.</p> : null}
              {entries.length > 0 && filteredEntries.length === 0 ? (
                <p className="empty-state">No hay entradas con esa busqueda.</p>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      {isInventoryMapOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-shell warehouse-map-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="warehouse-map-title"
          >
            <header className="modal-header">
              <div>
                <span className="section-kicker">Visualizacion 2D</span>
                <h2 id="warehouse-map-title">Inventario real</h2>
              </div>
              <button className="icon-button ghost" onClick={() => setInventoryMapOpen(false)} type="button" aria-label="Cerrar mapa">
                <X size={20} />
              </button>
            </header>

            <div className="warehouse-map-layout">
              <div className="warehouse-map-scroll">
                <div
                  className="warehouse-map-canvas"
                  aria-label="Mapa 2D del almacen"
                  style={
                    {
                      "--map-min-width": `${mapSize.width}px`,
                      "--map-min-height": `${mapSize.height}px`
                    } as React.CSSProperties
                  }
                >
                  {locationInventory.map((locationStock) => (
                    <button
                      className={`warehouse-location-cell ${locationStock.status} ${
                        locationStock.location.id === selectedLocationId ? "selected" : ""
                      }`}
                      key={locationStock.location.id}
                      onClick={() => setSelectedLocationId(locationStock.location.id)}
                      style={
                        {
                          "--x": `${locationStock.location.x}%`,
                          "--y": `${locationStock.location.y}%`,
                          "--w": `${locationStock.location.width}%`,
                          "--h": `${locationStock.location.height}%`
                        } as React.CSSProperties
                      }
                      title={locationStock.location.label}
                      type="button"
                    >
                      <strong>{getMapRackLabel(locationStock.location)}</strong>
                      {getMapPositionLabel(locationStock.location) ? <span>{getMapPositionLabel(locationStock.location)}</span> : null}
                      <small>
                        {locationStock.totalQuantity || 0} / {locationStock.entryCount} reg.
                      </small>
                    </button>
                  ))}
                  <div className="warehouse-map-aisle">Pasillo principal</div>
                </div>
              </div>

              <aside className="warehouse-location-detail">
                <span className="section-kicker">Ubicacion</span>
                <h3>{selectedLocationInventory?.location.label}</h3>
                <dl className="warehouse-location-meta">
                  <div>
                    <dt>Zona</dt>
                    <dd>{selectedLocationInventory?.location.zone}</dd>
                  </div>
                  <div>
                    <dt>Rack</dt>
                    <dd>{selectedLocationInventory?.location.rack}</dd>
                  </div>
                  <div>
                    <dt>Nivel</dt>
                    <dd>{selectedLocationInventory?.location.level}</dd>
                  </div>
                  <div>
                    <dt>Bin</dt>
                    <dd>{selectedLocationInventory?.location.bin}</dd>
                  </div>
                </dl>

                <div className="warehouse-inventory-records">
                  {selectedLocationInventory?.records.map((record) => (
                    <article className="warehouse-inventory-record" key={record.key}>
                      <div>
                        <strong>{record.itemName}</strong>
                        <span>{record.sku || warehouseMaterialTypeLabels[record.materialType]}</span>
                      </div>
                      <span className={`status-pill ${record.status}`}>{warehouseEntryStatusLabels[record.status]}</span>
                      <small>{formatQuantity(record.totalQuantity, record.unit)} en almacen</small>
                      {record.incomingQuantity > 0 ? (
                        <small>
                          Por llegar: {formatQuantity(record.incomingQuantity, record.unit)} /{" "}
                          {formatWarehouseDate(record.nextArrivalDate)}
                        </small>
                      ) : null}
                    </article>
                  ))}

                  {selectedLocationInventory?.records.length === 0 ? (
                    <p className="empty-state">Ubicacion sin inventario registrado.</p>
                  ) : null}
                </div>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
