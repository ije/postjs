export default function (req: any, res: any) {
    const time = (new Date).toJSON()
    res.json({ time })
}
