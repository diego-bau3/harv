import type { Priority } from "../sales/types";
import type {
  FabricationConnectionType,
  FabricationJob,
  FabricationJobStatus,
  FabricationMachine,
  FabricationMachineStatus,
  FabricationMachineType
} from "./types";

export const fabricationMachineTypeLabels: Record<FabricationMachineType, string> = {
  "impresora-3d": "Impresora 3D",
  otro: "Otro"
};

export const fabricationConnectionLabels: Record<FabricationConnectionType, string> = {
  manual: "Manual",
  "mock-agent": "Harv Agent mock",
  "bambu-lan": "Bambu LAN"
};

export const fabricationControlModeLabels: Record<FabricationConnectionType, string> = {
  manual: "Manual",
  "mock-agent": "Automatico",
  "bambu-lan": "Automatico"
};

export const fabricationMachineStatusLabels: Record<FabricationMachineStatus, string> = {
  disponible: "Disponible",
  imprimiendo: "Imprimiendo",
  pausada: "Pausada",
  error: "Error",
  mantenimiento: "Mantenimiento",
  offline: "Offline"
};

export const fabricationJobStatusLabels: Record<FabricationJobStatus, string> = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  imprimiendo: "Imprimiendo",
  terminado: "Terminado",
  bloqueado: "Bloqueado",
  cancelado: "Cancelado"
};

export const fabricationPriorityLabels: Record<Priority, string> = {
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
  critica: "Critica"
};

export function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function splitMaterials(value: string) {
  return value
    .split(",")
    .map((material) => material.trim().toLowerCase())
    .filter(Boolean);
}

export function machineSupportsMaterial(machine: FabricationMachine, material: string) {
  const normalizedMaterial = material.trim().toLowerCase();

  if (!normalizedMaterial) {
    return true;
  }

  const supportedMaterials = splitMaterials(machine.supportedMaterials);
  const loadedMaterial = machine.loadedMaterial.trim().toLowerCase();

  return supportedMaterials.includes(normalizedMaterial) || loadedMaterial === normalizedMaterial;
}

export function getMachineLabel(machineId: string, machines: FabricationMachine[]) {
  return machines.find((machine) => machine.id === machineId)?.name ?? "Sin maquina";
}

export function isManualMachine(machine: Pick<FabricationMachine, "connectionType">) {
  return machine.connectionType === "manual";
}

export function getConnectionSignal(machine: Pick<FabricationMachine, "connectionType" | "status" | "agentMachineId">) {
  if (machine.connectionType === "manual") {
    return "Manual";
  }

  if (machine.connectionType === "mock-agent") {
    return "Con agente";
  }

  if (!machine.agentMachineId) {
    return "Sin agente";
  }

  if (machine.status === "offline") {
    return "Offline";
  }

  return "Conectada";
}

export function recommendMachine(
  job: Pick<FabricationJob, "material" | "priority">,
  machines: FabricationMachine[]
) {
  const statusScore: Record<FabricationMachineStatus, number> = {
    disponible: 0,
    pausada: 1,
    imprimiendo: 2,
    mantenimiento: 4,
    error: 5,
    offline: 6
  };

  return machines
    .filter((machine) => machine.type === "impresora-3d")
    .filter((machine) => machineSupportsMaterial(machine, job.material))
    .sort((firstMachine, secondMachine) => {
      const scoreDiff = statusScore[firstMachine.status] - statusScore[secondMachine.status];

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return firstMachine.progress - secondMachine.progress;
    })[0];
}

export function calculateFabricationStats(machines: FabricationMachine[], jobs: FabricationJob[]) {
  return {
    machines: machines.length,
    available: machines.filter((machine) => machine.status === "disponible").length,
    printing: machines.filter((machine) => machine.status === "imprimiendo").length,
    pendingJobs: jobs.filter((job) => job.status === "pendiente" || job.status === "asignado").length
  };
}

export function machineMatches(machine: FabricationMachine, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    machine.name,
    machine.brand,
    machine.model,
    machine.location,
    machine.loadedMaterial,
    machine.supportedMaterials,
    machine.ipAddress,
    machine.agentMachineId
  ].some((field) => field.toLowerCase().includes(normalizedQuery));
}

export function jobMatches(job: FabricationJob, query: string, machines: FabricationMachine[]) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    job.partName,
    job.productName,
    job.material,
    job.fileName,
    job.notes,
    getMachineLabel(job.assignedMachineId, machines)
  ].some((field) => field.toLowerCase().includes(normalizedQuery));
}

export function formatMinutes(value: number) {
  if (!value || value <= 0) {
    return "0 min";
  }

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes} min`;
}
