import { IndexFilters } from "@shopify/polaris";
import { useState } from "react";

export function CustomIndexTable() {
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
    </>
  );
}
