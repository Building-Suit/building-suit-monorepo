import { setResponseHeaders } from 'h3'
export default defineEventHandler(event => {
  setResponseHeaders(event, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' })
})
