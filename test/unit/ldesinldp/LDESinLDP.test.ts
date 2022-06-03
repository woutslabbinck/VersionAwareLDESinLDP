import {baseUrl} from "../../util/solidHelper";
import {LDPCommunication} from "../../../src/ldp/LDPCommunication";
import {LDESinLDP} from "../../../src/ldesinldp/LDESinLDP";
import {LDESinLDPConfig} from "../../../src/ldesinldp/LDESinLDPConfig";
import {DCT, LDP} from "../../../src/util/Vocabularies";
import {retrieveWriteLocation} from "../../../src/ldesinldp/Util";
import {Store} from "n3";
import {Communication} from "../../../src/ldp/Communication";
import {extractLdesMetadata} from "../../../src/util/LdesUtil";
import {memberStreamtoStore,} from "../../../src/util/Conversion";

describe('An LDESinLDP', () => {
    const lilIdentifier = baseUrl + 'ldesinldp_lil/'

    const communication = new LDPCommunication()
    const ldesinldp = new LDESinLDP(lilIdentifier, communication)

    const ldesinldpConfig: LDESinLDPConfig = {
        LDESinLDPIdentifier: lilIdentifier,
        treePath: DCT.created
    }

    const resourceStore = new Store()
    const date = new Date()

    let mockCommunication: jest.Mocked<Communication>
    let mockedLDESinLDP: LDESinLDP
    const mockedBaseUrl = 'http://example.org/ldesinldp/'
    const inboxContainerURL = 'http://example.org/ldesinldp/timestamp/'
    const createdURL = 'http://example.org/ldesinldp/timestamp/created'

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

    // beforeAll(async () => {
    //     await ldesinldp.initialise(ldesinldpConfig)
    //
    //     resourceStore.addQuad(namedNode("#resource"), namedNode(DCT.isVersionOf), namedNode("http://example.org/resource1"))
    //     resourceStore.addQuad(namedNode("#resource"), namedNode(DCT.title), namedNode(`First version of resource ${date.toLocaleString()}`))
    //     resourceStore.addQuad(namedNode("#resource"), namedNode(ldesinldpConfig.treePath), dateToLiteral(date))
    // })
    //
    // afterAll(async () => {
    //     // Note: currently not needed
    //     // code to remove the ldes in ldp with one container, could be extended for multiple relations in the ldes
    //     const firstRelationNodeContainer = await retrieveWriteLocation(lilIdentifier, communication)
    //     const firstRelationNodeStore = await ldesinldp.read(firstRelationNodeContainer)
    //     const resourceIdentifiers = firstRelationNodeStore.getObjects(firstRelationNodeContainer, LDP.contains, null)
    //         .map(object => object.value)
    //     const deleteRequests = resourceIdentifiers.map(resourceIdentifier => communication.delete(resourceIdentifier))
    //     await Promise.all(deleteRequests)
    //     await communication.delete(lilIdentifier)
    // })

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

        mockedLDESinLDP = new LDESinLDP(mockedBaseUrl, mockCommunication)
    });

    it('returns the LDESinLDPIdentifier when calling its get function.', () => {
        expect(mockedLDESinLDP.LDESinLDPIdentifier).toBe(mockedBaseUrl)
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
        // note: this is kind of an integration test
        const lilIdentifier = baseUrl + 'ldesinldp_init/'
        const treePath = DCT.created

        let config: LDESinLDPConfig
        beforeEach(() => {
            config = {
                LDESinLDPIdentifier: lilIdentifier,
                treePath
            }
        })

        it('fails when the given LDESinLDPIdentifier is not a container.', async () => {
            await expect(ldesinldp.initialise({
                LDESinLDPIdentifier: 'http://example.org',
                treePath
            })).rejects.toThrow(Error)
        })

        it('succeeds, given a proper configuration.', async () => {
            await ldesinldp.initialise(config)

            const writeLocation = await retrieveWriteLocation(lilIdentifier, communication)
            const store = await ldesinldp.read(lilIdentifier)

            expect(store.getQuads(lilIdentifier, LDP.contains, writeLocation, null).length).toBe(1)
            expect(store.getQuads(lilIdentifier, LDP.inbox, writeLocation, null).length).toBe(1)
            // maybe create store based on date and do the same isomorphic rdf as in the CSS?
        });

        it('does nothing when it was already initialised', async () => {
            config.LDESinLDPIdentifier = baseUrl + 'lil_init_v2/'
            await ldesinldp.initialise(config)

            await expect(ldesinldp.initialise(config)).resolves.toBeUndefined()

        })
    })

    describe('when creating a resource from an LDES in LDP', () => {

        it('returns the URL of the created resource when succeeded.', async () => {
            const locationHeader = new Headers({'Location': createdURL})
            const postResponse = new Response(null, {status: 201, headers: locationHeader})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(mockedLDESinLDP.create(resourceStore)).resolves.toBe(createdURL)
        });

        it('throws error when posting the resource failed.', async () => {
            const postResponse = new Response(null, {status: 500})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(mockedLDESinLDP.create(resourceStore)).rejects.toThrow(Error)
        });

        it('throws error when no location is returned.', async () => {
            const postResponse = new Response(null, {status: 201})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(mockedLDESinLDP.create(resourceStore)).rejects.toThrow(Error)
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

            const store = await mockedLDESinLDP.read(createdURL)
            expect(store.size).toBe(1)
        });

        it('throws an error when the resource was not found.', async () => {
            const getResponse = new Response(null, {status: 404})
            mockCommunication.get.mockResolvedValueOnce(getResponse)

            await expect(() => mockedLDESinLDP.read(createdURL)).rejects.toThrow(Error)
        });

        it('throws an error when the content-type is not text/turtle', async () => {
            const getResponse = new Response(null, {status: 200})
            mockCommunication.get.mockResolvedValueOnce(getResponse)

            await expect(() => mockedLDESinLDP.read(createdURL)).rejects.toThrow(Error)

        });
    })

    describe('when updating a resource from an LDES in LDP', () => {
        it('returns the URL of the updated resource when succeeded.', async () => {
            const locationHeader = new Headers({'Location': createdURL})
            const postResponse = new Response(null, {status: 201, headers: locationHeader})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(mockedLDESinLDP.update(resourceStore)).resolves.toBe(createdURL)
        });
    })

    describe('when deleting a resource from an LDES in LDP', () => {
        it('returns the URL of the deleted resource when succeeded.', async () => {
            const locationHeader = new Headers({'Location': createdURL})
            const postResponse = new Response(null, {status: 201, headers: locationHeader})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(mockedLDESinLDP.delete(resourceStore)).resolves.toBe(createdURL)
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
            await expect(mockedLDESinLDP.readMetadata()).rejects.toThrow(Error)
        });

        it('returns the metadata of the LDES in LDP as a store.', async () => {
            await expect(mockedLDESinLDP.readMetadata()).resolves.toBeDefined()
        })

        it('returns the metadata of the LDES in LDP, which can be extracted.', async () => {
            const metadataStore = await mockedLDESinLDP.readMetadata()
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
            const memberStream = await mockedLDESinLDP.readAllMembers()
            const members = await memberStreamtoStore(memberStream)
            expect(members.size).toBe(3)
            expect(members.getObjects(null, DCT.title, null)[0].value).toBe("test")
            expect(members.getObjects(null, DCT.isVersionOf, null)[0].value).toBe("http://example.org/resource1")
        });
    })
})
