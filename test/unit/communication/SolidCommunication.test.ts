import {Communication} from "../../../src/ldp/Communication";
import {SolidCommunication} from "../../../src/solid/SolidCommunication";
import {getSession} from "../../../src/util/Login";
import {authBaseUrl} from "../../util/solidHelper";
import {LDPCommunication} from "../../../dist/ldp/LDPCommunication";

describe('An SolidCommunication', () => {
    // MAKE SURE A SOLIDSERVER WITH AUTH IS RUNNING ON PORT 3002
    let communication: Communication
    let unauthCommunication: Communication
    const TEXT_PLAIN = 'text/plain'
    const TEXT_TURTLE = 'text/turtle'
    const TEXT_HTML = 'text/html';
    const TEXT_N3 = 'text/n3'
    const plainTextHeader = new Headers({'Content-type': TEXT_PLAIN})
    const htmlTextHeader = new Headers({'Accept': TEXT_HTML})
    const n3TextHeader = new Headers({'content-type': TEXT_N3})


    beforeAll(async () => {
        const session = await getSession()
        // create acl file for solid authenticated
        const response = await session.fetch(authBaseUrl +'.acl',{
            method: 'PUT',
            headers: {'content-type': TEXT_TURTLE},
            body: `@prefix acl: <http://www.w3.org/ns/auth/acl#>.

<#authorization>
    a               acl:Authorization;
    acl:agent  <${session.info.webId}>;
    acl:mode        acl:Read, acl:Write, acl:Append, acl:Control;
    acl:accessTo    <./>;
    acl:default     <./>.
`
        })
        unauthCommunication = new LDPCommunication();

        communication = new SolidCommunication(session);
    });


    describe('performing HTTP GET requests', () => {
        it('returns a text/turtle body with the default headers.', async () => {
            const response = await communication.get(authBaseUrl)
            expect(response.status).toBe(200)
            expect(response.headers.get('Content-type')).toBe(TEXT_TURTLE)
        });

        it('returns a text/html body with a accept:text/html header.', async () => {
            const response = await communication.get(authBaseUrl, htmlTextHeader)
            expect(response.status).toBe(200)
            expect(response.headers.get('Content-type')).toBe(TEXT_HTML)
        })

        it('errors when not having correct permissions.', async () => {
            const response = await unauthCommunication.get(authBaseUrl)
            expect(response.status).toBe(401)
        })
    });

    describe('performing HTTP HEAD requests', () => {
        it('returns the expected headers.', async () => {
            const response = await communication.head(authBaseUrl)
            expect(response.status).toBe(200)
            expect(response.headers.get('Content-type')).toBe(TEXT_TURTLE)
            expect(await response.text()).toBe("")
        });

        it('errors when not having correct permissions.', async () => {
            const response = await unauthCommunication.head(authBaseUrl)
            expect(response.status).toBe(401)
        })
    });

    describe('performing HTTP POST requests', () => {
        it('is successful with an empty body.', async () => {
            const response = await communication.post(authBaseUrl)
            expect(response.status).toBe(201)
            const location = response.headers.get('location')
            expect(location).toContain(authBaseUrl)

            const getResponse = await communication.get(location!)
            expect(await getResponse.text()).toBe("")
            expect(getResponse.headers.get('Content-type')).toBe(TEXT_TURTLE)
        });

        it('is successful with a turtle body.', async () => {
            const turtleText = "<a> <b> <c>."
            const response = await communication.post(authBaseUrl, turtleText)
            expect(response.status).toBe(201)

            const location = response.headers.get('location')
            expect(location).toContain(authBaseUrl)
            const getResponse = await communication.get(location!)
            expect(await getResponse.text()).toBe(turtleText)
            expect(getResponse.headers.get('Content-type')).toBe(TEXT_TURTLE)
        });

        it('is successful with a plain text body (and corresponding header).', async () => {
            const text = "Hello world!"
            const response = await communication.post(authBaseUrl, text, plainTextHeader)
            expect(response.status).toBe(201)

            const location = response.headers.get('location')
            expect(location).toContain(authBaseUrl)
            const getResponse = await communication.get(location!, plainTextHeader)
            expect(await getResponse.text()).toBe(text)
            expect(getResponse.headers.get('Content-type')).toBe(TEXT_PLAIN)

        });

        it('errors when not having correct permissions.', async () => {
            const response = await unauthCommunication.post(authBaseUrl)
            expect(response.status).toBe(401)
        })
    });

    describe('performing HTTP PUT requests', () => {
        const resourceLocation = authBaseUrl + 'test_put'

        afterEach(async () => {
            await communication.delete(resourceLocation)
        })

        it('is successful with an empty body.', async () => {
            const response = await communication.put(resourceLocation)
            expect(response.status).toBe(201)

            const getResponse = await communication.get(resourceLocation)
            expect(await getResponse.text()).toBe("")
            expect(getResponse.headers.get('Content-type')).toBe(TEXT_TURTLE)
        });

        it('is successful with a turtle body.', async () => {
            const turtleText = "<a> <b> <c>."
            const response = await communication.put(resourceLocation, turtleText)
            expect(response.status).toBe(201)

            const getResponse = await communication.get(resourceLocation)
            expect(await getResponse.text()).toBe(turtleText)
            expect(getResponse.headers.get('Content-type')).toBe(TEXT_TURTLE)
        });

        it('is successful with a plain text body (and corresponding header).', async () => {
            const text = "Hello world!"
            const response = await communication.put(resourceLocation, text, plainTextHeader)
            expect(response.status).toBe(201)

            const getResponse = await communication.get(resourceLocation, plainTextHeader)
            expect(await getResponse.text()).toBe(text)
            expect(getResponse.headers.get('Content-type')).toBe(TEXT_PLAIN)
        });

        it('errors when not having correct permissions.', async () => {
            const response = await unauthCommunication.put(resourceLocation)
            expect(response.status).toBe(401)
        })
    });

    describe('performing HTTP PATCH requests', () => {
        const resourceLocation = authBaseUrl + 'test_patch'

        afterEach(async () => {
            await communication.delete(resourceLocation)
        })

        it('is successful with an empty body.', async () => {
            const response = await communication.patch(resourceLocation)
            expect(response.status).toBe(201)

            const getResponse = await communication.get(resourceLocation)
            expect(await getResponse.text()).toBe("")
            expect(getResponse.headers.get('Content-type')).toBe(TEXT_TURTLE)
        });

        it('is successful with a sparql insert body.', async () => {
            const turtleText = `<${authBaseUrl}a> <${authBaseUrl}b> <${authBaseUrl}c>.`
            const sparqlInsert = `INSERT DATA {${turtleText}}`
            const response = await communication.patch(resourceLocation, sparqlInsert)
            expect(response.status).toBe(201)

            const getResponse = await communication.get(resourceLocation)
            expect(await getResponse.text()).toContain(turtleText)
            expect(getResponse.headers.get('Content-type')).toBe(TEXT_TURTLE)
        });

        it('is successful with a n3 patch body (and corresponding header).', async () => {
            const turtleText = `<${authBaseUrl}a> <${authBaseUrl}b> <${authBaseUrl}c>.`
            const n3PatchBody = `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> a solid:InsertDeletePatch; solid:inserts {${turtleText}} .`
            const response = await communication.patch(resourceLocation, n3PatchBody, n3TextHeader)
            expect(response.status).toBe(201)

            const getResponse = await communication.get(resourceLocation)
            expect(await getResponse.text()).toContain(turtleText)
            expect(getResponse.headers.get('Content-type')).toBe(TEXT_TURTLE)
        })

        it('errors when not having correct permissions.', async () => {
            const response = await unauthCommunication.patch(resourceLocation)
            // expect(response.status).toBe(401) Note: bug in CSS -> so gives wrong response
        })
    })

    describe('performing HTTP DELETE requests', () => {
        it('is successful.', async () => {
            const toDelete = authBaseUrl + 'delete_this'
            await communication.put(toDelete)

            const response = await communication.delete(toDelete)
            expect(response.status).toBe(205)
        });

        it('errors when not having correct permissions.', async () => {
            const toDelete = authBaseUrl + 'to_delete'
            await communication.put(toDelete)

            const response = await unauthCommunication.delete(toDelete)
            expect(response.status).toBe(401)

            await communication.delete(toDelete)
        })
    });
})
