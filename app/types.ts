interface ProductsResponse {
  data: {
    products: {
      edges: {
        node: ProductNode;
        cursorPointer: string;
        pageInfo: {
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      }[];
    };
  };
}

interface ProductNode {
  id?: string;
  title?: string;
  description?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  category?: {
    edges: {
      node: any;
    }[];
  };
  variants?: {
    edges: {
      node: VariantNode;
    }[];
  };
}

interface VariantNode {
  price: string;
  inventoryQuantity: number;
}

interface FormattedProduct {
  id: string;
  title: string;
  description: string;
  status: string;
  price: string;
  inventory: string;
  category?: string[];
}

type ProductType = Omit<FormattedProduct, "id" | "category"> & {
  categoryId: string;
  variantId: string;
  inventoryItemId: string;
  error: ErrorType;
};

type ErrorType = {
  title: string;
  inventory: string;
  price: string;
  categoryId: string;
};
