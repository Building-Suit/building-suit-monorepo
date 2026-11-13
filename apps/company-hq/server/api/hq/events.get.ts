import { streamHqEvents } from '../../utils/hqEvents.ts'

export default defineEventHandler(event => streamHqEvents(event, useRuntimeConfig(event)))
