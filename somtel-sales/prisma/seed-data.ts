/**
 * Reference data from the business brief. Seeding is "create if missing":
 * running it again never overwrites changes made in the app.
 */
import type { PriceType, ProductType, BillingFrequency, TermsCategory, ClauseCategory, StageKind } from "@prisma/client";

export const SECTORS = ["Private & INGOs", "Public Sector", "Financial Institutions", "Logistics", "Government"];

export const PIPELINE_STAGES: { name: string; description: string; probability: number; kind: StageKind }[] = [
  { name: "Lead", description: "Possible client, not yet qualified", probability: 10, kind: "OPEN" },
  { name: "Qualified", description: "Need, budget and decision maker confirmed", probability: 25, kind: "OPEN" },
  { name: "Proposal Sent", description: "Quote or proposal sent", probability: 50, kind: "OPEN" },
  { name: "Negotiation", description: "Discussing price or terms", probability: 75, kind: "OPEN" },
  { name: "Won", description: "PO or signed contract received", probability: 100, kind: "WON" },
  { name: "Lost", description: "Client said no (lost reason required)", probability: 0, kind: "LOST" },
];

export const LOST_REASONS = ["Price", "Competitor", "No budget", "No response", "Other"];

/** Somtel services catalog: Category -> Service -> Plan. */
export const SERVICE_CATEGORIES: { name: string; enabled: boolean }[] = [
  { name: "IaaS", enabled: true },
  { name: "SaaS", enabled: true },
  { name: "GSM", enabled: true },
  { name: "Managed Services", enabled: true },
  { name: "Inventory", enabled: true },
  { name: "SmartPay", enabled: false },
  { name: "MLB Internet", enabled: false },
  { name: "Vehicle Tracking", enabled: true },
];

export interface SeedPlan {
  name: string;
  description?: string;
  priceType: PriceType;
  billingFrequency: BillingFrequency;
  unitPrice?: number;
  unitLabel?: string;
  includedUnits?: number;
  includedLabel?: string;
  tiers?: { fromQty: number; toQty: number | null; unitPrice: number }[];
}

export interface SeedService {
  category: string;
  name: string;
  description?: string;
  productType: ProductType;
  options?: string[];
  plans: SeedPlan[];
}

export const SERVICES: SeedService[] = [
  {
    category: "GSM",
    name: "A2P SMS",
    description: "Application to person SMS through an API.",
    productType: "NON_IT",
    plans: [
      { name: "API setup", priceType: "ONE_TIME", billingFrequency: "ONE_TIME", unitPrice: 100 },
      {
        name: "SMS bundle",
        description: "All SMS are charged at the rate of the band the total volume falls in.",
        priceType: "PER_SMS_TIERED",
        billingFrequency: "ONE_TIME",
        unitLabel: "SMS",
        tiers: [
          { fromQty: 1, toQty: 10000, unitPrice: 0.03 },
          { fromQty: 10001, toQty: 30000, unitPrice: 0.025 },
          { fromQty: 30001, toQty: 60000, unitPrice: 0.02 },
          { fromQty: 60001, toQty: null, unitPrice: 0.015 },
        ],
      },
    ],
  },
  {
    category: "GSM",
    name: "Hosted IVR / Short Code",
    description: "Short code with hosted IVR.",
    productType: "NON_IT",
    options: ["Direct to one line (no IVR)", "IVR menu routing to separate lines"],
    plans: [
      { name: "4-digit short code", priceType: "MONTHLY", billingFrequency: "MONTHLY", unitPrice: 20, includedUnits: 4, includedLabel: "IVR extensions" },
      { name: "3-digit short code", priceType: "MONTHLY", billingFrequency: "MONTHLY", unitPrice: 60, includedUnits: 4, includedLabel: "IVR extensions" },
      { name: "Extra IVR extension", priceType: "MONTHLY", billingFrequency: "MONTHLY", unitPrice: 5, unitLabel: "extension" },
      { name: "Local call minutes", priceType: "PER_MINUTE", billingFrequency: "MONTHLY", unitPrice: 0.02 },
      { name: "Toll-free inbound minutes", priceType: "PER_MINUTE", billingFrequency: "MONTHLY", unitPrice: 0.02 },
      { name: "Wireless landline device", priceType: "PER_UNIT", billingFrequency: "ONE_TIME", unitPrice: 40, unitLabel: "device" },
    ],
  },
  {
    category: "Vehicle Tracking",
    name: "Tracking platform",
    description: "Monthly platform fee per vehicle. Starts on the activation date of each vehicle.",
    productType: "TRACKING",
    plans: [{ name: "Platform fee", priceType: "MONTHLY", billingFrequency: "MONTHLY", unitPrice: 1.4, unitLabel: "vehicle" }],
  },
];

/** IT catalog: one shared category list for all vendors. */
export const IT_CATEGORIES = [
  "Firewall and security",
  "Endpoint security",
  "Wireless",
  "Switching",
  "Routing",
  "Servers and storage",
  "Productivity and collaboration",
  "Cloud subscriptions",
  "Vehicle tracking hardware",
  "Other",
];

/** IT vendors named in the brief. Products are added in the app (or by the Excel import). */
export const VENDORS: { name: string; website?: string }[] = [
  { name: "Fortinet", website: "fortinet.com" },
  { name: "Sophos", website: "sophos.com" },
  { name: "Microsoft", website: "microsoft.com" },
  { name: "Ubiquiti", website: "ui.com" },
];

export const TERMS_TEMPLATES: { name: string; category: TermsCategory; body: string }[] = [
  {
    name: "IT resale (standard)",
    category: "IT_RESALE",
    body: [
      "1. All prices are in US Dollars (USD).",
      "2. Payment: 100% upfront payment.",
      "3. Supply and delivery only. Installation and configuration excluded unless listed in the pricing table.",
      "4. Delivery time starts after payment is received and depends on vendor stock.",
      "5. Licences are issued in the client's name and cannot be refunded once issued.",
      "6. Hardware warranty is as given by the manufacturer.",
      "7. This quotation is valid for the number of days shown above.",
    ].join("\n"),
  },
  {
    name: "A2P SMS",
    category: "A2P_SMS",
    body: [
      "1. All prices are in US Dollars (USD).",
      "2. The API setup fee is a one-time fee, paid before activation.",
      "3. All SMS in a package are charged at the rate of the band the total volume falls in.",
      "4. The client is responsible for the content of messages and for having consent from recipients.",
      "5. Sender names must be approved before use.",
      "6. This quotation is valid for the number of days shown above.",
    ].join("\n"),
  },
  {
    name: "Hosted IVR / Short code",
    category: "IVR",
    body: [
      "1. All prices are in US Dollars (USD).",
      "2. Monthly fees start on the activation date.",
      "3. Each short code includes 4 IVR extensions. Extra extensions are charged per month.",
      "4. Call minutes are charged per minute as shown in the pricing table.",
      "5. Devices are paid once, before delivery.",
      "6. This quotation is valid for the number of days shown above.",
    ].join("\n"),
  },
  {
    name: "Vehicle tracking",
    category: "TRACKING",
    body: [
      "1. All prices are in US Dollars (USD).",
      "2. The platform fee is charged per vehicle per month and starts on the activation date of each vehicle.",
      "3. Devices sold outright belong to the client after full payment.",
      "4. Somtel-owned devices remain the property of Somtel and must be returned when the service ends.",
      "5. Installation dates are agreed with the client for each vehicle.",
      "6. This quotation is valid for the number of days shown above.",
    ].join("\n"),
  },
  {
    name: "General",
    category: "GENERAL",
    body: ["1. All prices are in US Dollars (USD).", "2. Payment: 100% upfront payment.", "3. This quotation is valid for the number of days shown above."].join("\n"),
  },
];

export const CLAUSES: { category: ClauseCategory; text: string }[] = [
  { category: "PAYMENT", text: "100% upfront payment." },
  { category: "SCOPE", text: "Supply and delivery only. Installation and configuration excluded." },
];
