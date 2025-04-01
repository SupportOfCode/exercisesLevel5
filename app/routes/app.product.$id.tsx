import { ActionFunction, LoaderFunction } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
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
import ModalCustom from "app/components/Modal";
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
  UpdateProduct,
} from "app/utils/product.server";
import { useEffect, useState } from "react";

export const loader: LoaderFunction = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const categorySearch = url.searchParams.get("categorySearch");
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
    return {
      id: argOfProduct.idProduct.split("/").pop(),
      title: "created success",
    };
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
    return {
      title: "updated success",
    };
  } else if (request.method === "DELETE") {
    await admin.graphql(productDelete(`gid://shopify/Product/${params.id}`));
    return {
      title: "deleted success",
    };
  }
};

export default function Product() {
  const fetcher = useFetcher();
  const productOld = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { product, setProduct, editProduct, resetProduct } = useProductStore();
  const navigation = useNavigation();
  const [modalActive, setModalActive] = useState(false);
  const [loadingButton, setLoaddingButton] = useState({
    submitLoading: false,
    deleteLoading: false,
  });
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
    if (fetcher.state === "idle" || navigation.state !== "loading")
      shopify.loading(false);
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
  useEffect(() => {
    updateParams("categorySearch", debouncedCategoryName);
  }, [debouncedCategoryName]);

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
  };

  const handleDelete = () => {
    const formData = new FormData();
    fetcher.submit(formData, { method: "delete" });
    setModalActive(false);
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
      loading={navigation.state === "loading" && fetcher.state === "idle"}
    />
  );

  const argOfPage = {
    title: productOld.page === "new" ? "Add Product" : product.title,
    backAction: {
      onAction: () => {
        shopify.loading(true);
        navigate("/app");
      },
    },
    primaryAction: (
      <Button
        loading={fetcher.state !== "idle" && loadingButton.submitLoading}
        variant="primary"
        onClick={() => {
          handleSubmit();
          setLoaddingButton(() => ({
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
          loading={fetcher.state !== "idle" && loadingButton.deleteLoading}
          variant="secondary"
          tone="critical"
          onClick={() => {
            setLoaddingButton(() => ({
              deleteLoading: true,
              submitLoading: false,
            }));
            setModalActive(true);
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
            <Autocomplete
              options={productOld.category}
              selected={[product.categoryId]}
              onSelect={updateSelection}
              textField={textField}
            />
          </FormLayout.Group>
        </FormLayout>
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
  );
}
