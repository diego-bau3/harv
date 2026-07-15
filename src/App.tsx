import { useState } from "react";
import { ProfileSelector } from "./components/ProfileSelector";
import { ProfileScreen } from "./components/ProfileScreen";
import type { Profile } from "./data/profiles";
import { productCatalog } from "./modules/sales/data";
import type { Product } from "./modules/sales/types";
import { createId } from "./modules/sales/utils";

type ProductDraft = Omit<Product, "id">;

export default function App() {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
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

  return <ProfileSelector products={products} onSaveProduct={saveProduct} onSelect={setSelectedProfile} />;
}
