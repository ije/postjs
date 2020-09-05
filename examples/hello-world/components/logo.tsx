import React from 'https://postjs.io/x/react/mod.js'

export default function Logo({ height = 24 }: { height?: number }) {
    return (
        <img src="/logo.png" height={height} title="postjs" />
    )
}
