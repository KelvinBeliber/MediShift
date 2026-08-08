import { setupServer } from 'msw/node'

/** Handlers are registered per-test via server.use(...). */
export const server = setupServer()

export const API_URL = 'http://localhost:5000/api/v1'
