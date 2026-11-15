import { defineRouteMiddleware } from '@astrojs/starlight/route-data'

// Reference pages after docs.composio.dev: the tags are the sidebar's top level, and an operation
// page gives the "On this page" column to its request and code samples.
export const onRequest = defineRouteMiddleware(({ locals }) => {
  const route = locals.starlightRoute
  if (!route.id.startsWith('reference')) return
  const [api] = route.sidebar
  if (route.sidebar.length === 1 && api?.type === 'group') route.sidebar = api.entries
  if (route.id.startsWith('reference/operations/')) route.toc = undefined
})
