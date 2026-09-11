const brut = import.meta.env.VITE_API_URL || 'http://localhost:3000'
export const API_URL = brut.replace(/\/$/, '')