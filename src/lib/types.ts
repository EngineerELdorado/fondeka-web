export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface Store {
  id: number;
  name: string;
  slug: string;
  description?: string;
  defaultCurrency: string;
  countryCode?: string;
  contactEmail?: string;
  status: string;
  visibility?: string;
  accessType?: string;
  staffPermissions?: string[];
  storefrontUrl?: string;
  publicUrl?: string;
  createdAt?: string;
}
export interface StoreInput {
  name: string;
  description: string;
  defaultCurrency: string;
  countryCode: string;
  contactEmail?: string;
  status?: string;
}
export interface Product {
  id: number;
  storeId: number;
  name: string;
  priceAmount: number;
  priceCurrency: string;
  status: string;
  type?: string;
  sku?: string;
  inventoryPolicy?: string;
  inventoryQuantity?: number;
}
export interface ProductInput {
  name: string;
  priceAmount: number;
  priceCurrency: string;
  sku: string;
  type: string;
  status: string;
  inventoryPolicy: string;
  storefrontEnabled: boolean;
}
export interface PaymentRequest {
  id: number;
  title: string;
  description?: string;
  type: "QUICK_CHARGE" | "INVOICE" | "DONATION";
  currency: string;
  amount: number;
  totalCollected: number;
  lifecycle: string;
  approvalStatus?: string;
  linkCode: string;
  paymentLink?: string;
}
export interface PaymentInput {
  title: string;
  description: string;
  type: "QUICK_CHARGE" | "INVOICE";
  currency: string;
  amount: number;
  feeInclusion: "ABSORBED" | "ON_TOP";
}
export interface Order {
  id: number;
  reference: string;
  storeId: number;
  storeName?: string;
  buyerName?: string;
  channel: string;
  status: string;
  posPaymentStatus?: string;
  totalAmount: number;
  totalCurrency: string;
  createdAt: string;
}
export interface PosInput {
  items: { productId: number; quantity: number }[];
  billingCurrency: string;
  paymentCurrency: string;
  paymentMode: "CASH";
  paymentStatus: "PAID";
  buyerName?: string;
}
export interface Quote {
  totalAmount: number;
  totalCurrency: string;
  feeAmount: number;
  feeCurrency?: string;
  expiresAt?: string;
}
export interface Business {
  id: number;
  name: string;
  legalName?: string;
  status: string;
  kybStatus: string;
  defaultBusiness?: boolean;
  countryCode?: string;
}
export interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  enabled: boolean;
  webhookUrl?: string;
  createdAt: string;
}
export interface ApiTransaction {
  requestId: number;
  apiKeyName: string;
  createdAt: string;
  updatedAt?: string;
  transaction: {
    businessId?: number;
    transactionId?: number;
    reference: string;
    clientReference?: string;
    status: string;
    amount?: number;
    currency?: string;
    action?: string;
    grossAmount?: number;
    allFees?: number;
    settlementNet?: number;
    refunded?: boolean;
    cryptoDetails?: {
      address?: string;
      cryptoCurrency?: string;
      network?: string;
      amountInCrypto?: number;
      exchangeRate?: number;
      invoiceUrl?: string;
      expiresAt?: string;
    } | null;
  };
}
