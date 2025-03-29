import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { Page, Card, Button } from "@shopify/polaris";
import { SendIcon } from "@shopify/polaris-icons";
import { validateData } from "app/common";
import FormProduct from "app/components/FormProduct";
import { authenticate } from "app/shopify.server";
import { useProductStore } from "app/store";

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

  return formmatedData;
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
  const listCategory = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const { product, editProduct } = useProductStore();

  // useEffect(() => {
  //   if (listCategory.page === "new") resetProduct();
  // }, [resetProduct]);

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
        <FormProduct listCategory={listCategory as any[]} />
      </Card>
    </Page>
  );
}
