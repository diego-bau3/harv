import type {
  PurchaseDeliveryMethod,
  PurchaseMessageStatus,
  PurchaseOrder,
  PurchaseOrderDocumentType,
  PurchaseOrderStatus,
  PurchasePaymentTerm,
  PurchasePriority,
  PurchaseReceiptIssue,
  PurchaseReceiptStatus,
  PurchaseRequestStatus,
  PurchaseRequestType,
  SupplierContactMethod,
  SupplierStatus
} from "./types";

export const supplierContactMethodLabels: Record<SupplierContactMethod, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  externa: "Externa"
};

export const supplierStatusLabels: Record<SupplierStatus, string> = {
  activo: "Activo",
  investigacion: "Investigación",
  inactivo: "Inactivo"
};

export const purchasePriorityLabels: Record<PurchasePriority, string> = {
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
  critica: "Crítica"
};

export const purchaseRequestTypeLabels: Record<PurchaseRequestType, string> = {
  urgente: "Compras urgentes",
  siguiente: "Compras siguientes",
  problema: "Por resolver"
};

export const purchaseRequestStatusLabels: Record<PurchaseRequestStatus, string> = {
  pendiente: "Pendiente",
  cotizando: "Cotizando",
  comprado: "Comprado",
  bloqueado: "Bloqueado"
};

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  confirmada: "Confirmada",
  "por-recibir": "Por recibir",
  parcial: "Parcial",
  "pendiente-revision": "Pendiente revisión",
  recibida: "Recibida",
  problema: "Problema",
  cancelada: "Cancelada"
};

export const purchaseDeliveryMethodLabels: Record<PurchaseDeliveryMethod, string> = {
  paqueteria: "Paquetería",
  "flete-proveedor": "Flete proveedor",
  recoleccion: "Recolección",
  "por-definir": "Por definir"
};

export const purchasePaymentTermLabels: Record<PurchasePaymentTerm, string> = {
  contado: "Contado",
  credito: "Crédito",
  anticipo: "Anticipo",
  "por-definir": "Por definir"
};

export const purchaseMessageStatusLabels: Record<PurchaseMessageStatus, string> = {
  pendiente: "Pendiente",
  enviado: "Enviado",
  "respuesta-recibida": "Respuesta recibida"
};

export const pendingReceiptStatusLabels: Record<PurchaseReceiptStatus, string> = {
  "por-recibir": "Por recibir",
  parcial: "Parcial",
  recibida: "Recibida",
  problema: "Problema",
  "pendiente-revision": "Pendiente revisión"
};

export const purchaseReceiptIssueLabels: Record<PurchaseReceiptIssue, string> = {
  incompleto: "Incompleto",
  danado: "Dañado",
  revision: "Pendiente revisión",
  tarde: "Tarde",
  incorrecto: "Incorrecto",
  otro: "Otro"
};

export const purchaseOrderDocumentTypeLabels: Record<PurchaseOrderDocumentType, string> = {
  cotizacion: "Cotización supplier",
  factura: "Factura",
  guia: "Guía",
  comprobante: "Comprobante",
  otro: "Otro"
};

export function purchaseId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createPurchaseOrderFolio() {
  return `HV-COM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function purchaseOrderSubtotal(order: Pick<PurchaseOrder, "lines">) {
  return order.lines.reduce((total, line) => total + line.quantity * line.unitCost, 0);
}

export function purchaseOrderTotal(order: Pick<PurchaseOrder, "lines" | "shippingCost" | "taxes">) {
  return purchaseOrderSubtotal(order) + order.shippingCost + order.taxes;
}
