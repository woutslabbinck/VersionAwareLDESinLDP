import {baseUrl} from "../../util/solidHelper";
import {LDPCommunication} from "../../../src/ldp/LDPCommunication";
import {LDESinLDP} from "../../../src/ldesinldp/LDESinLDP";
import {LDESinLDPConfig} from "../../../src/ldesinldp/LDESinLDPConfig";
import {DCT, LDP} from "../../../src/util/Vocabularies";
import {retrieveWriteLocation} from "../../../src/ldesinldp/Util";
import {DataFactory, Store} from "n3";
import namedNode = DataFactory.namedNode;
import {dateToLiteral} from "../../../src/util/TimestampUtil";
import {Communication} from "../../../src/ldp/Communication";
import {storeToString} from "../../../src/util/Conversion";

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
    beforeAll(async () => {
        await ldesinldp.initialise(ldesinldpConfig)

        resourceStore.addQuad(namedNode("#resource"), namedNode(DCT.isVersionOf), namedNode("http://example.org/resource1"))
        resourceStore.addQuad(namedNode("#resource"), namedNode(DCT.title), namedNode(`First version of resource ${date.toLocaleString()}`))
        resourceStore.addQuad(namedNode("#resource"), namedNode(ldesinldpConfig.treePath), dateToLiteral(date))
    })

    afterAll(async () => {
        // code to remove the ldes in ldp with one container, could be extended for multiple relations in the ldes
        const firstRelationNodeContainer = await retrieveWriteLocation(lilIdentifier, communication)
        const firstRelationNodeStore = await ldesinldp.read(firstRelationNodeContainer)
        const resourceIdentifiers = firstRelationNodeStore.getObjects(firstRelationNodeContainer, LDP.contains, null)
            .map(object => object.value)
        const deleteRequests = resourceIdentifiers.map(resourceIdentifier => communication.delete(resourceIdentifier))
        await Promise.all(deleteRequests)
        await communication.delete(lilIdentifier)
    })

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
    })

    describe('when creating a resource from an LDES in LDP', () => {
        let mockCommunication: jest.Mocked<Communication>
        let mockedLDESinLDP: LDESinLDP
        const mockedBaseUrl = 'http://example.org/ldesinldp/'
        const inboxContainerURL = 'http://example.org/ldesinldp/timestamp/'
        const createdURL = 'http://example.org/ldesinldp/timestamp/created'
        beforeEach(() => {
            mockCommunication = {
                delete: jest.fn(),
                head: jest.fn(),
                get: jest.fn(),
                patch: jest.fn(),
                post: jest.fn(),
                put: jest.fn()
            }
            const inboxHeader = new Headers({'Link': `<${inboxContainerURL}>; rel="http://www.w3.org/ns/ldp#inbox"`})
            const locationResponse = new Response(null, {status: 200, headers: inboxHeader})

            mockCommunication.head.mockResolvedValueOnce(locationResponse)

            mockedLDESinLDP = new LDESinLDP(mockedBaseUrl, mockCommunication)
        });


        it('succeeds with valid configuration of LDES in LDP.', async () => {
            const locationHeader = new Headers({'Location': createdURL})
            const postResponse = new Response(null, {status: 201, headers: locationHeader})
            mockCommunication.post.mockResolvedValueOnce(postResponse)

            await expect(mockedLDESinLDP.create(resourceStore)).resolves.toBe(createdURL)
        });

        it('throws error when posting the resource failed.', async () => {
            const postResponse = new Response(null, {status: 500})
            mockCommunication.post.mockResolvedValueOnce(postResponse)
            const mockedLdesinLdp = new LDESinLDP('http://example.org/ldesinldp/', mockCommunication)

            await expect(mockedLdesinLdp.create(resourceStore)).rejects.toThrow(Error)
        });

        it('throws error when no location is returned.', async () => {
            const postResponse = new Response(null, {status: 201})
            mockCommunication.post.mockResolvedValueOnce(postResponse)
            const mockedLdesinLdp = new LDESinLDP('http://example.org/ldesinldp/', mockCommunication)

            await expect(mockedLdesinLdp.create(resourceStore)).rejects.toThrow(Error)
        });
    })

    describe('when reading a resource from an LDES in LDP', () => {
        let mockCommunication: jest.Mocked<Communication>
        let mockedLDESinLDP: LDESinLDP
        const mockedBaseUrl = 'http://example.org/ldesinldp/'
        const createdURL = 'http://example.org/ldesinldp/timestamp/created'

        beforeEach(() => {
            mockCommunication = {
                delete: jest.fn(),
                head: jest.fn(),
                get: jest.fn(),
                patch: jest.fn(),
                post: jest.fn(),
                put: jest.fn()
            }
            const turtleString = "<a> <b> <c>."
            const getResponse = new Response(turtleString, {
                status: 200,
                headers: new Headers({'Content-type': 'text/turtle'})
            })
            mockCommunication.get.mockResolvedValueOnce(getResponse)
            mockedLDESinLDP = new LDESinLDP(mockedBaseUrl, mockCommunication)

        })

        it('returns store of the resource.', async () => {
            const store = await mockedLDESinLDP.read(createdURL)
            expect(store.size).toBe(1)
        });

        it('throws an error when the resource was not found.', async () => {
            mockCommunication.get = jest.fn()
            const getResponse = new Response(null, {status: 404})
            mockCommunication.get.mockResolvedValueOnce(getResponse)
            mockedLDESinLDP = new LDESinLDP(mockedBaseUrl, mockCommunication)

            await expect(() => mockedLDESinLDP.read(createdURL)).rejects.toThrow(Error)
        });

        it('throws an error when the content-type is not text/turtle', async () => {
            mockCommunication.get = jest.fn()
            const getResponse = new Response(null, {status: 200})
            mockCommunication.get.mockResolvedValueOnce(getResponse)
            mockedLDESinLDP = new LDESinLDP(mockedBaseUrl, mockCommunication)

            await expect(() => mockedLDESinLDP.read(createdURL)).rejects.toThrow(Error)

        });
    })

    describe('when updating a resource from an LDES in LDP', () => {

    })

    describe('when deleting a resource from an LDES in LDP', () => {

    })

    describe('when reading the metadata from an LDES in LDP', () => {

    })

    describe('when reading all the members of an LDES in LDP', () => {

    })
})
