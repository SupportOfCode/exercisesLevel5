import { useLocation } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { productInit } from "./constants";

export function formmatedData(result: ProductsResponse) {
  const products = result.data.products.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    description: node.description,
    status: node.status,
    price: node?.variants?.edges[0]?.node.price || "N/A",
    inventory: node?.variants?.edges[0]?.node.inventoryQuantity ?? 0,
  }));
  return products;
}

export const validateData = (
  product: ProductType,
  editProduct: <Key extends keyof ProductType>(
    field: Key,
    value: ProductType[Key],
  ) => void,
) => {
  let newErrors = { title: "", inventory: "", price: "" };
  let isValid = true;

  if (!product.title && !product.title.trim()) {
    newErrors.title = "Title is required";
    isValid = false;
  }

  if (+product.price < 0) {
    newErrors.price = "Price is Invalid";
    isValid = false;
  }

  editProduct("error", newErrors);
  return isValid;
};

export function useCheckNavigation() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [isFromProductNew, setIsFromProductNew] = useState(false);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    const currentPath = location.pathname;

    if (
      prevPath === "/app/product/new" &&
      currentPath.startsWith("/app/product/") &&
      currentPath !== "/app/product/new"
    ) {
      setIsFromProductNew(true);
    } else {
      setIsFromProductNew(false);
    }

    // prevPathRef.current = currentPath;
  }, [location.pathname]);

  return isFromProductNew;
}

export function formmatedCategory(item: nodeCategory) {
  return {
    id: item.node.id,
    name: item.node.name,
  };
}

export function formmatedCategoriesByLabel(item: nodeCategory) {
  return {
    value: item.node.id,
    label: item.node.name,
  };
}

export const productData = (dataOfProduct: ProductResponse) => {
  return {
    ...productInit,
    title: dataOfProduct.data.product?.title,
    description: dataOfProduct.data.product?.description,
    status: dataOfProduct.data.product?.status,
    price: dataOfProduct.data.product?.variants.edges[0].node.price,
    inventory:
      dataOfProduct.data.product?.variants.edges[0].node.inventoryQuantity.toString(),
    categoryId: dataOfProduct.data.product?.category.id,
    categoryName: dataOfProduct.data.product?.category.name,
    variantId: dataOfProduct.data.product?.variants.edges[0].node.id,
    inventoryItemId:
      dataOfProduct.data.product?.variants.edges[0].node.inventoryItem.id,
  };
};

export const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
