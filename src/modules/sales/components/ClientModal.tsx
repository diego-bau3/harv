import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Client, PaymentTerm } from "../types";
import { paymentTermLabels } from "../utils";

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
  shippingAddress: "",
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
          shippingAddress: client.shippingAddress,
          paymentTerm: client.paymentTerm,
          notes: client.notes
        }
      : emptyClient
  );

  function updateField<Key extends keyof ClientDraft>(key: Key, value: ClientDraft[Key]) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
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

          <div className="form-grid two-columns">
            <label className="field">
              <span>Dirección fiscal</span>
              <textarea
                value={draft.fiscalAddress}
                onChange={(event) => updateField("fiscalAddress", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Dirección de envío</span>
              <textarea
                value={draft.shippingAddress}
                onChange={(event) => updateField("shippingAddress", event.target.value)}
              />
            </label>
          </div>

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
