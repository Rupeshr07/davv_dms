import axios from 'axios'
import { env } from '../config/env.js'
import { ApiError } from '../lib/errors.js'
import type { RegistrationStatusResponse } from '../../shared/types.js'

const extractRemoteErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const responseMessage =
      typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : error.message
    return responseMessage
  }

  return 'Unable to verify application registration.'
}

export const verifyRegistration = async (): Promise<RegistrationStatusResponse> => {
  if (env.nextinMode === 'mock') {
    return {
      success: true,
      message: 'Application registration verified.',
      mode: 'mock',
    }
  }

  if (!env.nextinRegistrationUrl) {
    throw new ApiError(500, 'NEXTIN registration API URL is not configured.')
  }

  try {
    const response = await axios.get(env.nextinRegistrationUrl, {
      headers: env.nextinRegistrationApiKey
        ? {
            'x-api-key': env.nextinRegistrationApiKey,
          }
        : undefined,
      timeout: 10000,
    })

    return {
      success: true,
      message:
        typeof response.data?.message === 'string'
          ? response.data.message
          : 'Application registration verified.',
      mode: 'remote',
    }
  } catch (error) {
    throw new ApiError(400, extractRemoteErrorMessage(error))
  }
}
