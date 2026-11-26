import { createContext, useContext } from 'react'

export const BoardContext = createContext(null)
export const useBoard = () => useContext(BoardContext)
