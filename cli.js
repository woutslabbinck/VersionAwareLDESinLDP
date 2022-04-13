#!/usr/bin/env node

const yargs = require('yargs')
const { uuid } = require('uuidv4');
let {init, put, get, del} = require("./abstractLDP");
const express = require('express')
const app = express()
const bodyParser = require('body-parser');
app.use(bodyParser.text({type: 'text/turtle'}));

// TODO: add derived and materialized configurable
let lilIdentifier
let versionAware
let base
let derived
let materialized

app.get('/*', async (req, res) => {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl
    const resourceIdentifier = fullUrl === base ? lilIdentifier: fullUrl
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

app.put('/', async (req, res) => {
    res.send('not allowed')
})

app.put('/*', async (req, res) => {
    const resourceIdentifier = req.protocol + '://' + req.get('host') + req.originalUrl
    await put(versionAware, resourceIdentifier, req.body)
    res.send()
})

app.post('/',async (req, res) => {
    // maybe add slug later
    const resourceIdentifier = req.protocol + '://' + req.get('host') + '/'+uuidv4()
    await put(versionAware, resourceIdentifier, req.body)
    res.send()
})

app.delete('/*',async (req, res) => {
    const resourceIdentifier = req.protocol + '://' + req.get('host') + req.originalUrl
    try {
        await del(versionAware, resourceIdentifier)
        res.send()
    } catch (e) {
        console.log(e)
        res.sendStatus(404)
    }
})

async function run() {
    yargs.scriptName('LDP over Version Aware LDES in LDP')
        .usage('node .abstractLDP.js [args]')
        .options(
            {
                ldesinldp: {type: 'string', alias: 'l', default: 'http://localhost:3000/ldesinldp/', requiresArg: true},
                port: {type: 'string', alias: 'p', default: '3005', requiresArg: true},
                derived: {type: 'boolean', alias: 'd', default: true, requiresArg: true},
                materialized: {type: 'boolean', alias: 'm', default: true, requiresArg: true},
            }
        )
        .help()
    const params = await yargs.parse()
    base = `http://localhost:${params.port}/`
    lilIdentifier = params.ldesinldp
    app.listen(params.port, async () => {
        console.log(`LDP located at: ${base}`)
        console.log(`LDES in LDP located at: ${lilIdentifier}`)
        versionAware = await init(params.ldesinldp)
    })
}

run()
