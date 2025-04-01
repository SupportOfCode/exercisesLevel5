import { useSearchParams } from "@remix-run/react";

export function useUpdateParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  return (key: string, value: string = "") => {
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
}
