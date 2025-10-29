import type { Partner, PartnerProductMap, ProductInstance, ProductSchema, ReferenceSystem } from "./domain";

const SCHEMA_KEY = "apmwg:schemas";
const INSTANCE_KEY = "apmwg:instances";
const PARTNER_KEY = "apmwg:partners";
const PARTNER_PRODUCT_KEY = "apmwg:partner-products";
const REFERENCE_SYSTEM_KEY = "apmwg:reference-systems";

const hasStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const read = <T>(key: string, fallback: T): T => {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed reading local storage for ${key}`, error);
    return fallback;
  }
};

const write = <T>(key: string, value: T) => {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed writing local storage for ${key}`, error);
  }
};

export const loadSchemas = () => read<ProductSchema[]>(SCHEMA_KEY, []);
export const persistSchemas = (schemas: ProductSchema[]) => write(SCHEMA_KEY, schemas);

export const loadInstances = () => read<ProductInstance[]>(INSTANCE_KEY, []);
export const persistInstances = (instances: ProductInstance[]) => write(INSTANCE_KEY, instances);

export const loadPartners = () => read<Partner[]>(PARTNER_KEY, []);
export const persistPartners = (partners: Partner[]) => write(PARTNER_KEY, partners);

export const loadPartnerProducts = () => read<PartnerProductMap>(PARTNER_PRODUCT_KEY, {});
export const persistPartnerProducts = (associations: PartnerProductMap) => write(PARTNER_PRODUCT_KEY, associations);

export const loadReferenceSystems = () => read<ReferenceSystem[]>(REFERENCE_SYSTEM_KEY, []);
export const persistReferenceSystems = (referenceSystems: ReferenceSystem[]) => write(REFERENCE_SYSTEM_KEY, referenceSystems);
