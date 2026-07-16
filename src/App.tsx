import { useEffect, useState } from "react";
import { ProfileSelector } from "./components/ProfileSelector";
import { ProfileScreen } from "./components/ProfileScreen";
import type { Profile } from "./data/profiles";
import { ProductCatalogScreen } from "./modules/products/components/ProductCatalogScreen";
import { initialPurchaseRequests, initialSuppliers } from "./modules/purchases/data";
import { createProductSupplierRequests } from "./modules/purchases/productRequests";
import type {
  PendingReceipt,
  PurchaseMessage,
  PurchaseOrder,
  PurchaseOrderDocument,
  PurchaseRequest,
  PurchaseReceiptIssue,
  PurchaseReceiptLineUpdate,
  PurchaseReceiptStatus,
  PurchaseSupplier
} from "./modules/purchases/types";
import { futureDate, purchaseId, purchaseReceiptIssueLabels } from "./modules/purchases/utils";
import { productCatalog } from "./modules/sales/data";
import type { Product } from "./modules/sales/types";
import { createId } from "./modules/sales/utils";

type ProductDraft = Omit<Product, "id">;

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function findMatchingSupplier(suppliers: PurchaseSupplier[], supplier: PurchaseSupplier) {
  const taxId = normalizeLookup(supplier.taxId);
  const email = normalizeLookup(supplier.email);
  const name = normalizeLookup(supplier.name);

  return suppliers.find((currentSupplier) => {
    if (taxId && normalizeLookup(currentSupplier.taxId) === taxId) {
      return true;
    }

    if (email && normalizeLookup(currentSupplier.email) === email) {
      return true;
    }

    return Boolean(name && normalizeLookup(currentSupplier.name) === name);
  });
}

export default function App() {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isProductCatalogOpen, setProductCatalogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(() => productCatalog);
  const [suppliers, setSuppliers] = useState<PurchaseSupplier[]>(() => initialSuppliers);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>(() => [
    ...createProductSupplierRequests(productCatalog, initialPurchaseRequests),
    ...initialPurchaseRequests
  ]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [purchaseMessages, setPurchaseMessages] = useState<PurchaseMessage[]>([]);

  useEffect(() => {
    setPurchaseRequests((currentRequests) => {
      const newRequests = createProductSupplierRequests(products, currentRequests);

      return newRequests.length > 0 ? [...newRequests, ...currentRequests] : currentRequests;
    });
  }, [products]);

  function saveProduct(draft: ProductDraft, existingProduct?: Product) {
    const savedProduct: Product = {
      ...draft,
      id: existingProduct?.id ?? createId("product")
    };

    setProducts((currentProducts) => {
      if (existingProduct) {
        return currentProducts.map((product) => (product.id === existingProduct.id ? savedProduct : product));
      }

      return [savedProduct, ...currentProducts];
    });
  }

  function assignSupplierToProductComponent(productId: string, componentId: string, supplier: PurchaseSupplier) {
    if (!productId || !componentId) {
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== productId) {
          return product;
        }

        return {
          ...product,
          components: product.components.map((component) => {
            if (component.id !== componentId) {
              return component;
            }

            return {
              ...component,
              supplierCompany: supplier.name,
              supplierContact: supplier.contactName,
              supplierEmail: supplier.email,
              supplierPhone: supplier.whatsapp,
              supplierContactMethod: supplier.contactMethod,
              supplierExternalPlatform: supplier.externalPlatform,
              leadTime: supplier.leadTimeDays > 0 ? `${supplier.leadTimeDays} dias` : component.leadTime,
              needsSupplierResearch: false,
              supplierResearchNotes: ""
            };
          })
        };
      })
    );
  }

  function addSupplier(supplier: PurchaseSupplier) {
    setSuppliers((currentSuppliers) => {
      const existingSupplier = findMatchingSupplier(currentSuppliers, supplier);

      if (existingSupplier) {
        return currentSuppliers.map((currentSupplier) =>
          currentSupplier.id === existingSupplier.id
            ? {
                ...currentSupplier,
                ...supplier,
                id: existingSupplier.id,
                status: supplier.status === "investigacion" ? currentSupplier.status : supplier.status
              }
            : currentSupplier
        );
      }

      return [supplier, ...currentSuppliers];
    });
  }

  function resolveRequestSupplier(requestId: string, supplier: PurchaseSupplier) {
    const request = purchaseRequests.find((currentRequest) => currentRequest.id === requestId);
    const resolvedSupplier = findMatchingSupplier(suppliers, supplier) ?? supplier;

    if (request) {
      assignSupplierToProductComponent(request.productId, request.componentId, resolvedSupplier);
    }

    setPurchaseRequests((currentRequests) =>
      currentRequests.map((currentRequest) =>
        currentRequest.id === requestId
          ? {
              ...currentRequest,
              supplierId: resolvedSupplier.id,
              status: "cotizando",
              notes: currentRequest.notes
                ? `${currentRequest.notes}\nSupplier asignado: ${resolvedSupplier.name}.`
                : `Supplier asignado: ${resolvedSupplier.name}.`
            }
          : currentRequest
      )
    );
  }

  function createPurchaseOrder(purchaseOrder: PurchaseOrder, pendingReceipt: PendingReceipt) {
    const sourceRequestIds = new Set(
      purchaseOrder.lines.map((line) => line.sourceRequestId).filter((requestId) => requestId.length > 0)
    );
    const supplier = suppliers.find((currentSupplier) => currentSupplier.id === purchaseOrder.supplierId);
    const incomingHistory = purchaseOrder.history ?? [];

    const createdOrder: PurchaseOrder = {
      ...purchaseOrder,
      history:
        incomingHistory.length > 0
          ? incomingHistory
          : [
              {
                id: purchaseId("po-history"),
                at: purchaseOrder.createdAt,
                action: "Orden creada",
                detail: `Se generó ${purchaseOrder.folio} para ${purchaseOrder.supplierName}.`
              }
            ],
      documents: purchaseOrder.documents ?? []
    };
    const createdReceipt: PendingReceipt = {
      ...pendingReceipt,
      lines: pendingReceipt.lines.map((line) => ({
        ...line,
        receivedQuantity: line.receivedQuantity ?? 0,
        damagedQuantity: line.damagedQuantity ?? 0,
        reviewQuantity: line.reviewQuantity ?? 0,
        receiptNotes: line.receiptNotes ?? ""
      }))
    };

    setPurchaseOrders((currentOrders) => [createdOrder, ...currentOrders]);
    setPendingReceipts((currentReceipts) => [createdReceipt, ...currentReceipts]);

    setPurchaseRequests((currentRequests) =>
      currentRequests.map((request) =>
        sourceRequestIds.has(request.id)
          ? {
              ...request,
              supplierId: purchaseOrder.supplierId,
              status: "comprado"
            }
          : request
      )
    );

    if (supplier) {
      purchaseOrder.lines.forEach((line) => {
        assignSupplierToProductComponent(line.productId, line.componentId, supplier);
      });
    }
  }

  function addPurchaseMessage(message: PurchaseMessage) {
    setPurchaseMessages((currentMessages) => [message, ...currentMessages]);
  }

  function addPurchaseOrderDocument(orderId: string, document: PurchaseOrderDocument) {
    setPurchaseOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              documents: [document, ...(order.documents ?? [])],
              history: [
                {
                  id: purchaseId("po-history"),
                  at: document.uploadedAt,
                  action: "Documento agregado",
                  detail: `${document.fileName} fue ligado a ${order.folio}.`
                },
                ...(order.history ?? [])
              ]
            }
          : order
      )
    );
  }

  function receivePurchaseReceipt(
    receiptId: string,
    lineUpdates: PurchaseReceiptLineUpdate[],
    status: PurchaseReceiptStatus,
    issue: PurchaseReceiptIssue | "",
    issueNotes: string
  ) {
    const receipt = pendingReceipts.find((currentReceipt) => currentReceipt.id === receiptId);

    if (!receipt) {
      return;
    }

    const updatesByLine = new Map(lineUpdates.map((lineUpdate) => [lineUpdate.lineId, lineUpdate]));
    const receivedAt = new Date().toISOString();
    const updatedLines = receipt.lines.map((line) => {
      const update = updatesByLine.get(line.id);

      return {
        ...line,
        receivedQuantity: Math.max(0, Math.min(line.quantity, update?.receivedQuantity ?? line.receivedQuantity)),
        damagedQuantity: Math.max(0, Math.min(line.quantity, update?.damagedQuantity ?? line.damagedQuantity)),
        reviewQuantity: Math.max(0, Math.min(line.quantity, update?.reviewQuantity ?? line.reviewQuantity)),
        receiptNotes: update?.receiptNotes ?? line.receiptNotes
      };
    });
    const orderStatus =
      status === "recibida"
        ? "recibida"
        : status === "parcial"
          ? "parcial"
          : status === "pendiente-revision"
            ? "pendiente-revision"
            : "problema";
    const order = purchaseOrders.find((currentOrder) => currentOrder.id === receipt.purchaseOrderId);
    const issueLabel = issue ? purchaseReceiptIssueLabels[issue] : "Recepción";
    const problemRequests = updatedLines.flatMap((line): PurchaseRequest[] => {
      const missingQuantity = Math.max(line.quantity - line.receivedQuantity - line.damagedQuantity - line.reviewQuantity, 0);
      const damagedQuantity = line.damagedQuantity;
      const reviewQuantity = line.reviewQuantity;
      const sourceBase = `receipt:${receipt.id}:${line.id}`;
      const requests: PurchaseRequest[] = [];

      if (missingQuantity > 0 && (status === "parcial" || issue === "incompleto")) {
        requests.push({
          id: purchaseId("request-receipt"),
          type: "problema",
          source: "almacen",
          sourceRef: `${sourceBase}:missing`,
          productId: line.productId,
          componentId: line.componentId,
          itemName: line.itemName,
          productSku: line.productSku,
          quantity: missingQuantity,
          unit: line.unit,
          supplierId: order?.supplierId ?? null,
          requiredDate: futureDate(2),
          priority: "alta",
          status: "bloqueado",
          reason: `Faltante en recepción ${receipt.purchaseOrderFolio}.`,
          notes: issueNotes || line.receiptNotes || "Almacén recibió menos cantidad de la esperada."
        });
      }

      if (damagedQuantity > 0) {
        requests.push({
          id: purchaseId("request-receipt"),
          type: "problema",
          source: "almacen",
          sourceRef: `${sourceBase}:damaged`,
          productId: line.productId,
          componentId: line.componentId,
          itemName: line.itemName,
          productSku: line.productSku,
          quantity: damagedQuantity,
          unit: line.unit,
          supplierId: order?.supplierId ?? null,
          requiredDate: futureDate(2),
          priority: "alta",
          status: "bloqueado",
          reason: `Material dañado en recepción ${receipt.purchaseOrderFolio}.`,
          notes: issueNotes || line.receiptNotes || "Almacén reportó material dañado."
        });
      }

      if (reviewQuantity > 0) {
        requests.push({
          id: purchaseId("request-receipt"),
          type: "problema",
          source: "almacen",
          sourceRef: `${sourceBase}:review`,
          productId: line.productId,
          componentId: line.componentId,
          itemName: line.itemName,
          productSku: line.productSku,
          quantity: reviewQuantity,
          unit: line.unit,
          supplierId: order?.supplierId ?? null,
          requiredDate: futureDate(2),
          priority: "normal",
          status: "bloqueado",
          reason: `Recepción pendiente de revisión ${receipt.purchaseOrderFolio}.`,
          notes: issueNotes || line.receiptNotes || "Almacén dejó material pendiente de revisión."
        });
      }

      return requests;
    });

    setPendingReceipts((currentReceipts) =>
      currentReceipts.map((currentReceipt) =>
        currentReceipt.id === receiptId
          ? {
              ...currentReceipt,
              status,
              receivedAt,
              issue,
              issueNotes,
              lines: updatedLines
            }
          : currentReceipt
      )
    );

    setPurchaseOrders((currentOrders) =>
      currentOrders.map((currentOrder) =>
        currentOrder.id === receipt.purchaseOrderId
          ? {
              ...currentOrder,
              status: orderStatus,
              history: [
                {
                  id: purchaseId("po-history"),
                  at: receivedAt,
                  action: "Recepción registrada",
                  detail: `${issueLabel} registrada para ${currentOrder.folio}.`
                },
                ...(currentOrder.history ?? [])
              ]
            }
          : currentOrder
      )
    );

    if (problemRequests.length > 0) {
      setPurchaseRequests((currentRequests) => {
        const existingRefs = new Set(currentRequests.map((request) => request.sourceRef));
        const uniqueProblemRequests = problemRequests.filter((request) => !existingRefs.has(request.sourceRef));

        return uniqueProblemRequests.length > 0 ? [...uniqueProblemRequests, ...currentRequests] : currentRequests;
      });
    }
  }

  if (selectedProfile) {
    return (
      <ProfileScreen
        pendingReceipts={pendingReceipts}
        products={products}
        profile={selectedProfile}
        purchaseMessages={purchaseMessages}
        purchaseOrders={purchaseOrders}
        purchaseRequests={purchaseRequests}
        suppliers={suppliers}
        onAddPurchaseMessage={addPurchaseMessage}
        onAddSupplier={addSupplier}
        onBack={() => setSelectedProfile(null)}
        onAddPurchaseOrderDocument={addPurchaseOrderDocument}
        onCreatePurchaseOrder={createPurchaseOrder}
        onReceivePurchaseReceipt={receivePurchaseReceipt}
        onResolveRequestSupplier={resolveRequestSupplier}
      />
    );
  }

  if (isProductCatalogOpen) {
    return (
      <ProductCatalogScreen
        products={products}
        onBack={() => setProductCatalogOpen(false)}
        onSaveProduct={saveProduct}
      />
    );
  }

  return <ProfileSelector onOpenProducts={() => setProductCatalogOpen(true)} onSelect={setSelectedProfile} />;
}
