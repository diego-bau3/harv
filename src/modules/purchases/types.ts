import type { ProductCurrency, ProductUnit } from "../sales/types";

export type SupplierContactMethod = "whatsapp" | "email" | "externa";

export type SupplierStatus = "activo" | "investigacion" | "inactivo";

export type PurchasePriority = "normal" | "alta" | "urgente" | "critica";

export type PurchaseRequestType = "urgente" | "siguiente" | "problema";

export type PurchaseRequestStatus = "pendiente" | "cotizando" | "comprado" | "bloqueado";

export type PurchaseRequestSource = "manual" | "producto" | "almacen" | "work-order";

export type PurchaseOrderStatus =
  | "borrador"
  | "enviada"
  | "confirmada"
  | "por-recibir"
  | "parcial"
  | "pendiente-revision"
  | "recibida"
  | "problema"
  | "cancelada";

export type PurchaseDeliveryMethod = "paqueteria" | "flete-proveedor" | "recoleccion" | "por-definir";

export type PurchasePaymentTerm = "contado" | "credito" | "anticipo" | "por-definir";

export type PurchaseMessageStatus = "pendiente" | "enviado" | "respuesta-recibida";

export type PurchaseReceiptStatus = "por-recibir" | "parcial" | "recibida" | "problema" | "pendiente-revision";

export type PurchaseReceiptIssue = "incompleto" | "danado" | "revision" | "tarde" | "incorrecto" | "otro";

export type PurchaseOrderDocumentType = "cotizacion" | "factura" | "guia" | "comprobante" | "otro";

export type PurchaseOrderHistoryEvent = {
  id: string;
  at: string;
  action: string;
  detail: string;
};

export type PurchaseOrderDocument = {
  id: string;
  fileName: string;
  type: PurchaseOrderDocumentType;
  uploadedAt: string;
};

export type PurchaseSupplier = {
  id: string;
  name: string;
  legalName: string;
  taxId: string;
  category: string;
  sells: string;
  contactName: string;
  whatsapp: string;
  email: string;
  contactMethod: SupplierContactMethod;
  externalPlatform: string;
  country: string;
  city: string;
  currency: ProductCurrency;
  leadTimeDays: number;
  minimumOrder: string;
  paymentTerms: PurchasePaymentTerm;
  status: SupplierStatus;
  notes: string;
};

export type PurchaseRequest = {
  id: string;
  type: PurchaseRequestType;
  source: PurchaseRequestSource;
  sourceRef: string;
  productId: string;
  componentId: string;
  itemName: string;
  productSku: string;
  quantity: number;
  unit: ProductUnit;
  supplierId: string | null;
  requiredDate: string;
  priority: PurchasePriority;
  status: PurchaseRequestStatus;
  reason: string;
  notes: string;
};

export type PurchaseOrderLine = {
  id: string;
  productId: string;
  componentId: string;
  sourceRequestId: string;
  productSku: string;
  itemName: string;
  quantity: number;
  unit: ProductUnit;
  unitCost: number;
  currency: ProductCurrency;
  notes: string;
};

export type PurchaseOrder = {
  id: string;
  folio: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  expectedDate: string;
  status: PurchaseOrderStatus;
  priority: PurchasePriority;
  internalDestination: string;
  deliveryMethod: PurchaseDeliveryMethod;
  paymentTerms: PurchasePaymentTerm;
  currency: ProductCurrency;
  shippingCost: number;
  taxes: number;
  lines: PurchaseOrderLine[];
  notes: string;
  documents: PurchaseOrderDocument[];
  history: PurchaseOrderHistoryEvent[];
};

export type PendingReceiptLine = PurchaseOrderLine & {
  receivedQuantity: number;
  damagedQuantity: number;
  reviewQuantity: number;
  receiptNotes: string;
};

export type PurchaseReceiptLineUpdate = {
  lineId: string;
  receivedQuantity: number;
  damagedQuantity: number;
  reviewQuantity: number;
  receiptNotes: string;
};

export type PendingReceipt = {
  id: string;
  purchaseOrderId: string;
  purchaseOrderFolio: string;
  supplierName: string;
  expectedDate: string;
  internalDestination: string;
  status: PurchaseReceiptStatus;
  receivedAt: string | null;
  issue: PurchaseReceiptIssue | "";
  issueNotes: string;
  lines: PendingReceiptLine[];
};

export type PurchaseMessage = {
  id: string;
  supplierId: string;
  supplierName: string;
  channel: SupplierContactMethod;
  destination: string;
  subject: string;
  body: string;
  relatedFolio: string;
  sentAt: string;
  status: PurchaseMessageStatus;
};
