import { useLocation } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

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
  let newErrors = { title: "", inventory: "", price: "", categoryId: "" };
  let isValid = true;

  if (!product.title && !product.title.trim()) {
    newErrors.title = "Title is required";
    isValid = false;
  }

  if (!product.categoryId && !product.categoryId.trim()) {
    newErrors.categoryId = "You haven't choose category ";
    isValid = false;
  }

  if (+product.price < 0) {
    newErrors.price = "Price is Invalid";
    isValid = false;
  }

  // if (product.inventory) {
  //   newErrors.inventory = "Inventory is Invalid";
  //   isValid = false;
  // }

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
