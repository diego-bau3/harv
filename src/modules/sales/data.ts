import type { Client, Product, SalesUser } from "./types";

export const salesUser: SalesUser = {
  name: "",
  permissions: {
    verifyPayment: true,
    approveCredit: true,
    approveCommercial: true,
    cancelOrder: true
  }
};

export const initialClients: Client[] = [];

export const productCatalog: Product[] = [];
