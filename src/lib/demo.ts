import type {
  ApiKey,
  ApiEnvironment,
  ApiTransaction,
  Business,
  Order,
  Page,
  PaymentInput,
  PaymentRequest,
  PosInput,
  Product,
  ProductInput,
  Store,
  StoreInput,
  SandboxWalletEntry,
  SandboxConversion,
  SandboxConversionInput,
  Customer,
  Staff,
  RequestPayment,
} from "./types";
import { amountInMinorUnits } from "./format";
import { apiEnvironment } from "./api-environment";
import { sandboxFundingBody, walletCurrency } from "./api-wallets";
import { conversionInput } from "./sandbox-conversion";
import type { ApiCatalog } from "./api-catalog";
import {
  businessDetailsDraft,
  businessDetailsErrors,
  businessDetailsPatch,
} from "./business-profile";

const storageKey = "fondeka-business-demo-v1";
interface DemoData {
  businesses?: Business[];
  customers?: Customer[];
  staff?: Staff[];
  requestPayments?: (RequestPayment & { requestId: number })[];
  collections?: Record<
    string,
    { transactionId: number; status: string; attemptId: number; requestId?: number; body?: string }
  >;
  stores: Store[];
  products: Product[];
  requests: PaymentRequest[];
  orders: Order[];
  sandboxFunding?: {
    entries: SandboxWalletEntry[];
    intents: Record<string, SandboxWalletEntry>;
  };
  sandboxConversions?: Record<string, { body: SandboxConversionInput; result: SandboxConversion }>;
}
// Synthetic fixtures for the browser-local demo only. Real quotes always come from Fondeka.
const demoRates: Record<string, number> = {
  USD: 100,
  EUR: 90,
  GBP: 80,
  CDF: 280000,
  XAF: 60000,
  XOF: 60000,
  KES: 13000,
  NGN: 150000,
  RWF: 140000,
  UGX: 370000,
  TZS: 260000,
  GHS: 1500,
  ZAR: 1800,
};
function demoConversionQuote(db: DemoData, body: SandboxConversionInput): SandboxConversion {
  const sourceRate = demoRates[body.sourceCurrency];
  const targetRate = demoRates[body.targetCurrency];
  if (!sourceRate || !targetRate)
    throw Object.assign(new Error("This pair has no synthetic demo conversion rate."), {
      status: 400,
      code: "INVALID_REQUEST",
    });
  const sourceCents = BigInt(Math.round(body.amount * 100));
  const targetCents =
    (sourceCents * BigInt(targetRate) + BigInt(sourceRate) / 2n) / BigInt(sourceRate);
  if (targetCents <= 0n || targetCents > 99999999999999n)
    throw Object.assign(new Error("The converted amount is outside the supported test range."), {
      status: 400,
      code: "INVALID_REQUEST",
    });
  const balance = (currency: string) => ({
    currency,
    balance:
      db.sandboxFunding?.entries.find((entry) => entry.currency === currency)?.balanceAfter ?? 0,
    environment: "SANDBOX" as const,
  });
  return {
    id: null,
    status: "QUOTED",
    sourceCurrency: body.sourceCurrency,
    targetCurrency: body.targetCurrency,
    sourceAmount: body.amount,
    feeAmount: 0,
    netSourceAmount: body.amount,
    targetAmount: Number(targetCents) / 100,
    rate: Number((targetRate / sourceRate).toFixed(12)),
    sourceWallet: balance(body.sourceCurrency),
    targetWallet: balance(body.targetCurrency),
    createdAt: null,
    environment: "SANDBOX",
  };
}
const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString();
function seed(): DemoData {
  return {
    stores: [
      {
        id: 1,
        name: "Atelier Kin",
        slug: "atelier-kin",
        description: "Everyday essentials, thoughtfully made.",
        defaultCurrency: "USD",
        countryCode: "CD",
        status: "ACTIVE",
        accessType: "OWNER",
        createdAt: day(90),
      },
      {
        id: 2,
        name: "Matonge Market",
        slug: "matonge-market",
        description: "Good things for your home and your day.",
        defaultCurrency: "USD",
        countryCode: "CD",
        status: "ACTIVE",
        accessType: "OWNER",
        createdAt: day(45),
      },
      {
        id: 3,
        name: "Studio Gombe",
        slug: "studio-gombe",
        description: "A little space for big ideas.",
        defaultCurrency: "USD",
        countryCode: "CD",
        status: "DRAFT",
        accessType: "OWNER",
        createdAt: day(4),
      },
    ],
    products: [
      {
        id: 1,
        storeId: 1,
        name: "Canvas tote",
        priceAmount: 24,
        priceCurrency: "USD",
        status: "ACTIVE",
        sku: "AK-001",
        inventoryPolicy: "TRACKED",
        inventoryQuantity: 32,
      },
      {
        id: 2,
        storeId: 1,
        name: "Everyday notebook",
        priceAmount: 12.5,
        priceCurrency: "USD",
        status: "ACTIVE",
        sku: "AK-002",
        inventoryPolicy: "TRACKED",
        inventoryQuantity: 64,
      },
      {
        id: 3,
        storeId: 1,
        name: "Ceramic mug",
        priceAmount: 18,
        priceCurrency: "USD",
        status: "ACTIVE",
        sku: "AK-003",
        inventoryPolicy: "TRACKED",
        inventoryQuantity: 18,
      },
      {
        id: 4,
        storeId: 1,
        name: "Cotton tee",
        priceAmount: 35,
        priceCurrency: "USD",
        status: "ACTIVE",
        sku: "AK-004",
        inventoryPolicy: "TRACKED",
        inventoryQuantity: 27,
      },
      {
        id: 5,
        storeId: 1,
        name: "Desk organizer",
        priceAmount: 42,
        priceCurrency: "USD",
        status: "ACTIVE",
        sku: "AK-005",
        inventoryPolicy: "TRACKED",
        inventoryQuantity: 12,
      },
      {
        id: 6,
        storeId: 1,
        name: "Gift card",
        priceAmount: 50,
        priceCurrency: "USD",
        status: "ACTIVE",
        sku: "AK-006",
        inventoryPolicy: "UNLIMITED",
      },
      {
        id: 7,
        storeId: 2,
        name: "Woven basket",
        priceAmount: 28,
        priceCurrency: "USD",
        status: "ACTIVE",
        inventoryPolicy: "TRACKED",
        inventoryQuantity: 20,
      },
      {
        id: 8,
        storeId: 2,
        name: "Linen cushion",
        priceAmount: 32,
        priceCurrency: "USD",
        status: "ACTIVE",
        inventoryPolicy: "TRACKED",
        inventoryQuantity: 15,
      },
    ],
    requests: [
      {
        id: 1,
        title: "Brand identity · October",
        description: "Design services",
        type: "INVOICE",
        currency: "USD",
        amount: 1250,
        totalCollected: 1250,
        lifecycle: "COMPLETED",
        approvalStatus: "APPROVED",
        linkCode: "DEMO-001",
      },
      {
        id: 2,
        title: "Wholesale order #1048",
        type: "INVOICE",
        currency: "USD",
        amount: 860,
        totalCollected: 0,
        lifecycle: "ACTIVE",
        approvalStatus: "APPROVED",
        linkCode: "DEMO-002",
      },
      {
        id: 3,
        title: "Workshop registration",
        type: "QUICK_CHARGE",
        currency: "USD",
        amount: 45,
        totalCollected: 315,
        lifecycle: "ACTIVE",
        approvalStatus: "APPROVED",
        linkCode: "DEMO-003",
      },
      {
        id: 4,
        title: "Office supply delivery",
        type: "INVOICE",
        currency: "USD",
        amount: 235,
        totalCollected: 235,
        lifecycle: "COMPLETED",
        approvalStatus: "APPROVED",
        linkCode: "DEMO-004",
      },
    ],
    orders: Array.from({ length: 38 }, (_, i) => ({
      id: 100 + i,
      reference: `FK-${24038 - i}`,
      storeId: i % 3 === 0 ? 2 : 1,
      storeName: i % 3 === 0 ? "Matonge Market" : "Atelier Kin",
      buyerName: ["Marie K.", "Patrick M.", "Walk-in customer", "Sarah L.", "Jean B.", "Amara D."][
        i % 6
      ],
      channel: i % 3 === 0 ? "STOREFRONT" : "POS",
      status: i % 9 === 0 ? "PENDING" : "PAID",
      totalAmount: [142, 86.5, 210, 54, 128, 72, 340, 168][i % 8],
      totalCurrency: "USD",
      createdAt: new Date(Date.now() - i * 17_400_000).toISOString(),
    })),
  };
}
let memory: DemoData | undefined;
function data() {
  if (memory) return memory;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      saved &&
      ["stores", "products", "requests", "orders"].every((key) => Array.isArray(saved[key]))
    )
      memory = saved;
  } catch {
    /* Storage can be unavailable or contain an older demo. */
  }
  return (memory ??= seed());
}
function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(memory));
  } catch {
    /* The demo still works in memory. */
  }
}
export function resetDemo() {
  memory = seed();
  persist();
}
function paginate<T>(items: T[], params: URLSearchParams): Page<T> {
  const number = Math.max(0, Number(params.get("page") || 0));
  const size = Math.max(1, Math.min(100, Number(params.get("size") || 20)));
  return {
    content: items.slice(number * size, (number + 1) * size),
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
    number,
    size,
  };
}
function nextId(items: { id: number }[]) {
  return Math.max(0, ...items.map((item) => item.id)) + 1;
}

export async function demoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const url = new URL(path, "https://demo.local");
  const route = url.pathname.replace("/customer-api", "");
  const method = init.method ?? "GET";
  const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  const db = data();
  db.customers ??= [
    {
      id: 1,
      storeId: 1,
      name: "Demo customer",
      email: "customer@example.test",
      phone: "+243000000000",
    },
  ];
  db.staff ??= [];
  db.requestPayments ??= [];
  db.collections ??= {};
  db.businesses ??= [
    {
      id: 1,
      name: "Atelier Kin",
      legalName: "Atelier Kin SARL",
      countryCode: "CD",
      status: "ACTIVE",
      kybStatus: "APPROVED",
      defaultBusiness: true,
    },
  ];

  let result: unknown;
  if (route === "/business-tools/access" && method === "GET") {
    result = {
      accessGranted: true,
      status: "ACTIVE",
      validFrom: null,
      validUntil: null,
      plan: {
        code: "DEMO_BUSINESS_TOOLS",
        name: "Business Tools",
        billingMode: "ONE_TIME",
        amount: 0,
        currency: "USD",
        purchasesEnabled: false,
        version: 1,
      },
      pendingPurchase: null,
      pricing: { planAmount: 0, legacyCreditAmount: 0, amountDue: 0, currency: "USD" },
    };
  } else if (route === "/commerce/stores") {
    if (method === "POST") {
      const input = body as StoreInput;
      const store: Store = {
        ...input,
        id: nextId(db.stores),
        slug: input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        status: "ACTIVE",
        accessType: "OWNER",
        createdAt: new Date().toISOString(),
      };
      db.stores.unshift(store);
      result = store;
    } else result = paginate(db.stores, url.searchParams);
  } else if (/^\/commerce\/stores\/\d+$/.test(route)) {
    const store = db.stores.find((item) => item.id === Number(route.split("/")[3]));
    if (!store) throw new Error("This store could not be found.");
    if (method === "PATCH") Object.assign(store, body);
    if (method === "DELETE") db.stores = db.stores.filter((s) => s.id !== store.id);
    result = store;
  } else if (/^\/commerce\/stores\/\d+\/products$/.test(route)) {
    const storeId = Number(route.split("/")[3]);
    if (method === "POST") {
      const product: Product = { ...(body as ProductInput), storeId, id: nextId(db.products) };
      db.products.unshift(product);
      result = product;
    } else
      result = paginate(
        db.products.filter((item) => item.storeId === storeId),
        url.searchParams,
      );
  } else if (/^\/commerce\/stores\/\d+\/orders$/.test(route)) {
    result = paginate(
      db.orders.filter((item) => item.storeId === Number(route.split("/")[3])),
      url.searchParams,
    );
  } else if (/^\/commerce\/stores\/\d+\/pos\/orders(?:\/quote)?$/.test(route)) {
    const storeId = Number(route.split("/")[3]);
    const input = body as PosInput;
    const store = db.stores.find((item) => item.id === storeId);
    if (!store || store.status !== "ACTIVE") throw new Error("Choose an active store.");
    if (!input.items?.length) throw new Error("Add a product to the sale.");
    let total = 0;
    for (const item of input.items) {
      const product = db.products.find(
        (product) => product.id === item.productId && product.storeId === storeId,
      );
      if (!product || product.status !== "ACTIVE")
        throw new Error("A product is no longer available.");
      if (product.priceCurrency !== input.billingCurrency)
        throw new Error("All sale items must use the same currency.");
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0)
        throw new Error("Enter a valid quantity.");
      if (product.inventoryPolicy === "TRACKED" && (product.inventoryQuantity ?? 0) < item.quantity)
        throw new Error(`${product.name} does not have enough stock.`);
      total += amountInMinorUnits(product.priceAmount, input.billingCurrency) * item.quantity;
    }
    const digits =
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: input.billingCurrency,
      }).resolvedOptions().maximumFractionDigits ?? 2;
    result = {
      totalAmount: total / 10 ** digits,
      totalCurrency: input.billingCurrency,
      feeAmount: 0,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    };
    if (!route.endsWith("/quote")) {
      for (const item of input.items) {
        const product = db.products.find((product) => product.id === item.productId)!;
        if (product.inventoryPolicy === "TRACKED")
          product.inventoryQuantity = (product.inventoryQuantity ?? 0) - item.quantity;
      }
      const order: Order = {
        id: nextId(db.orders),
        reference: `FK-DEMO-${Date.now()}`,
        storeId,
        storeName: store.name,
        buyerName: input.buyerName || "Walk-in customer",
        channel: "POS",
        status: input.paymentMode === "FONDEKA" ? "PENDING_PAYMENT" : input.paymentStatus || "PAID",
        posPaymentStatus: input.paymentStatus || "PAID",
        posPaymentMode: input.paymentMode || "CASH",
        customerId: input.customerId,
        buyerPhone: input.buyerPhone,
        buyerEmail: input.buyerEmail,
        amountPaid:
          input.paymentMode === "FONDEKA" ? 0 : (input.amountPaid ?? total / 10 ** digits),
        amountPaidCurrency: input.billingCurrency,
        balanceDue:
          input.paymentMode === "FONDEKA"
            ? undefined
            : total / 10 ** digits - (input.amountPaid ?? total / 10 ** digits),
        balanceDueCurrency: input.billingCurrency,
        paymentDueDate: input.paymentDueDate,
        accessToken: "demo-order-token",
        paymentCurrency: input.paymentCurrency,
        paymentAmount: total / 10 ** digits,
        items: input.items.map((item) => {
          const p = db.products.find((p) => p.id === item.productId)!;
          return {
            productId: p.id,
            productName: p.name,
            quantity: item.quantity,
            unitPriceAmount: p.priceAmount,
            unitPriceCurrency: p.priceCurrency,
            totalAmount: p.priceAmount * item.quantity,
            totalCurrency: p.priceCurrency,
          };
        }),
        totalAmount: total / 10 ** digits,
        totalCurrency: input.billingCurrency,
        createdAt: new Date().toISOString(),
      };
      db.orders.unshift(order);
      result = order;
    }
  } else if (route === "/payment_requests") {
    if (method === "POST") {
      const input = body as PaymentInput;
      const request: PaymentRequest = {
        ...input,
        id: nextId(db.requests),
        totalCollected: 0,
        lifecycle: "ACTIVE",
        approvalStatus: "APPROVED",
        linkCode: `DEMO-${Date.now()}`,
      };
      db.requests.unshift(request);
      result = request;
    } else result = paginate(db.requests, url.searchParams);
  } else if (/^\/payment_requests\/\d+\/cancel$/.test(route)) {
    const item = db.requests.find((item) => item.id === Number(route.split("/")[2]));
    if (!item) throw new Error("Payment request not found.");
    item.lifecycle = "CANCELLED";
    result = item;
  } else if (route === "/accounts/my-account") {
    result = {
      countryCode: "CD",
      defaultFiatCurrency: "USD",
      savingsEnabled: true,
      serviceAccess: { SAVINGS: { enabled: true } },
    };
  } else if (route === "/fiat-wallets/currencies") {
    result = [
      { currency: "USD", enabled: true },
      { currency: "CDF", enabled: true },
      { currency: "EUR", enabled: true },
    ];
  } else if (route === "/fiat-wallets") {
    result = [
      { id: 1, currency: "USD", balance: 1000 },
      { id: 2, currency: "CDF", balance: 2800000 },
    ];
  } else if (route === "/payment_methods") {
    result = {
      paymentMethods: [
        {
          id: 1,
          name: "Balance",
          type: "BALANCE",
          fiatWalletId: 1,
          currency: "USD",
          balance: 1000,
        },
        {
          id: 1,
          name: "Balance",
          type: "BALANCE",
          fiatWalletId: 2,
          currency: "CDF",
          balance: 2800000,
        },
        { id: 2, name: "M-Pesa", type: "MOBILE_MONEY", currency: "USD" },
        { id: 3, name: "USDT", type: "CRYPTO", currency: "USD" },
      ],
      ui: { showCountrySelector: false },
    };
  } else if (route === "/fees") {
    const currency = url.searchParams.get("paymentCurrency") || "USD";
    if (currency !== (url.searchParams.get("currency") || "USD"))
      throw new Error("Demo quotes support the same currency only.");
    result = {
      fees: 0,
      feesCurrency: currency,
      totalToPay: Number(url.searchParams.get("amount")),
      totalToPayCurrency: currency,
    };
  } else if (/^\/crypto-networks\/payment-methods\/\d+\/networks$/.test(route)) {
    result = [{ id: 1, name: "TRC20", displayName: "TRON (TRC20)" }];
  } else if (route === "/payment_requests/type-settings") {
    result = ["QUICK_CHARGE", "INVOICE", "DONATION"].map((type) => ({
      type,
      allowCustomSettlement: false,
      allowAutoApproveOnCreate: true,
    }));
  } else if (/^\/payment_requests\/\d+$/.test(route)) {
    const item = db.requests.find((p) => p.id === Number(route.split("/")[2]));
    if (!item) throw new Error("Request not found.");
    if (method === "PUT") Object.assign(item, body);
    if (method === "DELETE") {
      if (db.requestPayments.some((p) => p.requestId === item.id))
        throw new Error("A request with payments cannot be deleted.");
      db.requests = db.requests.filter((p) => p.id !== item.id);
    }
    result = item;
  } else if (/^\/payment_requests\/\d+\/payments$/.test(route)) {
    result = paginate(
      db.requestPayments.filter((p) => p.requestId === Number(route.split("/")[2])),
      url.searchParams,
    );
  } else if (/^\/payment_requests\/\d+\/collect$/.test(route)) {
    const item = db.requests.find((p) => p.id === Number(route.split("/")[2]));
    if (!item || item.lifecycle !== "ACTIVE") throw new Error("This request is not active.");
    const collectionKey = item.id + ":" + body.idempotencyKey;
    const existing = db.collections[collectionKey] || db.collections[body.idempotencyKey];
    if (existing && existing.body && existing.body !== JSON.stringify(body))
      throw Object.assign(new Error("This intent has different payment details."), { status: 409 });
    if (existing) result = existing;
    else {
      const id = 9000 + Object.keys(db.collections).length;
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a positive amount.");
      item.totalCollected += amount;
      db.requestPayments.unshift({
        id,
        requestId: item.id,
        transactionId: id,
        payerName: body.payerDisplayName || "Demo payer",
        payerReference: body.payerReference,
        phoneNumber: body.accountNumber,
        payerFields: body.payerFields,
        amount,
        createdAt: new Date().toISOString(),
      });
      result = db.collections[collectionKey] = {
        transactionId: id,
        attemptId: id,
        status: "COMPLETED",
        requestId: item.id,
        body: JSON.stringify(body),
      };
    }
  } else if (/^\/transactions\/\d+$/.test(route)) {
    const p = db.requestPayments.find((p) => p.transactionId === Number(route.split("/")[2]));
    const order = db.orders.find((o) => o.paymentTransactionId === Number(route.split("/")[2]));
    result = {
      id: Number(route.split("/")[2]),
      reference: `DEMO-${route.split("/")[2]}`,
      status: "COMPLETED",
      amount: p?.amount || order?.paymentAmount || 10,
      grossAmount: p?.amount || order?.paymentAmount || 10,
      currency:
        (p ? db.requests.find((r) => r.id === p.requestId)?.currency : order?.paymentCurrency) ||
        "USD",
      displayMessage: "Demo payment only. No real money moved.",
    };
  } else if (/^\/commerce\/products\/\d+$/.test(route)) {
    const p = db.products.find((p) => p.id === Number(route.split("/")[3]));
    if (!p) throw new Error("Product not found.");
    if (method === "PATCH") Object.assign(p, body);
    result = p;
  } else if (/^\/commerce\/stores\/\d+\/pos\/products\/search$/.test(route)) {
    const query = (url.searchParams.get("query") || "").toLowerCase();
    result = paginate(
      db.products.filter(
        (p) =>
          p.storeId === Number(route.split("/")[3]) &&
          `${p.name} ${p.sku || ""} ${p.barcodeOrQrCode || ""}`.toLowerCase().includes(query),
      ),
      url.searchParams,
    );
  } else if (/^\/commerce\/stores\/\d+\/customers(?:\/\d+(?:\/orders)?)?$/.test(route)) {
    const storeId = Number(route.split("/")[3]);
    const id = Number(route.split("/")[5]);
    if (route.endsWith("/orders"))
      result = paginate(
        db.orders.filter((o) => o.storeId === storeId && o.customerId === id),
        url.searchParams,
      );
    else if (id) {
      const c = db.customers.find((c) => c.id === id && c.storeId === storeId);
      if (!c) throw new Error("Customer not found.");
      if (method === "PATCH") Object.assign(c, body);
      if (method === "DELETE") db.customers = db.customers.filter((c) => c.id !== id);
      result = c;
    } else if (method === "POST") {
      const c = { ...body, id: nextId(db.customers), storeId } as Customer;
      db.customers.unshift(c);
      result = c;
    } else
      result = paginate(
        db.customers.filter((c) => c.storeId === storeId),
        url.searchParams,
      );
  } else if (/^\/commerce\/stores\/\d+\/staff(?:\/\d+)?$/.test(route)) {
    const storeId = Number(route.split("/")[3]);
    const id = Number(route.split("/")[5]);
    if (id) {
      const member = db.staff.find((p) => p.id === id && p.storeId === storeId);
      if (!member) throw new Error("Staff member not found.");
      if (method === "PATCH") Object.assign(member, body);
      if (method === "DELETE") db.staff = db.staff.filter((p) => p.id !== id);
      result = member;
    } else if (method === "POST") {
      const member = { ...body, id: nextId(db.staff), storeId } as Staff;
      db.staff.unshift(member);
      result = member;
    } else
      result = paginate(
        db.staff.filter((p) => (p as Staff & { storeId: number }).storeId === storeId),
        url.searchParams,
      );
  } else if (/^\/commerce\/stores\/\d+\/reports\/(sales|pos)$/.test(route)) {
    const storeId = Number(route.split("/")[3]);
    const currency =
      url.searchParams.get("currency") ||
      db.stores.find((s) => s.id === storeId)?.reportCurrency ||
      "USD";
    const period =
      url.searchParams.get("period") || (url.searchParams.has("from") ? "custom" : "today");
    const today = new Date();
    const date = (d: Date) => d.toISOString().slice(0, 10);
    const start = new Date(today);
    start.setUTCDate(
      start.getUTCDate() - (period === "last_7_days" ? 6 : period === "last_30_days" ? 29 : 0),
    );
    const from = period === "all" ? "0000-01-01" : url.searchParams.get("from") || date(start);
    const to = url.searchParams.get("to") || date(today);
    const storeOrders = db.orders.filter((o) => o.storeId === storeId);
    const orders = storeOrders.filter(
      (o) =>
        o.totalCurrency === currency &&
        o.createdAt.slice(0, 10) >= from &&
        o.createdAt.slice(0, 10) <= to &&
        !["PENDING", "PENDING_PAYMENT", "FAILED", "CANCELED", "CANCELLED"].includes(o.status),
    );
    const total = orders.reduce((s, o) => s + o.totalAmount, 0);
    const amountPaid = orders.reduce(
      (s, o) => s + (o.amountPaid ?? (o.posPaymentStatus === "ON_CREDIT" ? 0 : o.totalAmount)),
      0,
    );
    const statusCount = (status: string) =>
      orders.filter((o) => (o.posPaymentStatus || "PAID") === status).length;
    result = {
      period,
      currency,
      availableCurrencies: [...new Set([currency, ...storeOrders.map((o) => o.totalCurrency)])],
      fromDate:
        period === "all" ? storeOrders.map((o) => o.createdAt.slice(0, 10)).sort()[0] || to : from,
      toDate: to,
      totalSalesAmount: total,
      amountPaid,
      balanceDue: total - amountPaid,
      merchantProceedsAmount: amountPaid,
      orderCount: orders.length,
      paidOrderCount: statusCount("PAID"),
      partialOrderCount: statusCount("PARTIALLY_PAID"),
      creditOrderCount: statusCount("ON_CREDIT"),
      topProducts: [],
      unpaidCustomers: [],
    };
  } else if (/^\/commerce\/orders\/[^/]+(?:\/payments\/start)?$/.test(route)) {
    const order = db.orders.find((o) => o.reference === route.split("/")[3]);
    if (!order) throw new Error("Order not found.");
    if (method === "POST") {
      order.paymentTransactionId = 9999;
      order.status = "COMPLETED";
      order.posPaymentStatus = "PAID";
      order.amountPaid = order.totalAmount;
      order.balanceDue = 0;
    }
    result = order;
  } else if (route === "/businesses" && method === "GET") {
    result = paginate<Business>(db.businesses, url.searchParams);
  } else if (/^\/businesses\/\d+$/.test(route) && ["GET", "PATCH"].includes(method)) {
    const business = db.businesses.find((item) => item.id === Number(route.split("/")[2]));
    if (!business) throw Object.assign(new Error("Business not found."), { status: 404 });
    if (method === "PATCH") {
      const keys = Object.keys(body);
      const editable = ["name", "legalName", "countryCode", "registrationNumber"];
      if (
        !keys.length ||
        keys.some((key) => !editable.includes(key)) ||
        keys.some((key) => body[key] !== null && typeof body[key] !== "string") ||
        ("name" in body && !body.name?.trim())
      )
        throw Object.assign(new Error("Invalid Business details."), { status: 400 });
      const draft = {
        ...businessDetailsDraft(business),
        ...Object.fromEntries(keys.map((key) => [key, body[key] ?? ""])),
      };
      if (Object.keys(businessDetailsErrors(draft)).length)
        throw Object.assign(new Error("Invalid Business details."), { status: 400 });
      Object.assign(business, businessDetailsPatch(business, draft), {
        updatedAt: new Date().toISOString(),
      });
    }
    result = business;
  } else if (/^\/businesses\/\d+\/api-catalog$/.test(route) && method === "GET") {
    if (route.split("/")[2] !== "1")
      throw Object.assign(new Error("Business not found."), { status: 404 });
    // Fictional configuration for demo mode only; never a fallback for a real catalog.
    result = {
      paymentMethods: [
        {
          name: "BTC",
          displayName: "Bitcoin",
          type: "CRYPTO",
          countryCode: null,
          paymentCurrency: "BTC",
          active: false,
          allowingCollection: false,
          allowingPayout: false,
          networkNames: [],
        },
        {
          name: "MPESA_DRC",
          displayName: "M-Pesa DRC",
          type: "MOBILE_MONEY",
          countryCode: "CD",
          paymentCurrency: "USD",
          active: true,
          allowingCollection: false,
          allowingPayout: true,
          networkNames: [],
        },
        {
          name: "MPESA_KENYA",
          displayName: "M-Pesa Kenya",
          type: "MOBILE_MONEY",
          countryCode: "KE",
          paymentCurrency: "KES",
          active: true,
          allowingCollection: true,
          allowingPayout: true,
          networkNames: [],
        },
        {
          name: "USDT",
          displayName: "Tether",
          type: "CRYPTO",
          countryCode: null,
          paymentCurrency: "USDT",
          active: true,
          allowingCollection: true,
          allowingPayout: true,
          networkNames: ["TRC20", "ERC20"],
        },
      ],
      cryptoNetworks: [
        { name: "ERC20", displayName: "Ethereum", active: true, invoiceCreationEnabled: false },
        { name: "TRC20", displayName: "TRON", active: true, invoiceCreationEnabled: true },
      ],
    } satisfies ApiCatalog;
  } else if (/^\/businesses\/\d+\/api-wallets$/.test(route) && method === "GET") {
    const environment = apiEnvironment(url.searchParams.get("environment") ?? undefined);
    const currency = url.searchParams.has("currency")
      ? walletCurrency(url.searchParams.get("currency")!)
      : "";
    const entries = db.sandboxFunding?.entries ?? [];
    const wallets =
      environment === "LIVE"
        ? [
            { currency: "USD", balance: 8450.75, environment },
            { currency: "CDF", balance: 6_200_000, environment },
          ]
        : [...new Set(entries.map((entry) => entry.currency))].map((currency) => ({
            currency,
            environment,
            balance: entries.find((entry) => entry.currency === currency)!.balanceAfter,
          }));
    result = currency
      ? [
          wallets.find((wallet) => wallet.currency === currency) ?? {
            currency,
            balance: 0,
            environment,
          },
        ]
      : wallets;
  } else if (
    /^\/businesses\/\d+\/sandbox-wallets\/[A-Z]{3}\/entries$/.test(route) &&
    method === "GET"
  ) {
    const currency = walletCurrency(route.split("/")[4]);
    result = paginate(
      (db.sandboxFunding?.entries ?? []).filter((entry) => entry.currency === currency),
      url.searchParams,
    );
  } else if (
    /^\/businesses\/\d+\/sandbox-wallets\/convert(?:\/quote)?$/.test(route) &&
    method === "POST"
  ) {
    const input = conversionInput(body.sourceCurrency, body.targetCurrency, String(body.amount));
    if (route.endsWith("/quote")) result = demoConversionQuote(db, input);
    else {
      const key = new Headers(init.headers).get("Idempotency-Key") || "";
      if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(key))
        throw Object.assign(new Error("A conversion request key is required."), { status: 400 });
      const conversionKey = `conversion:${key}`;
      const previous = db.sandboxConversions?.[conversionKey];
      if (previous) {
        if (JSON.stringify(previous.body) !== JSON.stringify(input))
          throw Object.assign(
            new Error("Conversion key conflicts with its original currencies or amount."),
            { status: 409 },
          );
        result = previous.result;
      } else {
        const quote = demoConversionQuote(db, input);
        const sourceAfter =
          Math.round((quote.sourceWallet.balance - quote.sourceAmount) * 100) / 100;
        const targetAfter =
          Math.round((quote.targetWallet.balance + quote.targetAmount) * 100) / 100;
        if (sourceAfter < 0)
          throw Object.assign(new Error("Insufficient sandbox funds for this conversion."), {
            status: 400,
            code: "INSUFFICIENT_FUNDS",
          });
        if (targetAfter > 999_999_999_999.99)
          throw Object.assign(new Error("Target sandbox wallet balance limit reached."), {
            status: 409,
            code: "INVALID_REQUEST",
          });
        const conversion: SandboxConversion = {
          ...quote,
          id: crypto.randomUUID(),
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
          sourceWallet: { ...quote.sourceWallet, balance: sourceAfter },
          targetWallet: { ...quote.targetWallet, balance: targetAfter },
        };
        const funding = (db.sandboxFunding ??= { entries: [], intents: {} });
        const movement = (
          currency: string,
          amount: number,
          balanceAfter: number,
          kind: string,
        ): SandboxWalletEntry => ({
          id: crypto.randomUUID(),
          currency,
          amount,
          balanceAfter,
          kind,
          businessId: Number(route.split("/")[2]),
          paymentReference: null,
          conversionId: conversion.id,
          createdAt: conversion.createdAt!,
          environment: "SANDBOX",
          sequence:
            (funding.entries.find((entry) => entry.currency === currency)?.sequence ?? 0) + 1,
        });
        funding.entries.unshift(
          movement(input.sourceCurrency, -quote.sourceAmount, sourceAfter, "CONVERSION_DEBIT"),
          movement(input.targetCurrency, quote.targetAmount, targetAfter, "CONVERSION_CREDIT"),
        );
        (db.sandboxConversions ??= {})[conversionKey] = { body: input, result: conversion };
        result = conversion;
      }
    }
  } else if (/^\/businesses\/\d+\/sandbox-wallets\/top-ups$/.test(route) && method === "POST") {
    const bodyValue = sandboxFundingBody(body.currency, String(body.amount));
    const key = new Headers(init.headers).get("Idempotency-Key") || "";
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(key))
      throw new Error("A valid test-funding request key is required.");
    const funding = (db.sandboxFunding ??= { entries: [], intents: {} });
    const intentKey = `${bodyValue.currency}:${key}`;
    const previous = funding.intents[intentKey];
    if (previous) {
      if (previous.amount !== bodyValue.amount)
        throw Object.assign(new Error("Test-funding key conflicts with the original amount."), {
          status: 409,
        });
      result = previous;
    } else {
      const entries = funding.entries.filter((entry) => entry.currency === bodyValue.currency);
      const balanceAfter =
        Math.round(((entries[0]?.balanceAfter ?? 0) + bodyValue.amount) * 100) / 100;
      if (balanceAfter > 999_999_999_999.99)
        throw Object.assign(new Error("Sandbox wallet balance limit reached."), { status: 400 });
      const entry: SandboxWalletEntry = {
        id: crypto.randomUUID(),
        ...bodyValue,
        balanceAfter,
        kind: "TOP_UP",
        businessId: Number(route.split("/")[2]),
        paymentReference: null,
        conversionId: null,
        createdAt: new Date().toISOString(),
        environment: "SANDBOX",
        sequence: (entries[0]?.sequence ?? 0) + 1,
      };
      funding.entries.unshift(entry);
      funding.intents[intentKey] = entry;
      result = entry;
    }
  } else if (/^\/businesses\/\d+\/api-keys$/.test(route)) {
    if (method !== "GET") throw new Error("Credential mutations are disabled in demo mode.");
    const environment = apiEnvironment(url.searchParams.get("environment") ?? undefined);
    result =
      environment === "SANDBOX"
        ? ([
            {
              id: 3,
              name: "Sandbox checkout",
              keyPrefix: "fdk_biz_test_demo4b2",
              enabled: true,
              webhookUrl: "https://example.com/webhooks/fondeka-test",
              createdAt: day(2),
              environment: "SANDBOX",
            },
          ] satisfies ApiKey[])
        : ([
            {
              id: 1,
              name: "Commerce integration",
              keyPrefix: "fdk_biz_demo7x2",
              enabled: true,
              webhookUrl: "https://example.com/webhooks/fondeka",
              createdAt: day(45),
              environment: "LIVE",
            },
            {
              id: 2,
              name: "Legacy integration",
              keyPrefix: "fdk_biz_demo9a1",
              enabled: false,
              createdAt: day(90),
              environment: "LIVE",
            },
          ] satisfies ApiKey[]);
  } else if (/^\/businesses\/\d+\/api-transactions$/.test(route)) {
    result = paginate(
      demoTransactions(apiEnvironment(url.searchParams.get("environment") ?? undefined)).filter(
        (item) => {
          const tx = item.transaction;
          const params = url.searchParams;
          return (
            (!params.get("action") || tx.action === params.get("action")) &&
            (!params.get("status") || tx.status === params.get("status")) &&
            (!params.get("currency") || tx.currency === params.get("currency")) &&
            (!params.get("reference") || tx.reference === params.get("reference")) &&
            (!params.get("clientReference") ||
              tx.clientReference === params.get("clientReference")) &&
            (!params.get("fromDate") ||
              new Date(item.createdAt).getTime() >= Number(params.get("fromDate"))) &&
            (!params.get("toDate") ||
              new Date(item.createdAt).getTime() <= Number(params.get("toDate")))
          );
        },
      ),
      url.searchParams,
    );
  } else if (/^\/businesses\/\d+\/api-transactions\/[A-Za-z0-9_-]+$/.test(route)) {
    result = demoTransactions(
      apiEnvironment(url.searchParams.get("environment") ?? undefined),
    ).find((item) => item.transaction.reference === route.split("/")[4]);
    if (!result) throw new Error("Transaction not found.");
  } else throw new Error("This action is not available in the demo workspace.");
  if (method !== "GET") persist();
  return structuredClone(result) as T;
}

function demoTransactions(environment: ApiEnvironment = "LIVE"): ApiTransaction[] {
  if (environment === "SANDBOX")
    return Array.from({ length: 5 }, (_, i) => {
      const status = (["COMPLETED", "FAILED", "COMPLETED", "PROCESSING", "FAILED"] as const)[i];
      const amount = [10, 25, 40, 15, 12][i];
      return {
        requestId: 100 + i,
        apiKeyName: "Sandbox checkout",
        createdAt: day(i / 4),
        updatedAt: day(i / 4),
        transaction: {
          businessId: 1,
          transactionId: null,
          environment: "SANDBOX",
          reference: `SBX${(i + 1).toString(16).padStart(32, "0")}`,
          clientReference: `sandbox-order-${i + 1}`,
          action: i % 2 ? "BUSINESS_API_PAYOUT" : "BUSINESS_API_COLLECTION",
          status,
          amount,
          currency: "USD",
          grossAmount: amount,
          allFees: 0,
          settlementAmount: status === "COMPLETED" ? amount : null,
          settlementNet: status === "COMPLETED" ? amount : null,
          refunded: false,
          ...(i === 4
            ? { failureCode: "EXPIRED", failureMessage: "Sandbox simulation: payment expired." }
            : status === "FAILED"
              ? {
                  failureCode: "INVALID_DESTINATION",
                  failureMessage: "Sandbox simulation: invalid destination.",
                }
              : {}),
          cryptoDetails:
            i === 2
              ? {
                  address: "SANDBOX_NOT_PAYABLE_DEMO_USDT_TRC20",
                  cryptoCurrency: "USDT",
                  network: "TRC20",
                  amountInCrypto: amount,
                  exchangeRate: 1,
                }
              : null,
        },
      };
    });
  return Array.from({ length: 12 }, (_, i) => ({
    requestId: i + 1,
    apiKeyName: i === 8 ? "Legacy integration" : "Commerce integration",
    createdAt: day(i / 4),
    updatedAt: day(i / 4),
    transaction: {
      businessId: 1,
      transactionId: 8000 + i,
      environment: "LIVE",
      reference: `TXDEMO${8421 - i}`,
      clientReference: `order-${i + 1}`,
      action: i % 3 === 0 ? "BUSINESS_API_PAYOUT" : "BUSINESS_API_COLLECTION",
      status: i === 3 || i === 7 ? "PROCESSING" : "COMPLETED",
      amount: [125, 84, 260][i % 3],
      grossAmount: [125.5, 84.5, 260.5][i % 3],
      allFees: 0.5,
      settlementNet: [125, 84, 260][i % 3],
      refunded: false,
      currency: i === 5 ? "EUR" : "USD",
      cryptoDetails:
        i === 2
          ? {
              cryptoCurrency: "USDT",
              network: "TRC20",
              amountInCrypto: 260,
              address: "DEMO-ADDRESS-NOT-FOR-REAL-PAYMENTS",
            }
          : null,
    },
  }));
}
