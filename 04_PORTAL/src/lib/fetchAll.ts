// PostgREST はデフォルトで1クエリあたり最大1000行しか返さない。
// ktm_match_participants 等、行数が1000を超えうるテーブルを条件なしで
// 全件取得する箇所は、無言で末尾が切り捨てられるのを防ぐため必ずこのヘルパーを使うこと。
const PAGE_SIZE = 1000;

export async function fetchAllRows<T = any>(
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<{ data: T[] | null; error: any }> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryFactory(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { data: rows, error: null };
}
