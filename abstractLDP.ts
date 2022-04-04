import {storeToString, turtleStringToStore} from "./src/util/Conversion";

const {LDPCommunication, LDESinLDP, VersionAwareLDESinLDP} = require('./src/Index')

const ldesinldpIdentifier = 'http://localhost:3123/ldesinldp/'; // Base URL of the LDES in LDP
const communication = new LDPCommunication();
const ldesinldp = new LDESinLDP(ldesinldpIdentifier, communication);
const versionAware = new VersionAwareLDESinLDP(ldesinldp);

export async function put(identifier: string, body: string): Promise<void> {
    const versionID = `https://example.org/${new Date().getTime()}/`
    const store = await turtleStringToStore(body, versionID)
    try {
        await versionAware.update(identifier, store, versionID)
        return
    } catch (e) {
        console.log('resource does not exist yet, try creating now')
    }
    try {
        await versionAware.create(identifier, store, versionID)
    } catch (e) {
        console.log('Resource could not be created due to errors', e)
    }
}

export async function get(identifier: string, date?: Date): Promise<string> {
    const store = await versionAware.read(identifier, {derived: true, date})
    return storeToString(store)
}

export async function del(identifier: string): Promise<void> {
    await versionAware.delete(identifier)
}

async function run() {
    const locationTurtleText = `
<> <https://schema.org/latitude> "51.0470216".
<> <https://schema.org/longitude> "3.7263303". 
<> <http://purl.org/dc/terms/date> "${new Date().getTime()}".
    `

    const locationTitleTurtleText = locationTurtleText + `
    <> <http://purl.org/dc/terms/title> "Wout his location.".
    `
    const locationUrl = 'http://example.org/location'


    // await put(locationUrl, locationTurtleText)
    // await put(locationUrl, locationTitleTurtleText)
    // await del(locationUrl)

    console.log(await get(locationUrl))
    console.log(await get(ldesinldpIdentifier))
}

// run()

const express = require('express')
const app = express()
const port = 3005
const bodyParser = require('body-parser');
app.use(bodyParser.text({type: 'text/turtle'}));

const base = 'http://localhost:3123/ldesinldp'
app.get('/*', async (req: any, res: any) => {
    let text = ""
    const dateString = req.get('Accept-Datetime') ?? new Date()
    const date = new Date(dateString)
    try {
        text = await get(base + req.originalUrl,date)
        res.setHeader('content-type', 'text/turtle')
    } catch (e) {
        console.log(e)
    }
    res.send(text)
})

app.put('/', async (req: any, res: any) => {
    res.send('not allowed')
})

app.put('/*', async (req: any, res: any) => {
    await put(base + req.originalUrl, req.body)
    res.send()
})

// todo post and delete

app.listen(port, () => {
    // todo initialise?
    console.log(`Example app listening on port ${port}`)
})
