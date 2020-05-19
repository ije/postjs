import React from 'https://cdn.pika.dev/react'
import { Link } from 'https://postjs.io/mod.ts'
import Logo from '../components/logo.tsx'
import { useServerTime } from '../shared/hooks.ts'

export async function getStaticProps() {
    return { name: 'postjs' }
}

export default function Home({ name }: { name: string }) {
    const time = useServerTime()

    return (
        <div style={{ margin: 60 }}>
            <p><Logo /></p>
            <p>Welcome to use <strong>{name}</strong>! &nbsp; <Link to="/about">&rarr;&nbsp; About</Link></p>
            <p>
                {!time && (
                    <small>loading...</small>
                )}
                {time && (
                    <small>Server Time: {time}</small>
                )}
            </p>
        </div>
    )
}
