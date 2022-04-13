import {storeToString, turtleStringToStore} from "./dist/util/Conversion";
import {VersionAwareLDESinLDP} from "./dist/versionawarelil/VersionAwareLDESinLDP";
import {LDPCommunication} from "./dist/ldp/LDPCommunication";
import {LDESinLDP} from "./dist/ldesinldp/LDESinLDP";
import { v4 as uuidv4 } from 'uuid';
uuidv4();

const ldesinldpIdentifier = 'http://localhost:3123/ldesinldp/'; // Base URL of the LDES in LDP
const communication = new LDPCommunication();
const ldesinldp = new LDESinLDP(ldesinldpIdentifier, communication);
export let versionAware = new VersionAwareLDESinLDP(ldesinldp);


export async function init(base: string): Promise<VersionAwareLDESinLDP> {
    const communication = new LDPCommunication();
    const ldesinldp = new LDESinLDP(base, communication);
    const versionAware = new VersionAwareLDESinLDP(ldesinldp);
    const response = await fetch(base, {method: "HEAD"})
    if (response.status !== 200) {
        await versionAware.initialise(base)
    }
    return versionAware
}

export async function put(versionAware: VersionAwareLDESinLDP,identifier: string, body: string): Promise<void> {
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

export async function get(versionAware: VersionAwareLDESinLDP, identifier: string, date?: Date): Promise<string> {
    const store = await versionAware.read(identifier, {derived: true, date, materialized: true})
    return storeToString(store)
}

export async function del(versionAware: VersionAwareLDESinLDP, identifier: string): Promise<void> {
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
    //
    // console.log(await get(locationUrl))
    // console.log(await get(ldesinldpIdentifier))
}

// run()

const express = require('express')
export const app = express()
const port = 3005
const bodyParser = require('body-parser');
app.use(bodyParser.text({type: 'text/turtle'}));

export let base = `http://localhost:${port}/`
export let lilIdentifier = 'http://localhost:3123/newlil/'
app.get('/*', async (req: any, res: any) => {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl
    const resourceIdentifier = fullUrl === base ? lilIdentifier: fullUrl
    console.log(resourceIdentifier)
    let text = ""
    const dateString = req.get('Accept-Datetime') ?? new Date()
    const date = new Date(dateString)
    try {
        text = await get(versionAware ,resourceIdentifier, date)
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
    const resourceIdentifier = req.protocol + '://' + req.get('host') + req.originalUrl
    await put(versionAware, resourceIdentifier, req.body)
    res.send()
})

app.post('/',async (req: any, res: any) => {
    // maybe add slug later
    const resourceIdentifier = req.protocol + '://' + req.get('host') + '/'+uuidv4()
    await put(versionAware, resourceIdentifier, req.body)
    res.send()
})

app.delete('/*',async (req: any, res: any) => {
    const resourceIdentifier = req.protocol + '://' + req.get('host') + req.originalUrl
    try {
        await del(versionAware, resourceIdentifier)
        res.send()
    } catch (e) {
        console.log(e)
        res.sendStatus(404)
    }

})
//
// app.listen(port, async () => {
//     console.log(`Example app url: http://localhost:${3005}/`)
//     versionAware = await init('http://localhost:3123/newlil/')
// })
