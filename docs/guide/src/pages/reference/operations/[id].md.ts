import type { APIRoute, GetStaticPaths } from 'astro'
import schema from '../../../../openapi.json'

type Node = unknown
type Operation = { operationId: string; summary: string; tags: string[]; [key: string]: Node }

// Each API operation as Markdown at /reference/operations/<id>.md, with its schemas inlined, for "Copy page".
const inline = (node: Node, seen: string[] = []): Node => {
  if (Array.isArray(node)) return node.map((item) => inline(item, seen))
  if (!node || typeof node !== 'object') return node
  const ref = (node as { $ref?: string }).$ref
  if (ref) {
    const name = ref.split('/').pop()!
    if (seen.includes(name)) return { $ref: name }
    return inline((schema.components.schemas as Record<string, Node>)[name], [...seen, name])
  }
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, inline(value, seen)]))
}

export const getStaticPaths: GetStaticPaths = () =>
  Object.entries(schema.paths).flatMap(([path, item]) =>
    Object.entries(item as Record<string, Operation>).map(([method, operation]) => ({
      params: { id: operation.operationId },
      props: { path, method, operation },
    })),
  )

export const GET: APIRoute<{ path: string; method: string; operation: Operation }> = ({ props }) => {
  const { path, method, operation } = props
  const { operationId, summary, tags, ...rest } = operation
  const text = [
    `# ${summary}`,
    `\`${method.toUpperCase()} ${path}\` · ${tags.join(', ')} · server ${schema.servers[0].url}`,
    'The operation from the OpenAPI schema, with its schemas inlined:',
    '```json\n' + JSON.stringify(inline(rest), null, 2) + '\n```',
  ].join('\n\n')
  return new Response(`${text}\n`, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
}
