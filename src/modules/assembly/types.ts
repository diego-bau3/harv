export type AssemblyStationStatus = "libre" | "preparando" | "ensamblando" | "bloqueada" | "terminada";

export type AssemblyProblemType =
  | "falta-pieza"
  | "pieza-danada"
  | "herramienta"
  | "instruccion"
  | "calidad"
  | "otro";

export type AssemblyInstructionVisual = "base" | "motor" | "gripper" | "calidad";

export type AssemblyStep = {
  id: string;
  sequence: number;
  title: string;
  station: string;
  targetMinutes: number;
  visual: AssemblyInstructionVisual;
  components: string[];
  tools: string[];
  consumables: string[];
  instructions: string[];
};

export type AssemblyStation = {
  id: string;
  name: string;
  operatorName: string;
  status: AssemblyStationStatus;
  sourceOrder: string;
  productSku: string;
  productName: string;
  assignedQuantity: number;
  completedQuantity: number;
  currentUnit: number;
  currentStepIndex: number;
  steps: AssemblyStep[];
  planBlockId: string;
  planStartTime: string;
  planEndTime: string;
  lastUpdatedAt: string;
  problemNotes: string;
};

export type AssemblyProblem = {
  id: string;
  stationId: string;
  stationName: string;
  sourceOrder: string;
  productSku: string;
  stepTitle: string;
  type: AssemblyProblemType;
  notes: string;
  status: "abierto" | "resuelto";
  createdAt: string;
};

export type AssemblyPlanSource = {
  label: string;
  generatedAt: string;
  isFallback: boolean;
};
