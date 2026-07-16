import { ArrowLeft } from "lucide-react";
import type { Profile } from "../data/profiles";
import { FabricationScreen } from "../modules/fabrication/components/FabricationScreen";
import { SalesView } from "../modules/sales/components/SalesView";
import type { Product } from "../modules/sales/types";
import { WarehouseScreen } from "../modules/warehouse/components/WarehouseScreen";

type ProfileScreenProps = {
  profile: Profile;
  products: Product[];
  onBack: () => void;
};

export function ProfileScreen({ profile, products, onBack }: ProfileScreenProps) {
  const Icon = profile.icon;

  if (profile.id === "ventas") {
    return <SalesView products={products} onBack={onBack} />;
  }

  if (profile.id === "almacen") {
    return <WarehouseScreen products={products} onBack={onBack} />;
  }

  if (profile.id === "fabricacion") {
    return <FabricationScreen products={products} onBack={onBack} />;
  }

  return (
    <main className="profile-screen">
      <header className="screen-header">
        <button className="icon-button" onClick={onBack} type="button" aria-label="Regresar a perfiles">
          <ArrowLeft size={22} />
        </button>
        <div className="screen-title">
          <span
            className="screen-icon"
            style={
              {
                "--accent": profile.accent,
                "--tint": profile.tint
              } as React.CSSProperties
            }
            aria-hidden="true"
          >
            <Icon size={22} />
          </span>
          <h1>{profile.name}</h1>
        </div>
      </header>
      <section className="blank-canvas" aria-label={`Pantalla de ${profile.name}`} />
    </main>
  );
}
