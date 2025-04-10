import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { productInit } from "./constants";

interface ProductStore {
  product: ProductType;
  currentcyCode: string;
  setCurrentcyCode: (currencyCode: string) => void;
  setProduct: (product: ProductType) => void;
  editProduct: <Key extends keyof ProductType>(
    field: Key,
    value: ProductType[Key],
  ) => void;
  resetProduct: () => void;
}

export const useProductStore = create<ProductStore>()(
  immer((set) => ({
    product: productInit,
    currentcyCode: "",

    setCurrentcyCode: (currencyCode) => {
      set((state) => {
        state.currentcyCode = currencyCode;
      });
    },

    setProduct: (product) => {
      set((state) => {
        state.product = product;
      });
    },

    editProduct: (field, value) => {
      set((state) => {
        state.product[field] = value;
      });
    },

    resetProduct: () => {
      set((state) => {
        state.product = productInit;
      });
    },
  })),
);
