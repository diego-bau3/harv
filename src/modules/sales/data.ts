import type { Client, Product, SalesUser } from "./types";

export const salesUser: SalesUser = {
  name: "",
  permissions: {
    verifyPayment: true,
    approveCredit: true,
    approveCommercial: true,
    cancelOrder: true
  }
};

export const initialClients: Client[] = [];

type ProductComponentSeed = Product["components"][number];
type PrintedComponentSeed = Pick<ProductComponentSeed, "id" | "name" | "quantity" | "material" | "color" | "notes"> & {
  fileName: string;
};
type PurchasedComponentSeed = Pick<
  ProductComponentSeed,
  "id" | "name" | "type" | "quantity" | "material" | "color" | "notes"
> & {
  supplierContactMethod?: ProductComponentSeed["supplierContactMethod"];
  supplierExternalPlatform?: string;
  supplierCompany?: string;
  supplierPartNumber?: string;
  unitCost?: number;
  leadTime?: string;
  needsSupplierResearch?: boolean;
  supplierResearchNotes?: string;
};

const emptySupplierFields: Pick<
  ProductComponentSeed,
  | "supplierContactMethod"
  | "supplierExternalPlatform"
  | "supplierCompany"
  | "supplierContact"
  | "supplierEmail"
  | "supplierPhone"
  | "supplierPartNumber"
  | "unitCost"
  | "leadTime"
  | "minimumPurchaseQuantity"
  | "referenceLink"
> = {
  supplierContactMethod: "whatsapp",
  supplierExternalPlatform: "",
  supplierCompany: "",
  supplierContact: "",
  supplierEmail: "",
  supplierPhone: "",
  supplierPartNumber: "",
  unitCost: 0,
  leadTime: "",
  minimumPurchaseQuantity: "",
  referenceLink: ""
};

function printedComponent(component: PrintedComponentSeed): ProductComponentSeed {
  return {
    id: component.id,
    name: component.name,
    type: "pieza-impresa-3d",
    quantity: component.quantity,
    unit: "pieza",
    process: "impresion-3d",
    material: component.material,
    color: component.color,
    ...emptySupplierFields,
    needsSupplierResearch: false,
    supplierResearchNotes: "",
    printDesigns: [
      {
        id: `${component.id}-p1s`,
        printer: "P1S",
        fileName: component.fileName,
        notes: "Diseño base para impresión en P1S."
      }
    ],
    notes: component.notes
  };
}

function purchasedComponent(component: PurchasedComponentSeed): ProductComponentSeed {
  return {
    id: component.id,
    name: component.name,
    type: component.type,
    quantity: component.quantity,
    unit: "pieza",
    process: "comprado",
    material: component.material,
    color: component.color,
    ...emptySupplierFields,
    supplierContactMethod: component.supplierContactMethod ?? "whatsapp",
    supplierExternalPlatform: component.supplierExternalPlatform ?? "",
    supplierCompany: component.supplierCompany ?? "",
    supplierPartNumber: component.supplierPartNumber ?? "",
    unitCost: component.unitCost ?? 0,
    leadTime: component.leadTime ?? "",
    needsSupplierResearch: component.needsSupplierResearch ?? false,
    supplierResearchNotes: component.supplierResearchNotes ?? "",
    printDesigns: [],
    notes: component.notes
  };
}

export const productCatalog: Product[] = [
  {
    id: "product-so101",
    sku: "SO101",
    name: "SO101 - Brazo robot con gripper",
    shortDescription: "Kit de brazo robot de 6 motores con bases, soportes y gripper impresos en 3D.",
    category: "Robotica educativa",
    basePrice: 24500,
    currency: "MXN",
    unit: "set",
    status: "activo",
    commercialNotes: "Producto de ejemplo para validar orden de venta y lista tecnica de componentes.",
    technicalNotes: "Todas las piezas estructurales se imprimen en 3D. Motores y tornilleria se compran externamente.",
    components: [
      purchasedComponent({
        id: "so101-tornillo-m3x12",
        name: "Tornillo M3x12 cabeza socket",
        type: "tornilleria",
        quantity: 30,
        material: "ACERO INOXIDABLE",
        color: "NEGRO",
        supplierContactMethod: "email",
        supplierCompany: "Tornilleria Industrial MX",
        supplierPartNumber: "M3X12-SOCKET-BLK",
        unitCost: 1.8,
        leadTime: "3 dias",
        notes: "Tornilleria principal para bases, soportes y gripper."
      }),
      purchasedComponent({
        id: "so101-motor-servo-bus",
        name: "Motor servo bus compacto",
        type: "motor",
        quantity: 6,
        material: "METAL",
        color: "NEGRO",
        supplierContactMethod: "externa",
        supplierExternalPlatform: "ALIBABA",
        needsSupplierResearch: true,
        supplierResearchNotes:
          "Compras debe investigar motor servo bus compatible con SO101, torque minimo 12 kg-cm y voltaje 12 V. Revisar Alibaba y proveedor alterno.",
        notes: "Un motor por eje del brazo robot."
      }),
      printedComponent({
        id: "so101-base-motor-3d",
        name: "Base de motor impresa 3D",
        quantity: 8,
        material: "PETG",
        color: "NEGRO",
        fileName: "SO101_BASE_MOTOR_P1S.3mf",
        notes: "Base modular para montar motores y refuerzos del brazo."
      }),
      printedComponent({
        id: "so101-soporte-motor-3d",
        name: "Soporte de motor impreso 3D",
        quantity: 4,
        material: "PETG",
        color: "NEGRO",
        fileName: "SO101_SOPORTE_MOTOR_P1S.3mf",
        notes: "Soporte lateral para alinear motores en articulaciones."
      }),
      printedComponent({
        id: "so101-gripper-palma-3d",
        name: "Gripper palma central impresa 3D",
        quantity: 1,
        material: "PETG",
        color: "NEGRO",
        fileName: "SO101_GRIPPER_PALMA_P1S.3mf",
        notes: "Cuerpo central del gripper."
      }),
      printedComponent({
        id: "so101-gripper-dedo-izq-3d",
        name: "Gripper dedo izquierdo impreso 3D",
        quantity: 1,
        material: "PETG",
        color: "NEGRO",
        fileName: "SO101_GRIPPER_DEDO_IZQUIERDO_P1S.3mf",
        notes: "Dedo izquierdo del mecanismo de agarre."
      }),
      printedComponent({
        id: "so101-gripper-dedo-der-3d",
        name: "Gripper dedo derecho impreso 3D",
        quantity: 1,
        material: "PETG",
        color: "NEGRO",
        fileName: "SO101_GRIPPER_DEDO_DERECHO_P1S.3mf",
        notes: "Dedo derecho del mecanismo de agarre."
      }),
      printedComponent({
        id: "so101-gripper-muneca-3d",
        name: "Gripper placa de muneca impresa 3D",
        quantity: 1,
        material: "PETG",
        color: "NEGRO",
        fileName: "SO101_GRIPPER_MUNECA_P1S.3mf",
        notes: "Interfaz entre gripper y ultimo eje del brazo."
      }),
      printedComponent({
        id: "so101-gripper-separador-3d",
        name: "Gripper separador de cierre impreso 3D",
        quantity: 2,
        material: "PETG",
        color: "NEGRO",
        fileName: "SO101_GRIPPER_SEPARADOR_P1S.3mf",
        notes: "Separadores para mantener la apertura del gripper alineada."
      })
    ]
  }
];
