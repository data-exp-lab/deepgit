import { useNavigate } from "react-router-dom";

type SetterInputFunction<Z> = (prev: Z) => Z;

export function getQuery(): string {
  return window.location.hash.replace(/^.*\?/, "");
}

function getQueryParams(): URLSearchParams {
  const hash = window.location.hash;
  if (hash.includes("?")) return new URLSearchParams(getQuery());
  return new URLSearchParams();
}

/**
 * Hook to manage a variable in the url.
 *
 * @param key {string} Name of the variable
 * @param defaultValue {string} The default / initial value of the attribute (not set in the url)
 * @param read {function} A function to get the state value from the query value
 * @param write {function} A function to get the query value from the state value
 */
export function useQueryParam<T>(
  key: string,
  defaultValue: T,
  read?: (queryValue: string | null) => T,
  write?: (stateValue: T) => string | null,
): [T, (value: T | SetterInputFunction<T>, replace?: boolean) => void] {
  const navigate = useNavigate();

  /**
   * Retrieve the value of the given parameter.
   */
  function getQueryParam(key: string): T {
    const urlQueryParams = getQueryParams();
    const value = urlQueryParams.get(key);

    if (value === null) {
      return defaultValue;
    }
    if (read) {
      return read(value);
    }
    return value as unknown as T;
  }

  /**
   * Given a parameter, it returns the setter for it.
   */
  function getSetQueryParam(key: string): (value: T | SetterInputFunction<T>) => void {
    return (value: T | SetterInputFunction<T>, replace?: boolean): void => {
      const urlQueryParams = getQueryParams();
      const prevValue = getQueryParam(key);
      const newValue = typeof value === "function" ? (value as SetterInputFunction<T>)(prevValue) : value;

      if (newValue !== prevValue) {
        if (newValue !== defaultValue) {
          const cleanedNewValue = write ? write(newValue) : newValue;
          if (cleanedNewValue) urlQueryParams.set(key, cleanedNewValue + "");
          else urlQueryParams.delete(key);
        } else {
          urlQueryParams.delete(key);
        }

        navigate({ search: `?${urlQueryParams.toString()}` }, { replace });
      }
    };
  }

  return [getQueryParam(key), getSetQueryParam(key)];
}
