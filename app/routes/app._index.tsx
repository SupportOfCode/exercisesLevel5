import { useIndexResourceState, Page, Card, Button } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import { useFetcher, useLoaderData, useNavigation } from "@remix-run/react";
import { formmatedCategoriesByLabel, formmatedData } from "app/common";
import {
  queryProduct,
  productDelete,
  getCategory,
  getCurrentcyCode,
} from "app/utils/product.server";
import CustomIndexTable from "app/components/CustomIndexTable";
import { useProductStore } from "app/store";
import { ModalCustom } from "app/components/Modal";

export const loader: LoaderFunction = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  // var param
  const title = url.searchParams.get("title") || "";
  const status = url.searchParams.get("status");
  const categoryParams = url.searchParams.get("category");
  const prevCursor = url.searchParams.get("prevCursor");
  const nextCursor = url.searchParams.get("nextCursor");
  const searchCategoryParams = url.searchParams.get("searchCategory");

  // var query
  const queryTitle = title.trim() ? `title:*${title}* ` : "";
  const queryStatus = status !== null ? `status:${status} ` : "";
  const queryCategory =
    categoryParams !== null ? `category_id:${categoryParams} ` : "";
  const queryCursor =
    nextCursor !== null
      ? `first: 5, after: "${nextCursor}"`
      : prevCursor !== null
        ? `last: 5, before: "${prevCursor}"`
        : "first: 5";

  // query data
  try {
    const [responseCategoryUpdate, responseProducts, responseCurrencyCode] =
      await Promise.all([
        admin.graphql(getCategory(searchCategoryParams ?? "")),
        admin.graphql(
          queryProduct(queryCursor, queryTitle, queryStatus, queryCategory),
        ),
        admin.graphql(getCurrentcyCode()),
      ]);
    if (!responseCategoryUpdate)
      throw new Error("Failed to get responseCategoryUpdate.");
    if (!responseProducts) throw new Error("Failed to get responseProducts.");
    if (!responseCurrencyCode)
      throw new Error("Failed to get responseCurrencyCode.");

    // convert data
    const [dataOfProduct, dataOfCategories, dataOfcurrencyCode] =
      await Promise.all([
        responseProducts.json(),
        responseCategoryUpdate.json(),
        responseCurrencyCode.json(),
      ]);
    const products = formmatedData(dataOfProduct as ProductsResponse);
    const categories = dataOfCategories.data.taxonomy.categories.edges.map(
      (item: nodeCategory) => formmatedCategoriesByLabel(item),
    );

    // return data
    return {
      data: products,
      category: categories,
      pageInfo: dataOfProduct.data.products.pageInfo,
      currencyCode: dataOfcurrencyCode.data.shop.currencyCode,
    };
  } catch (error) {
    console.error("Action Error:", error);
    throw new Response("Internal Server Error");
  }
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const ids = formData.getAll("ids") as string[];
    await Promise.all(ids.map((id) => admin.graphql(productDelete(id))));
    return "Deleted success";
  } catch (error) {
    console.error("action error", error);
    throw new Response("Somthing went wrong");
  }
};

export default function Index() {
  const products = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(products.data, {
    resourceIDResolver: (data) => String(data.id),
  });
  const { setCurrentcyCode } = useProductStore();
  const [loading, setLoading] = useState(false);

  const handleDelete = () => {
    if (selectedResources.length > 0) {
      const formData = new FormData();
      selectedResources.forEach((id) => formData.append("ids", id));
      fetcher.submit(formData, { method: "delete" });
      shopify.modal.hide("modal-custom");
      clearSelection();
    }
  };
  const handleCancel = () => {
    shopify.modal.hide("modal-custom");
    clearSelection();
  };

  useEffect(() => {
    setCurrentcyCode(products.currencyCode);
  }, []);

  useEffect(() => {
    if (selectedResources.length === 0) shopify.modal.hide("modal-custom");
  }, [selectedResources.length]);

  useEffect(() => {
    if (fetcher.state !== "idle" || navigation.state === "loading") {
      shopify.loading(true);
    } else {
      shopify.loading(false);
    }
    if (fetcher.state === "loading") shopify.toast.show(fetcher.data as string);
  }, [fetcher.state, navigation.state]);

  const argOfPage = {
    title: "Product List",
    primaryAction: (
      <Button
        url="/app/product/new"
        variant="primary"
        loading={loading}
        onClick={() => setLoading(true)}
      >
        New Product
      </Button>
    ),
  };

  return (
    <Page
      fullWidth
      title={argOfPage.title}
      primaryAction={argOfPage.primaryAction}
    >
      <Card padding={"0"}>
        <CustomIndexTable
          products={products}
          selected={{
            selectedResources,
            allResourcesSelected,
            handleSelectionChange,
          }}
        />

        <ModalCustom
          text={{
            titleModal: "Delete Products",
            titleMain: `Are you want to delete ${selectedResources.length > 1 ? selectedResources.length + "products" : "a product"}`,
            titleAction: "Delete",
          }}
          handleCancle={handleCancel}
          handleMain={handleDelete}
        />
      </Card>
    </Page>
  );
}
