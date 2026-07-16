import { ArrowRight } from "lucide-react";
import type { Profile } from "../data/profiles";

type ProfileCardProps = {
  profile: Profile;
  onSelect: (profile: Profile) => void;
};

const statusLabels: Record<Profile["status"], string> = {
  "en-proceso": "En proceso",
  "sin-iniciar": "Sin iniciar",
  terminado: "Terminado"
};

export function ProfileCard({ profile, onSelect }: ProfileCardProps) {
  const Icon = profile.icon;
  const statusLabel = statusLabels[profile.status];

  return (
    <button
      className="profile-card"
      onClick={() => onSelect(profile)}
      style={
        {
          "--accent": profile.accent,
          "--tint": profile.tint
        } as React.CSSProperties
      }
      type="button"
    >
      <span
        className={`profile-state-dot profile-state-dot-${profile.status}`}
        title={statusLabel}
        aria-hidden="true"
      />
      <span className="profile-icon" aria-hidden="true">
        <Icon size={24} strokeWidth={2.1} />
      </span>
      <span className="profile-copy">
        <span className="profile-name">{profile.name}</span>
        {profile.note ? <span className="profile-note">{profile.note}</span> : null}
      </span>
      <span className="profile-action" aria-hidden="true">
        <ArrowRight size={18} />
      </span>
    </button>
  );
}
