import type { PurchaseRequest, PurchaseSupplier } from "./types";
import { futureDate } from "./utils";

export const initialSuppliers: PurchaseSupplier[] = [
  {
    id: "supplier-tornilleria-industrial",
    name: "Tornillería Industrial MX",
    legalName: "Tornillería Industrial MX SA de CV",
    taxId: "TIMX010101AA1",
    category: "Tornillería",
    sells: "Tornillos M3, tuercas, rondanas, insertos y fijaciones métricas.",
    contactName: "Mariana López",
    whatsapp: "+52 81 5555 0101",
    email: "ventas@tornilleriaindustrial.example",
    contactMethod: "email",
    externalPlatform: "",
    country: "México",
    city: "Monterrey",
    currency: "MXN",
    leadTimeDays: 3,
    minimumOrder: "100 piezas",
    paymentTerms: "credito",
    status: "activo",
    notes: "Proveedor sugerido para tornillería estándar de prototipos y producción corta."
  }
];

export const initialPurchaseRequests: PurchaseRequest[] = [
  {
    id: "request-so101-tornillos",
    type: "siguiente",
    source: "manual",
    sourceRef: "manual:so101-tornillos",
    productId: "product-so101",
    componentId: "so101-tornillo-m3x12",
    itemName: "Tornillo M3x12 cabeza socket",
    productSku: "SO101",
    quantity: 30,
    unit: "pieza",
    supplierId: "supplier-tornilleria-industrial",
    requiredDate: futureDate(14),
    priority: "normal",
    status: "pendiente",
    reason: "Reposición para kits SO101 siguientes.",
    notes: "Comprar lote de prueba antes de pasar a volumen."
  }
];
