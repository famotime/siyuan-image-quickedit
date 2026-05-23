import { requestApi } from '@/services/kernel.ts';

interface DocBlockRow {
  id: string;
  markdown: string;
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

export async function getDocBlockMarkdowns(docId: string): Promise<DocBlockRow[]> {
  const normalizedDocId = docId.trim();
  if (!normalizedDocId) {
    return [];
  }

  const stmt = `select id, markdown from blocks where root_id = '${escapeSqlLiteral(normalizedDocId)}' and type != 'd' order by sort asc`;
  console.log(`[image-quickedit] getDocBlockMarkdowns: executing SQL for docId=${normalizedDocId}`);
  const rows = await requestApi<DocBlockRow[]>('/api/query/sql', { stmt });
  console.log(`[image-quickedit] getDocBlockMarkdowns: returned ${rows.length} rows`);
  return rows;
}
