import { defineRouteMiddleware } from '@astrojs/starlight/route-data'

// The reference's tags are the sidebar's top level, without the one "API" group around them.
export const onRequest = defineRouteMiddleware(({ locals }) => {
  const route = locals.starlightRoute
  if (!route.id.startsWith('reference')) return
  const [api] = route.sidebar
  if (route.sidebar.length === 1 && api?.type === 'group') route.sidebar = api.entries
})
