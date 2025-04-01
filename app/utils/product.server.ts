// query
export function getCategory(title: string) {
  const data = `#graphql
    query {
  taxonomy {
    categories(first: 3, search:"${title}") {
      edges {
        node {
          name
          id
        }
      }
    }
  }
}`;
  return data;
}

export function getProduct() {
  const data = `#graphql
        query ProductMetafield( $ownerId: ID!) {
      product(id: $ownerId) {
        title,
        description,
        status,
        category {
              id,
              name
          }
        options{
          id,
          name
        }
        variants(first: 1) {
          edges {
            node {
              id
              price
              inventoryQuantity
              inventoryItem {
                id
              }
            }
          }
        }
      }
    }`;
  return data;
}

// mutation
export function createProduct(
  title: string,
  description: string,
  status: string,
  category: string,
) {
  const data = `#graphql
        mutation {
    productCreate(product: {title: "${title}", descriptionHtml: "${description}", status: ${status}, category:"${category}"}) {
      product {
        id
        options {
        id
        name
      }
      }
      userErrors {
        field
        message
      }
    }
  }`;
  return data;
}

export function ProductVariantsCreate() {
  const data = `#graphql
     mutation ProductVariantsCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        userErrors {
          field
          message
        }
      }
    }`;
  return data;
}

export function UpdateProduct() {
  const data = `#graphql
    mutation UpdateProduct($input: ProductInput!) {
    productUpdate(input: $input) {
      userErrors {
        field
        message
      }
    }
  }`;
  return data;
}

export function productVariantsBulkUpdate() {
  const data = `#graphql
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product {
        id
      }
      userErrors {
        field
        message
      }
    }
  }`;
  return data;
}

export function inventoryAdjustQuantities() {
  const data = `#graphql
        mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
          inventoryAdjustQuantities(input: $input) {
            userErrors {
              field
              message
            }
          }
        }`;
  return data;
}

export function queryProduct(
  queryCursor: string,
  queryTitle: string,
  queryStatus: string,
  queryCategory: string,
) {
  const data = `#graphql~
    query {
    products(${queryCursor} , reverse: true ,query: "${queryTitle} ${queryStatus} ${queryCategory}") {
      edges {
      node {
          id
          title
          description
          status
          variants(first: 1) {
          edges {
              node {
              price
              inventoryQuantity
              }
          }  
          }
      }
      }
      pageInfo {
         hasNextPage
          hasPreviousPage
          endCursor
          startCursor
      }
      }
    }`;
  return data;
}

export function queryCategories() {
  const data = `#graphql~
     query {
  products(first: 10) {
    edges {
      node {
        category {
          id
          name
        }
      }
    }
  }
}`;
  return data;
}

export function productDelete(id: string) {
  const data = `#graphql
        mutation {
          productDelete(input: {id: "${id}"}) {
            deletedProductId
            userErrors {
              field
              message
            }
          }
        }`;
  return data;
}
