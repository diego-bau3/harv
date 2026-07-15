import { ArrowLeft } from "lucide-react";
import type { Profile } from "../data/profiles";
import { SalesView } from "../modules/sales/components/SalesView";

type ProfileScreenProps = {
  profile: Profile;
  onBack: () => void;
};

export function ProfileScreen({ profile, onBack }: ProfileScreenProps) {
  const Icon = profile.icon;

  if (profile.id === "ventas") {
    return <SalesView onBack={onBack} />;
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
