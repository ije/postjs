import React from 'react'

export function useServerTime() {
    const [now, setNow] = React.useState('')

    React.useEffect(() => {
        fetch('/api/time').then(resp => resp.json()).then(data => setNow(data.time))
    }, [])

    return now
}
