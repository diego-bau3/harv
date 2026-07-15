import { Edit3, PackagePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "../../sales/types";
import { componentTypeLabels, formatCurrency, productMatches, productStatusLabels } from "../../sales/utils";
import { ProductEditorModal } from "./ProductEditorModal";

type ProductDraft = Omit<Product, "id">;

type ProductCatalogProps = {
  products: Product[];
  onSaveProduct: (product: ProductDraft, existingProduct?: Product) => void;
};

export function ProductCatalog({ products, onSaveProduct }: ProductCatalogProps) {
  const [query, setQuery] = useState("");
  const [productEditorModal, setProductEditorModal] = useState<{ product?: Product } | null>(null);

  const productResults = useMemo(() => {
    return products.filter((product) => productMatches(product, query));
  }, [products, query]);

  return (
    <section className="main-panel products-panel">
      <div className="clean-section-heading">
        <div>
          <h2>Lista de productos</h2>
          <p>Define productos, piezas, tornillería, motores, cableado y archivos técnicos.</p>
        </div>
        <button className="primary-button" onClick={() => setProductEditorModal({})} type="button">
          <PackagePlus size={17} />
          Agregar producto
        </button>
      </div>

      <label className="search-field client-search">
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, SKU, componente o proveedor" />
      </label>

      <div className="product-catalog-list">
        {productResults.map((product) => (
          <article className="product-catalog-row" key={product.id}>
            <div className="product-catalog-main">
              <span className="sku">{product.sku || "Sin SKU"}</span>
              <div>
                <strong>{product.name || "Producto sin nombre"}</strong>
                <p>{product.shortDescription || "Sin descripción"}</p>
              </div>
            </div>

            <div className="product-catalog-stat">
              <span>Componentes</span>
              <strong>{product.components.length}</strong>
            </div>

            <div className="product-catalog-stat">
              <span>Precio</span>
              <strong>{formatCurrency(product.basePrice)}</strong>
            </div>

            <span className={`status-pill ${product.status}`}>{productStatusLabels[product.status]}</span>

            <div className="product-component-preview">
              {product.components.slice(0, 4).map((component) => (
                <span key={component.id}>{componentTypeLabels[component.type]}</span>
              ))}
              {product.components.length > 4 ? <span>+{product.components.length - 4}</span> : null}
            </div>

            <div className="client-actions">
              <button className="secondary-button compact-button" onClick={() => setProductEditorModal({ product })} type="button">
                <Edit3 size={15} />
                Editar
              </button>
            </div>
          </article>
        ))}

        {products.length === 0 ? <p className="empty-state">Todavía no hay productos registrados.</p> : null}
        {products.length > 0 && productResults.length === 0 ? <p className="empty-state">No hay productos con esa búsqueda.</p> : null}
      </div>

      {productEditorModal ? (
        <ProductEditorModal
          product={productEditorModal.product}
          onClose={() => setProductEditorModal(null)}
          onSave={(product, existingProduct) => {
            onSaveProduct(product, existingProduct);
            setProductEditorModal(null);
            setQuery("");
          }}
        />
      ) : null}
    </section>
  );
}
