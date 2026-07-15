import { PackageSearch } from "lucide-react";
import { profiles, type Profile } from "../data/profiles";
import { ProfileCard } from "./ProfileCard";

type ProfileSelectorProps = {
  onOpenProducts: () => void;
  onSelect: (profile: Profile) => void;
};

const productProfile: Profile = {
  id: "productos",
  name: "Productos",
  note: "Catálogo técnico",
  icon: PackageSearch,
  accent: "#8f4a31",
  tint: "#fff0e5"
};

export function ProfileSelector({ onOpenProducts, onSelect }: ProfileSelectorProps) {
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
        <ProfileCard profile={productProfile} onSelect={onOpenProducts} />
      </section>
    </main>
  );
}
