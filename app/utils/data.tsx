import { LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";

export const loader: LoaderFunction = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql~
      query {
      products(first: 10 ") {
        edges {
        node {
            category
        }
        }
        }
      }`,
  );

  const result = await response.json();
  return result;
};
