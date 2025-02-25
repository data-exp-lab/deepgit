import { forEach } from "lodash";

/**
 * Takes a URLSearchParams, and returns a valid query URL that handles keys with
 * multiple values with the `"[]"` suffix, when URLSearchParams#toString does
 * not.
 *
 * @example
 * const params = new URLSearchParams();
 * params.append('age', '123');
 * params.append('hobby', 'soccer');
 * params.append('hobby', 'cooking');
 *
 * console.log(params.toString());
 * // "age=123&hobby=soccer&hobby=cooking"
 *
 * console.log(urlSearchParamsToString(params));
 * // "age=123&hobby[]=soccer&hobby[]=cooking"
 */
export function urlSearchParamsToString(params: URLSearchParams): string {
  const pairs = [];
  const searchedKeys = new Set<string>();

  for (const key of params.keys()) {
    if (searchedKeys.has(key)) continue;
    searchedKeys.add(key);

    const values = params.getAll(key);

    if (values.length === 1) {
      pairs.push([key, values[0]].map((s) => encodeURIComponent(s)).join("="));
    } else {
      const fullKey = encodeURIComponent(key) + "[]";
      values.forEach((s) => pairs.push(`${fullKey}=${encodeURIComponent(s)}`));
    }
  }

  return pairs.join("&");
}

/**
 * Takes a record with strings or string arrays as values, and returns a new
 * URLSearchParams instance that has all values for array values.
 *
 * @example
 * const data = { hobby: ['soccer', 'cooking'] };
 * console.log(buildURLSearchParams(data).getAll('hobby'));
 * // ['soccer', 'cooking']
 */
export function buildURLSearchParams(data: Record<string, string | string[]>): URLSearchParams {
  const params = new URLSearchParams();

  forEach(data, (value, key) => {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        params.append(key, v);
      });
    } else {
      params.append(key, value);
    }
  });

  return params;
}

/**
 * Takes a query string and returns a properly parsed record, that handles array
 * values with the `"[]"` prefix.
 *
 * @example
 * const data = queryStringToRecord("age=123&hobby[]=soccer&hobby[]=cooking");
 *
 * console.log(data.age);
 * // "123"
 * console.log(data.hobby);
 * // ["soccer", "cooking"]
 * console.log(data["hobby[]"]);
 * // undefined
 */
export function queryStringToRecord(query: string): Record<string, string | string[]> {
  const params = new URLSearchParams(query);

  const data: Record<string, string | string[]> = {};
  const searchedKeys = new Set<string>();

  for (const key of params.keys()) {
    if (searchedKeys.has(key)) continue;
    searchedKeys.add(key);

    const values = params.getAll(key);

    if (values.length) data[key.replace(/\[]$/, "")] = values.length === 1 ? values[0] : [...values];
  }

  return data;
}
