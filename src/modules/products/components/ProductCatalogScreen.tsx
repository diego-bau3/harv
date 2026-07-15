import { ArrowLeft, PackageSearch } from "lucide-react";
import type { Product } from "../../sales/types";
import { ProductCatalog } from "./ProductCatalog";

type ProductCatalogScreenProps = {
  products: Product[];
  onBack: () => void;
  onSaveProduct: (product: Omit<Product, "id">, existingProduct?: Product) => void;
};

export function ProductCatalogScreen({ products, onBack, onSaveProduct }: ProductCatalogScreenProps) {
  return (
    <main className="profile-screen product-profile-screen">
      <header className="screen-header">
        <button className="icon-button" onClick={onBack} type="button" aria-label="Regresar a perfiles">
          <ArrowLeft size={22} />
        </button>
        <div className="screen-title">
          <span className="screen-icon product-screen-icon" aria-hidden="true">
            <PackageSearch size={22} />
          </span>
          <h1>Productos</h1>
        </div>
      </header>

      <section className="product-profile-body">
        <ProductCatalog products={products} onSaveProduct={onSaveProduct} />
      </section>
    </main>
  );
}
