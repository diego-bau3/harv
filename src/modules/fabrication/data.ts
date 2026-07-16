import type { FabricationJob, FabricationMachine } from "./types";

export const initialFabricationMachines: FabricationMachine[] = [
  {
    id: "machine-bambu-p1s-01",
    name: "Bambu P1S 01",
    type: "impresora-3d",
    brand: "Bambu Lab",
    model: "P1S",
    location: "Celda 3D",
    connectionType: "mock-agent",
    agentMachineId: "bambu-p1s-01",
    ipAddress: "192.168.1.41",
    status: "disponible",
    loadedMaterial: "PETG",
    supportedMaterials: "PLA, PETG, ABS",
    nozzleSize: 0.4,
    buildVolume: "256 x 256 x 256 mm",
    currentJobName: "",
    progress: 0,
    nozzleTemp: 28,
    bedTemp: 31,
    remainingMinutes: 0,
    lastSeenAt: "",
    notes: ""
  },
  {
    id: "machine-bambu-x1c-01",
    name: "Bambu X1C 01",
    type: "impresora-3d",
    brand: "Bambu Lab",
    model: "X1 Carbon",
    location: "Celda 3D",
    connectionType: "mock-agent",
    agentMachineId: "bambu-x1c-01",
    ipAddress: "192.168.1.42",
    status: "imprimiendo",
    loadedMaterial: "PETG",
    supportedMaterials: "PLA, PETG, ABS, ASA",
    nozzleSize: 0.4,
    buildVolume: "256 x 256 x 256 mm",
    currentJobName: "Base de motor SO101",
    progress: 64,
    nozzleTemp: 245,
    bedTemp: 78,
    remainingMinutes: 52,
    lastSeenAt: "",
    notes: ""
  }
];

export const initialFabricationJobs: FabricationJob[] = [];
