import type { Priority } from "../sales/types";
import type { PreproductionRoute } from "../preproduction/types";
import type { WarehouseEntry } from "../warehouse/types";

export type ProductionPlanStrategy =
  | "optimizar-turno"
  | "fecha-prioridad"
  | "agrupar-producto"
  | "agrupar-recoleccion";

export type ProductionBlockType = "recoleccion" | "ensamble" | "calidad";

export type ProductionPendingOrderStatus = "lista" | "riesgo" | "bloqueada";

export type ProductionIssueSeverity = "aviso" | "riesgo" | "bloqueo";

export type ProductionPickupGroupStatus = "lista" | "faltante";

export type ProductionRecommendationType = "eficiencia" | "capacidad" | "riesgo" | "siguiente-turno";

export type ProductionShiftSettings = {
  planDate: string;
  shiftStart: string;
  shiftEnd: string;
  peopleAvailable: number;
  assemblyStations: number;
  qualityStations: number;
  strategy: ProductionPlanStrategy;
};

export type ProductionPendingOrder = {
  id: string;
  sourceType: "ventas" | "demo" | "sample";
  sourceOrder: string;
  clientName: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  dueDate: string;
  priority: Priority;
  status: ProductionPendingOrderStatus;
  notes: string;
};

export type ProductionPendingQueue = {
  source: "ventas" | "demo" | "sample";
  sourceLabel: string;
  orders: ProductionPendingOrder[];
};

export type ProductionPlanningContext = {
  routes: PreproductionRoute[];
  warehouseEntries: WarehouseEntry[];
};

export type ProductionPlanBlock = {
  id: string;
  type: ProductionBlockType;
  title: string;
  startTime: string;
  endTime: string;
  estimatedMinutes: number;
  owner: string;
  productSku: string;
  productName: string;
  quantity: number;
  sourceOrders: string[];
  reason: string;
  details: string[];
};

export type ProductionPlanIssue = {
  id: string;
  severity: ProductionIssueSeverity;
  title: string;
  detail: string;
  sourceOrder: string;
};

export type ProductionPickupGroup = {
  id: string;
  locationId: string;
  locationLabel: string;
  status: ProductionPickupGroupStatus;
  itemCount: number;
  sourceOrders: string[];
  details: string[];
};

export type ProductionRecommendation = {
  id: string;
  type: ProductionRecommendationType;
  title: string;
  detail: string;
};

export type ProductionOptimizationSummary = {
  capacityMinutes: number;
  utilizationPercent: number;
  savedPickupMinutes: number;
  groupedPickupCount: number;
  blockedIssueCount: number;
  nextShiftDate: string;
};

export type ProductionGeneratedPlan = {
  id: string;
  generatedAt: string;
  settings: ProductionShiftSettings;
  sourceLabel: string;
  pendingOrders: ProductionPendingOrder[];
  scheduledBlocks: ProductionPlanBlock[];
  overflowOrders: ProductionPendingOrder[];
  pickupGroups: ProductionPickupGroup[];
  nextShiftBlocks: ProductionPlanBlock[];
  recommendations: ProductionRecommendation[];
  optimization: ProductionOptimizationSummary;
  issues: ProductionPlanIssue[];
  totalUnits: number;
  scheduledUnits: number;
  scheduledMinutes: number;
};

export type ProductionPlannerSummary = {
  pendingOrders: number;
  totalUnits: number;
  dueToday: number;
  atRisk: number;
  estimatedMinutes: number;
};
