import {DataFactory, Store} from "n3";
import {DCT, TREE} from "../../src/util/Vocabularies";
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;

/**
 * Adds a simple member triple to an N3 store
 * @param store
 * @param memberURI URI of the member to be created
 * @param evenStreamURI URI of the
 */
export function addSimpleMember(store: Store, memberURI: string, evenStreamURI: string) {
    store.addQuad(namedNode(evenStreamURI), namedNode(TREE.member), namedNode(memberURI))
    store.addQuad(namedNode(memberURI), namedNode(DCT.title), literal('Title'))
}
