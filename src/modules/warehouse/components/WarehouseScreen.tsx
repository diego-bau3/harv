import {
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
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Product, ProductComponent, ProductUnit } from "../../sales/types";
import { createId, todayIso } from "../../sales/utils";
import { defaultWarehouseLayoutConfig, initialWarehouseEntries } from "../data";
import type {
  WarehouseEntry,
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
  onBack: () => void;
};

type ComponentOption = {
  id: string;
  productName: string;
  productSku: string;
  component: ProductComponent;
};

const entriesStorageKey = "harv:warehouse-entries:v2";
const layoutStorageKey = "harv:warehouse-layout:v1";

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
    supplier: "",
    receivedBy: "",
    status: "disponible",
    notes: ""
  };
}

function normalizeStoredEntry(entry: Partial<WarehouseEntry>, fallbackLocationId: string): WarehouseEntry {
  return {
    ...createEmptyDraft(fallbackLocationId),
    ...entry,
    id: entry.id ?? createId("entry"),
    itemName: entry.itemName ?? "",
    sku: entry.sku ?? "",
    quantity: Number(entry.quantity ?? 0),
    incomingQuantity: Number(entry.incomingQuantity ?? 0),
    expectedArrivalDate: entry.expectedArrivalDate ?? "",
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

export function WarehouseScreen({ products, onBack }: WarehouseScreenProps) {
  const [layoutConfig, setLayoutConfig] = useState<WarehouseLayoutConfig>(loadStoredLayoutConfig);
  const warehouseLocations = useMemo(() => createWarehouseLocations(layoutConfig), [layoutConfig]);
  const mapSize = useMemo(() => getMapSize(layoutConfig), [layoutConfig]);
  const defaultLocationId = warehouseLocations[0]?.id ?? "";
  const [entries, setEntries] = useState<WarehouseEntry[]>(() => loadStoredEntries(defaultLocationId));
  const [draft, setDraft] = useState<WarehouseEntryDraft>(() => createEmptyDraft(defaultLocationId));
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
      if (warehouseLocations.some((location) => location.id === currentDraft.locationId)) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        locationId: defaultLocationId
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
  const incomingQuantity = entries.reduce((total, entry) => total + entry.incomingQuantity, 0);
  const usedLocations = new Set(entries.map((entry) => entry.locationId)).size;

  function updateDraft<Key extends keyof WarehouseEntryDraft>(key: Key, value: WarehouseEntryDraft[Key]) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
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

    if (!draft.locationId) {
      setFormError("Selecciona una ubicacion.");
      return;
    }

    const savedEntry: WarehouseEntry = {
      ...draft,
      id: createId("entry"),
      itemName: draft.itemName.trim(),
      sku: draft.sku.trim(),
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
                  <span>Ubicacion</span>
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
                    <span>Ubicacion</span>
                    <strong>{getLocationLabel(entry.locationId, warehouseLocations)}</strong>
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
