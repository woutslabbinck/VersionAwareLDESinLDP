import {baseUrl} from "../../util/solidHelper";
import {DCT, LDES, TREE} from "../../../src/util/Vocabularies";
import {
    addRelationToNode,
    addRootNodetoEventStream,
    addShapeToEventStream, createContainer, createVersionedEventStream,
    retrieveWriteLocation
} from "../../../src/ldesinldp/Util";
import {Store} from "n3";
import {RDF} from "@solid/community-server";
import {dateToLiteral} from "../../../src/util/TimestampUtil";
import {Communication} from "../../../src/ldp/Communication";

describe('A LDES in LDP Util', () => {

    describe('has functionality for write location', () => {
        const location = baseUrl + 'ldesinldp_util/'
        let mockCommunication: jest.Mocked<Communication>

        const inboxContainerURL = baseUrl + '/timestamp/'

        beforeAll(async () => {
            mockCommunication = {
                delete: jest.fn(),
                head: jest.fn(),
                get: jest.fn(),
                patch: jest.fn(),
                post: jest.fn(),
                put: jest.fn()
            }

            const inboxHeader = new Headers({'Link': `<${inboxContainerURL}>; rel="http://www.w3.org/ns/ldp#inbox"`})
            const headResponse = new Response(null, {status: 200, headers: inboxHeader})
            mockCommunication.head.mockResolvedValue(headResponse)
        });

        it('finds the correct location.', async () => {
            const writeLocation = await retrieveWriteLocation(location, mockCommunication)

            expect(writeLocation).toBe(inboxContainerURL)
        });

        it('throws error when no ldp:inbox present', async () => {
            mockCommunication.head.mockResolvedValueOnce(new Response(null, {
                status: 200,
                headers: new Headers({'Link': '<example>;rel="something"'})
            }))
            await expect(() => retrieveWriteLocation(baseUrl, mockCommunication)).rejects.toThrow(Error)
        })

        it('throws error when no link headers are present', async () => {
            mockCommunication.head.mockResolvedValueOnce(new Response(null, {status: 200}))

            await expect(() => retrieveWriteLocation(baseUrl + 'nonexistingresource', mockCommunication)).rejects.toThrow(Error)
        })
    })

    describe('has functionality for a versioned LDES', () => {
        const base = "http://example.org/ldesindlp/"
        const eventStreamIdentifier = `${base}#EventStream`
        const nodeIdentifier = base
        const shape = `${base}shape.ttl`
        const date = new Date()
        const treePath = DCT.created

        it('adds a shape based on the config.', () => {
            const store = new Store()
            addShapeToEventStream(store, {eventStreamIdentifier, shape})
            expect(store.getQuads(eventStreamIdentifier, TREE.shape, shape, null).length).toBe(1)
        })

        it('does not add a shape based on the config.', () => {
            const store = new Store()
            addShapeToEventStream(store, {eventStreamIdentifier})
            expect(store.getQuads(eventStreamIdentifier, TREE.shape, null, null).length).toBe(0)

        })

        it('adds a relation.', () => {
            const store = new Store()
            addRelationToNode(store, {date, nodeIdentifier, treePath})
            expect(store.getQuads(nodeIdentifier, TREE.relation, null, null).length).toBe(1)

            const relationNode = store.getObjects(nodeIdentifier, TREE.relation, null)[0]
            expect(store.getQuads(relationNode, null, null, null).length).toBe(4)
            expect(store.getQuads(relationNode, RDF.type, TREE.GreaterThanOrEqualToRelation, null).length).toBe(1)
            expect(store.getQuads(relationNode, TREE.node, nodeIdentifier + date.valueOf() + '/', null).length).toBe(1)
            expect(store.getQuads(relationNode, TREE.path, DCT.created, null).length).toBe(1)
            expect(store.getQuads(relationNode, TREE.value, dateToLiteral(date), null).length).toBe(1)
        });

        it('adds a root node.', () => {
            const store = new Store()
            addRootNodetoEventStream(store, {
                date,
                eventStreamIdentifier,
                nodeIdentifier,
                treePath
            })

            expect(store.getQuads(nodeIdentifier, RDF.type, TREE.Node, null).length).toBe(1)

            // test whether relation is created
            expect(store.getQuads(nodeIdentifier, TREE.relation, null, null).length).toBe(1)
            const relationNode = store.getObjects(nodeIdentifier, TREE.relation, null)[0]
            expect(store.getQuads(relationNode, null, null, null).length).toBe(4)
        });

        it('generates metadata for a versioned LDES as defined in LDES in LDP.', () => {
            const store = new Store()
            createVersionedEventStream(store, {
                LDESinLDPIdentifier: base,
                treePath,
                versionOfPath: DCT.isVersionOf
            }, date)
            expect(store.getQuads(eventStreamIdentifier, RDF.type, LDES.EventStream, null).length).toBe(1)
            expect(store.getQuads(eventStreamIdentifier, LDES.timestampPath, DCT.created, null).length).toBe(1)
            expect(store.getQuads(eventStreamIdentifier, LDES.versionOfPath, DCT.isVersionOf, null).length).toBe(1)
            expect(store.getQuads(eventStreamIdentifier, TREE.view, nodeIdentifier, null).length).toBe(1)
        })
    });
    describe('when creatin LDP containers', () => {
        let mockCommunication: jest.Mocked<Communication>
        const mockedBaseUrl = 'http://example.org/ldesinldp/'


        beforeEach(() => {
            mockCommunication = {
                delete: jest.fn(),
                head: jest.fn(),
                get: jest.fn(),
                patch: jest.fn(),
                post: jest.fn(),
                put: jest.fn()
            }

            mockCommunication.put.mockResolvedValue(new Response(null, {
                status: 201
            }))

        });
        it('succeeds when status is 201.', async () => {
            await expect(() => createContainer(mockedBaseUrl, mockCommunication)).resolves
        });

        it('fails when status is not 201.', async () => {
            mockCommunication.put = jest.fn()
            mockCommunication.put.mockResolvedValue(new Response(null, {
                status: 205
            }))
            await expect(() => createContainer(mockedBaseUrl, mockCommunication)).rejects.toThrow(Error)
        });
    });
})
