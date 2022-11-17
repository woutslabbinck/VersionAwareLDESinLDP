import {baseUrl} from "../util/solidHelper";
import {DCT, LDP} from "../../src/util/Vocabularies";
import {createContainer, retrieveWriteLocation} from "../../src/ldes/Util";
import {LDPCommunication} from "../../src/ldp/LDPCommunication";
import {LDESinLDP} from "../../src/ldes/LDESinLDP";
import {LILConfig} from "../../src/metadata/LILConfig";
import {ILDES} from "../../src/ldes/ILDES";
import {Status} from "../../src/ldes/Status";
import {addSimpleMember} from "../util/LdesTestUtility";
import {DataFactory, Store} from "n3";
import {ILDESinLDPMetadata} from "../../src/metadata/LDESinLDPMetadata";
import {dateToLiteral} from "../../src/util/TimestampUtil";
import {memberStreamtoStore} from "../../src/util/Conversion";
import {MetadataParser} from "../../src/metadata/MetadataParser";
import namedNode = DataFactory.namedNode;

describe('An LDESinLDP', () => {
    const communication = new LDPCommunication()
    const treePath = DCT.created
    let lil: ILDES
    let config: LILConfig
    let lilIdentifier = baseUrl + 'lil/'
    let metadata: ILDESinLDPMetadata

    beforeAll(async () => {
        config = {
            treePath
        }
        lil = new LDESinLDP(lilIdentifier, communication)
        await lil.initialise(config)
    });

    beforeEach(() => {
        lilIdentifier = baseUrl + 'lil/'
        lil = new LDESinLDP(lilIdentifier, communication)
    });

    describe('when checking the status of an LDES in LDP', () => {
        let status: Status

        beforeEach(() => {
            status = {empty: false, found: false, full: false, valid: false, writable: false}
        });

        it('returns not found when the ldesinldp does not exist.', async () => {
            lilIdentifier = baseUrl + "random/"
            lil = new LDESinLDP(lilIdentifier, communication)

            const lilStatus = await lil.status()
            expect(lilStatus).toEqual(status)
        });

        it('returns found bunt not valid when it just a container.', async () => {
            lilIdentifier = baseUrl + "container/"
            lil = new LDESinLDP(lilIdentifier, communication)

            await createContainer(lilIdentifier, communication)
            const lilStatus = await lil.status()
            status.found = true
            expect(lilStatus).toEqual(status)
        });

        it('returns found, valid, empty and writable when it is a new lil just created.', async () => {
            const lilStatus = await lil.status()
            status.found = true
            status.valid = true
            status.empty = true
            status.writable = true
            expect(lilStatus).toEqual(status)
        });
    });

    describe('when initialising an LDES in LDP', () => {
        beforeEach(() => {
            lilIdentifier = baseUrl + 'ldesinldp_init/'
            lil = new LDESinLDP(lilIdentifier, communication)
        });

        it('fails when the given LDESinLDPIdentifier is not a container.', () => {
            const lilIdentifier = baseUrl + 'lol'
            expect(() => new LDESinLDP(lilIdentifier, communication)).toThrow(Error)
        })

        it('succeeds, given a proper configuration.', async () => {
            await lil.initialise(config)
            console.log(lil.LDESinLDPIdentifier)
            const writeLocation = await retrieveWriteLocation(lilIdentifier, communication)
            const store = await lil.read(lilIdentifier)

            expect(store.getQuads(lilIdentifier, LDP.contains, writeLocation, null).length).toBe(1)
            expect(store.getQuads(lilIdentifier, LDP.inbox, writeLocation, null).length).toBe(1)
            // maybe create store based on date and do the same isomorphic rdf as in the CSS?
        });

        it('does nothing when it was already initialised', async () => {
            const lilIdentifier = baseUrl + 'ldesinldp_init_v2/'
            const lil = new LDESinLDP(lilIdentifier, communication)

            await lil.initialise(config)

            await expect(lil.initialise(config)).resolves.toBeUndefined()
        })
    })

    describe('when reading all members of an LDES in LDP.', () => {
        const t1 = new Date("2022-01-01")
        const t2 = new Date("2022-04-01")
        const t3 = new Date("2022-06-01")

        function createMember(date: Date): Store {
            const store = new Store()
            let memberURI = "#resource"
            addSimpleMember(store, memberURI, metadata.eventStreamIdentifier)
            store.addQuad(namedNode(memberURI), namedNode(treePath), dateToLiteral(date))
            return store
        }

        beforeAll(async () => {
            // add three members
            lilIdentifier = baseUrl + 'lil_members/'
            lil = new LDESinLDP(lilIdentifier, communication)
            config.date = t1
            await lil.initialise(config)

            metadata = MetadataParser.extractLDESinLDPMetadata(await lil.readMetadata())
            await lil.append(createMember(t1))
            await lil.append(createMember(t2))
            await lil.append(createMember(t3))
        });

        beforeEach(() => {
            lilIdentifier = baseUrl + 'lil_members/'
            lil = new LDESinLDP(lilIdentifier, communication)
        });

        it('returns all members when no window is given.', async () => {
            const memberStream = await lil.readAllMembers()
            const memberStore = await memberStreamtoStore(memberStream)
            expect(memberStore.getQuads(null, DCT.title, null, null).length).toBe(3)
        });

        it('returns all members within given window.', async () => {
            const memberStream = await lil.readAllMembers(new Date("2022-02-01"), new Date("2022-05-01"))
            const memberStore = await memberStreamtoStore(memberStream)
            expect(memberStore.getQuads(null, DCT.title, null, null).length).toBe(1)
        });
    });

})
