import { ActionFunction, LoaderFunction } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
import { SaveBar } from "@shopify/app-bridge-react";
import {
  Page,
  TextField,
  Select,
  Card,
  Button,
  FormLayout,
  Autocomplete,
  Icon,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import {
  formmatedCategoriesByLabel,
  productData,
  validateData,
} from "app/common";
import { ModalCustom } from "app/components/Modal";
import { productInit, status } from "app/constants";
import { useDebounce } from "app/hooks/useDebounce";
import { useUpdateParams } from "app/hooks/useUpdateParams";
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
  queryLocation,
  UpdateProduct,
} from "app/utils/product.server";
import { useEffect, useState } from "react";

export const loader: LoaderFunction = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const categorySearch = url.searchParams.get("categorySearch");

  try {
    // query data
    const [responseCategory, responseProduct] = await Promise.all([
      admin.graphql(getCategory(categorySearch ?? "")),
      admin.graphql(getProduct(), {
        variables: {
          ownerId: `gid://shopify/Product/${params.id}`,
        },
      }),
    ]);

    // convert data
    const [dataOfCategory, dataOfProduct] = await Promise.all([
      responseCategory.json(),
      responseProduct.json(),
    ]);

    if (!dataOfCategory) throw new Error("Failed to fetch categories.");
    if (!dataOfProduct) throw new Error("Failed to fetch product data.");

    const categoryList = dataOfCategory.data.taxonomy.categories.edges.map(
      (item: nodeCategory) => formmatedCategoriesByLabel(item),
    );

    // return data
    if (params.id === "new")
      return {
        data: productInit,
        page: "new",
        category: categoryList,
      };
    return {
      data: productData(dataOfProduct as ProductResponse),
      category: categoryList,
      page: "edit",
    };
  } catch (error) {
    console.error("Loader Error:", error);
    throw new Response("Internal Server Error");
  }
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

  const responseLocations = await admin.graphql(queryLocation);
  const dataOfLocation = await responseLocations.json();
  const idsOfLocation = dataOfLocation?.data.locations.edges.map(
    (edge: { node: { id: string } }) => edge.node.id,
  );

  if (request.method === "POST") {
    try {
      const responseProduct = await admin.graphql(
        createProduct(data.title, data.description, data.status, paramCategory),
      );
      if (!responseProduct) throw new Error("Failed to create product.");
      const dataOfProduct = await responseProduct.json();
      const argOfProduct = {
        idProduct: dataOfProduct.data.productCreate.product.id,
        idOption: dataOfProduct.data.productCreate.product.options[0].id,
        nameOption: dataOfProduct.data.productCreate.product.options[0].name,
      };

      await Promise.all(
        idsOfLocation.map((id: string) =>
          admin.graphql(ProductVariantsCreate(), {
            variables: {
              productId: argOfProduct.idProduct,
              variants: [
                {
                  inventoryQuantities: {
                    locationId: id,
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
          }),
        ),
      );

      return {
        id: argOfProduct.idProduct.split("/").pop(),
        title: "created success",
      };
    } catch (error) {
      console.error("Action Error:", error);
      throw new Response("Internal Server Error");
    }
  }

  if (request.method === "PUT") {
    try {
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

        idsOfLocation.map((id: string) =>
          admin.graphql(inventoryAdjustQuantities(), {
            variables: {
              input: {
                reason: "correction",
                name: "available",
                changes: [
                  {
                    delta: +data.inventory,
                    inventoryItemId: data.inventoryId,
                    locationId: id,
                  },
                ],
              },
            },
          }),
        ),
      ]);
      return {
        title: "updated success",
      };
    } catch (error) {
      console.error("Action Error:", error);
      throw new Response("Something went wrong");
    }
  }

  if (request.method === "DELETE") {
    try {
      await admin.graphql(productDelete(`gid://shopify/Product/${params.id}`));
      return {
        title: "deleted success",
      };
    } catch (error) {
      console.error("Action Error:", error);
      throw new Response("Something went wrong");
    }
  }
};

export default function Product() {
  const fetcher = useFetcher();
  const productOld = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { product, setProduct, editProduct, resetProduct, currentcyCode } =
    useProductStore();
  const navigation = useNavigation();
  const [loadingButton, setLoaddingButton] = useState({
    submitLoading: false,
    deleteLoading: false,
    acceptLoading: false,
  });
  const [acceptNavigate, setAcceptNavigate] = useState(true);
  // custom hook
  const updateParams = useUpdateParams();

  useEffect(() => {
    if ((fetcher.data as { title: string })?.title === "updated success")
      navigate("/app");
    if ((fetcher.data as { title: string })?.title === "deleted success")
      navigate("/app");
    if ((fetcher.data as { title: string })?.title === "created success")
      navigate(`/app/product/${(fetcher.data as { id: string })?.id}`);
  }, [fetcher.data]);

  useEffect(() => {
    if (navigation.state !== "loading") shopify.loading(false);
    if (navigation.state === "loading") shopify.loading(true);
    if (fetcher.state === "loading")
      shopify.toast.show((fetcher.data as { title: string })?.title);
  }, [fetcher.state, navigation.state]);

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

  const debouncedCategoryName = useDebounce(product.categoryName);
  const [acceptSearchCategory, setAcceptSeachCategory] = useState(false);

  useEffect(() => {
    if (productOld.page === "new" || acceptSearchCategory)
      updateParams("categorySearch", debouncedCategoryName);
  }, [debouncedCategoryName]);

  const handleChange =
    <Key extends keyof ProductType>(field: Key) =>
    (value: ProductType[Key] | any) => {
      editProduct(field, value);
      editProduct("error", { ...product.error, [field]: "" });
      shopify.saveBar.show("save-bar-custom");
      if (field === "categoryName") {
        setAcceptSeachCategory(true);
        setLoaddingButton((prev) => ({ ...prev, acceptLoading: true }));
      }
    };

  const handleSubmit = () => {
    if (!validateData(product, editProduct)) return;
    const formData = new FormData();
    const data = {
      title: product.title,
      description: product.description,
      status: product.status,
      inventory: +product.inventory - productOld.data.inventory,
      price: product.price,
      category: product.categoryId,
      variant: product.variantId,
      inventoryId: product.inventoryItemId,
    };
    formData.append("data", JSON.stringify(data));
    fetcher.submit(formData, {
      method: productOld.page === "new" ? "post" : "put",
    });
    shopify.saveBar.hide("save-bar-custom");
  };

  const handleDelete = () => {
    const formData = new FormData();
    fetcher.submit(formData, { method: "delete" });
    shopify.modal.hide("modal-custom");
  };

  const updateSelection = (selected: string[]) => {
    const selectedValue = selected.map((selectedItem) => {
      const matchedOption = productOld.category.find(
        (option: { value: string; label: string }) => {
          return option.value.match(selectedItem);
        },
      );
      return matchedOption && matchedOption.label;
    });
    editProduct("categoryId", selected[0]);
    editProduct("categoryName", selectedValue[0]);
  };

  const textField = (
    <Autocomplete.TextField
      onChange={handleChange("categoryName")}
      label="Category"
      requiredIndicator
      value={product.categoryName}
      prefix={<Icon source={SearchIcon} tone="base" />}
      placeholder="Search category ..."
      autoComplete="off"
      loading={
        navigation.state === "loading" &&
        fetcher.state === "idle" &&
        loadingButton.acceptLoading
      }
    />
  );

  const argOfPage = {
    title: productOld.page === "new" ? "Add Product" : product.title,
    backAction: {
      onAction: () => {
        if (acceptNavigate) navigate("/app");
      },
    },
    primaryAction: (
      <Button
        loading={fetcher.state !== "idle" && loadingButton.submitLoading}
        variant="primary"
        onClick={() => {
          handleSubmit();
          setLoaddingButton(() => ({
            acceptLoading: false,
            submitLoading: true,
            deleteLoading: false,
          }));
        }}
      >
        Save
      </Button>
    ),
    secondaryActions:
      productOld.page === "edit" ? (
        <Button
          loading={
            fetcher.state !== "idle" &&
            loadingButton.deleteLoading &&
            loadingButton.acceptLoading
          }
          variant="secondary"
          tone="critical"
          onClick={() => {
            setLoaddingButton(() => ({
              acceptLoading: false,
              deleteLoading: true,
              submitLoading: false,
            }));
            shopify.modal.show("modal-custom");
          }}
        >
          Delete
        </Button>
      ) : (
        []
      ),
  };

  return (
    <Page
      title={argOfPage.title}
      backAction={argOfPage.backAction}
      primaryAction={argOfPage.primaryAction}
      secondaryActions={argOfPage.secondaryActions}
    >
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
              suffix={currentcyCode}
              requiredIndicator
              value={product.price}
              onChange={handleChange("price")}
              error={product.error.price}
              maxLength={20}
              min={0}
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
              min={0}
            />
            <Autocomplete
              options={productOld.category}
              selected={[product.categoryId]}
              onSelect={updateSelection}
              textField={textField}
            />
          </FormLayout.Group>
        </FormLayout>
        <ModalCustom
          text={{
            titleModal: "Delete Products",
            titleMain: `Are you want to delete this product`,
            titleAction: "Delete",
          }}
          handleCancle={() => shopify.modal.hide("modal-custom")}
          handleMain={handleDelete}
        />
        <SaveBar
          id="save-bar-custom"
          onShow={() => setAcceptNavigate(false)}
          onHide={() => setAcceptNavigate(true)}
        >
          <button
            variant="primary"
            onClick={() => {
              handleSubmit();
              shopify.saveBar.hide("save-bar-custom");
            }}
          />
          <button
            onClick={() => {
              shopify.saveBar.hide("save-bar-custom");
              setProduct(productOld.data);
            }}
          />
        </SaveBar>
      </Card>
    </Page>
  );
}
