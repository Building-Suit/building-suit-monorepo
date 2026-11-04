import { signOutHqFounder } from '../../utils/hqAccess'

export default defineEventHandler(event => signOutHqFounder(event, useRuntimeConfig(event)))
