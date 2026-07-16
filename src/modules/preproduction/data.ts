import type { Product } from "../sales/types";
import { productUnitLabels } from "../sales/utils";
import type {
  PreproductionResource,
  PreproductionRoute,
  PreproductionStep,
  PreproductionStepComponentUse,
  PreproductionStepSubassemblyUse
} from "./types";

export const so101SampleProductId = "product-so101";

function resource(
  id: string,
  name: string,
  quantity: number,
  unit: string,
  notes = "",
  supplyId = ""
): PreproductionResource {
  return {
    id,
    supplyId,
    name,
    quantity,
    unit,
    notes
  };
}

function componentUse(
  product: Product,
  id: string,
  componentId: string,
  quantity: number
): PreproductionStepComponentUse {
  const component = product.components.find((currentComponent) => currentComponent.id === componentId);

  return {
    id,
    componentId,
    componentName: component?.name ?? componentId,
    quantity,
    unit: component ? productUnitLabels[component.unit] : "pieza"
  };
}

function subassemblyUse(
  id: string,
  sourceStepId: string,
  outputName: string,
  quantity = 1,
  unit = "subensamble"
): PreproductionStepSubassemblyUse {
  return {
    id,
    sourceStepId,
    outputName,
    quantity,
    unit
  };
}

function step(input: Omit<PreproductionStep, "sequence"> & { sequence?: number }): PreproductionStep {
  return {
    sequence: input.sequence ?? 1,
    ...input
  };
}

export function createSo101SampleRoute(product: Product): PreproductionRoute | null {
  if (product.id !== so101SampleProductId) {
    return null;
  }

  const kittingStepId = "pre-so101-step-kitting";
  const armStepId = "pre-so101-step-arm";
  const gripperStepId = "pre-so101-step-gripper";
  const integrationStepId = "pre-so101-step-integration";
  const inspectionStepId = "pre-so101-step-inspection";
  const testStepId = "pre-so101-step-test";
  const packStepId = "pre-so101-step-pack";

  return {
    id: "pre-route-so101-sample",
    productId: product.id,
    status: "liberada",
    updatedAt: "2026-07-16T00:00:00.000Z",
    steps: [
      step({
        id: kittingStepId,
        sequence: 1,
        isKittingStep: true,
        name: "Recoleccion de kit SO101",
        processType: "kitting",
        station: "Almacen / Kitting",
        estimatedMinutes: 9,
        outputName: "Kit SO101",
        outputQuantity: 1,
        outputUnit: "kit",
        instructions:
          "Recolectar componentes comprados e impresos, validar cantidades contra lista tecnica y separar el kit por estacion.",
        kittingComponents: [],
        componentUses: [],
        subassemblyUses: [],
        tools: [resource("pre-so101-tool-kitting-scale", "Bascula de conteo", 1, "pieza")],
        consumables: [
          resource(
            "pre-so101-consumable-kit-bag",
            "Bolsa etiquetada para kit",
            1,
            "pieza",
            "",
            "supply-kit-label-bag"
          )
        ]
      }),
      step({
        id: armStepId,
        sequence: 2,
        isKittingStep: false,
        name: "Armar base y articulaciones",
        processType: "ensamble",
        station: "Ensamble 1",
        estimatedMinutes: 28,
        outputName: "Subensamble brazo base-articulaciones",
        outputQuantity: 1,
        outputUnit: "subensamble",
        instructions:
          "Montar bases impresas, soportes laterales y cuatro motores. Verificar que cada eje gire libre antes de aplicar torque final.",
        kittingComponents: [],
        componentUses: [
          componentUse(product, "pre-so101-use-base-motor", "so101-base-motor-3d", 8),
          componentUse(product, "pre-so101-use-soporte-motor", "so101-soporte-motor-3d", 4),
          componentUse(product, "pre-so101-use-motor-arm", "so101-motor-servo-bus", 4),
          componentUse(product, "pre-so101-use-screw-arm", "so101-tornillo-m3x12", 18)
        ],
        subassemblyUses: [],
        tools: [
          resource("pre-so101-tool-torque-arm", "Desarmador de torque M3", 1, "pieza", "Torque bajo y uniforme."),
          resource("pre-so101-tool-fixture-arm", "Fixture de alineacion SO101", 1, "pieza")
        ],
        consumables: [
          resource(
            "pre-so101-consumable-threadlocker-arm",
            "Loctite 243 / fijador de rosca medio",
            0.9,
            "ml",
            "Aplicar solo en tornilleria metal-metal.",
            "supply-loctite-243"
          )
        ]
      }),
      step({
        id: gripperStepId,
        sequence: 3,
        isKittingStep: false,
        name: "Armar gripper",
        processType: "ensamble",
        station: "Ensamble 2",
        estimatedMinutes: 18,
        outputName: "Subensamble gripper SO101",
        outputQuantity: 1,
        outputUnit: "subensamble",
        instructions:
          "Ensamblar palma, dedos, placa de muneca y separadores. Confirmar apertura/cierre manual sin friccion excesiva.",
        kittingComponents: [],
        componentUses: [
          componentUse(product, "pre-so101-use-gripper-palma", "so101-gripper-palma-3d", 1),
          componentUse(product, "pre-so101-use-gripper-left", "so101-gripper-dedo-izq-3d", 1),
          componentUse(product, "pre-so101-use-gripper-right", "so101-gripper-dedo-der-3d", 1),
          componentUse(product, "pre-so101-use-gripper-wrist", "so101-gripper-muneca-3d", 1),
          componentUse(product, "pre-so101-use-gripper-separator", "so101-gripper-separador-3d", 2),
          componentUse(product, "pre-so101-use-motor-gripper", "so101-motor-servo-bus", 1),
          componentUse(product, "pre-so101-use-screw-gripper", "so101-tornillo-m3x12", 8)
        ],
        subassemblyUses: [],
        tools: [
          resource("pre-so101-tool-hex-gripper", "Llave hexagonal M3", 1, "pieza"),
          resource("pre-so101-tool-gripper-gauge", "Calibrador de apertura", 1, "pieza")
        ],
        consumables: [
          resource(
            "pre-so101-consumable-threadlocker-gripper",
            "Loctite 243 / fijador de rosca medio",
            0.4,
            "ml",
            "Aplicar solo en tornilleria metal-metal.",
            "supply-loctite-243"
          )
        ]
      }),
      step({
        id: integrationStepId,
        sequence: 4,
        isKittingStep: false,
        name: "Integrar brazo y gripper",
        processType: "ensamble",
        station: "Ensamble final",
        estimatedMinutes: 20,
        outputName: "SO101 ensamblado",
        outputQuantity: 1,
        outputUnit: "set",
        instructions:
          "Unir el subensamble del brazo con el gripper, instalar el sexto motor y revisar recorrido completo de los ejes.",
        kittingComponents: [],
        componentUses: [
          componentUse(product, "pre-so101-use-motor-final", "so101-motor-servo-bus", 1),
          componentUse(product, "pre-so101-use-screw-final", "so101-tornillo-m3x12", 4)
        ],
        subassemblyUses: [
          subassemblyUse(
            "pre-so101-sub-arm-final",
            armStepId,
            "Subensamble brazo base-articulaciones"
          ),
          subassemblyUse("pre-so101-sub-gripper-final", gripperStepId, "Subensamble gripper SO101")
        ],
        tools: [
          resource("pre-so101-tool-torque-final", "Desarmador de torque M3", 1, "pieza"),
          resource("pre-so101-tool-axis-check", "Plantilla de recorrido de eje", 1, "pieza")
        ],
        consumables: [
          resource(
            "pre-so101-consumable-threadlocker-final",
            "Loctite 243 / fijador de rosca medio",
            0.2,
            "ml",
            "Aplicar solo en tornilleria metal-metal.",
            "supply-loctite-243"
          )
        ]
      }),
      step({
        id: inspectionStepId,
        sequence: 5,
        isKittingStep: false,
        name: "Inspeccion visual y mecanica",
        processType: "inspeccion",
        station: "Calidad entrada",
        estimatedMinutes: 10,
        outputName: "SO101 inspeccionado",
        outputQuantity: 1,
        outputUnit: "set",
        instructions:
          "Validar tornilleria, orientacion de piezas impresas, holguras, alineacion de gripper y ausencia de grietas visibles.",
        kittingComponents: [],
        componentUses: [],
        subassemblyUses: [subassemblyUse("pre-so101-sub-assembled-inspection", integrationStepId, "SO101 ensamblado", 1, "set")],
        tools: [
          resource("pre-so101-tool-caliper", "Calibrador digital", 1, "pieza"),
          resource("pre-so101-tool-checklist", "Checklist de inspeccion SO101", 1, "formato")
        ],
        consumables: [
          resource(
            "pre-so101-consumable-label-ok",
            "Etiqueta de inspeccion OK",
            1,
            "pieza",
            "",
            "supply-inspection-label-ok"
          )
        ]
      }),
      step({
        id: testStepId,
        sequence: 6,
        isKittingStep: false,
        name: "Prueba funcional de movimiento",
        processType: "prueba",
        station: "Prueba funcional",
        estimatedMinutes: 16,
        outputName: "SO101 probado",
        outputQuantity: 1,
        outputUnit: "set",
        instructions:
          "Ejecutar secuencia corta de movimiento: home, giro base, flexion de articulaciones y apertura/cierre del gripper.",
        kittingComponents: [],
        componentUses: [],
        subassemblyUses: [subassemblyUse("pre-so101-sub-inspected-test", inspectionStepId, "SO101 inspeccionado", 1, "set")],
        tools: [
          resource("pre-so101-tool-testbench", "Banco de prueba SO101", 1, "pieza"),
          resource("pre-so101-tool-power", "Fuente 12 V", 1, "pieza")
        ],
        consumables: [
          resource("pre-so101-consumable-test-log", "Registro de prueba", 1, "formato", "", "supply-test-log")
        ]
      }),
      step({
        id: packStepId,
        sequence: 7,
        isKittingStep: false,
        name: "Empaque y liberacion",
        processType: "empaque",
        station: "Empaque",
        estimatedMinutes: 8,
        outputName: "SO101 listo para entrega",
        outputQuantity: 1,
        outputUnit: "set",
        instructions:
          "Colocar protecciones, etiqueta de lote y checklist firmado. Separar documentacion para logistica.",
        kittingComponents: [],
        componentUses: [],
        subassemblyUses: [subassemblyUse("pre-so101-sub-tested-pack", testStepId, "SO101 probado", 1, "set")],
        tools: [resource("pre-so101-tool-pack-scale", "Bascula de empaque", 1, "pieza")],
        consumables: [
          resource("pre-so101-consumable-box", "Caja SO101", 1, "pieza", "", "supply-so101-box"),
          resource("pre-so101-consumable-foam", "Proteccion de espuma", 1, "set", "", "supply-protective-foam"),
          resource("pre-so101-consumable-label", "Etiqueta de lote", 1, "pieza", "", "supply-lot-label")
        ]
      })
    ]
  };
}
