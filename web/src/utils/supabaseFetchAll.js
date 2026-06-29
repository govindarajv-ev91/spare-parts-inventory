const PAGE_SIZE = 1000

/**
 * Fetch all rows from Supabase (bypasses default 1000 row limit).
 */
export async function fetchAllRows(supabase, table, select, orderBy, ascending = true, onProgress) {
  const all = []
  let from = 0

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1)
    if (orderBy) {
      query = query.order(orderBy, { ascending })
    }

    const { data, error } = await query
    if (error) throw error

    const batch = data || []
    all.push(...batch)
    if (onProgress) onProgress(all.length)

    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

export async function fetchCount(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}
