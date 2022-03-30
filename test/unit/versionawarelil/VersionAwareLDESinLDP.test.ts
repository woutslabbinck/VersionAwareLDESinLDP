import {ILDESinLDP} from "../../../src/ldesinldp/ILDESinLDP";
import {readOptions, VersionAwareLDESinLDP} from "../../../src/versionawarelil/VersionAwareLDESinLDP";
import {
    storeAsMemberStream, storeToString,
    turtleStringToStore
} from "../../../src/util/Conversion";
import {DataFactory, Quad, Store} from "n3";
import namedNode = DataFactory.namedNode;
import {DCT, LDES, LDP, TREE} from "../../../src/util/Vocabularies";
import literal = DataFactory.literal;
import {dateToLiteral} from "../../../src/util/TimestampUtil";

import {RDF} from "@solid/community-server";
import {baseUrl} from "../../util/solidHelper";
import {Readable} from "stream";
import quad = DataFactory.quad;

describe('A VersionAwareLDESinLDP', () => {
    let mockLDESinLDP: jest.Mocked<ILDESinLDP>
    let vAwareLDESinLDP: VersionAwareLDESinLDP
    const ldesinLDPIdentifier = "http://example.org/ldesinldp/"

    function createResource(versionId: string, materializedId: string, date?: Date): Quad[] {
        const store = new Store()
        date = date ? date : new Date()
        store.addQuad(namedNode(versionId), namedNode(DCT.title), literal(`A title at ${date.toLocaleString()}`))
        store.addQuad(namedNode(versionId), namedNode(DCT.isVersionOf), namedNode(materializedId))
        store.addQuad(namedNode(versionId), namedNode(DCT.created), dateToLiteral(date))
        store.addQuad(namedNode(resourceBase + '#collection'), namedNode(TREE.member), namedNode(versionId)) // added to make storeAsMemberStream work
        return store.getQuads(null, null, null, null)
    }

    const lilMetdataString = `
<http://example.org/ldesinldp/> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .
<http://example.org/ldesinldp/> <https://w3id.org/tree#relation> _:genid1 .
<http://example.org/ldesinldp/> <http://www.w3.org/ns/ldp#inbox> <http://example.org/ldesinldp/timestamp/> .
_:genid1 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:genid1 <https://w3id.org/tree#node> <http://example.org/ldesinldp/timestamp/> .
_:genid1 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:genid1 <https://w3id.org/tree#value> "2022-03-28T14:53:28.841Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
<http://example.org/ldesinldp/#EventStream> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#EventStream> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/ldes#versionOfPath> <http://purl.org/dc/terms/isVersionOf> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/ldes#timestampPath> <http://purl.org/dc/terms/created> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/tree#view> <http://example.org/ldesinldp/> .
`
    const resourceBase = 'http://example.org/'
    const resource1 = resourceBase + 'resource1'
    const resource2 = resourceBase + 'resource2'

    beforeEach(async () => {
        mockLDESinLDP = {
            LDESinLDPIdentifier: ldesinLDPIdentifier,
            create: jest.fn(),
            delete: jest.fn(),
            initialise: jest.fn(),
            read: jest.fn(),
            readAllMembers: jest.fn(),
            readMetadata: jest.fn(),
            update: jest.fn()
        }
        const memberStore = new Store()
        memberStore.addQuads(createResource(resourceBase + 'resource1v1', resource1))
        memberStore.addQuads(createResource(resourceBase + 'resource1v2', resource1))
        memberStore.addQuads(createResource(resourceBase + 'resource2v1', resource2))

        const memberStream = storeAsMemberStream(memberStore)
        // mock read all members
        mockLDESinLDP.readAllMembers.mockResolvedValue(memberStream)
        // mock readMetadata
        const metadataStore = await turtleStringToStore(lilMetdataString)
        mockLDESinLDP.readMetadata.mockResolvedValue(metadataStore)
        vAwareLDESinLDP = new VersionAwareLDESinLDP(mockLDESinLDP)

    });

    describe('when initialising a version aware LDES in LDP', () => {
        beforeEach(() => {
            mockLDESinLDP.initialise.mockResolvedValue(undefined)
        });

        it('succeeds with a shape.', async () => {
            await expect(await vAwareLDESinLDP.initialise(mockLDESinLDP.LDESinLDPIdentifier)).toBeUndefined()
        });

        it('succeeds without a shape.', async () => {
            await expect(await vAwareLDESinLDP.initialise(mockLDESinLDP.LDESinLDPIdentifier, 'http;//example.org/shape')).toBeUndefined()
        });
    });

    describe('when creating a version aware LDES in LDP', () => {

        const newResourceStore = new Store()
        const resource3 = resourceBase + 'resource3'

        beforeEach(() => {
            newResourceStore.addQuad(namedNode('#resource'), namedNode(DCT.title), namedNode('Test'))
        });

        it('succeeds when the materializedIdentifier does not exist yet.', async () => {
            await expect(await vAwareLDESinLDP.create(resource3, newResourceStore)).toBeUndefined()
        });

        it('succeeds when the materializedIdentifier does not exist yet (with version specific identifier).', async () => {
            await expect(await vAwareLDESinLDP.create(resource3, newResourceStore, '#resource')).toBeUndefined()
        });

        it('throws an error when the materializedIdentifier does already exist.', async () => {
            await expect(async () => await vAwareLDESinLDP.create(resource1, newResourceStore)).rejects.toThrow(Error)
        });
    });

    describe('when reading a version aware LDES in LDP', () => {

        it('returns the materialized version of a resource as a N3 store.', async () => {
            const store = await vAwareLDESinLDP.read(resource1)
            expect(store.size).toBe(1)
            expect(store.getQuads(resource1, null, null, null).length).toBe(1)
            expect(mockLDESinLDP.readAllMembers).toHaveBeenCalledTimes(1)
            expect(mockLDESinLDP.readMetadata).toHaveBeenCalledTimes(1)
        });

        it('returns the materialized container of the resources as a N3 store.', async () => {
            const store = await vAwareLDESinLDP.read(ldesinLDPIdentifier)
            expect(store.size).toBe(3)
            expect(store.getQuads(ldesinLDPIdentifier, LDP.contains, null, null).length).toBe(2)
            expect(store.getQuads(ldesinLDPIdentifier, RDF.type, LDP.BasicContainer, null).length).toBe(1)
            expect(mockLDESinLDP.readAllMembers).toHaveBeenCalledTimes(1)
            expect(mockLDESinLDP.readMetadata).toHaveBeenCalledTimes(1)
        })

        it('throws an error when there is no corresponding resource given the materialized identifier.', async () => {
            await expect(async () => await vAwareLDESinLDP.read(resourceBase + 'resource3')).rejects.toThrow(Error)
        });

        it('throws an error when the materialized identifier is a random container identifier.', async () => {
            await expect(async () => await vAwareLDESinLDP.read(resourceBase)).rejects.toThrow(Error)
        });

        it('returns the materialized version of a resource as a N3 store at a specific point in time.', async () => {
            const options: readOptions = {
                date: new Date("2022-02-01T00:00:00"),
                derived: false,
                materialized: true
            }
            const memberStore = new Store()
            const dateResource1v1 = new Date("2022-01-01T00:00:00")
            memberStore.addQuads(createResource(resourceBase + 'resource1v1', resource1, dateResource1v1))
            memberStore.addQuads(createResource(resourceBase + 'resource1v2', resource1))

            const memberStream = storeAsMemberStream(memberStore)
            // mock read all members
            mockLDESinLDP.readAllMembers.mockResolvedValue(memberStream)

            const store = await vAwareLDESinLDP.read(resource1, options)
            expect(store.size).toBe(1)
            expect(store.getQuads(resource1, null, null, null).length).toBe(1)
            expect(store.getQuads(resource1, null, null, null)[0].object.value).toBe(
                `A title at ${dateResource1v1.toLocaleString()}`
            )
            expect(mockLDESinLDP.readAllMembers).toHaveBeenCalledTimes(1)
            expect(mockLDESinLDP.readMetadata).toHaveBeenCalledTimes(1)
        });

        it('returns a metarialized derived container based on the options.', async () => {
            const options: readOptions = {
                date: new Date(),
                derived: true,
                materialized: true
            }
            const store = await vAwareLDESinLDP.read(ldesinLDPIdentifier, options)
            expect(mockLDESinLDP.readAllMembers).toHaveBeenCalledTimes(1)
            expect(mockLDESinLDP.readMetadata).toHaveBeenCalledTimes(1)

            // resource 1 and 2 are here added as defined by being a derived container
            expect(store.getQuads(resource1, null, null, null).length).toBe(1)
            expect(store.getQuads(resource2, null, null, null).length).toBe(1)
        });

        it('returns a derived container based on the options.', async () => {
            const options: readOptions = {
                date: new Date(),
                derived: true,
                materialized: false
            }
            const store = await vAwareLDESinLDP.read(ldesinLDPIdentifier, options)
            expect(mockLDESinLDP.readAllMembers).toHaveBeenCalledTimes(1)
            expect(mockLDESinLDP.readMetadata).toHaveBeenCalledTimes(1)

            const identifiers = store.getObjects(null, LDP.contains, null)
            for (const identifier of identifiers) {
                expect(identifier.value).not.toEqual(resource1)
                expect(store.getQuads(identifier, null, null, null).length).toBe(3)
            }
        });

        it('throws error when resource was deleted.', async () => {
            // stream with one resource with extra triples
            const resource1Quads = createResource(resource1 + 'v1', resource1, new Date("2022-01-01T00:00:00"))
            const resource1Quadsv2 = createResource(resource1 + 'v2', resource1,new Date("2022-01-02T00:00:00"))
            resource1Quadsv2.push(quad(namedNode(resource1 + 'v2'),namedNode(RDF.type),namedNode(LDES.DeletedLDPResource)))
            const stream = new Readable({
                objectMode: true,
                read() {
                    this.push({
                        id: resource1 + 'v1',
                        quads: resource1Quads
                    })
                    this.push({
                        id: resource1 + 'v2',
                        quads: resource1Quadsv2
                    })

                    this.push(null)
                }
            })
            mockLDESinLDP.readAllMembers.mockResolvedValueOnce(stream)
            await expect(async () => await vAwareLDESinLDP.read(resource1)).rejects.toThrow(Error)
        });
    });


    describe('when updating a version aware LDES in LDP', () => {
        const updatedResourceStore = new Store()

        beforeEach(() => {
            updatedResourceStore.addQuad(namedNode('#resource'), namedNode(DCT.title), namedNode('Test'))
        });

        it('succeeds when the materializedIdentifier does already exist.', async () => {
            await expect(await vAwareLDESinLDP.update(resource1, updatedResourceStore)).toBeUndefined()
        });

        it('succeeds when the materializedIdentifier does already exist (with version specific identifier).', async () => {
            await expect(await vAwareLDESinLDP.update(resource1, updatedResourceStore, '#resource')).toBeUndefined()
        });

        it('throws an error when the materializedIdentifier does not exist yet.', async () => {
            await expect(async () => await vAwareLDESinLDP.update(baseUrl + 'resource3', updatedResourceStore)).rejects.toThrow(Error)
        });
    });

    describe('when deleting a version aware LDES in LDP', () => {


        beforeEach(() => {


        });
        it('succeeds when the materializedIdentifier does already exist.', async () => {
            await expect(await vAwareLDESinLDP.delete(resource1)).toBeUndefined()
        });

        it('throws an error when the materializedIdentifier does not exist yet.', async () => {
            await expect(async () => await vAwareLDESinLDP.delete(baseUrl + 'resource3')).rejects.toThrow(Error)
        })

        it('succeeds when the materializedIdentifier does already exist + copies all extra quads', async () => {
            // stream with one resource with extra triples
            const resource1Quads = createResource(resource1 + 'v1', resource1)
            const stream = new Readable({
                objectMode: true,
                read() {
                    this.push({
                        id: resource1 + 'v1',
                        quads: resource1Quads
                    })
                    this.push(null)
                }
            })
            mockLDESinLDP.readAllMembers.mockResolvedValueOnce(stream)
            await expect(await vAwareLDESinLDP.delete(resource1)).toBeUndefined()

        });
    });
})
