import { profiles, type Profile } from "../data/profiles";
import { ProductCatalog } from "../modules/products/components/ProductCatalog";
import type { Product } from "../modules/sales/types";
import { ProfileCard } from "./ProfileCard";

type ProfileSelectorProps = {
  products: Product[];
  onSaveProduct: (product: Omit<Product, "id">, existingProduct?: Product) => void;
  onSelect: (profile: Profile) => void;
};

export function ProfileSelector({ products, onSaveProduct, onSelect }: ProfileSelectorProps) {
  return (
    <main className="profile-selector">
      <section className="selector-header" aria-labelledby="app-title">
        <p className="brand-mark">Harv</p>
        <h1 id="app-title">Perfiles</h1>
      </section>

      <section className="profile-grid" aria-label="Perfiles de Harv">
        {profiles.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} onSelect={onSelect} />
        ))}
      </section>

      <ProductCatalog products={products} onSaveProduct={onSaveProduct} />
    </main>
  );
}
