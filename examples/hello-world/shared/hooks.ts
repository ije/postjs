import React, { useState } from 'react'

export function useServerTime() {
    const [time, setTime] = React.useState('')

    React.useEffect(() => {
        fetch('/api/time').then(resp => resp.json()).then(data => setTime(data.time))
    }, [])

    return time.replace(/[a-z]/gi, ' ')
}

export function useCount(initial: number) {
    const [count, setCount] = useState(initial)

    return {
        count,
        increase: () => setCount(n => n + 1),
        decrease: () => setCount(n => n - 1)
    }
}
