import React, { useState } from 'react'

export function useServerTime() {
    const [now, setNow] = React.useState('')

    React.useEffect(() => {
        fetch('/api/time').then(resp => resp.json()).then(data => setNow(data.time))
    }, [])

    return now
}

export function useCount(initialCount: number) {
    const [count, setCount] = useState(initialCount)

    return {
        count,
        increase: () => setCount(n => n + 1),
        decrease: () => setCount(n => n - 1)
    }
}
