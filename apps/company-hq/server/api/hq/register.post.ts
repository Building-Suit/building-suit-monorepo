import { registerHqFounder } from '../../utils/hqAccess'

export default defineEventHandler(event => registerHqFounder(event, useRuntimeConfig(event)))
