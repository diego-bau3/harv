import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product, ProductStatus } from "../types";
import { formatCurrency, productMatches, productStatusLabels } from "../utils";

type ProductModalProps = {
  products: Product[];
  onClose: () => void;
  onSelect: (product: Product) => void;
};

export function ProductModal({ products, onClose, onSelect }: ProductModalProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const [status, setStatus] = useState<ProductStatus | "todos">("activo");

  const categories = useMemo(() => {
    return ["todas", ...Array.from(new Set(products.map((product) => product.category)))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = category === "todas" || product.category === category;
      const matchesStatus = status === "todos" || product.status === status;
      return matchesCategory && matchesStatus && productMatches(product, query);
    });
  }, [category, products, query, status]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-shell product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <header className="modal-header">
          <h2 id="product-modal-title">Seleccionar producto</h2>
          <button className="icon-button ghost" onClick={onClose} type="button" aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </header>

        <div className="product-filters">
          <label className="search-field modal-search">
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por producto, SKU, categoría o descripción"
            />
          </label>

          <label className="field compact">
            <span>Categoría</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((productCategory) => (
                <option key={productCategory} value={productCategory}>
                  {productCategory === "todas" ? "Todas" : productCategory}
                </option>
              ))}
            </select>
          </label>

          <label className="field compact">
            <span>Estado</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as ProductStatus | "todos")}>
              <option value="activo">Activo</option>
              <option value="borrador">Borrador</option>
              <option value="revision">En revisión</option>
              <option value="inactivo">Inactivo</option>
              <option value="todos">Todos</option>
            </select>
          </label>
        </div>

        <div className="product-results">
          {filteredProducts.map((product) => (
            <article className="product-row" key={product.id}>
              <div className="product-main">
                <span className="sku">{product.sku}</span>
                <h3>{product.name}</h3>
                <p>{product.shortDescription}</p>
              </div>
              <div className="product-meta">
                <span>{product.category}</span>
                <span>{formatCurrency(product.basePrice)}</span>
                <span className={`status-pill ${product.status}`}>{productStatusLabels[product.status]}</span>
              </div>
              <button
                className="secondary-button"
                disabled={product.status !== "activo"}
                onClick={() => onSelect(product)}
                type="button"
              >
                Seleccionar
              </button>
            </article>
          ))}

          {filteredProducts.length === 0 ? <p className="empty-state">No hay productos con esos filtros.</p> : null}
        </div>
      </section>
    </div>
  );
}
