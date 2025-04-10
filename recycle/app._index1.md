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
  TextField,
} from "@shopify/polaris";
import type { IndexFiltersProps } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { DeleteIcon, EditIcon } from "@shopify/polaris-icons";
import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import {
  capitalize,
  formmatedCategoriesByLabel,
  formmatedData,
} from "app/common";
import {
  queryProduct,
  productDelete,
  getCategory,
} from "app/utils/product.server";
import ModalCustom from "app/components/Modal";
import { status } from "app/constants";
import { useUpdateParams } from "app/hooks/useUpdateParams";
import { useDebounce } from "app/hooks/useDebounce";

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
  const [responseCategoryUpdate, responseProducts] = await Promise.all([
    admin.graphql(getCategory(searchCategoryParams ?? "")),
    admin.graphql(
      queryProduct(queryCursor, queryTitle, queryStatus, queryCategory),
    ),
  ]);

  // convert data
  const [dataOfProduct, dataOfCategories] = await Promise.all([
    responseProducts.json(),
    responseCategoryUpdate.json(),
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
  const updateParam = useUpdateParams();
  const [searchParams, setSearchParams] = useSearchParams();
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
    products.category.map((cat: { value: string; label: string }) => [
      cat.value,
      cat.label,
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
          selected={filterSearch.status}
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
            choices={products.category}
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
  const HandlePaginationPrev = () => {
    const params = new URLSearchParams(searchParams);
    shopify.loading(true);
    if (navigation.state === "loading") return;
    params.delete("nextCursor");
    params.set("prevCursor", products.pageInfo.startCursor);
    setSearchParams(params);
  };
  const HandlePaginationNext = () => {
    const params = new URLSearchParams(searchParams);
    shopify.loading(true);
    if (navigation.state === "loading") return;
    params.delete("prevCursor");
    params.set("nextCursor", products.pageInfo.endCursor);
    setSearchParams(params);
  };
  const handleCancel = () => {
    setModalActive(false);
    clearSelection();
  };
  const disambiguateLabel = (key: string, value: string | string[]): string => {
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
  const isEmpty = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.length === 0;
    } else {
      return value === "" || value == null;
    }
  };
  //  applied filter
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
    ) => {
      const formattedInventory =
        +inventory > 0 ? `${inventory} In Stock` : "Out of Stock";
      const fomattedInventoryTone = +inventory > 0 ? "base" : "critical";
      const fomattedStatus = capitalize(status);
      const fomattedStatusTone = status === "ACTIVE" ? "success" : "info";
      const paramId = id.split("/").pop();

      return (
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
            <Text as="span" tone={fomattedInventoryTone} numeric>
              {formattedInventory}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>{description}</IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span" numeric>
              {price} đ
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={fomattedStatusTone}>{fomattedStatus}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <ButtonGroup>
              <Button
                tone="success"
                url={`/app/product/${paramId}`}
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
      );
    },
  );

  const debouncedTitle = useDebounce(filterSearch.title);
  const debouncedCategory = useDebounce(filterSearch.searchCategory);
  useEffect(() => {
    updateParam("title", debouncedTitle.trim());
    updateParam("searchCategory", debouncedCategory.trim());
    updateParam("status", filterSearch.status[0]);
    updateParam("category", filterSearch.category[0]?.split("/").pop());
  }, [
    debouncedTitle,
    debouncedCategory,
    filterSearch.status,
    filterSearch.category,
  ]);

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
    ),
  };

  return (
    <Page
      fullWidth
      title={argOfPage.title}
      primaryAction={argOfPage.primaryAction}
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
          selected={0}
          onSelect={() => {}}
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
          pagination={{
            hasNext: products.pageInfo.hasNextPage,
            hasPrevious: products.pageInfo.hasPreviousPage,
            onNext: HandlePaginationNext,
            onPrevious: HandlePaginationPrev,
          }}
        >
          {rowMarkup}
        </IndexTable>
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
