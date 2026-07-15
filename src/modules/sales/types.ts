export type ClientStatus = "activo" | "incompleto" | "bloqueado" | "inactivo";

export type PaymentTerm = "contado" | "credito" | "anticipo" | "pendiente";

export type PaymentMethod = "transferencia" | "tarjeta" | "efectivo" | "credito" | "por-definir";

export type ProductStatus = "borrador" | "activo" | "inactivo";

export type ProductUnit = "pieza" | "metro" | "kg" | "set";

export type ProductCurrency = "MXN" | "USD" | "EUR";

export type ProductComponentType =
  | "pieza-impresa-3d"
  | "pieza-fabricada"
  | "tornilleria"
  | "motor"
  | "cableado"
  | "electronico"
  | "empaque"
  | "comprado"
  | "servicio-externo"
  | "otro";

export type ProductComponentProcess =
  | "impresion-3d"
  | "comprado"
  | "fabricado"
  | "ensamblado"
  | "cableado"
  | "servicio-externo"
  | "pendiente";

export type Priority = "normal" | "alta" | "urgente" | "critica";

export type OrderStatus =
  | "borrador"
  | "pendiente-informacion"
  | "pendiente-producto"
  | "pendiente-pago"
  | "pendiente-credito"
  | "aprobada-comercialmente"
  | "cancelada";

export type CommercialStatus =
  | "captura"
  | "pendiente-pago"
  | "pago-verificado"
  | "pendiente-credito"
  | "credito-aprobado"
  | "credito-rechazado";

export type DocumentType =
  | "orden-compra-cliente"
  | "comprobante-pago"
  | "documento-fiscal"
  | "cotizacion-firmada"
  | "otro";

export type Client = {
  id: string;
  commercialName: string;
  legalName: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  fiscalAddress: string;
  shippingAddress: string;
  paymentTerm: PaymentTerm;
  notes: string;
  status: ClientStatus;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  shortDescription: string;
  category: string;
  basePrice: number;
  currency: ProductCurrency;
  unit: ProductUnit;
  status: ProductStatus;
  commercialNotes: string;
  technicalNotes: string;
  components: ProductComponent[];
};

export type ProductComponent = {
  id: string;
  name: string;
  type: ProductComponentType;
  quantity: number;
  unit: ProductUnit;
  process: ProductComponentProcess;
  material: string;
  color: string;
  supplierCompany: string;
  supplierContact: string;
  supplierEmail: string;
  supplierPhone: string;
  supplierPartNumber: string;
  unitCost: number;
  leadTime: string;
  minimumPurchaseQuantity: string;
  referenceLink: string;
  needsSupplierResearch: boolean;
  supplierResearchNotes: string;
  printDesigns: ProductPrintDesign[];
  notes: string;
};

export type ProductPrintDesign = {
  id: string;
  printer: string;
  fileName: string;
  notes: string;
};

export type OrderLine = {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  notes: string;
};

export type SalesDocument = {
  id: string;
  fileName: string;
  type: DocumentType;
  uploadedAt: string;
};

export type HistoryEvent = {
  id: string;
  user: string;
  at: string;
  action: string;
  detail: string;
};

export type SalesOrder = {
  folio: string;
  seller: string;
  createdAt: string;
  status: OrderStatus;
  commercialStatus: CommercialStatus;
  selectedClientId: string | null;
  lines: OrderLine[];
  requiredDate: string;
  priority: Priority;
  priorityReason: string;
  internalNotes: string;
  paymentTerm: PaymentTerm;
  paymentMethod: PaymentMethod;
  paymentLink: string;
  paymentVerifiedBy: string | null;
  paymentVerifiedAt: string | null;
  creditReviewedBy: string | null;
  creditReviewedAt: string | null;
  documents: SalesDocument[];
  history: HistoryEvent[];
};

export type SalesUser = {
  name: string;
  permissions: {
    verifyPayment: boolean;
    approveCredit: boolean;
    approveCommercial: boolean;
    cancelOrder: boolean;
  };
};
