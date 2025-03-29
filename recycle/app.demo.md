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
} from "@shopify/polaris";
import type { IndexFiltersProps, TabProps } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { DeleteIcon } from "@shopify/polaris-icons";
import { LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import { useLoaderData, useSearchParams } from "@remix-run/react";
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
id: edge.node.category.id.split("/").pop(),
name: edge.node.category.name,
}),
);

return {
data: products,
category: category,
};
};

export default function Demo() {
const products = useLoaderData<typeof loader>();
const [searchParams, setSearchParams] = useSearchParams();
const [filterSearch, setFilterSearch] = useState({
title: "",
status: [] as string[],
category: [] as any[],
description: "",
});

const categoryMap = Object.fromEntries(
products.category.map((cat: { id: string; name: string }) => [
cat.id,
cat.name,
]),
);

const tabs: TabProps[] = [];
const [selected, setSelected] = useState(0);

const sortOptions: IndexFiltersProps["sortOptions"] = [
{ label: "Title", value: "title asc", directionLabel: "A-Z" },
{ label: "Title", value: "title desc", directionLabel: "Z-A" },
{ label: "Description", value: "description asc", directionLabel: "A-Z" },
{ label: "Description", value: "description desc", directionLabel: "Z-A" },
{ label: "Price", value: "price asc", directionLabel: "Ascending" },
{ label: "Price", value: "price desc", directionLabel: "Descending" },
];
const [sortSelected, setSortSelected] = useState(["title asc"]);
const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Filtering);
const [price, setPrice] = useState<[number, number] | undefined>(undefined);

function handleFilterChange<Key extends keyof FormattedProduct>(
key: keyof FormattedProduct,
value: FormattedProduct[Key],
) {
setFilterSearch((prev) => ({ ...prev, [key]: value }));
shopify.loading(true);
}
const handlePriceChange = (value: [number, number]) => setPrice(value);

const handleFiltersClearAll = () => {
setFilterSearch((prev) => ({
...prev,
title: "",
status: [],
category: [],
description: "",
}));
setPrice(undefined);
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
    {
      key: "Description",
      label: "Description with",
      filter: (
        <TextField
          label="Description with"
          value={filterSearch.description}
          onChange={(value) => handleFilterChange("description", value)}
          autoComplete="off"
          labelHidden
        />
      ),
      pinned: true,
    },
    {
      key: "Price",
      label: "Price",
      filter: (
        <RangeSlider
          label="Price is between"
          labelHidden
          value={price || [0, 500]}
          prefix="$"
          output
          min={0}
          max={2000}
          step={1}
          onChange={handlePriceChange}
        />
      ),
      pinned: true,
    },

];

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
if (price) {
const key = "Price";
appliedFilters.push({
key,
label: disambiguateLabel(key, price),
onRemove: () => setPrice(undefined),
});
}
if (!isEmpty(filterSearch.description)) {
const key = "Description";
appliedFilters.push({
key,
label: disambiguateLabel(key, filterSearch.description),
onRemove: () => setFilterSearch((prev) => ({ ...prev, description: "" })),
});
}

const resourceName = {
singular: "product",
plural: "products",
};

const { selectedResources, allResourcesSelected, handleSelectionChange } =
useIndexResourceState(products.data);

const rowMarkup = products.data.map(
(
{ id, title, inventory, description, price, status }: FormattedProduct,
index: number,
) => (
<IndexTable.Row
id={id}
key={id}
selected={selectedResources.includes(id)}
position={index} >
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
<Button tone="critical" icon={DeleteIcon}>
Delete
</Button>
</IndexTable.Cell>
</IndexTable.Row>
),
);

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

// debounce
useEffect(() => {
const handler = setTimeout(() => {
updateParam("title", filterSearch.title.trim());
updateParam("description", filterSearch.description.trim());
}, 500);
return () => clearTimeout(handler);
}, [filterSearch.title, filterSearch.description, searchParams]);

useEffect(() => {
updateParam("status", filterSearch.status[0]);
updateParam("category", filterSearch.category[0]);
}, [filterSearch.status, filterSearch.category, searchParams]);

return (
<Page fullWidth>
<Card padding={"0"}>
<IndexFilters
sortOptions={sortOptions}
sortSelected={sortSelected}
queryValue={filterSearch.title}
queryPlaceholder="Searching your product"
onQueryChange={(value) => handleFilterChange("title", value)}
onQueryClear={() =>
setFilterSearch((prev) => ({ ...prev, title: "" }))
}
onSort={setSortSelected}
tabs={tabs}
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
]} >
{rowMarkup}
</IndexTable>
</Card>
</Page>
);

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
