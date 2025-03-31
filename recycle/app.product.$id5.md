import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import {
  Page,
  TextField,
  Select,
  Card,
  Button,
  FormLayout,
  Banner,
  Box,
  Toast,
  Frame,
  Autocomplete,
  Icon,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { useCheckNavigation, validateData } from "app/common";
import ModalCustom from "app/components/Modal";
import { productInit, status } from "app/constants";
import { authenticate } from "app/shopify.server";
import { useProductStore } from "app/store";
import {
  createProduct,
  getCategory,
  getProduct,
  inventoryAdjustQuantities,
  productDelete,
  productVariantsBulkUpdate,
  ProductVariantsCreate,
  UpdateProduct,
} from "app/utils/product.server";
import { useCallback, useEffect, useMemo, useState } from "react";

export const loader: LoaderFunction = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const categorySearch = url.searchParams.get("categorySearch");

  // query data
  const responseCategory = await admin.graphql(
    getCategory(categorySearch ?? ""),
  );
  const responseProduct = await admin.graphql(getProduct(), {
    variables: {
      ownerId: `gid://shopify/Product/${params.id}`,
    },
  });

  // convert data
  const dataCategory = await responseCategory.json();
  const dataOfProduct = await responseProduct.json();
  const categoryList = dataCategory.data.taxonomy.categories.edges.map(
    (item: { node: { id: string; name: string } }) => ({
      value: item.node.id,
      label: item.node.name,
    }),
  );

  // return data
  if (params.id === "new")
    return {
      data: productInit,
      page: "new",
      category: categoryList,
    };
  return {
    data: {
      ...productInit,
      title: dataOfProduct.data.product?.title,
      description: dataOfProduct.data.product?.description,
      status: dataOfProduct.data.product?.status,
      price: dataOfProduct.data.product?.variants.edges[0].node.price,
      inventory:
        dataOfProduct.data.product?.variants.edges[0].node.inventoryQuantity.toString(),
      categoryId: dataOfProduct.data.product?.category.id,
      categoryName: dataOfProduct.data.product.category.name,
      variantId: dataOfProduct.data.product?.variants.edges[0].node.id,
      inventoryItemId:
        dataOfProduct.data.product.variants.edges[0].node.inventoryItem.id,
    },
    category: categoryList,
    page: "edit",
  };
};

export const action: ActionFunction = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = JSON.parse(formData.get("data") as string);
  const paramCategory = data
    ? !data.category.trim()
      ? "gid://shopify/TaxonomyCategory/na"
      : data.category
    : "";

  if (request.method === "POST") {
    const responseProduct = await admin.graphql(
      createProduct(data.title, data.description, data.status, paramCategory),
    );
    const dataOfProduct = await responseProduct.json();
    const argOfProduct = {
      idProduct: dataOfProduct.data.productCreate.product.id,
      idOption: dataOfProduct.data.productCreate.product.options[0].id,
      nameOption: dataOfProduct.data.productCreate.product.options[0].name,
    };

    await admin.graphql(ProductVariantsCreate(), {
      variables: {
        productId: argOfProduct.idProduct,
        variants: [
          {
            inventoryQuantities: {
              locationId: "gid://shopify/Location/104149254454",
              availableQuantity: +data.inventory,
            },
            price: +data.price,
            optionValues: {
              optionId: argOfProduct.idOption,
              name: argOfProduct.nameOption,
            },
          },
        ],
      },
    });
    return redirect(`/app/product/${argOfProduct.idProduct.split("/").pop()}`);
  } else if (request.method === "PUT") {
    await Promise.all([
      admin.graphql(UpdateProduct(), {
        variables: {
          input: {
            id: `gid://shopify/Product/${params.id}`,
            title: data.title,
            descriptionHtml: data.description,
            status: data.status,
            category: data.category,
          },
        },
      }),

      admin.graphql(productVariantsBulkUpdate(), {
        variables: {
          productId: `gid://shopify/Product/${params.id}`,
          variants: [
            {
              id: data.variant,
              price: +data.price,
            },
          ],
        },
      }),

      admin.graphql(inventoryAdjustQuantities(), {
        variables: {
          input: {
            reason: "correction",
            name: "available",
            changes: [
              {
                delta: +data.inventory,
                inventoryItemId: data.inventoryId,
                locationId: "gid://shopify/Location/104149254454",
              },
            ],
          },
        },
      }),
    ]);
    return redirect("/app");
  } else if (request.method === "DELETE") {
    await admin.graphql(productDelete(`gid://shopify/Product/${params.id}`));
    return redirect("/app");
  }
};

export default function Product() {
  const fetcher = useFetcher();
  const productOld = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { product, setProduct, editProduct, resetProduct } = useProductStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  // custom hook
  const banner = useCheckNavigation();
  const [modalActive, setModalActive] = useState(false);
  const [loadingButton, setLoaddingButton] = useState({
    submitLoading: false,
    deleteLoading: false,
    // showBanner: true,
    showToast: false,
    contentToast: "",
  });

  useEffect(() => {
    if (fetcher.state === "idle" || navigation.state !== "loading")
      shopify.loading(false);

    if (fetcher.state === "loading")
      setLoaddingButton((prev) => ({ ...prev, showToast: true }));
  }, [fetcher.state, navigation.state]);

  useEffect(() => {
    setLoaddingButton((prev) => ({ ...prev, showBanner: banner }));
  }, [banner]);

  useEffect(() => {
    const defaultValueCategory = !product.categoryId.trim()
      ? (productOld.category[0]?.value ?? "")
      : product.categoryId;

    editProduct("categoryId", defaultValueCategory);
  }, [productOld.category]);

  useEffect(
    () => {
      setProduct(productOld.data);
      return () => resetProduct();
    },
    Object.keys(productOld.data).filter((key) => key !== "categoryId"),
  );

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
      updateParam("categorySearch", product.categoryName.trim() || undefined);
      if (hasChanged) {
        setSearchParams(params);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [product.categoryName, searchParams]);

  console.log("productOld", productOld.data);
  console.log("product", product);

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
      variant: product.variantId,
      inventoryId: product.inventoryItemId,
    };
    setLoaddingButton((prev) => ({ ...prev, contentToast: "saved success" }));
    formData.append("data", JSON.stringify(data));
    fetcher.submit(formData, {
      method: productOld.page === "new" ? "post" : "put",
    });
  };

  const handleDelete = () => {
    const formData = new FormData();
    setLoaddingButton((prev) => ({ ...prev, contentToast: "deleted success" }));
    fetcher.submit(formData, { method: "delete" });
    setModalActive(false);
  };

  const toastMarkup = loadingButton.showToast ? (
    <Toast
      content={loadingButton.contentToast}
      onDismiss={() =>
        setLoaddingButton((prev) => ({ ...prev, showToast: false }))
      }
    />
  ) : null;

  // \//////////////////////////////

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  // const [inputValue, setInputValue] = useState("");

  // const updateText = (value: string) => setInputValue(value);

  const updateSelection = (selected: string[]) => {
    const selectedValue = selected.map((selectedItem) => {
      const matchedOption = productOld.category.find(
        (option: { value: string; label: string }) => {
          return option.value.match(selectedItem);
        },
      );
      return matchedOption && matchedOption.label;
    });

    setSelectedOptions(selected);
    editProduct("categoryId", selected[0]);
    // setInputValue(selectedValue[0] || "");
    editProduct("categoryName", selectedValue[0]);
    // console.log(selectedValue[0]);
    // console.log("1", product.categoryId);
    // console.log("1", product.categoryName);
  };

  console.log(product.categoryName);

  const textField = (
    <Autocomplete.TextField
      onChange={handleChange("categoryName")}
      label="Category"
      requiredIndicator
      value={product.categoryName}
      prefix={<Icon source={SearchIcon} tone="base" />}
      placeholder="Search category ..."
      autoComplete="off"
    />
  );

  return (
    <Frame>
      <Page
        title={productOld.page === "new" ? "Add Product" : product.title}
        backAction={{
          onAction: () => {
            shopify.loading(true);
            navigate("/app");
          },
        }}
        primaryAction={
          <Button
            loading={fetcher.state !== "idle" && loadingButton.submitLoading}
            variant="primary"
            onClick={() => {
              handleSubmit();
              setLoaddingButton((prev) => ({ ...prev, submitLoading: true }));
            }}
          >
            Save
          </Button>
        }
        secondaryActions={
          productOld.page === "edit" ? (
            <Button
              loading={fetcher.state !== "idle" && loadingButton.deleteLoading}
              variant="secondary"
              tone="critical"
              onClick={() => {
                setLoaddingButton((prev) => ({ ...prev, deleteLoading: true }));
                setModalActive(true);
              }}
            >
              Delete
            </Button>
          ) : (
            []
          )
        }
      >
        {/* <Box paddingBlock={"100"}>
          {loadingButton.showBanner && productOld.page === "edit" && (
            <Banner
              title={`Added ${product.title}`}
              tone="success"
              action={{
                content: "back home page to see",
                onAction: () => {
                  shopify.loading(true);
                  navigate("/app/demo");
                },
              }}
              onDismiss={() =>
                setLoaddingButton((prev) => ({ ...prev, showBanner: false }))
              }
            />
          )}
        </Box> */}
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
              {/* <Box> */}
              {/* <TextField
                  label="Category"
                  placeholder="Category search ..."
                  autoComplete="off"
                  value={product.categorySearch}
                  requiredIndicator
                  onChange={handleChange("categorySearch")}
                /> */}
              {/* <Box padding={"100"} />
                <Select
                  onChange={handleChange("categoryId")}
                  value={product.categoryId}
                  name="category"
                  label=""
                  options={
                    !product.categorySearch.trim()
                      ? [
                          {
                            value: productOld.data.categoryId,
                            label: productOld.data.categoryName,
                          },
                        ]
                      : productOld.category
                  }
                /> */}
              {/* </Box> */}
              <Autocomplete
                options={productOld.category}
                selected={selectedOptions}
                onSelect={updateSelection}
                textField={textField}
              />
            </FormLayout.Group>
          </FormLayout>
          {toastMarkup}
          <ModalCustom
            modalActive={modalActive}
            handleCancle={() => {
              setModalActive(false);
            }}
            numberOfProduct={1}
            handleDelete={handleDelete}
          />
        </Card>
      </Page>
    </Frame>
  );
}
