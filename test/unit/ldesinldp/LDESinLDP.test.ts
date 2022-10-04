import {LDESinLDP} from "../../../src/ldesinldp/LDESinLDP";
import {DCT, LDP} from "../../../src/util/Vocabularies";
import {Store} from "n3";
import {Communication} from "../../../src/ldp/Communication";
import {extractLdesMetadata} from "../../../src/util/LdesUtil";
import {memberStreamtoStore,} from "../../../src/util/Conversion";

describe('An LDESinLDP', () => {
    const resourceStore = new Store()
    const date = new Date()

    let mockCommunication: jest.Mocked<Communication>
    let ldesinldp: LDESinLDP
    const lilBase = 'http://example.org/ldesinldp/'
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

    describe('when creating a resource from an LDES in LDP', () => {
        it('returns the URL of the created resource when succeeded.', async () => {
            const locationHeader = new Headers({'Location': createdURL})
            const postResponse = new Response(null, {status: 201, headers: locationHeader})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(ldesinldp.create(resourceStore)).resolves.toBe(createdURL)
        });

        it('throws error when posting the resource failed.', async () => {
            const postResponse = new Response(null, {status: 500})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(ldesinldp.create(resourceStore)).rejects.toThrow(Error)
        });

        it('throws error when no location is returned.', async () => {
            const postResponse = new Response(null, {status: 201})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(ldesinldp.create(resourceStore)).rejects.toThrow(Error)
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

    describe('when updating a resource from an LDES in LDP', () => {
        it('returns the URL of the updated resource when succeeded.', async () => {
            const locationHeader = new Headers({'Location': createdURL})
            const postResponse = new Response(null, {status: 201, headers: locationHeader})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(ldesinldp.update(resourceStore)).resolves.toBe(createdURL)
        });
    })

    describe('when deleting a resource from an LDES in LDP', () => {
        it('returns the URL of the deleted resource when succeeded.', async () => {
            const locationHeader = new Headers({'Location': createdURL})
            const postResponse = new Response(null, {status: 201, headers: locationHeader})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(ldesinldp.delete(resourceStore)).resolves.toBe(createdURL)
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
            expect(mockCommunication.patch).lastCalledWith(lilBase+'.meta',`DELETE DATA { <${lilBase}> <http://www.w3.org/ns/ldp#inbox> <${inboxContainerURL}> .};
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
