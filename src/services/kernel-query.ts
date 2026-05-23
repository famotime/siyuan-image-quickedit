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

  return requestApi<DocBlockRow[]>('/api/query/sql', {
    stmt: `select id, markdown from blocks where root_id = '${escapeSqlLiteral(normalizedDocId)}' and type != 'd' order by sort asc`,
  });
}
