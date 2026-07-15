import { Edit3, FileUp, Plus, Trash2, X } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import type {
  Product,
  ProductComponent,
  ProductComponentProcess,
  ProductComponentType,
  ProductCurrency,
  ProductPrintDesign,
  ProductStatus,
  ProductUnit
} from "../../sales/types";
import {
  colorOptions,
  componentProcessLabels,
  componentTypeLabels,
  createId,
  currencyLabels,
  formatCurrency,
  materialOptions,
  productStatusLabels,
  productUnitLabels
} from "../../sales/utils";

type ProductDraft = Omit<Product, "id">;

type ProductEditorModalProps = {
  product?: Product;
  onClose: () => void;
  onSave: (product: ProductDraft, existingProduct?: Product) => void;
};

const printerOptions = ["P1S", "OTRA"] as const;

const emptyPrintDesign = (printer = "P1S"): ProductPrintDesign => ({
  id: createId("print-design"),
  printer,
  fileName: "",
  notes: ""
});

function optionValue(value: string, options: readonly string[]) {
  if (value === "OTRO") {
    return "OTRO";
  }

  if (!value) {
    return "";
  }

  return options.includes(value) ? value : "OTRO";
}

function customOptionValue(value: string, options: readonly string[]) {
  return value && value !== "OTRO" && !options.includes(value) ? value : "";
}

const emptyComponent = (): ProductComponent => ({
  id: createId("component"),
  name: "",
  type: "comprado",
  quantity: 1,
  unit: "pieza",
  process: "comprado",
  material: "",
  color: "",
  supplierCompany: "",
  supplierContact: "",
  supplierEmail: "",
  supplierPhone: "",
  supplierPartNumber: "",
  unitCost: 0,
  leadTime: "",
  minimumPurchaseQuantity: "",
  referenceLink: "",
  needsSupplierResearch: false,
  supplierResearchNotes: "",
  printDesigns: [],
  notes: ""
});

const emptyProduct: ProductDraft = {
  sku: "",
  name: "",
  shortDescription: "",
  category: "",
  basePrice: 0,
  currency: "MXN",
  unit: "pieza",
  status: "borrador",
  commercialNotes: "",
  technicalNotes: "",
  components: []
};

export function ProductEditorModal({ product, onClose, onSave }: ProductEditorModalProps) {
  const [draft, setDraft] = useState<ProductDraft>(
    product
      ? {
          sku: product.sku,
          name: product.name,
          shortDescription: product.shortDescription,
          category: product.category,
          basePrice: product.basePrice,
          currency: product.currency ?? "MXN",
          unit: product.unit,
          status: product.status,
          commercialNotes: product.commercialNotes,
          technicalNotes: product.technicalNotes,
          components: product.components.map((component) => ({
            ...component,
            needsSupplierResearch: component.needsSupplierResearch ?? false,
            supplierResearchNotes: component.supplierResearchNotes ?? "",
            printDesigns: component.printDesigns ?? []
          }))
        }
      : emptyProduct
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [expandedComponentId, setExpandedComponentId] = useState<string | null>(() => product?.components[0]?.id ?? null);

  function updateField<Key extends keyof ProductDraft>(key: Key, value: ProductDraft[Key]) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function updateComponent<Key extends keyof ProductComponent>(
    componentId: string,
    key: Key,
    value: ProductComponent[Key]
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.map((component) =>
        component.id === componentId ? { ...component, [key]: value } : component
      )
    }));
  }

  function updateSupplierResearch(componentId: string, needsSupplierResearch: boolean) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.map((component) => {
        if (component.id !== componentId) {
          return component;
        }

        if (!needsSupplierResearch) {
          return { ...component, needsSupplierResearch };
        }

        return {
          ...component,
          needsSupplierResearch,
          supplierCompany: "",
          supplierContact: "",
          supplierEmail: "",
          supplierPhone: "",
          supplierPartNumber: "",
          unitCost: 0,
          leadTime: "",
          minimumPurchaseQuantity: "",
          referenceLink: ""
        };
      })
    }));
  }

  function updateComponentProcess(componentId: string, process: ProductComponentProcess) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.map((component) => {
        if (component.id !== componentId) {
          return component;
        }

        return {
          ...component,
          process,
          printDesigns:
            process === "impresion-3d" && component.printDesigns.length === 0
              ? [emptyPrintDesign("P1S")]
              : component.printDesigns
        };
      })
    }));
  }

  function updatePrintDesign<Key extends keyof ProductPrintDesign>(
    componentId: string,
    designId: string,
    key: Key,
    value: ProductPrintDesign[Key]
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.map((component) =>
        component.id === componentId
          ? {
              ...component,
              printDesigns: component.printDesigns.map((design) =>
                design.id === designId ? { ...design, [key]: value } : design
              )
            }
          : component
      )
    }));
  }

  function addPrintDesign(componentId: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.map((component) =>
        component.id === componentId
          ? { ...component, printDesigns: [...component.printDesigns, emptyPrintDesign("")] }
          : component
      )
    }));
  }

  function removePrintDesign(componentId: string, designId: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.map((component) =>
        component.id === componentId
          ? { ...component, printDesigns: component.printDesigns.filter((design) => design.id !== designId) }
          : component
      )
    }));
  }

  function addComponent() {
    const component = emptyComponent();

    setDraft((currentDraft) => ({
      ...currentDraft,
      components: [...currentDraft.components, component]
    }));
    setExpandedComponentId(component.id);
  }

  function removeComponent(componentId: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.filter((component) => component.id !== componentId)
    }));
    setExpandedComponentId((currentExpandedComponentId) =>
      currentExpandedComponentId === componentId ? null : currentExpandedComponentId
    );
  }

  function attachPrintDesignFile(componentId: string, designId: string, event: ChangeEvent<HTMLInputElement>) {
    const fileName = Array.from(event.target.files ?? [])
      .map((file) => file.name)
      .find((selectedFileName) => selectedFileName.toLowerCase().endsWith(".3mf"));

    if (!fileName) {
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.map((component) =>
        component.id === componentId
          ? {
              ...component,
              printDesigns: component.printDesigns.map((design) =>
                design.id === designId ? { ...design, fileName } : design
              )
            }
          : component
      )
    }));

    event.target.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const optionErrors = draft.components.flatMap((component) => {
      const errors: string[] = [];

      if (component.material === "OTRO") {
        errors.push(`Especifica el material de la pieza "${component.name || "sin nombre"}".`);
      }

      if (component.color === "OTRO") {
        errors.push(`Especifica el color de la pieza "${component.name || "sin nombre"}".`);
      }

      return errors;
    });

    const printErrors = draft.components.flatMap((component) => {
      if (component.process !== "impresion-3d") {
        return [];
      }

      if (component.printDesigns.length === 0) {
        return [`La pieza "${component.name || "sin nombre"}" requiere al menos un diseño .3mf.`];
      }

      return component.printDesigns.flatMap((design, designIndex) => {
        const errors: string[] = [];
        const designName = design.printer.trim() || `diseño ${designIndex + 1}`;

        if (!design.printer.trim()) {
          errors.push(`La pieza "${component.name || "sin nombre"}" necesita impresora en el diseño ${designIndex + 1}.`);
        }

        if (!design.fileName.toLowerCase().endsWith(".3mf")) {
          errors.push(`La pieza "${component.name || "sin nombre"}" necesita archivo .3mf para ${designName}.`);
        }

        return errors;
      });
    });

    const errors = [...optionErrors, ...printErrors];

    if (errors.length > 0) {
      const firstInvalidComponent = draft.components.find((component) => {
        if (component.material === "OTRO" || component.color === "OTRO") {
          return true;
        }

        if (component.process !== "impresion-3d") {
          return false;
        }

        return (
          component.printDesigns.length === 0 ||
          component.printDesigns.some(
            (design) => !design.printer.trim() || !design.fileName.toLowerCase().endsWith(".3mf")
          )
        );
      });

      if (firstInvalidComponent) {
        setExpandedComponentId(firstInvalidComponent.id);
      }

      setValidationErrors(errors);
      return;
    }

    const normalizedDraft: ProductDraft = {
      ...draft,
      components: draft.components.map((component) => ({
        ...component,
        material: component.material.toUpperCase(),
        color: component.color.toUpperCase(),
        printDesigns:
          component.process === "impresion-3d"
            ? component.printDesigns.map((design) => ({
                ...design,
                printer: design.printer.toUpperCase()
              }))
            : []
      }))
    };

    setValidationErrors([]);
    onSave(normalizedDraft, product);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-shell product-editor-modal" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
        <header className="modal-header">
          <h2 id="product-editor-title">{product ? "Editar producto" : "Agregar producto"}</h2>
          <button className="icon-button ghost" onClick={onClose} type="button" aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </header>

        <form className="modal-form" onSubmit={handleSubmit}>
          <section className="product-editor-section">
            <h3>Datos del producto</h3>
            <div className="form-grid three-columns">
              <label className="field">
                <span>Nombre del producto</span>
                <input value={draft.name} onChange={(event) => updateField("name", event.target.value)} autoFocus />
              </label>

              <label className="field">
                <span>SKU</span>
                <input value={draft.sku} onChange={(event) => updateField("sku", event.target.value)} />
              </label>

              <label className="field">
                <span>Categoría</span>
                <input value={draft.category} onChange={(event) => updateField("category", event.target.value)} />
              </label>

              <label className="field">
                <span>Precio de venta</span>
                <input
                  min="0"
                  type="number"
                  value={draft.basePrice}
                  onChange={(event) => updateField("basePrice", Number(event.target.value))}
                />
              </label>

              <label className="field">
                <span>Moneda</span>
                <select value={draft.currency} onChange={(event) => updateField("currency", event.target.value as ProductCurrency)}>
                  {Object.entries(currencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="price-preview">
                <span>Vista previa</span>
                <strong>{formatCurrency(draft.basePrice, draft.currency)}</strong>
              </div>

              <label className="field">
                <span>Unidad de venta</span>
                <select value={draft.unit} onChange={(event) => updateField("unit", event.target.value as ProductUnit)}>
                  {Object.entries(productUnitLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Estado</span>
                <select value={draft.status} onChange={(event) => updateField("status", event.target.value as ProductStatus)}>
                  {Object.entries(productStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field wide-field">
                <span>Descripción</span>
                <textarea
                  value={draft.shortDescription}
                  onChange={(event) => updateField("shortDescription", event.target.value)}
                />
              </label>
            </div>

            <div className="form-grid two-columns">
              <label className="field">
                <span>Notas comerciales</span>
                <textarea
                  value={draft.commercialNotes}
                  onChange={(event) => updateField("commercialNotes", event.target.value)}
                />
              </label>

              <label className="field">
                <span>Notas técnicas</span>
                <textarea value={draft.technicalNotes} onChange={(event) => updateField("technicalNotes", event.target.value)} />
              </label>
            </div>
          </section>

          <section className="product-editor-section">
            <div className="component-heading">
              <div>
                <h3>Componentes / piezas</h3>
                <p>Agrega tornillería, motores, cableado, piezas impresas, compradas o fabricadas.</p>
              </div>
              <button className="secondary-button" onClick={addComponent} type="button">
                <Plus size={16} />
                Agregar componente
              </button>
            </div>

            <div className="component-editor-list">
              {draft.components.map((component, index) => {
                const isExpanded = expandedComponentId === component.id;
                const componentName = component.name.trim() || "Componente sin nombre";
                const quantityLabel = `${component.quantity} ${productUnitLabels[component.unit].toLowerCase()}`;

                return (
                <article className={`component-editor-card ${isExpanded ? "expanded" : "collapsed"}`} key={component.id}>
                  <div className="component-card-header">
                    {isExpanded ? (
                      <>
                        <strong>Componente {index + 1}</strong>
                        <button
                          className="icon-button ghost"
                          onClick={() => removeComponent(component.id)}
                          type="button"
                          aria-label="Eliminar componente"
                        >
                          <Trash2 size={17} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="component-collapsed-main">
                          <span>Componente {index + 1}</span>
                          <strong>{componentName}</strong>
                        </div>
                        <div className="component-collapsed-count">
                          <span>Cantidad</span>
                          <strong>{quantityLabel}</strong>
                        </div>
                        <button
                          className="secondary-button compact-button"
                          onClick={() => setExpandedComponentId(component.id)}
                          type="button"
                        >
                          <Edit3 size={15} />
                          Editar
                        </button>
                      </>
                    )}
                  </div>

                  {isExpanded ? (
                    <>
                  <div className="form-grid four-columns">
                    <label className="field">
                      <span>Nombre</span>
                      <input value={component.name} onChange={(event) => updateComponent(component.id, "name", event.target.value)} />
                    </label>

                    <label className="field">
                      <span>Tipo</span>
                      <select
                        value={component.type}
                        onChange={(event) => updateComponent(component.id, "type", event.target.value as ProductComponentType)}
                      >
                        {Object.entries(componentTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Cantidad</span>
                      <input
                        min="0"
                        type="number"
                        value={component.quantity}
                        onChange={(event) => updateComponent(component.id, "quantity", Number(event.target.value))}
                      />
                    </label>

                    <label className="field">
                      <span>Unidad</span>
                      <select
                        value={component.unit}
                        onChange={(event) => updateComponent(component.id, "unit", event.target.value as ProductUnit)}
                      >
                        {Object.entries(productUnitLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Proceso</span>
                      <select
                        value={component.process}
                        onChange={(event) => updateComponentProcess(component.id, event.target.value as ProductComponentProcess)}
                      >
                        {Object.entries(componentProcessLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>MATERIAL</span>
                      <select
                        value={optionValue(component.material, materialOptions)}
                        onChange={(event) =>
                          updateComponent(component.id, "material", event.target.value)
                        }
                      >
                        <option value="">SELECCIONA</option>
                        {materialOptions.map((material) => (
                          <option key={material} value={material}>
                            {material}
                          </option>
                        ))}
                      </select>
                    </label>

                    {optionValue(component.material, materialOptions) === "OTRO" && (
                      <label className="field">
                        <span>ESPECIFICAR MATERIAL</span>
                        <input
                          value={customOptionValue(component.material, materialOptions)}
                          onChange={(event) => updateComponent(component.id, "material", event.target.value.toUpperCase())}
                        />
                      </label>
                    )}

                    <label className="field">
                      <span>COLOR</span>
                      <select
                        value={optionValue(component.color, colorOptions)}
                        onChange={(event) =>
                          updateComponent(component.id, "color", event.target.value)
                        }
                      >
                        <option value="">SELECCIONA</option>
                        {colorOptions.map((color) => (
                          <option key={color} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                    </label>

                    {optionValue(component.color, colorOptions) === "OTRO" && (
                      <label className="field">
                        <span>ESPECIFICAR COLOR</span>
                        <input
                          value={customOptionValue(component.color, colorOptions)}
                          onChange={(event) => updateComponent(component.id, "color", event.target.value.toUpperCase())}
                        />
                      </label>
                    )}
                  </div>

                  {(component.process === "comprado" || component.process === "servicio-externo") && (
                    <div className="supplier-block">
                      <h4>Proveedor / compra</h4>
                      <div className="supplier-mode-row">
                        <label className="checkbox-field supplier-checkbox">
                          <input
                            type="checkbox"
                            checked={component.needsSupplierResearch}
                            onChange={(event) => updateSupplierResearch(component.id, event.target.checked)}
                          />
                          <span>
                            <strong>Sin proveedor</strong>
                            <small>Compras investigará con quién comprar esta pieza.</small>
                          </span>
                        </label>

                        {component.needsSupplierResearch ? (
                          <span className="supplier-pending-pill">Pendiente de compras</span>
                        ) : null}
                      </div>

                      {component.needsSupplierResearch ? (
                        <label className="field supplier-notes-field">
                          <span>Notas para compras</span>
                          <textarea
                            value={component.supplierResearchNotes}
                            onChange={(event) => updateComponent(component.id, "supplierResearchNotes", event.target.value)}
                            placeholder="Ej. buscar proveedor nacional, revisar material, pedir cotización por volumen..."
                          />
                        </label>
                      ) : (
                        <div className="form-grid four-columns">
                        <label className="field">
                          <span>Empresa</span>
                          <input
                            value={component.supplierCompany}
                            onChange={(event) => updateComponent(component.id, "supplierCompany", event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span>Contacto</span>
                          <input
                            value={component.supplierContact}
                            onChange={(event) => updateComponent(component.id, "supplierContact", event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span>Correo</span>
                          <input
                            value={component.supplierEmail}
                            onChange={(event) => updateComponent(component.id, "supplierEmail", event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span>Teléfono</span>
                          <input
                            value={component.supplierPhone}
                            onChange={(event) => updateComponent(component.id, "supplierPhone", event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span>No. parte proveedor</span>
                          <input
                            value={component.supplierPartNumber}
                            onChange={(event) => updateComponent(component.id, "supplierPartNumber", event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span>Costo unitario</span>
                          <input
                            min="0"
                            type="number"
                            value={component.unitCost}
                            onChange={(event) => updateComponent(component.id, "unitCost", Number(event.target.value))}
                          />
                        </label>

                        <label className="field">
                          <span>Tiempo entrega</span>
                          <input value={component.leadTime} onChange={(event) => updateComponent(component.id, "leadTime", event.target.value)} />
                        </label>

                        <label className="field">
                          <span>Mínimo compra</span>
                          <input
                            value={component.minimumPurchaseQuantity}
                            onChange={(event) => updateComponent(component.id, "minimumPurchaseQuantity", event.target.value)}
                          />
                        </label>

                        <label className="field wide-field">
                          <span>Link o referencia</span>
                          <input
                            value={component.referenceLink}
                            onChange={(event) => updateComponent(component.id, "referenceLink", event.target.value)}
                          />
                        </label>
                      </div>
                      )}
                    </div>
                  )}

                  {component.process === "impresion-3d" && (
                    <div className="print-design-block">
                      <div className="component-heading compact-heading">
                        <div>
                          <h4>Diseños 3MF por impresora</h4>
                          <p>Cada diseño debe indicar impresora y archivo .3MF.</p>
                        </div>
                        <button className="secondary-button compact-button" onClick={() => addPrintDesign(component.id)} type="button">
                          <Plus size={15} />
                          Agregar diseño para otra impresora
                        </button>
                      </div>

                      <div className="print-design-list">
                        {component.printDesigns.map((design) => (
                          <article className="print-design-row" key={design.id}>
                            <label className="field">
                              <span>IMPRESORA</span>
                              <select
                                value={printerOptions.includes(design.printer as (typeof printerOptions)[number]) ? design.printer : "OTRA"}
                                onChange={(event) =>
                                  updatePrintDesign(
                                    component.id,
                                    design.id,
                                    "printer",
                                    event.target.value === "OTRA" ? "" : event.target.value
                                  )
                                }
                              >
                                {printerOptions.map((printer) => (
                                  <option key={printer} value={printer}>
                                    {printer}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {design.printer !== "P1S" && (
                              <label className="field">
                                <span>ESPECIFICAR IMPRESORA</span>
                                <input
                                  value={design.printer === "OTRA" ? "" : design.printer}
                                  onChange={(event) =>
                                    updatePrintDesign(component.id, design.id, "printer", event.target.value.toUpperCase())
                                  }
                                />
                              </label>
                            )}

                            <div className="field">
                              <span>ARCHIVO 3MF</span>
                              <label className="secondary-button input-height-button file-button">
                                <FileUp size={16} />
                                {design.fileName || "Subir archivo .3mf"}
                                <input
                                  hidden
                                  type="file"
                                  accept=".3mf"
                                  onChange={(event) => attachPrintDesignFile(component.id, design.id, event)}
                                />
                              </label>
                            </div>

                            <label className="field">
                              <span>Notas</span>
                              <input
                                value={design.notes}
                                onChange={(event) => updatePrintDesign(component.id, design.id, "notes", event.target.value)}
                              />
                            </label>

                            <button
                              className="icon-button ghost"
                              onClick={() => removePrintDesign(component.id, design.id)}
                              type="button"
                              aria-label="Eliminar diseño"
                            >
                              <Trash2 size={17} />
                            </button>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="field">
                    <span>Notas del componente</span>
                    <textarea value={component.notes} onChange={(event) => updateComponent(component.id, "notes", event.target.value)} />
                  </label>
                    </>
                  ) : null}
                </article>
                );
              })}

              {draft.components.length === 0 ? <p className="empty-state">Sin componentes definidos.</p> : null}
            </div>
          </section>

          {validationErrors.length > 0 ? (
            <div className="form-error-list" role="alert">
              {validationErrors.map((error) => (
                <span key={error}>{error}</span>
              ))}
            </div>
          ) : null}

          <footer className="modal-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              Guardar producto
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
