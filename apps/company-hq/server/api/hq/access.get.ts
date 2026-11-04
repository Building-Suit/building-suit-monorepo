import { readHqAccess } from '../../utils/hqAccess'

export default defineEventHandler(event => readHqAccess(event, useRuntimeConfig(event)))
