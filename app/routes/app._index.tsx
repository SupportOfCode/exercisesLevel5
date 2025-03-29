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
  useSearchParams,
} from "@remix-run/react";
import { formmatedData } from "app/common";

export const loader: LoaderFunction = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const title = url.searchParams.get("title") || "";
  const status = url.searchParams.get("status");
  const categoryParams = url.searchParams.get("category");

  const queryTitle = title.trim() ? `title:*${title}* ` : "";
  const queryStatus = status !== null ? `status:${status} ` : "";
  const queryCategory =
    categoryParams !== null ? `category_id:${categoryParams} ` : "";

  const response = await admin.graphql(
    `#graphql~
      query {
      products(first: 10 ,query: "${queryTitle} ${queryStatus} ${queryCategory}") {
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
        }
      }`,
  );

  const responseCategory = await admin.graphql(
    `#graphql~
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
}`,
  );

  const result = (await response.json()) as ProductsResponse;
  const resultCategory = await responseCategory.json();
  const products = formmatedData(result);
  const category: string[] = resultCategory.data.products.edges.map(
    (edge: { node: { category: { id: string; name: string } } }) => ({
      id: edge.node.category?.id.split("/").pop() || "",
      name: edge.node.category?.name || "",
    }),
  );

  return {
    data: products,
    category: category,
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
  const [modalActive, setModalActive] = useState(false);
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
    shopify.loading(true);
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
        <IndexTable.Cell>{inventory} In Stock</IndexTable.Cell>
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
              icon={EditIcon}
              onClick={() => navigate(`/app/product/${id}`)}
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
    const params = new URLSearchParams(searchParams);
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

  return (
    <Page
      fullWidth
      title="Product List"
      primaryAction={
        <Button icon={PlusIcon} url="/app/product/new" variant="primary">
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
