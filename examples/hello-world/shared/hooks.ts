import { useState } from 'https://postjs.io/x/react/mod.js'

export function useCount(initial: number) {
    const [count, setCount] = useState(initial)

    return {
        count,
        increase: () => setCount(n => n + 1),
        decrease: () => setCount(n => n - 1)
    }
}
