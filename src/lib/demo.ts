import type {
  ApiKey,
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
} from "./types";
import { amountInMinorUnits } from "./format";

const storageKey = "fondeka-business-demo-v1";
interface DemoData {
  stores: Store[];
  products: Product[];
  requests: PaymentRequest[];
  orders: Order[];
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
        lifecycle: "PAID",
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
        lifecycle: "PAID",
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
  let result: unknown;
  if (route === "/commerce/stores") {
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
        status: "PAID",
        posPaymentStatus: "PAID",
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
  } else if (route === "/businesses") {
    result = paginate<Business>(
      [
        {
          id: 1,
          name: "Atelier Kin",
          legalName: "Atelier Kin SARL",
          countryCode: "CD",
          status: "ACTIVE",
          kybStatus: "APPROVED",
          defaultBusiness: true,
        },
      ],
      url.searchParams,
    );
  } else if (/^\/businesses\/\d+\/api-keys$/.test(route)) {
    result = [
      {
        id: 1,
        name: "Commerce integration",
        keyPrefix: "fdk_biz_demo7x2",
        enabled: true,
        webhookUrl: "https://example.com/webhooks/fondeka",
        createdAt: day(45),
      },
      {
        id: 2,
        name: "Legacy integration",
        keyPrefix: "fdk_biz_demo9a1",
        enabled: false,
        createdAt: day(90),
      },
    ] satisfies ApiKey[];
  } else if (/^\/businesses\/\d+\/api-transactions$/.test(route)) {
    result = paginate(
      demoTransactions().filter((item) => {
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
      }),
      url.searchParams,
    );
  } else if (/^\/businesses\/\d+\/api-transactions\/[A-Za-z0-9_-]+$/.test(route)) {
    result = demoTransactions().find((item) => item.transaction.reference === route.split("/")[4]);
    if (!result) throw new Error("Transaction not found.");
  } else throw new Error("This action is not available in the demo workspace.");
  if (method !== "GET") persist();
  return structuredClone(result) as T;
}

function demoTransactions(): ApiTransaction[] {
  return Array.from({ length: 12 }, (_, i) => ({
    requestId: i + 1,
    apiKeyName: i === 8 ? "Legacy integration" : "Commerce integration",
    createdAt: day(i / 4),
    updatedAt: day(i / 4),
    transaction: {
      businessId: 1,
      transactionId: 8000 + i,
      reference: `TXDEMO${8421 - i}`,
      clientReference: `order-${i + 1}`,
      action: i % 3 === 0 ? "BUSINESS_API_PAYOUT" : "BUSINESS_API_COLLECTION",
      status: i === 3 ? "PROCESSING" : i === 7 ? "UNKNOWN" : "COMPLETED",
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
