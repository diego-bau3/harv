import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AlertTriangle,
  ClipboardList,
  Clock3,
  Component,
  Copy,
  Droplet,
  Factory,
  GitBranch,
  Plus,
  Route,
  Trash2,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Product } from "../../sales/types";
import { componentProcessLabels, componentTypeLabels, productUnitLabels } from "../../sales/utils";
import type {
  PreproductionProcessType,
  PreproductionResource,
  PreproductionRoute,
  PreproductionStep,
  PreproductionStepComponentUse,
  PreproductionStepSubassemblyUse,
  PreproductionStepDraft
} from "../types";
import {
  createEmptyRoute,
  emptyPreproductionStepDraft,
  formatRouteMinutes,
  normalizeStepSequence,
  nowIso,
  preproductionId,
  preproductionProcessLabels,
  preproductionRouteStatusLabels,
  routeTotalMinutes,
  summarizeRouteMinutesByProcess,
  summarizeRouteMinutesByStation,
  summarizeRouteResourcesByStation
} from "../utils";

type PreproductionScreenProps = {
  products: Product[];
  onBack: () => void;
};

const routesStorageKey = "harv:preproduction-routes:v1";

type ComponentUseDraft = {
  componentId: string;
  quantity: number;
};

type SubassemblyUseDraft = {
  sourceStepId: string;
  quantity: number;
};

type ResourceDraft = {
  name: string;
  quantity: number;
  unit: string;
  notes: string;
};

const emptyComponentUseDraft: ComponentUseDraft = {
  componentId: "",
  quantity: 1
};

const emptySubassemblyUseDraft: SubassemblyUseDraft = {
  sourceStepId: "",
  quantity: 1
};

const emptyToolDraft: ResourceDraft = {
  name: "",
  quantity: 1,
  unit: "pieza",
  notes: ""
};

const emptyConsumableDraft: ResourceDraft = {
  name: "",
  quantity: 1,
  unit: "pieza",
  notes: ""
};

function normalizeRoute(route: Partial<PreproductionRoute>, productId: string): PreproductionRoute {
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
        tools: Array.isArray(step.tools) ? step.tools : [],
        consumables: Array.isArray(step.consumables) ? step.consumables : []
      }))
    ),
    updatedAt: route.updatedAt ?? nowIso()
  };
}

function loadStoredRoutes(products: Product[]) {
  try {
    const storedRoutes = window.localStorage.getItem(routesStorageKey);

    if (!storedRoutes) {
      return [];
    }

    const parsedRoutes = JSON.parse(storedRoutes);

    return Array.isArray(parsedRoutes)
      ? parsedRoutes.map((route) => normalizeRoute(route, products[0]?.id ?? ""))
      : [];
  } catch {
    return [];
  }
}

function saveStoredRoutes(routes: PreproductionRoute[]) {
  try {
    window.localStorage.setItem(routesStorageKey, JSON.stringify(routes));
  } catch {
    return;
  }
}

function createKittingComponents(
  product: Product,
  existingKittingComponents: PreproductionStepComponentUse[] = []
): PreproductionStepComponentUse[] {
  const existingByComponentId = new Map(
    existingKittingComponents.map((componentUse) => [componentUse.componentId, componentUse])
  );

  return product.components.map((component) => {
    const existingComponentUse = existingByComponentId.get(component.id);

    return {
      id: existingComponentUse?.id ?? preproductionId("pre-kit-component"),
      componentId: component.id,
      componentName: component.name,
      quantity: component.quantity,
      unit: productUnitLabels[component.unit]
    };
  });
}

function createKittingStep(product: Product, existingStep?: PreproductionStep): PreproductionStep {
  return {
    id: existingStep?.id ?? preproductionId("pre-step-kitting"),
    sequence: 1,
    isKittingStep: true,
    name: "Recolección de piezas de almacén",
    processType: "kitting",
    station: "Almacén / Kitting",
    estimatedMinutes: existingStep?.estimatedMinutes ?? Math.max(3, Math.ceil(product.components.length * 0.75)),
    outputName: `Kit ${product.sku}`,
    outputQuantity: 1,
    outputUnit: "kit",
    instructions: "Recolectar, contar y preparar los componentes requeridos antes de iniciar ensamble.",
    kittingComponents: createKittingComponents(product, existingStep?.kittingComponents),
    componentUses: [],
    subassemblyUses: [],
    tools: existingStep?.tools ?? [],
    consumables: existingStep?.consumables ?? []
  };
}

function ensureKittingStep(route: PreproductionRoute, product: Product): PreproductionRoute {
  const existingKittingStep = route.steps.find((step) => step.isKittingStep);
  const kittingStep = createKittingStep(product, existingKittingStep);
  const remainingSteps = route.steps.filter((step) => !step.isKittingStep);

  return {
    ...route,
    steps: normalizeStepSequence([kittingStep, ...remainingSteps])
  };
}

function summarizeComponentUsage(
  route: PreproductionRoute | null,
  product: Product | undefined,
  draft?: PreproductionStepDraft
) {
  if (!route || !product) {
    return [];
  }

  const usageByComponent = new Map<string, number>();
  const draftUsageByComponent = new Map<string, number>();

  route.steps.forEach((step) => {
    step.componentUses.forEach((componentUse) => {
      usageByComponent.set(
        componentUse.componentId,
        (usageByComponent.get(componentUse.componentId) ?? 0) + Number(componentUse.quantity || 0)
      );
    });
  });

  draft?.componentUses.forEach((componentUse) => {
    draftUsageByComponent.set(
      componentUse.componentId,
      (draftUsageByComponent.get(componentUse.componentId) ?? 0) + Number(componentUse.quantity || 0)
    );
  });

  return product.components.map((component) => ({
    componentId: component.id,
    name: component.name,
    plannedQuantity: component.quantity,
    usedQuantity: (usageByComponent.get(component.id) ?? 0) + (draftUsageByComponent.get(component.id) ?? 0),
    committedQuantity: usageByComponent.get(component.id) ?? 0,
    draftQuantity: draftUsageByComponent.get(component.id) ?? 0,
    availableQuantity:
      component.quantity - ((usageByComponent.get(component.id) ?? 0) + (draftUsageByComponent.get(component.id) ?? 0)),
    unit: productUnitLabels[component.unit],
    isOverused: ((usageByComponent.get(component.id) ?? 0) + (draftUsageByComponent.get(component.id) ?? 0)) > component.quantity
  }));
}

function getSubassemblySequenceWarnings(route: PreproductionRoute | null) {
  if (!route) {
    return [];
  }

  return route.steps.flatMap((step) =>
    step.subassemblyUses
      .map((subassemblyUse) => {
        const sourceStep = route.steps.find((currentStep) => currentStep.id === subassemblyUse.sourceStepId);

        if (!sourceStep || sourceStep.sequence < step.sequence) {
          return "";
        }

        return `${step.name} consume ${subassemblyUse.outputName}, pero ese subensamble se genera en el paso ${sourceStep.sequence}.`;
      })
      .filter(Boolean)
  );
}

function getSubassemblyQuantityWarnings(route: PreproductionRoute | null) {
  if (!route) {
    return [];
  }

  return route.steps
    .filter((step) => step.outputName.trim())
    .map((sourceStep) => {
      const usedQuantity = route.steps.reduce(
        (total, step) =>
          total +
          step.subassemblyUses
            .filter((subassemblyUse) => subassemblyUse.sourceStepId === sourceStep.id)
            .reduce((subTotal, subassemblyUse) => subTotal + Number(subassemblyUse.quantity || 0), 0),
        0
      );
      const producedQuantity = Number(sourceStep.outputQuantity || 0);

      if (usedQuantity <= producedQuantity) {
        return "";
      }

      return `${sourceStep.outputName}: se consumen ${usedQuantity} y se producen ${producedQuantity}.`;
    })
    .filter(Boolean);
}

function getRouteBlockingMessages(route: PreproductionRoute, product: Product | undefined) {
  const overusedMessages = summarizeComponentUsage(route, product)
    .filter((componentUsage) => componentUsage.isOverused)
    .map(
      (componentUsage) =>
        `${componentUsage.name}: usa ${componentUsage.usedQuantity} de ${componentUsage.plannedQuantity} ${componentUsage.unit.toLowerCase()}.`
    );

  return [...overusedMessages, ...getSubassemblySequenceWarnings(route), ...getSubassemblyQuantityWarnings(route)];
}

export function PreproductionScreen({ products, onBack }: PreproductionScreenProps) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [routes, setRoutes] = useState<PreproductionRoute[]>(() => loadStoredRoutes(products));
  const [stepDraft, setStepDraft] = useState<PreproductionStepDraft>(emptyPreproductionStepDraft);
  const [componentUseDraft, setComponentUseDraft] = useState<ComponentUseDraft>(emptyComponentUseDraft);
  const [subassemblyUseDraft, setSubassemblyUseDraft] = useState<SubassemblyUseDraft>(emptySubassemblyUseDraft);
  const [toolDraft, setToolDraft] = useState<ResourceDraft>(emptyToolDraft);
  const [consumableDraft, setConsumableDraft] = useState<ResourceDraft>(emptyConsumableDraft);
  const [formError, setFormError] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? products[0],
    [products, selectedProductId]
  );
  const selectedRoute = useMemo(() => {
    if (!selectedProduct) {
      return null;
    }

    return routes.find((route) => route.productId === selectedProduct.id) ?? createEmptyRoute(selectedProduct.id);
  }, [routes, selectedProduct]);
  const totalMinutes = selectedRoute ? routeTotalMinutes(selectedRoute) : 0;
  const processCount = selectedRoute
    ? new Set(selectedRoute.steps.map((step) => step.processType)).size
    : 0;
  const resourceSummaries = selectedRoute ? summarizeRouteResourcesByStation(selectedRoute) : [];
  const stationTimeSummaries = selectedRoute ? summarizeRouteMinutesByStation(selectedRoute) : [];
  const processTimeSummaries = selectedRoute ? summarizeRouteMinutesByProcess(selectedRoute) : [];
  const componentUsageSummaries = summarizeComponentUsage(selectedRoute, selectedProduct, stepDraft);
  const overusedComponents = componentUsageSummaries.filter((componentUsage) => componentUsage.isOverused);
  const underusedComponents = componentUsageSummaries.filter(
    (componentUsage) => !componentUsage.isOverused && componentUsage.availableQuantity > 0
  );
  const sequenceWarnings = getSubassemblySequenceWarnings(selectedRoute);
  const subassemblyQuantityWarnings = getSubassemblyQuantityWarnings(selectedRoute);
  const availableSubassemblies = selectedRoute
    ? selectedRoute.steps.filter((step) => !step.isKittingStep && step.outputName.trim().length > 0)
    : [];
  const totalTools = selectedRoute
    ? new Set(
        selectedRoute.steps.flatMap((step) => step.tools.map((tool) => tool.name.trim().toLowerCase()).filter(Boolean))
      ).size
    : 0;
  const totalConsumables = selectedRoute
    ? new Set(
        selectedRoute.steps.flatMap((step) =>
          step.consumables.map((consumable) => consumable.name.trim().toLowerCase()).filter(Boolean)
        )
      ).size
    : 0;
  const totalSubassemblies = availableSubassemblies.length;

  useEffect(() => {
    saveStoredRoutes(routes);
  }, [routes]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    setRoutes((currentRoutes) => {
      const existingRoute = currentRoutes.find((route) => route.productId === selectedProduct.id);
      const baseRoute = existingRoute ?? createEmptyRoute(selectedProduct.id);
      const routeWithKitting = ensureKittingStep(baseRoute, selectedProduct);

      if (existingRoute && JSON.stringify(existingRoute) === JSON.stringify(routeWithKitting)) {
        return currentRoutes;
      }

      const nextRoute = {
        ...routeWithKitting,
        updatedAt: nowIso()
      };

      if (!existingRoute) {
        return [nextRoute, ...currentRoutes];
      }

      return currentRoutes.map((route) => (route.productId === selectedProduct.id ? nextRoute : route));
    });
  }, [selectedProduct]);

  function updateStepDraft<Key extends keyof PreproductionStepDraft>(key: Key, value: PreproductionStepDraft[Key]) {
    setStepDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function updateComponentUseDraft<Key extends keyof ComponentUseDraft>(key: Key, value: ComponentUseDraft[Key]) {
    setComponentUseDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function updateSubassemblyUseDraft<Key extends keyof SubassemblyUseDraft>(
    key: Key,
    value: SubassemblyUseDraft[Key]
  ) {
    setSubassemblyUseDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function updateToolDraft<Key extends keyof ResourceDraft>(key: Key, value: ResourceDraft[Key]) {
    setToolDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function updateConsumableDraft<Key extends keyof ResourceDraft>(key: Key, value: ResourceDraft[Key]) {
    setConsumableDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function addComponentUse() {
    const component = selectedProduct?.components.find(
      (currentComponent) => currentComponent.id === componentUseDraft.componentId
    );

    if (!component) {
      setFormError("Selecciona un componente para consumir en el paso.");
      return;
    }

    if (componentUseDraft.quantity <= 0) {
      setFormError("La cantidad del componente debe ser mayor a cero.");
      return;
    }

    const componentUsage = componentUsageSummaries.find(
      (currentComponentUsage) => currentComponentUsage.componentId === component.id
    );
    const availableQuantity = componentUsage?.availableQuantity ?? component.quantity;

    if (componentUseDraft.quantity > availableQuantity) {
      setFormError(`Sólo quedan ${availableQuantity} ${productUnitLabels[component.unit].toLowerCase()} disponibles de ${component.name}.`);
      return;
    }

    const componentUse: PreproductionStepComponentUse = {
      id: preproductionId("pre-component"),
      componentId: component.id,
      componentName: component.name,
      quantity: Number(componentUseDraft.quantity),
      unit: productUnitLabels[component.unit]
    };

    setStepDraft((currentDraft) => ({
      ...currentDraft,
      componentUses: [...currentDraft.componentUses, componentUse]
    }));
    setComponentUseDraft(emptyComponentUseDraft);
    setFormError("");
  }

  function addSubassemblyUse() {
    const sourceStep = availableSubassemblies.find((step) => step.id === subassemblyUseDraft.sourceStepId);

    if (!sourceStep) {
      setFormError("Selecciona un subensamble generado por otro paso.");
      return;
    }

    if (subassemblyUseDraft.quantity <= 0) {
      setFormError("La cantidad del subensamble debe ser mayor a cero.");
      return;
    }

    const subassemblyUse: PreproductionStepSubassemblyUse = {
      id: preproductionId("pre-subassembly"),
      sourceStepId: sourceStep.id,
      outputName: sourceStep.outputName,
      quantity: Number(subassemblyUseDraft.quantity),
      unit: sourceStep.outputUnit || "subensamble"
    };

    setStepDraft((currentDraft) => ({
      ...currentDraft,
      subassemblyUses: [...currentDraft.subassemblyUses, subassemblyUse]
    }));
    setSubassemblyUseDraft(emptySubassemblyUseDraft);
    setFormError("");
  }

  function removeSubassemblyUse(subassemblyUseId: string) {
    setStepDraft((currentDraft) => ({
      ...currentDraft,
      subassemblyUses: currentDraft.subassemblyUses.filter((subassemblyUse) => subassemblyUse.id !== subassemblyUseId)
    }));
  }

  function removeComponentUse(componentUseId: string) {
    setStepDraft((currentDraft) => ({
      ...currentDraft,
      componentUses: currentDraft.componentUses.filter((componentUse) => componentUse.id !== componentUseId)
    }));
  }

  function addResource(resourceType: "tool" | "consumable") {
    const resourceDraft = resourceType === "tool" ? toolDraft : consumableDraft;

    if (!resourceDraft.name.trim()) {
      setFormError(resourceType === "tool" ? "Agrega nombre de herramienta." : "Agrega nombre de consumible.");
      return;
    }

    if (resourceDraft.quantity <= 0) {
      setFormError("La cantidad del recurso debe ser mayor a cero.");
      return;
    }

    const resource: PreproductionResource = {
      id: preproductionId(resourceType === "tool" ? "pre-tool" : "pre-consumable"),
      name: resourceDraft.name.trim(),
      quantity: Number(resourceDraft.quantity),
      unit: resourceDraft.unit.trim() || "pieza",
      notes: resourceDraft.notes.trim()
    };

    setStepDraft((currentDraft) => ({
      ...currentDraft,
      tools: resourceType === "tool" ? [...currentDraft.tools, resource] : currentDraft.tools,
      consumables:
        resourceType === "consumable" ? [...currentDraft.consumables, resource] : currentDraft.consumables
    }));

    if (resourceType === "tool") {
      setToolDraft(emptyToolDraft);
    } else {
      setConsumableDraft(emptyConsumableDraft);
    }

    setFormError("");
  }

  function removeResource(resourceType: "tool" | "consumable", resourceId: string) {
    setStepDraft((currentDraft) => ({
      ...currentDraft,
      tools: resourceType === "tool" ? currentDraft.tools.filter((tool) => tool.id !== resourceId) : currentDraft.tools,
      consumables:
        resourceType === "consumable"
          ? currentDraft.consumables.filter((consumable) => consumable.id !== resourceId)
          : currentDraft.consumables
    }));
  }

  function upsertRoute(nextRoute: PreproductionRoute) {
    setRoutes((currentRoutes) => {
      const routeExists = currentRoutes.some((route) => route.productId === nextRoute.productId);

      if (!routeExists) {
        return [nextRoute, ...currentRoutes];
      }

      return currentRoutes.map((route) => (route.productId === nextRoute.productId ? nextRoute : route));
    });
  }

  function addStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRoute || !selectedProduct) {
      setFormError("Selecciona un producto para crear la ruta.");
      return;
    }

    if (!stepDraft.name.trim() || !stepDraft.station.trim()) {
      setFormError("Agrega nombre del paso y estación.");
      return;
    }

    if (stepDraft.estimatedMinutes <= 0) {
      setFormError("El tiempo debe ser mayor a cero.");
      return;
    }

    if (stepDraft.outputName.trim() && stepDraft.outputQuantity <= 0) {
      setFormError("Si el paso genera una salida, la cantidad debe ser mayor a cero.");
      return;
    }

    const nextStep: PreproductionStep = {
      id: preproductionId("pre-step"),
      sequence: selectedRoute.steps.length + 1,
      isKittingStep: false,
      name: stepDraft.name.trim(),
      processType: stepDraft.processType,
      station: stepDraft.station.trim(),
      estimatedMinutes: Number(stepDraft.estimatedMinutes),
      outputName: stepDraft.outputName.trim(),
      outputQuantity: stepDraft.outputName.trim() ? Number(stepDraft.outputQuantity) : 0,
      outputUnit: stepDraft.outputUnit.trim() || "subensamble",
      instructions: stepDraft.instructions.trim(),
      kittingComponents: [],
      componentUses: stepDraft.componentUses,
      subassemblyUses: stepDraft.subassemblyUses,
      tools: stepDraft.tools,
      consumables: stepDraft.consumables
    };

    const nextRoute = {
      ...selectedRoute,
      productId: selectedProduct.id,
      steps: normalizeStepSequence([...selectedRoute.steps, nextStep]),
      updatedAt: nowIso()
    };
    const blockingMessages = getRouteBlockingMessages(nextRoute, selectedProduct);

    if (blockingMessages.length > 0) {
      setFormError(`No se puede guardar: ${blockingMessages[0]}`);
      return;
    }

    upsertRoute(nextRoute);
    setStepDraft(emptyPreproductionStepDraft);
    setComponentUseDraft(emptyComponentUseDraft);
    setSubassemblyUseDraft(emptySubassemblyUseDraft);
    setToolDraft(emptyToolDraft);
    setConsumableDraft(emptyConsumableDraft);
    setFormError("");
  }

  function removeStep(stepId: string) {
    if (!selectedRoute) {
      return;
    }

    if (selectedRoute.steps.some((step) => step.id === stepId && step.isKittingStep)) {
      setFormError("El paso de recolección se genera automáticamente y no se puede eliminar.");
      return;
    }

    upsertRoute({
      ...selectedRoute,
      steps: normalizeStepSequence(
        selectedRoute.steps
          .filter((step) => step.id !== stepId)
          .map((step) => ({
            ...step,
            subassemblyUses: step.subassemblyUses.filter((subassemblyUse) => subassemblyUse.sourceStepId !== stepId)
          }))
      ),
      updatedAt: nowIso()
    });
  }

  function duplicateStep(stepId: string) {
    if (!selectedRoute) {
      return;
    }

    const currentIndex = selectedRoute.steps.findIndex((step) => step.id === stepId);
    const sourceStep = selectedRoute.steps[currentIndex];

    if (!sourceStep || sourceStep.isKittingStep) {
      return;
    }

    const duplicatedStep: PreproductionStep = {
      ...sourceStep,
      id: preproductionId("pre-step"),
      isKittingStep: false,
      name: `${sourceStep.name} copia`,
      kittingComponents: [],
      componentUses: sourceStep.componentUses.map((componentUse) => ({
        ...componentUse,
        id: preproductionId("pre-component")
      })),
      subassemblyUses: sourceStep.subassemblyUses.map((subassemblyUse) => ({
        ...subassemblyUse,
        id: preproductionId("pre-subassembly")
      })),
      tools: sourceStep.tools.map((tool) => ({
        ...tool,
        id: preproductionId("pre-tool")
      })),
      consumables: sourceStep.consumables.map((consumable) => ({
        ...consumable,
        id: preproductionId("pre-consumable")
      }))
    };
    const nextSteps = [...selectedRoute.steps];
    nextSteps.splice(currentIndex + 1, 0, duplicatedStep);
    const nextRoute = {
      ...selectedRoute,
      steps: normalizeStepSequence(nextSteps),
      updatedAt: nowIso()
    };
    const blockingMessages = getRouteBlockingMessages(nextRoute, selectedProduct);

    if (blockingMessages.length > 0) {
      setFormError(`No se puede duplicar: ${blockingMessages[0]}`);
      return;
    }

    upsertRoute(nextRoute);
    setFormError("");
  }

  function moveStep(stepId: string, direction: -1 | 1) {
    if (!selectedRoute) {
      return;
    }

    const currentIndex = selectedRoute.steps.findIndex((step) => step.id === stepId);
    const nextIndex = currentIndex + direction;
    const movingStep = selectedRoute.steps[currentIndex];

    if (
      !movingStep ||
      movingStep.isKittingStep ||
      currentIndex < 0 ||
      nextIndex <= 0 ||
      nextIndex >= selectedRoute.steps.length
    ) {
      return;
    }

    const nextSteps = [...selectedRoute.steps];
    const [nextMovingStep] = nextSteps.splice(currentIndex, 1);
    nextSteps.splice(nextIndex, 0, nextMovingStep);
    const nextRoute = {
      ...selectedRoute,
      steps: normalizeStepSequence(nextSteps),
      updatedAt: nowIso()
    };
    const blockingMessages = getRouteBlockingMessages(nextRoute, selectedProduct);

    if (blockingMessages.length > 0) {
      setFormError(`No se puede mover: ${blockingMessages[0]}`);
      return;
    }

    upsertRoute(nextRoute);
    setFormError("");
  }

  function formatResource(resource: PreproductionResource) {
    return `${resource.name} · ${resource.quantity} ${resource.unit}`;
  }

  function formatStepOutput(step: PreproductionStep) {
    return `${step.outputName} · ${step.outputQuantity || 1} ${step.outputUnit || "subensamble"}`;
  }

  return (
    <main className="profile-screen preproduction-profile-screen">
      <header className="screen-header">
        <button className="icon-button" onClick={onBack} type="button" aria-label="Regresar a perfiles">
          <ArrowLeft size={22} />
        </button>
        <div className="screen-title">
          <span className="screen-icon preproduction-screen-icon" aria-hidden="true">
            <Route size={22} />
          </span>
          <h1>Preproducción</h1>
        </div>
      </header>

      <section className="preproduction-body">
        <section className="preproduction-command-panel">
          <div>
            <span className="section-kicker">Ruta base</span>
            <h2>{selectedProduct?.name ?? "Sin producto seleccionado"}</h2>
          </div>
          <label className="field preproduction-product-select">
            <span>Producto</span>
            <select value={selectedProduct?.id ?? ""} onChange={(event) => setSelectedProductId(event.target.value)}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="preproduction-stat-grid" aria-label="Resumen de preproducción">
          <article>
            <Component size={20} aria-hidden="true" />
            <span>Componentes</span>
            <strong>{selectedProduct?.components.length ?? 0}</strong>
          </article>
          <article>
            <ClipboardList size={20} aria-hidden="true" />
            <span>Pasos</span>
            <strong>{selectedRoute?.steps.length ?? 0}</strong>
          </article>
          <article>
            <GitBranch size={20} aria-hidden="true" />
            <span>Subensambles</span>
            <strong>{totalSubassemblies}</strong>
          </article>
          <article>
            <Clock3 size={20} aria-hidden="true" />
            <span>Tiempo total</span>
            <strong>{formatRouteMinutes(totalMinutes)}</strong>
          </article>
          <article>
            <Factory size={20} aria-hidden="true" />
            <span>Procesos</span>
            <strong>{processCount}</strong>
          </article>
          <article>
            <Wrench size={20} aria-hidden="true" />
            <span>Herramientas</span>
            <strong>{totalTools}</strong>
          </article>
          <article>
            <Droplet size={20} aria-hidden="true" />
            <span>Consumibles</span>
            <strong>{totalConsumables}</strong>
          </article>
        </section>

        <section className="preproduction-layout">
          <aside className="main-panel preproduction-product-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Componentes del producto</h2>
                <p>Base técnica disponible para construir la ruta.</p>
              </div>
            </div>

            <div className="preproduction-component-list">
              {componentUsageSummaries.map((componentUsage) => {
                const component = selectedProduct?.components.find(
                  (currentComponent) => currentComponent.id === componentUsage.componentId
                );
                const statusClass = componentUsage.isOverused
                  ? "over"
                  : componentUsage.availableQuantity === 0
                    ? "complete"
                    : "available";

                return (
                  <article className={`preproduction-component-row ${statusClass}`} key={componentUsage.componentId}>
                    <div>
                      <strong>{componentUsage.name}</strong>
                      <span>
                        {component ? `${componentTypeLabels[component.type]} · ${componentProcessLabels[component.process]}` : "Componente"}
                      </span>
                    </div>
                    <div className="preproduction-component-quantity-grid">
                      <span>Total {componentUsage.plannedQuantity}</span>
                      <span>Asignado {componentUsage.usedQuantity}</span>
                      <span>Disponible {Math.max(componentUsage.availableQuantity, 0)}</span>
                    </div>
                  </article>
                );
              })}
              {!selectedProduct ? <p className="empty-state">Agrega productos para empezar preproducción.</p> : null}
            </div>
          </aside>

          <section className="main-panel preproduction-builder-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Ruta de preproducción</h2>
                <p>Estado: {selectedRoute ? preproductionRouteStatusLabels[selectedRoute.status] : "Sin ruta"}</p>
              </div>
            </div>

            <form className="preproduction-step-form" onSubmit={addStep}>
              <div className="form-grid three-columns">
                <label className="field">
                  <span>Nombre del paso</span>
                  <input
                    value={stepDraft.name}
                    onChange={(event) => updateStepDraft("name", event.target.value)}
                    placeholder="Ej. Montar motor en base"
                  />
                </label>
                <label className="field">
                  <span>Tipo</span>
                  <select
                    value={stepDraft.processType}
                    onChange={(event) => updateStepDraft("processType", event.target.value as PreproductionProcessType)}
                  >
                    {Object.entries(preproductionProcessLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Estación</span>
                  <input
                    value={stepDraft.station}
                    onChange={(event) => updateStepDraft("station", event.target.value)}
                    placeholder="Ej. Ensamble 1"
                  />
                </label>
                <label className="field">
                  <span>Tiempo min</span>
                  <input
                    min="1"
                    type="number"
                    value={stepDraft.estimatedMinutes}
                    onChange={(event) => updateStepDraft("estimatedMinutes", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  <span>Salida generada</span>
                  <input
                    value={stepDraft.outputName}
                    onChange={(event) => updateStepDraft("outputName", event.target.value)}
                    placeholder="Ej. Subensamble base-motor"
                  />
                </label>
                <label className="field">
                  <span>Cantidad salida</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={stepDraft.outputQuantity}
                    onChange={(event) => updateStepDraft("outputQuantity", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  <span>Unidad salida</span>
                  <input
                    value={stepDraft.outputUnit}
                    onChange={(event) => updateStepDraft("outputUnit", event.target.value)}
                    placeholder="subensamble"
                  />
                </label>
                <label className="field wide-field">
                  <span>Instrucciones</span>
                  <textarea
                    value={stepDraft.instructions}
                    onChange={(event) => updateStepDraft("instructions", event.target.value)}
                    placeholder="Secuencia técnica del paso"
                  />
                </label>
              </div>

              <section className="preproduction-step-resources">
                <article className="preproduction-resource-builder">
                  <div className="preproduction-resource-heading">
                    <Component size={16} aria-hidden="true" />
                    <span>Componentes que consume</span>
                  </div>
                  <div className="preproduction-resource-form">
                    <label className="field">
                      <span>Componente</span>
                      <select
                        value={componentUseDraft.componentId}
                        onChange={(event) => updateComponentUseDraft("componentId", event.target.value)}
                      >
                        <option value="">Selecciona componente</option>
                        {selectedProduct?.components.map((component) => (
                          <option key={component.id} value={component.id}>
                            {component.name} ·{" "}
                            {Math.max(
                              componentUsageSummaries.find((componentUsage) => componentUsage.componentId === component.id)
                                ?.availableQuantity ?? component.quantity,
                              0
                            )}{" "}
                            disponibles
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Cantidad</span>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={componentUseDraft.quantity}
                        onChange={(event) => updateComponentUseDraft("quantity", Number(event.target.value))}
                      />
                    </label>
                    <button className="secondary-button input-height-button" onClick={addComponentUse} type="button">
                      <Plus size={15} />
                      Agregar
                    </button>
                  </div>
                  <div className="preproduction-resource-chip-list">
                    {stepDraft.componentUses.map((componentUse) => (
                      <span key={componentUse.id}>
                        {componentUse.componentName} · {componentUse.quantity} {componentUse.unit}
                        <button onClick={() => removeComponentUse(componentUse.id)} type="button" aria-label="Quitar componente">
                          <Trash2 size={13} />
                        </button>
                      </span>
                    ))}
                    {stepDraft.componentUses.length === 0 ? <p>Sin componentes ligados a este paso.</p> : null}
                  </div>
                </article>

                <article className="preproduction-resource-builder">
                  <div className="preproduction-resource-heading">
                    <GitBranch size={16} aria-hidden="true" />
                    <span>Subensambles que consume</span>
                  </div>
                  <div className="preproduction-resource-form">
                    <label className="field">
                      <span>Subensamble</span>
                      <select
                        value={subassemblyUseDraft.sourceStepId}
                        onChange={(event) => updateSubassemblyUseDraft("sourceStepId", event.target.value)}
                      >
                        <option value="">Selecciona salida previa</option>
                        {availableSubassemblies.map((step) => (
                          <option key={step.id} value={step.id}>
                            Paso {step.sequence} · {formatStepOutput(step)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Cantidad</span>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={subassemblyUseDraft.quantity}
                        onChange={(event) => updateSubassemblyUseDraft("quantity", Number(event.target.value))}
                      />
                    </label>
                    <button className="secondary-button input-height-button" onClick={addSubassemblyUse} type="button">
                      <Plus size={15} />
                      Agregar
                    </button>
                  </div>
                  <div className="preproduction-resource-chip-list">
                    {stepDraft.subassemblyUses.map((subassemblyUse) => (
                      <span key={subassemblyUse.id}>
                        {subassemblyUse.outputName} · {subassemblyUse.quantity} {subassemblyUse.unit}
                        <button
                          onClick={() => removeSubassemblyUse(subassemblyUse.id)}
                          type="button"
                          aria-label="Quitar subensamble"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    ))}
                    {stepDraft.subassemblyUses.length === 0 ? <p>Sin subensambles ligados a este paso.</p> : null}
                  </div>
                </article>

                <article className="preproduction-resource-builder">
                  <div className="preproduction-resource-heading">
                    <Wrench size={16} aria-hidden="true" />
                    <span>Herramientas</span>
                  </div>
                  <div className="preproduction-resource-form">
                    <label className="field">
                      <span>Herramienta</span>
                      <input
                        value={toolDraft.name}
                        onChange={(event) => updateToolDraft("name", event.target.value)}
                        placeholder="Ej. Torque driver"
                      />
                    </label>
                    <label className="field">
                      <span>Cantidad</span>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={toolDraft.quantity}
                        onChange={(event) => updateToolDraft("quantity", Number(event.target.value))}
                      />
                    </label>
                    <label className="field">
                      <span>Unidad</span>
                      <input value={toolDraft.unit} onChange={(event) => updateToolDraft("unit", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Notas</span>
                      <input
                        value={toolDraft.notes}
                        onChange={(event) => updateToolDraft("notes", event.target.value)}
                        placeholder="Opcional"
                      />
                    </label>
                    <button className="secondary-button input-height-button" onClick={() => addResource("tool")} type="button">
                      <Plus size={15} />
                      Agregar
                    </button>
                  </div>
                  <div className="preproduction-resource-chip-list">
                    {stepDraft.tools.map((tool) => (
                      <span key={tool.id}>
                        {formatResource(tool)}
                        <button onClick={() => removeResource("tool", tool.id)} type="button" aria-label="Quitar herramienta">
                          <Trash2 size={13} />
                        </button>
                      </span>
                    ))}
                    {stepDraft.tools.length === 0 ? <p>Sin herramientas para este paso.</p> : null}
                  </div>
                </article>

                <article className="preproduction-resource-builder">
                  <div className="preproduction-resource-heading">
                    <Droplet size={16} aria-hidden="true" />
                    <span>Consumibles</span>
                  </div>
                  <div className="preproduction-resource-form">
                    <label className="field">
                      <span>Consumible</span>
                      <input
                        value={consumableDraft.name}
                        onChange={(event) => updateConsumableDraft("name", event.target.value)}
                        placeholder="Ej. Loctite 243"
                      />
                    </label>
                    <label className="field">
                      <span>Cantidad</span>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={consumableDraft.quantity}
                        onChange={(event) => updateConsumableDraft("quantity", Number(event.target.value))}
                      />
                    </label>
                    <label className="field">
                      <span>Unidad</span>
                      <input
                        value={consumableDraft.unit}
                        onChange={(event) => updateConsumableDraft("unit", event.target.value)}
                        placeholder="ml, pieza, gota"
                      />
                    </label>
                    <label className="field">
                      <span>Notas</span>
                      <input
                        value={consumableDraft.notes}
                        onChange={(event) => updateConsumableDraft("notes", event.target.value)}
                        placeholder="Opcional"
                      />
                    </label>
                    <button
                      className="secondary-button input-height-button"
                      onClick={() => addResource("consumable")}
                      type="button"
                    >
                      <Plus size={15} />
                      Agregar
                    </button>
                  </div>
                  <div className="preproduction-resource-chip-list">
                    {stepDraft.consumables.map((consumable) => (
                      <span key={consumable.id}>
                        {formatResource(consumable)}
                        <button
                          onClick={() => removeResource("consumable", consumable.id)}
                          type="button"
                          aria-label="Quitar consumible"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    ))}
                    {stepDraft.consumables.length === 0 ? <p>Sin consumibles para este paso.</p> : null}
                  </div>
                </article>
              </section>

              {formError ? <p className="form-error">{formError}</p> : null}

              <button className="primary-button input-height-button" type="submit">
                <Plus size={17} />
                Agregar paso
              </button>
            </form>

            <div className="preproduction-step-list">
              {selectedRoute?.steps.map((step) => (
                <article className="preproduction-step-card" key={step.id}>
                  <div className="preproduction-step-number">
                    <span>Paso</span>
                    <strong>{step.sequence}</strong>
                  </div>
                  <div className="preproduction-step-main">
                    <header>
                      <div>
                        <span>{preproductionProcessLabels[step.processType]}</span>
                        <strong>{step.name}</strong>
                      </div>
                      <span className="preproduction-time-pill">{formatRouteMinutes(step.estimatedMinutes)}</span>
                    </header>
                    <div className="preproduction-step-meta">
                      <span>{step.station}</span>
                      {step.outputName ? <span>Produce {formatStepOutput(step)}</span> : null}
                    </div>
                    {step.instructions ? <p>{step.instructions}</p> : null}
                    <div className="preproduction-step-resource-summary">
                      {step.isKittingStep ? (
                        <section>
                          <span>Recolecta</span>
                          {step.kittingComponents.map((componentUse) => (
                            <p key={componentUse.id}>
                              {componentUse.componentName} · {componentUse.quantity} {componentUse.unit}
                            </p>
                          ))}
                        </section>
                      ) : null}
                      {step.componentUses.length > 0 ? (
                        <section>
                          <span>Consume</span>
                          {step.componentUses.map((componentUse) => (
                            <p key={componentUse.id}>
                              {componentUse.componentName} · {componentUse.quantity} {componentUse.unit}
                            </p>
                          ))}
                        </section>
                      ) : null}
                      {step.subassemblyUses.length > 0 ? (
                        <section>
                          <span>Subensambles</span>
                          {step.subassemblyUses.map((subassemblyUse) => (
                            <p key={subassemblyUse.id}>
                              {subassemblyUse.outputName} · {subassemblyUse.quantity} {subassemblyUse.unit}
                            </p>
                          ))}
                        </section>
                      ) : null}
                      {step.tools.length > 0 ? (
                        <section>
                          <span>Herramientas</span>
                          {step.tools.map((tool) => (
                            <p key={tool.id}>{formatResource(tool)}</p>
                          ))}
                        </section>
                      ) : null}
                      {step.consumables.length > 0 ? (
                        <section>
                          <span>Consumibles</span>
                          {step.consumables.map((consumable) => (
                            <p key={consumable.id}>{formatResource(consumable)}</p>
                          ))}
                        </section>
                      ) : null}
                    </div>
                  </div>
                  <div className="preproduction-step-actions">
                    {step.isKittingStep ? (
                      <span className="preproduction-kitting-lock">Automático</span>
                    ) : (
                      <>
                        <button
                          className="icon-button ghost"
                          onClick={() => moveStep(step.id, -1)}
                          type="button"
                          aria-label="Mover paso arriba"
                        >
                          <ArrowUp size={17} />
                        </button>
                        <button
                          className="icon-button ghost"
                          onClick={() => moveStep(step.id, 1)}
                          type="button"
                          aria-label="Mover paso abajo"
                        >
                          <ArrowDown size={17} />
                        </button>
                        <button
                          className="icon-button ghost"
                          onClick={() => duplicateStep(step.id)}
                          type="button"
                          aria-label="Duplicar paso"
                        >
                          <Copy size={17} />
                        </button>
                        <button
                          className="icon-button ghost"
                          onClick={() => removeStep(step.id)}
                          type="button"
                          aria-label="Eliminar paso"
                        >
                          <Trash2 size={17} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}

              {selectedRoute && selectedRoute.steps.length === 0 ? (
                <p className="empty-state">Aún no hay pasos para este producto.</p>
              ) : null}
            </div>
          </section>
        </section>

        <section className="preproduction-lower-grid" aria-label="Resumen técnico de preproducción">
          <article className="main-panel preproduction-resource-summary">
            <div className="clean-section-heading">
              <div>
                <h2>Herramientas y consumibles por estación</h2>
                <p>Resumen automático de recursos necesarios.</p>
              </div>
            </div>

            <div className="preproduction-station-summary-list">
              {resourceSummaries.map((summary) => (
                <article className="preproduction-station-summary-card" key={summary.station}>
                  <header>
                    <Factory size={16} aria-hidden="true" />
                    <strong>{summary.station}</strong>
                  </header>
                  <div className="preproduction-station-resource-columns">
                    <section>
                      <span>Herramientas</span>
                      {summary.tools.map((tool) => (
                        <p key={tool.id}>{formatResource(tool)}</p>
                      ))}
                      {summary.tools.length === 0 ? <p>Sin herramientas registradas.</p> : null}
                    </section>
                    <section>
                      <span>Consumibles</span>
                      {summary.consumables.map((consumable) => (
                        <p key={consumable.id}>{formatResource(consumable)}</p>
                      ))}
                      {summary.consumables.length === 0 ? <p>Sin consumibles registrados.</p> : null}
                    </section>
                  </div>
                </article>
              ))}

              {resourceSummaries.length === 0 ? (
                <p className="empty-state">Agrega herramientas o consumibles en los pasos para ver el resumen por estación.</p>
              ) : null}
            </div>
          </article>

          <article className="main-panel preproduction-time-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Tiempos por estación y proceso</h2>
                <p>Distribución de minutos para balancear la ruta.</p>
              </div>
            </div>
            <div className="preproduction-time-columns">
              <section>
                <span>Estaciones</span>
                {stationTimeSummaries.map((summary) => (
                  <p key={summary.station}>
                    {summary.station} · {formatRouteMinutes(summary.minutes)}
                  </p>
                ))}
                {stationTimeSummaries.length === 0 ? <p>Sin pasos registrados.</p> : null}
              </section>
              <section>
                <span>Procesos</span>
                {processTimeSummaries.map((summary) => (
                  <p key={summary.processType}>
                    {preproductionProcessLabels[summary.processType]} · {formatRouteMinutes(summary.minutes)}
                  </p>
                ))}
                {processTimeSummaries.length === 0 ? <p>Sin procesos registrados.</p> : null}
              </section>
            </div>
          </article>
        </section>

        <section className="main-panel preproduction-validation-panel compact">
          <div className="clean-section-heading">
            <div>
              <h2>Validación de puzzle</h2>
              <p>Las alertas rojas bloquean guardado.</p>
            </div>
          </div>

          <div className="preproduction-validation-list compact">
            {overusedComponents.map((componentUsage) => (
              <div className="preproduction-validation-alert" key={componentUsage.componentId}>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  {componentUsage.name}: usa {componentUsage.usedQuantity} de {componentUsage.plannedQuantity}{" "}
                  {componentUsage.unit.toLowerCase()}.
                </span>
              </div>
            ))}
            {sequenceWarnings.map((warning) => (
              <div className="preproduction-validation-alert" key={warning}>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{warning}</span>
              </div>
            ))}
            {subassemblyQuantityWarnings.map((warning) => (
              <div className="preproduction-validation-alert" key={warning}>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{warning}</span>
              </div>
            ))}
            {underusedComponents.map((componentUsage) => (
              <div className="preproduction-validation-note" key={componentUsage.componentId}>
                <Component size={16} aria-hidden="true" />
                <span>
                  {componentUsage.name}: quedan {componentUsage.availableQuantity}{" "}
                  {componentUsage.unit.toLowerCase()} sin asignar a pasos.
                </span>
              </div>
            ))}
            {overusedComponents.length === 0 &&
            sequenceWarnings.length === 0 &&
            subassemblyQuantityWarnings.length === 0 &&
            underusedComponents.length === 0 ? (
              <p className="empty-state">La ruta no tiene alertas de componentes o secuencia.</p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
