import type { Product } from "../sales/types";
import { createSo101SampleRoute, so101SampleProductId } from "./data";
import type { PreproductionResource, PreproductionRoute } from "./types";
import { normalizeStepSequence, nowIso, preproductionId } from "./utils";

export const preproductionRoutesStorageKey = "harv:preproduction-routes:v1";

export function getDefaultPreproductionProductId(products: Product[]) {
  return products.find((product) => product.id === so101SampleProductId || product.sku === "SO101")?.id ?? products[0]?.id ?? "";
}

function normalizeResources(resources: unknown): PreproductionResource[] {
  if (!Array.isArray(resources)) {
    return [];
  }

  return resources.map((resource) => {
    const currentResource = resource as Partial<PreproductionResource>;

    return {
      id: currentResource.id ?? preproductionId("pre-resource"),
      supplyId: currentResource.supplyId ?? "",
      name: currentResource.name ?? "",
      quantity: Number(currentResource.quantity ?? 1),
      unit: currentResource.unit ?? "pieza",
      notes: currentResource.notes ?? ""
    };
  });
}

export function normalizePreproductionRoute(route: Partial<PreproductionRoute>, productId: string): PreproductionRoute {
  const steps = Array.isArray(route.steps) ? route.steps : [];

  return {
    id: route.id ?? preproductionId("pre-route"),
    productId: route.productId ?? productId,
    status: route.status ?? "borrador",
    steps: normalizeStepSequence(
      steps.map((step, index) => ({
        id: step.id ?? preproductionId("pre-step"),
        sequence: step.sequence ?? index + 1,
        isKittingStep: step.isKittingStep ?? false,
        name: step.name ?? "",
        processType: step.processType ?? "ensamble",
        station: step.station ?? "",
        estimatedMinutes: Number(step.estimatedMinutes ?? 1),
        outputName: step.outputName ?? "",
        outputQuantity: Number(step.outputQuantity ?? (step.outputName ? 1 : 0)),
        outputUnit: step.outputUnit ?? "subensamble",
        instructions: step.instructions ?? "",
        kittingComponents: Array.isArray(step.kittingComponents) ? step.kittingComponents : [],
        componentUses: Array.isArray(step.componentUses) ? step.componentUses : [],
        subassemblyUses: Array.isArray(step.subassemblyUses) ? step.subassemblyUses : [],
        tools: normalizeResources(step.tools),
        consumables: normalizeResources(step.consumables)
      }))
    ),
    updatedAt: route.updatedAt ?? nowIso()
  };
}

function isStarterRoute(route: PreproductionRoute) {
  return route.steps.length <= 1 && route.steps.every((step) => step.isKittingStep);
}

export function createSeedPreproductionRoutes(products: Product[]) {
  return products
    .map((product) => createSo101SampleRoute(product))
    .filter((route): route is PreproductionRoute => Boolean(route));
}

export function mergeSeedPreproductionRoutes(storedRoutes: PreproductionRoute[], products: Product[]) {
  const seedRoutes = createSeedPreproductionRoutes(products);
  const nextRoutes = [...storedRoutes];

  seedRoutes.forEach((seedRoute) => {
    const existingRouteIndex = nextRoutes.findIndex((route) => route.productId === seedRoute.productId);

    if (existingRouteIndex < 0) {
      nextRoutes.push(seedRoute);
      return;
    }

    if (isStarterRoute(nextRoutes[existingRouteIndex])) {
      nextRoutes[existingRouteIndex] = seedRoute;
    }
  });

  return nextRoutes;
}

export function loadStoredPreproductionRoutes(products: Product[]) {
  try {
    const storedRoutes = window.localStorage.getItem(preproductionRoutesStorageKey);

    if (!storedRoutes) {
      return createSeedPreproductionRoutes(products);
    }

    const parsedRoutes = JSON.parse(storedRoutes);
    const normalizedRoutes = Array.isArray(parsedRoutes)
      ? parsedRoutes.map((route) => normalizePreproductionRoute(route, getDefaultPreproductionProductId(products)))
      : [];

    return mergeSeedPreproductionRoutes(normalizedRoutes, products);
  } catch {
    return createSeedPreproductionRoutes(products);
  }
}

export function saveStoredPreproductionRoutes(routes: PreproductionRoute[]) {
  try {
    window.localStorage.setItem(preproductionRoutesStorageKey, JSON.stringify(routes));
  } catch {
    return;
  }
}
