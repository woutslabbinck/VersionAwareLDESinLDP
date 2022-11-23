import {Store} from "n3";
import {namedNode} from "@rdfjs/data-model";
import {patchSparqlUpdateDelete, patchSparqlUpdateInsert} from "../../../src/util/PatchUtil";

describe('A PatchUtil', () => {
    let store: Store
    beforeEach(() => {
        store = new Store()
        store.addQuad(namedNode('a'), namedNode('b'), namedNode('c'))
    });

    it('creates a SPARQL Update INSERT query given a store.', () => {
        const query = patchSparqlUpdateInsert(store)
        const expected = `INSERT DATA {<a> <b> <c> .
};`
        expect(query).toEqual(expected)
    });

    it('creates a SPARQL Update DELETE query given a store.', () => {
        const query = patchSparqlUpdateDelete(store)
        const expected = `DELETE DATA {<a> <b> <c> .
};`
        expect(query).toEqual(expected)
    });
});
