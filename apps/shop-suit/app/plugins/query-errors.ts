import { ShopQueryError, queryErrorPayload, reviveQueryError } from '~/utils/shopQueryError'
export default definePayloadPlugin(() => {
  definePayloadReducer('ShopQueryError', value => value instanceof ShopQueryError && queryErrorPayload(value))
  definePayloadReviver('ShopQueryError', reviveQueryError)
})
