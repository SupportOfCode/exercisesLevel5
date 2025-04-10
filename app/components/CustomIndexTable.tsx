import {
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  Text,
  ChoiceList,
  Badge,
  Button,
  ButtonGroup,
  TextField,
} from "@shopify/polaris";
import type { IndexFiltersProps } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { DeleteIcon, EditIcon } from "@shopify/polaris-icons";
import { useNavigation, useSearchParams } from "@remix-run/react";
import { capitalize } from "app/common";
import { status } from "app/constants";
import { useUpdateParams } from "app/hooks/useUpdateParams";
import { useDebounce } from "app/hooks/useDebounce";
import { SelectionType } from "@shopify/polaris/build/ts/src/utilities/use-index-resource-state";
import { useProductStore } from "app/store";

type SelectedTypeCustom = {
  selectedResources: string[];
  allResourcesSelected: boolean;
  handleSelectionChange: (
    selectionType: SelectionType,
    isSelecting: boolean,
    selection?: string | [number, number],
    _position?: number,
  ) => void;
};

export default function CustomIndexTable({
  products,
  selected,
}: {
  products: argOfProduct;
  selected: SelectedTypeCustom;
}) {
  const navigation = useNavigation();
  const updateParam = useUpdateParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Filtering);
  const { currentcyCode } = useProductStore();

  const resourceName = {
    singular: "product",
    plural: "products",
  };

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
  const [loading, setLoading] = useState(false);
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
      onAction: () => shopify.modal.show("modal-custom"),
    },
  ];

  // handle
  const handleFilterChange = <Key extends keyof FormattedProduct>(
    key: keyof FormattedProduct,
    value: FormattedProduct[Key],
  ) => {
    setFilterSearch((prev) => ({ ...prev, [key]: value }));
    setLoading(true);
  };
  const handleFiltersClearAll = () => {
    setFilterSearch((prev) => ({
      ...prev,
      title: "",
      status: [],
      category: [],
    }));
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
          selected={selected.selectedResources.includes(id)}
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
              {price} {currentcyCode}
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
                onClick={() => shopify.modal.show("modal-custom")}
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

  return (
    <>
      <IndexFilters
        queryValue={filterSearch.title}
        queryPlaceholder="Searching your product"
        onQueryChange={(value) => handleFilterChange("title", value)}
        onQueryClear={() => setFilterSearch((prev) => ({ ...prev, title: "" }))}
        tabs={[]}
        selected={0}
        onSelect={() => {}}
        filters={filters}
        appliedFilters={appliedFilters}
        onClearAll={handleFiltersClearAll}
        mode={mode}
        setMode={setMode}
        loading={navigation.state === "loading" && loading}
      />
      <IndexTable
        resourceName={resourceName}
        itemCount={products.data.length}
        promotedBulkActions={promotedBulkActions}
        selectedItemsCount={
          selected.allResourcesSelected
            ? "All"
            : selected.selectedResources.length
        }
        onSelectionChange={selected.handleSelectionChange}
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
    </>
  );
}
