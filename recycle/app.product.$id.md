import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import {
  Page,
  TextField,
  Select,
  Card,
  Button,
  FormLayout,
} from "@shopify/polaris";
import { SendIcon } from "@shopify/polaris-icons";
import { validateData } from "app/common";
import { status } from "app/constants";
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

  const data = await response.json();
  const formmatedData = data.data.taxonomy.categories.edges.map(
    (item: any) => ({
      value: item.node.id,
      label: item.node.name,
    }),
  );

  if (params.id === "new") return { data: formmatedData, page: "new" };
  return { data: formmatedData, page: "edit" };
};

export const action: ActionFunction = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = JSON.parse(formData.get("data") as string);
  console.log("data of product: ", data.category);
  if (request.method === "POST") {
    await admin.graphql(
      `#graphql
        mutation {
    productCreate(product: {title: "${data.title}", descriptionHtml: "${data.description}", status: ${data.status}, category:"${data.category}"}) {
      product {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
        `,
    );
  }

  return redirect("/app/demo");
};

export default function Product() {
  const fetcher = useFetcher();
  const listCategory = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { product, setProduct, editProduct, resetProduct } = useProductStore();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (listCategory.page === "new") resetProduct();
  }, [resetProduct]);

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
    };
    formData.append("data", JSON.stringify(data));
    fetcher.submit(formData, {
      method: "post",
    });
  };

  return (
    <Page
      title="Add Product"
      fullWidth
      backAction={{
        onAction: () => {
          shopify.loading(true);
          navigate("/app/demo");
        },
      }}
      primaryAction={
        <Button icon={SendIcon} variant="primary" onClick={handleSubmit}>
          Save
        </Button>
      }
    >
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
              name="category"
              label="category"
              options={listCategory.data}
              error={product.error.categoryId}
            />
          </FormLayout.Group>
        </FormLayout>
      </Card>
    </Page>
  );
}
