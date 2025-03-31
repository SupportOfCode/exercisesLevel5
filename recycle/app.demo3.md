import {
  TextField,
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  useIndexResourceState,
  Text,
  ChoiceList,
  RangeSlider,
  Badge,
  Page,
  Card,
  Button,
  ButtonGroup,
  Modal,
  Pagination,
} from "@shopify/polaris";
import type { IndexFiltersProps, TabProps } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { DeleteIcon, EditIcon, PlusIcon } from "@shopify/polaris-icons";
import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { formmatedData } from "app/common";
import { queryProduct, queryCategories } from "app/utils/product.server";

export const loader: LoaderFunction = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  // var param
  const title = url.searchParams.get("title") || "";
  const status = url.searchParams.get("status");
  const categoryParams = url.searchParams.get("category");
  const prevCursor = url.searchParams.get("prevCursor");
  const nextCursor = url.searchParams.get("nextCursor");

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
  const responseProducts = await admin.graphql(
    queryProduct(queryCursor, queryTitle, queryStatus, queryCategory),
  );

  const responseCategory = await admin.graphql(queryCategories());

  //   const responseTotalProduct = await admin.graphql(
  //     `#graphql~
  //      query {
  //   productsCount(query: "id:>=1000") {
  //     count
  //   }
  // }`,
  //   );

  const result = (await responseProducts.json()) as any;
  const resultCategory = await responseCategory.json();
  // const resultCountProduct = await responseTotalProduct.json();
  const products = formmatedData(result);

  const category = Object.values(
    resultCategory.data.products.edges
      .map((edge: { node: { category: { id: string; name: string } } }) => ({
        id: edge.node.category?.id?.split("/").pop() || "",
        name: edge.node.category?.name || "",
      }))
      .reduce(
        (
          acc: Record<string, { id: string; name: string }>,
          item: { id: string; name: string },
        ) => {
          acc[item.id] = item;
          return acc;
        },
        {},
      ),
  );

  return {
    data: products,
    // totalProduct: resultCountProduct.data.productsCount.count,
    category: category,
    pageInfo: {
      pageHasNextAndPervious: result.data.products.pageInfo,
      cursorPointerNext:
        result.data.products.edges[result.data.products.edges.length - 1]
          .cursor,
      cursorPointerPervious: result.data.products.edges[0].cursor,
    },
  };
};

export const action: ActionFunction = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const ids = formData.getAll("ids") as string[];

  const responses = await Promise.all(
    ids.map((id) =>
      admin.graphql(
        `#graphql
        mutation {
          productDelete(input: {id: "${id}"}) {
            deletedProductId
            userErrors {
              field
              message
            }
          }
        }`,
      ),
    ),
  );

  return responses;
};

export default function Index() {
  // 1 loaderData and search param
  const products = useLoaderData<typeof loader>();
  console.log("demo product: ", products.pageInfo.cursorPointerNext);
  const [modalActive, setModalActive] = useState(false);
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  const [filterSearch, setFilterSearch] = useState({
    title: "",
    status: [] as string[],
    category: [] as any[],
  });

  // 2 object label
  const categoryMap = Object.fromEntries(
    products.category.map((cat: { id: string; name: string }) => [
      cat.id,
      cat.name,
    ]),
  );

  // 3 set props for index filter
  const [selected, setSelected] = useState(0);
  const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Filtering);

  // 4 handle function index filter
  function handleFilterChange<Key extends keyof FormattedProduct>(
    key: keyof FormattedProduct,
    value: FormattedProduct[Key],
  ) {
    setFilterSearch((prev) => ({ ...prev, [key]: value }));
    setLoading((prev) => ({ ...prev, acceptLoading: true }));
  }

  const handleFiltersClearAll = () => {
    setFilterSearch((prev) => ({
      ...prev,
      title: "",
      status: [],
      category: [],
    }));
  };

  const filters = [
    {
      key: "Status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "ACTIVE", value: "ACTIVE" },
            { label: "DRAFT", value: "DRAFT" },
          ]}
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
        <ChoiceList
          title="Category"
          titleHidden
          choices={products.category.map(
            (item: { name: string; id: string }) => ({
              label: item.name,
              value: item.id,
            }),
          )}
          selected={
            Array.isArray(filterSearch.category)
              ? filterSearch.category
              : [filterSearch.category]
          }
          onChange={(value) => handleFilterChange("category", value)}
        />
      ),
      pinned: true,
    },
  ];

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

  // 9 handle delete
  const handleDelete = () => {
    if (selectedResources.length > 0) {
      const formData = new FormData();
      selectedResources.forEach((id) => formData.append("ids", id));
      fetcher.submit(formData, { method: "delete" });
      setModalActive(false);
      clearSelection();
    }
  };

  // 6 row table
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

  const promotedBulkActions = [
    {
      destructive: true,
      content: "Delete products",
      onAction: () => setModalActive(true),
    },
  ];

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

  // 7 debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      updateParam("title", filterSearch.title.trim());
    }, 500);
    return () => clearTimeout(handler);
  }, [filterSearch.title, searchParams]);

  useEffect(() => {
    updateParam("status", filterSearch.status[0]);
    updateParam("category", filterSearch.category[0]);
  }, [filterSearch.status, filterSearch.category, searchParams]);

  const [loading, setLoading] = useState({
    acceptLoading: false,
    loadingButtonAdd: false,
  });

  useEffect(() => {
    if (fetcher.state !== "idle" || navigation.state === "loading") {
      shopify.loading(true);
    } else {
      shopify.loading(false);
    }
  }, [fetcher.state, navigation.state]);

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

  return (
    <Page
      fullWidth
      title="Product List"
      primaryAction={
        <Button
          icon={PlusIcon}
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
          // label={`${paginationIndex.prev}-${paginationIndex.next} of ${products.totalProduct}`}
        />

        {/* Modal */}
        <Modal
          open={modalActive}
          onClose={() => setModalActive(false)}
          title={`Are you sure you want to delete ${selectedResources.length} products?`}
          primaryAction={{
            content: "Delete",
            destructive: true,
            onAction: handleDelete,
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setModalActive(false) },
          ]}
        >
          <Modal.Section>
            <p>This action cannot be undone.</p>
          </Modal.Section>
        </Modal>
      </Card>
    </Page>
  );

  // 8 handle utils
  function disambiguateLabel(key: string, value: string | any[]): string {
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
  }

  function isEmpty(value: string | any[]) {
    if (Array.isArray(value)) {
      return value.length === 0;
    } else {
      return value === "" || value == null;
    }
  }
}
