import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import {
  Page,
  TextField,
  Select,
  Card,
  Button,
  FormLayout,
  Banner,
  Box,
} from "@shopify/polaris";
import { DeleteIcon, SendIcon } from "@shopify/polaris-icons";
import { useCheckNavigation, validateData } from "app/common";
import { productInit, status } from "app/constants";
import { authenticate } from "app/shopify.server";
import { useProductStore } from "app/store";
import { useEffect, useState } from "react";

export const loader: LoaderFunction = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const title = url.searchParams.get("title");
  const response = await admin.graphql(
    `#graphql
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
}`,
  );

  const responseProduct = await admin.graphql(
    `#graphql
    query ProductMetafield( $ownerId: ID!) {
  product(id: $ownerId) {
    title,
    description,
    status,
    category {
          id
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
}`,
    {
      variables: {
        ownerId: `gid://shopify/Product/${params.id}`,
      },
    },
  );

  const data = await response.json();
  const dataOfProduct = await responseProduct.json();
  const categoryList = data.data.taxonomy.categories.edges.map(
    (item: { node: { id: string; name: string } }) => ({
      value: item.node.id,
      label: item.node.name,
    }),
  );

  if (params.id === "new")
    return {
      data: productInit,
      page: "new",
      category: categoryList,
    };
  return {
    data: {
      ...productInit,
      title: dataOfProduct.data.product?.title,
      description: dataOfProduct.data.product?.description,
      status: dataOfProduct.data.product?.status,
      price: dataOfProduct.data.product?.variants.edges[0].node.price,
      inventory:
        dataOfProduct.data.product?.variants.edges[0].node.inventoryQuantity.toString(),
      categoryId: dataOfProduct.data.product?.category.id,
      variantId: dataOfProduct.data.product?.variants.edges[0].node.id,
      inventoryItemId:
        dataOfProduct.data.product.variants.edges[0].node.inventoryItem.id,
    },
    category: categoryList,
    page: "edit",
  };
};

export const action: ActionFunction = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = JSON.parse(formData.get("data") as string);

  if (request.method === "POST") {
    const responseProduct = await admin.graphql(
      `#graphql
        mutation {
    productCreate(product: {title: "${data.title}", descriptionHtml: "${data.description}", status: ${data.status}, category:"${data.category}"}) {
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
  }
        `,
    );
    const dataOfProduct = await responseProduct.json();
    const argOfProduct = {
      idProduct: dataOfProduct.data.productCreate.product.id,
      idOption: dataOfProduct.data.productCreate.product.options[0].id,
      nameOption: dataOfProduct.data.productCreate.product.options[0].name,
    };

    await admin.graphql(
      `#graphql
     mutation ProductVariantsCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        userErrors {
          field
          message
        }
      }
    }`,
      {
        variables: {
          productId: argOfProduct.idProduct,
          variants: [
            {
              inventoryQuantities: {
                locationId: "gid://shopify/Location/104149254454",
                availableQuantity: +data.inventory,
              },
              price: +data.price,
              optionValues: {
                optionId: argOfProduct.idOption,
                name: argOfProduct.nameOption,
              },
            },
          ],
        },
      },
    );
    return redirect(`/app/product/${argOfProduct.idProduct.split("/").pop()}`);
  } else if (request.method === "PUT") {
    const { admin } = await authenticate.admin(request);

    await admin.graphql(
      `#graphql
        mutation UpdateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          userErrors {
            field
            message
          }
        }
      }
      `,
      {
        variables: {
          input: {
            id: `gid://shopify/Product/${params.id}`,
            title: data.title,
            descriptionHtml: data.description,
            status: data.status,
            category: data.category,
          },
        },
      },
    );

    await admin.graphql(
      `#graphql
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
        }`,
      {
        variables: {
          productId: `gid://shopify/Product/${params.id}`,
          variants: [
            {
              id: data.variant,
              price: +data.price,
            },
          ],
        },
      },
    );

    await admin.graphql(
      `#graphql
        mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
          inventoryAdjustQuantities(input: $input) {
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          input: {
            reason: "correction",
            name: "available",
            changes: [
              {
                delta: +data.inventory,
                inventoryItemId: data.inventoryId,
                locationId: "gid://shopify/Location/104149254454",
              },
            ],
          },
        },
      },
    );

    return redirect("/app/demo");
  }
};

export default function Product() {
  const banner = useCheckNavigation();
  const fetcher = useFetcher();
  const productOld = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { product, setProduct, editProduct, resetProduct } = useProductStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingButton, setLoaddingButton] = useState({
    submitLoading: false,
    deleteLoading: false,
    showBanner: true,
  });
  const navigation = useNavigation();

  useEffect(() => {
    if (fetcher.state !== "idle" || navigation.state === "loading") {
      shopify.loading(true);
    } else {
      shopify.loading(false);
    }
  }, [fetcher.state, navigation.state]);

  useEffect(() => {
    setLoaddingButton((prev) => ({ ...prev, showBanner: banner }));
  }, [banner]);

  useEffect(() => {
    const defaultValueCategory = !product.categoryId.trim()
      ? (productOld.category[0]?.value ?? "")
      : product.categoryId;
    editProduct("categoryId", defaultValueCategory);
  }, [productOld.category]);

  useEffect(
    () => {
      setProduct(productOld.data);
      return () => resetProduct();
    },
    Object.keys(productOld.data).filter((key) => key !== "categoryId"),
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      let hasChanged = false;

      const updateParam = (key: string, value?: string) => {
        if (value && value !== params.get(key)) {
          params.set(key, value);
          hasChanged = true;
        } else if (!value && params.has(key)) {
          params.delete(key);
          hasChanged = true;
        }
      };
      updateParam("title", product.title.trim() || undefined);
      if (hasChanged) {
        setSearchParams(params);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [product.title, searchParams]);

  const handleChange =
    <Key extends keyof ProductType>(field: Key) =>
    (value: ProductType[Key] | any) => {
      editProduct(field, value);
      editProduct("error", { ...product.error, [field]: "" });
    };

  const handleSubmit = () => {
    if (!validateData(product, editProduct)) return;
    const formData = new FormData();
    const data = {
      title: product.title,
      description: product.description,
      status: product.status,
      inventory: product.inventory,
      price: product.price,
      category: product.categoryId,
      variant: product.variantId,
      inventoryId: product.inventoryItemId,
    };
    formData.append("data", JSON.stringify(data));
    fetcher.submit(formData, {
      method: productOld.page === "new" ? "post" : "put",
    });
  };

  return (
    <Page
      title={productOld.page === "new" ? "Add Product" : product.title}
      fullWidth
      backAction={{
        onAction: () => {
          shopify.loading(true);
          navigate("/app/demo");
        },
      }}
      primaryAction={
        <Button
          loading={fetcher.state !== "idle" && loadingButton.submitLoading}
          icon={SendIcon}
          variant="primary"
          onClick={() => {
            handleSubmit();
            setLoaddingButton((prev) => ({ ...prev, submitLoading: true }));
          }}
        >
          Save
        </Button>
      }
      secondaryActions={
        <Button
          loading={fetcher.state !== "idle" && loadingButton.deleteLoading}
          icon={DeleteIcon}
          variant="secondary"
          tone="critical"
          onClick={() => {
            setLoaddingButton((prev) => ({ ...prev, deleteLoading: true }));
          }}
        >
          Delete
        </Button>
      }
    >
      <Box paddingBlock={"400"}>
        {loadingButton.showBanner && productOld.page === "edit" && (
          <Banner
            title={`Added ${product.title}`}
            tone="success"
            action={{
              content: "back home page to see",
              onAction: () => {
                shopify.loading(true);
                navigate("/app/demo");
              },
            }}
            onDismiss={() =>
              setLoaddingButton((prev) => ({ ...prev, showBanner: false }))
            }
          />
        )}
      </Box>
      <Card background="bg-surface" padding="600">
        <FormLayout>
          <FormLayout.Group>
            <TextField
              label="Title"
              autoComplete="off"
              requiredIndicator
              name="title"
              error={product.error.title}
              value={product.title}
              onChange={handleChange("title")}
            />
            <Select
              onChange={handleChange("status")}
              value={product.status}
              label="Status"
              options={status}
              name="status"
            />
            <TextField
              type="number"
              label="Price"
              name="price"
              autoComplete="off"
              suffix="đ"
              requiredIndicator
              value={product.price}
              onChange={handleChange("price")}
              error={product.error.price}
              maxLength={20}
            />
          </FormLayout.Group>

          <TextField
            label="Description"
            name="description"
            multiline={4}
            autoComplete="off"
            value={product.description}
            onChange={handleChange("description")}
          />
          <FormLayout.Group>
            <TextField
              type="number"
              label="Stock"
              name="stock"
              autoComplete="off"
              maxLength={20}
              onChange={handleChange("inventory")}
              value={product.inventory}
              requiredIndicator
              error={product.error.inventory}
            />
            <Select
              onChange={handleChange("categoryId")}
              value={product.categoryId}
              name="Category"
              requiredIndicator
              label="category"
              options={productOld.category}
              error={product.error.categoryId}
            />
          </FormLayout.Group>
        </FormLayout>
      </Card>
    </Page>
  );
}
