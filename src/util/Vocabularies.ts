// Creating vocabularies is copied from https://github.com/solid/community-server/blob/b42150cf52212ff2d6ba76e0db78faf71b10db89/src/util/Vocabularies.ts
import {namedNode} from '@rdfjs/data-model';
import {NamedNode} from 'rdf-js';

type RecordOf<TKey extends any[], TValue> = Record<TKey[number], TValue>;

export type Namespace<TKey extends any[], TValue> =
    { namespace: TValue } & RecordOf<TKey, TValue>;

/**
 * Creates a function that expands local names from the given base URI,
 * and exports the given local names as properties on the returned object.
 */
export function createNamespace<TKey extends string, TValue>(
    baseUri: string,
    toValue: (expanded: string) => TValue,
    ...localNames: TKey[]
):
    Namespace<typeof localNames, TValue> {
    const expanded: Namespace<typeof localNames, TValue> = {} as any;
    // Expose the main namespace
    expanded.namespace = toValue(baseUri);
    // Expose the listed local names as properties
    for (const localName of localNames) {
        (expanded as RecordOf<TKey[], TValue>)[localName] = toValue(`${baseUri}${localName}`);
    }
    return expanded;
}

/**
 * Creates a function that expands local names from the given base URI into strings,
 * and exports the given local names as properties on the returned object.
 */
export function createUriNamespace<T extends string>(baseUri: string, ...localNames: T[]):
    Namespace<typeof localNames, string> {
    return createNamespace(baseUri, (expanded): string => expanded, ...localNames);
}

/**
 * Creates a function that expands local names from the given base URI into named nodes,
 * and exports the given local names as properties on the returned object.
 */
export function createTermNamespace<T extends string>(baseUri: string, ...localNames: T[]):
    Namespace<typeof localNames, NamedNode> {
    return createNamespace(baseUri, namedNode, ...localNames);
}

/**
 * Creates a function that expands local names from the given base URI into string,
 * and exports the given local names as properties on the returned object.
 * Under the `terms` property, it exposes the expanded local names as named nodes.
 */
export function createUriAndTermNamespace<T extends string>(baseUri: string, ...localNames: T[]):
    Namespace<typeof localNames, string> & { terms: Namespace<typeof localNames, NamedNode> } {
    return Object.assign(createUriNamespace(baseUri, ...localNames),
        {terms: createTermNamespace(baseUri, ...localNames)});
}

export const AS = createUriAndTermNamespace('https://www.w3.org/ns/activitystreams#',
    'Announce',
    'Person',
    'Arrive',
    'Link',
    'Add',
    'actor',
    'object',
    'location',
    'href',
    'name',
    'url');

export const DCAT = createUriAndTermNamespace('http://www.w3.org/ns/dcat#',
    'Dataset',
    'DataService',
    'servesDataset',
    'contactPoint',
    'endpointURL');

export const DCT = createUriAndTermNamespace('http://purl.org/dc/terms/',
    'conformsTo',
    'creator',
    'created',
    'description',
    'identifier',
    'issued',
    'isVersionOf',
    'license',
    'modified',
    'subject',
    'hasVersion',
    'title');

export const LDES = createUriAndTermNamespace('https://w3id.org/ldes#',
    'BucketizerConfiguration',
    'BucketizeStrategy',
    'DeletedLDPResource',
    'DurationAgoPolicy',
    'EventStream',
    'LatestVersionSubset',
    'LDESinLDPClient',
    'amount',
    'bucketType',
    'bucketizeStrategy',
    'bucketizer',
    'configuration',
    'managedBy',
    'pageSize',
    'retentionPolicy',
    'timestampFragmentation',
    'timestampPath',
    'versionMaterializationOf',
    'versionMaterializationUntil',
    'versionOfPath',
);

export const LDP = createUriAndTermNamespace('http://www.w3.org/ns/ldp#',
    'contains',
    'BasicContainer',
    'Container',
    'Resource',
    'constrainedBy',
    'inbox');

export const SH = createUriAndTermNamespace('http://www.w3.org/ns/shacl#',
    'targetClass',
    'or');

export const RDF = createUriAndTermNamespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'type');

export const TREE = createUriAndTermNamespace('https://w3id.org/tree#',
    'Collection',
    'GreaterThanOrEqualToRelation',
    'Node',
    'ViewDescription',
    'member',
    'node',
    'path',
    'relation',
    'shape',
    'value',
    'view',
    'viewDescription');

export const VOID = createUriAndTermNamespace('http://rdfs.org/ns/void#',
    'subset');

export const XSD = createUriAndTermNamespace('http://www.w3.org/2001/XMLSchema#',
    'positiveInteger',
    'integer',
    'dateTime',
    'duration'
    );
