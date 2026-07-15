import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  CreditCard,
  Edit3,
  FileUp,
  History,
  ListChecks,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  UserRound
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { initialClients, productCatalog, salesUser } from "../data";
import type {
  Client,
  DocumentType,
  HistoryEvent,
  OrderLine,
  PaymentMethod,
  PaymentTerm,
  Priority,
  Product,
  SalesDocument,
  SalesOrder
} from "../types";
import {
  calculateClientStatus,
  clientMatches,
  clientStatusLabels,
  createId,
  createInitialOrder,
  documentTypeLabels,
  evaluateOrder,
  formatCurrency,
  formatDateTime,
  isValidLine,
  lineSubtotal,
  orderStatusLabels,
  orderTotals,
  paymentMethodLabels,
  paymentTermLabels,
  priorityLabels
} from "../utils";
import { ClientModal } from "./ClientModal";
import { ProductModal } from "./ProductModal";

type SalesViewProps = {
  onBack: () => void;
};

type ClientDraft = Omit<Client, "id" | "status">;

function createHistory(action: string, detail: string): HistoryEvent {
  return {
    id: createId("history"),
    user: salesUser.name || "Ventas",
    at: new Date().toISOString(),
    action,
    detail
  };
}

function withHistory(currentOrder: SalesOrder, nextOrder: SalesOrder, action: string, detail: string) {
  return {
    ...nextOrder,
    history: [createHistory(action, detail), ...currentOrder.history]
  };
}

export function SalesView({ onBack }: SalesViewProps) {
  const [clients, setClients] = useState<Client[]>(() => initialClients);
  const [order, setOrder] = useState<SalesOrder>(() => createInitialOrder(salesUser));
  const [clientQuery, setClientQuery] = useState("");
  const [clientModal, setClientModal] = useState<{ client?: Client } | null>(null);
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("orden-compra-cliente");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === order.selectedClientId),
    [clients, order.selectedClientId]
  );

  const clientResults = useMemo(() => {
    return clients.filter((client) => clientMatches(client, clientQuery)).slice(0, 6);
  }, [clientQuery, clients]);

  const totals = useMemo(() => orderTotals(order.lines), [order.lines]);
  const evaluation = useMemo(() => evaluateOrder(order, selectedClient), [order, selectedClient]);

  function updateOrder(patch: Partial<SalesOrder>, action?: string, detail?: string) {
    setOrder((currentOrder) => {
      const nextOrder = { ...currentOrder, ...patch };
      return action && detail ? withHistory(currentOrder, nextOrder, action, detail) : nextOrder;
    });
  }

  function selectClient(client: Client) {
    setOrder((currentOrder) => {
      const nextOrder: SalesOrder = {
        ...currentOrder,
        selectedClientId: client.id,
        paymentTerm: client.paymentTerm,
        status: client.status === "incompleto" ? "pendiente-informacion" : currentOrder.status
      };

      return withHistory(currentOrder, nextOrder, "Cliente seleccionado", `Se seleccionó ${client.commercialName}.`);
    });
  }

  function saveClient(draft: ClientDraft, existingClient?: Client) {
    const status = calculateClientStatus(draft, existingClient?.status);
    const savedClient: Client = {
      ...draft,
      id: existingClient?.id ?? createId("client"),
      status
    };

    setClients((currentClients) => {
      if (existingClient) {
        return currentClients.map((client) => (client.id === existingClient.id ? savedClient : client));
      }

      return [savedClient, ...currentClients];
    });

    setOrder((currentOrder) => {
      const nextOrder: SalesOrder = {
        ...currentOrder,
        selectedClientId: savedClient.id,
        paymentTerm: savedClient.paymentTerm,
        status: savedClient.status === "incompleto" ? "pendiente-informacion" : currentOrder.status
      };
      const action = existingClient ? "Edición de cliente" : "Creación de cliente";
      const detail = `${savedClient.commercialName} quedó como ${clientStatusLabels[savedClient.status].toLowerCase()}.`;

      return withHistory(currentOrder, nextOrder, action, detail);
    });

    setClientModal(null);
    setClientQuery(savedClient.commercialName);
  }

  function addProduct(product: Product) {
    if (product.status !== "activo") {
      return;
    }

    setOrder((currentOrder) => {
      const existingLine = currentOrder.lines.find((line) => line.product.id === product.id);
      const lines = existingLine
        ? currentOrder.lines.map((line) =>
            line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
          )
        : [
            ...currentOrder.lines,
            {
              id: createId("line"),
              product,
              quantity: 1,
              unitPrice: product.basePrice,
              discount: 0,
              notes: ""
            }
          ];

      const nextOrder = {
        ...currentOrder,
        lines,
        status: currentOrder.status === "pendiente-producto" ? "borrador" : currentOrder.status
      };

      return withHistory(currentOrder, nextOrder, "Producto agregado", `${product.sku} - ${product.name}.`);
    });

    setProductModalOpen(false);
  }

  function updateLine(lineId: string, patch: Partial<OrderLine>, action: string, detail: string) {
    setOrder((currentOrder) => {
      const nextOrder = {
        ...currentOrder,
        lines: currentOrder.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line))
      };

      return withHistory(currentOrder, nextOrder, action, detail);
    });
  }

  function removeLine(line: OrderLine) {
    setOrder((currentOrder) => {
      const nextOrder = {
        ...currentOrder,
        lines: currentOrder.lines.filter((currentLine) => currentLine.id !== line.id)
      };

      return withHistory(currentOrder, nextOrder, "Producto eliminado", `${line.product.sku} - ${line.product.name}.`);
    });
  }

  function changePaymentTerm(paymentTerm: PaymentTerm) {
    const commercialStatus =
      paymentTerm === "credito" ? "pendiente-credito" : paymentTerm === "pendiente" ? "captura" : "pendiente-pago";

    updateOrder(
      {
        paymentTerm,
        commercialStatus,
        paymentVerifiedAt: null,
        paymentVerifiedBy: null,
        creditReviewedAt: null,
        creditReviewedBy: null,
        status:
          paymentTerm === "credito"
            ? "pendiente-credito"
            : paymentTerm === "pendiente"
              ? "pendiente-informacion"
              : "pendiente-pago"
      },
      "Condición de pago modificada",
      paymentTermLabels[paymentTerm]
    );
  }

  function attachDocuments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const uploadedAt = new Date().toISOString();
    const documents: SalesDocument[] = files.map((file) => ({
      id: createId("doc"),
      fileName: file.name,
      type: documentType,
      uploadedAt
    }));

    setOrder((currentOrder) => {
      const nextOrder = {
        ...currentOrder,
        documents: [...documents, ...currentOrder.documents]
      };
      const names = documents.map((document) => document.fileName).join(", ");

      return withHistory(currentOrder, nextOrder, "Documento adjuntado", names);
    });

    event.target.value = "";
  }

  function copyPaymentLink() {
    if (!order.paymentLink) {
      return;
    }

    void navigator.clipboard?.writeText(order.paymentLink);
    updateOrder({}, "Link de pago copiado", order.paymentLink);
  }

  function registerPaymentLink() {
    if (!order.paymentLink.trim()) {
      return;
    }

    updateOrder(
      { commercialStatus: "pendiente-pago", status: "pendiente-pago" },
      "Link de pago registrado",
      order.paymentLink
    );
  }

  function verifyPayment() {
    if (!salesUser.permissions.verifyPayment) {
      return;
    }

    updateOrder(
      {
        commercialStatus: "pago-verificado",
        status: order.status === "pendiente-pago" ? "borrador" : order.status,
        paymentVerifiedAt: new Date().toISOString(),
        paymentVerifiedBy: salesUser.name || "Ventas"
      },
      "Pago verificado",
      `Verificado por ${salesUser.name || "Ventas"}.`
    );
  }

  function markCredit(status: "pendiente" | "aprobado" | "rechazado") {
    if (!salesUser.permissions.approveCredit) {
      return;
    }

    const statusMap = {
      pendiente: {
        orderStatus: "pendiente-credito" as const,
        commercialStatus: "pendiente-credito" as const,
        action: "Orden marcada pendiente de crédito",
        detail: "Crédito pendiente de revisión."
      },
      aprobado: {
        orderStatus: order.status === "pendiente-credito" ? ("borrador" as const) : order.status,
        commercialStatus: "credito-aprobado" as const,
        action: "Crédito aprobado",
        detail: `Aprobado por ${salesUser.name || "Ventas"}.`
      },
      rechazado: {
        orderStatus: "pendiente-credito" as const,
        commercialStatus: "credito-rechazado" as const,
        action: "Crédito rechazado",
        detail: `Rechazado por ${salesUser.name || "Ventas"}.`
      }
    }[status];

    updateOrder(
      {
        status: statusMap.orderStatus,
        commercialStatus: statusMap.commercialStatus,
        creditReviewedAt: status === "pendiente" ? null : new Date().toISOString(),
        creditReviewedBy: status === "pendiente" ? null : salesUser.name || "Ventas"
      },
      statusMap.action,
      statusMap.detail
    );
  }

  function approveCommercially() {
    if (!salesUser.permissions.approveCommercial || !evaluation.canApprove) {
      return;
    }

    updateOrder(
      { status: "aprobada-comercialmente" },
      "Aprobación comercial",
      `La orden ${order.folio} fue aprobada comercialmente.`
    );
  }

  function cancelOrder() {
    if (!salesUser.permissions.cancelOrder) {
      return;
    }

    updateOrder({ status: "cancelada" }, "Cancelación", `La orden ${order.folio} fue cancelada.`);
  }

  function resetOrder() {
    setOrder(createInitialOrder(salesUser));
  }

  const clientAlert =
    selectedClient?.status === "bloqueado"
      ? "Cliente bloqueado. No se puede aprobar comercialmente."
      : selectedClient?.status === "incompleto"
        ? "Cliente incompleto. Puede guardarse como borrador."
        : null;

  return (
    <main className="sales-view">
      <header className="sales-topbar">
        <button className="icon-button" onClick={onBack} type="button" aria-label="Regresar a perfiles">
          <ArrowLeft size={22} />
        </button>
        <div className="sales-title">
          <span>Ventas</span>
          <h1>Nueva orden comercial</h1>
        </div>
        <span className={`order-status status-${order.status}`}>{orderStatusLabels[order.status]}</span>
      </header>

      <div className="sales-layout">
        <aside className="sales-sidebar">
          <section className="sales-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Paso 1</span>
                <h2>Cliente</h2>
              </div>
              <button className="secondary-button compact-button" onClick={() => setClientModal({})} type="button">
                <Plus size={16} />
                Crear cliente nuevo
              </button>
            </div>

            <label className="search-field">
              <Search size={18} aria-hidden="true" />
              <input
                value={clientQuery}
                onChange={(event) => setClientQuery(event.target.value)}
                placeholder="Nombre, razón social, RFC, correo o teléfono"
              />
            </label>

            <div className="client-results">
              {clientResults.map((client) => (
                <button
                  className={`client-result ${client.id === selectedClient?.id ? "selected" : ""}`}
                  key={client.id}
                  onClick={() => selectClient(client)}
                  type="button"
                >
                  <span className="client-avatar" aria-hidden="true">
                    <UserRound size={18} />
                  </span>
                  <span className="client-result-copy">
                    <strong>{client.commercialName}</strong>
                    <small>{client.taxId}</small>
                  </span>
                  <span className={`status-pill ${client.status}`}>{clientStatusLabels[client.status]}</span>
                </button>
              ))}

              {clientResults.length === 0 ? <p className="empty-state">No hay clientes con esa búsqueda.</p> : null}
            </div>

            {selectedClient ? (
              <article className="selected-client">
                <div className="selected-client-header">
                  <div>
                    <span className="section-kicker">Seleccionado</span>
                    <h3>{selectedClient.commercialName}</h3>
                  </div>
                  <button
                    className="icon-button ghost"
                    onClick={() => setClientModal({ client: selectedClient })}
                    type="button"
                    aria-label="Editar cliente"
                  >
                    <Edit3 size={18} />
                  </button>
                </div>
                <dl className="info-list">
                  <div>
                    <dt>Razón social</dt>
                    <dd>{selectedClient.legalName || "Sin capturar"}</dd>
                  </div>
                  <div>
                    <dt>Contacto</dt>
                    <dd>{selectedClient.contactName || "Sin capturar"}</dd>
                  </div>
                  <div>
                    <dt>Correo</dt>
                    <dd>{selectedClient.email || "Sin capturar"}</dd>
                  </div>
                  <div>
                    <dt>Pago</dt>
                    <dd>{paymentTermLabels[selectedClient.paymentTerm]}</dd>
                  </div>
                </dl>
                {clientAlert ? (
                  <div className={`inline-alert ${selectedClient.status}`}>
                    <ShieldAlert size={17} />
                    <span>{clientAlert}</span>
                  </div>
                ) : null}
              </article>
            ) : null}
          </section>

          <section className="sales-section checklist-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Revisión</span>
                <h2>Checklist comercial</h2>
              </div>
              <ListChecks size={22} aria-hidden="true" />
            </div>
            <div className="checklist">
              {evaluation.checklist.map((item) => (
                <div className={`checklist-item ${item.passed ? "passed" : "pending"}`} key={item.id}>
                  {item.passed ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <button
              className="approve-button"
              disabled={!evaluation.canApprove || !salesUser.permissions.approveCommercial}
              onClick={approveCommercially}
              type="button"
            >
              <ClipboardCheck size={18} />
              Aprobar comercialmente
            </button>
          </section>
        </aside>

        <section className="sales-main">
          <section className="sales-section order-summary-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Encabezado</span>
                <h2>Orden</h2>
              </div>
              <div className="button-row">
                <button className="secondary-button" onClick={resetOrder} type="button">
                  <RefreshCw size={16} />
                  Nueva orden
                </button>
                <button
                  className="secondary-button"
                  onClick={() => updateOrder({ status: "borrador" }, "Orden guardada", "Se guardó como borrador.")}
                  type="button"
                >
                  <Save size={16} />
                  Guardar borrador
                </button>
              </div>
            </div>

            <div className="order-meta-grid">
              <div>
                <span>Folio interno</span>
                <strong>{order.folio}</strong>
              </div>
              <div>
                <span>Vendedor responsable</span>
                <strong>{order.seller || "Sin asignar"}</strong>
              </div>
              <div>
                <span>Fecha de creación</span>
                <strong>{formatDateTime(order.createdAt)}</strong>
              </div>
              <div>
                <span>Estado comercial</span>
                <strong>{orderStatusLabels[order.status]}</strong>
              </div>
            </div>
          </section>

          <section className="sales-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Paso 2</span>
                <h2>Productos</h2>
              </div>
              <div className="button-row">
                <button className="secondary-button" onClick={() => setProductModalOpen(true)} type="button">
                  <PackagePlus size={16} />
                  Agregar producto
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    updateOrder(
                      { status: "pendiente-producto" },
                      "Orden marcada pendiente de producto",
                      "No se encontró producto activo en catálogo."
                    )
                  }
                  type="button"
                >
                  Pendiente de producto
                </button>
              </div>
            </div>

            <div className="line-items">
              <div className="line-header">
                <span>Producto</span>
                <span>Cantidad</span>
                <span>Precio</span>
                <span>Descuento</span>
                <span>Subtotal</span>
                <span>Notas</span>
                <span />
              </div>

              {order.lines.map((line) => {
                const validLine = isValidLine(line);

                return (
                  <div className={`line-row ${validLine ? "" : "invalid"}`} key={line.id}>
                    <div className="line-product">
                      <strong>{line.product.name}</strong>
                      <span>
                        {line.product.sku} · {line.product.unit}
                      </span>
                    </div>
                    <input
                      min="0"
                      step={line.product.unit === "pieza" ? "1" : "0.01"}
                      type="number"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(
                          line.id,
                          { quantity: Number(event.target.value) },
                          "Cantidad modificada",
                          `${line.product.sku}: ${event.target.value}`
                        )
                      }
                    />
                    <input
                      min="0"
                      type="number"
                      value={line.unitPrice}
                      onChange={(event) =>
                        updateLine(
                          line.id,
                          { unitPrice: Number(event.target.value) },
                          "Precio modificado",
                          `${line.product.sku}: ${formatCurrency(Number(event.target.value))}`
                        )
                      }
                    />
                    <input
                      min="0"
                      type="number"
                      value={line.discount}
                      onChange={(event) =>
                        updateLine(
                          line.id,
                          { discount: Number(event.target.value) },
                          "Descuento modificado",
                          `${line.product.sku}: ${formatCurrency(Number(event.target.value))}`
                        )
                      }
                    />
                    <strong>{formatCurrency(lineSubtotal(line))}</strong>
                    <input
                      value={line.notes}
                      onChange={(event) => updateLine(line.id, { notes: event.target.value }, "Nota de línea", line.product.sku)}
                      placeholder="Notas"
                    />
                    <button className="icon-button ghost" onClick={() => removeLine(line)} type="button" aria-label="Eliminar producto">
                      <Trash2 size={17} />
                    </button>
                    {!validLine ? <p className="line-error">Cantidad inválida para este producto.</p> : null}
                  </div>
                );
              })}

              {order.lines.length === 0 ? <p className="empty-state">Sin productos seleccionados.</p> : null}
            </div>
          </section>

          <section className="sales-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Paso 3</span>
                <h2>Detalle comercial</h2>
              </div>
            </div>

            <div className="form-grid three-columns">
              <label className="field">
                <span>Fecha requerida por el cliente</span>
                <input
                  type="date"
                  value={order.requiredDate}
                  onChange={(event) =>
                    updateOrder(
                      { requiredDate: event.target.value },
                      "Fecha requerida modificada",
                      event.target.value || "Sin fecha"
                    )
                  }
                />
              </label>

              <label className="field">
                <span>Prioridad comercial</span>
                <select
                  value={order.priority}
                  onChange={(event) =>
                    updateOrder(
                      { priority: event.target.value as Priority },
                      "Prioridad modificada",
                      priorityLabels[event.target.value as Priority]
                    )
                  }
                >
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {(order.priority === "urgente" || order.priority === "critica") && (
                <label className="field">
                  <span>Motivo de prioridad</span>
                  <input
                    value={order.priorityReason}
                    onChange={(event) => updateOrder({ priorityReason: event.target.value })}
                  />
                </label>
              )}
            </div>

            <label className="field">
              <span>Notas comerciales internas</span>
              <textarea
                value={order.internalNotes}
                onChange={(event) => updateOrder({ internalNotes: event.target.value })}
              />
            </label>
          </section>

          <section className="sales-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Paso 4</span>
                <h2>Condiciones y documentos</h2>
              </div>
            </div>

            <div className="commerce-grid">
              <div className="commerce-fields">
                <div className="totals-strip">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatCurrency(totals.subtotal)}</strong>
                  </div>
                  <div>
                    <span>Impuestos</span>
                    <strong>{formatCurrency(totals.taxes)}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{formatCurrency(totals.total)}</strong>
                  </div>
                </div>

                <div className="form-grid two-columns">
                  <label className="field">
                    <span>Condición de pago</span>
                    <select value={order.paymentTerm} onChange={(event) => changePaymentTerm(event.target.value as PaymentTerm)}>
                      {Object.entries(paymentTermLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Método de pago</span>
                    <select
                      value={order.paymentMethod}
                      onChange={(event) =>
                        updateOrder(
                          { paymentMethod: event.target.value as PaymentMethod },
                          "Método de pago modificado",
                          paymentMethodLabels[event.target.value as PaymentMethod]
                        )
                      }
                    >
                      {Object.entries(paymentMethodLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {(order.paymentTerm === "contado" || order.paymentTerm === "anticipo") && (
                  <div className="payment-tools">
                    <label className="field">
                      <span>Link de pago</span>
                      <input
                        value={order.paymentLink}
                        onChange={(event) => updateOrder({ paymentLink: event.target.value })}
                        placeholder="https://"
                      />
                    </label>
                    <div className="button-row">
                      <button className="secondary-button" onClick={registerPaymentLink} type="button">
                        <CreditCard size={16} />
                        Registrar link
                      </button>
                      <button className="icon-button" onClick={copyPaymentLink} type="button" aria-label="Copiar link de pago">
                        <Copy size={18} />
                      </button>
                      <button
                        className="secondary-button"
                        disabled={!salesUser.permissions.verifyPayment}
                        onClick={verifyPayment}
                        type="button"
                      >
                        <CheckCircle2 size={16} />
                        Marcar pago como verificado
                      </button>
                    </div>
                  </div>
                )}

                {order.paymentTerm === "credito" && (
                  <div className="credit-tools">
                    <button className="secondary-button" onClick={() => markCredit("pendiente")} type="button">
                      Pendiente de crédito
                    </button>
                    <button className="secondary-button" onClick={() => markCredit("aprobado")} type="button">
                      <CheckCircle2 size={16} />
                      Crédito aprobado
                    </button>
                    <button className="secondary-button danger" onClick={() => markCredit("rechazado")} type="button">
                      <Ban size={16} />
                      Crédito rechazado
                    </button>
                  </div>
                )}
              </div>

              <div className="documents-panel">
                <div className="document-upload">
                  <label className="field compact">
                    <span>Tipo de documento</span>
                    <select value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>
                      {Object.entries(documentTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="secondary-button" onClick={() => fileInputRef.current?.click()} type="button">
                    <FileUp size={16} />
                    Adjuntar documento
                  </button>
                  <input ref={fileInputRef} hidden multiple type="file" onChange={attachDocuments} />
                </div>

                <div className="document-list">
                  {order.documents.map((document) => (
                    <div className="document-row" key={document.id}>
                      <FileUp size={17} />
                      <div>
                        <strong>{document.fileName}</strong>
                        <span>
                          {documentTypeLabels[document.type]} · {formatDateTime(document.uploadedAt)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {order.documents.length === 0 ? <p className="empty-state">Sin documentos adjuntos.</p> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="sales-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Bitácora</span>
                <h2>Historial</h2>
              </div>
              <History size={22} aria-hidden="true" />
            </div>

            <div className="history-list">
              {order.history.map((event) => (
                <article className="history-row" key={event.id}>
                  <span className="history-dot" aria-hidden="true" />
                  <div>
                    <strong>{event.action}</strong>
                    <p>{event.detail}</p>
                    <small>
                      {event.user} · {formatDateTime(event.at)}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <footer className="sales-footer-actions">
            <button className="secondary-button danger" disabled={!salesUser.permissions.cancelOrder} onClick={cancelOrder} type="button">
              <Ban size={16} />
              Cancelar orden
            </button>
            <button
              className="approve-button"
              disabled={!evaluation.canApprove || !salesUser.permissions.approveCommercial}
              onClick={approveCommercially}
              type="button"
            >
              <ClipboardCheck size={18} />
              Aprobar comercialmente
            </button>
          </footer>
        </section>
      </div>

      {clientModal ? (
        <ClientModal client={clientModal.client} onClose={() => setClientModal(null)} onSave={saveClient} />
      ) : null}

      {isProductModalOpen ? (
        <ProductModal products={productCatalog} onClose={() => setProductModalOpen(false)} onSelect={addProduct} />
      ) : null}
    </main>
  );
}
