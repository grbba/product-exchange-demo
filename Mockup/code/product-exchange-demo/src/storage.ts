import type { ProductInstance, ProductSchema } from "./domain";

const SCHEMA_KEY = "apmwg:schemas";
const INSTANCE_KEY = "apmwg:instances";

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
