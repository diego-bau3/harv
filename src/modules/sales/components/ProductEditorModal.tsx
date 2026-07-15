import { FileUp, Plus, Trash2, X } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import type {
  Product,
  ProductComponent,
  ProductComponentProcess,
  ProductComponentStatus,
  ProductComponentType,
  ProductStatus,
  ProductUnit
} from "../types";
import {
  componentProcessLabels,
  componentStatusLabels,
  componentTypeLabels,
  createId,
  productStatusLabels,
  productUnitLabels
} from "../utils";

type ProductDraft = Omit<Product, "id">;

type ProductEditorModalProps = {
  product?: Product;
  onClose: () => void;
  onSave: (product: ProductDraft, existingProduct?: Product) => void;
};

const emptyComponent = (): ProductComponent => ({
  id: createId("component"),
  name: "",
  type: "comprado",
  quantity: 1,
  unit: "pieza",
  process: "comprado",
  status: "pendiente",
  dimensions: "",
  material: "",
  color: "",
  finish: "",
  supplierCompany: "",
  supplierContact: "",
  supplierEmail: "",
  supplierPhone: "",
  supplierPartNumber: "",
  unitCost: 0,
  leadTime: "",
  minimumPurchaseQuantity: "",
  referenceLink: "",
  technicalFiles: [],
  notes: ""
});

const emptyProduct: ProductDraft = {
  sku: "",
  name: "",
  shortDescription: "",
  category: "",
  basePrice: 0,
  unit: "pieza",
  status: "borrador",
  revision: "",
  estimatedProductionTime: "",
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
          unit: product.unit,
          status: product.status,
          revision: product.revision,
          estimatedProductionTime: product.estimatedProductionTime,
          commercialNotes: product.commercialNotes,
          technicalNotes: product.technicalNotes,
          components: product.components.map((component) => ({ ...component }))
        }
      : emptyProduct
  );

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

  function addComponent() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      components: [...currentDraft.components, emptyComponent()]
    }));
  }

  function removeComponent(componentId: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.filter((component) => component.id !== componentId)
    }));
  }

  function attachComponentFiles(componentId: string, event: ChangeEvent<HTMLInputElement>) {
    const fileNames = Array.from(event.target.files ?? []).map((file) => file.name);

    if (fileNames.length === 0) {
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      components: currentDraft.components.map((component) =>
        component.id === componentId
          ? { ...component, technicalFiles: [...component.technicalFiles, ...fileNames] }
          : component
      )
    }));

    event.target.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(draft, product);
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
                <span>Precio base</span>
                <input
                  min="0"
                  type="number"
                  value={draft.basePrice}
                  onChange={(event) => updateField("basePrice", Number(event.target.value))}
                />
              </label>

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

              <label className="field">
                <span>Revisión</span>
                <input value={draft.revision} onChange={(event) => updateField("revision", event.target.value)} />
              </label>

              <label className="field">
                <span>Tiempo estimado</span>
                <input
                  value={draft.estimatedProductionTime}
                  onChange={(event) => updateField("estimatedProductionTime", event.target.value)}
                />
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
              {draft.components.map((component, index) => (
                <article className="component-editor-card" key={component.id}>
                  <div className="component-card-header">
                    <strong>Componente {index + 1}</strong>
                    <button
                      className="icon-button ghost"
                      onClick={() => removeComponent(component.id)}
                      type="button"
                      aria-label="Eliminar componente"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

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
                        onChange={(event) =>
                          updateComponent(component.id, "process", event.target.value as ProductComponentProcess)
                        }
                      >
                        {Object.entries(componentProcessLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Estado</span>
                      <select
                        value={component.status}
                        onChange={(event) =>
                          updateComponent(component.id, "status", event.target.value as ProductComponentStatus)
                        }
                      >
                        {Object.entries(componentStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Medidas</span>
                      <input
                        value={component.dimensions}
                        onChange={(event) => updateComponent(component.id, "dimensions", event.target.value)}
                      />
                    </label>

                    <label className="field">
                      <span>Material</span>
                      <input value={component.material} onChange={(event) => updateComponent(component.id, "material", event.target.value)} />
                    </label>

                    <label className="field">
                      <span>Color</span>
                      <input value={component.color} onChange={(event) => updateComponent(component.id, "color", event.target.value)} />
                    </label>

                    <label className="field">
                      <span>Acabado</span>
                      <input value={component.finish} onChange={(event) => updateComponent(component.id, "finish", event.target.value)} />
                    </label>
                  </div>

                  <div className="supplier-block">
                    <h4>Proveedor / compra</h4>
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
                  </div>

                  <div className="form-grid two-columns">
                    <div className="field">
                      <span>Archivos técnicos</span>
                      <label className="secondary-button input-height-button file-button">
                        <FileUp size={16} />
                        Subir STL / STEP / PDF
                        <input
                          hidden
                          multiple
                          type="file"
                          accept=".stl,.step,.stp,.pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                          onChange={(event) => attachComponentFiles(component.id, event)}
                        />
                      </label>
                    </div>

                    <label className="field">
                      <span>Notas del componente</span>
                      <textarea value={component.notes} onChange={(event) => updateComponent(component.id, "notes", event.target.value)} />
                    </label>
                  </div>

                  {component.technicalFiles.length > 0 ? (
                    <div className="component-file-list">
                      {component.technicalFiles.map((fileName) => (
                        <span key={fileName}>{fileName}</span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}

              {draft.components.length === 0 ? <p className="empty-state">Sin componentes definidos.</p> : null}
            </div>
          </section>

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
