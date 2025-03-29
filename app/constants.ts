export const status = [
  { label: "ACTIVE", value: "ACTIVE" },
  { label: "DRAFT", value: "DRAFT" },
];

export const productInit: ProductType = {
  title: "",
  description: "",
  status: "ACTIVE",
  price: "0",
  inventory: "0",
  categoryId: "",
  variantId: "",
  inventoryItemId: "",
  error: {
    title: "",
    inventory: "",
    price: "",
    categoryId: "",
  },
};
