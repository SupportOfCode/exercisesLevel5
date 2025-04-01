export const status = [
  { label: "Active", value: "ACTIVE" },
  { label: "Draft", value: "DRAFT" },
];

export const productInit: ProductType = {
  title: "",
  description: "",
  status: "ACTIVE",
  price: "0",
  inventory: "0",
  categoryId: "",
  categoryName: "",
  variantId: "",
  inventoryItemId: "",
  error: {
    title: "",
    inventory: "",
    price: "",
  },
};
