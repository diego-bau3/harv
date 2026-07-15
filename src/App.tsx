import { useState } from "react";
import { ProfileSelector } from "./components/ProfileSelector";
import { ProfileScreen } from "./components/ProfileScreen";
import type { Profile } from "./data/profiles";

export default function App() {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  if (selectedProfile) {
    return <ProfileScreen profile={selectedProfile} onBack={() => setSelectedProfile(null)} />;
  }

  return <ProfileSelector onSelect={setSelectedProfile} />;
}
