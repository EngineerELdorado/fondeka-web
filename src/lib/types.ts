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
export const productTypes = ["PHYSICAL", "DIGITAL", "SERVICE", "TRAINING"] as const;
export type ProductType = (typeof productTypes)[number];
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
  amount: number | null;
  totalCollected: number;
  lifecycle: string;
  approvalStatus?: string;
  linkCode: string;
  paymentLink?: string;
}
export interface PaymentInput {
  title: string;
  description: string;
  type: "QUICK_CHARGE" | "INVOICE" | "DONATION";
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
  paymentMode: "CASH" | "FONDEKA";
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "ON_CREDIT";
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
  legalName?: string | null;
  status: string;
  kybStatus: string;
  defaultBusiness?: boolean;
  countryCode?: string | null;
  registrationNumber?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export type ApiEnvironment = "LIVE" | "SANDBOX";
export interface ApiWallet {
  currency: string;
  balance: number;
  environment: ApiEnvironment;
}
export interface SandboxWalletEntry {
  id: string;
  currency: string;
  kind: string;
  amount: number;
  balanceAfter: number;
  businessId: number;
  paymentReference: string | null;
  createdAt: string;
  environment: "SANDBOX";
  sequence: number;
  conversionId?: string | null;
}
export interface SandboxConversionInput {
  sourceCurrency: string;
  targetCurrency: string;
  amount: number;
}
export interface SandboxConversion {
  id: string | null;
  status: "QUOTED" | "COMPLETED";
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  feeAmount: number;
  netSourceAmount: number;
  targetAmount: number;
  rate: number;
  sourceWallet: ApiWallet;
  targetWallet: ApiWallet;
  createdAt: string | null;
  environment: "SANDBOX";
}
export interface ApiKey {
  id: number;
  businessId?: number;
  name: string;
  keyPrefix: string;
  enabled: boolean;
  webhookUrl?: string;
  createdAt: string;
  environment?: ApiEnvironment;
}
export type BusinessApiPaymentStatus = "ACCEPTED" | "PROCESSING" | "COMPLETED" | "FAILED";
export interface ApiTransaction {
  requestId: number;
  apiKeyId: number;
  apiKeyName: string;
  createdAt: string;
  updatedAt: string;
  transaction: {
    environment: ApiEnvironment;
    failureCode?: string;
    failureMessage?: string;
    fondekaReference: string;
    clientReference?: string | null;
    status: BusinessApiPaymentStatus;
    amount: number;
    currency: string;
    service: "BUSINESS_API";
    action: "BUSINESS_API_COLLECTION" | "BUSINESS_API_PAYOUT";
    grossAmount: number;
    fee: number;
    cryptoDetails?: {
      address?: string | null;
      cryptoCurrency?: string | null;
      network?: string | null;
      amountInCrypto?: number | null;
      exchangeRate?: number | null;
      exchangeRateCurrency?: string | null;
      invoiceUrl?: string | null;
      expiresAt?: string | null;
    } | null;
  };
}

export interface Store {
  ownerAccountId?: number;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  videoUrl?: string | null;
  videoDurationSeconds?: number | null;
  reportCurrency?: string;
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  effectiveProductVideoMaxBytes?: number;
  effectiveProductVideoMaxDurationSeconds?: number;
  verificationStatus?: string;
}
export interface StoreInput {
  slug?: string;
  visibility?: string;
  reportCurrency?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  videoUrl?: string | null;
  videoDurationSeconds?: number | null;
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
}
export interface Product {
  description?: string;
  slug?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  videoUrl?: string;
  videoDurationSeconds?: number;
  videoThumbnailUrl?: string;
  barcodeOrQrCode?: string;
  requiresShipping?: boolean;
  fulfillmentUrl?: string;
  fulfillmentInstructions?: string;
  digitalAssetKey?: string;
  storefrontEnabled?: boolean;
  directLinkEnabled?: boolean;
  marketplaceEnabled?: boolean;
  marketplaceApproved?: boolean;
  marketplaceCategory?: string;
  productUrl?: string;
  publicUrl?: string;
}
export interface PayerField {
  key: string;
  label: string;
  required: boolean;
}
export interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
}
export interface PaymentRequest {
  minAmount?: number | null;
  maxAmount?: number | null;
  goalAmount?: number | null;
  minimumAmountEnabled?: boolean;
  showRecentPaymentsPublicly?: boolean;
  allowPartial?: boolean;
  feeInclusion?: string;
  activationAt?: string;
  expiresAt?: string;
  image1?: string | null;
  image2?: string | null;
  image3?: string | null;
  image4?: string | null;
  metadata?: Record<string, unknown>;
  payerFields?: PayerField[];
  items?: InvoiceItem[];
  settlement?: {
    paymentMethodId: number;
    paymentMethodType?: string;
    accountRef?: string;
    networkId?: number;
    currency?: string;
  } | null;
}
export interface RequestPayment {
  id: number;
  transactionId?: number;
  payerName?: string;
  payerReference?: string;
  phoneNumber?: string;
  amount: number;
  payerAnonymous?: boolean;
  payerFields?: Record<string, string>;
  createdAt: string;
}
export interface Customer {
  id: number;
  storeId: number;
  name?: string;
  email?: string;
  phone?: string;
  note?: string;
}
export interface Staff {
  storeId?: number;
  id: number;
  email: string;
  name?: string;
  permissions: string[];
  createdAt?: string;
}
export interface SaleItem {
  productId?: number;
  productName?: string;
  quantity: number;
  unitPriceAmount?: number;
  unitPriceCurrency?: string;
  totalAmount?: number;
  totalCurrency?: string;
  lineTotalAmount?: number;
  lineTotalCurrency?: string;
}
export interface Order {
  accessToken?: string;
  customerId?: number;
  buyerEmail?: string;
  buyerPhone?: string;
  items?: SaleItem[];
  paymentTransactionId?: number;
  paymentTransactionReference?: string;
  paymentTransactionStatus?: string;
  posPaymentMode?: string;
  amountPaid?: number;
  amountPaidCurrency?: string;
  balanceDue?: number;
  balanceDueCurrency?: string;
  outstandingAmount?: number;
  outstandingCurrency?: string;
  paymentDueDate?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  feeAmount?: number;
  feeCurrency?: string;
  cryptoDetails?: ApiTransaction["transaction"]["cryptoDetails"];
}
export interface PosInput {
  customerId?: number;
  buyerEmail?: string;
  buyerPhone?: string;
  amountPaid?: number;
  amountPaidCurrency?: string;
  paymentDueDate?: string;
}
export interface SalesReport {
  period: string;
  currency: string;
  availableCurrencies: string[];
  fromDate: string;
  toDate: string;
  totalSalesAmount: number;
  amountPaid: number;
  balanceDue: number;
  merchantProceedsAmount: number;
  orderCount: number;
  paidOrderCount: number;
  partialOrderCount: number;
  creditOrderCount: number;
  topProducts: {
    productId: number;
    productName: string;
    quantitySold: number;
    salesAmount: number;
    salesCurrency: string;
  }[];
  unpaidCustomers: {
    customerId?: number;
    customerName?: string;
    buyerName?: string;
    balanceDue?: number;
    balanceDueCurrency: string;
  }[];
  salesByStatus?: { key: string; count: number }[];
}
