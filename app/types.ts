interface ProductsResponse {
  data: {
    products: {
      edges: {
        node: ProductNode;
      }[];
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        endCursor: string;
        startCursor: string;
      };
    };
  };
}

type ProductResponse = {
  data: {
    product: {
      title: string;
      description: string;
      status: string;
      category: {
        id: string;
        name: string;
      };
      variants: {
        edges: {
          node: {
            id: string;
            price: string;
            inventoryQuantity: number;
            inventoryItem: {
              id: string;
            };
          };
        }[];
      };
    };
  };
};

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
  searchCategory?: string;
}

type ProductType = Omit<FormattedProduct, "id" | "category"> & {
  categoryId: string;
  categoryName: string;
  variantId: string;
  inventoryItemId: string;
  error: ErrorType;
};

type ErrorType = {
  title: string;
  inventory: string;
  price: string;
};

type nodeCategory = {
  node: {
    id: string;
    name: string;
  };
};

type argOfProduct = {
  data: FormattedProduct[];
  category: {
    label: string;
    value: string;
  }[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    endCursor: string;
    startCursor: string;
  };
};
