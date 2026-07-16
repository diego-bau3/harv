export type PreproductionProcessType =
  | "kitting"
  | "preparacion"
  | "ensamble"
  | "fabricacion"
  | "impresion-3d"
  | "inspeccion"
  | "prueba"
  | "empaque";

export type PreproductionRouteStatus = "borrador" | "en-revision" | "liberada";

export type PreproductionStepComponentUse = {
  id: string;
  componentId: string;
  componentName: string;
  quantity: number;
  unit: string;
};

export type PreproductionStepSubassemblyUse = {
  id: string;
  sourceStepId: string;
  outputName: string;
  quantity: number;
  unit: string;
};

export type PreproductionResource = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes: string;
};

export type PreproductionStep = {
  id: string;
  sequence: number;
  isKittingStep: boolean;
  name: string;
  processType: PreproductionProcessType;
  station: string;
  estimatedMinutes: number;
  outputName: string;
  outputQuantity: number;
  outputUnit: string;
  instructions: string;
  kittingComponents: PreproductionStepComponentUse[];
  componentUses: PreproductionStepComponentUse[];
  subassemblyUses: PreproductionStepSubassemblyUse[];
  tools: PreproductionResource[];
  consumables: PreproductionResource[];
};

export type PreproductionRoute = {
  id: string;
  productId: string;
  status: PreproductionRouteStatus;
  steps: PreproductionStep[];
  updatedAt: string;
};

export type PreproductionStepDraft = Omit<PreproductionStep, "id" | "sequence">;
