import React, { useEffect } from 'react'

export default function HomePage() {
    useEffect(() => {
        document.title = 'Home'
    }, [])

    return (
        <div>
            <h1>Welcome to use postUI!</h1>
        </div>
    )
}
