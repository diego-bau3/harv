import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Plus,
  Send,
  ShoppingCart,
  Truck
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { Product, ProductCurrency, ProductUnit } from "../../sales/types";
import { formatCurrency, productUnitLabels } from "../../sales/utils";
import type {
  PendingReceipt,
  PurchaseDeliveryMethod,
  PurchaseMessage,
  PurchaseOrder,
  PurchaseOrderDocument,
  PurchaseOrderDocumentType,
  PurchaseOrderLine,
  PurchasePaymentTerm,
  PurchasePriority,
  PurchaseRequest,
  PurchaseRequestType,
  PurchaseSupplier,
  SupplierContactMethod
} from "../types";
import {
  createPurchaseOrderFolio,
  futureDate,
  pendingReceiptStatusLabels,
  purchaseDeliveryMethodLabels,
  purchaseId,
  purchaseMessageStatusLabels,
  purchaseOrderDocumentTypeLabels,
  purchaseOrderStatusLabels,
  purchaseOrderTotal,
  purchasePaymentTermLabels,
  purchasePriorityLabels,
  purchaseRequestStatusLabels,
  purchaseRequestTypeLabels,
  supplierContactMethodLabels,
  supplierStatusLabels
} from "../utils";

type PurchasesViewProps = {
  onBack: () => void;
  products: Product[];
  suppliers: PurchaseSupplier[];
  requests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  pendingReceipts: PendingReceipt[];
  messages: PurchaseMessage[];
  onAddSupplier: (supplier: PurchaseSupplier) => void;
  onResolveRequestSupplier: (requestId: string, supplier: PurchaseSupplier) => void;
  onCreatePurchaseOrder: (purchaseOrder: PurchaseOrder, pendingReceipt: PendingReceipt) => void;
  onAddPurchaseOrderDocument: (orderId: string, document: PurchaseOrderDocument) => void;
  onAddMessage: (message: PurchaseMessage) => void;
};

type PurchaseTab = "urgentes" | "siguientes" | "resolver" | "ordenes" | "suppliers" | "chat";

type SupplierDraft = Omit<PurchaseSupplier, "id">;

type OrderDraft = {
  supplierId: string;
  expectedDate: string;
  priority: PurchasePriority;
  internalDestination: string;
  deliveryMethod: PurchaseDeliveryMethod;
  paymentTerms: PurchasePaymentTerm;
  currency: ProductCurrency;
  shippingCost: number;
  taxes: number;
  notes: string;
};

type LineDraft = {
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

type MessageDraft = {
  supplierId: string;
  channel: SupplierContactMethod;
  destination: string;
  subject: string;
  body: string;
  relatedFolio: string;
};

type DocumentDraft = {
  fileName: string;
  type: PurchaseOrderDocumentType;
};

const emptySupplierDraft: SupplierDraft = {
  name: "",
  legalName: "",
  taxId: "",
  category: "",
  sells: "",
  contactName: "",
  whatsapp: "",
  email: "",
  contactMethod: "whatsapp",
  externalPlatform: "",
  country: "México",
  city: "",
  currency: "MXN",
  leadTimeDays: 0,
  minimumOrder: "",
  paymentTerms: "por-definir",
  status: "investigacion",
  notes: ""
};

const emptyOrderDraft: OrderDraft = {
  supplierId: "",
  expectedDate: futureDate(7),
  priority: "normal",
  internalDestination: "Recepción principal",
  deliveryMethod: "por-definir",
  paymentTerms: "por-definir",
  currency: "MXN",
  shippingCost: 0,
  taxes: 0,
  notes: ""
};

const emptyLineDraft: LineDraft = {
  productId: "",
  componentId: "",
  sourceRequestId: "",
  productSku: "",
  itemName: "",
  quantity: 1,
  unit: "pieza",
  unitCost: 0,
  currency: "MXN",
  notes: ""
};

const emptyMessageDraft: MessageDraft = {
  supplierId: "",
  channel: "whatsapp",
  destination: "",
  subject: "",
  body: "",
  relatedFolio: ""
};

const emptyDocumentDraft: DocumentDraft = {
  fileName: "",
  type: "cotizacion"
};

export function PurchasesView({
  messages,
  pendingReceipts,
  products,
  purchaseOrders,
  requests,
  suppliers,
  onAddMessage,
  onAddPurchaseOrderDocument,
  onAddSupplier,
  onBack,
  onCreatePurchaseOrder,
  onResolveRequestSupplier
}: PurchasesViewProps) {
  const [activeTab, setActiveTab] = useState<PurchaseTab>("urgentes");
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>(emptySupplierDraft);
  const [orderDraft, setOrderDraft] = useState<OrderDraft>(emptyOrderDraft);
  const [lineDraft, setLineDraft] = useState<LineDraft>(emptyLineDraft);
  const [orderLines, setOrderLines] = useState<PurchaseOrderLine[]>([]);
  const [messageDraft, setMessageDraft] = useState<MessageDraft>(emptyMessageDraft);
  const [documentDrafts, setDocumentDrafts] = useState<Record<string, DocumentDraft>>({});
  const [pendingSupplierRequestId, setPendingSupplierRequestId] = useState("");
  const [requestSupplierSelections, setRequestSupplierSelections] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const selectedLineProduct = useMemo(
    () => products.find((product) => product.id === lineDraft.productId),
    [lineDraft.productId, products]
  );

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === orderDraft.supplierId),
    [orderDraft.supplierId, suppliers]
  );

  const pendingSupplierRequest = useMemo(
    () => requests.find((request) => request.id === pendingSupplierRequestId),
    [pendingSupplierRequestId, requests]
  );

  const orderPreview: Pick<PurchaseOrder, "lines" | "shippingCost" | "taxes"> = {
    lines: orderLines,
    shippingCost: orderDraft.shippingCost,
    taxes: orderDraft.taxes
  };

  const activeRequests = requests.filter((request) => request.status !== "comprado");
  const urgentCount = activeRequests.filter((request) => request.type === "urgente").length;
  const nextCount = activeRequests.filter((request) => request.type === "siguiente").length;
  const problemCount = activeRequests.filter((request) => request.type === "problema").length;
  const pendingReceiptCount = pendingReceipts.filter((receipt) => receipt.status === "por-recibir").length;

  function updateSupplierField<Key extends keyof SupplierDraft>(key: Key, value: SupplierDraft[Key]) {
    setSupplierDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function updateOrderField<Key extends keyof OrderDraft>(key: Key, value: OrderDraft[Key]) {
    setOrderDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function updateLineField<Key extends keyof LineDraft>(key: Key, value: LineDraft[Key]) {
    setLineDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function updateMessageField<Key extends keyof MessageDraft>(key: Key, value: MessageDraft[Key]) {
    setMessageDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function documentDraftFor(orderId: string) {
    return documentDrafts[orderId] ?? emptyDocumentDraft;
  }

  function updateDocumentDraft<Key extends keyof DocumentDraft>(
    orderId: string,
    key: Key,
    value: DocumentDraft[Key]
  ) {
    setDocumentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [orderId]: {
        ...(currentDrafts[orderId] ?? emptyDocumentDraft),
        [key]: value
      }
    }));
  }

  function addDocumentToOrder(orderId: string) {
    const documentDraft = documentDraftFor(orderId);

    if (!documentDraft.fileName.trim()) {
      setFormError("Agrega nombre o referencia del documento.");
      return;
    }

    onAddPurchaseOrderDocument(orderId, {
      id: purchaseId("po-doc"),
      fileName: documentDraft.fileName.trim(),
      type: documentDraft.type,
      uploadedAt: new Date().toISOString()
    });
    setDocumentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [orderId]: emptyDocumentDraft
    }));
    setFormError("");
  }

  function selectLineProduct(productId: string) {
    const product = products.find((currentProduct) => currentProduct.id === productId);

    setLineDraft((currentDraft) => ({
      ...currentDraft,
      productId,
      componentId: "",
      sourceRequestId: "",
      productSku: product?.sku ?? "",
      itemName: product?.name ?? "",
      quantity: 1,
      unit: product?.unit ?? "pieza",
      currency: product?.currency ?? currentDraft.currency
    }));
  }

  function selectLineComponent(componentId: string) {
    const component = selectedLineProduct?.components.find((currentComponent) => currentComponent.id === componentId);

    setLineDraft((currentDraft) => ({
      ...currentDraft,
      componentId,
      sourceRequestId: "",
      itemName: component?.name ?? currentDraft.itemName,
      quantity: component?.quantity ?? currentDraft.quantity,
      unit: component?.unit ?? currentDraft.unit,
      unitCost: component?.unitCost ?? currentDraft.unitCost
    }));
  }

  function addSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supplierDraft.name.trim() || !supplierDraft.sells.trim()) {
      setFormError("Agrega nombre del supplier y qué vende.");
      return;
    }

    const savedSupplier: PurchaseSupplier = {
      ...supplierDraft,
      id: purchaseId("supplier")
    };

    onAddSupplier(savedSupplier);
    if (pendingSupplierRequestId) {
      onResolveRequestSupplier(pendingSupplierRequestId, savedSupplier);
      setPendingSupplierRequestId("");
      setActiveTab("resolver");
    }
    setSupplierDraft(emptySupplierDraft);
    setFormError("");
  }

  function addOrderLine() {
    if (!lineDraft.itemName.trim() || lineDraft.quantity <= 0) {
      setFormError("Agrega producto/componente y cantidad válida para la línea de compra.");
      return;
    }

    const nextLine: PurchaseOrderLine = {
      id: purchaseId("po-line"),
      productId: lineDraft.productId,
      componentId: lineDraft.componentId,
      sourceRequestId: lineDraft.sourceRequestId,
      productSku: lineDraft.productSku,
      itemName: lineDraft.itemName,
      quantity: lineDraft.quantity,
      unit: lineDraft.unit,
      unitCost: lineDraft.unitCost,
      currency: lineDraft.currency,
      notes: lineDraft.notes
    };

    setOrderLines((currentLines) => [...currentLines, nextLine]);
    setLineDraft(emptyLineDraft);
    setFormError("");
  }

  function removeOrderLine(lineId: string) {
    setOrderLines((currentLines) => currentLines.filter((line) => line.id !== lineId));
  }

  function generatePurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSupplier) {
      setFormError("Selecciona un supplier para generar la orden de compra.");
      return;
    }

    if (orderLines.length === 0) {
      setFormError("Agrega al menos una línea a la orden de compra.");
      return;
    }

    if (!orderDraft.expectedDate || !orderDraft.internalDestination.trim()) {
      setFormError("Agrega fecha esperada y destino interno.");
      return;
    }

    const createdAt = new Date().toISOString();
    const orderId = purchaseId("purchase-order");
    const folio = createPurchaseOrderFolio();
    const purchaseOrder: PurchaseOrder = {
      id: orderId,
      folio,
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      createdAt,
      expectedDate: orderDraft.expectedDate,
      status: "por-recibir",
      priority: orderDraft.priority,
      internalDestination: orderDraft.internalDestination,
      deliveryMethod: orderDraft.deliveryMethod,
      paymentTerms: orderDraft.paymentTerms,
      currency: orderDraft.currency,
      shippingCost: orderDraft.shippingCost,
      taxes: orderDraft.taxes,
      lines: orderLines,
      notes: orderDraft.notes,
      documents: [],
      history: [
        {
          id: purchaseId("po-history"),
          at: createdAt,
          action: "Orden creada",
          detail: `Se generó ${folio} para ${selectedSupplier.name}.`
        }
      ]
    };

    const pendingReceipt: PendingReceipt = {
      id: purchaseId("receipt"),
      purchaseOrderId: orderId,
      purchaseOrderFolio: folio,
      supplierName: selectedSupplier.name,
      expectedDate: orderDraft.expectedDate,
      internalDestination: orderDraft.internalDestination,
      status: "por-recibir",
      receivedAt: null,
      issue: "",
      issueNotes: "",
      lines: orderLines.map((line) => ({
        ...line,
        receivedQuantity: 0,
        damagedQuantity: 0,
        reviewQuantity: 0,
        receiptNotes: ""
      }))
    };

    onCreatePurchaseOrder(purchaseOrder, pendingReceipt);
    setOrderDraft(emptyOrderDraft);
    setOrderLines([]);
    setFormError("");
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supplier = suppliers.find((currentSupplier) => currentSupplier.id === messageDraft.supplierId);

    if (!supplier || !messageDraft.body.trim()) {
      setFormError("Selecciona supplier y escribe el mensaje.");
      return;
    }

    const message: PurchaseMessage = {
      id: purchaseId("purchase-message"),
      supplierId: supplier.id,
      supplierName: supplier.name,
      channel: messageDraft.channel,
      destination: messageDraft.destination || supplier.email || supplier.whatsapp || supplier.externalPlatform,
      subject: messageDraft.subject,
      body: messageDraft.body,
      relatedFolio: messageDraft.relatedFolio,
      sentAt: new Date().toISOString(),
      status: "enviado"
    };

    onAddMessage(message);
    setMessageDraft(emptyMessageDraft);
    setFormError("");
  }

  function startSupplierFromRequest(request: PurchaseRequest) {
    setPendingSupplierRequestId(request.id);
    setSupplierDraft({
      ...emptySupplierDraft,
      category: request.itemName,
      sells: `${request.itemName} para ${request.productSku || "producto sin SKU"}`,
      notes: request.notes
    });
    setActiveTab("suppliers");
    setFormError("");
  }

  function assignExistingSupplier(request: PurchaseRequest) {
    const supplierId = requestSupplierSelections[request.id];
    const supplier = suppliers.find((currentSupplier) => currentSupplier.id === supplierId);

    if (!supplier) {
      setFormError("Selecciona un supplier para resolver esta necesidad.");
      return;
    }

    onResolveRequestSupplier(request.id, supplier);
    setRequestSupplierSelections((currentSelections) => ({ ...currentSelections, [request.id]: "" }));
    setFormError("");
  }

  function startOrderFromRequest(request: PurchaseRequest) {
    if (!request.supplierId) {
      setFormError("Primero asigna o crea un supplier para esta necesidad.");
      return;
    }

    const supplier = suppliers.find((currentSupplier) => currentSupplier.id === request.supplierId);
    const product = products.find((currentProduct) => currentProduct.id === request.productId);
    const component = product?.components.find((currentComponent) => currentComponent.id === request.componentId);
    const nextLine: PurchaseOrderLine = {
      id: purchaseId("po-line"),
      productId: request.productId,
      componentId: request.componentId,
      sourceRequestId: request.id,
      productSku: request.productSku,
      itemName: request.itemName,
      quantity: request.quantity,
      unit: request.unit,
      unitCost: component?.unitCost ?? 0,
      currency: supplier?.currency ?? product?.currency ?? "MXN",
      notes: request.notes
    };

    setOrderDraft((currentDraft) => ({
      ...currentDraft,
      supplierId: request.supplierId ?? "",
      expectedDate: request.requiredDate,
      priority: request.priority,
      currency: supplier?.currency ?? currentDraft.currency,
      notes: `Generada desde ${purchaseRequestTypeLabels[request.type].toLowerCase()}: ${request.itemName}`
    }));
    setOrderLines((currentLines) => [...currentLines, nextLine]);
    setActiveTab("ordenes");
    setFormError("");
  }

  function renderRequestList(type: PurchaseRequestType) {
    const filteredRequests = activeRequests.filter((request) => request.type === type);

    return (
      <div className="purchase-card-list">
        {filteredRequests.map((request) => {
          const supplier = suppliers.find((currentSupplier) => currentSupplier.id === request.supplierId);
          const sourceLabel =
            request.source === "producto"
              ? "Desde Productos"
              : request.source === "almacen"
                ? "Desde Almacén"
                : request.source === "work-order"
                  ? "Desde Work Order"
                  : "Manual";

          return (
            <article className="purchase-request-row" key={request.id}>
              <div>
                <span>{request.productSku || "Sin producto"} · {sourceLabel}</span>
                <strong>{request.itemName}</strong>
                <p>{request.reason}</p>
                {request.notes ? <p>{request.notes}</p> : null}
              </div>
              <div>
                <span>Cantidad</span>
                <strong>
                  {request.quantity} {productUnitLabels[request.unit].toLowerCase()}
                </strong>
              </div>
              <div>
                <span>Fecha límite</span>
                <strong>{request.requiredDate}</strong>
              </div>
              <div>
                <span>Supplier</span>
                <strong>{supplier?.name || "Sin supplier"}</strong>
              </div>
              <span className={`purchase-pill priority-${request.priority}`}>{purchasePriorityLabels[request.priority]}</span>
              <span className={`purchase-pill status-${request.status}`}>{purchaseRequestStatusLabels[request.status]}</span>
              <div className="purchase-request-actions">
                {request.supplierId ? (
                  <button className="secondary-button compact-button" onClick={() => startOrderFromRequest(request)} type="button">
                    Generar compra
                  </button>
                ) : (
                  <>
                    <select
                      aria-label={`Supplier para ${request.itemName}`}
                      value={requestSupplierSelections[request.id] ?? ""}
                      onChange={(event) =>
                        setRequestSupplierSelections((currentSelections) => ({
                          ...currentSelections,
                          [request.id]: event.target.value
                        }))
                      }
                    >
                      <option value="">Asignar supplier</option>
                      {suppliers.map((currentSupplier) => (
                        <option key={currentSupplier.id} value={currentSupplier.id}>
                          {currentSupplier.name}
                        </option>
                      ))}
                    </select>
                    <button className="secondary-button compact-button" onClick={() => assignExistingSupplier(request)} type="button">
                      Asignar
                    </button>
                    <button className="primary-button compact-button" onClick={() => startSupplierFromRequest(request)} type="button">
                      Crear supplier
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}

        {filteredRequests.length === 0 ? <p className="empty-state">No hay registros en {purchaseRequestTypeLabels[type].toLowerCase()}.</p> : null}
      </div>
    );
  }

  return (
    <main className="purchases-view">
      <header className="sales-topbar purchases-topbar">
        <button className="icon-button" onClick={onBack} type="button" aria-label="Regresar a perfiles">
          <ArrowLeft size={22} />
        </button>
        <div className="sales-title">
          <span>Compras</span>
          <h1>Centro de compras</h1>
        </div>
      </header>

      <section className="purchases-workspace">
        <section className="purchase-summary-grid" aria-label="Resumen de compras">
          <button className="purchase-summary-card urgent" onClick={() => setActiveTab("urgentes")} type="button">
            <AlertTriangle size={18} />
            <span>Urgentes</span>
            <strong>{urgentCount}</strong>
          </button>
          <button className="purchase-summary-card next" onClick={() => setActiveTab("siguientes")} type="button">
            <CalendarDays size={18} />
            <span>Siguientes</span>
            <strong>{nextCount}</strong>
          </button>
          <button className="purchase-summary-card problem" onClick={() => setActiveTab("resolver")} type="button">
            <ClipboardList size={18} />
            <span>Por resolver</span>
            <strong>{problemCount}</strong>
          </button>
          <button className="purchase-summary-card receiving" onClick={() => setActiveTab("ordenes")} type="button">
            <Truck size={18} />
            <span>Por recibir</span>
            <strong>{pendingReceiptCount}</strong>
          </button>
          <button className="purchase-summary-card suppliers" onClick={() => setActiveTab("suppliers")} type="button">
            <Building2 size={18} />
            <span>Suppliers</span>
            <strong>{suppliers.length}</strong>
          </button>
        </section>

        <nav className="purchase-tabs" aria-label="Secciones de compras">
          <button className={activeTab === "urgentes" ? "active" : ""} onClick={() => setActiveTab("urgentes")} type="button">
            Urgentes
          </button>
          <button className={activeTab === "siguientes" ? "active" : ""} onClick={() => setActiveTab("siguientes")} type="button">
            Siguientes
          </button>
          <button className={activeTab === "resolver" ? "active" : ""} onClick={() => setActiveTab("resolver")} type="button">
            Problemas
          </button>
          <button className={activeTab === "ordenes" ? "active" : ""} onClick={() => setActiveTab("ordenes")} type="button">
            Órdenes
          </button>
          <button className={activeTab === "suppliers" ? "active" : ""} onClick={() => setActiveTab("suppliers")} type="button">
            Suppliers
          </button>
          <button className={activeTab === "chat" ? "active" : ""} onClick={() => setActiveTab("chat")} type="button">
            Chat
          </button>
        </nav>

        {formError ? (
          <div className="form-error-list" role="alert">
            <span>{formError}</span>
          </div>
        ) : null}

        {activeTab === "urgentes" ? (
          <section className="purchase-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Compras urgentes</h2>
                <p>Materiales que pueden bloquear ensamble, producción o entrega.</p>
              </div>
            </div>
            {renderRequestList("urgente")}
          </section>
        ) : null}

        {activeTab === "siguientes" ? (
          <section className="purchase-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Compras siguientes</h2>
                <p>Compras planeadas para reposición, prototipos o siguientes órdenes.</p>
              </div>
            </div>
            {renderRequestList("siguiente")}
          </section>
        ) : null}

        {activeTab === "resolver" ? (
          <section className="purchase-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Problemas por resolver</h2>
                <p>Faltantes, proveedores sin confirmar, atrasos y bloqueos de compra.</p>
              </div>
            </div>
            {renderRequestList("problema")}
          </section>
        ) : null}

        {activeTab === "ordenes" ? (
          <section className="purchase-grid">
            <article className="purchase-panel">
              <div className="clean-section-heading">
                <div>
                  <h2>Generar orden de compra</h2>
                  <p>Registra supplier, producto, cantidades, costos y fecha esperada.</p>
                </div>
              </div>

              <form className="purchase-form" onSubmit={generatePurchaseOrder}>
                <div className="form-grid three-columns">
                  <label className="field">
                    <span>Supplier</span>
                    <select value={orderDraft.supplierId} onChange={(event) => updateOrderField("supplierId", event.target.value)}>
                      <option value="">Selecciona supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Fecha esperada</span>
                    <input type="date" value={orderDraft.expectedDate} onChange={(event) => updateOrderField("expectedDate", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Prioridad</span>
                    <select value={orderDraft.priority} onChange={(event) => updateOrderField("priority", event.target.value as PurchasePriority)}>
                      {Object.entries(purchasePriorityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Destino interno</span>
                    <input value={orderDraft.internalDestination} onChange={(event) => updateOrderField("internalDestination", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Método de entrega</span>
                    <select
                      value={orderDraft.deliveryMethod}
                      onChange={(event) => updateOrderField("deliveryMethod", event.target.value as PurchaseDeliveryMethod)}
                    >
                      {Object.entries(purchaseDeliveryMethodLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Condición de pago</span>
                    <select
                      value={orderDraft.paymentTerms}
                      onChange={(event) => updateOrderField("paymentTerms", event.target.value as PurchasePaymentTerm)}
                    >
                      {Object.entries(purchasePaymentTermLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Moneda OC</span>
                    <select value={orderDraft.currency} onChange={(event) => updateOrderField("currency", event.target.value as ProductCurrency)}>
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                </div>

                <div className="purchase-line-builder">
                  <h3>Agregar producto / componente</h3>
                  <div className="form-grid four-columns">
                    <label className="field">
                      <span>Producto</span>
                      <select value={lineDraft.productId} onChange={(event) => selectLineProduct(event.target.value)}>
                        <option value="">Manual / sin producto</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} · {product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Componente</span>
                      <select
                        disabled={!selectedLineProduct}
                        value={lineDraft.componentId}
                        onChange={(event) => selectLineComponent(event.target.value)}
                      >
                        <option value="">Producto completo / manual</option>
                        {selectedLineProduct?.components.map((component) => (
                          <option key={component.id} value={component.id}>
                            {component.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Nombre de compra</span>
                      <input value={lineDraft.itemName} onChange={(event) => updateLineField("itemName", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Cantidad</span>
                      <input min="0" type="number" value={lineDraft.quantity} onChange={(event) => updateLineField("quantity", Number(event.target.value))} />
                    </label>
                    <label className="field">
                      <span>Unidad</span>
                      <select value={lineDraft.unit} onChange={(event) => updateLineField("unit", event.target.value as ProductUnit)}>
                        {Object.entries(productUnitLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Costo unitario</span>
                      <input min="0" type="number" value={lineDraft.unitCost} onChange={(event) => updateLineField("unitCost", Number(event.target.value))} />
                    </label>
                    <label className="field">
                      <span>Moneda</span>
                      <select value={lineDraft.currency} onChange={(event) => updateLineField("currency", event.target.value as ProductCurrency)}>
                        <option value="MXN">MXN</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Notas</span>
                      <input value={lineDraft.notes} onChange={(event) => updateLineField("notes", event.target.value)} />
                    </label>
                  </div>
                  <button className="secondary-button input-height-button" onClick={addOrderLine} type="button">
                    <Plus size={16} />
                    Agregar línea
                  </button>
                </div>

                <div className="purchase-line-list">
                  {orderLines.map((line) => (
                    <article className="purchase-line-row" key={line.id}>
                      <div>
                        <strong>{line.itemName}</strong>
                        <span>{line.productSku || "Compra manual"}</span>
                      </div>
                      <span>
                        {line.quantity} {productUnitLabels[line.unit].toLowerCase()}
                      </span>
                      <span>{formatCurrency(line.unitCost, line.currency)}</span>
                      <button className="secondary-button compact-button" onClick={() => removeOrderLine(line.id)} type="button">
                        Quitar
                      </button>
                    </article>
                  ))}
                  {orderLines.length === 0 ? <p className="empty-state">Agrega líneas para generar la orden de compra.</p> : null}
                </div>

                <div className="form-grid three-columns">
                  <label className="field">
                    <span>Costo envío</span>
                    <input min="0" type="number" value={orderDraft.shippingCost} onChange={(event) => updateOrderField("shippingCost", Number(event.target.value))} />
                  </label>
                  <label className="field">
                    <span>Impuestos</span>
                    <input min="0" type="number" value={orderDraft.taxes} onChange={(event) => updateOrderField("taxes", Number(event.target.value))} />
                  </label>
                  <div className="purchase-total-preview">
                    <span>Total</span>
                    <strong>{formatCurrency(purchaseOrderTotal(orderPreview), orderDraft.currency)}</strong>
                  </div>
                  <label className="field wide-field">
                    <span>Notas internas</span>
                    <textarea value={orderDraft.notes} onChange={(event) => updateOrderField("notes", event.target.value)} />
                  </label>
                </div>

                <button className="approve-button" type="submit">
                  <ShoppingCart size={17} />
                  Generar orden de compra
                </button>
              </form>
            </article>

            <aside className="purchase-panel">
              <div className="clean-section-heading">
                <div>
                  <h2>Órdenes por recibir</h2>
                  <p>Seguimiento interno de órdenes generadas por Compras.</p>
                </div>
              </div>
              <div className="purchase-card-list">
                {pendingReceipts.map((receipt) => (
                  <article className="pending-receipt-row" key={receipt.id}>
                    <span>{receipt.purchaseOrderFolio}</span>
                    <strong>{receipt.supplierName}</strong>
                    <p>{receipt.lines.length} líneas · llega {receipt.expectedDate} · {receipt.internalDestination}</p>
                    <span className={`purchase-pill status-${receipt.status}`}>{pendingReceiptStatusLabels[receipt.status]}</span>
                  </article>
                ))}
                {pendingReceipts.length === 0 ? <p className="empty-state">Aún no hay órdenes por recibir.</p> : null}
              </div>
            </aside>

            <section className="purchase-panel purchase-wide-panel">
              <div className="clean-section-heading">
                <div>
                  <h2>Órdenes de compra</h2>
                  <p>Órdenes generadas por Compras.</p>
                </div>
              </div>
              <div className="purchase-card-list">
                {purchaseOrders.map((purchaseOrder) => {
                  const documentDraft = documentDraftFor(purchaseOrder.id);
                  const documents = purchaseOrder.documents ?? [];
                  const history = purchaseOrder.history ?? [];

                  return (
                    <article className="purchase-order-row" key={purchaseOrder.id}>
                      <div>
                        <span>Folio</span>
                        <strong>{purchaseOrder.folio}</strong>
                      </div>
                      <div>
                        <span>Supplier</span>
                        <strong>{purchaseOrder.supplierName}</strong>
                      </div>
                      <div>
                        <span>Total</span>
                        <strong>{formatCurrency(purchaseOrderTotal(purchaseOrder), purchaseOrder.currency)}</strong>
                      </div>
                      <div>
                        <span>Llega</span>
                        <strong>{purchaseOrder.expectedDate}</strong>
                      </div>
                      <span className={`purchase-pill status-${purchaseOrder.status}`}>{purchaseOrderStatusLabels[purchaseOrder.status]}</span>

                      <div className="purchase-order-detail">
                        <section className="purchase-document-panel" aria-label={`Documentos de ${purchaseOrder.folio}`}>
                          <div className="purchase-detail-heading">
                            <FileText size={15} aria-hidden="true" />
                            <span>Documentos</span>
                            <strong>{documents.length}</strong>
                          </div>
                          <div className="purchase-document-list">
                            {documents.slice(0, 3).map((document) => (
                              <span key={document.id}>
                                {purchaseOrderDocumentTypeLabels[document.type]} · {document.fileName}
                              </span>
                            ))}
                            {documents.length === 0 ? <span>Sin documentos ligados.</span> : null}
                          </div>
                          <div className="purchase-document-form">
                            <label className="field">
                              <span>Tipo</span>
                              <select
                                value={documentDraft.type}
                                onChange={(event) =>
                                  updateDocumentDraft(
                                    purchaseOrder.id,
                                    "type",
                                    event.target.value as PurchaseOrderDocumentType
                                  )
                                }
                              >
                                {Object.entries(purchaseOrderDocumentTypeLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Archivo / referencia</span>
                              <input
                                value={documentDraft.fileName}
                                onChange={(event) => updateDocumentDraft(purchaseOrder.id, "fileName", event.target.value)}
                                placeholder="Factura, guía, cotización"
                              />
                            </label>
                            <button
                              className="secondary-button input-height-button"
                              onClick={() => addDocumentToOrder(purchaseOrder.id)}
                              type="button"
                            >
                              <Plus size={15} />
                              Agregar
                            </button>
                          </div>
                        </section>

                        <section className="purchase-history-panel" aria-label={`Historial de ${purchaseOrder.folio}`}>
                          <div className="purchase-detail-heading">
                            <ClipboardList size={15} aria-hidden="true" />
                            <span>Historial</span>
                          </div>
                          <div className="purchase-history-list">
                            {history.slice(0, 3).map((event) => (
                              <article key={event.id}>
                                <strong>{event.action}</strong>
                                <span>{new Date(event.at).toLocaleString("es-MX")}</span>
                                <p>{event.detail}</p>
                              </article>
                            ))}
                            {history.length === 0 ? <p>Sin historial registrado.</p> : null}
                          </div>
                        </section>
                      </div>
                    </article>
                  );
                })}
                {purchaseOrders.length === 0 ? <p className="empty-state">Todavía no hay órdenes de compra.</p> : null}
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "suppliers" ? (
          <section className="purchase-grid">
            <article className="purchase-panel">
              <div className="clean-section-heading">
                <div>
                  <h2>Registrar supplier</h2>
                  <p>Guarda proveedor, contacto, canal y qué vende.</p>
                </div>
              </div>
              <form className="purchase-form" onSubmit={addSupplier}>
                {pendingSupplierRequest ? (
                  <div className="purchase-context-banner">
                    <div>
                      <span>Resolviendo necesidad</span>
                      <strong>{pendingSupplierRequest.itemName}</strong>
                      <p>{pendingSupplierRequest.productSku} · {pendingSupplierRequest.reason}</p>
                    </div>
                    <button className="secondary-button compact-button" onClick={() => setPendingSupplierRequestId("")} type="button">
                      Quitar contexto
                    </button>
                  </div>
                ) : null}
                <div className="form-grid three-columns">
                  <label className="field">
                    <span>Nombre supplier</span>
                    <input value={supplierDraft.name} onChange={(event) => updateSupplierField("name", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Razón social</span>
                    <input value={supplierDraft.legalName} onChange={(event) => updateSupplierField("legalName", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>RFC / Tax ID</span>
                    <input value={supplierDraft.taxId} onChange={(event) => updateSupplierField("taxId", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Categoría</span>
                    <input value={supplierDraft.category} onChange={(event) => updateSupplierField("category", event.target.value)} />
                  </label>
                  <label className="field wide-field">
                    <span>Qué vende</span>
                    <textarea value={supplierDraft.sells} onChange={(event) => updateSupplierField("sells", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Contacto</span>
                    <input value={supplierDraft.contactName} onChange={(event) => updateSupplierField("contactName", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>WhatsApp</span>
                    <input value={supplierDraft.whatsapp} onChange={(event) => updateSupplierField("whatsapp", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input value={supplierDraft.email} onChange={(event) => updateSupplierField("email", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Método contacto</span>
                    <select value={supplierDraft.contactMethod} onChange={(event) => updateSupplierField("contactMethod", event.target.value as SupplierContactMethod)}>
                      {Object.entries(supplierContactMethodLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Plataforma externa</span>
                    <input value={supplierDraft.externalPlatform} onChange={(event) => updateSupplierField("externalPlatform", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Ciudad</span>
                    <input value={supplierDraft.city} onChange={(event) => updateSupplierField("city", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>País</span>
                    <input value={supplierDraft.country} onChange={(event) => updateSupplierField("country", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Moneda</span>
                    <select value={supplierDraft.currency} onChange={(event) => updateSupplierField("currency", event.target.value as ProductCurrency)}>
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Lead time días</span>
                    <input min="0" type="number" value={supplierDraft.leadTimeDays} onChange={(event) => updateSupplierField("leadTimeDays", Number(event.target.value))} />
                  </label>
                  <label className="field">
                    <span>Mínimo compra</span>
                    <input value={supplierDraft.minimumOrder} onChange={(event) => updateSupplierField("minimumOrder", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Condición pago</span>
                    <select value={supplierDraft.paymentTerms} onChange={(event) => updateSupplierField("paymentTerms", event.target.value as PurchasePaymentTerm)}>
                      {Object.entries(purchasePaymentTermLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field wide-field">
                    <span>Notas</span>
                    <textarea value={supplierDraft.notes} onChange={(event) => updateSupplierField("notes", event.target.value)} />
                  </label>
                </div>
                <button className="primary-button" type="submit">
                  <Plus size={16} />
                  Guardar supplier
                </button>
              </form>
            </article>

            <aside className="purchase-panel">
              <div className="clean-section-heading">
                <div>
                  <h2>Suppliers registrados</h2>
                  <p>Base local de proveedores de Compras.</p>
                </div>
              </div>
              <div className="purchase-card-list">
                {suppliers.map((supplier) => (
                  <article className="supplier-row" key={supplier.id}>
                    <div>
                      <span>{supplier.category || "Sin categoría"}</span>
                      <strong>{supplier.name}</strong>
                      <p>{supplier.sells}</p>
                    </div>
                    <span>{supplierContactMethodLabels[supplier.contactMethod]}</span>
                    <span className={`purchase-pill status-${supplier.status}`}>{supplierStatusLabels[supplier.status]}</span>
                  </article>
                ))}
              </div>
            </aside>
          </section>
        ) : null}

        {activeTab === "chat" ? (
          <section className="purchase-grid">
            <article className="purchase-panel">
              <div className="clean-section-heading">
                <div>
                  <h2>Chat manual</h2>
                  <p>Registro local de mensajes por WhatsApp, email o plataforma externa.</p>
                </div>
              </div>
              <form className="purchase-form" onSubmit={sendMessage}>
                <div className="form-grid two-columns">
                  <label className="field">
                    <span>Supplier</span>
                    <select
                      value={messageDraft.supplierId}
                      onChange={(event) => {
                        const supplier = suppliers.find((currentSupplier) => currentSupplier.id === event.target.value);
                        updateMessageField("supplierId", event.target.value);
                        if (supplier) {
                          updateMessageField("channel", supplier.contactMethod);
                          updateMessageField("destination", supplier.email || supplier.whatsapp || supplier.externalPlatform);
                        }
                      }}
                    >
                      <option value="">Selecciona supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Canal</span>
                    <select value={messageDraft.channel} onChange={(event) => updateMessageField("channel", event.target.value as SupplierContactMethod)}>
                      {Object.entries(supplierContactMethodLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Destino</span>
                    <input value={messageDraft.destination} onChange={(event) => updateMessageField("destination", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Folio relacionado</span>
                    <input value={messageDraft.relatedFolio} onChange={(event) => updateMessageField("relatedFolio", event.target.value)} />
                  </label>
                  <label className="field wide-field">
                    <span>Asunto</span>
                    <input value={messageDraft.subject} onChange={(event) => updateMessageField("subject", event.target.value)} />
                  </label>
                  <label className="field wide-field">
                    <span>Mensaje</span>
                    <textarea value={messageDraft.body} onChange={(event) => updateMessageField("body", event.target.value)} />
                  </label>
                </div>
                <button className="approve-button" type="submit">
                  <Send size={17} />
                  Registrar mensaje
                </button>
              </form>
            </article>

            <aside className="purchase-panel">
              <div className="clean-section-heading">
                <div>
                  <h2>Historial de chat</h2>
                  <p>Más adelante se conectará a WhatsApp/email reales.</p>
                </div>
              </div>
              <div className="purchase-card-list">
                {messages.map((message) => (
                  <article className="purchase-message-row" key={message.id}>
                    <div>
                      <span>{supplierContactMethodLabels[message.channel]} · {purchaseMessageStatusLabels[message.status]}</span>
                      <strong>{message.supplierName}</strong>
                      <p>{message.body}</p>
                    </div>
                    {message.relatedFolio ? <span className="purchase-pill">{message.relatedFolio}</span> : null}
                  </article>
                ))}
                {messages.length === 0 ? <p className="empty-state">Todavía no hay mensajes registrados.</p> : null}
              </div>
            </aside>
          </section>
        ) : null}
      </section>
    </main>
  );
}
