import { profiles, type Profile } from "../data/profiles";
import { ProfileCard } from "./ProfileCard";

type ProfileSelectorProps = {
  onSelect: (profile: Profile) => void;
};

export function ProfileSelector({ onSelect }: ProfileSelectorProps) {
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
    </main>
  );
}
