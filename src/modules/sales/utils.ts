import type {
  Client,
  ClientStatus,
  DocumentType,
  OrderLine,
  OrderStatus,
  PaymentMethod,
  PaymentTerm,
  Priority,
  Product,
  ProductComponentProcess,
  ProductComponentStatus,
  ProductComponentType,
  SalesOrder,
  SalesUser
} from "./types";

export const clientStatusLabels: Record<ClientStatus, string> = {
  activo: "Activo",
  incompleto: "Incompleto",
  bloqueado: "Bloqueado",
  inactivo: "Inactivo"
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  borrador: "Borrador",
  "pendiente-informacion": "Pendiente de información",
  "pendiente-producto": "Pendiente de producto",
  "pendiente-pago": "Pendiente de pago",
  "pendiente-credito": "Pendiente de crédito",
  "aprobada-comercialmente": "Aprobada comercialmente",
  cancelada: "Cancelada"
};

export const paymentTermLabels: Record<PaymentTerm, string> = {
  contado: "Contado",
  credito: "Crédito",
  anticipo: "Anticipo",
  pendiente: "Pendiente por definir"
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  credito: "Crédito",
  "por-definir": "Por definir"
};

export const priorityLabels: Record<Priority, string> = {
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
  critica: "Crítica"
};

export const documentTypeLabels: Record<DocumentType, string> = {
  "orden-compra-cliente": "Orden de compra del cliente",
  "comprobante-pago": "Comprobante de pago",
  "documento-fiscal": "Documento fiscal",
  "cotizacion-firmada": "Cotización firmada",
  otro: "Otro"
};

export const productStatusLabels: Record<Product["status"], string> = {
  borrador: "Borrador",
  activo: "Activo",
  revision: "En revisión",
  inactivo: "Inactivo"
};

export const productUnitLabels: Record<Product["unit"], string> = {
  pieza: "Pieza",
  metro: "Metro",
  kg: "Kg",
  set: "Set"
};

export const componentTypeLabels: Record<ProductComponentType, string> = {
  "pieza-impresa-3d": "Pieza impresa 3D",
  "pieza-fabricada": "Pieza fabricada",
  tornilleria: "Tornillería",
  motor: "Motor",
  cableado: "Cableado",
  electronico: "Electrónico",
  empaque: "Empaque",
  comprado: "Comprado",
  "servicio-externo": "Servicio externo",
  otro: "Otro"
};

export const componentProcessLabels: Record<ProductComponentProcess, string> = {
  "impresion-3d": "Impresión 3D",
  comprado: "Comprado",
  fabricado: "Fabricado",
  ensamblado: "Ensamblado",
  cableado: "Cableado",
  "servicio-externo": "Servicio externo",
  pendiente: "Pendiente"
};

export const componentStatusLabels: Record<ProductComponentStatus, string> = {
  pendiente: "Pendiente",
  revision: "En revisión",
  aprobado: "Aprobado"
};

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function calculateClientStatus(client: Omit<Client, "id" | "status">, currentStatus?: ClientStatus) {
  if (currentStatus === "bloqueado" || currentStatus === "inactivo") {
    return currentStatus;
  }

  const requiredFields = [
    client.commercialName,
    client.legalName,
    client.taxId,
    client.contactName,
    client.email,
    client.phone,
    client.fiscalAddress,
    client.shippingAddress,
    client.paymentTerm === "pendiente" ? "" : client.paymentTerm
  ];

  return requiredFields.every((field) => field.trim().length > 0) ? "activo" : "incompleto";
}

export function clientMatches(client: Client, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    client.commercialName,
    client.legalName,
    client.taxId,
    client.email,
    client.phone
  ].some((field) => field.toLowerCase().includes(normalizedQuery));
}

export function productMatches(product: Product, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const searchableFields = [
    product.name,
    product.sku,
    product.category,
    product.shortDescription,
    ...product.components.flatMap((component) => [
      component.name,
      component.material,
      component.supplierCompany,
      component.supplierPartNumber
    ])
  ];

  return searchableFields.some((field) => field.toLowerCase().includes(normalizedQuery));
}

export function lineSubtotal(line: OrderLine) {
  const rawSubtotal = line.quantity * line.unitPrice;
  return Math.max(rawSubtotal - line.discount, 0);
}

export function orderTotals(lines: OrderLine[]) {
  const subtotal = lines.reduce((total, line) => total + lineSubtotal(line), 0);
  const taxes = subtotal * 0.16;

  return {
    subtotal,
    taxes,
    total: subtotal + taxes
  };
}

export function isValidLine(line: OrderLine) {
  if (line.product.status !== "activo" || line.quantity <= 0) {
    return false;
  }

  if (line.product.unit === "pieza" && !Number.isInteger(line.quantity)) {
    return false;
  }

  return true;
}

export function createInitialOrder(user: SalesUser): SalesOrder {
  const createdAt = new Date().toISOString();
  const folio = `HV-V-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    folio,
    seller: user.name,
    createdAt,
    status: "borrador",
    commercialStatus: "captura",
    selectedClientId: null,
    lines: [],
    requiredDate: "",
    priority: "normal",
    priorityReason: "",
    internalNotes: "",
    paymentTerm: "pendiente",
    paymentMethod: "por-definir",
    paymentLink: "",
    paymentVerifiedBy: null,
    paymentVerifiedAt: null,
    creditReviewedBy: null,
    creditReviewedAt: null,
    documents: [],
    history: []
  };
}

export type ChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
};

export function evaluateOrder(order: SalesOrder, client: Client | undefined) {
  const selectedClient = Boolean(client);
  const clientIsActive = client?.status === "activo";
  const clientComplete = client ? client.status !== "incompleto" : false;
  const hasValidProduct = order.lines.length > 0 && order.lines.every(isValidLine);
  const requiredDateOk = Boolean(order.requiredDate) && order.requiredDate >= todayIso();
  const priorityOk = Boolean(order.priority);
  const priorityReasonOk =
    order.priority !== "urgente" && order.priority !== "critica"
      ? true
      : order.priorityReason.trim().length > 0;
  const paymentTermOk = order.paymentTerm !== "pendiente";
  const paymentMethodOk = order.paymentMethod !== "por-definir";
  const paymentOk =
    order.paymentTerm === "contado" || order.paymentTerm === "anticipo"
      ? order.commercialStatus === "pago-verificado"
      : true;
  const creditOk = order.paymentTerm === "credito" ? order.commercialStatus === "credito-aprobado" : true;

  const checklist: ChecklistItem[] = [
    { id: "client-selected", label: "Cliente seleccionado", passed: selectedClient },
    { id: "client-active", label: "Cliente activo", passed: clientIsActive },
    { id: "client-complete", label: "Datos obligatorios del cliente completos", passed: clientComplete },
    { id: "product", label: "Al menos un producto activo seleccionado", passed: hasValidProduct },
    { id: "quantity", label: "Cantidades válidas en todas las líneas", passed: order.lines.every(isValidLine) && order.lines.length > 0 },
    { id: "date", label: "Fecha requerida capturada y vigente", passed: requiredDateOk },
    { id: "priority", label: "Prioridad definida", passed: priorityOk },
    { id: "priority-reason", label: "Motivo de prioridad cuando aplica", passed: priorityReasonOk },
    { id: "payment-term", label: "Condición de pago definida", passed: paymentTermOk },
    { id: "payment-method", label: "Método de pago definido", passed: paymentMethodOk },
    { id: "payment-credit", label: "Pago o crédito aprobado si aplica", passed: paymentOk && creditOk }
  ];

  return {
    checklist,
    canApprove: checklist.every((item) => item.passed) && order.status !== "cancelada"
  };
}
