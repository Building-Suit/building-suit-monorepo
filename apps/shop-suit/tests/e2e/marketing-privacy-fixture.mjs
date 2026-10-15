// Synthetic public catalogue only. Never forwards to a hosted backend.
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
export const catalog = [{ id: 'synthetic-plan', name: 'Solo', slug: 'solo', catalog_terms_id: 'synthetic-terms', plan_variant: 'solo_1', variant_name: 'One member', price_amount: 399, currency: 'EGP', billing_interval: 'monthly', trial_days: 7, features: {}, resource_limits: { active_locations: 1, active_members: 1, active_products: 100, active_services: 100, active_customers: 100, active_suppliers: 100 }, is_purchasable: true, is_coming_soon: false }]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' })
    res.end(JSON.stringify(req.url?.includes('shop_public_plan_catalog') ? catalog : []))
  }).listen(46423, '127.0.0.1')
}
