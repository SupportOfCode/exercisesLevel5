import {
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  useIndexResourceState,
  Text,
  ChoiceList,
  Badge,
  Page,
  Card,
  Button,
  ButtonGroup,
  Pagination,
  TextField,
  Frame,
} from "@shopify/polaris";
import type { IndexFiltersProps } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { DeleteIcon, EditIcon, PlusIcon } from "@shopify/polaris-icons";
import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { formmatedCategory, formmatedData } from "app/common";
import {
  queryProduct,
  productDelete,
  getCategory,
} from "app/utils/product.server";
import ModalCustom from "app/components/Modal";
import { status } from "app/constants";

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
  const responseCategoryUpdate = await admin.graphql(
    getCategory(searchCategoryParams ?? ""),
  );
  const responseProducts = await admin.graphql(
    queryProduct(queryCursor, queryTitle, queryStatus, queryCategory),
  );

  // convert data
  const dataOfProduct = (await responseProducts.json()) as ProductsResponse;
  const products = formmatedData(dataOfProduct);
  const dataOfCategories = await responseCategoryUpdate.json();
  const categories = dataOfCategories.data.taxonomy.categories.edges.map(
    (item: nodeCategory) => formmatedCategory(item),
  );

  // return data
  return {
    data: products,
    category: categories,
    pageInfo: {
      pageHasNextAndPervious: dataOfProduct.data.products.pageInfo,
      cursorPointerNext: dataOfProduct.data.products.edges[
        dataOfProduct.data.products.edges.length - 1
      ]
        ? dataOfProduct.data.products.edges[
            dataOfProduct.data.products.edges.length - 1
          ].cursor
        : "",
      cursorPointerPervious: dataOfProduct.data.products.edges[0]
        ? dataOfProduct.data.products.edges[0].cursor
        : "",
    },
  };
};

export const action: ActionFunction = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const ids = formData.getAll("ids") as string[];
  await Promise.all(ids.map((id) => admin.graphql(productDelete(id))));
  return "Deleted success";
};

export default function Index() {
  const products = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Filtering);
  const resourceName = {
    singular: "product",
    plural: "products",
  };
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(products.data, {
    resourceIDResolver: (data) => String(data.id),
  });
  const [selected, setSelected] = useState(0);
  const [modalActive, setModalActive] = useState(false);
  const [filterSearch, setFilterSearch] = useState<{
    title: string;
    status: string[];
    category: string[];
    searchCategory: string;
  }>({
    title: "",
    status: [],
    category: [],
    searchCategory: "",
  });
  const [loading, setLoading] = useState({
    acceptLoading: false,
    loadingButtonAdd: false,
  });
  // object label
  const categoryMap = Object.fromEntries(
    products.category.map((cat: { id: string; name: string }) => [
      cat.id,
      cat.name,
    ]),
  );
  // filter
  const filters = [
    {
      key: "Status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={status}
          selected={
            Array.isArray(filterSearch.status)
              ? filterSearch.status
              : [filterSearch.status]
          }
          onChange={(value) => handleFilterChange("status", value)}
        />
      ),
      pinned: true,
    },
    {
      key: "Category",
      label: "Category",
      filter: (
        <>
          <TextField
            label="Category"
            value={filterSearch.searchCategory}
            onChange={(value) => handleFilterChange("searchCategory", value)}
            placeholder="Search category..."
            autoComplete="off"
            labelHidden
          />
          <ChoiceList
            title="Category"
            titleHidden
            choices={products.category.map(
              (item: { name: string; id: string }) => ({
                label: item.name,
                value: item.id,
              }),
            )}
            selected={filterSearch.category}
            onChange={(value) => handleFilterChange("category", value)}
          />
        </>
      ),
      pinned: true,
    },
  ];
  const promotedBulkActions = [
    {
      destructive: true,
      content: "Delete products",
      onAction: () => setModalActive(true),
    },
  ];

  // handle
  const handleFilterChange = <Key extends keyof FormattedProduct>(
    key: keyof FormattedProduct,
    value: FormattedProduct[Key],
  ) => {
    setFilterSearch((prev) => ({ ...prev, [key]: value }));
    setLoading((prev) => ({ ...prev, acceptLoading: true }));
  };
  const handleFiltersClearAll = () => {
    setFilterSearch((prev) => ({
      ...prev,
      title: "",
      status: [],
      category: [],
    }));
  };
  const handleDelete = () => {
    if (selectedResources.length > 0) {
      const formData = new FormData();
      selectedResources.forEach((id) => formData.append("ids", id));
      fetcher.submit(formData, { method: "delete" });
      setModalActive(false);
      clearSelection();
    }
  };
  const updateParam = (key: string, value?: string) => {
    let hasChanged = false;
    if (value && value !== params.get(key)) {
      params.set(key, value);
      hasChanged = true;
    } else if (!value && params.has(key)) {
      params.delete(key);
      hasChanged = true;
    }
    if (hasChanged) {
      setSearchParams(params);
    }
  };
  const HandlePaginationPrev = () => {
    shopify.loading(true);
    if (navigation.state === "loading") return;
    params.delete("nextCursor");
    updateParam("prevCursor", products.pageInfo.cursorPointerPervious);
  };
  const HandlePaginationNext = () => {
    shopify.loading(true);
    if (navigation.state === "loading") return;
    params.delete("prevCursor");
    updateParam("nextCursor", products.pageInfo.cursorPointerNext);
  };
  const handleCancel = () => {
    setModalActive(false);
    clearSelection();
  };
  const disambiguateLabel = (key: string, value: string | any[]): string => {
    switch (key) {
      case "Price":
        return `Price is between ${value[0]}đ and ${value[1]}đ`;
      case "Description":
        return `Description is  ${value}`;
      case "Status":
        return (value as string[]).map((val) => val).join(", ");
      case "Category":
        return (value as string[])
          .map((val) => categoryMap[val] || val)
          .join(", ");
      default:
        return value as string;
    }
  };
  const isEmpty = (value: string | any[]) => {
    if (Array.isArray(value)) {
      return value.length === 0;
    } else {
      return value === "" || value == null;
    }
  };

  // 5 applied filter
  const appliedFilters: IndexFiltersProps["appliedFilters"] = [];
  if (filterSearch.status && !isEmpty(filterSearch.status)) {
    const key = "Status";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, filterSearch.status),
      onRemove: () => setFilterSearch((prev) => ({ ...prev, status: [] })),
    });
  }

  if (filterSearch.category && !isEmpty(filterSearch.category)) {
    const key = "Category";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, filterSearch.category),
      onRemove: () => setFilterSearch((prev) => ({ ...prev, category: [] })),
    });
  }

  // component
  const rowMarkup = products.data.map(
    (
      { id, title, inventory, description, price, status }: FormattedProduct,
      index: number,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone={+inventory > 0 ? "base" : "critical"} numeric>
            {+inventory > 0 ? inventory + " In Stock" : "Out of Stock"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{description}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" numeric>
            {price} đ
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={status === "ACTIVE" ? "success" : "info"}>
            {Array.isArray(status) ? status.join(", ") : status}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <ButtonGroup>
            <Button
              tone="success"
              url={`/app/product/${id.split("/").pop()}`}
              icon={EditIcon}
              onClick={() => shopify.loading(true)}
            />
            <Button
              tone="critical"
              icon={DeleteIcon}
              onClick={() => setModalActive(true)}
            />
          </ButtonGroup>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      updateParam("title", filterSearch.title.trim());
      updateParam("searchCategory", filterSearch.searchCategory.trim());
    }, 500);
    return () => clearTimeout(handler);
  }, [filterSearch.title, filterSearch.searchCategory]);

  useEffect(() => {
    updateParam("status", filterSearch.status[0]);
    updateParam("category", filterSearch.category[0]?.split("/").pop());
  }, [filterSearch.status, filterSearch.category]);

  useEffect(() => {
    if (fetcher.state !== "idle" || navigation.state === "loading") {
      shopify.loading(true);
    } else {
      shopify.loading(false);
    }

    if (fetcher.state === "loading") shopify.toast.show(fetcher.data as string);
  }, [fetcher.state, navigation.state]);

  return (
    <Page
      fullWidth
      title="Product List"
      primaryAction={
        <Button
          url="/app/product/new"
          variant="primary"
          loading={loading.loadingButtonAdd}
          onClick={() => {
            setLoading((prev) => ({
              ...prev,
              acceptLoading: false,
              loadingButtonAdd: true,
            }));
          }}
        >
          New Product
        </Button>
      }
    >
      <Card padding={"0"}>
        <IndexFilters
          queryValue={filterSearch.title}
          queryPlaceholder="Searching your product"
          onQueryChange={(value) => handleFilterChange("title", value)}
          onQueryClear={() =>
            setFilterSearch((prev) => ({ ...prev, title: "" }))
          }
          tabs={[]}
          selected={selected}
          onSelect={setSelected}
          filters={filters}
          appliedFilters={appliedFilters}
          onClearAll={handleFiltersClearAll}
          mode={mode}
          setMode={setMode}
          loading={navigation.state === "loading" && loading.acceptLoading}
        />
        <IndexTable
          resourceName={resourceName}
          itemCount={products.data.length}
          promotedBulkActions={promotedBulkActions}
          selectedItemsCount={
            allResourcesSelected ? "All" : selectedResources.length
          }
          onSelectionChange={handleSelectionChange}
          headings={[
            { title: "Title" },
            { title: "Inventory" },
            { title: "Description" },
            { title: "Price" },
            { title: "status" },
            { title: "Actions" },
          ]}
        >
          {rowMarkup}
        </IndexTable>

        <Pagination
          onPrevious={HandlePaginationPrev}
          onNext={HandlePaginationNext}
          type="table"
          hasNext={products.pageInfo.pageHasNextAndPervious.hasNextPage}
          hasPrevious={products.pageInfo.pageHasNextAndPervious.hasPreviousPage}
        />

        <ModalCustom
          modalActive={modalActive}
          handleCancle={handleCancel}
          numberOfProduct={selectedResources.length}
          handleDelete={handleDelete}
        />
      </Card>
    </Page>
  );
}
