import type { Priority, ProductUnit } from "../sales/types";

export type FabricationMachineType = "impresora-3d" | "otro";

export type FabricationConnectionType = "manual" | "mock-agent" | "bambu-lan";

export type FabricationMachineStatus =
  | "disponible"
  | "imprimiendo"
  | "pausada"
  | "error"
  | "mantenimiento"
  | "offline";

export type FabricationJobStatus = "pendiente" | "asignado" | "imprimiendo" | "terminado" | "bloqueado" | "cancelado";

export type FabricationMachine = {
  id: string;
  name: string;
  type: FabricationMachineType;
  brand: string;
  model: string;
  location: string;
  connectionType: FabricationConnectionType;
  agentMachineId: string;
  ipAddress: string;
  status: FabricationMachineStatus;
  loadedMaterial: string;
  supportedMaterials: string;
  nozzleSize: number;
  buildVolume: string;
  currentJobName: string;
  progress: number;
  nozzleTemp: number;
  bedTemp: number;
  remainingMinutes: number;
  lastSeenAt: string;
  notes: string;
};

export type FabricationMachineDraft = Omit<FabricationMachine, "id">;

export type FabricationJob = {
  id: string;
  createdAt: string;
  partName: string;
  productName: string;
  componentId: string;
  quantity: number;
  unit: ProductUnit;
  material: string;
  priority: Priority;
  requiredDate: string;
  estimatedHours: number;
  assignedMachineId: string;
  status: FabricationJobStatus;
  fileName: string;
  notes: string;
};

export type FabricationJobDraft = Omit<FabricationJob, "id" | "createdAt">;
