import {LDESinLDP} from "../../../src/ldes/LDESinLDP";
import {DCT, LDES, LDP} from "../../../src/util/Vocabularies";
import {DataFactory, Store} from "n3";
import {Communication} from "../../../src/ldp/Communication";
import {extractLdesMetadata} from "../../../src/util/LdesUtil";
import {memberStreamtoStore, storeToString,} from "../../../src/util/Conversion";
import {LDESConfig} from "../../../src/ldes/LDESConfig";
import mock = jest.mock;
import {createVersionedEventStream, getRelationIdentifier} from "../../../src/ldes/Util";
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;

describe('An LDESinLDP', () => {
    const resourceStore = new Store()
    const date = new Date()

    let mockCommunication: jest.Mocked<Communication>
    let ldesinldp: LDESinLDP
    const lilBase = 'http://example.org/ldesinldp/'
    const inboxContainerURL = 'http://example.org/ldesinldp/timestamppath/'
    const createdURL = 'http://example.org/ldesinldp/timestamp/created'

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
        const inboxHeader = new Headers({'Link': `<${inboxContainerURL}>; rel="http://www.w3.org/ns/ldp#inbox"`})
        const headResponse = new Response(null, {status: 200, headers: inboxHeader})
        mockCommunication.head.mockResolvedValue(headResponse)

        textTurtleHeader = new Headers(new Headers({'content-type': 'text/turtle'}))
        readMetadataResponse = new Response(lilString, {status: 200, headers: textTurtleHeader})
        ldesinldp = new LDESinLDP(lilBase, mockCommunication)
    });

    it('returns the LDESinLDPIdentifier when calling its get function.', () => {
        expect(ldesinldp.LDESinLDPIdentifier).toBe(lilBase)
    });

    describe('when instantiating an LDES in LDP', () => {
        it('succeeds when a correct base LDESinLDPIdentifier is given.', () => {
            expect(new LDESinLDP('http://example.org/ldesinldp/', mockCommunication)).toBeDefined()
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
            store = new Store()
            createVersionedEventStream(store, config, date)
            relationIdentifier = getRelationIdentifier(lilBase, date)
            store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDP.inbox), namedNode(relationIdentifier))
        });

        it('succeeds when it was not initialised yet.', async () => {
            mockCommunication.put.mockResolvedValue(new Response(null, {status: 201}))
            mockCommunication.patch.mockResolvedValue(new Response(null, {status: 205}))
            mockCommunication.head.mockResolvedValueOnce(new Response(null, {status: 500}))

            const patchQuery = `INSERT DATA {${storeToString(store)}}`

            await ldesinldp.initialise(config, date)
            expect(mockCommunication.patch).toBeCalledWith(lilBase + '.meta', patchQuery)
            expect(mockCommunication.patch).toBeCalledTimes(1)
            expect(mockCommunication.put).toBeCalledTimes(2)
            expect(mockCommunication.put).toHaveBeenNthCalledWith(1, lilBase)
            expect(mockCommunication.put).toHaveBeenNthCalledWith(2, relationIdentifier)
        })

        it('persists the maximum page size.', async () => {
            mockCommunication.put.mockResolvedValue(new Response(null, {status: 201}))
            mockCommunication.patch.mockResolvedValue(new Response(null, {status: 205}))
            mockCommunication.head.mockResolvedValueOnce(new Response(null, {status: 500}))

            const pageSize = 10
            config.pageSize = pageSize

            store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDES.pageSize), literal(config.pageSize))
            const patchQuery = `INSERT DATA {${storeToString(store)}}`

            await ldesinldp.initialise(config, date)
            expect(mockCommunication.patch).toBeCalledWith(lilBase + '.meta', patchQuery)
        })

        it('succeeds when it was already initialised.', async () => {
            mockCommunication.head.mockResolvedValueOnce(new Response(null, {status: 200}))

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
            store = new Store()
            createVersionedEventStream(store, config, date)
            config.pageSize = pageSize

            const relationIdentifier = getRelationIdentifier(lilBase, date)
            store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDP.inbox), namedNode(relationIdentifier))
            store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDES.pageSize), literal(config.pageSize))

            const locationHeader = new Headers({'Location': createdURL})
            postResponse = new Response(null, {status: 201, headers: locationHeader})

        });

        it('returns the URL of the created resource when succeeded.', async () => {
            mockCommunication.post.mockResolvedValueOnce(postResponse)
            await expect(ldesinldp.append(resourceStore)).resolves.toBe(createdURL)
            expect(mockCommunication.post).toBeCalledWith(inboxContainerURL, storeToString(resourceStore))
            expect(mockCommunication.post).toBeCalledTimes(1)
            expect(mockCommunication.get).toBeCalledTimes(1)

        });

        it('throws error when posting the resource failed.', async () => {
            postResponse = new Response(null, {status: 500})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(ldesinldp.append(resourceStore)).rejects.toThrow(Error)
            expect(mockCommunication.post).toBeCalledTimes(1)

        });

        it('throws error when no location is returned.', async () => {
            postResponse = new Response(null, {status: 201})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(ldesinldp.append(resourceStore)).rejects.toThrow(Error)
            expect(mockCommunication.post).toBeCalledTimes(1)
        });

        it('creates a new fragment when the # of members in the current fragment >= pageSize.', async () => {
            const metadataResponse = new Response(storeToString(store), {status: 200, headers: textTurtleHeader})
            mockCommunication.get.mockResolvedValueOnce(metadataResponse)

            const fragmentStore = new Store()
            fragmentStore.addQuad(namedNode(getRelationIdentifier(lilBase, date)), namedNode(LDP.contains), namedNode('childURL'))
            const fragmentResponse = new Response(storeToString(fragmentStore), {status: 200, headers: textTurtleHeader})
            mockCommunication.get.mockResolvedValueOnce(fragmentResponse)
            // mock container created -> for new fragment
            mockCommunication.put.mockResolvedValue(new Response(null, {status: 201}))
            mockCommunication.patch.mockResolvedValueOnce(new Response(null, {status: 205}))
            // mock new resource created -> new member (append method)
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await ldesinldp.append(resourceStore)

            expect(mockCommunication.get).toBeCalledTimes(3)
            expect(mockCommunication.put).toBeCalledTimes(1)
            expect(mockCommunication.post).toBeCalledTimes(1)
            expect(mockCommunication.patch).toBeCalledTimes(1)
        });

        it('creates no new fragment when the # of members in the current fragment < pageSize.', async () => {
            const metadataResponse = new Response(storeToString(store), {status: 200, headers: textTurtleHeader})
            mockCommunication.get.mockResolvedValueOnce(metadataResponse)

            const fragmentResponse = new Response(storeToString(new Store()), {status: 200, headers: textTurtleHeader})
            mockCommunication.get.mockResolvedValueOnce(fragmentResponse)

            mockCommunication.post.mockResolvedValueOnce(postResponse)
            await ldesinldp.append(resourceStore)

            expect(mockCommunication.get).toBeCalledTimes(2)
            expect(mockCommunication.put).toBeCalledTimes(0)
            expect(mockCommunication.post).toBeCalledTimes(1)
            expect(mockCommunication.post).toBeCalledWith(getRelationIdentifier(lilBase, date), storeToString(resourceStore))

        });
    })

    describe('when reading a resource from an LDES in LDP', () => {
        it('returns store of the resource.', async () => {
            const turtleString = "<a> <b> <c>."
            const getResponse = new Response(turtleString, {
                status: 200,
                headers: new Headers({'Content-type': 'text/turtle'})
            })
            mockCommunication.get.mockResolvedValueOnce(getResponse)

            const store = await ldesinldp.read(createdURL)
            expect(store.size).toBe(1)
        });

        it('throws an error when the resource was not found.', async () => {
            const getResponse = new Response(null, {status: 404})
            mockCommunication.get.mockResolvedValueOnce(getResponse)

            await expect(() => ldesinldp.read(createdURL)).rejects.toThrow(Error)
        });

        it('throws an error when the content-type is not text/turtle', async () => {
            const getResponse = new Response(null, {status: 200})
            mockCommunication.get.mockResolvedValueOnce(getResponse)

            await expect(() => ldesinldp.read(createdURL)).rejects.toThrow(Error)

        });
    })

    describe('when reading the metadata from an LDES in LDP', () => {

        beforeEach(() => {
            const getResponse = new Response(lilString, {
                status: 200,
                headers: new Headers({'Content-type': 'text/turtle'})
            })
            mockCommunication.get.mockResolvedValueOnce(getResponse)
        });

        it('throws an error when the base (LDESinLDPIdentifier) is not an actual LDES in LDP.', async () => {
            const getResponse = new Response("", {
                status: 200,
                headers: new Headers({'Content-type': 'text/turtle'})
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
    })

    describe('when reading all the members of an LDES in LDP', () => {
        beforeEach(() => {
            const getMetadataResponse = new Response(lilString, {
                status: 200,
                headers: new Headers({'Content-type': 'text/turtle'})
            })
            mockCommunication.get.mockResolvedValueOnce(getMetadataResponse)

            const getNodeResponse = new Response(
                `<http://example.org/ldesinldp/timestamppath/> <${LDP.contains}> <http://example.org/ldesinldp/timestamppath/resource1>.`,
                {
                    status: 200,
                    headers: new Headers({'Content-type': 'text/turtle'})
                })
            mockCommunication.get.mockResolvedValueOnce(getNodeResponse)
            const getResourceResponse = new Response(
                `<#resource> <${DCT.title}> "test".
<#resource> <${DCT.created}> "${date.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
<#resource> <${DCT.isVersionOf}>  <http://example.org/resource1>.`,
                {
                    status: 200,
                    headers: new Headers({'Content-type': 'text/turtle'})
                })
            mockCommunication.get.mockResolvedValueOnce(getResourceResponse)
        });

        it('returns the members in the LDES in LDP.', async () => {
            const memberStream = await ldesinldp.readAllMembers()
            const members = await memberStreamtoStore(memberStream)
            expect(members.size).toBe(3)
            expect(members.getObjects(null, DCT.title, null)[0].value).toBe("test")
            expect(members.getObjects(null, DCT.isVersionOf, null)[0].value).toBe("http://example.org/resource1")
        });
    })


    describe('when creating a new fragment', () => {
        const dateNewFragment = new Date('2022-10-04')
        const fragmentIdentifier = `${lilBase + dateNewFragment.getTime()}/`

        beforeEach(() => {
            // new container created
            mockCommunication.put.mockResolvedValueOnce(new Response(null, {status: 201}))
            // read metadata
            mockCommunication.get.mockResolvedValue(new Response(lilString,
                {
                    status: 200,
                    headers: new Headers({'content-type': 'text/turtle'})
                }
            ))
        });

        it('fails when a container cannot be created.', async () => {
            mockCommunication.put.mockResolvedValueOnce(new Response(null, {status: 404}))
            // error due to `createContainer` function
            await expect(async () => ldesinldp.newFragment(dateNewFragment)).rejects.toThrow(Error)
        });

        it('sends the correct PATCH request.', async () => {
            // patch metadata
            mockCommunication.patch.mockResolvedValueOnce(new Response(null, {status: 205}))

            await ldesinldp.newFragment(dateNewFragment)
            expect(mockCommunication.put).lastCalledWith(fragmentIdentifier)
            expect(mockCommunication.patch).lastCalledWith(lilBase + '.meta', `DELETE DATA { <${lilBase}> <http://www.w3.org/ns/ldp#inbox> <${inboxContainerURL}> .};
INSERT DATA { <${lilBase}> <http://www.w3.org/ns/ldp#inbox> <http://example.org/ldesinldp/1664841600000/> .
 _:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:b0 <https://w3id.org/tree#node> <${fragmentIdentifier}> .
_:b0 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:b0 <https://w3id.org/tree#value> "${dateNewFragment.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
<http://example.org/ldesinldp/> <https://w3id.org/tree#relation> _:b0 .
 }`)
        });

        it('rejects when the PATCH request failed.', async () => {
            // patch metadata fails
            mockCommunication.patch.mockResolvedValueOnce(new Response(null, {status: 409}))
            // deletion of container is successful
            mockCommunication.delete.mockResolvedValue(new Response(null, {status: 205}))

            await expect(async () => ldesinldp.newFragment(dateNewFragment)).rejects.toThrow(Error)
            expect(mockCommunication.put).lastCalledWith(fragmentIdentifier)
            expect(mockCommunication.delete).lastCalledWith(fragmentIdentifier)

        });
    });
})
