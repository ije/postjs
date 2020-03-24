import React from 'react'

const About = ({ name }: { name: string }) => (
    <h2>About {name}</h2>
)

About.getStaticProps = async ctx => {
    const res = await fetch('https://api.github.com/repos/postui/postjs')
    const json = await res.json()
    return json
}

export default About
