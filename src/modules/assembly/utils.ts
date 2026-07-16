import type { PreproductionRoute, PreproductionStep } from "../preproduction/types";
import type { ProductionGeneratedPlan, ProductionPlanBlock } from "../production/types";
import {
  createDefaultShiftSettings,
  createSo101SamplePendingQueue,
  createSo101SamplePlanningContext,
  generateProductionPlan,
  loadProductionPlanningContext,
  productionLatestPlanStorageKey,
  productionId
} from "../production/utils";
import type { Product } from "../sales/types";
import { createId } from "../sales/utils";
import type {
  AssemblyInstructionVisual,
  AssemblyPlanSource,
  AssemblyProblem,
  AssemblyProblemType,
  AssemblyStation,
  AssemblyStationStatus,
  AssemblyStep
} from "./types";

export const assemblyStationStatusLabels: Record<AssemblyStationStatus, string> = {
  bloqueada: "Bloqueada",
  ensamblando: "Ensamblando",
  libre: "Libre",
  preparando: "Preparando",
  terminada: "Terminada"
};

export const assemblyProblemTypeLabels: Record<AssemblyProblemType, string> = {
  calidad: "Calidad",
  "falta-pieza": "Falta pieza",
  herramienta: "Herramienta",
  instruccion: "Instrucción",
  otro: "Otro",
  "pieza-danada": "Pieza dañada"
};

export const assemblyStationsStorageKey = "harv:assembly-stations:v1";
export const assemblyProblemsStorageKey = "harv:assembly-problems:v1";

function nowIso() {
  return new Date().toISOString();
}

export function loadStoredAssemblyStations() {
  return loadStoredList<AssemblyStation>(assemblyStationsStorageKey, []);
}

export function saveStoredAssemblyStations(stations: AssemblyStation[]) {
  saveStoredList(assemblyStationsStorageKey, stations);
}

export function loadStoredAssemblyProblems() {
  return loadStoredList<AssemblyProblem>(assemblyProblemsStorageKey, []);
}

export function saveStoredAssemblyProblems(problems: AssemblyProblem[]) {
  saveStoredList(assemblyProblemsStorageKey, problems);
}

export function loadLatestProductionPlanForAssembly(products: Product[]): {
  plan: ProductionGeneratedPlan;
  source: AssemblyPlanSource;
} {
  const storedPlan = loadStoredLatestProductionPlan();

  if (storedPlan) {
    return {
      plan: storedPlan,
      source: {
        label: storedPlan.sourceLabel,
        generatedAt: storedPlan.generatedAt,
        isFallback: false
      }
    };
  }

  const settings = createDefaultShiftSettings();
  const baseContext = loadProductionPlanningContext();
  const context = createSo101SamplePlanningContext(products, baseContext);
  const queue = createSo101SamplePendingQueue(products, settings.planDate);
  const plan = generateProductionPlan(queue.orders, products, settings, context, queue.sourceLabel);

  return {
    plan,
    source: {
      label: "Sample SO101 x10",
      generatedAt: plan.generatedAt,
      isFallback: true
    }
  };
}

export function createAssemblyStationsFromPlan(plan: ProductionGeneratedPlan, products: Product[]): AssemblyStation[] {
  const context = loadProductionPlanningContext();
  const sampleContext = createSo101SamplePlanningContext(products, context);
  const assemblyBlocks = plan.scheduledBlocks.filter((block) => block.type === "ensamble");

  return assemblyBlocks.flatMap((block) => {
    const stationCount = Math.max(plan.settings.assemblyStations, 1);
    const quantities = splitQuantity(block.quantity, stationCount);
    const product = products.find((currentProduct) => currentProduct.sku === block.productSku);
    const route = findRouteForProduct(sampleContext.routes, product?.id ?? "");
    const steps = createAssemblySteps(block, route, product);

    return quantities
      .map((quantity, index): AssemblyStation | null => {
        if (quantity <= 0) {
          return null;
        }

        return {
          id: `assembly-station-${block.id}-${index + 1}`,
          name: `Estación ${index + 1}`,
          operatorName: `Operador ${index + 1}`,
          status: "preparando",
          sourceOrder: block.sourceOrders.join(", "),
          productSku: block.productSku,
          productName: block.productName,
          assignedQuantity: quantity,
          completedQuantity: 0,
          currentUnit: 1,
          currentStepIndex: 0,
          steps,
          planBlockId: block.id,
          planStartTime: block.startTime,
          planEndTime: block.endTime,
          lastUpdatedAt: nowIso(),
          problemNotes: ""
        };
      })
      .filter((station): station is AssemblyStation => Boolean(station));
  });
}

export function createAssemblyProblem(
  station: AssemblyStation,
  type: AssemblyProblemType,
  notes: string
): AssemblyProblem {
  const currentStep = station.steps[station.currentStepIndex];

  return {
    id: createId("assembly-problem"),
    stationId: station.id,
    stationName: station.name,
    sourceOrder: station.sourceOrder,
    productSku: station.productSku,
    stepTitle: currentStep?.title ?? "Sin paso activo",
    type,
    notes: notes.trim(),
    status: "abierto",
    createdAt: nowIso()
  };
}

export function stationProgress(station: AssemblyStation) {
  if (station.assignedQuantity <= 0) {
    return 0;
  }

  return Math.min(Math.round((station.completedQuantity / station.assignedQuantity) * 100), 100);
}

export function currentAssemblyStep(station: AssemblyStation) {
  return station.steps[station.currentStepIndex] ?? station.steps[0];
}

function createAssemblySteps(
  block: ProductionPlanBlock,
  route: PreproductionRoute | undefined,
  product: Product | undefined
): AssemblyStep[] {
  const routeSteps = route?.steps.filter((step) => step.processType === "ensamble" || step.processType === "preparacion") ?? [];

  if (routeSteps.length > 0) {
    return routeSteps.map((step, index) => createStepFromRoute(step, index, product));
  }

  return [
    {
      id: `${block.id}-base`,
      sequence: 1,
      title: "Base + tornillería",
      station: "Ensamble",
      targetMinutes: 2,
      visual: "base",
      components: ["1 base impresa", "4 tornillos M3x12"],
      tools: ["Llave Allen 2.5 mm"],
      consumables: ["Loctite opcional"],
      instructions: ["Coloca la base sobre la mesa.", "Alinea los barrenos.", "Fija con tornillos sin aplicar torque final."]
    },
    {
      id: `${block.id}-motor`,
      sequence: 2,
      title: "Motor en base",
      station: "Ensamble",
      targetMinutes: 3,
      visual: "motor",
      components: ["1 motor servo", "1 base preparada", "2 tornillos M3x12"],
      tools: ["Llave Allen 2.5 mm", "Torquímetro"],
      consumables: [],
      instructions: ["Inserta el motor en la base.", "Revisa orientación del cable.", "Aprieta los tornillos al torque indicado."]
    },
    {
      id: `${block.id}-gripper`,
      sequence: 3,
      title: "Gripper y cierre",
      station: "Ensamble",
      targetMinutes: 3,
      visual: "gripper",
      components: ["Palma de gripper", "Dedo izquierdo", "Dedo derecho", "Separadores"],
      tools: ["Llave Allen 2 mm"],
      consumables: [],
      instructions: ["Monta palma central.", "Instala dedos y separadores.", "Verifica apertura y cierre libre."]
    }
  ];
}

function createStepFromRoute(step: PreproductionStep, index: number, product: Product | undefined): AssemblyStep {
  return {
    id: step.id,
    sequence: index + 1,
    title: step.name,
    station: step.station || "Ensamble",
    targetMinutes: Number(step.estimatedMinutes || 1),
    visual: inferVisual(step.name),
    components: step.componentUses.length > 0 ? step.componentUses.map((component) => component.componentName) : inferComponents(step, product),
    tools: step.tools.length > 0 ? step.tools.map((tool) => `${tool.quantity} ${tool.unit} · ${tool.name}`) : inferTools(step.name),
    consumables: step.consumables.map((consumable) => `${consumable.quantity} ${consumable.unit} · ${consumable.name}`),
    instructions: step.instructions
      ? step.instructions.split("\n").filter(Boolean)
      : [`Completar ${step.name.toLowerCase()} siguiendo estándar visual.`]
  };
}

function inferVisual(stepName: string): AssemblyInstructionVisual {
  const normalizedName = stepName.toLowerCase();

  if (normalizedName.includes("motor")) {
    return "motor";
  }

  if (normalizedName.includes("gripper")) {
    return "gripper";
  }

  if (normalizedName.includes("calidad") || normalizedName.includes("inspeccion")) {
    return "calidad";
  }

  return "base";
}

function inferComponents(step: PreproductionStep, product: Product | undefined) {
  const normalizedName = step.name.toLowerCase();

  if (normalizedName.includes("motor")) {
    return product?.components.filter((component) => component.type === "motor").map((component) => component.name) ?? ["Motor"];
  }

  if (normalizedName.includes("gripper")) {
    return product?.components.filter((component) => component.name.toLowerCase().includes("gripper")).map((component) => component.name) ?? [
      "Gripper"
    ];
  }

  return product?.components.slice(0, 3).map((component) => component.name) ?? ["Componentes del kit"];
}

function inferTools(stepName: string) {
  const normalizedName = stepName.toLowerCase();

  if (normalizedName.includes("motor")) {
    return ["Llave Allen 2.5 mm", "Torquímetro"];
  }

  return ["Llave Allen"];
}

function findRouteForProduct(routes: PreproductionRoute[], productId: string) {
  const routesForProduct = routes.filter((route) => route.productId === productId && route.steps.length > 0);

  return routesForProduct.find((route) => route.status === "liberada") ?? routesForProduct[0];
}

function splitQuantity(quantity: number, stationCount: number) {
  const normalizedStationCount = Math.max(stationCount, 1);
  const baseQuantity = Math.floor(quantity / normalizedStationCount);
  const remainder = quantity % normalizedStationCount;

  return Array.from({ length: normalizedStationCount }, (_, index) => baseQuantity + (index < remainder ? 1 : 0));
}

function loadStoredLatestProductionPlan() {
  return loadStoredValue<ProductionGeneratedPlan | null>(productionLatestPlanStorageKey, null);
}

function loadStoredList<Item>(key: string, fallback: Item[]): Item[] {
  const value = loadStoredValue<Item[]>(key, fallback);

  return Array.isArray(value) ? value : fallback;
}

function loadStoredValue<Item>(key: string, fallback: Item): Item {
  try {
    const storedValue = window.localStorage.getItem(key);

    if (!storedValue) {
      return fallback;
    }

    return JSON.parse(storedValue) as Item;
  } catch {
    return fallback;
  }
}

function saveStoredList<Item>(key: string, value: Item[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}
