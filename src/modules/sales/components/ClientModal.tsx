import { ChevronDown, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Client, PaymentTerm, ShippingAddress, ShippingDeliveryMethod } from "../types";
import {
  formatShippingAddress,
  isShippingAddressComplete,
  normalizeShippingAddress,
  paymentTermLabels,
  shippingDeliveryMethodLabels
} from "../utils";

type ClientDraft = Omit<Client, "id" | "status">;

type ClientModalProps = {
  client?: Client;
  onClose: () => void;
  onSave: (client: ClientDraft, existingClient?: Client) => void;
};

const emptyClient: ClientDraft = {
  commercialName: "",
  legalName: "",
  taxId: "",
  contactName: "",
  email: "",
  phone: "",
  fiscalAddress: "",
  shippingAddress: normalizeShippingAddress(undefined),
  paymentTerm: "pendiente",
  notes: ""
};

export function ClientModal({ client, onClose, onSave }: ClientModalProps) {
  const [draft, setDraft] = useState<ClientDraft>(
    client
      ? {
          commercialName: client.commercialName,
          legalName: client.legalName,
          taxId: client.taxId,
          contactName: client.contactName,
          email: client.email,
          phone: client.phone,
          fiscalAddress: client.fiscalAddress,
          shippingAddress: normalizeShippingAddress(client.shippingAddress),
          paymentTerm: client.paymentTerm,
          notes: client.notes
        }
      : emptyClient
  );
  const [isShippingAddressOpen, setShippingAddressOpen] = useState(() =>
    client ? !isShippingAddressComplete(client.shippingAddress) : true
  );

  const shippingAddressComplete = isShippingAddressComplete(draft.shippingAddress);
  const shippingAddressSummary = formatShippingAddress(draft.shippingAddress);

  function updateField<Key extends keyof ClientDraft>(key: Key, value: ClientDraft[Key]) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function updateShippingField<Key extends keyof ShippingAddress>(key: Key, value: ShippingAddress[Key]) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      shippingAddress: {
        ...currentDraft.shippingAddress,
        [key]: value
      }
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(draft, client);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-shell client-modal" role="dialog" aria-modal="true" aria-labelledby="client-modal-title">
        <header className="modal-header">
          <h2 id="client-modal-title">{client ? "Editar cliente" : "Crear cliente nuevo"}</h2>
          <button className="icon-button ghost" onClick={onClose} type="button" aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </header>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-grid two-columns">
            <label className="field">
              <span>Nombre comercial</span>
              <input
                value={draft.commercialName}
                onChange={(event) => updateField("commercialName", event.target.value)}
                autoFocus
              />
            </label>

            <label className="field">
              <span>Razón social</span>
              <input value={draft.legalName} onChange={(event) => updateField("legalName", event.target.value)} />
            </label>

            <label className="field">
              <span>RFC o tax ID</span>
              <input value={draft.taxId} onChange={(event) => updateField("taxId", event.target.value)} />
            </label>

            <label className="field">
              <span>Contacto principal</span>
              <input value={draft.contactName} onChange={(event) => updateField("contactName", event.target.value)} />
            </label>

            <label className="field">
              <span>Correo</span>
              <input type="email" value={draft.email} onChange={(event) => updateField("email", event.target.value)} />
            </label>

            <label className="field">
              <span>Teléfono</span>
              <input value={draft.phone} onChange={(event) => updateField("phone", event.target.value)} />
            </label>

            <label className="field">
              <span>Condición de pago</span>
              <select
                value={draft.paymentTerm}
                onChange={(event) => updateField("paymentTerm", event.target.value as PaymentTerm)}
              >
                {Object.entries(paymentTermLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Dirección fiscal</span>
            <textarea
              value={draft.fiscalAddress}
              onChange={(event) => updateField("fiscalAddress", event.target.value)}
            />
          </label>

          <section className={`shipping-address-card ${isShippingAddressOpen ? "open" : ""}`}>
            <button
              className="shipping-address-toggle"
              type="button"
              aria-expanded={isShippingAddressOpen}
              onClick={() => setShippingAddressOpen((currentValue) => !currentValue)}
            >
              <div className="shipping-address-summary">
                <span>Dirección de envío</span>
                <strong>{shippingAddressSummary}</strong>
              </div>
              <span className={`shipping-status-pill ${shippingAddressComplete ? "complete" : "incomplete"}`}>
                {shippingAddressComplete ? "Completa" : "Incompleta"}
              </span>
              <ChevronDown className="shipping-chevron" size={18} aria-hidden="true" />
            </button>

            {isShippingAddressOpen ? (
              <div className="shipping-address-fields form-grid three-columns">
                <label className="field">
                  <span>Nombre de quien recibe</span>
                  <input
                    value={draft.shippingAddress.recipientName}
                    onChange={(event) => updateShippingField("recipientName", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Teléfono / WhatsApp</span>
                  <input
                    value={draft.shippingAddress.recipientPhone}
                    onChange={(event) => updateShippingField("recipientPhone", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Correo de recepción</span>
                  <input
                    type="email"
                    value={draft.shippingAddress.recipientEmail}
                    onChange={(event) => updateShippingField("recipientEmail", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Empresa / planta / sucursal</span>
                  <input
                    value={draft.shippingAddress.company}
                    onChange={(event) => updateShippingField("company", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Calle</span>
                  <input
                    value={draft.shippingAddress.street}
                    onChange={(event) => updateShippingField("street", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Número exterior</span>
                  <input
                    value={draft.shippingAddress.exteriorNumber}
                    onChange={(event) => updateShippingField("exteriorNumber", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Número interior</span>
                  <input
                    value={draft.shippingAddress.interiorNumber}
                    onChange={(event) => updateShippingField("interiorNumber", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Colonia</span>
                  <input
                    value={draft.shippingAddress.neighborhood}
                    onChange={(event) => updateShippingField("neighborhood", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Código postal</span>
                  <input
                    value={draft.shippingAddress.postalCode}
                    onChange={(event) => updateShippingField("postalCode", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Ciudad / municipio</span>
                  <input
                    value={draft.shippingAddress.city}
                    onChange={(event) => updateShippingField("city", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Estado</span>
                  <input
                    value={draft.shippingAddress.state}
                    onChange={(event) => updateShippingField("state", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>País</span>
                  <input
                    value={draft.shippingAddress.country}
                    onChange={(event) => updateShippingField("country", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Método de entrega</span>
                  <select
                    value={draft.shippingAddress.deliveryMethod}
                    onChange={(event) =>
                      updateShippingField("deliveryMethod", event.target.value as ShippingDeliveryMethod)
                    }
                  >
                    {Object.entries(shippingDeliveryMethodLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Horario de recepción</span>
                  <input
                    value={draft.shippingAddress.deliveryHours}
                    onChange={(event) => updateShippingField("deliveryHours", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Link de ubicación</span>
                  <input
                    placeholder="https://"
                    value={draft.shippingAddress.locationLink}
                    onChange={(event) => updateShippingField("locationLink", event.target.value)}
                  />
                </label>

                <label className="field wide-field">
                  <span>Referencias</span>
                  <textarea
                    value={draft.shippingAddress.references}
                    onChange={(event) => updateShippingField("references", event.target.value)}
                  />
                </label>

                <label className="field wide-field">
                  <span>Indicaciones de entrega</span>
                  <textarea
                    value={draft.shippingAddress.deliveryInstructions}
                    onChange={(event) => updateShippingField("deliveryInstructions", event.target.value)}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <label className="field">
            <span>Notas comerciales</span>
            <textarea value={draft.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </label>

          <footer className="modal-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              Guardar cliente
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
