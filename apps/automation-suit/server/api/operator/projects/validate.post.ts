import { projectSchema } from '../../../utils/operatorValidation'

export default defineEventHandler(async (event) => {
  const result = projectSchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid project configuration', data: result.error.flatten() })
  return { valid: true, project: result.data }
})
