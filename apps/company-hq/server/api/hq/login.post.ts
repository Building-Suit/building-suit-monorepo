import { signInHqFounder } from '../../utils/hqAccess'

export default defineEventHandler(event => signInHqFounder(event, useRuntimeConfig(event)))
