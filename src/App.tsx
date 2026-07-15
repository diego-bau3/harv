import { useState } from "react";
import { ProfileSelector } from "./components/ProfileSelector";
import { ProfileScreen } from "./components/ProfileScreen";
import type { Profile } from "./data/profiles";
import { ProductCatalogScreen } from "./modules/products/components/ProductCatalogScreen";
import { productCatalog } from "./modules/sales/data";
import type { Product } from "./modules/sales/types";
import { createId } from "./modules/sales/utils";

type ProductDraft = Omit<Product, "id">;

export default function App() {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isProductCatalogOpen, setProductCatalogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(() => productCatalog);

  function saveProduct(draft: ProductDraft, existingProduct?: Product) {
    const savedProduct: Product = {
      ...draft,
      id: existingProduct?.id ?? createId("product")
    };

    setProducts((currentProducts) => {
      if (existingProduct) {
        return currentProducts.map((product) => (product.id === existingProduct.id ? savedProduct : product));
      }

      return [savedProduct, ...currentProducts];
    });
  }

  if (selectedProfile) {
    return <ProfileScreen profile={selectedProfile} products={products} onBack={() => setSelectedProfile(null)} />;
  }

  if (isProductCatalogOpen) {
    return (
      <ProductCatalogScreen
        products={products}
        onBack={() => setProductCatalogOpen(false)}
        onSaveProduct={saveProduct}
      />
    );
  }

  return <ProfileSelector onOpenProducts={() => setProductCatalogOpen(true)} onSelect={setSelectedProfile} />;
}
