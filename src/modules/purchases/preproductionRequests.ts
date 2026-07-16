import type { PreproductionResource, PreproductionRoute } from "../preproduction/types";
import type { Product, ProductUnit } from "../sales/types";
import type { PlantSupply } from "../supplies/types";
import { findPlantSupplyForResource, normalizeSupplyLookup } from "../supplies/utils";
import type { PurchaseRequest } from "./types";
import { futureDate } from "./utils";

const purchaseUnits = new Set<ProductUnit>([
  "pieza",
  "metro",
  "kg",
  "g",
  "ml",
  "litro",
  "set",
  "paquete",
  "rollo",
  "formato"
]);

type AggregatedSupplyNeed = {
  sourceRef: string;
  product: Product;
  supply: PlantSupply | undefined;
  resource: PreproductionResource;
  quantity: number;
  unit: ProductUnit;
  stepNames: Set<string>;
  originalUnits: Set<string>;
};

function requestSafeKey(value: string) {
  return normalizeSupplyLookup(value).replace(/\s+/g, "-") || "insumo";
}

function purchaseUnitForResource(resource: PreproductionResource, supply: PlantSupply | undefined): ProductUnit {
  if (supply) {
    return supply.unit;
  }

  return purchaseUnits.has(resource.unit as ProductUnit) ? (resource.unit as ProductUnit) : "pieza";
}

function normalizeResourceQuantity(resource: PreproductionResource, unit: ProductUnit) {
  const resourceUnit = normalizeSupplyLookup(resource.unit);

  if (unit === "ml" && (resourceUnit === "gota" || resourceUnit === "gotas")) {
    return Number(resource.quantity || 0) * 0.05;
  }

  return Number(resource.quantity || 0);
}

function aggregateRouteSupplyNeeds(products: Product[], routes: PreproductionRoute[], supplies: PlantSupply[]) {
  const needsBySourceRef = new Map<string, AggregatedSupplyNeed>();

  routes
    .filter((route) => route.status === "liberada")
    .forEach((route) => {
      const product = products.find((currentProduct) => currentProduct.id === route.productId);

      if (!product) {
        return;
      }

      route.steps.forEach((step) => {
        step.consumables.forEach((resource) => {
          const supply = findPlantSupplyForResource(supplies, resource.supplyId, resource.name);
          const supplyKey = supply?.id ?? `manual-${requestSafeKey(resource.name)}`;
          const sourceRef = `preproduction:${route.productId}:${supplyKey}`;
          const unit = purchaseUnitForResource(resource, supply);
          const quantity = normalizeResourceQuantity(resource, unit);
          const currentNeed = needsBySourceRef.get(sourceRef);

          if (currentNeed) {
            currentNeed.quantity += quantity;
            currentNeed.stepNames.add(step.name);
            currentNeed.originalUnits.add(resource.unit);
            return;
          }

          needsBySourceRef.set(sourceRef, {
            sourceRef,
            product,
            supply,
            resource,
            quantity,
            unit,
            stepNames: new Set([step.name]),
            originalUnits: new Set([resource.unit])
          });
        });
      });
    });

  return Array.from(needsBySourceRef.values());
}

export function createPreproductionPurchaseRequests(
  products: Product[],
  routes: PreproductionRoute[],
  supplies: PlantSupply[],
  existingRequests: PurchaseRequest[] = []
) {
  const existingRefs = new Set(existingRequests.map((request) => request.sourceRef));

  return aggregateRouteSupplyNeeds(products, routes, supplies)
    .filter((need) => !existingRefs.has(need.sourceRef))
    .map((need): PurchaseRequest => {
      const hasSupplier = Boolean(need.supply?.preferredSupplierId);
      const isCataloged = Boolean(need.supply);
      const itemName = need.supply?.name ?? need.resource.name;
      const reason = !isCataloged
        ? "Consumible requerido en Preproduccion sin catalogo de insumo."
        : hasSupplier
          ? "Insumo requerido por ruta liberada de Preproduccion."
          : "Insumo requerido en Preproduccion sin proveedor asignado.";
      const notes = [
        `Producto: ${need.product.sku} - ${need.product.name}.`,
        `Pasos: ${Array.from(need.stepNames).join(", ")}.`,
        need.supply ? `Stock minimo sugerido: ${need.supply.stockMinimum} ${need.supply.unit}.` : "Registrar este insumo en catalogo.",
        Array.from(need.originalUnits).some((unit) => unit !== need.unit)
          ? `Unidad original en ruta: ${Array.from(need.originalUnits).join(", ")}.`
          : ""
      ]
        .filter(Boolean)
        .join(" ");

      return {
        id: `request-${need.sourceRef.replace(/[^a-zA-Z0-9]+/g, "-")}`,
        type: hasSupplier ? "siguiente" : "problema",
        source: "preproduccion",
        sourceRef: need.sourceRef,
        productId: need.product.id,
        componentId: need.supply?.id ?? `manual-${requestSafeKey(need.resource.name)}`,
        itemName,
        productSku: need.product.sku,
        quantity: Number(need.quantity.toFixed(3)),
        unit: need.unit,
        supplierId: need.supply?.preferredSupplierId ?? null,
        requiredDate: futureDate(hasSupplier ? 14 : 7),
        priority: hasSupplier ? "normal" : "alta",
        status: hasSupplier ? "pendiente" : "bloqueado",
        reason,
        notes
      };
    });
}
