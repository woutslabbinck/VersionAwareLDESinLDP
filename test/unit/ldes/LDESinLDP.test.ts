import { LDESinLDP } from "../../../src/ldes/LDESinLDP";
import { DCT, LDP } from "../../../src/util/Vocabularies";
import { DataFactory, Store } from "n3";
import { Communication } from "../../../src/ldp/Communication";
import { extractLdesMetadata } from "../../../src/util/LdesUtil";
import { memberStreamtoStore, storeToString, } from "../../../src/util/Conversion";
import { LDESConfig } from "../../../src/ldes/LDESConfig";
import { getRelationIdentifier } from "../../../src/ldes/Util";
import { addSimpleMember } from "../../util/LdesTestUtility";
import { MetadataInitializer } from "../../../src/metadata/MetadataInitializer";
import { Status } from "../../../src/ldes/Status";
import { ILDESinLDPMetadata } from "../../../src/metadata/LDESinLDPMetadata";
import { Member } from "@treecg/types";
import { extractDateFromMember } from "../../../src/util/MemberUtil";
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;
import { GreaterThanOrEqualToRelation } from "../../../src/metadata/util/Components";
import { MetadataParser } from "../../../src/metadata/MetadataParser";

describe('An LDESinLDP', () => {
    const resourceStore = new Store()
    const date = new Date()

    let mockCommunication: jest.Mocked<Communication>
    let ldesinldp: LDESinLDP
    const lilBase = 'http://example.org/ldesinldp/'
    const inboxContainerURL = 'http://example.org/ldesinldp/timestamppath/'
    const createdURL = 'http://example.org/ldesinldp/timestamp/created'
    let lilMetadata: ILDESinLDPMetadata

    let readMetadataResponse: Response
    let textTurtleHeader: Headers

    let config: LDESConfig
    const lilString = `
<http://example.org/ldesinldp/> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .
<http://example.org/ldesinldp/> <https://w3id.org/tree#relation> _:genid1 .
<http://example.org/ldesinldp/> <http://www.w3.org/ns/ldp#inbox> <http://example.org/ldesinldp/timestamppath/> .
_:genid1 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:genid1 <https://w3id.org/tree#node> <http://example.org/ldesinldp/timestamppath/> .
_:genid1 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:genid1 <https://w3id.org/tree#value> "2022-03-28T14:53:28.841Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
<http://example.org/ldesinldp/#EventStream> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#EventStream> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/ldes#versionOfPath> <http://purl.org/dc/terms/isVersionOf> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/ldes#timestampPath> <http://purl.org/dc/terms/created> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/tree#view> <http://example.org/ldesinldp/> .
`
    beforeAll(() => {
        config = {
            LDESinLDPIdentifier: lilBase,
            treePath: DCT.created,
            versionOfPath: DCT.isVersionOf
        }
    });

    function turtleStringResponse(text?: string): Response {
        text = text ?? ""
        textTurtleHeader = new Headers(new Headers({ 'content-type': 'text/turtle' }))
        return new Response(text, { status: 200, headers: textTurtleHeader })
    }

    function turtleStringResponseFromMetadata(metadata: ILDESinLDPMetadata): Response {
        return turtleStringResponse(storeToString(metadata.getStore()))
    }

    beforeEach(() => {
        mockCommunication = {
            delete: jest.fn(),
            head: jest.fn(),
            get: jest.fn(),
            patch: jest.fn(),
            post: jest.fn(),
            put: jest.fn()
        }

        // communication.head mock: always give proper location for current writable location
        const inboxHeader = new Headers({ 'Link': `<${inboxContainerURL}>; rel="http://www.w3.org/ns/ldp#inbox"` })
        const headResponse = new Response(null, { status: 200, headers: inboxHeader })
        mockCommunication.head.mockResolvedValue(headResponse)

        textTurtleHeader = new Headers(new Headers({ 'content-type': 'text/turtle' }))
        readMetadataResponse = new Response(lilString, { status: 200, headers: textTurtleHeader })
        ldesinldp = new LDESinLDP(lilBase, mockCommunication)

        lilMetadata = MetadataInitializer.generateLDESinLDPMetadata(lilBase, { lilConfig: config, date })
    });

    it('returns the LDESinLDPIdentifier when calling its get function.', () => {
        expect(ldesinldp.LDESinLDPIdentifier).toBe(lilBase)
    });

    it('returns the event stream identifier when calling its get function.', () => {
        // which default is `lilBase + #EventStream`
        expect(ldesinldp.eventStreamIdentifier).toBe(lilBase + "#EventStream")
    });

    describe('when checking the states of an LDES in LDP', () => {
        let status: Status

        function createWacResponse(args?: { status: number, permissions: string[] }): Response {
            args = args ?? { status: 200, permissions: ['read'] }
            const permissions = args.permissions.join(' ')
            const wacHeader = new Headers({ 'WAC-Allow': `user="${permissions}", public="read"` })
            return new Response(null, { status: args.status, headers: wacHeader })
        }

        beforeEach(() => {
            // communication.head mock: always give proper location for current writable location
            const headResponse = createWacResponse()
            mockCommunication.head.mockResolvedValue(headResponse)
            mockCommunication.get.mockResolvedValue(turtleStringResponseFromMetadata(lilMetadata))
            status = {
                empty: false, found: false, full: false, valid: false, writable: false
            }
        });

        it('returns all false when connection cannot be established.', async () => {
            mockCommunication.head.mockRejectedValue(Error)
            expect(await ldesinldp.status()).toEqual(status)
            expect(mockCommunication.head).toBeCalledTimes(1)
        });

        it('returns all false when status code is not 200.', async () => {
            mockCommunication.head.mockResolvedValue(createWacResponse({ status: 401, permissions: [] }))
            expect(await ldesinldp.status()).toEqual(status)
            expect(mockCommunication.head).toBeCalledTimes(1)
            expect(mockCommunication.get).toBeCalledTimes(0)
        });

        it('returns found, but not valid if metadata cannot be parsed.', async () => {
            status.found = true
            mockCommunication.get.mockResolvedValue(turtleStringResponse())
            expect(await ldesinldp.status()).toEqual(status)
            expect(mockCommunication.head).toBeCalledTimes(1)
            expect(mockCommunication.get).toBeCalledTimes(1)

        });

        it('returns found, valid and empty when metadata can be parsed correctly (and it has no members).', async () => {
            status.found = true
            status.valid = true
            status.empty = true
            mockCommunication.get.mockResolvedValueOnce(turtleStringResponseFromMetadata(lilMetadata))
            mockCommunication.get.mockResolvedValueOnce(turtleStringResponse())
            expect(await ldesinldp.status()).toEqual(status)
            expect(mockCommunication.head).toBeCalledTimes(1)
            expect(mockCommunication.get).toBeCalledTimes(2)
            expect(mockCommunication.get).toBeCalledWith(lilMetadata.view.relations[0].node)
        });

        it('returns found, valid and not empty when there are members.', async () => {
            status.found = true
            status.valid = true
            let nodeUrl = lilMetadata.view.relations[0].node
            mockCommunication.get.mockResolvedValueOnce(turtleStringResponseFromMetadata(lilMetadata))
            mockCommunication.get.mockResolvedValueOnce(turtleStringResponse(
                `<${nodeUrl}> <${LDP.contains}> <${nodeUrl}resource1>.`
            ))
            expect(await ldesinldp.status()).toEqual(status)
            expect(mockCommunication.head).toBeCalledTimes(1)
            expect(mockCommunication.get).toBeCalledTimes(2)
            expect(mockCommunication.get).toBeCalledWith(lilMetadata.view.relations[0].node)
        });

        it('returns found, valid and not empty when there are multiple relations.', async () => {
            status.found = true
            status.valid = true
            lilMetadata.view.relations.push(MetadataInitializer.createRelation(lilBase + "lol"))
            mockCommunication.get.mockResolvedValueOnce(turtleStringResponseFromMetadata(lilMetadata))

            expect(await ldesinldp.status()).toEqual(status)
            expect(mockCommunication.head).toBeCalledTimes(1)
            expect(mockCommunication.get).toBeCalledTimes(1)
        });

        it('returns found, valid and writable when there are write permissions to the root.', async () => {
            status.found = true
            status.valid = true
            status.writable = true
            status.empty = true // only 1 relation with no members
            mockCommunication.get.mockResolvedValueOnce(turtleStringResponseFromMetadata(lilMetadata))
            mockCommunication.head.mockResolvedValue(createWacResponse({ status: 200, permissions: ['read', 'write'] }))

            expect(await ldesinldp.status()).toEqual(status)
            expect(mockCommunication.head).toBeCalledTimes(1)
            expect(mockCommunication.get).toBeCalledTimes(2)
        });
    });

    describe('when instantiating an LDES in LDP', () => {
        it('succeeds when a correct base LDESinLDPIdentifier is given.', () => {
            expect(new LDESinLDP('http://example.org/ldesinldp/', mockCommunication)).toBeDefined()
        });

        it('succeeds when a correct eventStream Identifier is given.', () => {
            let eventStreamIdentifier = "http://example.org/#test"
            expect(new LDESinLDP('http://example.org/ldesinldp/', mockCommunication, { eventStreamIdentifier })).toBeDefined()
        });

        it('throws an error when the LDESinLDPIdentifier is not a container Identifier according to slash semantics.', () => {
            // Does LDP require the slash semantics? Or is this Solid only?
            expect(() => new LDESinLDP('http://example.org/ldesinldp', mockCommunication)).toThrow(Error)
        });

    });

    describe('when initialising an LDES in LDP', () => {
        let store: Store
        let relationIdentifier: string

        beforeEach(() => {
            store = MetadataInitializer.generateLDESinLDPMetadata(lilBase, {
                lilConfig: config,
                date: date
            }).getStore()
            relationIdentifier = getRelationIdentifier(lilBase, date)
            store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDP.inbox), namedNode(relationIdentifier))
        });

        it('succeeds when it was not initialised yet.', async () => {
            mockCommunication.put.mockResolvedValue(new Response(null, { status: 201 }))
            mockCommunication.patch.mockResolvedValue(new Response(null, { status: 205 }))
            mockCommunication.head.mockResolvedValueOnce(new Response(null, { status: 500 }))

            const patchQuery = `INSERT DATA {${storeToString(store)}};`
            const lilConfig = { ...config, date }
            await ldesinldp.initialise(lilConfig)
            expect(mockCommunication.patch).toBeCalledWith(lilBase + '.meta', patchQuery)
            expect(mockCommunication.patch).toBeCalledTimes(1)
            expect(mockCommunication.put).toBeCalledTimes(2)
            expect(mockCommunication.put).toHaveBeenNthCalledWith(1, lilBase)
            expect(mockCommunication.put).toHaveBeenNthCalledWith(2, relationIdentifier)
        })

        it('persists the maximum page size.', async () => {
            mockCommunication.put.mockResolvedValue(new Response(null, { status: 201 }))
            mockCommunication.patch.mockResolvedValue(new Response(null, { status: 205 }))
            mockCommunication.head.mockResolvedValueOnce(new Response(null, { status: 500 }))

            const pageSize = 10
            const lilConfig = { ...config, date, pageSize }

            store = MetadataInitializer.generateLDESinLDPMetadata(lilBase, {
                lilConfig: lilConfig,
                date: date
            }).getStore()
            const patchQuery = `INSERT DATA {${storeToString(store)}};`

            await ldesinldp.initialise(lilConfig)
            expect(mockCommunication.patch).toBeCalledWith(lilBase + '.meta', patchQuery)
        })

        it('succeeds when it was already initialised.', async () => {
            mockCommunication.head.mockResolvedValueOnce(new Response(null, { status: 200 }))

            await ldesinldp.initialise(config)
            expect(mockCommunication.head).toBeCalledWith(lilBase)
            expect(mockCommunication.head).toBeCalledTimes(1)

        });
    });

    describe('when appending a resource to an LDES in LDP', () => {
        // store for metadata
        let store: Store
        const pageSize = 1
        let postResponse: Response

        beforeEach(() => {
            // mock for updateMetadata
            mockCommunication.get.mockResolvedValue(readMetadataResponse)

            // metadata with pageSize store
            config.pageSize = pageSize
            store = MetadataInitializer.generateLDESinLDPMetadata(lilBase, { lilConfig: config, date }).getStore()

            const locationHeader = new Headers({ 'Location': createdURL })
            postResponse = new Response(null, { status: 201, headers: locationHeader })

        });

        it('returns the URL of the created resource when succeeded.', async () => {
            mockCommunication.post.mockResolvedValueOnce(postResponse)
            await expect(ldesinldp.append(resourceStore)).resolves.toBe(createdURL)
            expect(mockCommunication.post).toBeCalledWith(inboxContainerURL, storeToString(resourceStore))
            expect(mockCommunication.post).toBeCalledTimes(1)
            expect(mockCommunication.get).toBeCalledTimes(1)

        });

        it('throws error when posting the resource failed.', async () => {
            postResponse = new Response(null, { status: 500 })
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(ldesinldp.append(resourceStore)).rejects.toThrow(Error)
            expect(mockCommunication.post).toBeCalledTimes(1)

        });

        it('throws error when no location is returned.', async () => {
            postResponse = new Response(null, { status: 201 })
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(ldesinldp.append(resourceStore)).rejects.toThrow(Error)
            expect(mockCommunication.post).toBeCalledTimes(1)
        });

        it('creates a new fragment when the # of members in the current fragment >= pageSize.', async () => {
            const metadataResponse = new Response(storeToString(store), { status: 200, headers: textTurtleHeader })
            mockCommunication.get.mockResolvedValueOnce(metadataResponse)

            const fragmentStore = new Store()
            fragmentStore.addQuad(namedNode(getRelationIdentifier(lilBase, date)), namedNode(LDP.contains), namedNode('childURL'))
            const fragmentResponse = new Response(storeToString(fragmentStore), {
                status: 200,
                headers: textTurtleHeader
            })
            mockCommunication.get.mockResolvedValueOnce(fragmentResponse)
            // mock container created -> for new fragment
            mockCommunication.put.mockResolvedValue(new Response(null, { status: 201 }))
            mockCommunication.patch.mockResolvedValueOnce(new Response(null, { status: 205 }))
            // mock new resource created -> new member (append method)
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await ldesinldp.append(resourceStore)

            expect(mockCommunication.get).toBeCalledTimes(3)
            expect(mockCommunication.put).toBeCalledTimes(1)
            expect(mockCommunication.post).toBeCalledTimes(1)
            expect(mockCommunication.patch).toBeCalledTimes(1)
        });

        it('creates no new fragment when the # of members in the current fragment < pageSize.', async () => {
            const metadataResponse = new Response(storeToString(store), { status: 200, headers: textTurtleHeader })
            mockCommunication.get.mockResolvedValueOnce(metadataResponse)

            const fragmentResponse = new Response(storeToString(new Store()), { status: 200, headers: textTurtleHeader })
            mockCommunication.get.mockResolvedValueOnce(fragmentResponse)

            mockCommunication.post.mockResolvedValueOnce(postResponse)
            await ldesinldp.append(resourceStore)

            expect(mockCommunication.get).toBeCalledTimes(2)
            expect(mockCommunication.put).toBeCalledTimes(0)
            expect(mockCommunication.post).toBeCalledTimes(1)
            expect(mockCommunication.post).toBeCalledWith(getRelationIdentifier(lilBase, date), storeToString(resourceStore))

        });
    });

    describe('when reading a resource from an LDES in LDP', () => {
        it('returns store of the resource.', async () => {
            const turtleString = "<a> <b> <c>."
            const getResponse = new Response(turtleString, {
                status: 200,
                headers: new Headers({ 'Content-type': 'text/turtle' })
            })
            mockCommunication.get.mockResolvedValueOnce(getResponse)

            const store = await ldesinldp.read(createdURL)
            expect(store.size).toBe(1)
        });

        it('throws an error when the resource was not found.', async () => {
            const getResponse = new Response(null, { status: 404 })
            mockCommunication.get.mockResolvedValueOnce(getResponse)

            await expect(() => ldesinldp.read(createdURL)).rejects.toThrow(Error)
        });

        it('throws an error when the content-type is not text/turtle', async () => {
            const getResponse = new Response(null, { status: 200 })
            mockCommunication.get.mockResolvedValueOnce(getResponse)

            await expect(() => ldesinldp.read(createdURL)).rejects.toThrow(Error)

        });
    });

    describe('when reading the metadata from an LDES in LDP', () => {

        beforeEach(() => {
            const getResponse = new Response(lilString, {
                status: 200,
                headers: new Headers({ 'Content-type': 'text/turtle' })
            })
            mockCommunication.get.mockResolvedValueOnce(getResponse)
        });

        it('throws an error when the base (LDESinLDPIdentifier) is not an actual LDES in LDP.', async () => {
            const getResponse = new Response("", {
                status: 200,
                headers: new Headers({ 'Content-type': 'text/turtle' })
            })
            mockCommunication.get = jest.fn()
            mockCommunication.get.mockResolvedValueOnce(getResponse)
            await expect(ldesinldp.readMetadata()).rejects.toThrow(Error)
        });

        it('returns the metadata of the LDES in LDP as a store.', async () => {
            await expect(ldesinldp.readMetadata()).resolves.toBeDefined()
        })

        it('returns the metadata of the LDES in LDP, which can be extracted.', async () => {
            const metadataStore = await ldesinldp.readMetadata()
            const ldesMetadata = extractLdesMetadata(metadataStore, 'http://example.org/ldesinldp/#EventStream')
            expect(ldesMetadata.views.length).toBe(1)
        })
    });

    describe('when reading all the members of an LDES in LDP', () => {
        let getMetadataResponse: Response
        let getNodeResponse: Response;
        let getResourceResponse: Response;
        beforeEach(() => {
            getMetadataResponse = new Response(lilString, {
                status: 200,
                headers: new Headers({ 'Content-type': 'text/turtle' })
            })

            getNodeResponse = new Response(
                `<http://example.org/ldesinldp/timestamppath/> <${LDP.contains}> <http://example.org/ldesinldp/timestamppath/resource1>.`,
                {
                    status: 200,
                    headers: new Headers({ 'Content-type': 'text/turtle' })
                })
            getResourceResponse = new Response(
                `<#resource> <${DCT.title}> "test".
<#resource> <${DCT.created}> "${date.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
<#resource> <${DCT.isVersionOf}>  <http://example.org/resource1>.`,
                {
                    status: 200,
                    headers: new Headers({ 'Content-type': 'text/turtle' })
                })
        });

        it('returns the members in the LDES in LDP.', async () => {
            mockCommunication.get.mockResolvedValueOnce(getMetadataResponse)
            mockCommunication.get.mockResolvedValueOnce(getNodeResponse)
            mockCommunication.get.mockResolvedValueOnce(getResourceResponse)
            const memberStream = await ldesinldp.readAllMembers()
            const members = await memberStreamtoStore(memberStream)
            expect(mockCommunication.get).toBeCalledTimes(3)
            expect(members.size).toBe(3)
            expect(members.getObjects(null, DCT.title, null)[0].value).toBe("test")
            expect(members.getObjects(null, DCT.isVersionOf, null)[0].value).toBe("http://example.org/resource1")
        });

        it('also works when tree:path is not the default.', async () => {
            const treePath = "http://purl.org/dc/terms/test"
            const lilMetadata = MetadataInitializer.generateLDESinLDPMetadata(lilBase,
                { lilConfig: { treePath }, date })

            const metadataResponse = turtleStringResponseFromMetadata(lilMetadata)
            const getResourceResponse = turtleStringResponse(`<#resource> <${DCT.title}> "test".
<#resource> <${treePath}> "${date.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime>.`)
            getNodeResponse = turtleStringResponse(
                `<${getRelationIdentifier(lilBase, date)}> <${LDP.contains}> <http://example.org/ldesinldp/timestamppath/resource1>.`)
            mockCommunication.get.mockResolvedValueOnce(metadataResponse)
            mockCommunication.get.mockResolvedValueOnce(getNodeResponse)
            mockCommunication.get.mockResolvedValueOnce(getResourceResponse)

            const memberStream = await ldesinldp.readAllMembers()
            const members = await memberStreamtoStore(memberStream)

            console.log(storeToString(members))
            expect(members.size).toBe(2)
            expect(members.getObjects(null, DCT.title, null)[0].value).toBe("test")
            expect(members.getObjects(null, treePath, null)[0].value).toBe(date.toISOString())
        })
    });

    describe('when reading all the members of an LDES in LDP in order', () => {
        let getMetadataResponse: Response
        let getNodeResponse: Response;
        let getResourceResponse1: Response;
        let getResourceResponse2: Response;
        const dateResource1 = new Date("2020")
        const dateResource2 = new Date("2021")

        beforeEach(() => {
            getMetadataResponse = new Response(lilString, {
                status: 200,
                headers: new Headers({ 'Content-type': 'text/turtle' })
            })

            getNodeResponse = new Response(
                `<http://example.org/ldesinldp/timestamppath/> <${LDP.contains}> <http://example.org/ldesinldp/timestamppath/resource1>.
<http://example.org/ldesinldp/timestamppath/> <${LDP.contains}> <http://example.org/ldesinldp/timestamppath/resource2>.`,
                {
                    status: 200,
                    headers: new Headers({ 'Content-type': 'text/turtle' })
                })
            // oldest
            getResourceResponse1 = new Response(
                `<http://example.org/resource1#resource1> <${DCT.title}> "test".
<http://example.org/resource1#resource1> <${DCT.created}> "${dateResource1.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
<http://example.org/resource1#resource1> <${DCT.isVersionOf}>  <http://example.org/resource1>.`,
                {
                    status: 200,
                    headers: new Headers({ 'Content-type': 'text/turtle' })
                })

            // newest
            getResourceResponse2 = new Response(
                `<http://example.org/resource1#resource2> <${DCT.title}> "test".
<http://example.org/resource1#resource2> <${DCT.created}> "${dateResource2.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
<http://example.org/resource1#resource2> <${DCT.isVersionOf}>  <http://example.org/resource1>.`,
                {
                    status: 200,
                    headers: new Headers({ 'Content-type': 'text/turtle' })
                })
        });

        it('returns the members of the LDES in LDP chronologically.', async () => {
            mockCommunication.get.mockResolvedValueOnce(getMetadataResponse)
            mockCommunication.get.mockResolvedValueOnce(getNodeResponse)
            // newest member is added first
            mockCommunication.get.mockResolvedValueOnce(getResourceResponse2)
            mockCommunication.get.mockResolvedValueOnce(getResourceResponse1)
            const memberStream = await ldesinldp.readMembersSorted()
            const orderedMembers: Member[] = []
            for await (const member of memberStream) {
                orderedMembers.push(member)
            }
            expect(mockCommunication.get).toBeCalledTimes(4)
            expect(orderedMembers.length).toBe(2)
            // as newest member is fetched first, the ordering will make the oldest member appear as first data element in the stream
            expect(extractDateFromMember(orderedMembers[0], DCT.created).getTime()).toEqual(dateResource1.getTime())
            expect(extractDateFromMember(orderedMembers[1], DCT.created).getTime()).toEqual(dateResource2.getTime())
        });
    });

    describe('when creating a new fragment', () => {
        // TODO: test conditional
        const dateNewFragment = new Date('2022-10-04')
        const fragmentIdentifier = `${lilBase + dateNewFragment.getTime()}/`

        beforeEach(() => {
            // new container created
            mockCommunication.put.mockResolvedValueOnce(new Response(null, { status: 201 }))
            // read metadata
            mockCommunication.get.mockResolvedValue(new Response(lilString,
                {
                    status: 200,
                    headers: new Headers({ 'content-type': 'text/turtle' })
                }
            ))
        });

        it('fails when a container cannot be created.', async () => {
            mockCommunication.put.mockResolvedValueOnce(new Response(null, { status: 404 }))
            // error due to `createContainer` function
            await expect(async () => ldesinldp.newFragment(dateNewFragment)).rejects.toThrow(Error)
        });

        it('sends the correct PATCH request when inbox MUST be created.', async () => {
            // patch metadata
            mockCommunication.patch.mockResolvedValueOnce(new Response(null, { status: 205 }))

            await ldesinldp.newFragment(dateNewFragment)
            expect(mockCommunication.put).lastCalledWith(fragmentIdentifier)
            expect(mockCommunication.patch).lastCalledWith(lilBase + '.meta', `DELETE DATA {<${lilBase}> <http://www.w3.org/ns/ldp#inbox> <${inboxContainerURL}> .
};
INSERT DATA {<${lilBase}> <http://www.w3.org/ns/ldp#inbox> <http://example.org/ldesinldp/1664841600000/> .
};
INSERT DATA {_:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:b0 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:b0 <https://w3id.org/tree#value> "${dateNewFragment.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:b0 <https://w3id.org/tree#node> <${fragmentIdentifier}> .
<http://example.org/ldesinldp/> <https://w3id.org/tree#relation> _:b0 .
};`)
        });

        it('sends the correct PATCH request when inbox MUST NOT be created.', async () => {
            // patch metadata
            mockCommunication.patch.mockResolvedValueOnce(new Response(null, { status: 205 }))
            let oldDate = new Date(0)
            const fragmentIdentifier = getRelationIdentifier(lilBase, oldDate)

            await ldesinldp.newFragment(oldDate)
            expect(mockCommunication.put).lastCalledWith(fragmentIdentifier)
            expect(mockCommunication.patch).lastCalledWith(lilBase + '.meta', `INSERT DATA {_:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:b0 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:b0 <https://w3id.org/tree#value> "${oldDate.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:b0 <https://w3id.org/tree#node> <${fragmentIdentifier}> .
<http://example.org/ldesinldp/> <https://w3id.org/tree#relation> _:b0 .
};`)
        });

        it('rejects when the PATCH request failed.', async () => {
            // patch metadata fails
            mockCommunication.patch.mockResolvedValueOnce(new Response(null, { status: 409 }))
            // deletion of container is successful
            mockCommunication.delete.mockResolvedValue(new Response(null, { status: 205 }))

            await expect(async () => ldesinldp.newFragment(dateNewFragment)).rejects.toThrow(Error)
            expect(mockCommunication.put).lastCalledWith(fragmentIdentifier)
            expect(mockCommunication.delete).lastCalledWith(fragmentIdentifier)

        });
    });

    describe('when reading a fragment', () => {
        let containerStore: Store
        let containerURL = lilBase + 'container/'
        let resourceURL = containerURL + 'resource1'
        let resourceStore: Store

        let containerResponse: Response

        beforeEach(() => {
            containerStore = new Store()
            resourceStore = new Store()
            containerStore.addQuad(namedNode(containerURL), namedNode(LDP.contains), namedNode(resourceURL))
            resourceStore.addQuad(namedNode(resourceURL), namedNode(DCT.title), literal("title"))

            containerResponse = new Response(storeToString(containerStore), { status: 200, headers: textTurtleHeader })
        });

        it('returns nothing when uri is not a containerURI', async () => {
            const resources = await ldesinldp.readPage('containerURL')
            expect((await resources[Symbol.asyncIterator]().next()).done).toBe(true)
            expect(mockCommunication.get).toBeCalledTimes(0)

        })

        it('returns the resource when no containment triple is present.', async () => {
            mockCommunication.get.mockResolvedValue(new Response(storeToString(resourceStore), {
                status: 200,
                headers: textTurtleHeader
            }))

            mockCommunication.get.mockResolvedValueOnce(containerResponse)

            const resources = ldesinldp.readPage(containerURL)
            for await (const resource of resources) {
                expect(resource).toEqual(resourceStore)
            }

            expect(mockCommunication.get).toBeCalledTimes(2)
        });

        it('returns the members when containment triples are present.', async () => {
            const memberStore = new Store()
            addSimpleMember(memberStore, resourceURL, lilBase + "#EventStream")
            addSimpleMember(memberStore, containerURL + 'resource2', lilBase + "#EventStream")

            mockCommunication.get.mockResolvedValue(new Response(storeToString(memberStore), {
                status: 200,
                headers: textTurtleHeader
            }))

            mockCommunication.get.mockResolvedValueOnce(containerResponse)

            const resources = ldesinldp.readPage(containerURL)
            let members: Store[] = []
            for await (const resource of resources) {
                members.push(resource)
            }
            expect(members.length).toBe(2)
            expect(mockCommunication.get).toBeCalledTimes(2)
        });

        it('does not fetch ldp:resources based on filtering using TREE metadata at container description resource.', async () => {
            const t1 = new Date("2024-01-15")
            const t2 = new Date("2024-01-16")
            const t3 = new Date(t2.valueOf()+1)

            // mock response of container with metadata see `appendRelationToPage` function
            // remove all general relations
            lilMetadata.view.relations = []
            // add new relations
            const newRelation = new GreaterThanOrEqualToRelation(resourceURL, lilMetadata.view.viewDescription!.managedBy.bucketizeStrategy.path, t3.toISOString())
            lilMetadata.view.relations.push(newRelation)
            const newMetadata = lilMetadata.getStore()
            newMetadata.removeQuads(newMetadata.getQuads(null, LDP.terms.inbox, null, null))
            containerStore.addQuads(newMetadata.getQuads(null, null, null, null))
            containerResponse = new Response(storeToString(containerStore), { status: 200, headers: textTurtleHeader })
            mockCommunication.get.mockResolvedValueOnce(containerResponse)
 
            
            
            const resources = ldesinldp.readPage(containerURL, { from: t1, until: t2 })

            let members: Store[] = []
            for await (const resource of resources) {
                members.push(resource)
            }
            expect(members.length).toBe(0)
            expect(mockCommunication.get).toBeCalledTimes(1)

        });
        it('does fetch ldp:resources based on filtering using TREE metadata at container description resource.', async () => {
            mockCommunication.get.mockResolvedValue(new Response(storeToString(resourceStore), {
                status: 200,
                headers: textTurtleHeader
            }))

            const t1 = new Date("2024-01-15")
            const t2 = new Date("2024-01-16")
            const t3 = new Date(t2.valueOf()+1)

            // mock response of container with metadata see `appendRelationToPage` function
            // remove all general relations
            lilMetadata.view.relations = []
            // add new relations
            const newRelation = new GreaterThanOrEqualToRelation(resourceURL, lilMetadata.view.viewDescription!.managedBy.bucketizeStrategy.path, t2.toISOString())
            lilMetadata.view.relations.push(newRelation)
            const newMetadata = lilMetadata.getStore()
            newMetadata.removeQuads(newMetadata.getQuads(null, LDP.terms.inbox, null, null))
            containerStore.addQuads(newMetadata.getQuads(null, null, null, null))
            containerResponse = new Response(storeToString(containerStore), { status: 200, headers: textTurtleHeader })
            mockCommunication.get.mockResolvedValueOnce(containerResponse)
 
            
            
            const resources = ldesinldp.readPage(containerURL, { from: t1, until: t3 }) // t2 would also be okay

            let members: Store[] = []
            for await (const resource of resources) {
                members.push(resource)
            }
            expect(members.length).toBe(1)
            expect(mockCommunication.get).toBeCalledTimes(2)

        });
    });
})
